"""
15_wikidata_enrich.py — Enrich player data from Wikidata SPARQL endpoint.

Three phases:
  Phase 1: For players WITH wikidata_id, fetch structured data → backfill people gaps
  Phase 2: For players WITHOUT wikidata_id, resolve via name+DOB matching
  Phase 3: Extract external IDs (FBRef, Transfermarkt, Soccerway) → player_id_links

Usage:
    python 15_wikidata_enrich.py                      # all phases
    python 15_wikidata_enrich.py --phase 1             # enrich existing only
    python 15_wikidata_enrich.py --phase 2             # resolve missing QIDs only
    python 15_wikidata_enrich.py --phase 3             # cross-link external IDs only
    python 15_wikidata_enrich.py --dry-run             # preview without writing
    python 15_wikidata_enrich.py --player 42            # single player by people.id
    python 15_wikidata_enrich.py --force               # overwrite existing values
"""
import argparse
import json
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import date

import psycopg2

from config import POSTGRES_DSN

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Enrich player data from Wikidata")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--phase", type=int, choices=[1, 2, 3], default=None,
                    help="Run a single phase (default: all)")
parser.add_argument("--player", type=int, default=None,
                    help="Single player by people.id")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing values (default: only fill gaps)")
parser.add_argument("--batch-size", type=int, default=50,
                    help="SPARQL batch size (default: 50)")
args = parser.parse_args()

DRY_RUN = args.dry_run
PHASE = args.phase
PLAYER_ID = args.player
FORCE = args.force
BATCH_SIZE = args.batch_size

# ── Wikidata SPARQL ───────────────────────────────────────────────────────────

WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "ChiefScout/1.0 (https://github.com/neutralworking/chief-scout) pipeline"
REQUEST_DELAY = 1.5  # seconds between SPARQL requests (be polite)


def sparql_query(query: str) -> list[dict]:
    """Execute a SPARQL query against Wikidata and return results."""
    url = WIKIDATA_ENDPOINT + "?" + urllib.parse.urlencode({
        "query": query,
        "format": "json",
    })
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("results", {}).get("bindings", [])
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  Rate limited by Wikidata, waiting 30s...")
            time.sleep(30)
            return sparql_query(query)  # retry once
        print(f"  SPARQL error {e.code}: {e.reason}")
        return []
    except Exception as e:
        print(f"  SPARQL error: {e}")
        return []


def extract_qid(uri: str) -> str:
    """Extract QID from a Wikidata entity URI."""
    if not uri:
        return ""
    return uri.rsplit("/", 1)[-1] if "/" in uri else uri


def extract_value(binding: dict, key: str) -> str | None:
    """Safely extract a string value from a SPARQL binding."""
    if key in binding and binding[key].get("value"):
        return binding[key]["value"]
    return None


# ── DB connection ─────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: POSTGRES_DSN not set. Check .env or .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── PHASE 1: Enrich players with existing wikidata_id ────────────────────────


