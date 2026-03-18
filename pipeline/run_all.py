#!/usr/bin/env python3
"""Pipeline orchestrator — run scripts in dependency order with timing and logging.

Usage:
    python pipeline/run_all.py                    # Run all steps (sequential)
    python pipeline/run_all.py --parallel          # Run independent steps concurrently
    python pipeline/run_all.py --parallel --workers 8
    python pipeline/run_all.py --steps grades,ratings,fingerprints
    python pipeline/run_all.py --from ratings      # Start from a specific step
    python pipeline/run_all.py --dry-run           # Show what would run
    python pipeline/run_all.py --list              # List all steps

Each step maps to one or more pipeline scripts. Steps run in dependency order.
When --parallel is enabled, steps at the same dependency level run concurrently.
Results are logged to the cron_log table with timing and row counts.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime

import psycopg2
from dotenv import load_dotenv

_pipeline_dir = os.path.dirname(os.path.abspath(__file__))
_repo_root = os.path.dirname(_pipeline_dir)
_env_local = os.path.join(_repo_root, ".env.local")
_env = os.path.join(_repo_root, ".env")
load_dotenv(_env_local if os.path.exists(_env_local) else _env)

DSN = os.environ.get("POSTGRES_DSN")
PIPELINE_DIR = _pipeline_dir
PYTHON = sys.executable


@dataclass
class Step:
    name: str
    scripts: list[str]           # Script filenames (relative to pipeline/)
    description: str
    flags: list[str] = field(default_factory=list)  # Extra flags to pass
    depends_on: list[str] = field(default_factory=list)
    optional: bool = False       # Skip failures without aborting
    supports_incremental: bool = False  # Script accepts --incremental flag
    supports_force: bool = True        # Script accepts --force flag
    timeout: int = 900                   # Per-script timeout in seconds


# Ordered pipeline steps — each step's scripts run sequentially
STEPS: list[Step] = [
    # ── Data ingestion ──
    Step("news", ["12_news_ingest.py"], "Fetch + process news stories",
         flags=["--limit", "50"]),

    # ── External data ingest ──
    Step("api_football_ingest", ["65_api_football_ingest.py"], "Fetch API-Football stats (top 5 leagues)",
         optional=True, supports_force=False),  # Requires API key + rate-limited; --force re-fetches from API

    # ── Grade computation ──
    Step("understat_grades", ["30_understat_grades.py"], "Understat → attribute grades",
         flags=["--force"]),
    Step("statsbomb_grades", ["31_statsbomb_grades.py"], "StatsBomb → attribute grades",
         optional=True, supports_force=False),  # Can timeout on large event datasets
    Step("api_football_grades", ["66_api_football_grades.py"], "API-Football → attribute grades",
         depends_on=["api_football_ingest"], optional=True, supports_force=False),

    # ── Ratings & profiling ──
    Step("ratings", ["27_player_ratings.py"], "Composite ratings + best_role + compound scores",
         flags=["--force"],
         depends_on=["understat_grades", "statsbomb_grades", "api_football_grades"],
         supports_incremental=True),
    Step("scouting_tags", ["32_scouting_tags.py"], "Auto-assign scouting tags",
         depends_on=["ratings"]),
    Step("squad_roles", ["33_squad_roles.py"], "DOF squad role assessment",
         depends_on=["ratings"]),

    # ── Personality ──
    Step("personality_rules", ["34_personality_rules.py"], "Rule-based personality corrections",
         depends_on=["ratings"]),

    # ── Inference ──
    Step("infer_personality", ["36_infer_personality.py"], "Heuristic personality inference",
         depends_on=["ratings"], optional=True),
    Step("infer_blueprints", ["37_infer_blueprints.py"], "Blueprint assignment",
         depends_on=["ratings"], optional=True),
    Step("infer_levels", ["38_infer_levels.py"], "Infer levels from compounds",
         depends_on=["ratings"], optional=True),
    Step("current_level", ["39_current_level.py"], "Age-decay current level",
         depends_on=["infer_levels"], optional=True),

    # ── Valuation ──
    Step("valuation", ["40_valuation_engine.py"], "Transfer valuations",
         depends_on=["ratings"], timeout=1800, optional=True),  # Heavy: 4k+ Monte Carlo, can timeout
    Step("dof_valuation", ["41_dof_valuations.py"], "DoF-anchored valuations",
         depends_on=["valuation"], optional=True),
    Step("cs_value", ["43_cs_value.py"], "Chief Scout value",
         depends_on=["ratings"], optional=True),
    Step("career_xp", ["44_career_xp.py"], "Career XP milestones",
         flags=["--force"],
         depends_on=["ratings"]),

    # ── Output ──
    Step("fingerprints", ["60_fingerprints.py"], "Role-specific percentile radar fingerprints",
         flags=["--force"],
         depends_on=["ratings"]),
    Step("free_agents", ["62_populate_free_agents.py"], "Contract expiry + free agent tags",
         optional=True),

    # ── Sentiment (independent) ──
    Step("sentiment", ["24_news_sentiment.py"], "News sentiment aggregation",
         flags=["--force"],
         depends_on=["news"], optional=True),
    Step("career_metrics", ["23_career_metrics.py"], "Career trajectory metrics",
         flags=["--force"], optional=True),

    # ── Validation (always last) ──
    Step("validate", ["63_validate.py"], "Post-pipeline data quality checks",
         depends_on=["ratings", "fingerprints"]),
]

STEP_MAP = {s.name: s for s in STEPS}


def topo_sort(steps: list[Step], start_from: str | None = None) -> list[Step]:
    """Topological sort respecting depends_on. Optionally start from a given step."""
    visited: set[str] = set()
    result: list[Step] = []

    def visit(name: str):
        if name in visited:
            return
        visited.add(name)
        step = STEP_MAP.get(name)
        if not step:
            return
        for dep in step.depends_on:
            visit(dep)
        result.append(step)

    for s in steps:
        visit(s.name)

    if start_from:
        # Find index of start_from and slice
        idx = next((i for i, s in enumerate(result) if s.name == start_from), 0)
        result = result[idx:]

    return result


def compute_levels(ordered: list[Step]) -> list[list[Step]]:
    """Group topo-sorted steps into execution levels.

    Level 0 = no dependencies (or all deps outside the ordered set).
    Level N = depends only on steps at levels < N.
    Steps within the same level can run in parallel.
    """
    ordered_names = {s.name for s in ordered}
    step_level: dict[str, int] = {}

    for step in ordered:
        # Only consider deps that are in the ordered set
        deps_in_set = [d for d in step.depends_on if d in ordered_names]
        if not deps_in_set:
            step_level[step.name] = 0
        else:
            step_level[step.name] = max(step_level[d] for d in deps_in_set) + 1

    # Group by level
    max_level = max(step_level.values()) if step_level else 0
    levels: list[list[Step]] = [[] for _ in range(max_level + 1)]
    for step in ordered:
        levels[step_level[step.name]].append(step)

    return levels


def run_script(script: str, extra_flags: list[str], dry_run: bool = False, timeout: int = 900) -> tuple[bool, float, str]:
    """Run a single pipeline script. Returns (success, duration_seconds, output)."""
    path = os.path.join(PIPELINE_DIR, script)
    if not os.path.exists(path):
        return False, 0, f"Script not found: {path}"

    cmd = [PYTHON, path] + extra_flags

    if dry_run:
        print(f"      [dry-run] {' '.join(cmd)}")
        return True, 0, "dry-run"

    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.path.dirname(PIPELINE_DIR),  # repo root
            env={**os.environ, "POSTGRES_DSN": DSN or ""},
        )
        duration = time.time() - start
        output = result.stdout[-2000:] if result.stdout else ""  # Last 2KB
        if result.returncode != 0:
            error = result.stderr[-1000:] if result.stderr else "Unknown error"
            return False, duration, f"Exit code {result.returncode}: {error}"
        return True, duration, output
    except subprocess.TimeoutExpired:
        return False, timeout, f"Timed out after {timeout}s"
    except Exception as e:
        return False, time.time() - start, str(e)


def log_to_db(job: str, stats: dict):
    """Write run results to cron_log table."""
    if not DSN:
        return
    try:
        conn = psycopg2.connect(DSN)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO cron_log (job, stats) VALUES (%s, %s)",
            (job, json.dumps(stats)),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"  [warn] Failed to log to cron_log: {e}")


def main():
    parser = argparse.ArgumentParser(description="Pipeline orchestrator")
    parser.add_argument("--steps", type=str, help="Comma-separated step names to run")
    parser.add_argument("--from", dest="start_from", type=str, help="Start from this step (includes dependencies)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would run without executing")
    parser.add_argument("--list", action="store_true", help="List all steps and exit")
    parser.add_argument("--force", action="store_true", help="Pass --force to all scripts")
    parser.add_argument("--incremental", action="store_true", help="Pass --incremental to scripts that support it (skip unchanged data)")
    parser.add_argument("--skip-optional", action="store_true", help="Skip optional steps")
    parser.add_argument("--parallel", action="store_true", help="Run independent steps concurrently")
    parser.add_argument("--workers", type=int, default=4, help="Max parallel workers (default: 4, requires --parallel)")
    args = parser.parse_args()

    if args.list:
        print("Pipeline Steps:")
        print(f"  {'Name':<20s} {'Scripts':<35s} {'Deps':<25s} {'Opt':<5s} Description")
        print("  " + "─" * 110)
        for s in STEPS:
            deps = ", ".join(s.depends_on) if s.depends_on else "–"
            scripts = ", ".join(s.scripts)
            opt = "yes" if s.optional else ""
            print(f"  {s.name:<20s} {scripts:<35s} {deps:<25s} {opt:<5s} {s.description}")
        return

    # Determine which steps to run
    if args.steps:
        names = [n.strip() for n in args.steps.split(",")]
        selected = [STEP_MAP[n] for n in names if n in STEP_MAP]
        if not selected:
            print(f"No valid steps found in: {args.steps}")
            print(f"Available: {', '.join(STEP_MAP.keys())}")
            sys.exit(1)
    else:
        selected = list(STEPS)

    if args.skip_optional:
        selected = [s for s in selected if not s.optional]

    ordered = topo_sort(selected, args.start_from)

    print(f"Pipeline Orchestrator — {len(ordered)} steps")
    if args.dry_run:
        print("  [DRY RUN]")
    if args.parallel:
        print(f"  [PARALLEL] max workers: {args.workers}")
    print()

    # Run steps
    results: list[dict] = []
    total_start = time.time()
    failed = False

    def run_step(step: Step) -> dict:
        """Run a single step (all its scripts). Returns result dict."""
        step_start = time.time()
        step_ok = True
        lines: list[str] = []

        for script in step.scripts:
            flags = list(step.flags)
            if args.force and step.supports_force and "--force" not in flags:
                flags.append("--force")
            if args.incremental and step.supports_incremental and "--incremental" not in flags:
                flags.append("--incremental")

            ok, duration, output = run_script(script, flags, dry_run=args.dry_run, timeout=step.timeout)

            if ok:
                lines.append(f"    \u2713 {script} ({duration:.1f}s)")
            else:
                lines.append(f"    \u2717 {script} ({duration:.1f}s)")
                for line in output.strip().split("\n")[-3:]:
                    lines.append(f"      {line}")
                step_ok = False

        step_duration = time.time() - step_start
        return {
            "step": step.name,
            "status": "ok" if step_ok else "failed",
            "duration_s": round(step_duration, 1),
            "scripts": step.scripts,
            "optional": step.optional,
            "output_lines": lines,
        }

    if args.parallel:
        # ── Parallel mode: run steps level-by-level ──
        levels = compute_levels(ordered)

        for level_idx, level_steps in enumerate(levels):
            # Filter out skipped optional steps
            if args.skip_optional:
                level_steps = [s for s in level_steps if not s.optional]
            if not level_steps:
                continue

            step_names = ", ".join(s.name for s in level_steps)
            if len(level_steps) > 1:
                print(f"  [parallel] {step_names}")
            else:
                print(f"  [level {level_idx}] {step_names}")

            for s in level_steps:
                print(f"  [{s.name}] {s.description}")

            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                futures = {executor.submit(run_step, s): s for s in level_steps}
                level_results = []
                for future in as_completed(futures):
                    result = future.result()
                    level_results.append(result)

            # Print output and collect results (in original order for determinism)
            level_results.sort(key=lambda r: [s.name for s in level_steps].index(r["step"]))
            for result in level_results:
                for line in result["output_lines"]:
                    print(line)
                results.append(result)

                if result["status"] != "ok" and not result["optional"]:
                    print(f"\n  \u2717 {result['step']} FAILED \u2014 aborting pipeline")
                    failed = True
                elif result["status"] != "ok":
                    print(f"    (optional \u2014 continuing)")

            if failed:
                break
            print()
    else:
        # ── Sequential mode (default) ──
        for step in ordered:
            prefix = f"  [{step.name}]"
            if args.skip_optional and step.optional:
                print(f"{prefix} SKIPPED (optional)")
                continue

            print(f"{prefix} {step.description}")

            result = run_step(step)
            for line in result["output_lines"]:
                print(line)
            results.append(result)

            if result["status"] != "ok" and not step.optional:
                print(f"\n  \u2717 {step.name} FAILED \u2014 aborting pipeline")
                failed = True
                break
            elif result["status"] != "ok":
                print(f"    (optional \u2014 continuing)")

    total_duration = time.time() - total_start

    # Summary
    print()
    print(f"  {'─' * 50}")
    ok_count = sum(1 for r in results if r["status"] == "ok")
    fail_count = sum(1 for r in results if r["status"] == "failed")
    print(f"  Done: {ok_count} passed, {fail_count} failed, {total_duration:.1f}s total")
    print()

    for r in results:
        icon = "✓" if r["status"] == "ok" else "✗"
        print(f"    {icon} {r['step']:<20s} {r['duration_s']:>6.1f}s")

    # Log to DB (strip output_lines from results before logging)
    if not args.dry_run:
        log_results = [{k: v for k, v in r.items() if k not in ("output_lines", "optional")} for r in results]
        log_to_db("pipeline_run", {
            "steps": log_results,
            "total_duration_s": round(total_duration, 1),
            "ok": ok_count,
            "failed": fail_count,
            "aborted": failed,
            "ran_at": datetime.now().astimezone().isoformat(),
        })

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
