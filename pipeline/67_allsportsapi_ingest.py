"""
67_allsportsapi_ingest.py — Fetch squad rosters + player stats from AllSportsAPI.

Targets leagues NOT covered by API-Football, especially thin OTP nations.
AllSportsAPI (allsportsapi.com) covers 1,019 leagues with team squads and
season-level player stats (goals, assists, shots, tackles, passes, duels, etc.).

Usage:
    python 67_allsportsapi_ingest.py                      # OTP-priority leagues only
    python 67_allsportsapi_ingest.py --league 69          # Bolivia Primera Division
    python 67_allsportsapi_ingest.py --all-leagues        # all configured leagues
    python 67_allsportsapi_ingest.py --match-only         # skip fetch, just match players
    python 67_allsportsapi_ingest.py --insert-new         # create people rows for unmatched
    python 67_allsportsapi_ingest.py --dry-run            # preview without writing
    python 67_allsportsapi_ingest.py --force              # re-fetch even if data exists
"""

import argparse
import html
import math
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.dirname(__file__))
from config import ALLSPORTSAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

API_BASE = "https://apiv2.allsportsapi.com/football/"

# ── League config ────────────────────────────────────────────────────────────
# Only leagues NOT already covered by API-Football (pipeline 65).
# Format: allsportsapi_league_id → (name, nation_name, nation_id_in_db)

LEAGUES = {
    # ── Critical OTP thin nations (pool < 30) ──
    69:   ("Primera Division",    "Bolivia",       27),
    123:  ("Ligue 1",            "Ivory Coast",  257),
    317:  ("Ligue 1",            "Tunisia",      231),
    # ── OTP nations (pool < 60) ──
    112:  ("Elite One",          "Cameroon",      39),
    177:  ("Premier League",     "Ghana",         87),
    208:  ("Premier League",     "Jamaica",      113),
    246:  ("Premier League",     "New Zealand",  159),
    248:  ("Premier League",     "Nigeria",      162),
    255:  ("Primera Division",   "Paraguay",     176),
    497:  ("Ligue 1",            "Senegal",      193),
    239:  ("GNEF 1",             "Morocco",      151),
    # ── Supplementary (AF covers these, but AllSportsAPI may find extras) ──
    140:  ("Liga Pro",           "Ecuador",       66),
    659:  ("Canadian Premier League", "Canada",   40),
}

OTP_PRIORITY_IDS = {69, 123, 317, 112, 177, 208, 246, 248, 255, 497, 239}

# Position type mapping: AllSportsAPI → our position enum
POSITION_MAP = {
    "Goalkeepers": "GK",
    "Defenders":   "CD",   # default; WD assigned later if side info available
    "Midfielders": "CM",   # default
    "Forwards":    "CF",   # default
}

# ── Args ─────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest AllSportsAPI squad rosters + stats")
parser.add_argument("--league", type=int, default=None, help="Single league ID")
parser.add_argument("--all-leagues", action="store_true", help="Fetch all configured leagues")
parser.add_argument("--match-only", action="store_true", help="Skip fetch, just run player matching")
parser.add_argument("--insert-new", action="store_true", help="Create people rows for unmatched players")
parser.add_argument("--dry-run", action="store_true", help="Preview counts, no writes")
parser.add_argument("--force", action="store_true", help="Re-fetch even if data exists")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force


# ── Helpers ──────────────────────────────────────────────────────────────────

def _safe_int(val):
    if val is None or val == "":
        return 0
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0


def _safe_float(val):
    if val is None or val == "":
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 2)
    except (TypeError, ValueError):
        return None


def _parse_date(val):
    """Parse YYYY-MM-DD date string, return None if invalid."""
    if not val:
        return None
    try:
        datetime.strptime(val, "%Y-%m-%d")
        return val
    except ValueError:
        return None


