"""
31_fixture_ingest.py — Fetch upcoming fixtures from football-data.org and push to Supabase.

Usage:
    python 31_fixture_ingest.py
    python 31_fixture_ingest.py --competition PL       # one competition only
    python 31_fixture_ingest.py --matchday 29           # specific matchday
    python 31_fixture_ingest.py --dry-run               # preview only, no writes
    python 31_fixture_ingest.py --force                 # re-sync existing fixtures

Requires FOOTBALL_DATA_API_KEY in .env / .env.local
Free tier: 10 requests/minute — built-in throttle.
"""
import argparse
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone

import requests
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest fixtures from football-data.org")
parser.add_argument("--competition", default=None,
                    help="Single competition code (e.g. PL, PD, BL1, SA, FL1)")
parser.add_argument("--matchday", type=int, default=None,
                    help="Specific matchday number")
parser.add_argument("--status", default="SCHEDULED",
                    help="Match status filter (SCHEDULED, LIVE, FINISHED, etc.)")
parser.add_argument("--dry-run", action="store_true",
                    help="Print results without inserting")
parser.add_argument("--force", action="store_true",
                    help="Re-sync even if fixture already exists")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

# Top 5 European leagues
COMPETITIONS = {
    "PL":  "Premier League",
    "PD":  "La Liga",
    "BL1": "Bundesliga",
    "SA":  "Serie A",
    "FL1": "Ligue 1",
}

if args.competition:
    if args.competition not in COMPETITIONS:
        print(f"ERROR: Unknown competition '{args.competition}'. Valid: {list(COMPETITIONS.keys())}")
        sys.exit(1)
    COMPETITIONS = {args.competition: COMPETITIONS[args.competition]}

# ── API key ────────────────────────────────────────────────────────────────────

import os
FOOTBALL_DATA_API_KEY = os.environ.get("FOOTBALL_DATA_API_KEY", "")
if not FOOTBALL_DATA_API_KEY:
    # Try .env.local at repo root
    from pathlib import Path
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("FOOTBALL_DATA_API_KEY="):
                FOOTBALL_DATA_API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not FOOTBALL_DATA_API_KEY:
    print("ERROR: Set FOOTBALL_DATA_API_KEY in .env or .env.local")
    print("Get a free key at https://www.football-data.org/client/register")
    sys.exit(1)

# ── Supabase client ────────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Club name matching ─────────────────────────────────────────────────────────

def _strip_suffixes(name: str) -> str:
    """Strip common club suffixes/prefixes and normalize unicode for comparison."""
    n = name.lower().strip()
    # Normalize unicode (é→e, ü→u, etc.) for consistent matching
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode("ascii")
    # Strip trailing year tags like "FC 1909", "1848", "1901", "1907", "1913"
    n = re.sub(r"\s+\d{4}\s*$", "", n).strip()
    # Strip common suffixes
    for suffix in [" fc", " cf", " sc", " ac", " ss", " bc", " cfc",
                   " wfc", " w.f.c", " w.f.c.", " calcio"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)].strip()
    # Strip common prefixes (only short known ones to avoid over-stripping)
    for prefix in ["fc ", "ac ", "as ", "ssc ", "ss ", "sc ", "rc ", "afc ",
                    "rcd ", "acf ", "us ", "ud ", "cd ", "ca ", "sv ", "aj ",
                    "club "]:
        if n.startswith(prefix):
            n = n[len(prefix):].strip()
    return n


