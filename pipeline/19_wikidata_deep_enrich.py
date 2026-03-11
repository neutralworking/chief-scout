"""
19_wikidata_deep_enrich.py — Deep enrichment from Wikidata.

Pulls 5 high-value properties for players who have wikidata_id set:
  P27  → citizenship (dual nationality)
  P54  → full career history with dates
  P413 → playing position
  P18  → image (Wikimedia Commons URL)
  P2446 → Transfermarkt ID

Also backfills P19 (place of birth) onto people.place_of_birth.

Requires: migration 014_wikidata_deep_enrich.sql applied first.
Requires: players to have wikidata_id (run 15_wikidata_enrich.py first).

Usage:
    python 19_wikidata_deep_enrich.py --dry-run             # preview all
    python 19_wikidata_deep_enrich.py --player 42            # single player
    python 19_wikidata_deep_enrich.py --league PL            # Premier League only
    python 19_wikidata_deep_enrich.py --limit 100            # cap batch size
    python 19_wikidata_deep_enrich.py --phase career         # only career history
    python 19_wikidata_deep_enrich.py --phase identity       # only P27/P413/P18/P2446/P19
    python 19_wikidata_deep_enrich.py --force                # re-enrich even if data exists
"""
import argparse
import sys
import time
import unicodedata
from datetime import datetime

import requests
import psycopg2

from config import POSTGRES_DSN

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Deep Wikidata enrichment for players")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Re-enrich even if data exists")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
parser.add_argument("--league", type=str, default=None, help="Filter by league (PL, LaLiga, etc.)")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--phase", type=str, default=None, choices=["identity", "career"],
                    help="Run only one phase (identity=P27/P413/P18/P2446/P19, career=P54)")
parser.add_argument("--batch-size", type=int, default=25, help="Players per SPARQL batch")
parser.add_argument("--verbose", action="store_true", help="Show detailed output")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
VERBOSE = args.verbose
BATCH_SIZE = args.batch_size

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


def safe_date(date_str: str | None) -> str | None:
    """Validate and return a date string, or None if invalid/out of range."""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        # Reject dates before 1850 or in the future
        if dt.year < 1850 or dt > datetime.now():
            return None
        return date_str[:10]
    except (ValueError, TypeError):
        return None


def sparql_query(query: str, retries: int = 2) -> list[dict]:
    """Execute a SPARQL query with retry on rate-limit."""
    for attempt in range(retries + 1):
        try:
            resp = SESSION.get(WIKIDATA_SPARQL, params={
                "query": query,
                "format": "json",
            }, timeout=45)
            if resp.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json().get("results", {}).get("bindings", [])
        except Exception as e:
            if attempt < retries:
                print(f"  SPARQL error (retry {attempt+1}): {e}")
                time.sleep(3)
            else:
                print(f"  SPARQL failed: {e}")
                return []
    return []


# ── Load clubs + nations lookup ──────────────────────────────────────────────

cur.execute("SELECT id, clubname, wikidata_id FROM clubs")
club_rows = cur.fetchall()
clubs_by_wikidata = {}
clubs_by_name = {}
for cid, cname, cwikidata in club_rows:
    clubs_by_name[normalize(cname)] = cid
    if cwikidata:
        clubs_by_wikidata[cwikidata] = cid

cur.execute("SELECT id, name FROM nations")
nation_rows = cur.fetchall()
nations_by_name = {}
for nid, nname in nation_rows:
    nations_by_name[normalize(nname)] = nid

print(f"Loaded {len(club_rows)} clubs, {len(nation_rows)} nations")

# ── Load players to process ──────────────────────────────────────────────────

if args.player:
    cur.execute("""
        SELECT p.id, p.name, p.wikidata_id
        FROM people p
        WHERE p.id = %s AND p.wikidata_id IS NOT NULL
    """, (args.player,))
