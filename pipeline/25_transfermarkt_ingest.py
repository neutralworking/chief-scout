"""
25_transfermarkt_ingest.py — Fetch Transfermarkt market values and push to Supabase.

Uses the dcaribou/transfermarkt-datasets weekly-refreshed CSV dataset.
Downloads player profiles + historical valuations, matches to people table
via transfermarkt_id, then upserts into player_market and transfermarkt_valuations.

Usage:
    python 25_transfermarkt_ingest.py                  # full run
    python 25_transfermarkt_ingest.py --dry-run        # preview, no writes
    python 25_transfermarkt_ingest.py --values-only    # skip player matching, just valuations
    python 25_transfermarkt_ingest.py --latest-only    # only most recent valuation per player
    python 25_transfermarkt_ingest.py --force          # re-download even if cached
"""
import argparse
import csv
import gzip
import io
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
import requests

from config import POSTGRES_DSN, CACHE_DIR

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest Transfermarkt market values")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Re-download even if cached today")
parser.add_argument("--values-only", action="store_true", help="Skip player matching, valuations only")
parser.add_argument("--latest-only", action="store_true", help="Only import most recent valuation per player")
parser.add_argument("--limit", type=int, default=0, help="Limit number of players to process (0=all)")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
VALUES_ONLY = args.values_only
LATEST_ONLY = args.latest_only
LIMIT = args.limit
CHUNK_SIZE = 500

# ── Data URLs ─────────────────────────────────────────────────────────────────

BASE_URL = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
PLAYERS_URL = f"{BASE_URL}/players.csv.gz"
VALUATIONS_URL = f"{BASE_URL}/player_valuations.csv.gz"

# ── Cache directory ───────────────────────────────────────────────────────────

TM_CACHE = CACHE_DIR / "transfermarkt"
TM_CACHE.mkdir(parents=True, exist_ok=True)


def download_csv(url: str, name: str) -> list[dict]:
    """Download a gzipped CSV, cache it, return list of dicts."""
    cache_file = TM_CACHE / f"{name}.csv"
    today = datetime.now().strftime("%Y-%m-%d")
    marker = TM_CACHE / f"{name}.{today}.marker"

    if cache_file.exists() and marker.exists() and not FORCE:
        print(f"  Using cached {name}.csv (downloaded today)")
        with open(cache_file, "r", encoding="utf-8") as f:
            return list(csv.DictReader(f))

    print(f"  Downloading {url} ...")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()

    text = gzip.decompress(resp.content).decode("utf-8")
    cache_file.write_text(text, encoding="utf-8")

    # Clean old markers, write new one
    for old in TM_CACHE.glob(f"{name}.*.marker"):
        old.unlink()
    marker.touch()

    rows = list(csv.DictReader(io.StringIO(text)))
    print(f"  Downloaded {len(rows):,} rows")
    return rows


def normalize_name(name: str) -> str:
    """Normalize a player name for matching."""
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower().strip()
    name = re.sub(r"[^a-z\s]", "", name)
    name = re.sub(r"\s+", " ", name)
    return name


# ── DB connection ─────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: POSTGRES_DSN not set in .env")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Ensure tables/columns exist ───────────────────────────────────────────────

cur.execute("ALTER TABLE player_market ADD COLUMN IF NOT EXISTS market_value_eur bigint")
cur.execute("ALTER TABLE player_market ADD COLUMN IF NOT EXISTS highest_market_value_eur bigint")
cur.execute("ALTER TABLE player_market ADD COLUMN IF NOT EXISTS market_value_date date")

cur.execute("""
CREATE TABLE IF NOT EXISTS transfermarkt_valuations (
    id              bigserial PRIMARY KEY,
    person_id       bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    transfermarkt_id text NOT NULL,
    date            date NOT NULL,
    market_value_eur bigint NOT NULL,
    club_name       text,
    club_id         integer,
    competition_id  text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (person_id, date)
);
CREATE INDEX IF NOT EXISTS idx_tm_valuations_person ON transfermarkt_valuations(person_id);
CREATE INDEX IF NOT EXISTS idx_tm_valuations_date ON transfermarkt_valuations(date DESC);
""")

# ── Step 1: Download datasets ─────────────────────────────────────────────────

print("\n=== Transfermarkt Market Value Ingest ===\n")
print("Step 1: Downloading datasets...")

