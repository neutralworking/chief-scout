"""
89_kaggle_to_transfers.py — Normalize kaggle_transfer_values into the transfers table.

Reads kaggle_transfer_values (market value intelligence from Transfermarkt via Kaggle),
cross-references player_career_history to identify actual club moves, and inserts
normalized transfer records.

For each matched player with career history:
  - Each club→club transition becomes a transfer row
  - fee_eur_m is estimated from the kaggle market value at approximate transfer time
  - from_club / to_club come from consecutive career history entries
  - position comes from player_profiles
  - archetype comes from player_profiles.earned_archetype

Usage:
    python 89_kaggle_to_transfers.py                # full run
    python 89_kaggle_to_transfers.py --dry-run      # preview, no writes
    python 89_kaggle_to_transfers.py --force         # overwrite existing kaggle rows
    python 89_kaggle_to_transfers.py --limit 50      # process first N players
"""
import argparse
import sys
from datetime import date

import psycopg2

from config import POSTGRES_DSN

# ── CLI ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Kaggle transfer values → transfers table")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing kaggle-sourced rows")
parser.add_argument("--limit", type=int, default=0, help="Limit to N players")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
LIMIT = args.limit

# ── Position mapping ─────────────────────────────────────────────────────────

POSITION_MAP = {
    "Centre-Back": "CD",
    "Left-Back": "WD",
    "Right-Back": "WD",
    "Defensive Midfield": "DM",
    "Central Midfield": "CM",
    "Attacking Midfield": "AM",
    "Left Winger": "WF",
    "Right Winger": "WF",
    "Left Midfield": "WM",
    "Right Midfield": "WM",
    "Centre-Forward": "CF",
    "Second Striker": "CF",
    "Goalkeeper": "GK",
}

# National team indicators — skip these as "clubs"
NATIONAL_TEAM_KEYWORDS = [
    "national", "olympic", "under-", "U-", "U1", "U2",
    "selection", "national team",
]


def is_national_team(club_name: str) -> bool:
    lower = club_name.lower()
    return any(kw.lower() in lower for kw in NATIONAL_TEAM_KEYWORDS)


def derive_window(dt: date) -> str:
    """Derive transfer_window from a date: YYYY_jan or YYYY_summer."""
    if dt.month <= 2:
        return f"{dt.year}_jan"
    elif 6 <= dt.month <= 8:
        return f"{dt.year}_summer"
    elif dt.month >= 11:
        # Late-year moves often registered in January
        return f"{dt.year + 1}_jan"
    else:
        # Mid-season: approximate to nearest window
        if dt.month <= 5:
            return f"{dt.year}_jan"
        else:
            return f"{dt.year}_summer"


def parse_market_value_str(val: str) -> float | None:
    """Parse '€200.00m' or '€300k' style strings to EUR."""
    if not val:
        return None
    val = val.strip().replace("€", "").replace(",", "")
    try:
        if val.lower().endswith("m"):
            return float(val[:-1]) * 1_000_000
        elif val.lower().endswith("k"):
            return float(val[:-1]) * 1_000
        return float(val)
    except (ValueError, TypeError):
        return None


# ── Main ─────────────────────────────────────────────────────────────────────

print("\n=== Kaggle Transfer Values → Transfers ===\n")

if not POSTGRES_DSN:
    print("ERROR: POSTGRES_DSN not set")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = False
cur = conn.cursor()

# 1. Load kaggle rows with person_id
print("Loading kaggle_transfer_values with person_id...")
cur.execute("""
    SELECT
        k.person_id,
        k.player_name,
        k.age,
        k.raw_json
    FROM kaggle_transfer_values k
    WHERE k.person_id IS NOT NULL
      AND k.raw_json IS NOT NULL
    ORDER BY k.person_id
""")
kaggle_rows = cur.fetchall()
print(f"  {len(kaggle_rows):,} matched players")

if LIMIT:
    kaggle_rows = kaggle_rows[:LIMIT]
    print(f"  Limited to {LIMIT}")

# 2. Load player_profiles for position + archetype
print("Loading player profiles...")
cur.execute("SELECT person_id, position, earned_archetype FROM player_profiles")
profiles = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
print(f"  {len(profiles):,} profiles loaded")

