"""
09_understat_ingest.py — Pull xG and player stats from Understat and push to Supabase.

Usage:
    python 09_understat_ingest.py
    python 09_understat_ingest.py --league EPL          # one league only
    python 09_understat_ingest.py --season 2023         # one season only
    python 09_understat_ingest.py --dry-run             # counts only, no writes
    python 09_understat_ingest.py --force               # re-sync even if match already present
"""
import argparse
import math
import sys
import time
import uuid
from datetime import datetime, timezone

from supabase import create_client
from understatapi import UnderstatClient

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest Understat xG data into Supabase")
parser.add_argument("--league", default=None,
                    help="Restrict to a single league (e.g. EPL, La_Liga, Bundesliga)")
parser.add_argument("--season", default=None,
                    help="Restrict to a single season (e.g. 2023)")
parser.add_argument("--dry-run", action="store_true",
                    help="Print counts without inserting anything")
parser.add_argument("--force", action="store_true",
                    help="Re-sync player stats even if match already present")
parser.add_argument("--matches-only", action="store_true",
                    help="Only fetch and upsert match data, skip player stats")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
LEAGUE_FILTER = args.league
SEASON_FILTER = args.season
MATCHES_ONLY = args.matches_only
CHUNK_SIZE = 100

LEAGUES = ["EPL", "La_Liga", "Bundesliga", "Serie_A", "Ligue_1", "RFPL"]
SEASONS = ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014"]

if LEAGUE_FILTER:
    if LEAGUE_FILTER not in LEAGUES:
        print(f"ERROR: Unknown league '{LEAGUE_FILTER}'. Valid: {LEAGUES}")
        sys.exit(1)
    LEAGUES = [LEAGUE_FILTER]

if SEASON_FILTER:
    SEASONS = [SEASON_FILTER]

# ── Supabase client ────────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe_float(val):
    """Convert a value to float, returning None on failure or NaN/inf."""
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def _safe_int(val):
    """Convert a value to int, returning None on failure."""
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def chunked_upsert(table: str, rows: list, on_conflict: str) -> int:
    """Upsert rows into table in batches of CHUNK_SIZE. Returns count upserted."""
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} rows into {table}")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        client.table(table).upsert(chunk, on_conflict=on_conflict).execute()
        total += len(chunk)
    return total


# ── 1. Fetch matches per league+season and upsert ─────────────────────────────

now_iso = datetime.now(timezone.utc).isoformat()

all_match_rows = []
all_match_ids = []

print("Fetching match data from Understat...")

with UnderstatClient() as understat:
    for league in LEAGUES:
        for season in SEASONS:
            print(f"  {league} / {season}", end=" ... ", flush=True)
            try:
                matches = understat.league(league=league).get_match_data(season=season)
            except Exception as e:
                print(f"WARN: {e}")
                continue

            league_match_rows = []
            for m in matches:
                match_id = _safe_int(m.get("id"))
                if match_id is None:
                    continue

                h = m.get("h") or {}
                a = m.get("a") or {}
                goals = m.get("goals") or {}
                xg = m.get("xG") or {}
                forecast = m.get("forecast") or {}

                # Understat datetime: "2023-08-12 14:00:00"
                raw_dt = m.get("datetime") or m.get("date") or None
                match_date = raw_dt[:10] if raw_dt and len(raw_dt) >= 10 else None

                league_match_rows.append({
                    "id": match_id,
                    "league": league,
                    "season": season,
                    "match_date": match_date,
                    "home_team": h.get("title"),
                    "away_team": a.get("title"),
                    "home_goals": _safe_int(goals.get("h")),
                    "away_goals": _safe_int(goals.get("a")),
                    "home_xg": _safe_float(xg.get("h")),
                    "away_xg": _safe_float(xg.get("a")),
                    "forecast_w": _safe_float(forecast.get("w")),
                    "forecast_d": _safe_float(forecast.get("d")),
                    "forecast_l": _safe_float(forecast.get("l")),
                    "synced_at": now_iso,
                })

            print(f"{len(league_match_rows)} matches")
            all_match_rows.extend(league_match_rows)

