"""
17_wikidata_clubs.py — Enrich clubs table with Wikidata metadata.

Searches Wikidata for football clubs by name, then fetches:
  - Current league/competition (P118)
  - League pyramid level
  - Stadium name and capacity (P115)
  - Founded year (P571)
  - Short name / nickname
  - Country (P17)
  - Logo URL (P154)

Usage:
    python 17_wikidata_clubs.py --dry-run              # preview all
    python 17_wikidata_clubs.py --club 42 --dry-run    # single club
    python 17_wikidata_clubs.py                        # full run
    python 17_wikidata_clubs.py --force                # re-enrich existing
    python 17_wikidata_clubs.py --limit 50             # cap batch size
    python 17_wikidata_clubs.py --batch-sparql         # use batch SPARQL for speed

Requires migration 013_club_wikidata_columns.sql to be applied first.
"""
from __future__ import annotations

import argparse
import sys
import time
import unicodedata

import requests
import psycopg2
import psycopg2.extras

from config import POSTGRES_DSN

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Enrich clubs with Wikidata metadata")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Re-enrich clubs with existing wikidata_id")
parser.add_argument("--club", type=int, default=None, help="Single club id to enrich")
parser.add_argument("--limit", type=int, default=None, help="Max clubs to process")
parser.add_argument("--batch-sparql", action="store_true", help="Use batch SPARQL for top-league clubs")
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
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# ── Wikidata config ───────────────────────────────────────────────────────────

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
USER_AGENT = "ChiefScout/1.0 (football scouting tool; https://github.com/neutralworking/chief-scout)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


def sparql_query(query: str, retries: int = 2) -> list[dict]:
    """Execute a SPARQL query against Wikidata, with retry on rate-limit."""
    for attempt in range(retries + 1):
        try:
            resp = SESSION.get(
                WIKIDATA_SPARQL,
                params={"query": query, "format": "json"},
                timeout=60,
            )
            if resp.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json().get("results", {}).get("bindings", [])
        except requests.exceptions.Timeout:
            if attempt < retries:
                print(f"  Timeout, retrying ({attempt + 1}/{retries})...")
                time.sleep(3)
                continue
            return []
        except Exception as e:
            if VERBOSE:
                print(f"  SPARQL error: {e}")
            return []
    return []


# ── Search for a club by name ────────────────────────────────────────────────

def search_club(name: str, country: str | None = None) -> list[dict]:
    """
    Search Wikidata for a football club by name.
    Returns candidates with QID, label, country, description.
    """
    safe_name = name.replace('"', '\\"').replace("'", "\\'")

    # Build country filter if we know the nation
    country_filter = ""
    if country:
        safe_country = country.replace('"', '\\"')
        country_filter = f"""
        OPTIONAL {{ ?item wdt:P17 ?nation . ?nation rdfs:label ?nationLabel .
                    FILTER(LANG(?nationLabel) = "en") }}
        """

    query = f"""
    SELECT DISTINCT ?item ?itemLabel ?itemDescription ?countryLabel ?inception WHERE {{
      # Must be a football club (Q476028) or sports club (Q847017)
      {{ ?item wdt:P31/wdt:P279* wd:Q476028 . }}
      UNION
      {{ ?item wdt:P31/wdt:P279* wd:Q847017 .
         ?item wdt:P641 wd:Q2736 . }}

      # Name match (multi-language)
      {{
        ?item rdfs:label "{safe_name}"@en .
      }} UNION {{
        ?item skos:altLabel "{safe_name}"@en .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@de .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@es .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@fr .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@pt .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@it .
      }} UNION {{
        ?item rdfs:label "{safe_name}"@nl .
      }}

      OPTIONAL {{ ?item wdt:P17 ?country . }}
      OPTIONAL {{ ?item wdt:P571 ?inception . }}

      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,de,fr,es,pt,it,nl" . }}
    }}
    LIMIT 15
    """

    bindings = sparql_query(query)
    results = []
    seen = set()

    for b in bindings:
        uri = b.get("item", {}).get("value", "")
        qid = uri.split("/")[-1] if uri else ""
        if not qid.startswith("Q") or qid in seen:
            continue
        seen.add(qid)

        inception = b.get("inception", {}).get("value", "")[:4] if "inception" in b else None

        results.append({
            "qid": qid,
            "label": b.get("itemLabel", {}).get("value", ""),
            "description": b.get("itemDescription", {}).get("value", ""),
            "country": b.get("countryLabel", {}).get("value", ""),
            "founded": inception,
        })

    return results


