"""
43_ingest_transfers.py — Ingest transfers from CSV or JSON file.

Validates required fields, normalises league names, derives window from
transfer_date, attempts player_id matching, and upserts to Supabase.

Requires: migration 030_transfers.sql

Usage:
    python 43_ingest_transfers.py --file transfers.csv --dry-run
    python 43_ingest_transfers.py --file transfers.json
    python 43_ingest_transfers.py --file transfers.csv --force
"""
import argparse
import csv
import json
import sys
from datetime import date
from pathlib import Path

import psycopg2
from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Ingest transfer records from CSV/JSON")
parser.add_argument("--file", required=True, help="Path to CSV or JSON file")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Overwrite existing records")
args = parser.parse_args()

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

# ── League normalisation ────────────────────────────────────────────────────

LEAGUE_ALIASES = {
    "epl": "Premier League",
    "english premier league": "Premier League",
    "pl": "Premier League",
    "la liga": "La Liga",
    "laliga": "La Liga",
    "serie a": "Serie A",
    "bundesliga": "Bundesliga",
    "ligue 1": "Ligue 1",
    "ligue1": "Ligue 1",
    "eredivisie": "Eredivisie",
    "primeira liga": "Primeira Liga",
    "liga portugal": "Primeira Liga",
    "süper lig": "Süper Lig",
    "super lig": "Süper Lig",
    "saudi pro league": "Saudi Pro League",
    "spl": "Saudi Pro League",
    "brasileirão": "Brasileirão",
    "brasileirao": "Brasileirão",
    "championship": "Championship",
    "mls": "MLS",
}

def normalise_league(raw: str | None) -> str | None:
    if not raw or raw.strip() in ("", "—", "-", "None"):
        return None
    return LEAGUE_ALIASES.get(raw.strip().lower(), raw.strip())


def derive_window(transfer_date_str: str) -> str:
    """Derive window from transfer_date: Jan-Feb = YYYY_jan, Jun-Sep = YYYY_summer."""
    parts = transfer_date_str.split("-")
    year, month = int(parts[0]), int(parts[1])
    if month in (1, 2):
        return f"{year}_jan"
    elif month in (6, 7, 8, 9):
        return f"{year}_summer"
    else:
        return f"{year}_other"


REQUIRED_FIELDS = ["player_name", "from_club", "to_club", "transfer_date", "fee_type"]

VALID_FEE_TYPES = {
    "permanent", "loan", "loan_obligation", "loan_option",
    "free", "swap", "pre_agreed", "undisclosed",
}

VALID_DEAL_CONTEXTS = {
    "release_clause", "transfer_request", "contract_expiring",
    "mutual_termination", "club_decision", "player_surplus",
    "financial_distress", "pre_contract", "loan_recall", "other",
}


# ── Load file ────────────────────────────────────────────────────────────────

filepath = Path(args.file)
if not filepath.exists():
    print(f"ERROR: File not found: {filepath}")
    sys.exit(1)

records = []
if filepath.suffix.lower() == ".json":
    with open(filepath) as f:
        records = json.load(f)
elif filepath.suffix.lower() == ".csv":
    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert empty strings to None
            records.append({k: (v.strip() if v and v.strip() else None) for k, v in row.items()})
else:
    print(f"ERROR: Unsupported file type: {filepath.suffix}. Use .csv or .json")
    sys.exit(1)

print(f"Loaded {len(records)} records from {filepath.name}")

# ── Connect ──────────────────────────────────────────────────────────────────

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# People lookup for player_id matching
cur.execute("SELECT id, name, date_of_birth FROM people")
people_lookup = {}
for pid, name, dob in cur.fetchall():
    people_lookup[name.lower().strip()] = (pid, dob)


def compute_age(dob, transfer_date_str):
    if not dob or not transfer_date_str:
        return None
    if isinstance(dob, str):
        p = dob.split("-")
        dob = date(int(p[0]), int(p[1]), int(p[2]))
    p = transfer_date_str.split("-")
    td = date(int(p[0]), int(p[1]), int(p[2]))
    age = td.year - dob.year
    if (td.month, td.day) < (dob.month, dob.day):
        age -= 1
    return age


# ── Process records ──────────────────────────────────────────────────────────

inserted = 0
errors = 0
skipped = 0

