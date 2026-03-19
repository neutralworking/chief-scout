"""
36_mental_tags.py — Assign differentiated mental_tag values to player_status.

Replaces the blanket 'Sharp' default with data-driven tags based on:
- Competitiveness + Coachability (0-10 scale from player_personality)
- Card discipline (yellow/red per 90 from API-Football)
- MBTI TF+JP dimensions (thinking/judging = mental resilience proxy)

Mental tags (from four-pillars.ts):
  Sharp      = 100  — elite mentality (comp >= 8, coach >= 6, clean discipline)
  Confident  =  75  — strong mental profile (comp >= 6, coach >= 5)
  Focused    =  70  — solid, professional (comp >= 5, coach >= 4)
  Steady     =  60  — average (default for players with some data)
  Low        =  40  — weak signals (low comp or coach, or high cards)
  Fragile    =  15  — multiple negative signals (low comp + low coach + poor discipline)

Usage:
    python 36_mental_tags.py                  # assign tags
    python 36_mental_tags.py --dry-run        # preview without writing
    python 36_mental_tags.py --min-level 70   # only process level 70+ players
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Assign mental_tag from personality + discipline data")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--min-level", type=int, default=0, help="Only process players with level >= N")
args = parser.parse_args()

DRY_RUN = args.dry_run


def compute_mental_tag(comp, coach, cards_per90, tf, jp):
    """Compute mental tag from available data signals.

    Args:
        comp: competitiveness 0-10 (None if unknown)
        coach: coachability 0-10 (None if unknown)
        cards_per90: yellow+red*2 per 90 minutes (None if no data)
        tf: MBTI thinking/feeling score 0-100 (None if unknown)
        jp: MBTI judging/perceiving score 0-100 (None if unknown)

    Returns:
        mental tag string
    """
    # No data at all → Steady (neutral default)
    if comp is None and coach is None and tf is None and jp is None:
        return "Steady"

    # Build a mental score 0-100
    signals = []
    weights = []

    # Competitiveness (0-10 → 0-100) — strongest signal
    if comp is not None:
        signals.append(comp * 10)
        weights.append(3.0)

    # Coachability (0-10 → 0-100)
    if coach is not None:
        signals.append(coach * 10)
        weights.append(2.0)

    # MBTI TF (thinking = more analytical/resilient) + JP (judging = more disciplined)
    if tf is not None and jp is not None:
        mbti_mental = (tf + jp) / 2
        signals.append(mbti_mental)
        weights.append(1.5)
    elif tf is not None:
        signals.append(tf)
        weights.append(0.75)
    elif jp is not None:
        signals.append(jp)
        weights.append(0.75)

    # Card discipline (inverted: more cards = lower mental score)
    if cards_per90 is not None:
        # cards_per90: 0 = clean, 0.2 = average, 0.5+ = dirty
        # Convert: 0 cards → 80, 0.2 → 60, 0.5 → 30, 1.0+ → 10
        card_score = max(10, min(80, 80 - cards_per90 * 140))
        signals.append(card_score)
        weights.append(1.0)

    if not signals:
        return "Steady"

    # Weighted average
    score = sum(s * w for s, w in zip(signals, weights)) / sum(weights)

    # Map score to tag
    if score >= 75:
        return "Sharp"
    elif score >= 60:
        return "Confident"
    elif score >= 50:
        return "Focused"
    elif score >= 35:
        return "Steady"
    elif score >= 20:
        return "Low"
    else:
        return "Fragile"


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print(f"36 — Mental Tag Assignment")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Min level: {args.min_level}")

    # Load personality data
    print("  Loading personality data...")
    cur.execute("""
        SELECT pp.person_id, pp.competitiveness, pp.coachability,
               pp.ei, pp.sn, pp.tf, pp.jp
        FROM player_personality pp
        JOIN player_profiles pr ON pr.person_id = pp.person_id
        WHERE (%s = 0 OR pr.level >= %s)
    """, (args.min_level, args.min_level))
    personality = {r["person_id"]: r for r in cur.fetchall()}
    print(f"  {len(personality)} players with personality data")

    # Load card data from API-Football (aggregate across seasons)
    print("  Loading card data...")
    cur.execute("""
        SELECT person_id,
               SUM(cards_yellow) + SUM(cards_red) * 2 as total_cards,
               SUM(minutes) as total_minutes
        FROM api_football_player_stats
        WHERE person_id IS NOT NULL AND minutes > 0
        GROUP BY person_id
        HAVING SUM(minutes) >= 450
    """)
    cards = {}
    for r in cur.fetchall():
        mins = float(r["total_minutes"])
        if mins > 0:
            cards[r["person_id"]] = float(r["total_cards"] or 0) / mins * 90
    print(f"  {len(cards)} players with card data (>=450 min)")

    # Compute tags
    print("  Computing mental tags...")
    tag_counts = {}
    updates = []

    all_pids = set(personality.keys())
    for pid in all_pids:
        p = personality.get(pid, {})
        comp = p.get("competitiveness")
        coach = p.get("coachability")
        tf = p.get("tf")
        jp = p.get("jp")
        cards_p90 = cards.get(pid)

        tag = compute_mental_tag(comp, coach, cards_p90, tf, jp)
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
        updates.append((tag, pid))

    print(f"\n  Tag distribution:")
    for tag in ["Sharp", "Confident", "Focused", "Steady", "Low", "Fragile"]:
        n = tag_counts.get(tag, 0)
        pct = n / max(len(updates), 1) * 100
        bar = "#" * int(pct / 2)
        print(f"    {tag:12s} {n:>6}  ({pct:5.1f}%)  {bar}")

    if DRY_RUN:
        # Show samples for each tag
        print("\n  Samples per tag:")
        shown = set()
        for tag, pid in updates:
            if tag not in shown and pid in personality:
                shown.add(tag)
                p = personality[pid]
                cur.execute("SELECT name FROM people WHERE id = %s", (pid,))
                name_row = cur.fetchone()
                name = name_row["name"] if name_row else "?"
                print(f"    {tag:12s} {name:25s} comp={p.get('competitiveness')} coach={p.get('coachability')} tf={p.get('tf')} jp={p.get('jp')} cards_p90={cards.get(pid, 'N/A')}")
            if len(shown) >= 6:
                break
        print(f"\n  [dry-run] Would update {len(updates)} mental_tags")
        conn.close()
        return

    # Write updates
    print(f"\n  Writing {len(updates)} mental_tag updates...")
    write_cur = conn.cursor()
    BATCH = 500
    written = 0
    for i in range(0, len(updates), BATCH):
        batch = updates[i:i + BATCH]
        from psycopg2.extras import execute_batch
        execute_batch(write_cur, """
            UPDATE player_status SET mental_tag = %s WHERE person_id = %s
        """, batch)
        written += len(batch)

    conn.commit()
    conn.close()
    print(f"  Done. {written} mental_tags updated.")


if __name__ == "__main__":
    main()
