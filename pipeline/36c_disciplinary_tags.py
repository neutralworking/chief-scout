"""
36c_disciplinary_tags.py — Assign disciplinary_tag from API-Football card data.

Card data from api_football_player_stats feeds a simple classification:
  Suspended  — has a red card in most recent season (manual override needed for ban length)
  Volatile   — avg 6+ yellows/season OR 2+ reds across seasons
  Cautioned  — avg 4-5 yellows/season OR 1 red across seasons
  Clear      — clean record or minimal cards

Usage:
    python 36c_disciplinary_tags.py
    python 36c_disciplinary_tags.py --dry-run
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Assign disciplinary_tag from card data")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run


def compute_disciplinary_tag(total_yellows, total_reds, seasons, recent_reds):
    """Compute disciplinary tag from card aggregates.

    Args:
        total_yellows: total yellow cards across all seasons
        total_reds: total red cards across all seasons
        seasons: number of seasons with data
        recent_reds: red cards in most recent season
    """
    if seasons == 0:
        return "Clear"

    avg_yellows = total_yellows / seasons
    avg_reds = total_reds / seasons

    # Recent red card → Suspended (may need manual clear after ban served)
    if recent_reds >= 1:
        return "Suspended"

    # High card rate → Volatile
    if avg_yellows >= 6 or total_reds >= 2:
        return "Volatile"

    # Moderate card rate → Cautioned
    if avg_yellows >= 4 or total_reds >= 1:
        return "Cautioned"

    return "Clear"


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print("36c — Disciplinary Tag Assignment")
    print(f"  Dry run: {DRY_RUN}")

    # Aggregate card data per player across seasons
    print("  Loading card data...")
    cur.execute("""
        SELECT person_id,
               SUM(COALESCE(cards_yellow, 0)) as total_yellows,
               SUM(COALESCE(cards_red, 0)) as total_reds,
               COUNT(DISTINCT season) as seasons
        FROM api_football_player_stats
        WHERE person_id IS NOT NULL
        GROUP BY person_id
    """)
    card_data = {r["person_id"]: r for r in cur.fetchall()}
    print(f"  {len(card_data)} players with card data")

    # Get most recent season red cards
    cur.execute("""
        SELECT DISTINCT ON (person_id) person_id, cards_red, season
        FROM api_football_player_stats
        WHERE person_id IS NOT NULL
        ORDER BY person_id, season DESC
    """)
    recent_reds = {r["person_id"]: r["cards_red"] or 0 for r in cur.fetchall()}

    # Process
    tag_counts = {}
    updates = []
    for pid, data in card_data.items():
        rr = recent_reds.get(pid, 0)
        tag = compute_disciplinary_tag(
            data["total_yellows"], data["total_reds"],
            data["seasons"], rr,
        )
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
        updates.append((tag, pid))

    print(f"\n  Tag distribution:")
    for tag in ["Clear", "Cautioned", "Volatile", "Suspended"]:
        n = tag_counts.get(tag, 0)
        pct = n / max(len(updates), 1) * 100
        bar = "#" * int(pct / 2)
        print(f"    {tag:12s} {n:>6}  ({pct:5.1f}%)  {bar}")

    if DRY_RUN:
        print(f"\n  [dry-run] Would update {len(updates)} disciplinary_tags")
        conn.close()
        return

    # Write
    print(f"\n  Writing {len(updates)} disciplinary_tag updates...")
    write_cur = conn.cursor()
    from psycopg2.extras import execute_batch
    BATCH = 500
    for i in range(0, len(updates), BATCH):
        batch = updates[i:i + BATCH]
        execute_batch(write_cur, "UPDATE player_status SET disciplinary_tag = %s WHERE person_id = %s", batch)

    conn.commit()
    conn.close()
    print(f"  Done. {len(updates)} disciplinary_tags updated.")


if __name__ == "__main__":
    main()
