"""
49_kaggle_injuries.py — Ingest European Football Injuries 2020-2025.

Source: https://www.kaggle.com/datasets/sananmuzaffarov/european-football-injuries-2020-2025

Download and place CSV file(s) in:
    imports/kaggle/injuries/

Writes to: kaggle_injuries table + updates player_status fitness tags
and player_trait_scores for matched players.

Usage:
    python 49_kaggle_injuries.py                  # full run
    python 49_kaggle_injuries.py --dry-run        # preview, no writes
    python 49_kaggle_injuries.py --force           # overwrite existing
    python 49_kaggle_injuries.py --limit 100
    python 49_kaggle_injuries.py --tags            # also update player_status fitness tags
    python 49_kaggle_injuries.py --traits          # also update player_trait_scores
"""
import argparse
import csv
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

from config import POSTGRES_DSN, IMPORTS_DIR

# ── CLI ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest Kaggle European football injuries")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
parser.add_argument("--limit", type=int, default=0)
parser.add_argument("--tags", action="store_true", help="Update player_status fitness tags")
parser.add_argument("--traits", action="store_true", help="Update player_trait_scores durability")
parser.add_argument("--file", type=str, help="Specific CSV file")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
LIMIT = args.limit
UPDATE_TAGS = args.tags
UPDATE_TRAITS = args.traits
CHUNK_SIZE = 500

DATA_DIR = IMPORTS_DIR / "kaggle" / "injuries"


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


def safe_date(val):
    if not val or val == "nan" or val == "":
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d.%m.%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(val).strip()[:10], fmt).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            continue
    return None


