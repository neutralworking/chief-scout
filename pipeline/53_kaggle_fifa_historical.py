"""
47_kaggle_fifa_historical.py — Ingest FIFA & Football Complete Dataset (1930-2022).

Source: https://www.kaggle.com/datasets/zkskhurram/fifa-and-football-complete-dataset-19302022

Download and place CSV file(s) in:
    imports/kaggle/fifa_historical/

Contains: international match results, FIFA rankings, World Cup data.

Usage:
    python 47_kaggle_fifa_historical.py                  # full run
    python 47_kaggle_fifa_historical.py --dry-run        # preview, no writes
    python 47_kaggle_fifa_historical.py --force           # overwrite existing
    python 47_kaggle_fifa_historical.py --limit 1000
    python 47_kaggle_fifa_historical.py --matches-only    # skip rankings
    python 47_kaggle_fifa_historical.py --rankings-only   # skip matches
"""
import argparse
import csv
import json
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

from config import POSTGRES_DSN, IMPORTS_DIR

# ── CLI ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest FIFA historical dataset")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
parser.add_argument("--limit", type=int, default=0)
parser.add_argument("--matches-only", action="store_true")
parser.add_argument("--rankings-only", action="store_true")
parser.add_argument("--file", type=str, help="Specific CSV file")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
LIMIT = args.limit
CHUNK_SIZE = 500

DATA_DIR = IMPORTS_DIR / "kaggle" / "fifa_historical"


def safe_int(val, default=None):
    if val is None or val == "" or val == "nan":
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def safe_float(val, default=None):
    if val is None or val == "" or val == "nan":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def safe_bool(val, default=None):
    if val is None or val == "":
        return default
    return str(val).lower() in ("true", "1", "yes", "t")


# ── Column mappings ───────────────────────────────────────────────────────────

MATCH_COLUMNS = {
    "date": ["date", "Date"],
    "home_team": ["home_team", "Home Team", "home"],
    "away_team": ["away_team", "Away Team", "away"],
    "home_score": ["home_score", "Home Score", "home_goals"],
    "away_score": ["away_score", "Away Score", "away_goals"],
    "tournament": ["tournament", "Tournament", "competition"],
    "city": ["city", "City"],
    "country": ["country", "Country"],
    "neutral": ["neutral", "Neutral"],
    "home_xg": ["home_xg", "Home xG"],
    "away_xg": ["away_xg", "Away xG"],
    "home_penalty": ["home_penalty", "Home Penalty"],
    "away_penalty": ["away_penalty", "Away Penalty"],
}

RANKING_COLUMNS = {
    "rank": ["rank", "Rank", "ranking", "#"],
    "country_full": ["country_full", "Country", "country", "team", "Team"],
    "country_abrv": ["country_abrv", "Code", "code", "abbreviation"],
    "total_points": ["total_points", "Points", "points", "total_points"],
    "previous_points": ["previous_points", "Previous Points", "prev_points"],
    "rank_change": ["rank_change", "Rank Change", "change"],
    "confederation": ["confederation", "Confederation", "conf"],
    "rank_date": ["rank_date", "date", "Date"],
}


def map_row(raw_row: dict, col_map: dict) -> dict:
    mapped = {}
    raw_lower = {k.strip().lower(): k for k in raw_row.keys()}
    for our_col, variants in col_map.items():
        for variant in variants:
            if variant in raw_row:
                mapped[our_col] = raw_row[variant]
                break
            if variant.lower() in raw_lower:
                mapped[our_col] = raw_row[raw_lower[variant.lower()]]
                break
    mapped["raw_json"] = json.dumps(raw_row)
    return mapped


def detect_file_type(filepath: Path, fieldnames: list[str]) -> str:
    """Detect whether a CSV is matches, rankings, or world_cup data."""
    fn_lower = filepath.name.lower()
    fields_lower = [f.lower() for f in fieldnames]

    if "ranking" in fn_lower or "rank" in fields_lower:
        return "rankings"
    if "match" in fn_lower or "home_team" in fields_lower or "home_score" in fields_lower:
        return "matches"
    if "world_cup" in fn_lower:
        return "matches"

    # Fallback: check for key columns
    if any(f in fields_lower for f in ["home_team", "away_team", "home_score"]):
        return "matches"
    if any(f in fields_lower for f in ["rank", "ranking", "total_points"]):
        return "rankings"

    return "unknown"


# ── Main ──────────────────────────────────────────────────────────────────────

print("\n=== Kaggle FIFA Historical Dataset Ingest ===\n")

csv_files = []
if args.file:
    p = Path(args.file)
    csv_files = [p] if p.exists() else []
elif DATA_DIR.exists():
    csv_files = sorted(DATA_DIR.glob("*.csv")) + sorted(DATA_DIR.glob("*.CSV"))

if not csv_files:
    print(f"ERROR: No CSV files found in {DATA_DIR}/")
    print(f"Download from: https://www.kaggle.com/datasets/zkskhurram/fifa-and-football-complete-dataset-19302022")
    print(f"Place CSV files in: {DATA_DIR}/")
    sys.exit(1)

print(f"Found {len(csv_files)} CSV file(s)")

if not POSTGRES_DSN:
    print("ERROR: POSTGRES_DSN not set")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# Ensure tables exist