def search_club_wbsearch(name: str) -> list[dict]:
    """Fallback: Wikidata API wbsearchentities."""
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
            print(f"  wbsearch error: {e}")
        return []

    results = []
    for item in data.get("search", []):
        desc = (item.get("description") or "").lower()
        if any(kw in desc for kw in ["football", "soccer", "club", "f.c.", "fc "]):
            results.append({
                "qid": item.get("id", ""),
                "label": item.get("label", ""),
                "description": item.get("description", ""),
                "country": "",
                "founded": None,
            })

    return results


# ── Fetch full club details from Wikidata ────────────────────────────────────

def fetch_club_details(qid: str) -> dict:
    """
    Given a Wikidata QID, fetch rich club metadata via SPARQL.
    Returns dict with league, stadium, capacity, founded, country, logo, short_name.
    """
    query = f"""
    SELECT ?leagueLabel ?leagueId ?leagueLevel
           ?stadiumLabel ?capacity
           ?inception
           ?countryLabel
           ?shortName
           ?logoUrl
    WHERE {{
      BIND(wd:{qid} AS ?club)

      # Current league (P118) — only most recent
      OPTIONAL {{
        ?club p:P118 ?leagueStmt .
        ?leagueStmt ps:P118 ?league .
        FILTER NOT EXISTS {{ ?leagueStmt pq:P582 ?endDate . }}
        OPTIONAL {{ ?league wdt:P31/wdt:P279* wd:Q15991303 . }}
        BIND(?league AS ?leagueId)
        OPTIONAL {{
          ?league wdt:P3450 ?ll .
        }}
        BIND(IF(BOUND(?ll), ?ll, ?_nothing) AS ?leagueLevel)
      }}

      # Stadium (P115)
      OPTIONAL {{
        ?club wdt:P115 ?stadium .
        OPTIONAL {{ ?stadium wdt:P1083 ?capacity . }}
      }}

      # Founded (P571)
      OPTIONAL {{ ?club wdt:P571 ?inception . }}

      # Country (P17)
      OPTIONAL {{ ?club wdt:P17 ?country . }}

      # Short name (P1813)
      OPTIONAL {{ ?club wdt:P1813 ?shortName . FILTER(LANG(?shortName) = "en") }}

      # Logo (P154)
      OPTIONAL {{ ?club wdt:P154 ?logoUrl . }}

      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
    }}
    LIMIT 5
    """

    bindings = sparql_query(query)
    if not bindings:
        return {}

    b = bindings[0]

    # Extract league QID
    league_id_val = b.get("leagueId", {}).get("value", "")
    league_qid = league_id_val.split("/")[-1] if league_id_val else None

    # Parse league level
    league_level = None
    ll_val = b.get("leagueLevel", {}).get("value", "")
    if ll_val:
        try:
            league_level = int(ll_val)
        except (ValueError, TypeError):
            pass

    # Parse capacity
    capacity = None
    cap_val = b.get("capacity", {}).get("value", "")
    if cap_val:
        try:
            capacity = int(float(cap_val))
        except (ValueError, TypeError):
            pass

    # Parse founded year
    founded = None
    inception_val = b.get("inception", {}).get("value", "")
    if inception_val:
        try:
            founded = int(inception_val[:4])
        except (ValueError, TypeError):
            pass

    return {
        "league_name": b.get("leagueLabel", {}).get("value") or None,
        "league_wikidata_id": league_qid,
        "league_level": league_level,
        "stadium": b.get("stadiumLabel", {}).get("value") or None,
        "stadium_capacity": capacity,
        "founded_year": founded,
        "country": b.get("countryLabel", {}).get("value") or None,
        "short_name": b.get("shortName", {}).get("value") or None,
        "logo_url": b.get("logoUrl", {}).get("value") or None,
    }


