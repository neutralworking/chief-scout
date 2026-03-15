"""
42_seed_transfers.py — Seed transfer records across 3 windows.

Seeds the transfers table with ~44 real transfers from:
- January 2025 window
- Summer 2025 window
- January 2026 window

Attempts to link player_id by matching player_name against people.name.
Computes age_at_transfer from people.date_of_birth when matched.

Requires: migration 030_transfers.sql

Usage:
    python 42_seed_transfers.py --dry-run     # preview
    python 42_seed_transfers.py               # insert
    python 42_seed_transfers.py --force       # delete existing seed data first
"""
import argparse
import sys
from datetime import date

import psycopg2
from psycopg2.extras import RealDictCursor

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Seed transfer records")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Transfer data ────────────────────────────────────────────────────────────

TRANSFERS = [
    # ── January 2025 window ──────────────────────────────────────────────────
    {
        "player_name": "Jhon Durán",
        "from_club": "Aston Villa", "from_league": "Premier League",
        "to_club": "Al Nassr", "to_league": "Saudi Pro League",
        "fee_eur_m": 77, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CF", "transfer_date": "2025-01-28",
        "window": "2025_jan",
        "notes": "Club-record sale for Villa. Durán chose Saudi move over staying in PL.",
    },
    {
        "player_name": "Khvicha Kvaratskhelia",
        "from_club": "Napoli", "from_league": "Serie A",
        "to_club": "Paris Saint-Germain", "to_league": "Ligue 1",
        "fee_eur_m": 70, "fee_type": "permanent",
        "deal_context": "transfer_request",
        "position": "WF", "transfer_date": "2025-01-17",
        "window": "2025_jan",
        "notes": "Handed in transfer request. Conte accepted departure.",
    },
    {
        "player_name": "Omar Marmoush",
        "from_club": "Eintracht Frankfurt", "from_league": "Bundesliga",
        "to_club": "Manchester City", "to_league": "Premier League",
        "fee_eur_m": 75, "fee_type": "permanent",
        "deal_context": "release_clause",
        "position": "CF", "transfer_date": "2025-01-23",
        "window": "2025_jan",
        "notes": "Release clause triggered after 15-goal Bundesliga half-season.",
    },
    {
        "player_name": "Patrick Dorgu",
        "from_club": "Lecce", "from_league": "Serie A",
        "to_club": "Manchester United", "to_league": "Premier League",
        "fee_eur_m": 30, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "WD", "transfer_date": "2025-01-30",
        "window": "2025_jan",
        "notes": "Versatile Danish wing-back. Can play both flanks.",
    },
    {
        "player_name": "Abdukodir Khusanov",
        "from_club": "Lens", "from_league": "Ligue 1",
        "to_club": "Manchester City", "to_league": "Premier League",
        "fee_eur_m": 40, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CD", "transfer_date": "2025-01-19",
        "window": "2025_jan",
        "notes": "20-year-old Uzbek CB. Part of City's defensive rebuild.",
    },
    {
        "player_name": "Vitor Reis",
        "from_club": "Palmeiras", "from_league": "Brasileirão",
        "to_club": "Manchester City", "to_league": "Premier League",
        "fee_eur_m": 37, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CD", "transfer_date": "2025-01-24",
        "window": "2025_jan",
        "notes": "Brazilian teen CB. Long-term investment from Palmeiras.",
    },
    {
        "player_name": "Giorgi Mamardashvili",
        "from_club": "Valencia", "from_league": "La Liga",
        "to_club": "Liverpool", "to_league": "Premier League",
        "fee_eur_m": 35, "fee_type": "pre_agreed",
        "deal_context": "pre_contract",
        "position": "GK", "transfer_date": "2025-01-01",
        "window": "2025_jan",
        "notes": "Deal agreed summer 2024, completed Jan 2025. Alisson successor plan.",
    },
    {
        "player_name": "Alejandro Garnacho",
        "from_club": "Manchester United", "from_league": "Premier League",
        "to_club": "Napoli", "to_league": "Serie A",
        "fee_eur_m": 38, "fee_type": "permanent",
        "deal_context": "player_surplus",
        "position": "WF", "transfer_date": "2025-01-27",
        "window": "2025_jan",
        "notes": "Fell out of favour under Amorim. Napoli saw Kvaratskhelia replacement.",
    },
    {
        "player_name": "Randal Kolo Muani",
        "from_club": "Paris Saint-Germain", "from_league": "Ligue 1",
        "to_club": "Juventus", "to_league": "Serie A",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "player_surplus",
        "position": "CF", "transfer_date": "2025-01-16",
        "window": "2025_jan",
        "notes": "Loan until end of season. Surplus to requirements at PSG.",
    },
    {
        "player_name": "Marcus Rashford",
        "from_club": "Manchester United", "from_league": "Premier League",
        "to_club": "Aston Villa", "to_league": "Premier League",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "player_surplus",
        "position": "WF", "transfer_date": "2025-01-31",
        "window": "2025_jan",
        "notes": "Loan after publicly stating desire to leave. Barca fell through.",
    },
    {
        "player_name": "Mathys Tel",
        "from_club": "Bayern Munich", "from_league": "Bundesliga",
        "to_club": "Tottenham Hotspur", "to_league": "Premier League",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "player_surplus",
        "position": "CF", "transfer_date": "2025-01-24",
        "window": "2025_jan",
        "notes": "Six-month loan. Needs playing time after limited role at Bayern.",
    },
    {
        "player_name": "Renato Veiga",
        "from_club": "Chelsea", "from_league": "Premier League",
        "to_club": "Juventus", "to_league": "Serie A",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "player_surplus",
        "position": "CD", "transfer_date": "2025-01-13",
        "window": "2025_jan",
        "notes": "Versatile defender. Loan with no option to buy.",
    },
    {
        "player_name": "Fikayo Tomori",
        "from_club": "AC Milan", "from_league": "Serie A",
        "to_club": "Juventus", "to_league": "Serie A",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "club_decision",
        "position": "CD", "transfer_date": "2025-01-28",
        "window": "2025_jan",
        "notes": "Lost starting spot under Conceição. Juve's third Jan CB loan.",
    },
    {
        "player_name": "Neto",
        "from_club": "Arsenal", "from_league": "Premier League",
        "to_club": "Bournemouth", "to_league": "Premier League",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "player_surplus",
        "position": "GK", "transfer_date": "2025-01-21",
        "window": "2025_jan",
        "notes": "Third-choice at Arsenal. Bournemouth needed GK cover.",
    },
    {
        "player_name": "Andriy Lunin",
        "from_club": "Real Madrid", "from_league": "La Liga",
        "to_club": "Majorca", "to_league": "La Liga",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "player_surplus",
        "position": "GK", "transfer_date": "2025-01-20",
        "window": "2025_jan",
        "notes": "Courtois back as #1. Lunin needs minutes.",
    },
    {
        "player_name": "Niclas Füllkrug",
        "from_club": "West Ham", "from_league": "Premier League",
        "to_club": "AC Milan", "to_league": "Serie A",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "player_surplus",
        "position": "CF", "transfer_date": "2025-01-25",
        "window": "2025_jan",
        "notes": "Injury-plagued spell at West Ham. Milan took chance on fitness.",
    },
    {
        "player_name": "Leroy Sané",
        "from_club": "Bayern Munich", "from_league": "Bundesliga",
        "to_club": "—", "to_league": None,
        "fee_eur_m": 0, "fee_type": "free",
        "deal_context": "contract_expiring",
        "position": "WF", "transfer_date": "2025-01-15",
        "window": "2025_jan",
        "notes": "Left Bayern as free agent. Exploring options.",
    },
    {
        "player_name": "Ashley Young",
        "from_club": "Everton", "from_league": "Premier League",
        "to_club": "—", "to_league": None,
        "fee_eur_m": 0, "fee_type": "free",
        "deal_context": "contract_expiring",
        "position": "WD", "transfer_date": "2025-01-10",
        "window": "2025_jan",
        "notes": "Released by Everton. Veteran career winding down.",
    },
    {
        "player_name": "Dani Olmo",
        "from_club": "Barcelona", "from_league": "La Liga",
        "to_club": "Barcelona", "to_league": "La Liga",
        "fee_eur_m": 0, "fee_type": "permanent",
        "deal_context": "other",
        "position": "AM", "transfer_date": "2025-01-07",
        "window": "2025_jan",
        "notes": "Re-registration saga. CSD emergency measure allowed re-registration.",
    },

    # ── Summer 2025 window ───────────────────────────────────────────────────
    {
        "player_name": "Alexander Isak",
        "from_club": "Newcastle United", "from_league": "Premier League",
        "to_club": "Liverpool", "to_league": "Premier League",
        "fee_eur_m": 150, "fee_type": "permanent",
        "deal_context": "release_clause",
        "position": "CF", "transfer_date": "2025-09-01",
        "window": "2025_summer",
        "notes": "British record fee. Deadline Day blockbuster. 25 PL goals in 24/25.",
    },
    {
        "player_name": "Florian Wirtz",
        "from_club": "Bayer Leverkusen", "from_league": "Bundesliga",
        "to_club": "Liverpool", "to_league": "Premier League",
        "fee_eur_m": 120, "fee_type": "permanent",
        "deal_context": "release_clause",
        "position": "AM", "transfer_date": "2025-07-15",
        "window": "2025_summer",
        "notes": "Liverpool's marquee signing. €120m base, up to €140m with add-ons.",
    },
    {
        "player_name": "Hugo Ekitike",
        "from_club": "Eintracht Frankfurt", "from_league": "Bundesliga",
        "to_club": "Liverpool", "to_league": "Premier League",
        "fee_eur_m": 93, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CF", "transfer_date": "2025-08-10",
        "window": "2025_summer",
        "notes": "Part of Liverpool's aggressive summer rebuild. Up to €93m with add-ons.",
    },
    {
        "player_name": "Bryan Mbeumo",
        "from_club": "Brentford", "from_league": "Premier League",
        "to_club": "Manchester United", "to_league": "Premier League",
        "fee_eur_m": 83, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "WF", "transfer_date": "2025-08-05",
        "window": "2025_summer",
        "notes": "Up to €83m with add-ons. United's headline summer signing.",
    },
    {
        "player_name": "Matheus Cunha",
        "from_club": "Wolverhampton Wanderers", "from_league": "Premier League",
        "to_club": "Manchester United", "to_league": "Premier League",
        "fee_eur_m": 75, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CF", "transfer_date": "2025-07-25",
        "window": "2025_summer",
        "notes": "United raided Wolves. Cunha's versatility appealed to ten Hag's successor.",
    },
    {
        "player_name": "Eberechi Eze",
        "from_club": "Crystal Palace", "from_league": "Premier League",
        "to_club": "Arsenal", "to_league": "Premier League",
        "fee_eur_m": 70, "fee_type": "permanent",
        "deal_context": "release_clause",
        "position": "AM", "transfer_date": "2025-08-22",
        "window": "2025_summer",
        "notes": "Release clause expired Aug 15 but Arsenal agreed similar fee. Up to €80m.",
    },
    {
        "player_name": "Martín Zubimendi",
        "from_club": "Real Sociedad", "from_league": "La Liga",
        "to_club": "Arsenal", "to_league": "Premier League",
        "fee_eur_m": 70, "fee_type": "permanent",
        "deal_context": "release_clause",
        "position": "DM", "transfer_date": "2025-07-20",
        "window": "2025_summer",
        "notes": "Turned down Liverpool in 2024. Chose Arsenal a year later.",
    },
    {
        "player_name": "Victor Osimhen",
        "from_club": "Napoli", "from_league": "Serie A",
        "to_club": "Galatasaray", "to_league": "Süper Lig",
        "fee_eur_m": 75, "fee_type": "permanent",
        "deal_context": "transfer_request",
        "position": "CF", "transfer_date": "2025-07-10",
        "window": "2025_summer",
        "notes": "Made permanent after successful loan spell. Dominated Turkish league.",
    },
    {
        "player_name": "Luis Díaz",
        "from_club": "Liverpool", "from_league": "Premier League",
        "to_club": "Bayern Munich", "to_league": "Bundesliga",
        "fee_eur_m": 70, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "WF", "transfer_date": "2025-08-01",
        "window": "2025_summer",
        "notes": "Liverpool reinvested Díaz fee into Isak + Ekitike. Bayern got a bargain.",
    },
    {
        "player_name": "Nick Woltemade",
        "from_club": "VfB Stuttgart", "from_league": "Bundesliga",
        "to_club": "Newcastle United", "to_league": "Premier League",
        "fee_eur_m": 75, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CF", "transfer_date": "2025-08-15",
        "window": "2025_summer",
        "notes": "Newcastle record signing. Standout at U21 Euros.",
    },
    {
        "player_name": "Viktor Gyökeres",
        "from_club": "Sporting CP", "from_league": "Primeira Liga",
        "to_club": "Arsenal", "to_league": "Premier League",
        "fee_eur_m": 65, "fee_type": "permanent",
        "deal_context": "release_clause",
        "position": "CF", "transfer_date": "2025-07-30",
        "window": "2025_summer",
        "notes": "Arsenal's striker signing. Release clause triggered.",
    },
    {
        "player_name": "Mohammed Kudus",
        "from_club": "West Ham United", "from_league": "Premier League",
        "to_club": "Tottenham Hotspur", "to_league": "Premier League",
        "fee_eur_m": 65, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "AM", "transfer_date": "2025-08-12",
        "window": "2025_summer",
        "notes": "Spurs signed Kudus for €65m after strong two seasons at West Ham.",
    },
    {
        "player_name": "Dean Huijsen",
        "from_club": "AFC Bournemouth", "from_league": "Premier League",
        "to_club": "Real Madrid", "to_league": "La Liga",
        "fee_eur_m": 60, "fee_type": "permanent",
        "deal_context": "release_clause",
        "position": "CD", "transfer_date": "2025-07-05",
        "window": "2025_summer",
        "notes": "Release clause matched. Bournemouth bought for €15m, sold for €60m in one year.",
    },
    {
        "player_name": "Jobe Bellingham",
        "from_club": "Sunderland", "from_league": "Championship",
        "to_club": "Borussia Dortmund", "to_league": "Bundesliga",
        "fee_eur_m": 38, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CM", "transfer_date": "2025-07-18",
        "window": "2025_summer",
        "notes": "Follows brother Jude's path to Dortmund. Club record fee for Sunderland.",
    },

    # ── January 2026 window ──────────────────────────────────────────────────
    {
        "player_name": "Antoine Semenyo",
        "from_club": "AFC Bournemouth", "from_league": "Premier League",
        "to_club": "Manchester City", "to_league": "Premier League",
        "fee_eur_m": 72, "fee_type": "permanent",
        "deal_context": "release_clause",
        "position": "WF", "transfer_date": "2026-01-20",
        "window": "2026_jan",
        "notes": "Most expensive signing of Jan 2026 window. Release clause of £65m.",
    },
    {
        "player_name": "Lucas Paquetá",
        "from_club": "West Ham United", "from_league": "Premier League",
        "to_club": "Flamengo", "to_league": "Brasileirão",
        "fee_eur_m": 42, "fee_type": "permanent",
        "deal_context": "mutual_termination",
        "position": "AM", "transfer_date": "2026-01-25",
        "window": "2026_jan",
        "notes": "Highest incoming transfer in Brazilian league history. €42m.",
    },
    {
        "player_name": "Conor Gallagher",
        "from_club": "Atlético Madrid", "from_league": "La Liga",
        "to_club": "Tottenham Hotspur", "to_league": "Premier League",
        "fee_eur_m": 40, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CM", "transfer_date": "2026-01-22",
        "window": "2026_jan",
        "notes": "Spurs won race to bring Gallagher back to PL over Aston Villa.",
    },
    {
        "player_name": "Brennan Johnson",
        "from_club": "Tottenham Hotspur", "from_league": "Premier League",
        "to_club": "Crystal Palace", "to_league": "Premier League",
        "fee_eur_m": 40, "fee_type": "permanent",
        "deal_context": "player_surplus",
        "position": "WF", "transfer_date": "2026-01-05",
        "window": "2026_jan",
        "notes": "Palace broke their transfer record. Agreed before window even opened.",
    },
    {
        "player_name": "Ademola Lookman",
        "from_club": "Atalanta", "from_league": "Serie A",
        "to_club": "Atlético Madrid", "to_league": "La Liga",
        "fee_eur_m": 35, "fee_type": "permanent",
        "deal_context": "transfer_request",
        "position": "WF", "transfer_date": "2026-02-03",
        "window": "2026_jan",
        "notes": "Handed in transfer request over summer. Finally left on Deadline Day.",
    },
    {
        "player_name": "Oscar Bobb",
        "from_club": "Manchester City", "from_league": "Premier League",
        "to_club": "Fulham", "to_league": "Premier League",
        "fee_eur_m": 31, "fee_type": "permanent",
        "deal_context": "player_surplus",
        "position": "WF", "transfer_date": "2026-01-28",
        "window": "2026_jan",
        "notes": "Guardiola allowed departure after Semenyo arrival. €31.2m.",
    },
    {
        "player_name": "Taty Castellanos",
        "from_club": "Lazio", "from_league": "Serie A",
        "to_club": "West Ham United", "to_league": "Premier League",
        "fee_eur_m": 29, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CF", "transfer_date": "2026-01-26",
        "window": "2026_jan",
        "notes": "West Ham's Paquetá replacement funds partially. €29m from Lazio.",
    },
    {
        "player_name": "Rayan",
        "from_club": "Vasco da Gama", "from_league": "Brasileirão",
        "to_club": "AFC Bournemouth", "to_league": "Premier League",
        "fee_eur_m": 28, "fee_type": "permanent",
        "deal_context": "club_decision",
        "position": "CF", "transfer_date": "2026-01-30",
        "window": "2026_jan",
        "notes": "Bournemouth reinvested Semenyo fee. €28.5m plus add-ons.",
    },
    {
        "player_name": "Marc Guehi",
        "from_club": "Crystal Palace", "from_league": "Premier League",
        "to_club": "Manchester City", "to_league": "Premier League",
        "fee_eur_m": 23, "fee_type": "permanent",
        "deal_context": "contract_expiring",
        "position": "CD", "transfer_date": "2026-01-15",
        "window": "2026_jan",
        "notes": "Contract running down. City got him below summer valuation. €23m.",
    },
    {
        "player_name": "Endrick",
        "from_club": "Real Madrid", "from_league": "La Liga",
        "to_club": "Lyon", "to_league": "Ligue 1",
        "fee_eur_m": 0, "fee_type": "loan",
        "deal_context": "player_surplus",
        "position": "CF", "transfer_date": "2026-01-18",
        "window": "2026_jan",
        "notes": "Only 99 minutes in all comps first half of season. Needs minutes.",
    },
    {
        "player_name": "Oleksandr Zinchenko",
        "from_club": "Arsenal", "from_league": "Premier League",
        "to_club": "Ajax", "to_league": "Eredivisie",
        "fee_eur_m": 1.5, "fee_type": "permanent",
        "deal_context": "player_surplus",
        "position": "WD", "transfer_date": "2026-01-20",
        "window": "2026_jan",
        "notes": "Arsenal let him go for a token €1.5m. Ajax got a bargain.",
    },
]

