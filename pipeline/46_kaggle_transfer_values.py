"""
46_kaggle_transfer_values.py — Ingest Kaggle Football Transfer Value Intelligence.

Source: https://www.kaggle.com/datasets/kanchana1990/football-transfer-value-intelligence-2024

Download and place CSV file(s) in:
    imports/kaggle/transfer_values/

Writes to: kaggle_transfer_values + enriches player_market for matched players.

Usage:
    python 46_kaggle_transfer_values.py                  # full run
    python 46_kaggle_transfer_values.py --dry-run        # preview, no writes
    python 46_kaggle_transfer_values.py --force           # overwrite existing
    python 46_kaggle_transfer_values.py --enrich          # also update player_market
    python 46_kaggle_transfer_values.py --limit 100
"""
import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

from config import POSTGRES_DSN, IMPORTS_DIR

# ── CLI ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest Kaggle transfer value data")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
parser.add_argument("--enrich", action="store_true", help="Also update player_market for matched players")
parser.add_argument("--limit", type=int, default=0)
parser.add_argument("--file", type=str, help="Specific CSV file")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
ENRICH = args.enrich
LIMIT = args.limit
CHUNK_SIZE = 500

DATA_DIR = IMPORTS_DIR / "kaggle" / "transfer_values"


def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower().strip()
    name = re.sub(r"[^a-z\s]", "", name)
    name = re.sub(r"\s+", " ", name)
    return name


def safe_int(val, default=None):
    if val is None or val == "" or val == "nan":
        return default
    try:
        # Handle "€50M" style values
        val = str(val).replace("€", "").replace(",", "").strip()
        if val.upper().endswith("M"):
            return int(float(val[:-1]) * 1_000_000)
        if val.upper().endswith("K"):
            return int(float(val[:-1]) * 1_000)
        return int(float(val))
    except (ValueError, TypeError):
        return default


def safe_float(val, default=None):
    if val is None or val == "" or val == "nan":
        return default
    try:
        return float(str(val).replace(",", ""))
    except (ValueError, TypeError):
        return default


# Transfer value datasets have wildly varying column names
COLUMN_MAP = {
    "player_name": ["player_name", "name", "player", "Player", "Name"],
    "club": ["club", "team", "current_club", "Club", "Team", "squad"],
    "league": ["league", "competition", "comp", "League", "Competition"],
    "nation": ["nationality", "nation", "country", "Nation", "Nationality"],
    "position": ["position", "pos", "Position", "Pos"],
    "age": ["age", "Age"],
    "market_value_eur": ["market_value", "market_value_in_eur", "Market Value", "market_value_eur", "value"],
    "highest_value_eur": ["highest_market_value", "highest_market_value_in_eur", "Highest Value", "peak_value"],
    "transfer_fee_eur": ["transfer_fee", "fee", "Transfer Fee", "transfer_fee_eur"],
    "contract_expiry": ["contract_expiry", "contract_expiration", "contract_until", "Contract Expires", "contract"],
    "joined_date": ["joined", "joined_date", "Joined", "date_joined"],
    "agent": ["agent", "agent_name", "Agent"],
    "outfitter": ["outfitter", "Outfitter", "kit_supplier"],
    "goals": ["goals", "Gls", "gls"],
    "assists": ["assists", "Ast", "ast"],
    "matches": ["matches", "appearances", "MP", "mp", "games"],
    "minutes": ["minutes", "Min", "min"],
}


def map_row(raw_row: dict) -> dict:
    mapped = {}
    raw_lower = {k.strip().lower(): k for k in raw_row.keys()}
    for our_col, variants in COLUMN_MAP.items():
        for variant in variants:
            if variant in raw_row:
                mapped[our_col] = raw_row[variant]
                break
            if variant.lower() in raw_lower:
                mapped[our_col] = raw_row[raw_lower[variant.lower()]]
                break
    mapped["raw_json"] = json.dumps(raw_row)
    return mapped


def find_csv_files() -> list[Path]:
    if args.file:
        p = Path(args.file)
        return [p] if p.exists() else []
    if not DATA_DIR.exists():
        return []
    return sorted(DATA_DIR.glob("*.csv")) + sorted(DATA_DIR.glob("*.CSV"))


# ── Main ──────────────────────────────────────────────────────────────────────

print("\n=== Kaggle Transfer Value Intelligence Ingest ===\n")

csv_files = find_csv_files()
if not csv_files:
    print(f"ERROR: No CSV files found in {DATA_DIR}/")
    print(f"Download from: https://www.kaggle.com/datasets/kanchana1990/football-transfer-value-intelligence-2024")
    print(f"Place CSV files in: {DATA_DIR}/")
    sys.exit(1)

print(f"Found {len(csv_files)} CSV file(s)")

if not POSTGRES_DSN:
    print("ERROR: POSTGRES_DSN not set")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# Ensure table exists