def run_phase1():
    """Fetch structured data from Wikidata for players that already have a QID."""
    print("\n══ Phase 1: Enrich existing Wikidata IDs ══")

    # Load players with wikidata_id
    if PLAYER_ID:
        cur.execute("""
            SELECT id, name, wikidata_id, dob, height_cm, preferred_foot
            FROM people WHERE id = %s AND wikidata_id IS NOT NULL
        """, (PLAYER_ID,))
    else:
        cur.execute("""
            SELECT id, name, wikidata_id, dob, height_cm, preferred_foot
            FROM people WHERE wikidata_id IS NOT NULL
        """)
    players = cur.fetchall()
    print(f"  {len(players)} players with wikidata_id")

    if not players:
        print("  Nothing to enrich.")
        return

    # Process in batches
    updated = 0
    skipped = 0
    errors = 0

    for i in range(0, len(players), BATCH_SIZE):
        batch = players[i:i + BATCH_SIZE]
        qids = [p[2] for p in batch]
        qid_to_player = {p[2]: p for p in batch}

        # SPARQL: fetch DOB, height, foot, country for batch
        values_clause = " ".join(f"wd:{qid}" for qid in qids)
        query = f"""
        SELECT ?player ?playerLabel ?dob ?height ?footLabel ?countryLabel WHERE {{
          VALUES ?player {{ {values_clause} }}
          OPTIONAL {{ ?player wdt:P569 ?dob . }}
          OPTIONAL {{ ?player wdt:P2048 ?height . }}
          OPTIONAL {{ ?player wdt:P552 ?foot . }}
          OPTIONAL {{ ?player wdt:P27 ?country . }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
        }}
        """

        results = sparql_query(query)
        if not results:
            errors += len(batch)
            if i + BATCH_SIZE < len(players):
                time.sleep(REQUEST_DELAY)
            continue

        # Index results by QID
        by_qid = {}
        for row in results:
            qid = extract_qid(extract_value(row, "player") or "")
            if qid and qid not in by_qid:
                by_qid[qid] = row

        for qid, (pid, name, _, existing_dob, existing_height, existing_foot) in qid_to_player.items():
            row = by_qid.get(qid)
            if not row:
                skipped += 1
                continue

            updates = {}

            # DOB
            raw_dob = extract_value(row, "dob")
            if raw_dob and (FORCE or existing_dob is None):
                try:
                    dob_val = date.fromisoformat(raw_dob[:10])
                    updates["dob"] = dob_val
                except ValueError:
                    pass

            # Height (Wikidata stores in metres, we store cm)
            raw_height = extract_value(row, "height")
            if raw_height and (FORCE or existing_height is None):
                try:
                    h = float(raw_height)
                    if h < 3:  # metres → cm
                        h = round(h * 100)
                    else:
                        h = round(h)
                    if 140 <= h <= 220:
                        updates["height_cm"] = h
                except ValueError:
                    pass

            # Preferred foot
            raw_foot = extract_value(row, "footLabel")
            if raw_foot and (FORCE or existing_foot is None):
                foot_map = {
                    "right foot": "Right",
                    "left foot": "Left",
                    "ambidextrous": "Both",
                    "both feet": "Both",
                }
                mapped = foot_map.get(raw_foot.lower())
                if mapped:
                    updates["preferred_foot"] = mapped

            if updates:
                if DRY_RUN:
                    print(f"  [dry-run] {name}: would update {updates}")
                else:
                    set_clause = ", ".join(f"{k} = %s" for k in updates)
                    values = list(updates.values()) + [pid]
                    cur.execute(f"UPDATE people SET {set_clause} WHERE id = %s", values)
                updated += 1
            else:
                skipped += 1

        if i + BATCH_SIZE < len(players):
            time.sleep(REQUEST_DELAY)

    print(f"  Updated: {updated} | Skipped (no new data): {skipped} | Errors: {errors}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")


# ── PHASE 2: Resolve missing wikidata_ids ─────────────────────────────────────


def normalize_name(name: str) -> str:
    """Strip accents and normalize for comparison."""
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


def run_phase2():
    """Try to find Wikidata QIDs for players that don't have one yet."""
    print("\n══ Phase 2: Resolve missing Wikidata IDs ══")

    # Players without wikidata_id
    if PLAYER_ID:
        cur.execute("""
            SELECT id, name, dob FROM people
            WHERE id = %s AND wikidata_id IS NULL AND name IS NOT NULL
        """, (PLAYER_ID,))
    else:
        cur.execute("""
            SELECT id, name, dob FROM people
            WHERE wikidata_id IS NULL AND name IS NOT NULL
        """)
    players = cur.fetchall()
    print(f"  {len(players)} players missing wikidata_id")

    if not players:
        print("  Nothing to resolve.")
        return

    resolved = 0
    ambiguous = 0
    unmatched = 0

    for pid, name, dob in players:
        # Search Wikidata for association football players matching name
        escaped_name = name.replace('"', '\\"')
        query = f"""
        SELECT ?player ?playerLabel ?dob WHERE {{
          ?player wdt:P106 wd:Q937857 .  # occupation: association football player
          ?player rdfs:label "{escaped_name}"@en .
          OPTIONAL {{ ?player wdt:P569 ?dob . }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
        }}
        LIMIT 10
        """

        results = sparql_query(query)
        time.sleep(REQUEST_DELAY)

        if not results:
            # Try with label search (looser)
            query = f"""
            SELECT ?player ?playerLabel ?dob WHERE {{
              ?player wdt:P106 wd:Q937857 .
              ?player rdfs:label ?label .
              FILTER(LANG(?label) = "en")
              FILTER(LCASE(?label) = "{normalize_name(name)}")
              OPTIONAL {{ ?player wdt:P569 ?dob . }}
              SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
            }}
            LIMIT 10
            """
            results = sparql_query(query)
            time.sleep(REQUEST_DELAY)

        if not results:
            unmatched += 1
            continue

        # If we have DOB, use it to disambiguate
        candidates = results
        if dob and len(candidates) > 1:
            dob_str = dob.isoformat() if hasattr(dob, "isoformat") else str(dob)
            candidates = [
                r for r in candidates
                if extract_value(r, "dob") and extract_value(r, "dob")[:10] == dob_str[:10]
            ]

        if len(candidates) == 1:
            qid = extract_qid(extract_value(candidates[0], "player") or "")
            if qid:
                if DRY_RUN:
                    print(f"  [dry-run] {name} → {qid}")
                else:
                    cur.execute("UPDATE people SET wikidata_id = %s WHERE id = %s", (qid, pid))
                resolved += 1
        elif len(candidates) > 1:
            ambiguous += 1
            qids = [extract_qid(extract_value(r, "player") or "") for r in candidates[:3]]
            print(f"  Ambiguous: {name} → {', '.join(qids)}")
        else:
            unmatched += 1

    print(f"  Resolved: {resolved} | Ambiguous: {ambiguous} | Unmatched: {unmatched}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")


