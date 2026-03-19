"""
65_api_football_ingest.py — Fetch player stats from API-Football and push to Supabase.

API-Football (api-sports.io) provides per-season stats for 900+ leagues:
goals, assists, shots, passes, tackles, duels, dribbles, cards, ratings.

Usage:
    python 65_api_football_ingest.py                      # top 5 leagues, current season
    python 65_api_football_ingest.py --league 39          # Premier League only
    python 65_api_football_ingest.py --season 2025        # specific season
    python 65_api_football_ingest.py --all-leagues        # all configured leagues
    python 65_api_football_ingest.py --dry-run            # preview without writing
    python 65_api_football_ingest.py --force              # re-fetch even if data exists
    python 65_api_football_ingest.py --match-only         # skip fetch, just match players
"""

import argparse
import math
import os
import sys
import time
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.dirname(__file__))
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, API_FOOTBALL_KEY
API_BASE = "https://v3.football.api-sports.io"
RATE_LIMIT_DELAY = 6.5  # seconds between requests (10 req/min on Pro)

# League IDs: https://www.api-football.com/documentation-v3#tag/Leagues
LEAGUES = {
    39:  "Premier League",
    140: "La Liga",
    78:  "Bundesliga",
    135: "Serie A",
    61:  "Ligue 1",
    # Extended coverage
    88:  "Eredivisie",
    94:  "Primeira Liga",
    40:  "Championship",
    203: "Super Lig",
    144: "Jupiler Pro League",
}

TOP_5_IDS = {39, 140, 78, 135, 61}

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest API-Football player stats")
parser.add_argument("--league", type=int, default=None, help="Single league ID (e.g. 39)")
parser.add_argument("--season", default="2025", help="Season year (default: 2025)")
parser.add_argument("--all-leagues", action="store_true", help="Fetch all configured leagues")
parser.add_argument("--dry-run", action="store_true", help="Preview counts, no writes")
parser.add_argument("--force", action="store_true", help="Re-fetch even if data exists")
parser.add_argument("--match-only", action="store_true", help="Skip fetch, just run player matching")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

# ── Helpers ───────────────────────────────────────────────────────────────────


def _safe_int(val):
    if val is None:
        return 0
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0


def _safe_float(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 2)
    except (TypeError, ValueError):
        return None