elif args.league:
    league_name = LEAGUE_FILTERS.get(args.league, args.league)
    cur.execute("""
        SELECT p.id, p.name, p.wikidata_id
        FROM people p
        LEFT JOIN clubs c ON c.id = p.club_id
        WHERE p.wikidata_id IS NOT NULL AND p.active = true
          AND c.league_name ILIKE %s
        ORDER BY p.id
    """, (f"%{league_name}%",))
else:
    cur.execute("""
        SELECT p.id, p.name, p.wikidata_id
        FROM people p
        WHERE p.wikidata_id IS NOT NULL AND p.active = true
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


# ── Helper: extract QID from wikidata_id field ──────────────────────────────

def to_qid(wikidata_id: str) -> str:
    return wikidata_id.replace("http://www.wikidata.org/entity/", "").replace("https://www.wikidata.org/entity/", "")


def match_club(club_qid: str, club_label: str) -> int | None:
    if club_qid in clubs_by_wikidata:
        return clubs_by_wikidata[club_qid]
    norm = normalize(club_label)
    if norm in clubs_by_name:
        return clubs_by_name[norm]
    for cname_norm, cid in clubs_by_name.items():
        if norm in cname_norm or cname_norm in norm:
            return cid
    return None


def match_nation(nation_label: str) -> int | None:
    norm = normalize(nation_label)
    if norm in nations_by_name:
        return nations_by_name[norm]
    for nname_norm, nid in nations_by_name.items():
        if norm in nname_norm or nname_norm in norm:
            return nid
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1: Identity enrichment (P27, P413, P18, P2446, P19)
# ═══════════════════════════════════════════════════════════════════════════════

def phase_identity(qid_map: dict):
    """Batch query for identity properties: citizenship, position, image, Transfermarkt ID, birthplace."""
    qids = list(qid_map.keys())
    values = " ".join(f"wd:{qid}" for qid in qids)

    query = f"""
    SELECT ?player ?citizenship ?citizenshipLabel
           ?position ?positionLabel
           ?image
           ?transfermarkt
           ?birthplace ?birthplaceLabel
    WHERE {{
      VALUES ?player {{ {values} }}
      OPTIONAL {{ ?player wdt:P27 ?citizenship . }}
      OPTIONAL {{ ?player wdt:P413 ?position . }}
      OPTIONAL {{ ?player wdt:P18 ?image . }}
      OPTIONAL {{ ?player wdt:P2446 ?transfermarkt . }}
      OPTIONAL {{ ?player wdt:P19 ?birthplace . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    """

    rows = sparql_query(query)

    # Aggregate per player
    player_data: dict[str, dict] = {}
    for row in rows:
        p_uri = row["player"]["value"]
        qid = p_uri.split("/")[-1]
        if qid not in player_data:
            player_data[qid] = {
                "citizenships": [],
                "positions": [],
                "image": None,
                "transfermarkt_id": None,
                "birthplace": None,
            }

        d = player_data[qid]

        # P27 citizenship
        if "citizenshipLabel" in row and row["citizenshipLabel"]["value"]:
            label = row["citizenshipLabel"]["value"]
            c_qid = row.get("citizenship", {}).get("value", "").split("/")[-1]
            entry = (label, c_qid)
            if entry not in d["citizenships"]:
                d["citizenships"].append(entry)

        # P413 position
        if "positionLabel" in row and row["positionLabel"]["value"]:
            pos = row["positionLabel"]["value"]
            if pos not in d["positions"]:
                d["positions"].append(pos)

        # P18 image (take first)
        if not d["image"] and "image" in row and row["image"]["value"]:
            d["image"] = row["image"]["value"]

        # P2446 Transfermarkt ID
        if not d["transfermarkt_id"] and "transfermarkt" in row and row["transfermarkt"]["value"]:
            d["transfermarkt_id"] = row["transfermarkt"]["value"]

        # P19 birthplace
        if not d["birthplace"] and "birthplaceLabel" in row and row["birthplaceLabel"]["value"]:
            d["birthplace"] = row["birthplaceLabel"]["value"]

    return player_data


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2: Career history (P54 with qualifiers)
# ═══════════════════════════════════════════════════════════════════════════════

def phase_career(qid_map: dict):
    """Batch query for full career history with start/end dates."""
    qids = list(qid_map.keys())
    values = " ".join(f"wd:{qid}" for qid in qids)

    query = f"""
    SELECT ?player ?team ?teamLabel ?start ?end ?jersey ?loanLabel WHERE {{
      VALUES ?player {{ {values} }}
      ?player p:P54 ?stmt .
      ?stmt ps:P54 ?team .
      OPTIONAL {{ ?stmt pq:P580 ?start . }}
      OPTIONAL {{ ?stmt pq:P582 ?end . }}
      OPTIONAL {{ ?stmt pq:P1618 ?jersey . }}
      OPTIONAL {{ ?stmt pq:P642 ?loan . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    ORDER BY ?player ?start
    """

    rows = sparql_query(query)

    # Aggregate per player
    player_careers: dict[str, list] = {}
    for row in rows:
        p_uri = row["player"]["value"]
        qid = p_uri.split("/")[-1]
        t_uri = row["team"]["value"]
        t_qid = t_uri.split("/")[-1]
        t_label = row.get("teamLabel", {}).get("value", "")
        start = safe_date(row.get("start", {}).get("value", "")) if "start" in row else None
        end = safe_date(row.get("end", {}).get("value", "")) if "end" in row else None
        jersey = row.get("jersey", {}).get("value") if "jersey" in row else None
        loan_label = row.get("loanLabel", {}).get("value", "") if "loanLabel" in row else ""
        is_loan = "loan" in loan_label.lower() if loan_label else False

        if qid not in player_careers:
            player_careers[qid] = []

        # Deduplicate
        entry = {
            "club_qid": t_qid,
            "club_label": t_label,
            "start": start,
            "end": end,
            "jersey": int(jersey) if jersey and jersey.isdigit() else None,
            "is_loan": is_loan,
        }

        # Check for duplicate (same club + start)
        exists = any(
            e["club_qid"] == t_qid and e["start"] == start
            for e in player_careers[qid]
        )
        if not exists:
            player_careers[qid].append(entry)

    # Sort each player's career chronologically
    for qid in player_careers:
        player_careers[qid].sort(key=lambda c: c["start"] or "0000-00-00")

    return player_careers


# ═══════════════════════════════════════════════════════════════════════════════
# Main processing loop
# ═══════════════════════════════════════════════════════════════════════════════

stats = {
    "identity_updated": 0,
    "nationalities_added": 0,
    "career_entries_added": 0,
    "images_set": 0,
    "transfermarkt_set": 0,
    "positions_set": 0,
    "birthplace_set": 0,
}

for i in range(0, len(players), BATCH_SIZE):
    batch = players[i:i + BATCH_SIZE]
    qid_map = {}
    for pid, pname, wikidata_id in batch:
        qid = to_qid(wikidata_id)
        if qid.startswith("Q"):
            qid_map[qid] = {"pid": pid, "name": pname}

    if not qid_map:
        continue

    batch_num = i // BATCH_SIZE + 1
    print(f"\n  Batch {batch_num}: {len(qid_map)} players...")

    # ── Phase 1: Identity ────────────────────────────────────────────────────
    if args.phase is None or args.phase == "identity":
        identity_data = phase_identity(qid_map)

        for qid, data in identity_data.items():
            if qid not in qid_map:
                continue
            pid = qid_map[qid]["pid"]
            pname = qid_map[qid]["name"]

            # Update people table (image, transfermarkt_id, birthplace, position)
            updates = []
            params = []

            if data["image"] and (FORCE or not DRY_RUN):
                updates.append("image_url = %s")
                params.append(data["image"])
                stats["images_set"] += 1

            if data["transfermarkt_id"]:
                updates.append("transfermarkt_id = %s")
                params.append(data["transfermarkt_id"])
                stats["transfermarkt_set"] += 1

            if data["birthplace"]:
                updates.append("place_of_birth = %s")
                params.append(data["birthplace"])
                stats["birthplace_set"] += 1

            if data["positions"]:
                # Join multiple positions
                pos_str = " / ".join(data["positions"])
                updates.append("wikidata_position = %s")
                params.append(pos_str)
                stats["positions_set"] += 1

            if updates and not DRY_RUN:
                updates.append("updated_at = now()")
                sql = f"UPDATE people SET {', '.join(updates)} WHERE id = %s"
                params.append(pid)
                cur.execute(sql, params)
                stats["identity_updated"] += 1

            if VERBOSE and updates:
                print(f"    {pname}: image={'Y' if data['image'] else 'N'}, "
                      f"tm={data['transfermarkt_id'] or 'N'}, "
                      f"pos={'/'.join(data['positions']) if data['positions'] else 'N'}, "
                      f"birth={data['birthplace'] or 'N'}")

            # P27 citizenships → player_nationalities
            for nation_label, nation_qid in data["citizenships"]:
                nation_id = match_nation(nation_label)

                if DRY_RUN:
                    if VERBOSE:
                        print(f"    {pname}: nationality → {nation_label} ({nation_qid})")
                else:
                    cur.execute("""
                        INSERT INTO player_nationalities (person_id, nation_name, nation_wikidata_id, nation_id)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (person_id, nation_name) DO NOTHING
                    """, (pid, nation_label, nation_qid, nation_id))
                stats["nationalities_added"] += 1

    # ── Phase 2: Career history ──────────────────────────────────────────────
    if args.phase is None or args.phase == "career":
        career_data = phase_career(qid_map)

        for qid, career in career_data.items():
            if qid not in qid_map:
                continue
            pid = qid_map[qid]["pid"]
            pname = qid_map[qid]["name"]

            for idx, entry in enumerate(career):
                club_id = match_club(entry["club_qid"], entry["club_label"])
                start_date = entry["start"] if entry["start"] else None
                end_date = entry["end"] if entry["end"] else None

                if DRY_RUN:
                    if VERBOSE:
                        loan_tag = " (loan)" if entry["is_loan"] else ""
                        print(f"    {pname}: {entry['club_label']}{loan_tag} "
                              f"{start_date or '?'} → {end_date or 'present'}")
                else:
                    cur.execute("""
                        INSERT INTO player_career_history
                            (person_id, club_name, club_wikidata_id, club_id,
                             start_date, end_date, is_loan, jersey_number, sort_order)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (person_id, club_wikidata_id, start_date) DO UPDATE SET
                            end_date = EXCLUDED.end_date,
                            club_id = EXCLUDED.club_id,
                            is_loan = EXCLUDED.is_loan,
                            jersey_number = EXCLUDED.jersey_number,
                            sort_order = EXCLUDED.sort_order
                    """, (pid, entry["club_label"], entry["club_qid"], club_id,
                          start_date, end_date, entry["is_loan"], entry["jersey"],
                          idx))
                stats["career_entries_added"] += 1

    # Rate limit
    time.sleep(2)

# ── Summary ──────────────────────────────────────────────────────────────────

print(f"\n── Summary ──")
print(f"  Identity updates:    {stats['identity_updated']}")
print(f"  Images set:          {stats['images_set']}")
print(f"  Transfermarkt IDs:   {stats['transfermarkt_set']}")
print(f"  Positions set:       {stats['positions_set']}")
print(f"  Birthplaces set:     {stats['birthplace_set']}")
print(f"  Nationalities added: {stats['nationalities_added']}")
print(f"  Career entries:      {stats['career_entries_added']}")
if DRY_RUN:
    print("  (dry-run — no data was written)")

cur.close()
conn.close()
print("\nDone.")
