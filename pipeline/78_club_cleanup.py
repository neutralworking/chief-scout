"""
37_club_cleanup.py — Club deduplication and Wikidata enrichment fix.

Three passes:
  1. DEDUP: Merge duplicate clubs (same wikidata_id or near-identical names).
     Reassigns all player club_ids to the canonical entry, deletes the duplicate.
  2. FIX: Correct wrong wikidata_ids on major clubs.
  3. ENRICH: Batch-query Wikidata for missing metadata on top-league clubs
     (stadium, capacity, founded year, country, logo).

Usage:
    python 37_club_cleanup.py --dry-run       # preview all changes
    python 37_club_cleanup.py --dedup         # only dedup pass
    python 37_club_cleanup.py --enrich        # only enrich pass
    python 37_club_cleanup.py                 # all passes
"""
from __future__ import annotations

import argparse
import sys
import time
import unicodedata

import psycopg2
import psycopg2.extras
import requests

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Club dedup + Wikidata enrichment fix")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--dedup", action="store_true", help="Only run dedup pass")
parser.add_argument("--enrich", action="store_true", help="Only run enrich pass")
parser.add_argument("--verbose", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run
RUN_ALL = not args.dedup and not args.enrich

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "ChiefScout/1.0 (football scouting tool)"})

# ── Known wrong wikidata_ids to fix ───────────────────────────────────────────
# Format: club_id → correct wikidata_id
WIKIDATA_FIXES: dict[int, str] = {
    284: "Q9617",     # Arsenal (was Q2471114 = Lesotho Defence Force FC)
}

# ── Known correct wikidata_ids for major clubs missing them ───────────────────
# These are top-league clubs that should have wikidata but don't.
WIKIDATA_SEEDS: dict[int, str] = {
    # Premier League
    327: "Q19649",    # Aston Villa
    503: "Q19209",    # Bournemouth
    511: "Q19571",    # Brentford
    514: "Q19574",    # Brighton
    643: "Q9616",     # Chelsea
    744: "Q19578",    # Crystal Palace
    989: "Q18560",    # Everton
    1221: "Q19530",   # Fulham
    430: "Q15789",    # Bayern Munich
    # La Liga
    411: "Q7156",     # Barcelona
    337: "Q8687",     # Athletic Bilbao
    611: "Q8712",     # Celta Vigo
    # Bundesliga
    429: "Q156893",   # Bayer Leverkusen
    372: "Q47131",    # Augsburg
    1218: "Q166133",  # Freiburg
    # Ligue 1
    299: "Q15862",    # AS Monaco
    252: "Q186658",   # Angers
    378: "Q41791",    # Auxerre
    # Serie A
    714: "Q62694",    # Como
    # Liga Portugal
    582: "Q2698216",  # Casa Pia AC
}


def normalize(name: str) -> str:
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


