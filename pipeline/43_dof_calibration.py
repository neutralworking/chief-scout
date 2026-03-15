"""
43_dof_calibration.py — Compute and display DoF calibration corrections.

Shows how the standard engine diverges from DoF assessments,
what correction factors are learned, and how they would change
valuations for non-assessed players.

Usage:
    python 43_dof_calibration.py                    # compute + show report
    python 43_dof_calibration.py --test              # show corrected vs uncorrected for sample players
    python 43_dof_calibration.py --test --limit 20   # test on 20 players
"""
import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="DoF calibration diagnostics")
parser.add_argument("--test", action="store_true", help="Test corrections on non-assessed players")
parser.add_argument("--limit", type=int, default=10, help="Number of test players")
args = parser.parse_args()

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed")
    sys.exit(1)

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True


def main():
    from valuation_core.calibration.dof_corrections import (
        compute_corrections,
        print_correction_report,
    )

    print("Computing DoF calibration corrections...")
    corrections = compute_corrections(conn)
    print_correction_report(corrections)

    if args.test and corrections.n_assessments > 0:
        print(f"\n\n  Testing corrections on non-assessed players (limit={args.limit})")
        print("  " + "=" * 70)
        _test_corrections(corrections)

    conn.close()
    print("\nDone.")


def _test_corrections(corrections):
    """Compare corrected vs uncorrected valuations for non-assessed players."""
    from valuation_core.data_loader import load_player_profile
    from valuation_core.models.ensemble import run_valuation
    from valuation_core.types import ValuationMode

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute(f"""
        SELECT p.id, p.name, pp.position, pp.level
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        WHERE pp.level >= 75
          AND pp.position IS NOT NULL
          AND p.id NOT IN (SELECT person_id FROM dof_assessments WHERE is_current = true)
        ORDER BY pp.level DESC
        LIMIT {args.limit}
    """)
    rows = cur.fetchall()
    cur.close()

    print(f"\n    {'Name':<25s} {'Pos':4s} {'Lvl':>3s} {'Uncorrected':>12s} {'Corrected':>12s} {'Delta':>8s}")
    print("    " + "-" * 68)

    for row in rows:
        pid = row["id"]
        profile = load_player_profile(pid, conn)
        if not profile:
            continue

        try:
            uncorrected = run_valuation(profile, mode=ValuationMode.SCOUT_DOMINANT)
            corrected = run_valuation(
                profile, mode=ValuationMode.SCOUT_DOMINANT, corrections=corrections,
            )

            uc = uncorrected.market_value.central
            cc = corrected.market_value.central
            delta_pct = (cc - uc) / max(uc, 1) * 100

            print(f"    {row['name']:<25s} {row['position']:4s} {row['level']:>3d} "
                  f"€{uc/1e6:>9.1f}m €{cc/1e6:>9.1f}m {delta_pct:>+7.1f}%")
        except Exception as e:
            print(f"    {row['name']:<25s} ERROR: {e}")


if __name__ == "__main__":
    main()
