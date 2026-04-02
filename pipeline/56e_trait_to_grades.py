"""
56e_trait_to_grades.py — Bridge player_trait_scores → attribute_grades.

Converts PlayStyle traits (from 56b/56c) into attribute grades so they
feed into model scores via pipeline 27. Each trait maps to 1-3 attributes
with a severity-scaled grade.

Source: 'playstyle_derived' (priority 1 in SOURCE_PRIORITY — below all
real stat sources, above eafc_inferred). These grades fill gaps where
no stat/scout data exists, they never override better data.

Grade formula: base_grade * (severity / 10)
  - severity 8 (EAFC+): base * 0.8 → e.g. 15 * 0.8 = 12
  - severity 5 (EAFC):  base * 0.5 → e.g. 15 * 0.5 = 7.5
  - severity 4 (inferred): base * 0.4 → e.g. 15 * 0.4 = 6

Usage:
    python 56e_trait_to_grades.py                  # full run
    python 56e_trait_to_grades.py --player ID       # single player
    python 56e_trait_to_grades.py --dry-run         # preview
    python 56e_trait_to_grades.py --force           # overwrite existing
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from lib.db import require_conn, get_dict_cursor
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client

parser = argparse.ArgumentParser(description="Convert trait scores to attribute grades")
parser.add_argument("--player", type=int, default=None)
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
parser.add_argument("--limit", type=int, default=None)
args = parser.parse_args()

SOURCE = "playstyle_derived"

# ── Trait → Attribute mappings ────────────────────────────────────────────────
# Each trait maps to attributes with a base grade (the max possible on 1-20
# scale if severity were 10). Severity scales linearly from there.
# Base grades are conservative — these are inferred signals, not observations.

TRAIT_MAP = {
    # Creator model (creativity, flair, vision, threat)
    "Playmaker":          [("creativity", 16), ("vision", 16)],
    "playmaker_vision":   [("vision", 16), ("creativity", 14)],
    "Trickery":           [("flair", 16), ("skills", 14)],
    "flamboyant":         [("flair", 16), ("skills", 14)],
    "Trivela":            [("flair", 14), ("threat", 14)],
    "through_ball_king":  [("threat", 16), ("vision", 14)],
    "one_touch_play":     [("threat", 14), ("first_touch", 14)],

    # Dribbler model (carries, first_touch, skills, take_ons)
    "Dribbler":           [("take_ons", 16), ("skills", 14)],
    "dribble_artist":     [("take_ons", 16), ("skills", 16)],
    "Close Control":      [("first_touch", 16), ("skills", 14)],
    "Technical Ability":  [("first_touch", 14), ("skills", 14)],
    "Ball Retention":     [("first_touch", 14), ("carries", 12)],
    "Ball Progressor":    [("carries", 16), ("take_ons", 12)],
    "progressive_carrier":[("carries", 16)],

    # Striker model (close_range, mid_range, long_range, penalties)
    "Finishing":          [("close_range", 16), ("mid_range", 14)],
    "Clinical Finisher":  [("close_range", 18), ("composure", 16)],
    "fox_in_the_box":     [("close_range", 16), ("movement", 14)],
    "Long Range Shooting":[("long_range", 16), ("mid_range", 14)],
    "long_range_threat":  [("long_range", 16)],

    # Passer model (pass_accuracy, crossing, pass_range, through_balls)
    "Passing Ability":    [("pass_accuracy", 14), ("pass_range", 14)],
    "Long Range Passing": [("pass_range", 16), ("through_balls", 14)],
    "Crossing Ability":   [("crossing", 16)],
    "Set Piece Threat":   [("crossing", 14), ("long_range", 12)],
    "set_piece_specialist":[("crossing", 14)],

    # Engine model (intensity, pressing, stamina, versatility)
    "Work Rate":          [("intensity", 14), ("stamina", 14)],
    "high_press":         [("pressing", 16), ("intensity", 14)],
    "Press Proven":       [("pressing", 14), ("composure", 12)],
    "press_resistant":    [("composure", 14), ("first_touch", 12)],
    "endurance":          [("stamina", 16)],

    # Sprinter model (acceleration, balance, movement, pace)
    "Pace":               [("pace", 16), ("acceleration", 14)],
    "Acceleration":       [("acceleration", 16)],
    "Speed Merchant":     [("pace", 16), ("acceleration", 16)],
    "pace_merchant":      [("pace", 16), ("acceleration", 14)],

    # Powerhouse model (aggression, duels, shielding, throwing)
    "Strength":           [("shielding", 16), ("duels", 14)],
    "hard_man":           [("aggression", 16), ("duels", 16)],

    # Target model (aerial_duels, heading, jumping, volleys)
    "Aerial Ability":     [("aerial_duels", 14), ("heading", 14)],
    "Aerial Threat":      [("aerial_duels", 16), ("heading", 16)],
    "aerial_threat":      [("aerial_duels", 16), ("heading", 16)],
    "target_man":         [("aerial_duels", 16), ("shielding", 14)],

    # Cover model (awareness, discipline, interceptions, positioning)
    "Defensive Awareness":[("awareness", 14), ("positioning", 14)],
    "Positioning":        [("positioning", 16), ("awareness", 12)],
    "positional_discipline":[("discipline", 14), ("positioning", 12)],
    "Anticipation":       [("awareness", 14), ("interceptions", 12)],
    "sweeper_reader":     [("interceptions", 14), ("awareness", 14)],

    # Destroyer model (blocking, clearances, marking, tackling)
    "Tackling Ability":   [("tackling", 14), ("duels", 12)],
    "Ball Winner":        [("tackling", 16), ("interceptions", 12)],

    # Controller model (anticipation, composure, decisions, tempo)
    "tempo_controller":   [("composure", 14), ("anticipation", 14)],
    "patient":            [("composure", 12), ("discipline", 12)],

    # Commander model (communication, concentration, drive, leadership)
    "captain_leader":     [("leadership", 16), ("communication", 14)],
    "quiet_leader":       [("concentration", 14), ("drive", 14)],

    # Direct play
    "direct":             [("carries", 14), ("long_range", 12)],
    "counter_attack_threat":[("pace", 14), ("movement", 14)],
}


def main():
    conn = require_conn()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Load all trait scores
    where = ""
    params = []
    if args.player:
        where = "WHERE player_id = %s"
        params = [args.player]

    cur = conn.cursor()
    cur.execute(f"""
        SELECT player_id, trait, severity, source
        FROM player_trait_scores
        {where}
        ORDER BY player_id
    """, params)
    traits = cur.fetchall()
    print(f"Loaded {len(traits)} trait scores")

    # Group by player
    player_traits = {}
    for pid, trait, severity, source in traits:
        player_traits.setdefault(pid, []).append((trait, severity, source))

    if args.limit:
        pids = list(player_traits.keys())[:args.limit]
        player_traits = {k: v for k, v in player_traits.items() if k in pids}

    print(f"Players with traits: {len(player_traits)}")

    # Load existing playstyle_derived grades to skip/overwrite
    if not args.force:
        cur.execute(f"""
            SELECT player_id, attribute FROM attribute_grades
            WHERE source = '{SOURCE}'
        """)
        existing = set((r[0], r[1]) for r in cur.fetchall())
        print(f"Existing {SOURCE} grades: {len(existing)}")
    else:
        # Delete all existing before rewrite
        cur.execute(f"DELETE FROM attribute_grades WHERE source = '{SOURCE}'")
        deleted = cur.rowcount
        if deleted:
            print(f"Deleted {deleted} existing {SOURCE} grades")
        existing = set()
        conn.commit()

    # Generate grades
    grades_to_write = []
    players_affected = set()

    for pid, trait_list in player_traits.items():
        # For each trait, compute the grade for each mapped attribute
        # If multiple traits map to the same attribute, keep the highest
        best_per_attr = {}  # attr → best grade

        for trait, severity, source in trait_list:
            mappings = TRAIT_MAP.get(trait, [])
            for attr, base_grade in mappings:
                # Scale by severity: severity 10 → full base, severity 5 → half
                grade = round(base_grade * severity / 10)
                # Cap at 8: these are derived signals, not observations.
                # stat_score 8 → ×1.5 = 12/20 in pipeline 27 (decent,
                # not elite). Prevents trait data from overriding real
                # stat sources or inflating model scores.
                grade = max(1, min(grade, 8))

                if attr not in best_per_attr or grade > best_per_attr[attr]:
                    best_per_attr[attr] = grade

        for attr, grade in best_per_attr.items():
            if not args.force and (pid, attr) in existing:
                continue
            grades_to_write.append({
                "player_id": pid,
                "attribute": attr,
                "stat_score": grade,
                "scout_grade": None,
                "source": SOURCE,
            })
            players_affected.add(pid)

    print(f"Grades to write: {len(grades_to_write)} for {len(players_affected)} players")

    if args.dry_run:
        # Show sample
        for g in grades_to_write[:20]:
            print(f"  pid={g['player_id']}  {g['attribute']:20s}  stat={g['stat_score']}")
        print(f"  ... ({len(grades_to_write)} total)")
        return

    # Write in chunks
    CHUNK = 500
    written = 0
    for i in range(0, len(grades_to_write), CHUNK):
        chunk = grades_to_write[i:i + CHUNK]
        sb.table("attribute_grades").upsert(
            chunk,
            on_conflict="player_id,attribute,source",
        ).execute()
        written += len(chunk)
        if written % 5000 == 0:
            print(f"  Written {written}...")

    print(f"\nDone. Wrote {written} grades for {len(players_affected)} players.")
    conn.close()


if __name__ == "__main__":
    main()