tm_players = download_csv(PLAYERS_URL, "players")
tm_valuations = download_csv(VALUATIONS_URL, "player_valuations")

# ── Step 2: Build lookup of our people ────────────────────────────────────────

print("\nStep 2: Building player matching index...")

# Get all people with transfermarkt_id
cur.execute("SELECT id, transfermarkt_id, name FROM people WHERE transfermarkt_id IS NOT NULL AND transfermarkt_id != ''")
tm_id_to_person = {}
for row in cur.fetchall():
    person_id, tm_id, name = row
    tm_id_to_person[str(tm_id)] = person_id

print(f"  {len(tm_id_to_person):,} people with transfermarkt_id")

# Get all people for name-based fallback matching
cur.execute("SELECT id, name, date_of_birth FROM people")
people_rows = cur.fetchall()
name_to_person: dict[str, list[tuple[int, str | None]]] = {}
for pid, pname, dob in people_rows:
    norm = normalize_name(pname)
    if norm not in name_to_person:
        name_to_person[norm] = []
    name_to_person[norm].append((pid, str(dob) if dob else None))

print(f"  {len(people_rows):,} total people for name matching")

# Get existing player_id_links for transfermarkt source
cur.execute("SELECT external_id, person_id FROM player_id_links WHERE source = 'transfermarkt'")
existing_links = {str(ext_id): pid for ext_id, pid in cur.fetchall()}
print(f"  {len(existing_links):,} existing transfermarkt links")

# ── Step 3: Match TM players to our people ────────────────────────────────────

print("\nStep 3: Matching Transfermarkt players to people...")

tm_id_to_person_id: dict[str, int] = {}
matched_by_tmid = 0
matched_by_link = 0
matched_by_name = 0
unmatched = 0
new_links = []

for tm_player in tm_players:
    tm_id = str(tm_player.get("player_id", ""))
    if not tm_id:
        continue

    # Method 1: Direct transfermarkt_id match
    if tm_id in tm_id_to_person:
        tm_id_to_person_id[tm_id] = tm_id_to_person[tm_id]
        matched_by_tmid += 1
        continue

    # Method 2: Existing player_id_links
    if tm_id in existing_links:
        tm_id_to_person_id[tm_id] = existing_links[tm_id]
        matched_by_link += 1
        continue

    if VALUES_ONLY:
        unmatched += 1
        continue

    # Method 3: Name + DOB matching
    tm_name = tm_player.get("name", "")
    tm_dob = tm_player.get("date_of_birth", "")[:10] if tm_player.get("date_of_birth") else None
    norm_name = normalize_name(tm_name)

    if norm_name and norm_name in name_to_person:
        candidates = name_to_person[norm_name]

        # If DOB available, use it to disambiguate
        if tm_dob and len(candidates) > 1:
            dob_matches = [c for c in candidates if c[1] and c[1][:10] == tm_dob]
            if len(dob_matches) == 1:
                person_id = dob_matches[0][0]
                tm_id_to_person_id[tm_id] = person_id
                matched_by_name += 1
                new_links.append((person_id, tm_id, tm_name, "name_dob"))
                continue

        # Single candidate — safe match
        if len(candidates) == 1:
            person_id = candidates[0][0]
            tm_id_to_person_id[tm_id] = person_id
            matched_by_name += 1
            new_links.append((person_id, tm_id, tm_name, "name_exact"))
            continue

    unmatched += 1

total_matched = matched_by_tmid + matched_by_link + matched_by_name
print(f"  Matched: {total_matched:,} ({matched_by_tmid} by TM ID, {matched_by_link} by links, {matched_by_name} by name)")
print(f"  Unmatched: {unmatched:,}")

# ── Step 4: Write new player_id_links ─────────────────────────────────────────

if new_links and not DRY_RUN:
    print(f"\nStep 4: Writing {len(new_links):,} new player_id_links...")
    for i in range(0, len(new_links), CHUNK_SIZE):
        chunk = new_links[i:i + CHUNK_SIZE]
        execute_values(cur, """
            INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
            VALUES %s
            ON CONFLICT (source, external_id) DO NOTHING
        """, [(pid, "transfermarkt", ext_id, ext_name, method, 0.9) for pid, ext_id, ext_name, method in chunk])
    print(f"  Wrote {len(new_links):,} links")
