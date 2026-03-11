"""
15_wikidata_enrich.py — Enrich people table with Wikidata IDs and metadata.

Searches Wikidata for football players by name, validates matches using
date of birth, nationality, and occupation, then updates people.wikidata_id.

Usage:
    python 15_wikidata_enrich.py --dry-run              # preview all
    python 15_wikidata_enrich.py --player 42 --dry-run  # single player preview
    python 15_wikidata_enrich.py                        # full run
    python 15_wikidata_enrich.py --force                # re-enrich existing
    python 15_wikidata_enrich.py --limit 50             # cap batch size
"""
import argparse
import sys
import time
import unicodedata
import re
from datetime import datetime

import requests
import psycopg2

from config import POSTGRES_DSN

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Enrich people with Wikidata IDs")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Re-enrich players with existing wikidata_id")
parser.add_argument("--player", type=int, default=None, help="Single person_id to enrich")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--verbose", action="store_true", help="Show detailed match info")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
VERBOSE = args.verbose

# ── DB connection ─────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Wikidata SPARQL endpoint ─────────────────────────────────────────────────

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
USER_AGENT = "ChiefScout/1.0 (football scouting tool; https://github.com/neutralworking/chief-scout)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


def normalize_name(name: str) -> str:
    """Strip accents and lowercase for comparison."""
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