cur.execute("""
CREATE TABLE IF NOT EXISTS kaggle_transfer_values (
    id              bigserial PRIMARY KEY,
    player_name     text NOT NULL,
    club            text,
    league          text,
    nation          text,
    position        text,
    age             integer,
    market_value_eur bigint,
    highest_value_eur bigint,
    transfer_fee_eur bigint,
    contract_expiry text,
    joined_date     text,
    agent           text,
    outfitter       text,
    goals           integer,
    assists         integer,
    matches         integer,
    minutes         integer,
    raw_json        jsonb,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (player_name, club, league)
)
""")

# Build people lookup
print("Building player matching index...")
cur.execute("SELECT id, name FROM people")
people_rows = cur.fetchall()
name_to_person: dict[str, list[int]] = {}
for pid, pname in people_rows:
    norm = normalize_name(pname)
    if norm not in name_to_person:
        name_to_person[norm] = []
    name_to_person[norm].append(pid)
print(f"  {len(people_rows):,} people indexed")

total_rows = 0
matched = 0
inserted = 0
market_enriched = 0

for csv_file in csv_files:
    print(f"\nProcessing: {csv_file.name}")

    with open(csv_file, "r", encoding="utf-8-sig", errors="replace") as f:
        sample = f.read(4096)
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    with open(csv_file, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        rows = list(reader)

    print(f"  {len(rows):,} rows, {len(reader.fieldnames or [])} columns")
    if reader.fieldnames:
        print(f"  Columns: {', '.join(reader.fieldnames[:15])}{'...' if len(reader.fieldnames) > 15 else ''}")

    batch = []
    enrich_batch = []

    for i, raw_row in enumerate(rows):
        if LIMIT and i >= LIMIT:
            break

        row = map_row(raw_row)
        player_name = (row.get("player_name") or "").strip()
        if not player_name:
            continue

        total_rows += 1

        # Match to people
        person_id = None
        norm = normalize_name(player_name)
        if norm in name_to_person:
            candidates = name_to_person[norm]
            if len(candidates) == 1:
                person_id = candidates[0]
                matched += 1

        mv = safe_int(row.get("market_value_eur"))
        hv = safe_int(row.get("highest_value_eur"))
        tf = safe_int(row.get("transfer_fee_eur"))

        batch.append((
            player_name,
            row.get("club"),
            row.get("league"),
            row.get("nation"),
            row.get("position"),
            safe_int(row.get("age")),
            mv, hv, tf,
            row.get("contract_expiry"),
            row.get("joined_date"),
            row.get("agent"),
            row.get("outfitter"),
            safe_int(row.get("goals")),
            safe_int(row.get("assists")),
            safe_int(row.get("matches")),
            safe_int(row.get("minutes")),
            row.get("raw_json"),
            person_id,
        ))

        # Collect enrichment data for matched players
        if person_id and ENRICH and mv:
            enrich_batch.append((person_id, mv, hv, tf))

    # Insert raw data
    if batch and not DRY_RUN:
        conflict = "DO UPDATE SET raw_json = EXCLUDED.raw_json, market_value_eur = EXCLUDED.market_value_eur, person_id = COALESCE(EXCLUDED.person_id, kaggle_transfer_values.person_id)" if FORCE else "DO NOTHING"
        for i in range(0, len(batch), CHUNK_SIZE):
            chunk = batch[i:i + CHUNK_SIZE]
            execute_values(cur, f"""
                INSERT INTO kaggle_transfer_values (
                    player_name, club, league, nation, position, age,
                    market_value_eur, highest_value_eur, transfer_fee_eur,
                    contract_expiry, joined_date, agent, outfitter,
                    goals, assists, matches, minutes,
                    raw_json, person_id
                ) VALUES %s
                ON CONFLICT (player_name, club, league) {conflict}
            """, chunk)
            inserted += len(chunk)
        print(f"  Inserted {len(batch):,} rows")
    elif batch:
        print(f"  [DRY RUN] Would insert {len(batch):,} rows")

    # Enrich player_market
    if enrich_batch and not DRY_RUN:
        for pid, mv, hv, tf in enrich_batch:
            cur.execute("""
                INSERT INTO player_market (person_id, market_value_eur, highest_market_value_eur, transfer_fee_eur)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (person_id) DO UPDATE SET
                    market_value_eur = COALESCE(EXCLUDED.market_value_eur, player_market.market_value_eur),
                    highest_market_value_eur = COALESCE(EXCLUDED.highest_market_value_eur, player_market.highest_market_value_eur),
                    transfer_fee_eur = COALESCE(EXCLUDED.transfer_fee_eur, player_market.transfer_fee_eur),
                    updated_at = now()
            """, (pid, mv, hv, tf))
            market_enriched += 1
        print(f"  Enriched {market_enriched:,} player_market rows")
    elif enrich_batch:
        print(f"  [DRY RUN] Would enrich {len(enrich_batch):,} player_market rows")

print(f"\n=== Summary ===")
print(f"  Total rows:        {total_rows:,}")
print(f"  Matched to people: {matched:,}")
print(f"  Inserted:          {inserted:,}")
print(f"  Market enriched:   {market_enriched:,}")
if DRY_RUN:
    print("  ** DRY RUN — no data written **")

cur.close()
conn.close()
print("\nDone.")