def api_get(endpoint: str, params: dict) -> dict:
    """Make an API-Football request with rate limiting."""
    headers = {"x-apisports-key": API_FOOTBALL_KEY}
    url = f"{API_BASE}/{endpoint}"
    resp = requests.get(url, headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    # Check for API errors
    errors = data.get("errors", {})
    if errors:
        print(f"  API error: {errors}")
        return {"response": []}

    remaining = int(resp.headers.get("x-ratelimit-requests-remaining", 100))
    if remaining < 5:
        print(f"  Rate limit low ({remaining} remaining), pausing...")
        time.sleep(RATE_LIMIT_DELAY * 2)
    else:
        time.sleep(RATE_LIMIT_DELAY)

    return data


def fetch_league_players(league_id: int, season: str) -> list[dict]:
    """Fetch all player stats for a league/season, handling pagination."""
    all_players = []
    page = 1

    while True:
        print(f"  Page {page}...", end=" ", flush=True)
        data = api_get("players", {
            "league": league_id,
            "season": season,
            "page": page,
        })

        paging = data.get("paging", {})
        results = data.get("response", [])
        print(f"{len(results)} players", flush=True)

        all_players.extend(results)

        if page >= paging.get("total", 1):
            break
        page += 1

    return all_players


def parse_player_stats(raw: dict, league_id: int, season: str) -> dict | None:
    """Parse API-Football player response into a flat row."""
    player = raw.get("player", {})
    if not player.get("id"):
        return None

    # API returns list of statistics per team — take the one matching our league
    stats_list = raw.get("statistics", [])
    stats = None
    for s in stats_list:
        if s.get("league", {}).get("id") == league_id:
            stats = s
            break

    if not stats:
        # Fallback: take first entry
        stats = stats_list[0] if stats_list else {}

    games = stats.get("games", {})
    shots = stats.get("shots", {})
    goals_data = stats.get("goals", {})
    passes = stats.get("passes", {})
    tackles = stats.get("tackles", {})
    duels = stats.get("duels", {})
    dribbles = stats.get("dribbles", {})
    fouls = stats.get("fouls", {})
    cards = stats.get("cards", {})
    penalty = stats.get("penalty", {})
    league = stats.get("league", {})
    team = stats.get("team", {})

    minutes = _safe_int(games.get("minutes"))
    appearances = _safe_int(games.get("appearences"))  # sic — API typo

    # Skip players with 0 minutes
    if minutes < 1:
        return None

    return {
        "api_football_id": player["id"],
        "name": player.get("name", ""),
        "season": season,
        "league_id": league_id,
        "league_name": league.get("name") or LEAGUES.get(league_id, ""),
        "team_name": team.get("name", ""),
        "appearances": appearances,
        "minutes": minutes,
        "rating": _safe_float(games.get("rating")),
        "goals": _safe_int(goals_data.get("total")),
        "assists": _safe_int(goals_data.get("assists")),
        "shots_total": _safe_int(shots.get("total")),
        "shots_on": _safe_int(shots.get("on")),
        "passes_total": _safe_int(passes.get("total")),
        "passes_key": _safe_int(passes.get("key")),
        "passes_accuracy": _safe_float(passes.get("accuracy")),
        "tackles_total": _safe_int(tackles.get("total")),
        "blocks": _safe_int(tackles.get("blocks")),
        "interceptions": _safe_int(tackles.get("interceptions")),
        "duels_total": _safe_int(duels.get("total")),
        "duels_won": _safe_int(duels.get("won")),
        "dribbles_attempted": _safe_int(dribbles.get("attempts")),
        "dribbles_success": _safe_int(dribbles.get("success")),
        "fouls_drawn": _safe_int(fouls.get("drawn")),
        "fouls_committed": _safe_int(fouls.get("committed")),
        "cards_yellow": _safe_int(cards.get("yellow")),
        "cards_red": _safe_int(cards.get("red")),
        "penalties_scored": _safe_int(penalty.get("scored")),
        "penalties_missed": _safe_int(penalty.get("missed")),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Player matching ──────────────────────────────────────────────────────────

def match_players(conn):
    """Link api_football_player_stats.person_id via name matching to people table."""
    import html
    import re
    import unicodedata

    def normalize(name: str) -> str:
        name = html.unescape(name)
        name = unicodedata.normalize("NFKD", name)
        name = "".join(c for c in name if not unicodedata.combining(c))
        name = name.lower().strip()
        name = re.sub(r"\s+", " ", name)
        name = re.sub(r"\s+(jr\.?|sr\.?|ii|iii|iv)$", "", name)
        return name

    cur = conn.cursor()

    # Get all unmatched API-Football players (name lives in api_football_players)
    cur.execute("""
        SELECT DISTINCT s.api_football_id, p.name, s.team_name
        FROM api_football_player_stats s
        JOIN api_football_players p ON p.api_football_id = s.api_football_id
        WHERE s.person_id IS NULL
    """)
    unmatched = cur.fetchall()
    print(f"\nPlayer matching: {len(unmatched)} unmatched API-Football players")

    # Load existing links
    cur.execute("SELECT external_id FROM player_id_links WHERE source = 'api_football'")
    already_linked = {r[0] for r in cur.fetchall()}

    # Load people lookup — multiple indices for different matching strategies
    cur.execute("SELECT id, name FROM people WHERE active = true")
    people_rows = cur.fetchall()

    people_by_norm = {}       # normalized full name → [(id, name)]
    people_by_last = {}       # last name → [(id, name)]
    people_by_initial = {}    # "x. lastname" → [(id, name)]

    for pid, pname in people_rows:
        norm = normalize(pname)
        people_by_norm.setdefault(norm, []).append((pid, pname))

        parts = norm.split()
        if len(parts) >= 2:
            last = parts[-1]
            people_by_last.setdefault(last, []).append((pid, pname))
            # Build "f. lastname" key for initial matching (API-Football format)
            initial_key = f"{parts[0][0]}. {last}"
            people_by_initial.setdefault(initial_key, []).append((pid, pname))
            # Multi-word surname: "v. van dijk" from "virgil van dijk"
            if len(parts) >= 3:
                surname = " ".join(parts[1:])
                multi_key = f"{parts[0][0]}. {surname}"
                people_by_initial.setdefault(multi_key, []).append((pid, pname))

    # Load club mapping for disambiguation
    cur.execute("""
        SELECT p.id, c.clubname FROM people p
        JOIN clubs c ON c.id = p.club_id
        WHERE p.active = true AND p.club_id IS NOT NULL
    """)
    people_club = {r[0]: normalize(r[1]) for r in cur.fetchall()}

    def normalize_club(api_team: str) -> str:
        """Normalize API-Football team names for comparison."""
        n = normalize(api_team)
        # Common substitutions
        for full, short in [("manchester united", "man utd"), ("manchester city", "man city"),
                            ("tottenham hotspur", "tottenham"), ("wolverhampton wanderers", "wolves"),
                            ("nottingham forest", "nott forest"), ("newcastle united", "newcastle"),
                            ("west ham united", "west ham"), ("leicester city", "leicester"),
                            ("crystal palace", "crystal palace"), ("aston villa", "aston villa")]:
            if n == full or n == short:
                return full  # standardize to full
        return n

    matched_exact = 0
    matched_initial = 0
    matched_last_club = 0
    links_to_insert = []
    stats_to_update = []

    for af_id, af_name, team_name in unmatched:
        if str(af_id) in already_linked:
            continue

        norm_name = normalize(af_name)
        person_id = None
        method = None

        # Strategy 1: Exact normalized name
        candidates = people_by_norm.get(norm_name, [])
        if len(candidates) == 1:
            person_id = candidates[0][0]
            method = "exact"
            matched_exact += 1

        # Strategy 2: Initial + last name (e.g., "D. Rice" → "d. rice" matches "declan rice")
        if not person_id and "." in norm_name:
            candidates = people_by_initial.get(norm_name, [])
            if len(candidates) == 1:
                person_id = candidates[0][0]
                method = "initial"
                matched_initial += 1
            elif len(candidates) > 1 and team_name:
                # Disambiguate by club
                norm_team = normalize_club(team_name)
                club_matches = [pid for pid, _ in candidates
                                if norm_team in people_club.get(pid, "")]
                if len(club_matches) == 1:
                    person_id = club_matches[0]
                    method = "initial_club"
                    matched_initial += 1

        # Strategy 3: Last name only + club disambiguation (single-name players like "Thiago")
        if not person_id and " " not in norm_name and team_name:
            candidates = people_by_last.get(norm_name, [])
            if not candidates:
                # Try as full name match (mononyms)
                candidates = people_by_norm.get(norm_name, [])
            if len(candidates) == 1:
                person_id = candidates[0][0]
                method = "mononym"
                matched_last_club += 1
            elif len(candidates) > 1:
                norm_team = normalize_club(team_name)
                club_matches = [pid for pid, _ in candidates
                                if norm_team in people_club.get(pid, "")]
                if len(club_matches) == 1:
                    person_id = club_matches[0]
                    method = "mononym_club"
                    matched_last_club += 1

        if person_id:
            links_to_insert.append((person_id, "api_football", str(af_id), af_name, method, 0.9 if method == "exact" else 0.8))
            stats_to_update.append((person_id, af_id))

    total_matched = matched_exact + matched_initial + matched_last_club
    print(f"  Matched: {total_matched} total")
    print(f"    Exact name: {matched_exact}")
    print(f"    Initial + last: {matched_initial}")
    print(f"    Mononym/last + club: {matched_last_club}")
    print(f"  Unmatched: {len(unmatched) - total_matched}")

    if DRY_RUN:
        print("  [dry-run] Would insert links and update person_ids")
        return matched

    if links_to_insert:
        from psycopg2.extras import execute_values
        execute_values(cur, """
            INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
            VALUES %s
            ON CONFLICT (source, external_id) DO NOTHING
        """, links_to_insert)

    if stats_to_update:
        from psycopg2.extras import execute_batch
        execute_batch(cur, """
            UPDATE api_football_player_stats SET person_id = %s WHERE api_football_id = %s
        """, stats_to_update)

        # Also update the players table
        execute_batch(cur, """
            UPDATE api_football_players SET person_id = %s WHERE api_football_id = %s
        """, stats_to_update)

    conn.commit()
    return total_matched


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not API_FOOTBALL_KEY:
        print("ERROR: API_FOOTBALL_KEY not set in .env.local")
        sys.exit(1)

    from lib.db import require_conn, get_supabase

    conn = require_conn()
    cur = conn.cursor()

    # Ensure tables exist
    sql_path = os.path.join(os.path.dirname(__file__), "sql", "034_api_football.sql")
    if os.path.exists(sql_path):
        with open(sql_path) as f:
            cur.execute(f.read())
        conn.commit()

    if args.match_only:
        match_players(conn)
        conn.close()
        return

    # Determine leagues
    if args.league:
        league_ids = [args.league]
    elif args.all_leagues:
        league_ids = list(LEAGUES.keys())
    else:
        league_ids = list(TOP_5_IDS)

    season = args.season
    total_inserted = 0
    total_players_registered = 0

    print(f"API-Football ingest — season {season}, {len(league_ids)} leagues")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    print()

    for league_id in league_ids:
        league_name = LEAGUES.get(league_id, f"League {league_id}")
        print(f"── {league_name} (ID: {league_id}) ──")

        # Check if we already have data for this league/season
        if not FORCE:
            cur.execute("""
                SELECT COUNT(*) FROM api_football_player_stats
                WHERE league_id = %s AND season = %s
            """, (league_id, season))
            existing = cur.fetchone()[0]
            if existing > 0:
                print(f"  Already have {existing} rows. Use --force to re-fetch.")
                continue

        # Fetch from API
        raw_players = fetch_league_players(league_id, season)
        print(f"  Fetched {len(raw_players)} raw player entries")

        # Parse
        rows = []
        player_registry = []
        for raw in raw_players:
            parsed = parse_player_stats(raw, league_id, season)
            if parsed:
                rows.append(parsed)
                player_info = raw.get("player", {})
                player_registry.append({
                    "api_football_id": player_info.get("id"),
                    "name": player_info.get("name", ""),
                })

        print(f"  Parsed {len(rows)} valid stat rows (min 1 minute)")

        if DRY_RUN:
            print(f"  [dry-run] Would upsert {len(rows)} rows")
            total_inserted += len(rows)
            continue

        # Delete existing data for this league/season if forcing
        if FORCE:
            cur.execute("""
                DELETE FROM api_football_player_stats
                WHERE league_id = %s AND season = %s
            """, (league_id, season))
            conn.commit()

        # Insert player registry
        if player_registry:
            from psycopg2.extras import execute_values
            execute_values(cur, """
                INSERT INTO api_football_players (api_football_id, name)
                VALUES %s
                ON CONFLICT (api_football_id) DO UPDATE SET name = EXCLUDED.name
            """, [(p["api_football_id"], p["name"]) for p in player_registry])
            total_players_registered += len(player_registry)

        # Insert stats
        if rows:
            from psycopg2.extras import execute_values
            cols = [
                "api_football_id", "season", "league_id", "league_name", "team_name",
                "appearances", "minutes", "rating",
                "goals", "assists", "shots_total", "shots_on",
                "passes_total", "passes_key", "passes_accuracy",
                "tackles_total", "blocks", "interceptions",
                "duels_total", "duels_won",
                "dribbles_attempted", "dribbles_success",
                "fouls_drawn", "fouls_committed",
                "cards_yellow", "cards_red",
                "penalties_scored", "penalties_missed",
                "fetched_at",
            ]
            values = [tuple(row[c] for c in cols) for row in rows]
            placeholders = ",".join(["%s"] * len(cols))
            execute_values(cur, f"""
                INSERT INTO api_football_player_stats ({",".join(cols)})
                VALUES %s
                ON CONFLICT (api_football_id, season, league_id) DO UPDATE SET
                    appearances = EXCLUDED.appearances,
                    minutes = EXCLUDED.minutes,
                    rating = EXCLUDED.rating,
                    goals = EXCLUDED.goals,
                    assists = EXCLUDED.assists,
                    shots_total = EXCLUDED.shots_total,
                    shots_on = EXCLUDED.shots_on,
                    passes_total = EXCLUDED.passes_total,
                    passes_key = EXCLUDED.passes_key,
                    passes_accuracy = EXCLUDED.passes_accuracy,
                    tackles_total = EXCLUDED.tackles_total,
                    blocks = EXCLUDED.blocks,
                    interceptions = EXCLUDED.interceptions,
                    duels_total = EXCLUDED.duels_total,
                    duels_won = EXCLUDED.duels_won,
                    dribbles_attempted = EXCLUDED.dribbles_attempted,
                    dribbles_success = EXCLUDED.dribbles_success,
                    fouls_drawn = EXCLUDED.fouls_drawn,
                    fouls_committed = EXCLUDED.fouls_committed,
                    cards_yellow = EXCLUDED.cards_yellow,
                    cards_red = EXCLUDED.cards_red,
                    penalties_scored = EXCLUDED.penalties_scored,
                    penalties_missed = EXCLUDED.penalties_missed,
                    fetched_at = EXCLUDED.fetched_at
            """, values)

            total_inserted += len(rows)

        conn.commit()
        print(f"  Upserted {len(rows)} rows")

    print(f"\n{'=' * 50}")
    print(f"Total: {total_inserted} stat rows, {total_players_registered} players registered")

    # Run player matching
    if not DRY_RUN:
        match_players(conn)

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