# 3. Load people for date_of_birth
print("Loading people DOB...")
cur.execute("SELECT id, date_of_birth FROM people")
people_dob = {r[0]: r[1] for r in cur.fetchall()}
print(f"  {len(people_dob):,} people loaded")

# 4. Load career history (club transitions only, skip national teams)
print("Loading career history...")
cur.execute("""
    SELECT person_id, club_name, start_date, end_date, is_loan, team_type
    FROM player_career_history
    WHERE team_type = 'senior_club'
    ORDER BY person_id, start_date NULLS LAST, sort_order
""")
career_by_person: dict[int, list[dict]] = {}
for pid, club, start, end, is_loan, ttype in cur.fetchall():
    if club and is_national_team(club):
        continue
    if pid not in career_by_person:
        career_by_person[pid] = []
    career_by_person[pid].append({
        "club": club,
        "start": start,
        "end": end,
        "is_loan": is_loan,
    })
# Sort each player's career chronologically: dated entries first, undated last
for pid in career_by_person:
    career_by_person[pid].sort(
        key=lambda c: (c["start"] is None, c["start"] or date.max)
    )
print(f"  {len(career_by_person):,} players with career data")

# 5. Check existing transfers (for conflict handling)
cur.execute("SELECT player_id, to_club, transfer_date, source FROM transfers")
existing = set()
seed_transfers = set()
for pid, to_club, tdate, src in cur.fetchall():
    key = (pid, to_club, str(tdate))
    existing.add(key)
    if src == "seed":
        seed_transfers.add(key)
print(f"  {len(existing):,} existing transfers ({len(seed_transfers):,} seed)")

# 6. Build transfer records
print("\nBuilding transfer records...")
transfers = []
skipped_no_career = 0
skipped_no_date = 0
skipped_national = 0
skipped_single_club = 0
skipped_existing = 0
skipped_seed = 0

for person_id, player_name, kaggle_age, raw_json in kaggle_rows:
    if not raw_json:
        continue

    # Get market value from raw_json
    current_value = None
    try:
        cv = raw_json.get("current_value_eur")
        if cv:
            current_value = float(cv)
    except (ValueError, TypeError):
        pass

    # Also try the position field which contains formatted market value
    if not current_value:
        pos_val = raw_json.get("position", "")
        current_value = parse_market_value_str(pos_val)

    # Get profile data
    profile = profiles.get(person_id)
    cs_position = profile[0] if profile else None
    archetype = profile[1] if profile else None

    # Get DOB for age calculation
    dob = people_dob.get(person_id)

    # Get career transitions
    career = career_by_person.get(person_id)
    if not career or len(career) < 1:
        skipped_no_career += 1
        continue

    if len(career) < 2:
        skipped_single_club += 1
        continue

    league_name = raw_json.get("league_name")

    # Each consecutive pair = a transfer
    for i in range(1, len(career)):
        prev = career[i - 1]
        curr = career[i]

        from_club = prev["club"]
        to_club = curr["club"]

        # Skip if either is national team (shouldn't happen with filter, but safe)
        if not from_club or not to_club:
            continue

        # Transfer date = start of new club stint
        transfer_date = curr["start"]
        if not transfer_date:
            skipped_no_date += 1
            continue

        # Check for existing
        key = (person_id, to_club, str(transfer_date))
        if key in seed_transfers:
            skipped_seed += 1
            continue
        if key in existing and not FORCE:
            skipped_existing += 1
            continue

        # Derive transfer window
        transfer_window = derive_window(transfer_date)

        # Fee: use market value as estimate ONLY for the most recent transfer
        # (current valuation roughly reflects recent move, not historical ones).
        # For older moves, fee is unknown — set to NULL rather than fabricate.
        fee_eur_m = None
        is_latest_move = (i == len(career) - 1)
        if is_latest_move and current_value and current_value > 0:
            fee_eur_m = round(current_value * 0.7 / 1_000_000, 2)

        # Age at transfer
        age_at_transfer = kaggle_age
        if dob and transfer_date:
            age_at_transfer = transfer_date.year - dob.year
            if (transfer_date.month, transfer_date.day) < (dob.month, dob.day):
                age_at_transfer -= 1

        # Fee type
        fee_type = "loan" if curr.get("is_loan") else "permanent"

        transfers.append({
            "player_name": player_name,
            "player_id": person_id,
            "age_at_transfer": age_at_transfer,
            "position": cs_position,
            "from_club": from_club,
            "from_league": None,  # Not reliably available per-move
            "to_club": to_club,
            "to_league": league_name if i == len(career) - 1 else None,
            "fee_eur_m": fee_eur_m,
            "fee_type": fee_type,
            "transfer_date": transfer_date,
            "transfer_window": transfer_window,
            "primary_archetype": archetype,
            "source": "kaggle",
            "confidence": "low" if fee_eur_m is not None else "medium",
        })

