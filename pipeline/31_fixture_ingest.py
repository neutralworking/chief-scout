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
import sys
import time
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

def load_clubs():
    """Load all clubs from Supabase for name matching."""
    result = sb.table("clubs").select("id, clubname, short_name").execute()
    clubs = {}
    for row in result.data or []:
        name = (row.get("clubname") or "").strip().lower()
        short = (row.get("short_name") or "").strip().lower()
        if name:
            clubs[name] = row["id"]
        if short:
            clubs[short] = row["id"]
    return clubs

def normalize_team_name(name: str) -> str:
    """Normalize team name for matching."""
    n = name.lower().strip()
    # Common suffixes/prefixes to strip
    for suffix in [" fc", " cf", " sc", " ac", " ss"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)].strip()
    # Common mappings
    ALIASES = {
        "wolverhampton wanderers": "wolves",
        "west ham united": "west ham",
        "tottenham hotspur": "tottenham",
        "newcastle united": "newcastle",
        "nottingham forest": "nott'm forest",
        "leicester city": "leicester",
        "manchester city": "man city",
        "manchester united": "man united",
        "brighton & hove albion": "brighton",
        "afc bournemouth": "bournemouth",
        "crystal palace": "crystal palace",
        "atlético de madrid": "atletico madrid",
        "atletico de madrid": "atletico madrid",
        "real sociedad de fútbol": "real sociedad",
        "rc celta de vigo": "celta vigo",
        "rcd espanyol de barcelona": "espanyol",
        "deportivo alavés": "alaves",
        "ca osasuna": "osasuna",
        "borussia dortmund": "dortmund",
        "borussia mönchengladbach": "monchengladbach",
        "bayer 04 leverkusen": "bayer leverkusen",
        "rb leipzig": "rb leipzig",
        "eintracht frankfurt": "eintracht frankfurt",
        "1. fc union berlin": "union berlin",
        "vfb stuttgart": "stuttgart",
        "vfl wolfsburg": "wolfsburg",
        "sc freiburg": "freiburg",
        "fc augsburg": "augsburg",
        "1. fsv mainz 05": "mainz",
        "1899 hoffenheim": "hoffenheim",
        "vfl bochum 1848": "bochum",
        "fc bayern münchen": "bayern munich",
        "as roma": "roma",
        "ssc napoli": "napoli",
        "inter milan": "inter",
        "ac milan": "milan",
        "atalanta bc": "atalanta",
        "paris saint-germain": "psg",
        "olympique de marseille": "marseille",
        "olympique lyonnais": "lyon",
        "as monaco": "monaco",
        "stade rennais": "rennes",
        "rc lens": "lens",
        "losc lille": "lille",
    }
    return ALIASES.get(n, n)

def match_club(team_name: str, club_lookup: dict) -> int | None:
    """Try to match a football-data.org team name to a clubs.id."""
    normalized = normalize_team_name(team_name)
    # Direct match
    if normalized in club_lookup:
        return club_lookup[normalized]
    # Try the raw lowercase name
    raw = team_name.lower().strip()
    if raw in club_lookup:
        return club_lookup[raw]
    # Partial match — if the normalized name is contained in a club name
    for club_name, club_id in club_lookup.items():
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
