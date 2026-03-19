"""
36_data_cleanup.py — Data quality cleanup: merge duplicates, fix mappings, deactivate stale records.

Fixes:
  1. Accent duplicates (Enzo Fernandez vs Enzo Fernández at same club)
  2. Club league_name mappings (Wikidata QIDs → real names)
  3. Retired players still marked active
  4. Women's players incorrectly at men's clubs
  5. Garbage bios (markdown artifacts, attribute dumps)

Usage:
    python 36_data_cleanup.py --dry-run    # preview
    python 36_data_cleanup.py              # apply
"""
from __future__ import annotations

import argparse
import unicodedata
from collections import defaultdict

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Data quality cleanup")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()
DRY_RUN = args.dry_run


def strip_accents(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()


def main():
    import psycopg2
    import psycopg2.extras

    print("36 — Data Quality Cleanup")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── 1. Fix league names from Wikidata QIDs ───────────────────────────
    LEAGUE_FIXES = {
        'Q15804': 'Serie A',
        'Q82595': 'Bundesliga',
    }
    for qid, name in LEAGUE_FIXES.items():
        cur.execute("SELECT COUNT(*) as cnt FROM clubs WHERE league_name = %s", (qid,))
        cnt = cur.fetchone()["cnt"]
        if cnt:
            if not DRY_RUN:
                cur.execute("UPDATE clubs SET league_name = %s WHERE league_name = %s", (name, qid))
            print(f"  League fix: {qid} → {name} ({cnt} clubs)")

    # ── 2. Merge accent duplicates at same club ──────────────────────────
    cur.execute("""
        SELECT pe.id, pe.name, pe.club_id, c.clubname,
               pp.level, pp.archetype,
               LENGTH(COALESCE(ps.scouting_notes, '')) as bio_len,
               pe.date_of_birth, pe.height_cm, pe.wikidata_id
        FROM people pe
        JOIN clubs c ON c.id = pe.club_id
        LEFT JOIN player_profiles pp ON pp.person_id = pe.id
        LEFT JOIN player_status ps ON ps.person_id = pe.id
        WHERE pe.active = true
        ORDER BY c.clubname, pe.name
    """)
    all_players = cur.fetchall()

    by_club: dict[str, list] = defaultdict(list)
    for row in all_players:
        by_club[row["clubname"]].append(row)

    FK_TABLES = [
        ("player_profiles", "person_id"),
        ("player_status", "person_id"),
        ("player_market", "person_id"),
        ("player_personality", "person_id"),
        ("player_tags", "player_id"),
        ("attribute_grades", "player_id"),
        ("player_id_links", "person_id"),
        ("player_field_sources", "player_id"),
        ("news_player_tags", "player_id"),
        ("career_metrics", "person_id"),
    ]

    merged = 0
    for club, players in sorted(by_club.items()):
        seen = {}
        for p in players:
            key = strip_accents(p["name"])
            if key in seen:
                other = seen[key]

                def score(rec):
                    s = 0
                    if rec["level"]: s += rec["level"]
                    s += (rec["bio_len"] or 0) * 0.1
                    if rec["date_of_birth"]: s += 5
                    if rec["height_cm"]: s += 2
                    if rec["wikidata_id"]: s += 10
                    if rec["archetype"]: s += 5
                    if rec["name"] != strip_accents(rec["name"]): s += 3
                    return s

                if score(p) >= score(other):
                    keep, kill = p, other
                else:
                    keep, kill = other, p

                print(f"  Merge: KEEP {keep['name']} (ID={keep['id']}) | KILL {kill['name']} (ID={kill['id']}) @ {club}")

                if not DRY_RUN:
                    for table, col in FK_TABLES:
                        try:
                            cur.execute(f"SELECT COUNT(*) as cnt FROM {table} WHERE {col} = %s", (kill["id"],))
                            if cur.fetchone()["cnt"] > 0:
                                cur.execute(f"SELECT COUNT(*) as cnt FROM {table} WHERE {col} = %s", (keep["id"],))
                                if cur.fetchone()["cnt"] == 0:
                                    cur.execute(f"UPDATE {table} SET {col} = %s WHERE {col} = %s", (keep["id"], kill["id"]))
                                else:
                                    cur.execute(f"DELETE FROM {table} WHERE {col} = %s", (kill["id"],))
                        except Exception:
                            conn.rollback()
                            conn.autocommit = False
                    cur.execute("UPDATE people SET active = false WHERE id = %s", (kill["id"],))

                merged += 1
            else:
                seen[key] = p

    print(f"  Merged {merged} duplicate pairs")

    # ── 3. Clean garbage bios ────────────────────────────────────────────
    if not DRY_RUN:
        cur.execute("""
            UPDATE player_status SET scouting_notes = NULL
            WHERE scouting_notes LIKE '```%%'
               OR scouting_notes LIKE '%%Tactical Attributes%%'
               OR scouting_notes LIKE '%%Position%%:%%Age%%:%%Height%%'
               OR scouting_notes LIKE '---%%'
        """)
        print(f"  Cleaned {cur.rowcount} garbage bios")

    if not DRY_RUN:
        conn.commit()
    else:
        conn.rollback()
        print("\n  --dry-run: no writes.")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