print(f"  {len(transfers):,} transfer records built")
print(f"  Skipped: no career={skipped_no_career}, single club={skipped_single_club}, "
      f"no date={skipped_no_date}, existing={skipped_existing}, seed={skipped_seed}")

# 7. Insert
if not transfers:
    print("\nNo transfers to insert.")
    cur.close()
    conn.close()
    sys.exit(0)

if DRY_RUN:
    print(f"\n[DRY RUN] Would insert {len(transfers):,} transfers")
    # Show sample
    print("\nSample records:")
    for t in transfers[:10]:
        print(f"  {t['player_name']}: {t['from_club']} → {t['to_club']} "
              f"({t['transfer_date']}) fee={t['fee_eur_m']}m [{t['fee_type']}]")
else:
    print(f"\nInserting {len(transfers):,} transfers...")
    inserted = 0
    skipped = 0

    for t in transfers:
        try:
            if FORCE:
                # Upsert: overwrite kaggle rows but never overwrite seed
                cur.execute("""
                    INSERT INTO transfers (
                        player_name, player_id, age_at_transfer, position,
                        from_club, from_league, to_club, to_league,
                        fee_eur_m, fee_type, transfer_date, transfer_window,
                        primary_archetype, source, confidence
                    ) VALUES (
                        %(player_name)s, %(player_id)s, %(age_at_transfer)s, %(position)s,
                        %(from_club)s, %(from_league)s, %(to_club)s, %(to_league)s,
                        %(fee_eur_m)s, %(fee_type)s, %(transfer_date)s, %(transfer_window)s,
                        %(primary_archetype)s, %(source)s, %(confidence)s
                    )
                    ON CONFLICT (player_id, transfer_date, to_club)
                    WHERE player_id IS NOT NULL
                    DO UPDATE SET
                        fee_eur_m = EXCLUDED.fee_eur_m,
                        from_club = EXCLUDED.from_club,
                        primary_archetype = EXCLUDED.primary_archetype,
                        updated_at = now()
                    WHERE transfers.source != 'seed'
                """, t)
            else:
                cur.execute("""
                    INSERT INTO transfers (
                        player_name, player_id, age_at_transfer, position,
                        from_club, from_league, to_club, to_league,
                        fee_eur_m, fee_type, transfer_date, transfer_window,
                        primary_archetype, source, confidence
                    ) VALUES (
                        %(player_name)s, %(player_id)s, %(age_at_transfer)s, %(position)s,
                        %(from_club)s, %(from_league)s, %(to_club)s, %(to_league)s,
                        %(fee_eur_m)s, %(fee_type)s, %(transfer_date)s, %(transfer_window)s,
                        %(primary_archetype)s, %(source)s, %(confidence)s
                    )
                    ON CONFLICT (player_id, transfer_date, to_club)
                    WHERE player_id IS NOT NULL
                    DO NOTHING
                """, t)

            if cur.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except psycopg2.Error as e:
            conn.rollback()
            print(f"  ERROR inserting {t['player_name']}: {e}")
            continue

    conn.commit()
    print(f"  Inserted {inserted:,} transfers, skipped {skipped:,} (existing/conflict)")

# ── Summary ──────────────────────────────────────────────────────────────────

print(f"\n=== Summary ===")
print(f"  Kaggle players processed: {len(kaggle_rows):,}")
print(f"  Transfer records built:   {len(transfers):,}")
if not DRY_RUN:
    cur.execute("SELECT COUNT(*) FROM transfers WHERE source = 'kaggle'")
    print(f"  Total kaggle transfers:   {cur.fetchone()[0]:,}")
if DRY_RUN:
    print("  ** DRY RUN — no data written **")

cur.close()
conn.close()
print("\nDone.")
