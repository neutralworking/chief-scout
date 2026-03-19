#!/usr/bin/env python3
"""63 — Post-pipeline data validation.

Runs after pipeline steps to catch regressions, anomalies, and quality issues.
Logs results to cron_log and prints a human-readable report.

Checks:
  1. Row counts — did any table shrink unexpectedly?
  2. Coverage — are key fields populated at expected rates?
  3. Distributions — did grade/score distributions shift?
  4. Orphans — foreign key integrity (players without profiles, etc.)
  5. Duplicates — name collisions in people table
  6. Staleness — data freshness checks

Usage:
    python 63_validate.py              # Run all checks
    python 63_validate.py --check coverage,orphans
    python 63_validate.py --strict     # Exit code 1 on any warning
"""

import argparse
import json
import sys
from dataclasses import dataclass, field

from lib.db import require_conn
from lib.incremental import mark_step_complete


@dataclass
class Check:
    name: str
    status: str  # "ok", "warn", "fail"
    message: str
    detail: dict = field(default_factory=dict)


def check_row_counts(conn) -> list[Check]:
    """Verify no table has shrunk to zero or dropped significantly."""
    cur = conn.cursor()
    results = []

    # Expected minimum row counts (approximate, tuned to current state)
    EXPECTED_MINS = {
        "people": 15000,
        "player_profiles": 10000,
        "player_personality": 8000,
        "player_market": 5000,
        "attribute_grades": 100000,
        "clubs": 500,
        "nations": 50,
        "news_stories": 100,
    }

    for table, min_rows in EXPECTED_MINS.items():
        cur.execute(f"SELECT count(*) FROM {table}")
        count = cur.fetchone()[0]

        if count == 0:
            results.append(Check("row_counts", "fail", f"{table}: EMPTY (expected >{min_rows})",
                                 {"table": table, "count": count, "expected_min": min_rows}))
        elif count < min_rows * 0.8:  # Allow 20% drop
            results.append(Check("row_counts", "warn", f"{table}: {count:,} rows (expected >{min_rows:,})",
                                 {"table": table, "count": count, "expected_min": min_rows}))
        else:
            results.append(Check("row_counts", "ok", f"{table}: {count:,}",
                                 {"table": table, "count": count}))

    return results


def check_coverage(conn) -> list[Check]:
    """Check that key fields are populated at expected rates."""
    cur = conn.cursor()
    results = []

    COVERAGE_CHECKS = [
        ("player_profiles", "position", "person_id", 0.5, "position"),
        ("player_profiles", "best_role", "person_id", 0.3, "best_role"),
        ("player_profiles", "overall", "person_id", 0.3, "overall"),
        ("player_profiles", "fingerprint", "person_id", 0.3, "fingerprint"),
        ("player_profiles", "archetype", "person_id", 0.1, "archetype"),
        ("player_personality", "ei", "person_id", 0.5, "personality (ei)"),
        ("player_market", "market_value_eur", "person_id", 0.2, "market_value_eur"),
        ("people", "club_id", "id", 0.4, "club_id"),
        ("people", "date_of_birth", "id", 0.5, "DOB"),
    ]

    cur.execute("SELECT count(*) FROM people")
    total_people = cur.fetchone()[0]

    for table, col, id_col, min_rate, label in COVERAGE_CHECKS:
        cur.execute(f"SELECT count(*) FROM {table} WHERE {col} IS NOT NULL")
        filled = cur.fetchone()[0]
        rate = filled / max(total_people, 1)

        if rate < min_rate * 0.5:
            results.append(Check("coverage", "fail", f"{label}: {rate:.0%} ({filled:,}/{total_people:,}), expected >{min_rate:.0%}",
                                 {"field": label, "rate": round(rate, 3), "filled": filled, "total": total_people}))
        elif rate < min_rate:
            results.append(Check("coverage", "warn", f"{label}: {rate:.0%} ({filled:,}/{total_people:,}), expected >{min_rate:.0%}",
                                 {"field": label, "rate": round(rate, 3), "filled": filled, "total": total_people}))
        else:
            results.append(Check("coverage", "ok", f"{label}: {rate:.0%} ({filled:,})",
                                 {"field": label, "rate": round(rate, 3), "filled": filled}))

    return results