# Maps football-data.org names (after suffix-stripping) → DB clubname (lowercased).
# Only needed when the API name fundamentally differs from the DB name.
ALIASES = {
    # Premier League — API names after _strip_suffixes → DB clubname (lowercased)
    "brighton & hove albion": "brighton",
    "brighton and hove albion": "brighton",
    # La Liga
    "atletico de madrid": "atletico madrid",
    "real sociedad de futbol": "real sociedad",
    "celta de vigo": "celta vigo",
    "espanyol de barcelona": "espanyol",
    "deportivo alaves": "alaves",
    "real betis balompie": "real betis",
    "las palmas": "las palmas",
    "rayo vallecano de madrid": "rayo vallecano",
    "ca osasuna": "osasuna",
    # Bundesliga
    "bayer 04 leverkusen": "bayer leverkusen",
    "1. fc union berlin": "union berlin",
    "1. fc heidenheim": "heidenheim",
    "1. fsv mainz 05": "mainz 05",
    "1899 hoffenheim": "tsg hoffenheim",
    "vfb stuttgart": "stuttgart",
    "bayern munchen": "bayern munich",
    "werder bremen": "werder bremen",
    # Serie A
    "internazionale milano": "inter",
    "inter milan": "inter",
    "parma calcio": "parma",
    # Ligue 1
    "paris saint-germain": "paris st. germain",
    "paris saint germain": "paris st. germain",
    "olympique de marseille": "marseille",
    "olympique lyonnais": "lyon",
    "olympique marseille": "marseille",
    "stade rennais": "rennes",
    "stade brestois": "stade brestois",
    "losc lille": "lille",
    "montpellier hsc": "hsc montpellier",
    "stade de reims": "reims",
    "saint-etienne": "saint-etienne",
    "strasbourg alsace": "strasbourg",
    "clermont foot": "clermont foot",
    "angers sco": "angers",
}


