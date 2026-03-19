"""
48_kaggle_pl_stats.py — Ingest Kaggle Premier League 2024-2025 Data.

Source: https://www.kaggle.com/datasets/furkanark/premier-league-2024-2025-data

Download and place CSV file(s) in:
    imports/kaggle/pl_stats/

Handles both player-level stats and match-level data (auto-detected).

Usage:
    python 48_kaggle_pl_stats.py                  # full run
    python 48_kaggle_pl_stats.py --dry-run        # preview, no writes
    python 48_kaggle_pl_stats.py --force           # overwrite existing
    python 48_kaggle_pl_stats.py --limit 100
    python 48_kaggle_pl_stats.py --grades          # also compute attribute_grades
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

parser = argparse.ArgumentParser(description="Ingest Kaggle PL 2024-2025 data")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
parser.add_argument("--limit", type=int, default=0)
parser.add_argument("--grades", action="store_true", help="Also compute attribute grades for matched players")
parser.add_argument("--file", type=str, help="Specific CSV file")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
LIMIT = args.limit
GRADES = args.grades
CHUNK_SIZE = 500

DATA_DIR = IMPORTS_DIR / "kaggle" / "pl_stats"


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
        return int(float(str(val).replace(",", "")))
    except (ValueError, TypeError):
        return default


def safe_float(val, default=None):
    if val is None or val == "" or val == "nan":
        return default
    try:
        return float(str(val).replace(",", "").replace("%", ""))
    except (ValueError, TypeError):
        return default


PLAYER_COLUMNS = {
    "player_name": ["player", "player_name", "name", "Player", "Name"],
    "squad": ["squad", "team", "club", "Squad", "Team", "Club"],
    "position": ["pos", "position", "Position", "Pos"],
    "nation": ["nation", "nationality", "Nation", "Nationality"],
    "age": ["age", "Age"],
    "matches_played": ["mp", "matches_played", "MP", "matches", "Apps"],
    "starts": ["starts", "Starts", "GS"],
    "minutes": ["min", "minutes", "Min", "Minutes"],
    "goals": ["gls", "goals", "Gls", "Goals"],
    "assists": ["ast", "assists", "Ast", "Assists"],
    "yellow_cards": ["crdy", "CrdY", "yellow_cards", "yellows", "YC"],
    "red_cards": ["crdr", "CrdR", "red_cards", "reds", "RC"],
    "xg": ["xg", "xG", "expected_goals"],
    "xa": ["xag", "xa", "xA", "xAG"],
    "npxg": ["npxg", "npxG"],
    "progressive_carries": ["prgc", "PrgC", "progressive_carries"],
    "progressive_passes": ["prgp", "PrgP", "progressive_passes"],
    "tackles": ["tkl", "Tkl", "tackles", "Tackles"],
    "interceptions": ["int", "Int", "interceptions", "Interceptions"],
    "blocks": ["blocks", "Blocks", "Blk"],
    "sca": ["sca", "SCA", "shot_creating_actions"],
    "gca": ["gca", "GCA", "goal_creating_actions"],
    "pass_completion": ["cmp_pct", "pass_completion", "Pass%", "Cmp%", "pass_pct"],
    "aerial_won": ["won", "aerial_won", "Aerial Won"],
    "aerial_lost": ["lost", "aerial_lost", "Aerial Lost"],
}

MATCH_COLUMNS = {
    "match_date": ["date", "Date", "match_date"],
    "home_team": ["home", "Home", "home_team", "HomeTeam"],
    "away_team": ["away", "Away", "away_team", "AwayTeam"],
    "home_score": ["home_score", "FTHG", "HomeGoals", "home_goals"],
    "away_score": ["away_score", "FTAG", "AwayGoals", "away_goals"],
}


def detect_data_type(fieldnames: list[str]) -> str:
    fields_lower = set(f.lower().strip() for f in fieldnames)
    player_markers = {"player", "player_name", "name", "gls", "goals", "ast", "assists", "xg"}
    match_markers = {"home_team", "away_team", "hometeam", "awayteam", "fthg", "ftag", "home", "away"}

    player_hits = len(player_markers & fields_lower)
    match_hits = len(match_markers & fields_lower)

    if match_hits >= 2 and player_hits < 2:
        return "matches"
    return "players"


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


# ── Main ──────────────────────────────────────────────────────────────────────

print("\n=== Kaggle Premier League 2024-2025 Ingest ===\n")

csv_files = []
if args.file:
    p = Path(args.file)
    csv_files = [p] if p.exists() else []
elif DATA_DIR.exists():
    csv_files = sorted(DATA_DIR.glob("*.csv")) + sorted(DATA_DIR.glob("*.CSV"))

if not csv_files:
    print(f"ERROR: No CSV files found in {DATA_DIR}/")
    print(f"Download from: https://www.kaggle.com/datasets/furkanark/premier-league-2024-2025-data")
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
CREATE TABLE IF NOT EXISTS kaggle_pl_stats (
    id              bigserial PRIMARY KEY,
    player_name     text,
    squad           text,
    position        text,
    nation          text,
    age             integer,
    matches_played  integer,
    starts          integer,
    minutes         integer,
    goals           integer,
    assists         integer,
    yellow_cards    integer,
    red_cards       integer,
    xg              real,
    xa              real,
    npxg            real,
    progressive_carries integer,
    progressive_passes  integer,
    tackles         integer,
    interceptions   integer,
    blocks          integer,
    sca             real,
    gca             real,
    pass_completion real,
    aerial_won      integer,
    aerial_lost     integer,
    match_date      date,
    home_team       text,
    away_team       text,
    home_score      integer,
    away_score      integer,
    raw_json        jsonb,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    season          text DEFAULT '2024-2025',
    created_at      timestamptz NOT NULL DEFAULT now()
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

    data_type = detect_data_type(reader.fieldnames)
    print(f"  {len(rows):,} rows, detected type: {data_type}")
    print(f"  Columns: {', '.join(reader.fieldnames[:15])}{'...' if len(reader.fieldnames) > 15 else ''}")

    batch = []
    for i, raw_row in enumerate(rows):
        if LIMIT and i >= LIMIT:
            break

        if data_type == "players":
            row = map_row(raw_row, PLAYER_COLUMNS)
            player_name = (row.get("player_name") or "").strip()
            if not player_name:
                continue
            total_rows += 1

            person_id = None
            norm = normalize_name(player_name)
            if norm in name_to_person:
                candidates = name_to_person[norm]
                if len(candidates) == 1:
                    person_id = candidates[0]
                    matched += 1

            batch.append((
                player_name, row.get("squad"), row.get("position"), row.get("nation"),
                safe_int(row.get("age")),
                safe_int(row.get("matches_played")), safe_int(row.get("starts")),
                safe_int(row.get("minutes")),
                safe_int(row.get("goals")), safe_int(row.get("assists")),
                safe_int(row.get("yellow_cards")), safe_int(row.get("red_cards")),
                safe_float(row.get("xg")), safe_float(row.get("xa")),
                safe_float(row.get("npxg")),
                safe_int(row.get("progressive_carries")),
                safe_int(row.get("progressive_passes")),
                safe_int(row.get("tackles")), safe_int(row.get("interceptions")),
                safe_int(row.get("blocks")),
                safe_float(row.get("sca")), safe_float(row.get("gca")),
                safe_float(row.get("pass_completion")),
                safe_int(row.get("aerial_won")), safe_int(row.get("aerial_lost")),
                None, None, None, None, None,  # match columns null for player data
                row.get("raw_json"), person_id, "2024-2025",
            ))
        else:
            # Match data
            row = map_row(raw_row, MATCH_COLUMNS)
            total_rows += 1
            batch.append((
                None, None, None, None, None,  # player columns null
                None, None, None, None, None, None, None,
                None, None, None, None, None, None, None, None,
                None, None, None, None, None,
                row.get("match_date"),
                row.get("home_team"), row.get("away_team"),
                safe_int(row.get("home_score")), safe_int(row.get("away_score")),
                row.get("raw_json"), None, "2024-2025",
            ))

    if batch and not DRY_RUN:
        for i in range(0, len(batch), CHUNK_SIZE):
            chunk = batch[i:i + CHUNK_SIZE]
            execute_values(cur, """
                INSERT INTO kaggle_pl_stats (
                    player_name, squad, position, nation, age,
                    matches_played, starts, minutes, goals, assists,
                    yellow_cards, red_cards, xg, xa, npxg,
                    progressive_carries, progressive_passes,
                    tackles, interceptions, blocks, sca, gca,
                    pass_completion, aerial_won, aerial_lost,
                    match_date, home_team, away_team,
                    home_score, away_score,
                    raw_json, person_id, season
                ) VALUES %s
            """, chunk)
            inserted += len(chunk)
        print(f"  Inserted {len(batch):,} rows")
    elif batch:
        print(f"  [DRY RUN] Would insert {len(batch):,} rows")

# ── Optional: compute attribute grades ────────────────────────────────────────

if GRADES and not DRY_RUN:
    print("\nComputing attribute grades from PL stats...")
    cur.execute("""
        SELECT person_id, goals, assists, xg, xa, minutes, tackles, interceptions,
               progressive_carries, progressive_passes, pass_completion, sca
        FROM kaggle_pl_stats
        WHERE person_id IS NOT NULL AND minutes > 0
    """)
    grade_rows = cur.fetchall()
    grades = []
    for pid, goals, assists, xg, xa, mins, tkl, inter, prgc, prgp, cmp, sca_val in grade_rows:
        per90 = 90.0 / mins if mins else 0
        if goals is not None and xg is not None:
            finishing = min(20, max(1, int((goals * per90) * 30 + (xg * per90) * 20)))
            grades.append((pid, "Finishing", finishing, finishing, "kaggle_pl"))
        if assists is not None and xa is not None:
            vision = min(20, max(1, int((assists * per90) * 25 + (xa * per90) * 20)))
            grades.append((pid, "Vision", vision, vision, "kaggle_pl"))
        if tkl is not None and inter is not None:
            defending = min(20, max(1, int(((tkl or 0) + (inter or 0)) * per90 * 5)))
            grades.append((pid, "Tackling", defending, defending, "kaggle_pl"))

    if grades:
        execute_values(cur, """
            INSERT INTO attribute_grades (player_id, attribute, scout_grade, stat_score, source)
            VALUES %s
            ON CONFLICT (player_id, attribute, source) DO UPDATE SET
                scout_grade = EXCLUDED.scout_grade,
                stat_score = EXCLUDED.stat_score
        """, grades)
        print(f"  Computed {len(grades):,} attribute grades")

print(f"\n=== Summary ===")
print(f"  Total rows:        {total_rows:,}")
print(f"  Matched to people: {matched:,}")
print(f"  Inserted:          {inserted:,}")
if DRY_RUN:
    print("  ** DRY RUN — no data written **")

cur.close()
conn.close()
print("\nDone.")
