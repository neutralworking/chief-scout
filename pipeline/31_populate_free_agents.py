#!/usr/bin/env python3
"""
31_populate_free_agents.py — Populate contract_expiry_date and contract_tag for free agents.

Sources:
  1. Manual seed list of confirmed/likely free agents (summer 2026)
  2. player_career_history: players with long tenures (start before 2021-07-01, no end_date)
     get contract_tag = 'Expiring' as a heuristic

Usage:
  python pipeline/31_populate_free_agents.py [--dry-run]
"""

import os
import sys
import argparse
from dotenv import load_dotenv

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

import psycopg2
import psycopg2.extras

DSN = os.environ["POSTGRES_DSN"]

# ── Seed list of confirmed/likely free agents ──
FREE_AGENTS_2026 = [
    ("Ben Chilwell", "2026-06-30", "Expiring"),
    ("Mohamed Salah", "2026-06-30", "Expiring"),
    ("Virgil van Dijk", "2026-06-30", "Expiring"),
    ("Trent Alexander-Arnold", "2026-06-30", "Expiring"),
    ("Kevin De Bruyne", "2026-06-30", "Expiring"),
    ("Joshua Kimmich", "2026-06-30", "Expiring"),
    ("Alphonso Davies", "2026-06-30", "Expiring"),
    ("Jonathan David", "2026-06-30", "Expiring"),
    ("Nkunku", "2026-06-30", "Expiring"),
    ("Leroy Sané", "2026-06-30", "Expiring"),
    ("Son Heung-min", "2026-06-30", "Expiring"),
    ("Thomas Müller", "2026-06-30", "Expiring"),
    ("Manuel Neuer", "2026-06-30", "Expiring"),
    ("İlkay Gündoğan", "2026-06-30", "Expiring"),
    ("Marcos Llorente", "2026-06-30", "Expiring"),
    ("De Ligt", "2026-06-30", "Expiring"),
    ("Marcus Rashford", "2026-06-30", "Expiring"),
    ("Romelu Lukaku", "2026-06-30", "Expiring"),
    ("Dusan Vlahovic", "2026-06-30", "Expiring"),
    ("Angel Di Maria", "2026-06-30", "Expiring"),
    ("Neymar", "2026-06-30", "Free Agent"),
    ("Paul Pogba", "2026-06-30", "Free Agent"),
    ("Adrien Rabiot", "2026-06-30", "Free Agent"),
]


def find_player(cur, name_pattern):
    """Find a player by ILIKE pattern. Returns (id, name) or None."""
    cur.execute(
        "SELECT id, name FROM people WHERE name ILIKE %s LIMIT 5",
        (f"%{name_pattern}%",),
    )
    rows = cur.fetchall()
    if len(rows) == 1:
        return rows[0]
    if len(rows) > 1:
        # Try exact match first
        for r in rows:
            if r[1].lower() == name_pattern.lower():
                return r
        # Otherwise return first
        return rows[0]
    return None


def ensure_player_status(cur, person_id):
    """Ensure a player_status row exists for this person."""
    cur.execute(
        "INSERT INTO player_status (person_id) VALUES (%s) ON CONFLICT (person_id) DO NOTHING",
        (person_id,),
    )


def main():
    parser = argparse.ArgumentParser(description="Populate free agent contract data")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without committing")
    args = parser.parse_args()

    conn = psycopg2.connect(DSN)
    cur = conn.cursor()

    stats = {"seed_matched": 0, "seed_missed": 0, "career_heuristic": 0, "total": 0}

    print("=" * 60)
    print("STEP 1: Seed list of known free agents")
    print("=" * 60)

    for name_pattern, expiry, tag in FREE_AGENTS_2026:
        result = find_player(cur, name_pattern)
        if result:
            pid, full_name = result
            print(f"  ✓ {name_pattern} → {full_name} (id={pid}) — {tag}")
            if not args.dry_run:
                cur.execute(
                    "UPDATE people SET contract_expiry_date = %s WHERE id = %s",
                    (expiry, pid),
                )
                ensure_player_status(cur, pid)
                cur.execute(
                    "UPDATE player_status SET contract_tag = %s WHERE person_id = %s",
                    (tag, pid),
                )
            stats["seed_matched"] += 1
        else:
            print(f"  ✗ {name_pattern} — NOT FOUND in database")
            stats["seed_missed"] += 1

    print(f"\nSeed: {stats['seed_matched']} matched, {stats['seed_missed']} missed")

    print()
    print("=" * 60)
    print("STEP 2: Career history heuristic (realistic start dates only)")
    print("=" * 60)

    # Only use career history entries with realistic start dates (2018+)
    # that match the player's current club_id — this filters out stale/wrong entries.
    # Players with 4+ year tenures at their current club likely have contracts
    # expiring in the 2025-2027 window.
    cur.execute("""
        SELECT DISTINCT ON (pch.person_id)
            pch.person_id, p.name, pch.start_date, c.clubname, pch.club_id
        FROM player_career_history pch
        JOIN people p ON p.id = pch.person_id
        LEFT JOIN clubs c ON c.id = p.club_id
        WHERE pch.end_date IS NULL
          AND pch.start_date IS NOT NULL
          AND pch.start_date >= '2018-01-01'
          AND pch.start_date < '2022-07-01'
          AND p.contract_expiry_date IS NULL
          AND p.club_id IS NOT NULL
          AND pch.club_id = p.club_id
          AND EXISTS (
            SELECT 1 FROM player_profiles pp
            WHERE pp.person_id = pch.person_id
              AND pp.level IS NOT NULL
              AND pp.archetype IS NOT NULL
          )
        ORDER BY pch.person_id, pch.start_date DESC
    """)
    long_tenure = cur.fetchall()

    print(f"Found {len(long_tenure)} scouted players with 4+ year tenures at current club")
    for pid, name, start_date, club, _ in long_tenure[:30]:
        print(f"  → {name} at {club or '?'} since {start_date}")
    if len(long_tenure) > 30:
        print(f"  ... and {len(long_tenure) - 30} more")

    for pid, name, start_date, club, _ in long_tenure:
        if not args.dry_run:
            cur.execute(
                "UPDATE people SET contract_expiry_date = '2026-06-30' WHERE id = %s AND contract_expiry_date IS NULL",
                (pid,),
            )
            ensure_player_status(cur, pid)
            cur.execute(
                "UPDATE player_status SET contract_tag = 'Expiring' WHERE person_id = %s AND (contract_tag IS NULL OR contract_tag = 'One Year Left')",
                (pid,),
            )
        stats["career_heuristic"] += 1

    print(f"\nCareer heuristic: {stats['career_heuristic']} players tagged as Expiring")

    # Commit or rollback
    if args.dry_run:
        print("\n[DRY RUN] No changes committed")
        conn.rollback()
    else:
        conn.commit()
        print("\nChanges committed!")

    # Final count
    cur.execute("SELECT COUNT(*) FROM people WHERE contract_expiry_date IS NOT NULL")
    total_with_expiry = cur.fetchone()[0]

    cur.execute("""
        SELECT contract_tag, COUNT(*)
        FROM player_status
        WHERE contract_tag IN ('Expiring', 'Free Agent')
        GROUP BY contract_tag
    """)
    tag_counts = cur.fetchall()

    print()
    print("=" * 60)
    print("FINAL STATE")
    print("=" * 60)
    print(f"  Players with contract_expiry_date: {total_with_expiry}")
    for tag, count in tag_counts:
        print(f"  contract_tag = '{tag}': {count}")

    stats["total"] = stats["seed_matched"] + stats["career_heuristic"]
    print(f"\n  Total enriched this run: {stats['total']}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
