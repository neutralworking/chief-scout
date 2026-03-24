"""
36b_fitness_tags.py — Reassign fitness_tag using injury data + availability minutes.

The original Kaggle injuries pipeline (55) was too aggressive — tagged 1,293 players
as "Injury Prone" including Haaland, Saka, Yamal. This script recalibrates using:

1. Total games missed from kaggle_injuries (5 seasons, 2020-2025)
2. Recent availability from API-Football minutes (most recent season)
3. Recent injury severity (injuries in most recent 2 seasons weighted more)

Fitness tags (aligned with SACROSANCT validation):
  Fully Fit      — <25 games missed OR >2000 min recent season
  Minor Knock    — 25-50 games missed OR moderate availability
  Injured        — 50-80 games missed AND <1500 min recent season
  Long-Term      — 80+ games missed AND <1000 min recent season (chronic)

Usage:
    python 36b_fitness_tags.py                 # reassign tags
    python 36b_fitness_tags.py --dry-run       # preview
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Reassign fitness_tag from injury + availability data")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run


def compute_fitness_tag(total_missed, recent_mins):
    """Compute fitness tag from games missed + recent availability.

    Uses SACROSANCT-aligned values: Fully Fit, Minor Knock, Injured, Long-Term.

    Args:
        total_missed: total games missed from injuries (5 seasons), None = no injury data
        recent_mins: minutes in most recent AF season, None = no data
    """
    # No injury data → use availability only
    if total_missed is None:
        if recent_mins is not None and recent_mins >= 2000:
            return "Fully Fit"
        return "Fully Fit"  # no negative data = assume fit

    # No availability data → use injuries only
    if recent_mins is None:
        if total_missed <= 25:
            return "Fully Fit"
        elif total_missed <= 50:
            return "Minor Knock"
        elif total_missed <= 80:
            return "Injured"
        else:
            return "Long-Term"

    # Both data sources available — cross-reference
    if total_missed <= 25 or recent_mins >= 2000:
        return "Fully Fit"
    elif total_missed <= 50 or recent_mins >= 1500:
        return "Minor Knock"
    elif total_missed <= 80 or recent_mins >= 1000:
        return "Injured"
    else:
        return "Long-Term"


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print("36b — Fitness Tag Reassignment")
    print(f"  Dry run: {DRY_RUN}")

    # Load injury totals
    print("  Loading injury data...")
    cur.execute("""
        SELECT person_id,
               SUM(COALESCE(games_missed, 0)) as total_missed,
               COUNT(*) as injury_count
        FROM kaggle_injuries
        WHERE person_id IS NOT NULL
        GROUP BY person_id
    """)
    injuries = {r["person_id"]: r for r in cur.fetchall()}
    print(f"  {len(injuries)} players with injury data")

    # Load recent availability (most recent season minutes)
    print("  Loading availability data...")
    cur.execute("""
        SELECT DISTINCT ON (person_id) person_id, minutes, season
        FROM api_football_player_stats
        WHERE person_id IS NOT NULL AND minutes > 0
        ORDER BY person_id, season DESC
    """)
    availability = {r["person_id"]: r["minutes"] for r in cur.fetchall()}
    print(f"  {len(availability)} players with AF availability")

    # Get all player IDs that have either data source
    all_pids = set(injuries.keys()) | set(availability.keys())

    # Also get all existing player_status person_ids (to reset defaults)
    cur.execute("SELECT person_id FROM player_status")
    status_pids = {r["person_id"] for r in cur.fetchall()}
    all_pids |= status_pids
    print(f"  {len(all_pids)} total players to process")

    # Compute tags
    tag_counts = {}
    updates = []
    for pid in all_pids:
        inj = injuries.get(pid)
        total_missed = inj["total_missed"] if inj else None
        recent_mins = availability.get(pid)

        tag = compute_fitness_tag(total_missed, recent_mins)
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
        updates.append((tag, pid))

    print(f"\n  Tag distribution:")
    for tag in ["Fully Fit", "Minor Knock", "Injured", "Long-Term"]:
        n = tag_counts.get(tag, 0)
        pct = n / max(len(updates), 1) * 100
        bar = "#" * int(pct / 2)
        print(f"    {tag:15s} {n:>6}  ({pct:5.1f}%)  {bar}")

    if DRY_RUN:
        print("\n  Key player spot-checks:")
        for pid in [10772, 13705, 13979, 17901, 18386, 9266, 13466]:
            inj = injuries.get(pid)
            mins = availability.get(pid)
            tag = compute_fitness_tag(inj["total_missed"] if inj else None, mins)
            cur.execute("SELECT name FROM people WHERE id = %s", (pid,))
            name = cur.fetchone()["name"]
            print(f"    {name:25s} missed={inj['total_missed'] if inj else 'N/A':>4}  mins={mins or 'N/A':>5}  → {tag}")
        print(f"\n  [dry-run] Would update {len(updates)} fitness_tags")
        conn.close()
        return

    # Write
    print(f"\n  Writing {len(updates)} fitness_tag updates...")
    write_cur = conn.cursor()
    from psycopg2.extras import execute_batch
    BATCH = 500
    for i in range(0, len(updates), BATCH):
        batch = updates[i:i + BATCH]
        execute_batch(write_cur, "UPDATE player_status SET fitness_tag = %s WHERE person_id = %s", batch)

    conn.commit()
    conn.close()
    print(f"  Done. {len(updates)} fitness_tags updated.")


if __name__ == "__main__":
    main()