def api_get(params: dict) -> dict:
    """Make an AllSportsAPI request."""
    params["APIkey"] = ALLSPORTSAPI_KEY
    resp = requests.get(API_BASE, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("success") == 0:
        print(f"  API error: {data.get('result', 'unknown')}")
        return {"result": []}
    # Gentle rate limiting — no documented limit but be polite
    time.sleep(0.5)
    return data


def normalize(name: str) -> str:
    """Normalize a player name for matching."""
    name = html.unescape(name)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)
    name = re.sub(r"\s+(jr\.?|sr\.?|ii|iii|iv)$", "", name)
    return name


# ── Fetch ────────────────────────────────────────────────────────────────────

def fetch_league_squads(league_id: int) -> list[dict]:
    """Fetch all teams + their squads for a league."""
    data = api_get({"met": "Teams", "leagueId": league_id})
    teams = data.get("result", [])
    if not isinstance(teams, list):
        print(f"  Unexpected response: {type(teams)}")
        return []
    return teams


def parse_player(player: dict, team_name: str, team_key: int, league_id: int, league_name: str) -> tuple[dict, dict] | None:
    """Parse a player from a team squad into registry + stats rows."""
    asa_id = player.get("player_key")
    name = player.get("player_name", "")
    if not asa_id or not name:
        return None

    minutes = _safe_int(player.get("player_minutes"))
    # Keep players even with 0 minutes for roster enrichment

    registry = {
        "allsportsapi_id": asa_id,
        "name": name,
        "country": player.get("player_country"),
        "position_type": player.get("player_type"),
        "age": _safe_int(player.get("player_age")) or None,
        "birthdate": _parse_date(player.get("player_birthdate")),
        "team_name": team_name,
        "team_key": team_key,
        "image_url": player.get("player_image"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    stats = {
        "allsportsapi_id": asa_id,
        "league_id": league_id,
        "league_name": league_name,
        "season": "2025",
        "team_name": team_name,
        "appearances": _safe_int(player.get("player_match_played")),
        "minutes": minutes,
        "rating": _safe_float(player.get("player_rating")),
        "goals": _safe_int(player.get("player_goals")),
        "assists": _safe_int(player.get("player_assists")),
        "shots_total": _safe_int(player.get("player_shots_total")),
        "passes_total": _safe_int(player.get("player_passes")),
        "passes_accuracy": _safe_int(player.get("player_passes_accuracy")),
        "key_passes": _safe_int(player.get("player_key_passes")),
        "tackles": _safe_int(player.get("player_tackles")),
        "blocks": _safe_int(player.get("player_blocks")),
        "interceptions": _safe_int(player.get("player_interceptions")),
        "clearances": _safe_int(player.get("player_clearances")),
        "duels_total": _safe_int(player.get("player_duels_total")),
        "duels_won": _safe_int(player.get("player_duels_won")),
        "dribble_attempts": _safe_int(player.get("player_dribble_attempts")),
        "dribble_success": _safe_int(player.get("player_dribble_succ")),
        "fouls_committed": _safe_int(player.get("player_fouls_commited") or player.get("player_fouls_committed")),
        "dispossessed": _safe_int(player.get("player_dispossesed")),
        "cards_yellow": _safe_int(player.get("player_yellow_cards")),
        "cards_red": _safe_int(player.get("player_red_cards")),
        "pen_scored": _safe_int(player.get("player_pen_scored")),
        "pen_missed": _safe_int(player.get("player_pen_missed")),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    return registry, stats


# ── Player matching ──────────────────────────────────────────────────────────

def match_players(conn):
    """Link allsportsapi_players.person_id via name matching to people table."""
    cur = conn.cursor()

    # Get unmatched AllSportsAPI players
    cur.execute("""
        SELECT allsportsapi_id, name, country, team_name, position_type, age, birthdate
        FROM allsportsapi_players
        WHERE person_id IS NULL
    """)
    unmatched = cur.fetchall()
    print(f"\nPlayer matching: {len(unmatched)} unmatched AllSportsAPI players")

    if not unmatched:
        return 0

    # Load existing links
    cur.execute("SELECT external_id FROM player_id_links WHERE source = 'allsportsapi'")
    already_linked = {r[0] for r in cur.fetchall()}

    # Load people lookup
    cur.execute("SELECT id, name FROM people WHERE active = true")
    people_rows = cur.fetchall()

    people_by_norm = {}
    people_by_last = {}
    people_by_initial = {}

    for pid, pname in people_rows:
        norm = normalize(pname)
        people_by_norm.setdefault(norm, []).append((pid, pname))

        parts = norm.split()
        if len(parts) >= 2:
            last = parts[-1]
            people_by_last.setdefault(last, []).append((pid, pname))
            initial_key = f"{parts[0][0]}. {last}"
            people_by_initial.setdefault(initial_key, []).append((pid, pname))
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

    # Load nation_id for people
    cur.execute("SELECT id, nation_id FROM people WHERE active = true")
    people_nation = {r[0]: r[1] for r in cur.fetchall()}

    # Build league→nation mapping from our config
    league_nation = {lid: info[2] for lid, info in LEAGUES.items()}

    # Get league_id per ASA player
    cur.execute("""
        SELECT DISTINCT allsportsapi_id, league_id
        FROM allsportsapi_player_stats
    """)
    asa_leagues = {}
    for asa_id, lid in cur.fetchall():
        asa_leagues.setdefault(asa_id, set()).add(lid)

    matched_exact = 0
    matched_initial = 0
    matched_mononym = 0
    matched_fuzzy = 0
    links_to_insert = []
    stats_to_update = []
    matched_ids = set()

    for asa_id, asa_name, country, team_name, pos_type, age, birthdate in unmatched:
        if str(asa_id) in already_linked:
            continue

        norm_name = normalize(asa_name)
        person_id = None

        # Strategy 1: Exact normalized name
        candidates = people_by_norm.get(norm_name, [])
        if len(candidates) == 1:
            person_id = candidates[0][0]
            matched_exact += 1

        # Strategy 2: Initial + last name
        if not person_id and "." in norm_name:
            candidates = people_by_initial.get(norm_name, [])
            if len(candidates) == 1:
                person_id = candidates[0][0]
                matched_initial += 1
            elif len(candidates) > 1 and team_name:
                norm_team = normalize(team_name)
                club_matches = [pid for pid, _ in candidates
                                if norm_team in people_club.get(pid, "")]
                if len(club_matches) == 1:
                    person_id = club_matches[0]
                    matched_initial += 1

        # Strategy 3: Mononym + club
        if not person_id and " " not in norm_name and team_name:
            candidates = people_by_last.get(norm_name, [])
            if not candidates:
                candidates = people_by_norm.get(norm_name, [])
            if len(candidates) == 1:
                person_id = candidates[0][0]
                matched_mononym += 1
            elif len(candidates) > 1:
                norm_team = normalize(team_name)
                club_matches = [pid for pid, _ in candidates
                                if norm_team in people_club.get(pid, "")]
                if len(club_matches) == 1:
                    person_id = club_matches[0]
                    matched_mononym += 1

        if person_id:
            conf = 0.9 if matched_exact else 0.8
            links_to_insert.append((person_id, "allsportsapi", str(asa_id), asa_name, "exact" if conf == 0.9 else "initial", conf))
            stats_to_update.append((person_id, asa_id))
            matched_ids.add(asa_id)

    # Strategy 4: Fuzzy matching
    try:
        from rapidfuzz import fuzz

        still_unmatched = [(r[0], r[1], r[2], r[3]) for r in unmatched
                           if r[0] not in matched_ids and str(r[0]) not in already_linked]

        for asa_id, asa_name, country, team_name in still_unmatched:
            norm_name = normalize(asa_name)
            parts = norm_name.split()
            if len(parts) < 2:
                continue

            af_last = parts[-1]
            af_first = " ".join(parts[:-1])

            # Get candidate nation_ids from league data
            asa_nation_ids = set()
            for lid in asa_leagues.get(asa_id, []):
                if lid in league_nation:
                    asa_nation_ids.add(league_nation[lid])

            candidates = people_by_last.get(af_last, [])
            if not candidates:
                continue

            best_score = 0
            best_pid = None

            for pid, pname in candidates:
                pnorm = normalize(pname)
                pparts = pnorm.split()
                if len(pparts) < 2:
                    continue
                p_first = " ".join(pparts[:-1])

                jw = fuzz.ratio(norm_name, pnorm) / 100.0
                first_jw = fuzz.ratio(af_first, p_first) / 100.0

                if first_jw < 0.65:
                    continue

                nation_match = bool(asa_nation_ids) and people_nation.get(pid) in asa_nation_ids
                club_match = team_name and normalize(team_name) in people_club.get(pid, "")

                score = jw * 0.5 + first_jw * 0.5
                if nation_match:
                    score += 0.08
                if club_match:
                    score += 0.05

                if score > best_score:
                    best_score = score
                    best_pid = pid

            min_threshold = 0.88 if asa_nation_ids and people_nation.get(best_pid) in asa_nation_ids else 0.92
            if best_pid and best_score >= min_threshold:
                links_to_insert.append((best_pid, "allsportsapi", str(asa_id), asa_name, "fuzzy", 0.7))
                stats_to_update.append((best_pid, asa_id))
                matched_fuzzy += 1
                matched_ids.add(asa_id)
    except ImportError:
        print("  (rapidfuzz not installed — skipping fuzzy matching)")

    total_matched = matched_exact + matched_initial + matched_mononym + matched_fuzzy
    print(f"  Matched: {total_matched} total")
    print(f"    Exact name: {matched_exact}")
    print(f"    Initial + last: {matched_initial}")
    print(f"    Mononym/last + club: {matched_mononym}")
    print(f"    Fuzzy: {matched_fuzzy}")
    print(f"  Unmatched: {len(unmatched) - total_matched}")

    if DRY_RUN:
        print("  [dry-run] Would insert links and update person_ids")
        return total_matched

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
            UPDATE allsportsapi_players SET person_id = %s WHERE allsportsapi_id = %s
        """, stats_to_update)
        execute_batch(cur, """
            UPDATE allsportsapi_player_stats SET person_id = %s WHERE allsportsapi_id = %s
        """, stats_to_update)

    conn.commit()
    return total_matched


# ── Insert new people (OTP enrichment) ───────────────────────────────────────

def insert_new_people(conn):
    """Create people rows for unmatched AllSportsAPI players in OTP nations."""
    cur = conn.cursor()

    # Get unmatched players from OTP-priority leagues
    otp_league_ids = tuple(OTP_PRIORITY_IDS)
    cur.execute("""
        SELECT DISTINCT p.allsportsapi_id, p.name, p.country, p.position_type,
               p.age, p.birthdate, p.team_name, s.league_id
        FROM allsportsapi_players p
        JOIN allsportsapi_player_stats s ON s.allsportsapi_id = p.allsportsapi_id
        WHERE p.person_id IS NULL
          AND s.league_id IN %s
    """, (otp_league_ids,))
    candidates = cur.fetchall()
    print(f"\nNew people insertion: {len(candidates)} unmatched players in OTP leagues")

    if not candidates:
        return 0

    # Get next available ID
    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM people")
    next_id = cur.fetchone()[0]

    inserted = 0
    for asa_id, name, country, pos_type, age, birthdate, team_name, league_id in candidates:
        league_info = LEAGUES.get(league_id)
        if not league_info:
            continue

        nation_id = league_info[2]
        position = POSITION_MAP.get(pos_type, "CM")

        if DRY_RUN:
            inserted += 1
            continue

        # Insert into people
        person_id = next_id
        next_id += 1
        cur.execute("""
            INSERT INTO people (id, name, nation_id, active, date_of_birth)
            VALUES (%s, %s, %s, true, %s)
            RETURNING id
        """, (person_id, name, nation_id, birthdate))

        # Insert basic player_profiles
        cur.execute("""
            INSERT INTO player_profiles (person_id, position, profile_tier)
            VALUES (%s, %s, 3)
            ON CONFLICT (person_id) DO NOTHING
        """, (person_id, position))

        # Link back
        cur.execute("""
            UPDATE allsportsapi_players SET person_id = %s WHERE allsportsapi_id = %s
        """, (person_id, asa_id))
        cur.execute("""
            UPDATE allsportsapi_player_stats SET person_id = %s WHERE allsportsapi_id = %s
        """, (person_id, asa_id))

        # Add to player_id_links
        cur.execute("""
            INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
            VALUES (%s, 'allsportsapi', %s, %s, 'new_insert', 1.0)
            ON CONFLICT (source, external_id) DO NOTHING
        """, (person_id, str(asa_id), name))

        inserted += 1

    if not DRY_RUN:
        conn.commit()

    print(f"  Inserted: {inserted} new people (tier 3)")
    return inserted


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not ALLSPORTSAPI_KEY:
        print("ERROR: ALLSPORTSAPI_KEY not set in .env.local")
        sys.exit(1)

    from lib.db import require_conn

    conn = require_conn()
    cur = conn.cursor()

    # Ensure tables exist
    sql_path = os.path.join(os.path.dirname(__file__), "sql", "052_allsportsapi.sql")
    if os.path.exists(sql_path):
        with open(sql_path) as f:
            cur.execute(f.read())
        conn.commit()

    if args.match_only:
        match_players(conn)
        if args.insert_new:
            insert_new_people(conn)
        conn.close()
        return

    # Determine leagues
    if args.league:
        league_ids = [args.league]
    elif args.all_leagues:
        league_ids = list(LEAGUES.keys())
    else:
        league_ids = list(OTP_PRIORITY_IDS)

    total_players = 0
    total_stats = 0

    print(f"AllSportsAPI ingest — {len(league_ids)} leagues")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    print()

    for league_id in league_ids:
        league_info = LEAGUES.get(league_id, (f"League {league_id}", "Unknown", None))
        league_name = league_info[0]
        country = league_info[1]
        print(f"── {country}: {league_name} (ID: {league_id}) ──")

        # Reconnect between leagues
        try:
            cur.execute("SELECT 1")
        except Exception:
            print("  (reconnecting...)")
            try:
                conn.close()
            except Exception:
                pass
            conn = require_conn()
            cur = conn.cursor()

        # Check existing data
        if not FORCE:
            cur.execute("""
                SELECT COUNT(*) FROM allsportsapi_player_stats
                WHERE league_id = %s
            """, (league_id,))
            existing = cur.fetchone()[0]
            if existing > 0:
                print(f"  Already have {existing} rows. Use --force to re-fetch.")
                continue

        # Fetch squads
        teams = fetch_league_squads(league_id)
        print(f"  {len(teams)} teams")

        registry_rows = []
        stats_rows = []

        for team in teams:
            t_name = team.get("team_name", "")
            t_key = team.get("team_key", 0)
            players = team.get("players", [])

            for p in players:
                result = parse_player(p, t_name, t_key, league_id, league_name)
                if result:
                    reg, stat = result
                    registry_rows.append(reg)
                    stats_rows.append(stat)

        # Deduplicate by allsportsapi_id (player can appear in multiple teams)
        seen_ids = set()
        deduped_reg = []
        deduped_stats = []
        for reg, stat in zip(registry_rows, stats_rows):
            asa_id = reg["allsportsapi_id"]
            if asa_id not in seen_ids:
                seen_ids.add(asa_id)
                deduped_reg.append(reg)
            deduped_stats.append(stat)  # stats can have multiple league entries
        registry_rows = deduped_reg

        # Deduplicate stats by (allsportsapi_id, league_id, season)
        seen_stats = set()
        unique_stats = []
        for s in deduped_stats:
            key = (s["allsportsapi_id"], s["league_id"], s["season"])
            if key not in seen_stats:
                seen_stats.add(key)
                unique_stats.append(s)
        stats_rows = unique_stats

        print(f"  {len(registry_rows)} players, {len([s for s in stats_rows if s['minutes'] > 0])} with minutes")

        if DRY_RUN:
            total_players += len(registry_rows)
            total_stats += len(stats_rows)
            continue

        # Reconnect before write
        try:
            cur.execute("SELECT 1")
        except Exception:
            print("  (reconnecting before write...)")
            try:
                conn.close()
            except Exception:
                pass
            conn = require_conn()
            cur = conn.cursor()

        # Delete existing if forcing
        if FORCE:
            cur.execute("DELETE FROM allsportsapi_player_stats WHERE league_id = %s", (league_id,))
            conn.commit()

        # Upsert player registry
        if registry_rows:
            from psycopg2.extras import execute_values
            reg_cols = ["allsportsapi_id", "name", "country", "position_type", "age",
                        "birthdate", "team_name", "team_key", "image_url", "fetched_at"]
            reg_values = [tuple(r[c] for c in reg_cols) for r in registry_rows]

            CHUNK = 200
            for i in range(0, len(reg_values), CHUNK):
                chunk = reg_values[i:i + CHUNK]
                execute_values(cur, f"""
                    INSERT INTO allsportsapi_players ({",".join(reg_cols)})
                    VALUES %s
                    ON CONFLICT (allsportsapi_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        country = EXCLUDED.country,
                        position_type = EXCLUDED.position_type,
                        age = EXCLUDED.age,
                        birthdate = EXCLUDED.birthdate,
                        team_name = EXCLUDED.team_name,
                        team_key = EXCLUDED.team_key,
                        image_url = EXCLUDED.image_url,
                        fetched_at = EXCLUDED.fetched_at
                """, chunk)
                conn.commit()

        # Upsert stats
        if stats_rows:
            from psycopg2.extras import execute_values
            stat_cols = [
                "allsportsapi_id", "league_id", "league_name", "season", "team_name",
                "appearances", "minutes", "rating", "goals", "assists",
                "shots_total", "passes_total", "passes_accuracy", "key_passes",
                "tackles", "blocks", "interceptions", "clearances",
                "duels_total", "duels_won", "dribble_attempts", "dribble_success",
                "fouls_committed", "dispossessed", "cards_yellow", "cards_red",
                "pen_scored", "pen_missed", "fetched_at",
            ]
            stat_values = [tuple(s[c] for c in stat_cols) for s in stats_rows]

            for i in range(0, len(stat_values), CHUNK):
                chunk = stat_values[i:i + CHUNK]
                update_cols = [c for c in stat_cols if c not in ("allsportsapi_id", "league_id", "season")]
                update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
                execute_values(cur, f"""
                    INSERT INTO allsportsapi_player_stats ({",".join(stat_cols)})
                    VALUES %s
                    ON CONFLICT (allsportsapi_id, league_id, season) DO UPDATE SET
                        {update_clause}
                """, chunk)
                conn.commit()

        total_players += len(registry_rows)
        total_stats += len(stats_rows)
        print(f"  Upserted {len(registry_rows)} players, {len(stats_rows)} stat rows")

    print(f"\n{'=' * 50}")
    print(f"Total: {total_players} players, {total_stats} stat rows")

    # Run player matching
    if not DRY_RUN:
        match_players(conn)
        if args.insert_new:
            insert_new_people(conn)

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