elif new_links:
    print(f"\nStep 4: [DRY RUN] Would write {len(new_links):,} new links")
else:
    print("\nStep 4: No new links to write")

# ── Step 5: Update player_market with current values ──────────────────────────

print("\nStep 5: Updating player_market with current market values...")

market_updates = []
for tm_player in tm_players:
    tm_id = str(tm_player.get("player_id", ""))
    person_id = tm_id_to_person_id.get(tm_id)
    if not person_id:
        continue

    market_value = tm_player.get("market_value_in_eur")
    highest_value = tm_player.get("highest_market_value_in_eur")
    contract_expiry = tm_player.get("contract_expiration_date", "")
    agent_name = tm_player.get("agent_name", "")

    if not market_value:
        continue

    try:
        mv = int(market_value)
        hv = int(highest_value) if highest_value else None
    except (ValueError, TypeError):
        continue

    # Parse contract expiry (format varies: YYYY-MM-DD or DD.MM.YYYY)
    parsed_expiry = None
    if contract_expiry:
        for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%m/%d/%Y"):
            try:
                parsed_expiry = datetime.strptime(contract_expiry[:10], fmt).strftime("%Y-%m-%d")
                break
            except (ValueError, TypeError):
                continue

    market_updates.append((person_id, mv, hv, parsed_expiry, agent_name or None))

    if LIMIT and len(market_updates) >= LIMIT:
        break

# Deduplicate by person_id (keep highest market value)
deduped: dict[int, tuple] = {}
for pid, mv, hv, expiry, agent in market_updates:
    if pid not in deduped or mv > deduped[pid][1]:
        deduped[pid] = (pid, mv, hv, expiry, agent)
market_updates = list(deduped.values())

print(f"  {len(market_updates):,} players with market values to update")

if market_updates and not DRY_RUN:
    for i in range(0, len(market_updates), CHUNK_SIZE):
        chunk = market_updates[i:i + CHUNK_SIZE]
        execute_values(cur, """
            INSERT INTO player_market (person_id, market_value_eur, highest_market_value_eur, market_value_date)
            VALUES %s
            ON CONFLICT (person_id) DO UPDATE SET
                market_value_eur = EXCLUDED.market_value_eur,
                highest_market_value_eur = EXCLUDED.highest_market_value_eur,
                market_value_date = CURRENT_DATE,
                updated_at = now()
        """, [(pid, mv, hv, datetime.now().date()) for pid, mv, hv, _, _ in chunk])
    print(f"  Updated {len(market_updates):,} player_market rows")

    # Update contract expiry + agent on people table (if data available)
    contract_updates = [(expiry, agent, pid) for pid, _, _, expiry, agent in market_updates
                        if expiry or agent]
    if contract_updates:
        for expiry, agent, pid in contract_updates:
            updates = []
            params = []
            if expiry:
                updates.append("contract_expiry_date = %s")
                params.append(expiry)
            if agent:
                updates.append("agent_name = %s")
                params.append(agent)
            if updates:
                params.append(pid)
                cur.execute(f"UPDATE people SET {', '.join(updates)} WHERE id = %s", params)
        print(f"  Updated {len(contract_updates):,} contract/agent records on people")

elif market_updates:
    print(f"  [DRY RUN] Would update {len(market_updates):,} rows")

# ── Step 6: Import historical valuations ──────────────────────────────────────

print("\nStep 6: Importing historical valuations...")

# Build valuation rows for matched players
val_rows = []
for val in tm_valuations:
    tm_id = str(val.get("player_id", ""))
    person_id = tm_id_to_person_id.get(tm_id)
    if not person_id:
        continue

    date_str = val.get("date", "")
    mv_str = val.get("market_value_in_eur", "")
    if not date_str or not mv_str:
        continue

    try:
        mv = int(mv_str)
        club_name = val.get("current_club_name")
        club_id_str = val.get("current_club_id")
        club_id = int(club_id_str) if club_id_str else None
        comp_id = val.get("player_club_domestic_competition_id")
    except (ValueError, TypeError):
        continue

    val_rows.append((person_id, tm_id, date_str, mv, club_name, club_id, comp_id))

# If latest-only, keep only most recent per player
if LATEST_ONLY:
    latest: dict[int, tuple] = {}
    for row in val_rows:
        pid = row[0]
        if pid not in latest or row[2] > latest[pid][2]:
            latest[pid] = row
    val_rows = list(latest.values())
    print(f"  Filtered to {len(val_rows):,} latest-only valuations")