# ── Scoring ──────────────────────────────────────────────────────────────────

def score_club_match(club_name: str, club_nation: str | None, candidate: dict) -> float:
    """Score a Wikidata candidate (0.0–1.0)."""
    score = 0.0
    norm_club = normalize_name(club_name)
    norm_cand = normalize_name(candidate["label"])

    # Name match
    if norm_club == norm_cand:
        score += 0.6
    elif norm_club in norm_cand or norm_cand in norm_club:
        score += 0.35
    else:
        # Check common suffixes
        for suffix in [" fc", " f.c.", " afc", " sc", " fk", " bk", " cf"]:
            if normalize_name(club_name + suffix) == norm_cand:
                score += 0.5
                break
            if norm_club == normalize_name(candidate["label"].replace("FC", "").replace("F.C.", "")):
                score += 0.45
                break

    # Country match
    if club_nation and candidate.get("country"):
        if normalize_name(club_nation) == normalize_name(candidate["country"]):
            score += 0.3
        elif normalize_name(club_nation) in normalize_name(candidate["country"]):
            score += 0.15

    # Description contains football keywords
    desc = (candidate.get("description") or "").lower()
    if any(kw in desc for kw in ["football", "soccer", "club"]):
        score += 0.1

    return min(score, 1.0)


# ── Batch SPARQL: fetch all clubs in top European leagues ────────────────────