def load_clubs():
    """Load all clubs from Supabase for name matching.

    Builds a lookup dict keyed on multiple normalized variants of each club name,
    so both API-side and DB-side names can be matched after normalization.
    Paginates to fetch all rows (Supabase default limit is 1000).
    """
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        result = (
            sb.table("clubs")
            .select("id, clubname, short_name")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    clubs = {}
    # Two passes: first non-women's clubs, then women's (so men's teams take priority
    # on colliding stripped keys like "liverpool" from both "Liverpool" and "Liverpool WFC").
    women_suffixes = ("wfc", "women", "w.f.c", "w.f.c.", "femeni", "feminin", "femenino")
    for row in all_rows:
        cid = row["id"]
        cname = (row.get("clubname") or "").strip().lower()
        if any(cname.endswith(s) for s in women_suffixes):
            continue
        for field in ("clubname", "short_name"):
            raw = (row.get(field) or "").strip()
            if not raw:
                continue
            # Raw lowercase — always store (last writer wins, but exact names are unique)
            clubs[raw.lower()] = cid
            # Stripped version — first writer wins to prefer canonical entries
            # (e.g. "Barcelona" id=411 before "Barcelona SC" id=413)
            stripped = _strip_suffixes(raw)
            if stripped and stripped not in clubs:
                clubs[stripped] = cid
    # Second pass: women's clubs (only fill in keys not already taken)
    for row in all_rows:
        cid = row["id"]
        cname = (row.get("clubname") or "").strip().lower()
        if not any(cname.endswith(s) for s in women_suffixes):
            continue
        for field in ("clubname", "short_name"):
            raw = (row.get(field) or "").strip()
            if not raw:
                continue
            key = raw.lower()
            if key not in clubs:
                clubs[key] = cid
            stripped = _strip_suffixes(raw)
            if stripped and stripped not in clubs:
                clubs[stripped] = cid
    return clubs


def normalize_team_name(name: str) -> str:
    """Normalize a football-data.org team name for matching."""
    n = _strip_suffixes(name)
    return ALIASES.get(n, n)


def match_club(team_name: str, club_lookup: dict) -> int | None:
    """Try to match a football-data.org team name to a clubs.id."""
    normalized = normalize_team_name(team_name)
    # Direct match on normalized name
    if normalized in club_lookup:
        return club_lookup[normalized]
    # Try the raw lowercase name
    raw = team_name.lower().strip()
    if raw in club_lookup:
        return club_lookup[raw]
    # Try suffix-stripped version of raw name (without alias lookup)
    stripped = _strip_suffixes(team_name)
    if stripped in club_lookup:
        return club_lookup[stripped]
    # Partial match — if the normalized name is contained in a club name or vice versa
    # Both sides must be at least 4 chars to avoid spurious matches (e.g. "Ba" in "Bayer")
    for club_name, club_id in club_lookup.items():
        if len(normalized) >= 4 and len(club_name) >= 4:
            if normalized in club_name or club_name in normalized:
                return club_id
    return None

# ── Fetch fixtures ─────────────────────────────────────────────────────────────

API_BASE = "https://api.football-data.org/v4"
HEADERS = {"X-Auth-Token": FOOTBALL_DATA_API_KEY}
REQUEST_DELAY = 6.5  # ~10 req/min limit

def fetch_matches(competition_code: str, status: str = "SCHEDULED", matchday: int | None = None) -> list:
    """Fetch matches from football-data.org."""
    url = f"{API_BASE}/competitions/{competition_code}/matches"
    params = {}
    if status:
        params["status"] = status
    if matchday:
        params["matchday"] = str(matchday)

    resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
    if resp.status_code == 429:
        print("  Rate limited — waiting 60s...")
        time.sleep(60)
        resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
    if resp.status_code != 200:
        print(f"  ERROR: {resp.status_code} — {resp.text[:200]}")
        return []

    data = resp.json()
    return data.get("matches", [])

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    club_lookup = load_clubs()
    print(f"Loaded {len(club_lookup)} club name variants for matching\n")

    total_inserted = 0
    total_updated = 0
    total_skipped = 0
    unmatched_teams = set()

    for comp_code, comp_name in COMPETITIONS.items():
        print(f"── {comp_name} ({comp_code}) ──")
        matches = fetch_matches(comp_code, status=args.status, matchday=args.matchday)
        print(f"  Fetched {len(matches)} matches")

        for match in matches:
            external_id = match["id"]
            home_name = match["homeTeam"]["name"]
            away_name = match["awayTeam"]["name"]
            home_club_id = match_club(home_name, club_lookup)
            away_club_id = match_club(away_name, club_lookup)

            if not home_club_id:
                unmatched_teams.add(home_name)
            if not away_club_id:
                unmatched_teams.add(away_name)

            utc_date = match.get("utcDate")
            venue = match.get("venue")
            matchday_num = match.get("matchday")
            status = match.get("status", "SCHEDULED")
            home_score = match.get("score", {}).get("fullTime", {}).get("home")
            away_score = match.get("score", {}).get("fullTime", {}).get("away")

            row = {
                "external_id": external_id,
                "competition": comp_name,
                "competition_code": comp_code,
                "matchday": matchday_num,
                "status": status,
                "utc_date": utc_date,
                "home_club_id": home_club_id,
                "away_club_id": away_club_id,
                "home_team": home_name,
                "away_team": away_name,
                "home_score": home_score,
                "away_score": away_score,
                "venue": venue,
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }

            if DRY_RUN:
                home_match = f"✓ ({home_club_id})" if home_club_id else "✗"
                away_match = f"✓ ({away_club_id})" if away_club_id else "✗"
                print(f"  {home_name} {home_match} vs {away_name} {away_match} | MD{matchday_num} | {utc_date}")
                total_skipped += 1
                continue

            # Upsert by external_id
            try:
                existing = sb.table("fixtures").select("id").eq("external_id", external_id).execute()
                if existing.data and not FORCE:
                    total_skipped += 1
                    continue
                elif existing.data:
                    sb.table("fixtures").update(row).eq("external_id", external_id).execute()
                    total_updated += 1
                else:
                    sb.table("fixtures").insert(row).execute()
                    total_inserted += 1
            except Exception as e:
                print(f"  ERROR inserting {home_name} vs {away_name}: {e}")

        # Rate limit between competitions
        if len(COMPETITIONS) > 1:
            time.sleep(REQUEST_DELAY)

    print(f"\n── Summary ──")
    print(f"  Inserted: {total_inserted}")
    print(f"  Updated:  {total_updated}")
    print(f"  Skipped:  {total_skipped}")
    if unmatched_teams:
        print(f"\n  ⚠ Unmatched teams ({len(unmatched_teams)}):")
        for t in sorted(unmatched_teams):
            print(f"    - {t}")

if __name__ == "__main__":
    main()