print(f"\nTotal matches fetched: {len(all_match_rows)}")
n = chunked_upsert("understat_matches", all_match_rows, on_conflict="id")
print(f"Upserted {n} rows into understat_matches")

# ── 2. Determine which matches need player stats sync ─────────────────────────

if MATCHES_ONLY:
    print(f"\n--matches-only: skipping player stats. Done.")
    print(f"  Matches upserted: {len(all_match_rows)}")
    sys.exit(0)

all_match_ids = [r["id"] for r in all_match_rows]

if FORCE:
    matches_to_sync = all_match_ids
    print(f"\n--force: will sync player stats for all {len(matches_to_sync)} matches")
else:
    print("\nChecking which matches already have player stats...")
    if DRY_RUN:
        already_synced = set()
    else:
        already_synced = set()
        for i in range(0, len(all_match_ids), 500):
            chunk_ids = all_match_ids[i:i + 500]
            resp = (client.table("understat_player_match_stats")
                    .select("match_id")
                    .in_("match_id", chunk_ids)
                    .execute())
            for row in resp.data:
                already_synced.add(row["match_id"])

    matches_to_sync = [mid for mid in all_match_ids if mid not in already_synced]
    print(f"  {len(already_synced)} already synced, {len(matches_to_sync)} to process")

# ── 3. Fetch player stats per match and upsert ────────────────────────────────

total_player_rows = 0

print(f"\nFetching player stats for {len(matches_to_sync)} matches...")

with UnderstatClient() as understat:
    for idx, match_id in enumerate(matches_to_sync, start=1):
        print(f"  [{idx}/{len(matches_to_sync)}] match_id={match_id}", end=" ")

        try:
            roster = understat.match(match=str(match_id)).get_roster_data()
        except Exception as e:
            print(f"— WARN: {e}")
            time.sleep(0.5)
            continue

        # roster is usually {"h": {id: {...}, ...}, "a": {id: {...}, ...}}
        # but sometimes values are lists instead of dicts
        def _flatten_side(side):
            if isinstance(side, dict):
                return list(side.values())
            if isinstance(side, list):
                return side
            return []

        player_data = _flatten_side(roster.get("h", {})) + _flatten_side(roster.get("a", {}))

        player_rows = []
        for p in player_data:
            player_id = _safe_int(p.get("player_id"))
            if player_id is None:
                continue

            player_rows.append({
                "id": str(uuid.uuid4()),
                "match_id": match_id,
                "player_id": player_id,
                "player_name": p.get("player"),
                "team": p.get("team"),
                "h_a": p.get("h_a"),
                "position": p.get("position"),
                "time": _safe_int(p.get("time")),
                "goals": _safe_int(p.get("goals")),
                "assists": _safe_int(p.get("assists")),
                "shots": _safe_int(p.get("shots")),
                "key_passes": _safe_int(p.get("key_passes")),
                "yellow": _safe_int(p.get("yellow_card")),
                "red": _safe_int(p.get("red_card")),
                "xg": _safe_float(p.get("xG")),
                "xa": _safe_float(p.get("xA")),
                "npg": _safe_int(p.get("npg")),
                "npxa": _safe_float(p.get("npxG")),
                "xgchain": _safe_float(p.get("xGChain")),
                "xgbuildup": _safe_float(p.get("xGBuildup")),
            })

        n = chunked_upsert(
            "understat_player_match_stats",
            player_rows,
            on_conflict="match_id,player_id",
        )
        total_player_rows += n
        print(f"— {n} player rows")

        time.sleep(0.5)

# ── Summary ────────────────────────────────────────────────────────────────────

print(f"\nDone.")
print(f"  Matches upserted       : {len(all_match_rows)}")
print(f"  Player rows upserted   : {total_player_rows}")
if DRY_RUN:
    print("  (dry-run — no data was written)")