else:
    print(f"  {len(val_rows):,} total historical valuations for matched players")

if val_rows and not DRY_RUN:
    # Deduplicate by (person_id, date) — keep highest market value
    val_deduped: dict[tuple, tuple] = {}
    for row in val_rows:
        key = (row[0], row[2])  # (person_id, date)
        if key not in val_deduped or row[3] > val_deduped[key][3]:
            val_deduped[key] = row
    val_rows = list(val_deduped.values())
    print(f"  Deduplicated to {len(val_rows):,} unique (person_id, date) pairs")

    written = 0
    for i in range(0, len(val_rows), CHUNK_SIZE):
        chunk = val_rows[i:i + CHUNK_SIZE]
        execute_values(cur, """
            INSERT INTO transfermarkt_valuations (person_id, transfermarkt_id, date, market_value_eur, club_name, club_id, competition_id)
            VALUES %s
            ON CONFLICT (person_id, date) DO UPDATE SET
                market_value_eur = EXCLUDED.market_value_eur,
                club_name = EXCLUDED.club_name,
                club_id = EXCLUDED.club_id
        """, chunk)
        written += len(chunk)
    print(f"  Wrote {written:,} valuation records")
elif val_rows:
    print(f"  [DRY RUN] Would write {len(val_rows):,} valuation records")

# ── Step 7: Update transfermarkt_id on people for new matches ─────────────────

if new_links and not DRY_RUN:
    print("\nStep 7: Updating transfermarkt_id on people table...")
    update_count = 0
    for pid, tm_id, _, _ in new_links:
        cur.execute(
            "UPDATE people SET transfermarkt_id = %s WHERE id = %s AND (transfermarkt_id IS NULL OR transfermarkt_id = '')",
            (tm_id, pid)
        )
        update_count += cur.rowcount
    print(f"  Updated {update_count:,} people with transfermarkt_id")

# ── Step 8: Set contract tags on player_status ───────────────────────────────

print("\nStep 8: Setting contract tags...")

today_str = datetime.now().strftime("%Y-%m-%d")
current_year = datetime.now().year

tag_updates = []
for pid, _, _, expiry, _ in market_updates:
    if not expiry:
        continue
    if expiry < today_str:
        tag_updates.append((pid, "Free Agent"))
    elif expiry[:4] == str(current_year):
        tag_updates.append((pid, "Expiring"))
    elif expiry[:4] == str(current_year + 1):
        tag_updates.append((pid, "One Year Left"))

if tag_updates and not DRY_RUN:
    for pid, tag in tag_updates:
        cur.execute("""
            INSERT INTO player_status (person_id, contract_tag)
            VALUES (%s, %s)
            ON CONFLICT (person_id) DO UPDATE SET contract_tag = EXCLUDED.contract_tag
        """, (pid, tag))
    from collections import Counter as TagCounter
    tag_counts = TagCounter(t for _, t in tag_updates)
    print(f"  Set contract tags for {len(tag_updates):,} players")
    for tag, count in tag_counts.most_common():
        print(f"    {tag}: {count:,}")
elif tag_updates:
    from collections import Counter as TagCounter
    tag_counts = TagCounter(t for _, t in tag_updates)
    print(f"  [DRY RUN] Would set {len(tag_updates):,} contract tags")
    for tag, count in tag_counts.most_common():
        print(f"    {tag}: {count:,}")
else:
    print("  No contract tags to set")

# ── Summary ───────────────────────────────────────────────────────────────────

print("\n=== Summary ===")
print(f"  TM players downloaded:  {len(tm_players):,}")
print(f"  TM valuations downloaded: {len(tm_valuations):,}")
print(f"  Matched to people:     {total_matched:,}")
print(f"    - by transfermarkt_id: {matched_by_tmid:,}")
print(f"    - by existing links:   {matched_by_link:,}")
print(f"    - by name matching:    {matched_by_name:,}")
print(f"  Unmatched:              {unmatched:,}")
print(f"  Market values updated:  {len(market_updates):,}")
print(f"  Valuations imported:    {len(val_rows):,}")
print(f"  Contract tags set:      {len(tag_updates):,}")
if DRY_RUN:
    print("  ** DRY RUN — no data written **")

cur.close()
conn.close()
print("\nDone.")