# ── PHASE 3: Cross-link external IDs ─────────────────────────────────────────

# Wikidata property → our source name in player_id_links
EXTERNAL_ID_PROPERTIES = {
    "P2369": "transfermarkt",   # Transfermarkt player ID
    "P7545": "fbref",           # FBRef player ID
    "P2163": "soccerway",       # Soccerway player ID
}


def run_phase3():
    """Extract external IDs from Wikidata and insert into player_id_links."""
    print("\n══ Phase 3: Cross-link external IDs ══")

    # Players with wikidata_id
    if PLAYER_ID:
        cur.execute("""
            SELECT id, name, wikidata_id FROM people
            WHERE id = %s AND wikidata_id IS NOT NULL
        """, (PLAYER_ID,))
    else:
        cur.execute("""
            SELECT id, name, wikidata_id FROM people
            WHERE wikidata_id IS NOT NULL
        """)
    players = cur.fetchall()
    print(f"  {len(players)} players with wikidata_id")

    if not players:
        print("  Nothing to link.")
        return

    # Load existing links to skip
    cur.execute("SELECT source, external_id FROM player_id_links")
    existing_links = {(r[0], r[1]) for r in cur.fetchall()}
    print(f"  {len(existing_links)} existing links")

    # Build property clauses
    prop_ids = list(EXTERNAL_ID_PROPERTIES.keys())
    optional_clauses = "\n".join(
        f"  OPTIONAL {{ ?player wdt:{pid} ?id_{pid} . }}"
        for pid in prop_ids
    )
    select_vars = " ".join(f"?id_{pid}" for pid in prop_ids)

    inserted = 0
    skipped = 0
    errors = 0

    for i in range(0, len(players), BATCH_SIZE):
        batch = players[i:i + BATCH_SIZE]
        qids = [p[2] for p in batch]
        qid_to_player = {p[2]: (p[0], p[1]) for p in batch}

        values_clause = " ".join(f"wd:{qid}" for qid in qids)
        query = f"""
        SELECT ?player {select_vars} WHERE {{
          VALUES ?player {{ {values_clause} }}
{optional_clauses}
        }}
        """

        results = sparql_query(query)
        if not results:
            errors += len(batch)
            if i + BATCH_SIZE < len(players):
                time.sleep(REQUEST_DELAY)
            continue

        for row in results:
            qid = extract_qid(extract_value(row, "player") or "")
            if qid not in qid_to_player:
                continue
            pid, name = qid_to_player[qid]

            for prop_id, source_name in EXTERNAL_ID_PROPERTIES.items():
                ext_id = extract_value(row, f"id_{prop_id}")
                if not ext_id:
                    continue

                if (source_name, ext_id) in existing_links:
                    skipped += 1
                    continue

                if DRY_RUN:
                    print(f"  [dry-run] {name}: {source_name} = {ext_id}")
                else:
                    cur.execute("""
                        INSERT INTO player_id_links
                            (person_id, source, external_id, external_name, match_method, confidence)
                        VALUES (%s, %s, %s, %s, 'wikidata', 1.0)
                        ON CONFLICT (source, external_id) DO NOTHING
                    """, (pid, source_name, ext_id, name))
                inserted += 1
                existing_links.add((source_name, ext_id))

        if i + BATCH_SIZE < len(players):
            time.sleep(REQUEST_DELAY)

    print(f"  Inserted: {inserted} | Skipped (existing): {skipped} | Errors: {errors}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")


# ── Main ──────────────────────────────────────────────────────────────────────

phases = [1, 2, 3] if PHASE is None else [PHASE]

for phase in phases:
    if phase == 1:
        run_phase1()
    elif phase == 2:
        run_phase2()
    elif phase == 3:
        run_phase3()

# Summary
cur.execute("""
    SELECT source, count(*), count(DISTINCT person_id)
    FROM player_id_links
    GROUP BY source ORDER BY source
""")
print("\n── Link summary ──")
for source, count, people_count in cur.fetchall():
    print(f"  {source}: {count} links → {people_count} distinct people")

cur.execute("""
    SELECT
        count(*) AS total,
        count(wikidata_id) AS with_qid,
        count(dob) AS with_dob,
        count(height_cm) AS with_height,
        count(preferred_foot) AS with_foot
    FROM people
""")
row = cur.fetchone()
print(f"\n── People coverage ──")
print(f"  Total: {row[0]} | Wikidata QID: {row[1]} | DOB: {row[2]} | Height: {row[3]} | Foot: {row[4]}")

if DRY_RUN:
    print("\n(dry-run — no data was written)")

cur.close()
conn.close()
print("\nDone.")
