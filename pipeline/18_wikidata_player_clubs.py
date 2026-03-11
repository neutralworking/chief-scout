"""
18_wikidata_player_clubs.py — Batch-update player clubs from Wikidata.

Uses Wikidata P54 (member of sports team) to find each player's current club
and update people.club_id accordingly.

Requires players to have wikidata_id set (run 15_wikidata_enrich.py first).

Usage:
    python 18_wikidata_player_clubs.py --dry-run         # preview all changes
    python 18_wikidata_player_clubs.py --league PL       # Premier League only
    python 18_wikidata_player_clubs.py --player 42       # single player
    python 18_wikidata_player_clubs.py --force            # re-check even if club_id set
    python 18_wikidata_player_clubs.py --limit 100       # cap batch size
"""
import argparse
import sys
import time
import unicodedata

import requests
import psycopg2

from config import POSTGRES_DSN

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Batch-update player clubs from Wikidata")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Re-check players with existing club_id")
parser.add_argument("--player", type=int, default=None, help="Single person_id to update")
parser.add_argument("--league", type=str, default=None,
                    help="Filter by league (PL, LaLiga, Bundesliga, SerieA, Ligue1)")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--verbose", action="store_true", help="Show detailed info")
parser.add_argument("--batch-sparql", type=int, default=25, help="Players per SPARQL batch")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
VERBOSE = args.verbose
BATCH_SIZE = args.batch_sparql

# League name patterns for filtering
LEAGUE_FILTERS = {
    "PL": "Premier League",
    "LaLiga": "La Liga",
    "Bundesliga": "Bundesliga",
    "SerieA": "Serie A",
    "Ligue1": "Ligue 1",
    "Eredivisie": "Eredivisie",
    "PrimeiraLiga": "Primeira Liga",
}

# ── DB connection ─────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Wikidata setup ────────────────────────────────────────────────────────────

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "ChiefScout/1.0 (football scouting tool)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


def normalize(name: str) -> str:
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


# ── Load clubs lookup ─────────────────────────────────────────────────────────

cur.execute("SELECT id, clubname, wikidata_id FROM clubs")
club_rows = cur.fetchall()

# Build multiple indexes for matching
clubs_by_wikidata = {}  # wikidata_id → club_id
clubs_by_name_norm = {}  # normalized name → club_id
clubs_by_id = {}  # club_id → name

for cid, cname, cwikidata in club_rows:
    clubs_by_id[cid] = cname
    clubs_by_name_norm[normalize(cname)] = cid
    if cwikidata:
        clubs_by_wikidata[cwikidata] = cid

print(f"Loaded {len(club_rows)} clubs ({len(clubs_by_wikidata)} with wikidata_id)")

# ── Load players to process ──────────────────────────────────────────────────

if args.player:
    cur.execute("""
        SELECT p.id, p.name, p.wikidata_id, p.club_id, c.clubname AS current_club
        FROM people p
        LEFT JOIN clubs c ON c.id = p.club_id
        WHERE p.id = %s AND p.wikidata_id IS NOT NULL
    """, (args.player,))
elif args.league:
    league_name = LEAGUE_FILTERS.get(args.league, args.league)
    cur.execute("""
        SELECT p.id, p.name, p.wikidata_id, p.club_id, c.clubname AS current_club
        FROM people p
        LEFT JOIN clubs c ON c.id = p.club_id
        WHERE p.wikidata_id IS NOT NULL
          AND p.active = true
          AND (c.league_name ILIKE %s OR %s = true)
    """, (f"%{league_name}%", FORCE and not args.league))
else:
    where = "p.wikidata_id IS NOT NULL AND p.active = true"
    if not FORCE:
        where += " AND p.club_id IS NULL"
    cur.execute(f"""
        SELECT p.id, p.name, p.wikidata_id, p.club_id, c.clubname AS current_club
        FROM people p
        LEFT JOIN clubs c ON c.id = p.club_id
        WHERE {where}
        ORDER BY p.id
    """)

players = cur.fetchall()
if args.limit:
    players = players[:args.limit]

print(f"Players to process: {len(players)}")

if not players:
    print("No players to process.")
    cur.close()
    conn.close()
    sys.exit(0)

# ── Batch SPARQL: get current clubs ──────────────────────────────────────────


