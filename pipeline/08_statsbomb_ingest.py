"""
08_statsbomb_ingest.py — Pull StatsBomb open data and push to Supabase.

Usage:
    python 08_statsbomb_ingest.py
    python 08_statsbomb_ingest.py --competition 2          # La Liga only
    python 08_statsbomb_ingest.py --dry-run                # counts only, no inserts
    python 08_statsbomb_ingest.py --force                  # re-sync already-present matches
"""
import argparse
import json
import math
import sys
import uuid
from datetime import datetime, timezone

import pandas as pd
from statsbombpy import sb
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest StatsBomb open data into Supabase")
parser.add_argument("--competition", type=int, default=None,
                    help="Filter to a single competition_id (e.g. 2 for La Liga)")
parser.add_argument("--dry-run", action="store_true",
                    help="Print counts without inserting anything")
parser.add_argument("--force", action="store_true",
                    help="Re-sync matches even if already present in sb_events")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
COMPETITION_FILTER = args.competition
CHUNK_SIZE = 100

# ── Supabase client ────────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _name(val):
    """Extract .name from a dict-like field, or return the value as-is."""
    if isinstance(val, dict):
        return val.get("name")
    return val


def _id(val):
    """Extract .id from a dict-like field."""
    if isinstance(val, dict):
        return val.get("id")
    return val


def _safe(val):
    """Convert NaN / NaT / inf to None so JSON serialisation doesn't choke."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, pd.Timestamp):
        return val.isoformat() if not pd.isnull(val) else None
    return val


def _sanitize(obj):
    """Recursively replace NaN/inf/NaT with None for JSON safety."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat() if not pd.isnull(obj) else None
    if pd.api.types.is_scalar(obj) and pd.isna(obj):
        return None
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


def _row_to_json(row: dict) -> str:
    """Serialise a DataFrame row dict to a JSON string, coercing bad values."""
    return json.dumps(_sanitize(row), default=str)


def chunked_upsert(table: str, rows: list, on_conflict: str):
    """Upsert rows in batches of CHUNK_SIZE. Sanitizes all values first."""
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} rows into {table}")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = [_sanitize(row) for row in rows[i:i + CHUNK_SIZE]]
        client.table(table).upsert(chunk, on_conflict=on_conflict).execute()
        total += len(chunk)
    return total

# ── 1. Competitions ────────────────────────────────────────────────────────────

print("Fetching competitions from StatsBomb open data...")
comp_df = sb.competitions()
print(f"  Found {len(comp_df)} competition/season rows")

if COMPETITION_FILTER is not None:
    comp_df = comp_df[comp_df["competition_id"] == COMPETITION_FILTER]
    print(f"  Filtered to competition_id={COMPETITION_FILTER}: {len(comp_df)} rows")

now_iso = datetime.now(timezone.utc).isoformat()

competition_rows = []
for _, row in comp_df.iterrows():
    competition_rows.append({
        "competition_id": int(row["competition_id"]),
        "competition_name": row.get("competition_name"),
        "country_name": row.get("country_name"),
        "competition_gender": row.get("competition_gender"),
        "season_id": int(row["season_id"]),
        "season_name": row.get("season_name"),
        "synced_at": now_iso,
    })

n = chunked_upsert("sb_competitions", competition_rows,
                    on_conflict="competition_id,season_id")
print(f"  Upserted {n} competitions")

# ── 2. Matches ─────────────────────────────────────────────────────────────────

print("\nFetching matches...")

all_match_rows = []
comp_seasons = comp_df[["competition_id", "season_id"]].drop_duplicates()

for _, cs in comp_seasons.iterrows():
    cid = int(cs["competition_id"])
    sid = int(cs["season_id"])
    try:
        matches_df = sb.matches(competition_id=cid, season_id=sid)
    except Exception as e:
        print(f"  WARN: could not fetch matches for comp={cid} season={sid}: {e}")
        continue

    for _, m in matches_df.iterrows():
        home_team = m.get("home_team") or {}
        away_team = m.get("away_team") or {}
        stadium = m.get("stadium")
        referee = m.get("referee")

        all_match_rows.append({
            "match_id": int(m["match_id"]),
            "competition_id": cid,
            "season_id": sid,
            "match_date": str(m["match_date"]) if pd.notna(m.get("match_date")) else None,
            "kick_off": str(m["kick_off"]) if pd.notna(m.get("kick_off")) else None,
            "home_team_id": _id(home_team) if isinstance(home_team, dict) else None,
            "home_team_name": _name(home_team) if isinstance(home_team, dict) else str(home_team),
            "away_team_id": _id(away_team) if isinstance(away_team, dict) else None,
            "away_team_name": _name(away_team) if isinstance(away_team, dict) else str(away_team),
            "home_score": _safe(m.get("home_score")),
            "away_score": _safe(m.get("away_score")),
            "match_status": m.get("match_status"),
            "stadium": _name(stadium) if isinstance(stadium, dict) else stadium,
            "referee": _name(referee) if isinstance(referee, dict) else referee,
            "synced_at": now_iso,
        })

