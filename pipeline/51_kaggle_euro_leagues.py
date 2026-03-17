"""
45_kaggle_euro_leagues.py — Ingest Kaggle European Top Leagues Player Stats 25-26.

Source: https://www.kaggle.com/datasets/kaanyorgun/european-top-leagues-player-stats-25-26

Download the dataset from Kaggle and place CSV file(s) in:
    imports/kaggle/euro_leagues/

Usage:
    python 45_kaggle_euro_leagues.py                  # full run
    python 45_kaggle_euro_leagues.py --dry-run        # preview, no writes
    python 45_kaggle_euro_leagues.py --force           # overwrite existing records
    python 45_kaggle_euro_leagues.py --limit 100       # process first N rows
    python 45_kaggle_euro_leagues.py --match-only      # only match to people, no raw insert
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

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest Kaggle European Top Leagues stats")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing records")
parser.add_argument("--limit", type=int, default=0, help="Limit rows to process")
parser.add_argument("--match-only", action="store_true", help="Only match players, skip raw insert")
parser.add_argument("--file", type=str, help="Specific CSV file to process")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
LIMIT = args.limit
MATCH_ONLY = args.match_only
CHUNK_SIZE = 500

# ── Paths ─────────────────────────────────────────────────────────────────────

DATA_DIR = IMPORTS_DIR / "kaggle" / "euro_leagues"

# ── Helpers ───────────────────────────────────────────────────────────────────


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


# ── Column mapping ────────────────────────────────────────────────────────────
# Kaggle datasets have inconsistent column names. We try multiple variants.

COLUMN_MAP = {
    "player_name": ["player", "player_name", "name", "Player"],
    "nation": ["nation", "nationality", "Nation", "Nationality", "country"],
    "position": ["pos", "position", "Position", "Pos"],
    "squad": ["squad", "team", "club", "Squad", "Team", "Club"],
    "league": ["league", "comp", "competition", "League", "Comp"],
    "age": ["age", "Age"],
    "born": ["born", "Born", "birth_year"],
    "matches_played": ["mp", "matches_played", "MP", "matches", "games"],
    "starts": ["starts", "Starts", "GS"],
    "minutes": ["min", "minutes", "Min", "Minutes", "90s"],
    "goals": ["gls", "goals", "Gls", "Goals"],
    "assists": ["ast", "assists", "Ast", "Assists"],
    "penalties_made": ["pk", "PK", "PKatt", "penalties_made", "pen_goals"],
    "penalties_att": ["pkatt", "PKatt", "penalties_att", "pen_att"],
    "yellow_cards": ["crdy", "CrdY", "yellow_cards", "yellows", "YC"],
    "red_cards": ["crdr", "CrdR", "red_cards", "reds", "RC"],
    "xg": ["xg", "xG", "expected_goals"],
    "npxg": ["npxg", "npxG", "non_penalty_xg"],
    "xa": ["xag", "xa", "xA", "xAG", "expected_assists"],
    "progressive_carries": ["prgc", "PrgC", "progressive_carries"],
    "progressive_passes": ["prgp", "PrgP", "progressive_passes"],
    "progressive_passes_received": ["prgr", "PrgR", "progressive_passes_received"],
    "goals_per90": ["gls_per90", "goals_per90", "Gls/90"],
    "assists_per90": ["ast_per90", "assists_per90", "Ast/90"],
    "xg_per90": ["xg_per90", "xG/90", "xg_90"],
    "xa_per90": ["xa_per90", "xA/90", "xag_per90"],
}


def map_row(raw_row: dict) -> dict:
    """Map CSV column names to our schema using flexible matching."""
    mapped = {}
    raw_lower = {k.strip().lower(): k for k in raw_row.keys()}

    for our_col, variants in COLUMN_MAP.items():
        for variant in variants:
            # Try exact match first
            if variant in raw_row:
                mapped[our_col] = raw_row[variant]
                break
            # Try case-insensitive
            if variant.lower() in raw_lower:
                mapped[our_col] = raw_row[raw_lower[variant.lower()]]
                break

    # Store full raw row as JSON for unmapped columns
    mapped["raw_json"] = json.dumps(raw_row)
    return mapped


# ── Find CSV files ────────────────────────────────────────────────────────────

def find_csv_files() -> list[Path]:
    if args.file:
        p = Path(args.file)
        return [p] if p.exists() else []
    if not DATA_DIR.exists():
        return []
    files = list(DATA_DIR.glob("*.csv"))
    files.extend(DATA_DIR.glob("*.CSV"))
    return sorted(files)


# ── Main ──────────────────────────────────────────────────────────────────────

print("\n=== Kaggle European Top Leagues Stats Ingest ===\n")

csv_files = find_csv_files()
if not csv_files:
    print(f"ERROR: No CSV files found in {DATA_DIR}/")
    print(f"Download from: https://www.kaggle.com/datasets/kaanyorgun/european-top-leagues-player-stats-25-26")
    print(f"Place CSV files in: {DATA_DIR}/")
    sys.exit(1)

print(f"Found {len(csv_files)} CSV file(s):")
for f in csv_files:
    print(f"  {f.name}")

# ── DB connection ─────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: POSTGRES_DSN not set")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# Ensure table exists
cur.execute("""
CREATE TABLE IF NOT EXISTS kaggle_euro_league_stats (
    id              bigserial PRIMARY KEY,
    player_name     text NOT NULL,
    nation          text,
    position        text,
    squad           text,
    league          text,
    season          text DEFAULT '2025-2026',
    age             integer,
    born            integer,
    matches_played  integer,
    starts          integer,
    minutes         integer,
    goals           integer,
    assists         integer,
    penalties_made  integer,
    penalties_att   integer,
    yellow_cards    integer,
    red_cards       integer,
    xg              real,
    npxg            real,
    xa              real,
    progressive_carries integer,
    progressive_passes  integer,
    progressive_passes_received integer,
    goals_per90     real,
    assists_per90   real,
    xg_per90        real,
    xa_per90        real,
    raw_json        jsonb,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (player_name, squad, league, season)
)
""")

# ── Build people lookup ───────────────────────────────────────────────────────

print("\nBuilding player matching index...")
cur.execute("SELECT id, name FROM people")
people_rows = cur.fetchall()
name_to_person: dict[str, list[int]] = {}
for pid, pname in people_rows:
    norm = normalize_name(pname)
    if norm not in name_to_person:
        name_to_person[norm] = []
    name_to_person[norm].append(pid)
print(f"  {len(people_rows):,} people indexed")

# ── Process CSV files ─────────────────────────────────────────────────────────

total_rows = 0
matched = 0
inserted = 0

for csv_file in csv_files:
    print(f"\nProcessing: {csv_file.name}")

    # Detect encoding / delimiter
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

        if MATCH_ONLY:
            continue

        batch.append((
            player_name,
            row.get("nation"),
            row.get("position"),
            row.get("squad"),
            row.get("league"),
            "2025-2026",
            safe_int(row.get("age")),
            safe_int(row.get("born")),
            safe_int(row.get("matches_played")),
            safe_int(row.get("starts")),
            safe_int(row.get("minutes")),
            safe_int(row.get("goals")),
            safe_int(row.get("assists")),
            safe_int(row.get("penalties_made")),
            safe_int(row.get("penalties_att")),
            safe_int(row.get("yellow_cards")),
            safe_int(row.get("red_cards")),
            safe_float(row.get("xg")),
            safe_float(row.get("npxg")),
            safe_float(row.get("xa")),
            safe_int(row.get("progressive_carries")),
            safe_int(row.get("progressive_passes")),
            safe_int(row.get("progressive_passes_received")),
            safe_float(row.get("goals_per90")),
            safe_float(row.get("assists_per90")),
            safe_float(row.get("xg_per90")),
            safe_float(row.get("xa_per90")),
            row.get("raw_json"),
            person_id,
        ))

    # Batch insert
    if batch and not DRY_RUN:
        conflict = "DO UPDATE SET raw_json = EXCLUDED.raw_json, person_id = COALESCE(EXCLUDED.person_id, kaggle_euro_league_stats.person_id), minutes = EXCLUDED.minutes, goals = EXCLUDED.goals, assists = EXCLUDED.assists, xg = EXCLUDED.xg, xa = EXCLUDED.xa" if FORCE else "DO NOTHING"
        for i in range(0, len(batch), CHUNK_SIZE):
            chunk = batch[i:i + CHUNK_SIZE]
            execute_values(cur, f"""
                INSERT INTO kaggle_euro_league_stats (
                    player_name, nation, position, squad, league, season,
                    age, born, matches_played, starts, minutes,
                    goals, assists, penalties_made, penalties_att,
                    yellow_cards, red_cards, xg, npxg, xa,
                    progressive_carries, progressive_passes, progressive_passes_received,
                    goals_per90, assists_per90, xg_per90, xa_per90,
                    raw_json, person_id
                ) VALUES %s
                ON CONFLICT (player_name, squad, league, season) {conflict}
            """, chunk)
            inserted += len(chunk)
        print(f"  Inserted {len(batch):,} rows")
    elif batch:
        print(f"  [DRY RUN] Would insert {len(batch):,} rows")

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\n=== Summary ===")
print(f"  Total player rows: {total_rows:,}")
print(f"  Matched to people: {matched:,}")
print(f"  Inserted/updated:  {inserted:,}")
if DRY_RUN:
    print("  ** DRY RUN — no data written **")

cur.close()
conn.close()
print("\nDone.")