# ── People lookup for player_id matching ─────────────────────────────────────

cur.execute("SELECT id, name, date_of_birth FROM people")
rows = cur.fetchall()
people_lookup = {}
for pid, name, dob in rows:
    people_lookup[name.lower().strip()] = (pid, dob)

def compute_age(dob, transfer_date):
    """Compute age at transfer date."""
    if not dob or not transfer_date:
        return None
    if isinstance(transfer_date, str):
        parts = transfer_date.split("-")
        transfer_date = date(int(parts[0]), int(parts[1]), int(parts[2]))
    if isinstance(dob, str):
        parts = dob.split("-")
        dob = date(int(parts[0]), int(parts[1]), int(parts[2]))
    age = transfer_date.year - dob.year
    if (transfer_date.month, transfer_date.day) < (dob.month, dob.day):
        age -= 1
    return age

# ── Seed logic ───────────────────────────────────────────────────────────────

if args.force and not args.dry_run:
    cur.execute("DELETE FROM transfers WHERE notes IS NOT NULL")
    print(f"FORCE: Cleared existing transfers")

inserted = 0
updated = 0
unmatched = []

for t in TRANSFERS:
    # Try to match player
    key = t["player_name"].lower().strip()
    player_id = None
    age_at_transfer = t.get("age_at_transfer")

    if key in people_lookup:
        player_id, dob = people_lookup[key]
        if not age_at_transfer:
            age_at_transfer = compute_age(dob, t["transfer_date"])
    else:
        unmatched.append(t["player_name"])

    if args.dry_run:
        status = "MATCH" if player_id else "NO MATCH"
        age_str = f", age {age_at_transfer}" if age_at_transfer else ""
        print(f"  [{status}] {t['player_name']} → {t['to_club']} (€{t.get('fee_eur_m', '?')}m{age_str})")
        continue

    cur.execute("""
        INSERT INTO transfers (
            player_name, player_id, age_at_transfer, position,
            from_club, from_league, to_club, to_league,
            fee_eur_m, fee_type, deal_context,
            transfer_date, window, notes
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s
        )
        ON CONFLICT (player_name, transfer_date, to_club) DO UPDATE SET
            player_id = EXCLUDED.player_id,
            age_at_transfer = EXCLUDED.age_at_transfer,
            position = EXCLUDED.position,
            from_club = EXCLUDED.from_club,
            from_league = EXCLUDED.from_league,
            to_league = EXCLUDED.to_league,
            fee_eur_m = EXCLUDED.fee_eur_m,
            fee_type = EXCLUDED.fee_type,
            deal_context = EXCLUDED.deal_context,
            window = EXCLUDED.window,
            notes = EXCLUDED.notes
    """, (
        t["player_name"], player_id, age_at_transfer, t.get("position"),
        t["from_club"], t.get("from_league"), t["to_club"], t.get("to_league"),
        t.get("fee_eur_m"), t["fee_type"], t.get("deal_context"),
        t["transfer_date"], t.get("window"), t.get("notes"),
    ))
    inserted += 1

# ── Summary ──────────────────────────────────────────────────────────────────

if args.dry_run:
    print(f"\nDRY RUN: {len(TRANSFERS)} transfers would be upserted")
    print(f"  Matched: {len(TRANSFERS) - len(unmatched)}")
    print(f"  Unmatched: {len(unmatched)}")
else:
    print(f"\nDone: {inserted} transfers upserted")

if unmatched:
    print(f"\nUnmatched players ({len(unmatched)}):")
    for name in unmatched:
        print(f"  - {name}")

cur.close()
conn.close()
