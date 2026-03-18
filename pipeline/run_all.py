#!/usr/bin/env python3
"""Pipeline orchestrator — run scripts in dependency order with timing and logging.

Usage:
    python pipeline/run_all.py                    # Run all steps
    python pipeline/run_all.py --steps grades,ratings,fingerprints
    python pipeline/run_all.py --from ratings      # Start from a specific step
    python pipeline/run_all.py --dry-run           # Show what would run
    python pipeline/run_all.py --list              # List all steps

Each step maps to one or more pipeline scripts. Steps run in dependency order.
Results are logged to the cron_log table with timing and row counts.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DSN = os.environ.get("POSTGRES_DSN")
PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
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


# Ordered pipeline steps — each step's scripts run sequentially
STEPS: list[Step] = [
    # ── Data ingestion ──
    Step("news", ["12_news_ingest.py"], "Fetch + process news stories",
         flags=["--limit", "50"]),

    # ── Grade computation ──
    Step("understat_grades", ["30_understat_grades.py"], "Understat → attribute grades",
         flags=["--force"]),
    Step("statsbomb_grades", ["31_statsbomb_grades.py"], "StatsBomb → attribute grades"),

    # ── Ratings & profiling ──
    Step("ratings", ["27_player_ratings.py"], "Composite ratings + best_role + compound scores",
         flags=["--force"],
         depends_on=["understat_grades", "statsbomb_grades"],
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
         depends_on=["ratings"]),
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


def run_script(script: str, extra_flags: list[str], dry_run: bool = False) -> tuple[bool, float, str]:
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
            timeout=600,  # 10 min per script max
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
        return False, 600, "Timed out after 600s"
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
    print()

    # Run steps
    results: list[dict] = []
    total_start = time.time()
    failed = False

    for step in ordered:
        prefix = f"  [{step.name}]"
        if args.skip_optional and step.optional:
            print(f"{prefix} SKIPPED (optional)")
            continue

        print(f"{prefix} {step.description}")

        step_start = time.time()
        step_ok = True

        for script in step.scripts:
            flags = list(step.flags)
            if args.force and "--force" not in flags:
                flags.append("--force")
            if args.incremental and step.supports_incremental and "--incremental" not in flags:
                flags.append("--incremental")

            ok, duration, output = run_script(script, flags, dry_run=args.dry_run)

            if ok:
                print(f"    ✓ {script} ({duration:.1f}s)")
            else:
                print(f"    ✗ {script} ({duration:.1f}s)")
                # Print last few lines of error
                for line in output.strip().split("\n")[-3:]:
                    print(f"      {line}")
                step_ok = False

        step_duration = time.time() - step_start

        result = {
            "step": step.name,
            "status": "ok" if step_ok else "failed",
            "duration_s": round(step_duration, 1),
            "scripts": step.scripts,
        }
        results.append(result)

        if not step_ok and not step.optional:
            print(f"\n  ✗ {step.name} FAILED — aborting pipeline")
            failed = True
            break
        elif not step_ok:
            print(f"    (optional — continuing)")

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

    # Log to DB
    if not args.dry_run:
        log_to_db("pipeline_run", {
            "steps": results,
            "total_duration_s": round(total_duration, 1),
            "ok": ok_count,
            "failed": fail_count,
            "aborted": failed,
            "ran_at": datetime.now().astimezone().isoformat(),
        })

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