def check_distributions(conn) -> list[Check]:
    """Check that score distributions haven't gone haywire."""
    cur = conn.cursor()
    results = []

    # Overall rating distribution
    cur.execute("""
        SELECT avg(overall)::numeric(5,1),
               stddev(overall)::numeric(5,1),
               min(overall)::numeric(5,1),
               max(overall)::numeric(5,1),
               count(*)
        FROM player_profiles WHERE overall IS NOT NULL
    """)
    row = cur.fetchone()
    if row and row[4] > 0:
        avg_overall, std_overall, min_overall, max_overall, n = row
        if avg_overall and (float(avg_overall) < 30 or float(avg_overall) > 90):
            results.append(Check("distributions", "warn",
                                 f"overall avg={avg_overall} (expected 50-80)",
                                 {"metric": "overall_avg", "value": float(avg_overall)}))
        elif avg_overall and float(std_overall or 0) < 3:
            results.append(Check("distributions", "warn",
                                 f"overall std={std_overall} — too compressed",
                                 {"metric": "overall_std", "value": float(std_overall)}))
        else:
            results.append(Check("distributions", "ok",
                                 f"overall: avg={avg_overall} std={std_overall} range=[{min_overall},{max_overall}] n={n}",
                                 {"avg": float(avg_overall or 0), "std": float(std_overall or 0), "n": n}))

    # best_role_score distribution
    cur.execute("""
        SELECT avg(best_role_score)::numeric(5,1),
               stddev(best_role_score)::numeric(5,1),
               count(*)
        FROM player_profiles WHERE best_role_score IS NOT NULL
    """)
    row = cur.fetchone()
    if row and row[2] > 0:
        avg_rs, std_rs, n = row
        results.append(Check("distributions", "ok",
                             f"best_role_score: avg={avg_rs} std={std_rs} n={n}",
                             {"metric": "role_score", "avg": float(avg_rs or 0), "std": float(std_rs or 0)}))

    # Attribute grade source breakdown
    cur.execute("""
        SELECT source, count(*)
        FROM attribute_grades
        GROUP BY source
        ORDER BY count(*) DESC
    """)
    sources = {row[0]: row[1] for row in cur.fetchall()}
    results.append(Check("distributions", "ok",
                         f"grade sources: {', '.join(f'{k}:{v:,}' for k,v in sources.items())}",
                         {"sources": sources}))

    return results


def check_orphans(conn) -> list[Check]:
    """Check for foreign key integrity issues."""
    cur = conn.cursor()
    results = []

    ORPHAN_CHECKS = [
        ("player_profiles without people",
         "SELECT count(*) FROM player_profiles pp LEFT JOIN people p ON p.id = pp.person_id WHERE p.id IS NULL"),
        ("player_personality without people",
         "SELECT count(*) FROM player_personality pp LEFT JOIN people p ON p.id = pp.person_id WHERE p.id IS NULL"),
        ("attribute_grades without people",
         "SELECT count(DISTINCT ag.player_id) FROM attribute_grades ag LEFT JOIN people p ON p.id = ag.player_id WHERE p.id IS NULL"),
        ("people with invalid club_id",
         "SELECT count(*) FROM people p LEFT JOIN clubs c ON c.id = p.club_id WHERE p.club_id IS NOT NULL AND c.id IS NULL"),
        ("people with invalid nation_id",
         "SELECT count(*) FROM people p LEFT JOIN nations n ON n.id = p.nation_id WHERE p.nation_id IS NOT NULL AND n.id IS NULL"),
    ]

    for label, query in ORPHAN_CHECKS:
        cur.execute(query)
        count = cur.fetchone()[0]
        if count > 0:
            results.append(Check("orphans", "warn", f"{label}: {count:,} orphaned rows",
                                 {"check": label, "count": count}))
        else:
            results.append(Check("orphans", "ok", f"{label}: clean",
                                 {"check": label, "count": 0}))

    return results