for i, rec in enumerate(records, 1):
    # Validate required fields
    missing = [f for f in REQUIRED_FIELDS if not rec.get(f)]
    if missing:
        print(f"  ROW {i} ERROR: Missing required fields: {', '.join(missing)} — {rec.get('player_name', '?')}")
        errors += 1
        continue

    # Validate fee_type
    fee_type = rec["fee_type"].strip().lower()
    if fee_type not in VALID_FEE_TYPES:
        print(f"  ROW {i} ERROR: Invalid fee_type '{fee_type}' — {rec['player_name']}")
        errors += 1
        continue

    # Validate deal_context if provided
    deal_context = rec.get("deal_context")
    if deal_context:
        deal_context = deal_context.strip().lower()
        if deal_context not in VALID_DEAL_CONTEXTS:
            print(f"  ROW {i} WARNING: Invalid deal_context '{deal_context}' — {rec['player_name']}. Setting to NULL.")
            deal_context = None

    # Normalise leagues
    from_league = normalise_league(rec.get("from_league"))
    to_league = normalise_league(rec.get("to_league"))

    # Derive window
    window = rec.get("window") or derive_window(rec["transfer_date"])

    # Parse fee
    fee_eur_m = rec.get("fee_eur_m")
    if fee_eur_m is not None and fee_eur_m != "":
        try:
            fee_eur_m = float(fee_eur_m)
        except ValueError:
            print(f"  ROW {i} WARNING: Invalid fee_eur_m '{fee_eur_m}' — {rec['player_name']}. Setting to NULL.")
            fee_eur_m = None
    else:
        fee_eur_m = None

    # Match player
    key = rec["player_name"].lower().strip()
    player_id = None
    age_at_transfer = rec.get("age_at_transfer")

    if key in people_lookup:
        player_id, dob = people_lookup[key]
        if not age_at_transfer:
            age_at_transfer = compute_age(dob, rec["transfer_date"])
    elif age_at_transfer:
        try:
            age_at_transfer = int(age_at_transfer)
        except ValueError:
            age_at_transfer = None

    if args.dry_run:
        status = "MATCH" if player_id else "NO MATCH"
        print(f"  [{status}] {rec['player_name']} → {rec['to_club']} ({fee_type}, €{fee_eur_m or '?'}m)")
        inserted += 1
        continue

    try:
        cur.execute("""
            INSERT INTO transfers (
                player_name, player_id, age_at_transfer, position,
                from_club, from_league, to_club, to_league,
                fee_eur_m, fee_type, deal_context,
                loan_fee_eur_m, obligation_fee_eur_m, contract_years,
                transfer_date, window, primary_archetype, notes, source_url
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            ON CONFLICT (player_name, transfer_date, to_club) DO UPDATE SET
                player_id = EXCLUDED.player_id,
                age_at_transfer = EXCLUDED.age_at_transfer,
                position = EXCLUDED.position,
                from_league = EXCLUDED.from_league,
                to_league = EXCLUDED.to_league,
                fee_eur_m = EXCLUDED.fee_eur_m,
                fee_type = EXCLUDED.fee_type,
                deal_context = EXCLUDED.deal_context,
                loan_fee_eur_m = EXCLUDED.loan_fee_eur_m,
                obligation_fee_eur_m = EXCLUDED.obligation_fee_eur_m,
                contract_years = EXCLUDED.contract_years,
                window = EXCLUDED.window,
                primary_archetype = EXCLUDED.primary_archetype,
                notes = EXCLUDED.notes,
                source_url = EXCLUDED.source_url
        """, (
            rec["player_name"], player_id, age_at_transfer, rec.get("position"),
            rec["from_club"], from_league, rec["to_club"], to_league,
            fee_eur_m, fee_type, deal_context,
            rec.get("loan_fee_eur_m"), rec.get("obligation_fee_eur_m"), rec.get("contract_years"),
            rec["transfer_date"], window, rec.get("primary_archetype"), rec.get("notes"), rec.get("source_url"),
        ))
        inserted += 1
    except Exception as e:
        print(f"  ROW {i} ERROR: {e} — {rec['player_name']}")
        errors += 1

# ── Summary ──────────────────────────────────────────────────────────────────

print(f"\n{'DRY RUN — ' if args.dry_run else ''}Summary:")
print(f"  Processed: {inserted}")
print(f"  Errors:    {errors}")
print(f"  Total:     {len(records)}")

cur.close()
conn.close()
