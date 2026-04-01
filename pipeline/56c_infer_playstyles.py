"""
56c_infer_playstyles.py — Infer PlayStyle traits from attribute grades.

Uses EAFC PlayStyle labels (imported by 56b) as ground truth to derive
threshold rules. Applies those rules to ~12k players who have attribute
grades but no EAFC PlayStyle labels.

Inferred traits get severity=4 (below EAFC's 5) so real data always wins.
Only infers traits with clean statistical signal — skips subtle ones
(Trivela, Press Proven, Acrobatic) that require watching the player.

Usage:
    python 56c_infer_playstyles.py                  # full run
    python 56c_infer_playstyles.py --player ID       # single player
    python 56c_infer_playstyles.py --dry-run         # preview
    python 56c_infer_playstyles.py --force           # overwrite existing
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Infer PlayStyle traits from attribute grades")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing inferred_playstyle rows")
args = parser.parse_args()

DRY_RUN = args.dry_run
SOURCE = "inferred_playstyle"

# ── Inference rules ──────────────────────────────────────────────────────────
#
# Each rule: (trait_name, required_attrs, min_threshold, position_filter)
# Thresholds calibrated from p25 of EAFC PlayStyle holders (see 56b analysis).
# Scores are on 0-20 scale (EAFC-inferred attribute grades).
#
# position_filter: None = all positions, or set of allowed positions.

RULES: list[tuple[str, dict[str, int], set[str] | None]] = [
    # ── Movement / Physical ──
    ("Pace", {"pace": 16, "acceleration": 16}, {"WF", "CF", "AM", "WM", "WD", "CM"}),
    ("Acceleration", {"acceleration": 17, "pace": 17}, {"WF", "CF", "AM", "WM", "WD"}),
    ("Work Rate", {"stamina": 16, "aggression": 13}, None),
    ("Strength", {"physical": 16, "aggression": 14}, None),
    ("Aerial Ability", {"heading": 14, "jumping": 15, "physical": 15}, {"CD", "CF", "CM", "DM"}),

    # ── Defending ──
    ("Tackling Ability", {"tackling": 13, "marking": 13, "awareness": 13}, {"CD", "WD", "DM", "CM"}),
    ("Defensive Awareness", {"awareness": 13, "interceptions": 13, "tackling": 13}, {"CD", "WD", "DM", "CM"}),

    # ── Attacking ──
    ("Finishing", {"close_range": 13, "mid_range": 13, "movement": 13}, {"CF", "WF", "AM", "CM", "WM"}),
    ("Trickery", {"take_ons": 14, "first_touch": 14, "balance": 15}, {"WF", "AM", "CF", "CM", "WM"}),
    ("Close Control", {"first_touch": 15, "take_ons": 15, "composure": 14}, {"WF", "AM", "CF", "CM", "WM"}),

    # ── Passing ──
    ("Passing Ability", {"vision": 14, "pass_accuracy": 14, "through_balls": 13}, {"CM", "AM", "DM", "WM", "CD"}),
    ("Long Range Passing", {"pass_range": 14, "pass_accuracy": 14, "vision": 12}, {"CM", "DM", "CD", "AM", "GK"}),
]


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print("56c — PlayStyle Inference from Attribute Grades")
    print(f"  Dry run: {DRY_RUN}")

    # ── Load positions ────────────────────────────────────────────────────────
    cur.execute("SELECT person_id, position FROM player_profiles WHERE position IS NOT NULL")
    positions = {r["person_id"]: r["position"] for r in cur.fetchall()}
    print(f"  {len(positions)} players with positions")

    # ── Load attribute grades (best score per attr per player) ────────────────
    print("  Loading attribute grades...")
    cur.execute("""
        SELECT player_id, attribute,
               MAX(COALESCE(scout_grade, stat_score)) as score
        FROM attribute_grades
        WHERE COALESCE(scout_grade, stat_score) > 0
        GROUP BY player_id, attribute
    """)
    grades: dict[int, dict[str, float]] = {}
    for r in cur.fetchall():
        pid = r["player_id"]
        if pid not in grades:
            grades[pid] = {}
        grades[pid][r["attribute"]] = float(r["score"])
    print(f"  {len(grades)} players with attribute grades")

    # ── Find players who already have EAFC playstyle data (skip them) ─────────
    cur.execute("""
        SELECT DISTINCT player_id FROM player_trait_scores
        WHERE source = 'eafc_playstyle'
    """)
    has_eafc = {r["player_id"] for r in cur.fetchall()}
    print(f"  {len(has_eafc)} players already have EAFC playstyles (will skip)")

    # ── Find existing inferred rows (for --force) ────────────────────────────
    existing = set()
    if not args.force:
        cur.execute(f"""
            SELECT DISTINCT player_id FROM player_trait_scores
            WHERE source = '{SOURCE}'
        """)
        existing = {r["player_id"] for r in cur.fetchall()}
        if existing:
            print(f"  {len(existing)} players already have inferred playstyles (use --force to overwrite)")

    # ── Apply rules ──────────────────────────────────────────────────────────

    all_traits = []  # (player_id, trait, category, severity, source)
    candidates = set(grades.keys()) - has_eafc - existing

    if args.player:
        candidates = {args.player} & set(grades.keys())

    print(f"  Candidates for inference: {len(candidates)}")

    for pid in candidates:
        g = grades.get(pid, {})
        pos = positions.get(pid)

        if len(g) < 5:
            continue

        for trait_name, required_attrs, pos_filter in RULES:
            # Position check
            if pos_filter and pos not in pos_filter:
                continue

            # All required attrs must meet threshold
            match = True
            for attr, threshold in required_attrs.items():
                score = g.get(attr, 0)
                if score < threshold:
                    match = False
                    break

            if match:
                all_traits.append((pid, trait_name, "style", 4, SOURCE))

    # ── Summary ──────────────────────────────────────────────────────────────

    trait_counts: dict[str, int] = {}
    for _, trait, _, _, _ in all_traits:
        trait_counts[trait] = trait_counts.get(trait, 0) + 1

    players_with_traits = len(set(t[0] for t in all_traits))
    print(f"\n  {len(all_traits)} trait assignments for {players_with_traits} players")
    if players_with_traits:
        print(f"  Avg traits per player: {len(all_traits) / players_with_traits:.1f}")
    print(f"\n  Trait distribution:")
    for trait, n in sorted(trait_counts.items(), key=lambda x: -x[1]):
        print(f"    {trait:25s} {n:>5}")

    # Spot checks
    if DRY_RUN:
        # Show some known players
        spot_checks = [10772, 13705, 18386, 9266, 13466, 8310, 8969, 13684]
        check_ids = [pid for pid in spot_checks if pid in set(t[0] for t in all_traits)]
        if check_ids:
            print(f"\n  Spot checks:")
            for pid in check_ids:
                cur.execute("SELECT name FROM people WHERE id = %s", (pid,))
                row = cur.fetchone()
                name = row["name"] if row else "?"
                player_traits = [(t, s) for p, t, c, s, _ in all_traits if p == pid]
                trait_str = ", ".join(f"{t}({s})" for t, s in player_traits)
                print(f"    {name:25s} {trait_str}")

        print(f"\n  [dry-run] Would write {len(all_traits)} trait_scores")
        conn.close()
        return

    # ── Write ────────────────────────────────────────────────────────────────

    write_cur = conn.cursor()

    if args.force:
        write_cur.execute(f"DELETE FROM player_trait_scores WHERE source = '{SOURCE}'")
        deleted = write_cur.rowcount
        print(f"  Deleted {deleted} old inferred playstyle traits")

    print(f"  Writing {len(all_traits)} new trait scores...")
    from psycopg2.extras import execute_values
    BATCH = 500
    for i in range(0, len(all_traits), BATCH):
        batch = all_traits[i:i + BATCH]
        execute_values(write_cur, """
            INSERT INTO player_trait_scores (player_id, trait, category, severity, source)
            VALUES %s
            ON CONFLICT (player_id, trait, source) DO UPDATE SET
                category = EXCLUDED.category,
                severity = EXCLUDED.severity
        """, batch)

    conn.commit()
    conn.close()
    print(f"  Done. {len(all_traits)} traits written.")


if __name__ == "__main__":
    main()