def main():
    print("37 — Club Cleanup (Dedup + Enrich)")

    if not POSTGRES_DSN:
        print("  ERROR: Set POSTGRES_DSN in .env.local")
        sys.exit(1)

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ══════════════════════════════════════════════════════════════════════
    # PASS 1: DEDUP — merge clubs sharing a wikidata_id
    # ══════════════════════════════════════════════════════════════════════

    if args.dedup or RUN_ALL:
        print("\n  ── Pass 1: Dedup ──")

        cur.execute("""
            SELECT id, clubname, league_name, wikidata_id
            FROM clubs
            WHERE wikidata_id IS NOT NULL
            ORDER BY wikidata_id, id
        """)
        all_clubs = cur.fetchall()

        # Group by wikidata_id
        from collections import defaultdict
        by_wd: dict[str, list] = defaultdict(list)
        for c in all_clubs:
            by_wd[c["wikidata_id"]].append(c)

        merged = 0
        players_moved = 0

        for wd_id, group in by_wd.items():
            if len(group) < 2:
                continue

            # Pick canonical: prefer the one with league_name not containing "duplicate",
            # then LONGEST name (more specific, e.g. "Atlético Madrid" > "Atlético"),
            # then lowest id (oldest entry)
            canonical = sorted(group, key=lambda c: (
                "duplicate" in (c["league_name"] or "").lower(),
                -len(c["clubname"]),  # longest name = more specific
                c["id"],
            ))[0]

            for dup in group:
                if dup["id"] == canonical["id"]:
                    continue

                # Count players on the duplicate
                cur.execute("SELECT COUNT(*) as cnt FROM people WHERE club_id = %s", (dup["id"],))
                cnt = cur.fetchone()["cnt"]

                print(f"    MERGE: {dup['clubname']} (id={dup['id']}, {cnt} players) → {canonical['clubname']} (id={canonical['id']})")

                if not DRY_RUN:
                    # Move players
                    cur.execute("UPDATE people SET club_id = %s WHERE club_id = %s", (canonical["id"], dup["id"]))
                    # Move career history references
                    cur.execute("UPDATE player_career_history SET club_id = %s WHERE club_id = %s", (canonical["id"], dup["id"]))
                    # Delete duplicate
                    cur.execute("DELETE FROM clubs WHERE id = %s", (dup["id"],))

                    # Fix league_name on canonical if it has "duplicate" in it
                    if canonical.get("league_name") and "duplicate" in canonical["league_name"].lower():
                        clean_league = canonical["league_name"].replace(" (duplicate)", "")
                        cur.execute("UPDATE clubs SET league_name = %s WHERE id = %s", (clean_league, canonical["id"]))

                merged += 1
                players_moved += cnt

        print(f"    Merged {merged} duplicate clubs, moved {players_moved} players")

        # Also fix league_name entries with "(duplicate)" on remaining clubs
        if not DRY_RUN:
            cur.execute("""
                UPDATE clubs SET league_name = REPLACE(league_name, ' (duplicate)', '')
                WHERE league_name LIKE '%%(duplicate)%%'
            """)
            if cur.rowcount:
                print(f"    Cleaned '(duplicate)' from {cur.rowcount} league names")

    # ══════════════════════════════════════════════════════════════════════
    # PASS 2: FIX — correct wrong wikidata_ids
    # ══════════════════════════════════════════════════════════════════════

    if args.dedup or RUN_ALL:
        print("\n  ── Pass 2: Fix wrong wikidata_ids ──")
        fixed = 0
        for club_id, correct_wd in WIKIDATA_FIXES.items():
            cur.execute("SELECT clubname, wikidata_id FROM clubs WHERE id = %s", (club_id,))
            row = cur.fetchone()
            if not row:
                continue
            if row["wikidata_id"] == correct_wd:
                continue
            print(f"    {row['clubname']}: {row['wikidata_id']} → {correct_wd}")
            if not DRY_RUN:
                cur.execute("UPDATE clubs SET wikidata_id = %s WHERE id = %s", (correct_wd, club_id))
            fixed += 1

        # Seed missing wikidata_ids for major clubs
        seeded = 0
        for club_id, wd_id in WIKIDATA_SEEDS.items():
            cur.execute("SELECT clubname, wikidata_id FROM clubs WHERE id = %s", (club_id,))
            row = cur.fetchone()
            if not row:
                continue
            if row["wikidata_id"]:
                continue
            print(f"    SEED: {row['clubname']} → {wd_id}")
            if not DRY_RUN:
                cur.execute("UPDATE clubs SET wikidata_id = %s WHERE id = %s", (wd_id, club_id))
            seeded += 1

        print(f"    Fixed {fixed} wrong wikidata_ids, seeded {seeded} missing ones")

    # ══════════════════════════════════════════════════════════════════════
    # PASS 3: ENRICH — pull metadata from Wikidata for clubs with wikidata_id
    # ══════════════════════════════════════════════════════════════════════

    if args.enrich or RUN_ALL:
        print("\n  ── Pass 3: Enrich from Wikidata ──")

        # Get clubs that have wikidata_id but missing key metadata
        cur.execute("""
            SELECT id, clubname, wikidata_id
            FROM clubs
            WHERE wikidata_id IS NOT NULL
            AND (stadium IS NULL OR country IS NULL OR founded_year IS NULL)
            ORDER BY id
        """)
        to_enrich = cur.fetchall()
        print(f"    {len(to_enrich)} clubs to enrich")

        if to_enrich:
            BATCH = 50
            enriched = 0

            for i in range(0, len(to_enrich), BATCH):
                batch = to_enrich[i:i + BATCH]
                qids = [c["wikidata_id"] for c in batch]
                qid_to_club = {c["wikidata_id"]: c for c in batch}

                values = " ".join(f"wd:{qid}" for qid in qids)
                query = f"""
                SELECT ?club ?clubLabel ?country ?countryLabel ?stadium ?stadiumLabel
                       ?capacity ?inception ?logo WHERE {{
                  VALUES ?club {{ {values} }}
                  OPTIONAL {{ ?club wdt:P17 ?country . }}
                  OPTIONAL {{ ?club wdt:P115 ?stadium . }}
                  OPTIONAL {{ ?club p:P115/pq:P1083 ?capacity . }}
                  OPTIONAL {{ ?club wdt:P571 ?inception . }}
                  OPTIONAL {{ ?club wdt:P154 ?logo . }}
                  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
                }}
                """

                try:
                    resp = SESSION.get(WIKIDATA_SPARQL, params={"query": query, "format": "json"}, timeout=30)
                    resp.raise_for_status()
                    data = resp.json()
                except Exception as e:
                    print(f"    SPARQL error: {e}")
                    time.sleep(5)
                    continue

                # Process results
                club_data: dict[str, dict] = {}
                for row in data.get("results", {}).get("bindings", []):
                    qid = row["club"]["value"].split("/")[-1]
                    if qid not in club_data:
                        club_data[qid] = {}
                    d = club_data[qid]

                    if "countryLabel" in row and "country" not in d:
                        d["country"] = row["countryLabel"]["value"]
                    if "stadiumLabel" in row and "stadium" not in d:
                        d["stadium"] = row["stadiumLabel"]["value"]
                    if "capacity" in row and "stadium_capacity" not in d:
                        try:
                            d["stadium_capacity"] = int(float(row["capacity"]["value"]))
                        except (ValueError, KeyError):
                            pass
                    if "inception" in row and "founded_year" not in d:
                        try:
                            d["founded_year"] = int(row["inception"]["value"][:4])
                        except (ValueError, KeyError):
                            pass
                    if "logo" in row and "logo_url" not in d:
                        d["logo_url"] = row["logo"]["value"]

                # Apply updates
                for qid, meta in club_data.items():
                    club = qid_to_club.get(qid)
                    if not club or not meta:
                        continue

                    updates = {}
                    for field in ["country", "stadium", "stadium_capacity", "founded_year", "logo_url"]:
                        if field in meta and meta[field]:
                            updates[field] = meta[field]

                    if updates:
                        if args.verbose:
                            print(f"    {club['clubname']}: {updates}")
                        if not DRY_RUN:
                            set_clause = ", ".join(f"{k} = %s" for k in updates)
                            cur.execute(
                                f"UPDATE clubs SET {set_clause} WHERE id = %s",
                                list(updates.values()) + [club["id"]],
                            )
                        enriched += 1

                print(f"    Batch {i // BATCH + 1}: enriched {len(club_data)} clubs")
                time.sleep(2)

            print(f"    Total enriched: {enriched}")

    # ── Commit ────────────────────────────────────────────────────────────
    if not DRY_RUN:
        conn.commit()
        print("\n  Changes committed.")
    else:
        print("\n  DRY RUN — no changes written.")

    # ── Summary stats ─────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) as cnt FROM clubs")
    total = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM clubs WHERE wikidata_id IS NOT NULL")
    with_wd = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM clubs WHERE country IS NOT NULL")
    with_country = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM clubs WHERE stadium IS NOT NULL")
    with_stadium = cur.fetchone()["cnt"]

    print(f"\n  ── Club stats ──")
    print(f"    Total:     {total}")
    print(f"    Wikidata:  {with_wd}")
    print(f"    Country:   {with_country}")
    print(f"    Stadium:   {with_stadium}")

    conn.close()
    print("\n  Done.")


if __name__ == "__main__":
    main()