def sparql_search(name: str, dob: str | None = None) -> list[dict]:
    """
    Search Wikidata for football players matching a name.
    Returns list of {qid, label, dob, description, occupation_ids}.
    """
    # Escape quotes in name for SPARQL
    safe_name = name.replace('"', '\\"').replace("'", "\\'")

    # SPARQL: find humans who are footballers with matching label/altLabel
    query = f"""
    SELECT DISTINCT ?item ?itemLabel ?dob ?itemDescription WHERE {{
      ?item wdt:P31 wd:Q5 .
      ?item wdt:P106/wdt:P279* wd:Q937857 .
      {{
        ?item rdfs:label "{safe_name}"@en .
      }} UNION {{
        ?item skos:altLabel "{safe_name}"@en .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@de .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@fr .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@es .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@pt .
      }}
      OPTIONAL {{ ?item wdt:P569 ?dob . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,de,fr,es,pt" . }}
    }}
    LIMIT 10
    """

    try:
        resp = SESSION.get(WIKIDATA_SPARQL, params={"query": query, "format": "json"}, timeout=30)
        if resp.status_code == 429:
            print("  Rate limited by Wikidata, waiting 5s...")
            time.sleep(5)
            resp = SESSION.get(WIKIDATA_SPARQL, params={"query": query, "format": "json"}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        if VERBOSE:
            print(f"  SPARQL error for '{name}': {e}")
        return []

    results = []
    for binding in data.get("results", {}).get("bindings", []):
        item_uri = binding.get("item", {}).get("value", "")
        qid = item_uri.split("/")[-1] if item_uri else ""
        if not qid.startswith("Q"):
            continue

        wd_dob = binding.get("dob", {}).get("value", "")[:10] if "dob" in binding else None
        results.append({
            "qid": qid,
            "label": binding.get("itemLabel", {}).get("value", ""),
            "dob": wd_dob,
            "description": binding.get("itemDescription", {}).get("value", ""),
        })

    # Deduplicate by QID
    seen = set()
    unique = []
    for r in results:
        if r["qid"] not in seen:
            seen.add(r["qid"])
            unique.append(r)

    return unique


def wbsearchentities_search(name: str) -> list[dict]:
    """
    Fallback: use Wikidata API wbsearchentities for broader name matching.
    """
    try:
        resp = SESSION.get(WIKIDATA_API, params={
            "action": "wbsearchentities",
            "search": name,
            "language": "en",
            "type": "item",
            "limit": 10,
            "format": "json",
        }, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        if VERBOSE:
            print(f"  wbsearch error for '{name}': {e}")
        return []

    results = []
    for item in data.get("search", []):
        qid = item.get("id", "")
        desc = item.get("description", "").lower()
        # Filter to likely footballers
        if any(kw in desc for kw in ["football", "soccer", "footballer", "player"]):
            results.append({
                "qid": qid,
                "label": item.get("label", ""),
                "dob": None,  # Not returned by wbsearch
                "description": item.get("description", ""),
            })

    return results


def get_entity_dob(qid: str) -> str | None:
    """Fetch DOB for a specific entity (used with wbsearch fallback)."""
    try:
        resp = SESSION.get(WIKIDATA_API, params={
            "action": "wbgetentities",
            "ids": qid,
            "props": "claims",
            "format": "json",
        }, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        claims = data.get("entities", {}).get(qid, {}).get("claims", {})
        dob_claims = claims.get("P569", [])
        if dob_claims:
            time_val = dob_claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("time", "")
            # Format: +1990-01-15T00:00:00Z → 1990-01-15
            if time_val:
                return time_val[1:11]
    except Exception:
        pass
    return None


def score_match(player_name: str, player_dob: str | None, candidate: dict) -> float:
    """
    Score a Wikidata candidate against our player data.
    Returns 0.0-1.0 confidence.
    """
    score = 0.0

    # Name similarity (normalized exact = 0.5, case-insensitive partial = 0.3)
    norm_player = normalize_name(player_name)
    norm_candidate = normalize_name(candidate["label"])
    if norm_player == norm_candidate:
        score += 0.5
    elif norm_player in norm_candidate or norm_candidate in norm_player:
        score += 0.3

    # DOB match (exact = 0.5, year only = 0.2)
    if player_dob and candidate.get("dob"):
        if str(player_dob) == candidate["dob"]:
            score += 0.5
        elif str(player_dob)[:4] == candidate["dob"][:4]:
            score += 0.2

    # Description contains "football" keywords = small bonus
    desc = (candidate.get("description") or "").lower()
    if any(kw in desc for kw in ["football", "soccer", "footballer"]):
        score += 0.1

    return min(score, 1.0)


# ── Load players to enrich ───────────────────────────────────────────────────

print("Loading players to enrich...")

if args.player:
    cur.execute("""
        SELECT p.id, p.name, p.date_of_birth, p.wikidata_id, p.wikipedia_url,
               n.name AS nation
        FROM people p
        LEFT JOIN nations n ON n.id = p.nation_id
        WHERE p.id = %s
    """, (args.player,))
else:
    where = "WHERE p.name IS NOT NULL"
    if not FORCE:
        where += " AND p.wikidata_id IS NULL"
    cur.execute(f"""
        SELECT p.id, p.name, p.date_of_birth, p.wikidata_id, p.wikipedia_url,
               n.name AS nation
        FROM people p
        LEFT JOIN nations n ON n.id = p.nation_id
        {where}
        ORDER BY p.id
    """)

players = cur.fetchall()
total = len(players)

if args.limit and not args.player:
    players = players[:args.limit]

print(f"  {total} total candidates, processing {len(players)}")

if not players:
    print("Nothing to enrich.")
    cur.close()
    conn.close()
    sys.exit(0)

# ── Enrich loop ──────────────────────────────────────────────────────────────

matched = 0
skipped = 0
failed = 0
low_confidence = 0
updates = []  # (wikidata_id, person_id)

CONFIDENCE_THRESHOLD = 0.6

for i, (pid, name, dob, existing_wid, wiki_url, nation) in enumerate(players):
    dob_str = str(dob) if dob else None

    if VERBOSE or args.player:
        print(f"\n[{i+1}/{len(players)}] {name} (id={pid}, dob={dob_str})")
    elif (i + 1) % 50 == 0:
        print(f"  {i+1}/{len(players)} processed ({matched} matched)...", flush=True)

    # Search via SPARQL first
    candidates = sparql_search(name, dob_str)

    # Fallback to wbsearchentities if no SPARQL results
    if not candidates:
        candidates = wbsearchentities_search(name)
        # Fetch DOBs for wbsearch candidates to enable scoring
        for c in candidates:
            if not c["dob"]:
                c["dob"] = get_entity_dob(c["qid"])

    if not candidates:
        if VERBOSE or args.player:
            print(f"  No candidates found")
        failed += 1
        continue

    # Score all candidates
    scored = [(score_match(name, dob_str, c), c) for c in candidates]
    scored.sort(key=lambda x: -x[0])

    best_score, best = scored[0]

    if VERBOSE or args.player:
        for s, c in scored[:3]:
            print(f"  {c['qid']} ({s:.2f}): {c['label']} — {c.get('dob', '?')} — {c.get('description', '')}")

    if best_score < CONFIDENCE_THRESHOLD:
        if VERBOSE or args.player:
            print(f"  Best score {best_score:.2f} below threshold {CONFIDENCE_THRESHOLD}")
        low_confidence += 1
        continue

    # Check for ambiguity (two candidates with similar scores)
    if len(scored) > 1 and scored[1][0] >= best_score - 0.1 and scored[1][1]["qid"] != best["qid"]:
        if VERBOSE or args.player:
            print(f"  Ambiguous: top 2 within 0.1 ({best_score:.2f} vs {scored[1][0]:.2f})")
        low_confidence += 1
        continue

    matched += 1
    updates.append((best["qid"], pid))

    if VERBOSE or args.player:
        print(f"  → {best['qid']} ({best_score:.2f})")

    # Rate-limit: ~2 requests per second to be polite to Wikidata
    if not args.player:
        time.sleep(0.5)

# ── Write results ────────────────────────────────────────────────────────────

print(f"\n── Results ──")
print(f"  Matched: {matched}")
print(f"  Low confidence / ambiguous: {low_confidence}")
print(f"  No candidates: {failed}")
print(f"  Total processed: {len(players)}")

if updates:
    if DRY_RUN:
        print(f"\n  [dry-run] Would update {len(updates)} wikidata_ids:")
        for wid, pid in updates[:20]:
            cur.execute("SELECT name FROM people WHERE id = %s", (pid,))
            row = cur.fetchone()
            print(f"    {row[0] if row else '?'} (id={pid}) → {wid}")
        if len(updates) > 20:
            print(f"    ... and {len(updates) - 20} more")
    else:
        updated = 0
        for wid, pid in updates:
            cur.execute(
                "UPDATE people SET wikidata_id = %s, updated_at = now() WHERE id = %s",
                (wid, pid)
            )
            updated += 1
        print(f"\n  Updated {updated} wikidata_ids in people table")
else:
    print("\n  No updates to apply.")

if DRY_RUN:
    print("\n(dry-run — no data was written)")

cur.close()
conn.close()
print("\nDone.")