def batch_get_clubs(qids: list[str]) -> dict[str, dict]:
    """
    Query Wikidata for current clubs of multiple players at once.
    Returns {qid: {club_qid, club_label}} for players with a current club.
    """
    values = " ".join(f"wd:{qid}" for qid in qids)

    # P54 = member of sports team
    # Get the most recent team (no end date, or latest end date)
    query = f"""
    SELECT ?player ?playerLabel ?team ?teamLabel ?start ?end WHERE {{
      VALUES ?player {{ {values} }}
      ?player wdt:P54 ?team .
      OPTIONAL {{
        ?player p:P54 ?stmt .
        ?stmt ps:P54 ?team .
        OPTIONAL {{ ?stmt pq:P580 ?start . }}
        OPTIONAL {{ ?stmt pq:P582 ?end . }}
      }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    ORDER BY ?player DESC(?start)
    """

    try:
        resp = SESSION.get(WIKIDATA_SPARQL, params={
            "query": query,
            "format": "json",
        }, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  SPARQL error: {e}")
        return {}

    # Process results: pick the most recent club for each player
    # (no end date = current, otherwise latest start date)
    player_clubs: dict[str, list] = {}
    for row in data.get("results", {}).get("bindings", []):
        p_uri = row["player"]["value"]
        p_qid = p_uri.split("/")[-1]
        t_uri = row["team"]["value"]
        t_qid = t_uri.split("/")[-1]
        t_label = row.get("teamLabel", {}).get("value", "")
        end = row.get("end", {}).get("value")
        start = row.get("start", {}).get("value", "")

        if p_qid not in player_clubs:
            player_clubs[p_qid] = []
        player_clubs[p_qid].append({
            "club_qid": t_qid,
            "club_label": t_label,
            "start": start,
            "end": end,
        })

    # For each player, pick the current club (no end date) or most recent
    result = {}
    for qid, clubs in player_clubs.items():
        # Prefer clubs with no end date (= current)
        current = [c for c in clubs if c["end"] is None]
        if current:
            # Pick the one with the latest start date
            current.sort(key=lambda c: c["start"] or "", reverse=True)
            result[qid] = current[0]
        else:
            # All have end dates — pick latest end date
            clubs.sort(key=lambda c: c["end"] or "", reverse=True)
            result[qid] = clubs[0]

    return result


def match_club(club_qid: str, club_label: str) -> int | None:
    """Try to match a Wikidata club to our clubs table."""
    # 1. Match by wikidata_id
    if club_qid in clubs_by_wikidata:
        return clubs_by_wikidata[club_qid]

    # 2. Match by normalized name
    norm = normalize(club_label)
    if norm in clubs_by_name_norm:
        return clubs_by_name_norm[norm]

    # 3. Partial match (club_label contains or is contained in a club name)
    for cname_norm, cid in clubs_by_name_norm.items():
        if norm in cname_norm or cname_norm in norm:
            return cid

    return None


# ── Process in batches ───────────────────────────────────────────────────────

updated = 0
not_found = 0
no_change = 0
club_missing = 0

for i in range(0, len(players), BATCH_SIZE):
    batch = players[i:i + BATCH_SIZE]
    # Build qid → player info mapping
    qid_map = {}
    for pid, pname, wikidata_id, current_club_id, current_club_name in batch:
        qid = wikidata_id.replace("http://www.wikidata.org/entity/", "").replace("https://www.wikidata.org/entity/", "")
        if qid.startswith("Q"):
            qid_map[qid] = {
                "pid": pid,
                "name": pname,
                "current_club_id": current_club_id,
                "current_club_name": current_club_name,
            }

    if not qid_map:
        continue

    print(f"\n  Batch {i // BATCH_SIZE + 1}: querying {len(qid_map)} players...")
    clubs_data = batch_get_clubs(list(qid_map.keys()))

    for qid, player_info in qid_map.items():
        pid = player_info["pid"]
        pname = player_info["name"]

        if qid not in clubs_data:
            not_found += 1
            if VERBOSE:
                print(f"    {pname}: no club data on Wikidata")
            continue

        wd_club = clubs_data[qid]
        club_id = match_club(wd_club["club_qid"], wd_club["club_label"])

        if club_id is None:
            club_missing += 1
            if VERBOSE:
                print(f"    {pname}: Wikidata says '{wd_club['club_label']}' but not in our clubs table")
            continue

        if club_id == player_info["current_club_id"]:
            no_change += 1
            continue

        old_club = player_info["current_club_name"] or "None"
        new_club = clubs_by_id.get(club_id, "?")
        print(f"    {pname}: {old_club} → {new_club}")

        if not DRY_RUN:
            cur.execute("UPDATE people SET club_id = %s, updated_at = now() WHERE id = %s", (club_id, pid))
        updated += 1

    # Rate limit
    time.sleep(2)

# ── Summary ──────────────────────────────────────────────────────────────────

print(f"\n── Summary ──")
print(f"  Updated:       {updated}")
print(f"  No change:     {no_change}")
print(f"  No WD data:    {not_found}")
print(f"  Club not in DB: {club_missing}")
if DRY_RUN:
    print("  (dry-run — no data was written)")

cur.close()
conn.close()
print("\nDone.")
