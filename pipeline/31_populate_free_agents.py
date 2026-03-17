#!/usr/bin/env python3
"""
31_populate_free_agents.py — Populate contract_expiry_date and contract_tag for free agents.

Sources:
  1. Curated seed list of confirmed expiring contracts (summer 2026)
     Researched from Transfermarkt, Goal.com, ESPN, Sky Sports — verified March 2026.
  2. Cleanup: remove stale contract data for players who renewed or transferred.

Usage:
  python pipeline/31_populate_free_agents.py [--dry-run] [--clean]
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

# ── Curated list: confirmed expiring contracts summer 2026 ──
# Last verified: 2026-03-17
# Sources: Transfermarkt, ESPN, Sky Sports, Goal.com, club announcements
#
# Format: (name_pattern, expiry_date, contract_tag, club_hint, position)
# club_hint helps disambiguate common names; position for display context.

EXPIRING_2026 = [
    # ── Premier League ──
    ("Ibrahima Konaté", "2026-06-30", "Expiring", "Liverpool", "CD"),
    ("Marc Guehi", "2026-06-30", "Expiring", "Crystal Palace", "CD"),
    ("Bernardo Silva", "2026-06-30", "Expiring", "Manchester City", "AM"),
    ("Casemiro", "2026-06-30", "Expiring", "Manchester United", "DM"),
    ("Andrew Robertson", "2026-06-30", "Expiring", "Liverpool", "WD"),
    ("John Stones", "2026-06-30", "Expiring", "Manchester City", "CD"),
    ("Yves Bissouma", "2026-06-30", "Expiring", "Tottenham", "DM"),
    ("Rodrigo Bentancur", "2026-06-30", "Expiring", "Tottenham", "CM"),
    ("Harry Maguire", "2026-06-30", "Expiring", "Manchester United", "CD"),
    ("Danny Welbeck", "2026-06-30", "Expiring", "Brighton", "CF"),
    ("Harry Wilson", "2026-06-30", "Expiring", "Fulham", "WF"),
    ("Adama Traoré", "2026-06-30", "Expiring", "Fulham", "WF"),
    ("Vitaliy Mykolenko", "2026-06-30", "Expiring", "Everton", "WD"),

    # ── La Liga ──
    ("Robert Lewandowski", "2026-06-30", "Expiring", "Barcelona", "CF"),
    ("Antonio Rüdiger", "2026-06-30", "Expiring", "Real Madrid", "CD"),
    ("David Alaba", "2026-06-30", "Expiring", "Real Madrid", "CD"),
    ("Dani Carvajal", "2026-06-30", "Expiring", "Real Madrid", "WD"),
    ("Andreas Christensen", "2026-06-30", "Expiring", "Barcelona", "CD"),
    ("Eric García", "2026-06-30", "Expiring", "Barcelona", "CD"),

    # ── Serie A ──
    ("Dusan Vlahovic", "2026-06-30", "Expiring", "Juventus", "CF"),
    ("Paulo Dybala", "2026-06-30", "Expiring", "Roma", "AM"),
    ("Lorenzo Pellegrini", "2026-06-30", "Expiring", "Roma", "CM"),
    ("Mike Maignan", "2026-06-30", "Expiring", "AC Milan", "GK"),
    ("Weston McKennie", "2026-06-30", "Expiring", "Juventus", "CM"),
    ("Stefan de Vrij", "2026-06-30", "Expiring", "Inter", "CD"),

    # ── Bundesliga ──
    ("Manuel Neuer", "2026-06-30", "Expiring", "Bayern", "GK"),
    ("Dayot Upamecano", "2026-06-30", "Expiring", "Bayern", "CD"),
    ("Serge Gnabry", "2026-06-30", "Expiring", "Bayern", "WF"),
    ("Leon Goretzka", "2026-06-30", "Expiring", "Bayern", "CM"),
    ("Julian Brandt", "2026-06-30", "Expiring", "Borussia Dortmund", "AM"),
    ("Timo Werner", "2026-06-30", "Expiring", "RB Leipzig", "WF"),

    # ── Ligue 1 ──
    ("Gianluigi Donnarumma", "2026-06-30", "Expiring", "Paris Saint-Germain", "GK"),
]

# ── Players to CLEAN: previously tagged as expiring but have renewed/transferred ──
# These were in the old seed list but are no longer accurate as of March 2026.
CLEAN_PLAYERS = [
    "Mohamed Salah",           # Renewed Liverpool → 2027
    "Virgil van Dijk",         # Renewed Liverpool → 2027
    "Trent Alexander-Arnold",  # Transferred to Real Madrid (2025)
    "Kevin De Bruyne",         # Left Man City (2025 free agent)
    "Joshua Kimmich",          # Renewed Bayern → 2029
    "Alphonso Davies",         # Renewed Bayern → 2030
    "Jonathan David",          # Transferred to Juventus (2025)
    "Nkunku",                  # Sold Chelsea → AC Milan (2025)
    "Leroy Sané",              # Joined Galatasaray on free (2025)
    "Son Heung-min",           # Left Tottenham for LAFC (2025)
    "Thomas Müller",           # Left Bayern for Vancouver (2025)
    "İlkay Gündoğan",          # At Galatasaray (2025)
    "Paul Pogba",              # Joined Monaco (2025)
    "De Ligt",                 # At Man United → 2029
    "Marcus Rashford",         # On loan Barca, contracted Man United → 2028
    "Romelu Lukaku",           # At Napoli → 2027
    "Ben Chilwell",            # At Strasbourg → 2027
    "Angel Di Maria",          # No longer in top-5 league
    "Marcos Llorente",         # Need verification — removing stale tag
]


def find_player(cur, name_pattern, club_hint=None):
    """Find a player by ILIKE pattern. Returns (id, name) or None."""
    cur.execute(
        """SELECT p.id, p.name, c.clubname
           FROM people p
           LEFT JOIN clubs c ON c.id = p.club_id
           WHERE p.name ILIKE %s
           LIMIT 10""",
        (f"%{name_pattern}%",),
    )
    rows = cur.fetchall()
    if not rows:
        return None

    # Exact name match
    for r in rows:
        if r[1].lower() == name_pattern.lower():
            return (r[0], r[1])

    # Club hint match
    if club_hint and len(rows) > 1:
        for r in rows:
            if r[2] and club_hint.lower() in r[2].lower():
                return (r[0], r[1])

    # Single result
    if len(rows) == 1:
        return (rows[0][0], rows[0][1])

    # First result as fallback
    return (rows[0][0], rows[0][1])


def ensure_player_status(cur, person_id):
    """Ensure a player_status row exists for this person."""
    cur.execute(
        "INSERT INTO player_status (person_id) VALUES (%s) ON CONFLICT (person_id) DO NOTHING",
        (person_id,),
    )


def main():
    parser = argparse.ArgumentParser(description="Populate free agent contract data")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without committing")
    parser.add_argument("--clean", action="store_true", help="Also clean stale contract tags from old data")
    args = parser.parse_args()

    conn = psycopg2.connect(DSN)
    cur = conn.cursor()

    stats = {"matched": 0, "missed": 0, "cleaned": 0}

    # ── Step 0: Clean stale data ──
    if args.clean:
        print("=" * 60)
        print("STEP 0: Clean stale contract data from previous runs")
        print("=" * 60)

        for name_pattern in CLEAN_PLAYERS:
            result = find_player(cur, name_pattern)
            if result:
                pid, full_name = result
                if not args.dry_run:
                    cur.execute(
                        "UPDATE people SET contract_expiry_date = NULL WHERE id = %s",
                        (pid,),
                    )
                    cur.execute(
                        "UPDATE player_status SET contract_tag = NULL WHERE person_id = %s AND contract_tag IN ('Expiring', 'Free Agent')",
                        (pid,),
                    )
                print(f"  ✓ Cleaned: {full_name} (id={pid})")
                stats["cleaned"] += 1
            else:
                print(f"  – {name_pattern} — not in database (skip)")

        print(f"\nCleaned {stats['cleaned']} stale records")
        print()

    # ── Step 1: Seed confirmed expiring contracts ──
    print("=" * 60)
    print("STEP 1: Seed confirmed expiring contracts (summer 2026)")
    print("=" * 60)

    for entry in EXPIRING_2026:
        name_pattern, expiry, tag, club_hint, position = entry
        result = find_player(cur, name_pattern, club_hint)
        if result:
            pid, full_name = result
            print(f"  ✓ {name_pattern} ({club_hint}) → {full_name} (id={pid}) — {tag}")
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
            stats["matched"] += 1
        else:
            print(f"  ✗ {name_pattern} ({club_hint}) — NOT FOUND in database")
            stats["missed"] += 1

    print(f"\nSeed: {stats['matched']} matched, {stats['missed']} missed")

    # ── Commit or rollback ──
    if args.dry_run:
        print("\n[DRY RUN] No changes committed")
        conn.rollback()
    else:
        conn.commit()
        print("\nChanges committed!")

    # ── Final state ──
    cur.execute("SELECT COUNT(*) FROM people WHERE contract_expiry_date IS NOT NULL")
    total_with_expiry = cur.fetchone()[0]

    cur.execute("""
        SELECT contract_tag, COUNT(*)
        FROM player_status
        WHERE contract_tag IN ('Expiring', 'Free Agent', 'One Year Left')
        GROUP BY contract_tag
        ORDER BY contract_tag
    """)
    tag_counts = cur.fetchall()

    print()
    print("=" * 60)
    print("FINAL STATE")
    print("=" * 60)
    print(f"  Players with contract_expiry_date: {total_with_expiry}")
    for tag, count in tag_counts:
        print(f"  contract_tag = '{tag}': {count}")
    print(f"\n  Total enriched this run: {stats['matched']}")
    if stats["cleaned"]:
        print(f"  Stale records cleaned: {stats['cleaned']}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