print(f"  Total matches across all competitions: {len(all_match_rows)}")
n = chunked_upsert("sb_matches", all_match_rows, on_conflict="match_id")
print(f"  Upserted {n} matches")

# ── 3. Determine which matches need event/lineup sync ─────────────────────────

match_ids = [r["match_id"] for r in all_match_rows]

if FORCE:
    matches_to_sync = match_ids
    print(f"\n--force: will sync all {len(matches_to_sync)} matches")
else:
    print("\nChecking which matches already have events in sb_events...")
    if DRY_RUN:
        already_synced = set()
    else:
        # Query existing match_ids in sb_events (paginate in chunks to stay safe)
        already_synced = set()
        for i in range(0, len(match_ids), 500):
            chunk_ids = match_ids[i:i + 500]
            resp = (client.table("sb_events")
                    .select("match_id")
                    .in_("match_id", chunk_ids)
                    .execute())
            for row in resp.data:
                already_synced.add(row["match_id"])

    matches_to_sync = [mid for mid in match_ids if mid not in already_synced]
    print(f"  {len(already_synced)} already synced, {len(matches_to_sync)} to process")

# ── 4. Events & Lineups per match ──────────────────────────────────────────────

total_events = 0
total_lineups = 0

for idx, match_id in enumerate(matches_to_sync, start=1):
    print(f"  [{idx}/{len(matches_to_sync)}] match_id={match_id}", end=" ")

    # ── Events ────────────────────────────────────────────────────────────────
    try:
        events_df = sb.events(match_id=match_id)
    except Exception as e:
        print(f"  WARN: events fetch failed: {e}")
        continue

    event_rows = []
    for _, ev in events_df.iterrows():
        ev_dict = ev.to_dict()
        loc = ev_dict.get("location")
        if isinstance(loc, list) and len(loc) >= 2:
            location = [float(loc[0]), float(loc[1])]
        else:
            location = None

        up = ev_dict.get("under_pressure")
        if isinstance(up, float) and math.isnan(up):
            up = None

        event_rows.append({
            "id": str(ev_dict.get("id", uuid.uuid4())),
            "match_id": match_id,
            "index": int(ev_dict["index"]) if pd.notna(ev_dict.get("index")) else None,
            "period": int(ev_dict["period"]) if pd.notna(ev_dict.get("period")) else None,
            "minute": int(ev_dict["minute"]) if pd.notna(ev_dict.get("minute")) else None,
            "second": int(ev_dict["second"]) if pd.notna(ev_dict.get("second")) else None,
            "type": _name(ev_dict.get("type")),
            "team": _name(ev_dict.get("team")),
            "player": _name(ev_dict.get("player")),
            "position": _name(ev_dict.get("position")),
            "location": location,
            "under_pressure": bool(up) if up is not None else None,
            "raw": json.loads(_row_to_json(ev_dict)),
        })

    n_ev = chunked_upsert("sb_events", event_rows, on_conflict="id")
    total_events += n_ev

    # ── Lineups ────────────────────────────────────────────────────────────────
    try:
        lineups = sb.lineups(match_id=match_id)
    except Exception as e:
        print(f"— WARN: lineups fetch failed: {e}")
        lineups = {}

    lineup_rows = []
    for team_name, lineup_df in lineups.items():
        if not isinstance(lineup_df, pd.DataFrame):
            continue
        for _, lp in lineup_df.iterrows():
            lp_dict = lp.to_dict()
            country = lp_dict.get("country")
            lineup_rows.append({
                "id": str(uuid.uuid4()),
                "match_id": match_id,
                "team_id": _id(lp_dict.get("team_id")),
                "team_name": team_name,
                "player_id": int(lp_dict["player_id"]) if pd.notna(lp_dict.get("player_id")) else None,
                "player_name": lp_dict.get("player_name"),
                "jersey_number": int(lp_dict["jersey_number"]) if pd.notna(lp_dict.get("jersey_number")) else None,
                "country": _name(country) if isinstance(country, dict) else country,
            })

    n_lu = chunked_upsert("sb_lineups", lineup_rows, on_conflict="id")
    total_lineups += n_lu

    print(f"— {n_ev} events, {n_lu} lineup entries")

# ── Summary ────────────────────────────────────────────────────────────────────

print(f"\nDone.")
print(f"  Competitions upserted : {len(competition_rows)}")
print(f"  Matches upserted      : {len(all_match_rows)}")
print(f"  Events upserted       : {total_events}")
print(f"  Lineup entries        : {total_lineups}")
if DRY_RUN:
    print("  (dry-run — no data was written)")