def check_duplicates(conn) -> list[Check]:
    """Check for duplicate players by name."""
    cur = conn.cursor()
    results = []

    cur.execute("""
        SELECT name, count(*) as n
        FROM people
        WHERE active = true
        GROUP BY name
        HAVING count(*) > 1
        ORDER BY count(*) DESC
        LIMIT 10
    """)
    dupes = cur.fetchall()

    if dupes:
        total_dupes = sum(row[1] for row in dupes)
        top = ", ".join(f"{row[0]}({row[1]})" for row in dupes[:5])
        results.append(Check("duplicates", "warn",
                             f"{len(dupes)} duplicate names ({total_dupes} total rows). Top: {top}",
                             {"count": len(dupes), "total_rows": total_dupes,
                              "examples": [{"name": r[0], "count": r[1]} for r in dupes]}))
    else:
        results.append(Check("duplicates", "ok", "No active duplicate names",
                             {"count": 0}))

    return results


def check_staleness(conn) -> list[Check]:
    """Check data freshness — are tables being updated?"""
    cur = conn.cursor()
    results = []

    FRESHNESS_CHECKS = [
        ("news_stories", "ingested_at", 7, "News stories"),
        ("attribute_grades", "updated_at", 14, "Attribute grades"),
        ("player_profiles", "updated_at", 14, "Player profiles"),
    ]

    for table, ts_col, max_days, label in FRESHNESS_CHECKS:
        cur.execute(f"SELECT max({ts_col}) FROM {table}")
        latest = cur.fetchone()[0]
        if latest is None:
            results.append(Check("staleness", "warn", f"{label}: no data",
                                 {"table": table, "latest": None}))
        else:
            cur.execute(f"SELECT extract(epoch FROM now() - max({ts_col})) / 86400 FROM {table}")
            days_old = cur.fetchone()[0]
            if days_old and days_old > max_days:
                results.append(Check("staleness", "warn",
                                     f"{label}: last updated {days_old:.0f} days ago (threshold: {max_days}d)",
                                     {"table": table, "days_old": round(float(days_old), 1)}))
            else:
                results.append(Check("staleness", "ok",
                                     f"{label}: updated {days_old:.1f}d ago",
                                     {"table": table, "days_old": round(float(days_old or 0), 1)}))

    return results


ALL_CHECKS = {
    "row_counts": check_row_counts,
    "coverage": check_coverage,
    "distributions": check_distributions,
    "orphans": check_orphans,
    "duplicates": check_duplicates,
    "staleness": check_staleness,
}


def main():
    parser = argparse.ArgumentParser(description="Post-pipeline data validation")
    parser.add_argument("--check", type=str, help="Comma-separated check names to run")
    parser.add_argument("--strict", action="store_true", help="Exit 1 on any warning")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    conn = require_conn()

    checks_to_run = ALL_CHECKS
    if args.check:
        names = [n.strip() for n in args.check.split(",")]
        checks_to_run = {n: fn for n, fn in ALL_CHECKS.items() if n in names}

    print("63 — Post-Pipeline Validation")
    print()

    all_results: list[Check] = []
    for name, fn in checks_to_run.items():
        results = fn(conn)
        all_results.extend(results)

    # Print report
    ok_count = sum(1 for r in all_results if r.status == "ok")
    warn_count = sum(1 for r in all_results if r.status == "warn")
    fail_count = sum(1 for r in all_results if r.status == "fail")

    current_section = ""
    for r in all_results:
        if r.name != current_section:
            current_section = r.name
            print(f"  [{current_section}]")

        icon = {"ok": "  ✓", "warn": "  ⚠", "fail": "  ✗"}[r.status]
        print(f"  {icon} {r.message}")

    print()
    print(f"  {'─' * 50}")
    print(f"  {ok_count} ok, {warn_count} warnings, {fail_count} failures")

    # JSON output
    if args.json:
        output = [{"name": r.name, "status": r.status, "message": r.message, **r.detail} for r in all_results]
        print(json.dumps(output, indent=2))

    # Log to cron_log
    stats = {
        "ok": ok_count,
        "warnings": warn_count,
        "failures": fail_count,
        "checks": [{"name": r.name, "status": r.status, "message": r.message} for r in all_results if r.status != "ok"],
    }
    mark_step_complete(conn, "validate", ok_count, stats)

    conn.close()

    if fail_count > 0:
        sys.exit(2)
    if args.strict and warn_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