# Column mapping — injury datasets vary wildly
COLUMN_MAP = {
    "player_name": ["player", "player_name", "name", "Player", "Name", "player_name"],
    "club": ["club", "team", "Club", "Team", "squad", "Squad"],
    "league": ["league", "competition", "League", "Competition", "comp"],
    "nation": ["nationality", "nation", "Nationality", "Nation", "country"],
    "position": ["position", "pos", "Position", "Pos"],
    "age": ["age", "Age"],
    "injury_type": ["injury", "injury_type", "Injury", "injury_name", "type", "Type", "diagnosis"],
    "injury_area": ["body_part", "injury_area", "area", "Area", "body_area", "location"],
    "severity": ["severity", "Severity", "injury_severity", "class"],
    "days_missed": ["days", "days_missed", "days_out", "Days", "duration", "Duration", "days_injured"],
    "games_missed": ["games_missed", "matches_missed", "Games Missed", "games", "games_out"],
    "season": ["season", "Season"],
    "date_from": ["from", "date_from", "start_date", "injury_date", "date", "Date", "From"],
    "date_until": ["until", "date_until", "end_date", "return_date", "Until", "To"],
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


# ── Main ──────────────────────────────────────────────────────────────────────

print("\n=== Kaggle European Football Injuries Ingest ===\n")

csv_files = []
if args.file:
    p = Path(args.file)
    csv_files = [p] if p.exists() else []
elif DATA_DIR.exists():
    csv_files = sorted(DATA_DIR.glob("*.csv")) + sorted(DATA_DIR.glob("*.CSV"))

if not csv_files:
    print(f"ERROR: No CSV files found in {DATA_DIR}/")
    print(f"Download from: https://www.kaggle.com/datasets/sananmuzaffarov/european-football-injuries-2020-2025")
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
CREATE TABLE IF NOT EXISTS kaggle_injuries (
    id              bigserial PRIMARY KEY,
    player_name     text NOT NULL,
    club            text,
    league          text,
    nation          text,
    position        text,
    age             integer,
    injury_type     text,
    injury_area     text,
    severity        text,
    days_missed     integer,
    games_missed    integer,
    season          text,
    date_from       date,
    date_until      date,
    raw_json        jsonb,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
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
matched_person_ids = set()

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

    print(f"  {len(rows):,} rows, {len(reader.fieldnames)} columns")
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
                matched_person_ids.add(person_id)

        batch.append((
            player_name,
            row.get("club"),
            row.get("league"),
            row.get("nation"),
            row.get("position"),
            safe_int(row.get("age")),
            row.get("injury_type"),
            row.get("injury_area"),
            row.get("severity"),
            safe_int(row.get("days_missed")),
            safe_int(row.get("games_missed")),
            row.get("season"),
            safe_date(row.get("date_from")),
            safe_date(row.get("date_until")),
            row.get("raw_json"),
            person_id,
        ))

    if batch and not DRY_RUN:
        for i in range(0, len(batch), CHUNK_SIZE):
            chunk = batch[i:i + CHUNK_SIZE]
            execute_values(cur, """
                INSERT INTO kaggle_injuries (
                    player_name, club, league, nation, position, age,
                    injury_type, injury_area, severity,
                    days_missed, games_missed, season,
                    date_from, date_until, raw_json, person_id
                ) VALUES %s
            """, chunk)
            inserted += len(chunk)
        print(f"  Inserted {len(batch):,} rows")
    elif batch:
        print(f"  [DRY RUN] Would insert {len(batch):,} rows")

# ── Fitness tags ──────────────────────────────────────────────────────────────

if UPDATE_TAGS and matched_person_ids and not DRY_RUN:
    print("\nUpdating player_status fitness tags...")
    # Compute injury summary per player
    cur.execute("""
        SELECT person_id,
               count(*) as total,
               coalesce(sum(days_missed), 0) as total_days,
               coalesce(sum(games_missed), 0) as total_games
        FROM kaggle_injuries
        WHERE person_id IS NOT NULL
        GROUP BY person_id
    """)
    tag_updates = 0
    for pid, total, total_days, total_games in cur.fetchall():
        if total >= 8 or total_days >= 300:
            tag = "Injury Prone"
        elif total >= 5 or total_days >= 150:
            tag = "Moderate Risk"
        elif total <= 2 and total_days < 30:
            tag = "Iron Man"
        else:
            tag = "Normal"

        cur.execute("""
            INSERT INTO player_status (person_id, fitness)
            VALUES (%s, %s)
            ON CONFLICT (person_id) DO UPDATE SET fitness = EXCLUDED.fitness
        """, (pid, tag))
        tag_updates += 1
    print(f"  Updated {tag_updates:,} fitness tags")
elif UPDATE_TAGS and matched_person_ids:
    print(f"\n[DRY RUN] Would update fitness tags for {len(matched_person_ids):,} players")

# ── Durability trait scores ───────────────────────────────────────────────────

if UPDATE_TRAITS and matched_person_ids and not DRY_RUN:
    print("\nUpdating player_trait_scores for durability...")
    cur.execute("""
        SELECT person_id,
               count(*) as total,
               coalesce(sum(days_missed), 0) as total_days,
               count(DISTINCT season) as seasons
        FROM kaggle_injuries
        WHERE person_id IS NOT NULL
        GROUP BY person_id
    """)
    trait_rows = []
    for pid, total, total_days, seasons in cur.fetchall():
        # Durability: 10 = extremely durable, 1 = extremely fragile
        # Scale: 0 injuries/season = 10, 4+ injuries/season = 1
        injuries_per_season = total / max(seasons, 1)
        durability = max(1, min(10, int(10 - injuries_per_season * 2)))

        # Availability: based on days missed per season
        days_per_season = total_days / max(seasons, 1)
        availability = max(1, min(10, int(10 - days_per_season / 30)))

        trait_rows.append((pid, "durability", "physical", durability, "kaggle_injuries"))
        trait_rows.append((pid, "availability", "physical", availability, "kaggle_injuries"))

    if trait_rows:
        execute_values(cur, """
            INSERT INTO player_trait_scores (player_id, trait, category, severity, source)
            VALUES %s
            ON CONFLICT (player_id, trait, source) DO UPDATE SET
                severity = EXCLUDED.severity,
                category = EXCLUDED.category
        """, trait_rows)
        print(f"  Wrote {len(trait_rows):,} trait scores")
elif UPDATE_TRAITS and matched_person_ids:
    print(f"\n[DRY RUN] Would compute trait scores for {len(matched_person_ids):,} players")

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\n=== Summary ===")
print(f"  Total injury rows:  {total_rows:,}")
print(f"  Matched to people:  {matched:,}")
print(f"  Unique players:     {len(matched_person_ids):,}")
print(f"  Inserted:           {inserted:,}")

# Show injury type breakdown if we have data
if inserted > 0 and not DRY_RUN:
    cur.execute("""
        SELECT injury_type, count(*) as cnt
        FROM kaggle_injuries
        WHERE injury_type IS NOT NULL
        GROUP BY injury_type
        ORDER BY cnt DESC
        LIMIT 10
    """)
    top_injuries = cur.fetchall()
    if top_injuries:
        print(f"\n  Top injury types:")
        for itype, cnt in top_injuries:
            print(f"    {itype}: {cnt:,}")

if DRY_RUN:
    print("  ** DRY RUN — no data written **")

cur.close()
conn.close()
print("\nDone.")