def batch_fetch_league_clubs() -> dict[str, dict]:
    """
    Fetch all clubs in major leagues via a single SPARQL query.
    Returns {normalized_club_name: {qid, details...}}.
    """
    print("Batch-fetching clubs from top leagues via SPARQL...")

    # Major league QIDs
    leagues = {
        "Q9448": "Premier League",
        "Q82595": "Bundesliga",
        "Q324867": "La Liga",
        "Q15804": "Serie A",
        "Q13394": "Ligue 1",
        "Q1479": "Eredivisie",
        "Q200118": "Primeira Liga",
        "Q155223": "Championship",
        "Q105186": "2. Bundesliga",
        "Q16625": "Serie B",
        "Q203425": "Ligue 2",
        "Q2122055": "La Liga 2",
        "Q207975": "Süper Lig",
        "Q19317": "MLS",
        "Q193131": "Premiership (Scotland)",
        "Q388567": "Super League (Switzerland)",
        "Q837": "Liga MX",
        "Q131325": "Brasileirão",
        "Q186515": "Superliga (Denmark)",
        "Q207920": "First Division A (Belgium)",
        "Q30991": "Bundesliga (Austria)",
    }

    all_clubs: dict[str, dict] = {}

    for league_qid, league_name in leagues.items():
        query = f"""
        SELECT ?club ?clubLabel ?stadiumLabel ?capacity ?inception
               ?countryLabel ?shortName ?logoUrl
        WHERE {{
          ?club wdt:P118 wd:{league_qid} .
          FILTER NOT EXISTS {{
            ?club p:P118 ?stmt .
            ?stmt ps:P118 wd:{league_qid} .
            ?stmt pq:P582 ?endDate .
          }}

          OPTIONAL {{
            ?club wdt:P115 ?stadium .
            OPTIONAL {{ ?stadium wdt:P1083 ?capacity . }}
          }}
          OPTIONAL {{ ?club wdt:P571 ?inception . }}
          OPTIONAL {{ ?club wdt:P17 ?country . }}
          OPTIONAL {{ ?club wdt:P1813 ?shortName . FILTER(LANG(?shortName) = "en") }}
          OPTIONAL {{ ?club wdt:P154 ?logoUrl . }}

          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
        }}
        """

        bindings = sparql_query(query)
        count = 0

        for b in bindings:
            uri = b.get("club", {}).get("value", "")
            qid = uri.split("/")[-1] if uri else ""
            if not qid.startswith("Q"):
                continue

            club_label = b.get("clubLabel", {}).get("value", "")
            norm = normalize_name(club_label)
            if not norm or norm in all_clubs:
                continue

            capacity = None
            cap_val = b.get("capacity", {}).get("value", "")
            if cap_val:
                try:
                    capacity = int(float(cap_val))
                except (ValueError, TypeError):
                    pass

            founded = None
            inc_val = b.get("inception", {}).get("value", "")
            if inc_val:
                try:
                    founded = int(inc_val[:4])
                except (ValueError, TypeError):
                    pass

            all_clubs[norm] = {
                "qid": qid,
                "label": club_label,
                "league_name": league_name,
                "league_wikidata_id": league_qid,
                "stadium": b.get("stadiumLabel", {}).get("value") or None,
                "stadium_capacity": capacity,
                "founded_year": founded,
                "country": b.get("countryLabel", {}).get("value") or None,
                "short_name": b.get("shortName", {}).get("value") or None,
                "logo_url": b.get("logoUrl", {}).get("value") or None,
            }
            count += 1

        print(f"  {league_name}: {count} clubs")
        time.sleep(1)  # Be polite to Wikidata

    print(f"  Total batch: {len(all_clubs)} unique clubs")
    return all_clubs


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    prefix = "[DRY RUN] " if DRY_RUN else ""
    print(f"{prefix}Wikidata club enrichment")

    # Load clubs to enrich
    if args.club:
        cur.execute("""
            SELECT c.id, c.name, c.wikidata_id, n.name AS nation
            FROM clubs c
            LEFT JOIN nations n ON n.id = c.nation_id
            WHERE c.id = %s
        """, (args.club,))
    else:
        where = "WHERE c.name IS NOT NULL"
        if not FORCE:
            where += " AND c.wikidata_id IS NULL"
        cur.execute(f"""
            SELECT c.id, c.name, c.wikidata_id, n.name AS nation
            FROM clubs c
            LEFT JOIN nations n ON n.id = c.nation_id
            {where}
            ORDER BY c.id
        """)

    clubs = cur.fetchall()
    total = len(clubs)

    if args.limit and not args.club:
        clubs = clubs[:args.limit]

    print(f"  {total} candidates, processing {len(clubs)}")

    if not clubs:
        print("Nothing to enrich.")
        cur.close()
        conn.close()
        return

    # ── Phase 1: Batch SPARQL (optional, fast) ───────────────────────────────

    batch_data: dict[str, dict] = {}
    if args.batch_sparql:
        batch_data = batch_fetch_league_clubs()

    # ── Phase 2: Per-club enrichment ─────────────────────────────────────────

    matched = 0
    skipped = 0
    failed = 0
    low_confidence = 0
    updates: list[tuple[dict, int]] = []  # (details_dict, club_id)

    CONFIDENCE_THRESHOLD = 0.55

    for i, club in enumerate(clubs):
        cid = club["id"]
        name = club["name"]
        nation = club["nation"]
        norm_name = normalize_name(name)

        if VERBOSE or args.club:
            print(f"\n[{i+1}/{len(clubs)}] {name} (id={cid}, nation={nation})")
        elif (i + 1) % 25 == 0:
            print(f"  {i+1}/{len(clubs)} processed ({matched} matched)...", flush=True)

        # Try batch data first
        if norm_name in batch_data:
            bd = batch_data[norm_name]
            matched += 1
            details = {
                "wikidata_id": bd["qid"],
                "league_name": bd["league_name"],
                "league_wikidata_id": bd["league_wikidata_id"],
                "stadium": bd["stadium"],
                "stadium_capacity": bd["stadium_capacity"],
                "founded_year": bd["founded_year"],
                "country": bd["country"],
                "short_name": bd["short_name"],
                "logo_url": bd["logo_url"],
            }
            updates.append((details, cid))
            if VERBOSE:
                print(f"  → batch match: {bd['qid']} ({bd['league_name']})")
            continue

        # Also try common name variations against batch
        found_batch = False
        for suffix in [" FC", " F.C.", " AFC", " SC", ""]:
            alt = normalize_name(name + suffix)
            if alt in batch_data:
                bd = batch_data[alt]
                matched += 1
                details = {
                    "wikidata_id": bd["qid"],
                    "league_name": bd["league_name"],
                    "league_wikidata_id": bd["league_wikidata_id"],
                    "stadium": bd["stadium"],
                    "stadium_capacity": bd["stadium_capacity"],
                    "founded_year": bd["founded_year"],
                    "country": bd["country"],
                    "short_name": bd["short_name"],
                    "logo_url": bd["logo_url"],
                }
                updates.append((details, cid))
                if VERBOSE:
                    print(f"  → batch match (alt): {bd['qid']} ({bd['league_name']})")
                found_batch = True
                break
        if found_batch:
            continue

        # SPARQL search for this club
        candidates = search_club(name, nation)

        # Fallback to wbsearch
        if not candidates:
            candidates = search_club_wbsearch(name)

        if not candidates:
            if VERBOSE or args.club:
                print(f"  No candidates found")
            failed += 1
            continue

        # Score candidates
        scored = [(score_club_match(name, nation, c), c) for c in candidates]
        scored.sort(key=lambda x: -x[0])
        best_score, best = scored[0]

        if VERBOSE or args.club:
            for s, c in scored[:3]:
                print(f"  {c['qid']} ({s:.2f}): {c['label']} — {c.get('country', '?')} — {c.get('description', '')}")

        if best_score < CONFIDENCE_THRESHOLD:
            if VERBOSE or args.club:
                print(f"  Best score {best_score:.2f} below threshold {CONFIDENCE_THRESHOLD}")
            low_confidence += 1
            continue

        # Fetch full details for the matched club
        details = fetch_club_details(best["qid"])
        details["wikidata_id"] = best["qid"]
        if not details.get("country") and best.get("country"):
            details["country"] = best["country"]
        if not details.get("founded_year") and best.get("founded"):
            try:
                details["founded_year"] = int(best["founded"])
            except (ValueError, TypeError):
                pass

        matched += 1
        updates.append((details, cid))

        if VERBOSE or args.club:
            league = details.get("league_name") or "?"
            stadium = details.get("stadium") or "?"
            print(f"  → {best['qid']} ({best_score:.2f}) league={league}, stadium={stadium}")

        # Rate-limit
        if not args.club:
            time.sleep(0.7)

    # ── Write results ─────────────────────────────────────────────────────────

    print(f"\n── Results ──")
    print(f"  Matched:    {matched}")
    print(f"  Low conf:   {low_confidence}")
    print(f"  No results: {failed}")
    print(f"  Processed:  {len(clubs)}")

    if updates:
        if DRY_RUN:
            print(f"\n  [dry-run] Would update {len(updates)} clubs:")
            for details, cid in updates[:30]:
                cur.execute("SELECT name FROM clubs WHERE id = %s", (cid,))
                row = cur.fetchone()
                league = details.get("league_name") or "—"
                stadium = details.get("stadium") or "—"
                print(f"    {row['name'] if row else '?':35s} → {details['wikidata_id']}  {league:25s}  {stadium}")
            if len(updates) > 30:
                print(f"    ... and {len(updates) - 30} more")
        else:
            updated = 0
            for details, cid in updates:
                cur.execute("""
                    UPDATE clubs SET
                        wikidata_id        = COALESCE(%s, wikidata_id),
                        league_name        = COALESCE(%s, league_name),
                        league_wikidata_id = COALESCE(%s, league_wikidata_id),
                        league_level       = COALESCE(%s, league_level),
                        stadium            = COALESCE(%s, stadium),
                        stadium_capacity   = COALESCE(%s, stadium_capacity),
                        founded_year       = COALESCE(%s, founded_year),
                        country            = COALESCE(%s, country),
                        short_name         = COALESCE(%s, short_name),
                        logo_url           = COALESCE(%s, logo_url)
                    WHERE id = %s
                """, (
                    details.get("wikidata_id"),
                    details.get("league_name"),
                    details.get("league_wikidata_id"),
                    details.get("league_level"),
                    details.get("stadium"),
                    details.get("stadium_capacity"),
                    details.get("founded_year"),
                    details.get("country"),
                    details.get("short_name"),
                    details.get("logo_url"),
                    cid,
                ))
                updated += 1
            print(f"\n  Updated {updated} clubs")
    else:
        print("\n  No updates to apply.")

    if DRY_RUN:
        print("\n(dry-run — no data was written)")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