cur.execute("""
CREATE TABLE IF NOT EXISTS kaggle_fifa_matches (
    id              bigserial PRIMARY KEY,
    date            date,
    home_team       text NOT NULL,
    away_team       text NOT NULL,
    home_score      integer,
    away_score      integer,
    tournament      text,
    city            text,
    country         text,
    neutral         boolean,
    home_xg         real,
    away_xg         real,
    home_penalty    integer,
    away_penalty    integer,
    raw_json        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (date, home_team, away_team)
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS kaggle_fifa_rankings (
    id              bigserial PRIMARY KEY,
    rank            integer NOT NULL,
    country_full    text NOT NULL,
    country_abrv    text,
    total_points    real,
    previous_points real,
    rank_change     integer,
    confederation   text,
    rank_date       date,
    raw_json        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (country_full, rank_date)
)
""")

total_matches = 0
total_rankings = 0
inserted_matches = 0
inserted_rankings = 0

for csv_file in csv_files:
    print(f"\nProcessing: {csv_file.name}")

    with open(csv_file, "r", encoding="utf-8-sig", errors="replace") as f:
        sample = f.read(4096)
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    with open(csv_file, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        rows = list(reader)

    if not rows or not reader.fieldnames:
        print("  Empty file, skipping")
        continue

    file_type = detect_file_type(csv_file, reader.fieldnames)
    print(f"  {len(rows):,} rows, detected type: {file_type}")
    print(f"  Columns: {', '.join(reader.fieldnames[:12])}{'...' if len(reader.fieldnames) > 12 else ''}")

    if file_type == "matches" and not args.rankings_only:
        batch = []
        for i, raw_row in enumerate(rows):
            if LIMIT and i >= LIMIT:
                break
            row = map_row(raw_row, MATCH_COLUMNS)
            home = (row.get("home_team") or "").strip()
            away = (row.get("away_team") or "").strip()
            if not home or not away:
                continue
            total_matches += 1
            date_val = row.get("date")
            batch.append((
                date_val, home, away,
                safe_int(row.get("home_score")),
                safe_int(row.get("away_score")),
                row.get("tournament"),
                row.get("city"),
                row.get("country"),
                safe_bool(row.get("neutral")),
                safe_float(row.get("home_xg")),
                safe_float(row.get("away_xg")),
                safe_int(row.get("home_penalty")),
                safe_int(row.get("away_penalty")),
                row.get("raw_json"),
            ))

        if batch and not DRY_RUN:
            conflict = "DO UPDATE SET raw_json = EXCLUDED.raw_json, home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score" if FORCE else "DO NOTHING"
            for i in range(0, len(batch), CHUNK_SIZE):
                chunk = batch[i:i + CHUNK_SIZE]
                execute_values(cur, f"""
                    INSERT INTO kaggle_fifa_matches (
                        date, home_team, away_team, home_score, away_score,
                        tournament, city, country, neutral,
                        home_xg, away_xg, home_penalty, away_penalty, raw_json
                    ) VALUES %s
                    ON CONFLICT (date, home_team, away_team) {conflict}
                """, chunk)
                inserted_matches += len(chunk)
            print(f"  Inserted {len(batch):,} match rows")
        elif batch:
            print(f"  [DRY RUN] Would insert {len(batch):,} match rows")

    elif file_type == "rankings" and not args.matches_only:
        batch = []
        for i, raw_row in enumerate(rows):
            if LIMIT and i >= LIMIT:
                break
            row = map_row(raw_row, RANKING_COLUMNS)
            country = (row.get("country_full") or "").strip()
            rank = safe_int(row.get("rank"))
            if not country or not rank:
                continue
            total_rankings += 1
            batch.append((
                rank, country,
                row.get("country_abrv"),
                safe_float(row.get("total_points")),
                safe_float(row.get("previous_points")),
                safe_int(row.get("rank_change")),
                row.get("confederation"),
                row.get("rank_date"),
                row.get("raw_json"),
            ))

        if batch and not DRY_RUN:
            conflict = "DO UPDATE SET rank = EXCLUDED.rank, total_points = EXCLUDED.total_points" if FORCE else "DO NOTHING"
            for i in range(0, len(batch), CHUNK_SIZE):
                chunk = batch[i:i + CHUNK_SIZE]
                execute_values(cur, f"""
                    INSERT INTO kaggle_fifa_rankings (
                        rank, country_full, country_abrv, total_points,
                        previous_points, rank_change, confederation,
                        rank_date, raw_json
                    ) VALUES %s
                    ON CONFLICT (country_full, rank_date) {conflict}
                """, chunk)
                inserted_rankings += len(chunk)
            print(f"  Inserted {len(batch):,} ranking rows")
        elif batch:
            print(f"  [DRY RUN] Would insert {len(batch):,} ranking rows")
    else:
        print(f"  Skipped (type={file_type}, filters applied)")

print(f"\n=== Summary ===")
print(f"  Match rows:   {total_matches:,} parsed, {inserted_matches:,} inserted")
print(f"  Ranking rows: {total_rankings:,} parsed, {inserted_rankings:,} inserted")
if DRY_RUN:
    print("  ** DRY RUN — no data written **")

cur.close()
conn.close()
print("\nDone.")
