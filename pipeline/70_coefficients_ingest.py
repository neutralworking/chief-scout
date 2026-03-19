"""
70_coefficients_ingest.py — Ingest UEFA and FIFA coefficients for league/club/nation strength.

Sources:
- UEFA country coefficients (2025-26): kassiesa.net / uefa.com
- UEFA club coefficients: top ~100 clubs
- FIFA world rankings: fifa.com (Jan 2026)

These coefficients drive:
1. Grade scaling — players from weaker leagues get discounted percentiles
2. Club grading — UEFA club coefficient stored on clubs table
3. Nation strength — FIFA ranking stored on nations table

Usage:
    python 70_coefficients_ingest.py              # full ingest
    python 70_coefficients_ingest.py --dry-run    # preview only
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from lib.db import require_conn

parser = argparse.ArgumentParser(description="Ingest UEFA/FIFA coefficients")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run
conn = require_conn()
conn.autocommit = True
cur = conn.cursor()

# ── UEFA Country Coefficients (2025-26) ──────────────────────────────────────
# Source: UEFA association ranking, 5-year rolling sum
# https://www.uefa.com/nationalassociations/uefarankings/country/

UEFA_COUNTRY_COEFFICIENTS = [
    (1, "England", "ENG", 114.686),
    (2, "Italy", "ITA", 98.874),
    (3, "Spain", "ESP", 94.421),
    (4, "Germany", "GER", 89.759),
    (5, "France", "FRA", 81.355),
    (6, "Netherlands", "NED", 66.400),
    (7, "Portugal", "POR", 63.882),
    (8, "Belgium", "BEL", 51.600),
    (9, "Czechia", "CZE", 49.675),
    (10, "Turkey", "TUR", 47.900),
    (11, "Austria", "AUT", 44.825),
    (12, "Scotland", "SCO", 42.700),
    (13, "Greece", "GRE", 40.100),
    (14, "Switzerland", "SUI", 38.775),
    (15, "Norway", "NOR", 37.750),
    (16, "Serbia", "SRB", 37.125),
    (17, "Denmark", "DEN", 35.825),
    (18, "Sweden", "SWE", 33.375),
    (19, "Croatia", "CRO", 31.250),
    (20, "Israel", "ISR", 30.125),
    (21, "Poland", "POL", 28.750),
    (22, "Ukraine", "UKR", 28.100),
    (23, "Romania", "ROU", 27.600),
    (24, "Cyprus", "CYP", 27.375),
    (25, "Hungary", "HUN", 24.250),
    (26, "Bulgaria", "BUL", 23.500),
    (27, "Slovakia", "SVK", 21.750),
    (28, "Azerbaijan", "AZE", 20.500),
    (29, "Moldova", "MDA", 18.750),
    (30, "Kazakhstan", "KAZ", 17.875),
    (31, "Iceland", "ISL", 16.625),
    (32, "Finland", "FIN", 16.500),
    (33, "Slovenia", "SVN", 16.250),
    (34, "Ireland", "IRL", 15.375),
    (35, "Bosnia-Herzegovina", "BIH", 14.500),
    (36, "Belarus", "BLR", 13.750),
    (37, "Armenia", "ARM", 12.625),
    (38, "Lithuania", "LTU", 12.000),
    (39, "Latvia", "LVA", 11.375),
    (40, "Georgia", "GEO", 11.250),
    (41, "Luxembourg", "LUX", 10.500),
    (42, "N. Ireland", "NIR", 10.250),
    (43, "Albania", "ALB", 9.500),
    (44, "North Macedonia", "MKD", 8.750),
    (45, "Montenegro", "MNE", 8.375),
    (46, "Malta", "MLT", 7.750),
    (47, "Wales", "WAL", 7.125),
    (48, "Estonia", "EST", 6.625),
    (49, "Kosovo", "KOS", 6.500),
    (50, "Faroe Islands", "FRO", 6.125),
    (51, "Gibraltar", "GIB", 4.500),
    (52, "Liechtenstein", "LIE", 3.500),
    (53, "Andorra", "AND", 3.250),
    (54, "San Marino", "SMR", 1.750),
]

# ── Strength Factor Computation ──────────────────────────────────────────────
# Normalize coefficients to a 0.40 - 1.15 scale for grade multiplying.
# Top league (England, ~115) = 1.15, weakest UEFA (~2) = 0.40
# Non-UEFA leagues get mapped by region.

MAX_COEFF = UEFA_COUNTRY_COEFFICIENTS[0][3]  # England


def coeff_to_strength(coeff: float) -> float:
    """Convert raw UEFA coefficient to a strength factor (0.40 - 1.15)."""
    # Log-scale to avoid crushing mid-table leagues
    import math
    ratio = coeff / MAX_COEFF
    # Smoothed: 0.40 + 0.75 * sqrt(ratio)
    return round(0.40 + 0.75 * math.sqrt(ratio), 3)


# Non-UEFA league strength factors (manually calibrated)
NON_UEFA_STRENGTH = {
    "Argentine Liga Profesional": 0.72,
    "Brasileirao Serie A": 0.75,
    "Liga MX": 0.65,
    "Colombian Primera A": 0.58,
    "MLS": 0.60,
    "Saudi Pro League": 0.62,
    "K League 1": 0.55,
    "Chinese Super League": 0.50,
    "A-League": 0.52,
    "J1 League": 0.55,
    # Youth leagues — weighted lower
    "UEFA Youth League": 0.50,
    "Campionato Primavera 1": 0.45,
    "U18 Premier League North": 0.45,
    "U18 Premier League South": 0.45,
    "Netherlands U21 Divisie 1": 0.42,
    "Portugal Liga Revelacao U23": 0.42,
    "Germany U19 Bundesliga": 0.42,
    "Brasileiro U20": 0.40,
    "UEFA U21 Championship": 0.50,
    "World Cup U20": 0.50,
    "UEFA U19 Championship": 0.45,
}

# Map our league names → UEFA country for coefficient lookup
LEAGUE_TO_COUNTRY = {
    "Premier League": "England",
    "La Liga": "Spain",
    "Bundesliga": "Germany",
    "Serie A": "Italy",
    "Ligue 1": "France",
    "Eredivisie": "Netherlands",
    "Primeira Liga": "Portugal",
    "Championship": "England",  # second tier — will apply tier discount
    "Super Lig": "Turkey",
    "Jupiler Pro League": "Belgium",
    "Scottish Premiership": "Scotland",
    "Austrian Bundesliga": "Austria",
    "Swiss Super League": "Switzerland",
    "Danish Superliga": "Denmark",
    "Greek Super League": "Greece",
    "Croatian HNL": "Croatia",
    "Serbian Super Liga": "Serbia",
    "Romanian Liga I": "Romania",
    "Czech Liga": "Czechia",
    "Ekstraklasa": "Poland",
    "Allsvenskan": "Sweden",
    "Eliteserien": "Norway",
    "Bulgarian First League": "Bulgaria",
}

# Second-tier leagues get 80% of their country's coefficient
SECOND_TIER_LEAGUES = {"Championship"}


# ── UEFA Club Coefficients (Top 100, 2025-26) ───────────────────────────────
# Source: UEFA club coefficient ranking, 5-year rolling

UEFA_CLUB_COEFFICIENTS = [
    ("Arsenal", "ENG", 134.000),
    ("Real Madrid", "ESP", 130.000),
    ("Manchester City", "ENG", 128.000),
    ("Bayern Munich", "GER", 120.000),
    ("Barcelona", "ESP", 114.000),
    ("Liverpool", "ENG", 112.000),
    ("Paris Saint-Germain", "FRA", 108.000),
    ("Inter Milan", "ITA", 106.000),
    ("Borussia Dortmund", "GER", 102.000),
    ("Atletico Madrid", "ESP", 100.000),
    ("Bayer Leverkusen", "GER", 96.000),
    ("Juventus", "ITA", 92.000),
    ("AC Milan", "ITA", 90.000),
    ("Chelsea", "ENG", 88.000),
    ("Napoli", "ITA", 86.000),
    ("Manchester United", "ENG", 84.000),
    ("Sporting CP", "POR", 82.000),
    ("Benfica", "POR", 80.000),
    ("Porto", "POR", 78.000),
    ("RB Leipzig", "GER", 76.000),
    ("Tottenham Hotspur", "ENG", 74.000),
    ("Atalanta", "ITA", 72.000),
    ("Villarreal", "ESP", 70.000),
    ("Sevilla", "ESP", 68.000),
    ("Feyenoord", "NED", 66.000),
    ("PSV Eindhoven", "NED", 64.000),
    ("Roma", "ITA", 62.000),
    ("Newcastle United", "ENG", 60.000),
    ("Lazio", "ITA", 58.000),
    ("Aston Villa", "ENG", 56.000),
    ("Ajax", "NED", 54.000),
    ("Real Sociedad", "ESP", 52.000),
    ("Braga", "POR", 50.000),
    ("West Ham United", "ENG", 48.000),
    ("Eintracht Frankfurt", "GER", 46.000),
    ("Freiburg", "GER", 44.000),
    ("Brighton", "ENG", 42.000),
    ("Monaco", "FRA", 40.000),
    ("Marseille", "FRA", 38.000),
    ("Lyon", "FRA", 36.000),
    ("Celtic", "SCO", 34.000),
    ("Red Bull Salzburg", "AUT", 32.000),
    ("Rangers", "SCO", 30.000),
    ("Club Brugge", "BEL", 28.000),
    ("Galatasaray", "TUR", 26.000),
    ("Fenerbahce", "TUR", 24.000),
    ("Besiktas", "TUR", 22.000),
    ("Olympiacos", "GRE", 20.000),
    ("Slavia Prague", "CZE", 18.000),
    ("Young Boys", "SUI", 16.000),
    ("Copenhagen", "DEN", 15.000),
    ("Dinamo Zagreb", "CRO", 14.000),
    ("Red Star Belgrade", "SRB", 13.000),
    ("Trabzonspor", "TUR", 12.000),
    ("Anderlecht", "BEL", 11.000),
    ("Sturm Graz", "AUT", 10.000),
    ("PAOK", "GRE", 9.500),
    ("AZ Alkmaar", "NED", 9.000),
    ("Twente", "NED", 8.500),
    ("Rapid Wien", "AUT", 8.000),
    ("Sparta Prague", "CZE", 7.500),
    ("Viktoria Plzen", "CZE", 7.000),
    ("Basel", "SUI", 6.500),
    ("Bodo/Glimt", "NOR", 6.000),
    ("Molde", "NOR", 5.500),
    ("Legia Warsaw", "POL", 5.000),
    ("Steaua Bucharest", "ROU", 4.500),
    ("CFR Cluj", "ROU", 4.000),
    ("Malmo", "SWE", 3.500),
    ("Ludogorets", "BUL", 3.000),
]


# ── FIFA World Rankings (Jan 2026) ──────────────────────────────────────────
# Source: FIFA/Coca-Cola Men's World Ranking

FIFA_RANKINGS = [
    (1, "Argentina", 1867.25, "CONMEBOL"),
    (2, "France", 1859.78, "UEFA"),
    (3, "Spain", 1853.27, "UEFA"),
    (4, "England", 1813.48, "UEFA"),
    (5, "Brazil", 1784.37, "CONMEBOL"),
    (6, "Belgium", 1761.71, "UEFA"),
    (7, "Netherlands", 1755.25, "UEFA"),
    (8, "Portugal", 1750.66, "UEFA"),
    (9, "Germany", 1743.15, "UEFA"),
    (10, "Italy", 1731.51, "UEFA"),
    (11, "Colombia", 1727.33, "CONMEBOL"),
    (12, "Uruguay", 1707.68, "CONMEBOL"),
    (13, "Croatia", 1705.30, "UEFA"),
    (14, "Japan", 1694.74, "AFC"),
    (15, "Morocco", 1688.03, "CAF"),
    (16, "USA", 1679.41, "CONCACAF"),
    (17, "Mexico", 1673.32, "CONCACAF"),
    (18, "Senegal", 1664.14, "CAF"),
    (19, "Switzerland", 1661.13, "UEFA"),
    (20, "Turkey", 1657.82, "UEFA"),
    (21, "Austria", 1645.35, "UEFA"),
    (22, "Denmark", 1640.12, "UEFA"),
    (23, "Iran", 1634.58, "AFC"),
    (24, "South Korea", 1628.82, "AFC"),
    (25, "Australia", 1624.75, "AFC"),
    (26, "Serbia", 1619.52, "UEFA"),
    (27, "Ukraine", 1614.70, "UEFA"),
    (28, "Sweden", 1609.88, "UEFA"),
    (29, "Ecuador", 1602.25, "CONMEBOL"),
    (30, "Poland", 1598.68, "UEFA"),
    (31, "Hungary", 1594.17, "UEFA"),
    (32, "Nigeria", 1591.73, "CAF"),
    (33, "Egypt", 1586.61, "CAF"),
    (34, "Wales", 1582.54, "UEFA"),
    (35, "Scotland", 1578.72, "UEFA"),
    (36, "Czech Republic", 1572.38, "UEFA"),
    (37, "Algeria", 1568.15, "CAF"),
    (38, "Peru", 1563.24, "CONMEBOL"),
    (39, "Norway", 1558.81, "UEFA"),
    (40, "Romania", 1553.45, "UEFA"),
    (41, "Cameroon", 1549.22, "CAF"),
    (42, "Chile", 1544.88, "CONMEBOL"),
    (43, "Costa Rica", 1539.11, "CONCACAF"),
    (44, "Paraguay", 1534.67, "CONMEBOL"),
    (45, "Ivory Coast", 1530.42, "CAF"),
    (46, "Greece", 1525.18, "UEFA"),
    (47, "Saudi Arabia", 1520.94, "AFC"),
    (48, "Tunisia", 1516.53, "CAF"),
    (49, "Slovakia", 1511.29, "UEFA"),
    (50, "Venezuela", 1506.82, "CONMEBOL"),
    (51, "Albania", 1502.15, "UEFA"),
    (52, "Mali", 1497.88, "CAF"),
    (53, "Russia", 1493.24, "UEFA"),
    (54, "Canada", 1488.97, "CONCACAF"),
    (55, "Ireland", 1484.33, "UEFA"),
    (56, "Ghana", 1479.82, "CAF"),
    (57, "Finland", 1474.67, "UEFA"),
    (58, "DR Congo", 1470.25, "CAF"),
    (59, "Panama", 1465.15, "CONCACAF"),
    (60, "Jamaica", 1460.88, "CONCACAF"),
    (61, "North Macedonia", 1455.52, "UEFA"),
    (62, "Slovenia", 1450.18, "UEFA"),
    (63, "Iceland", 1445.94, "UEFA"),
    (64, "Burkina Faso", 1441.57, "CAF"),
    (65, "Bolivia", 1437.23, "CONMEBOL"),
    (66, "Bosnia-Herzegovina", 1432.88, "UEFA"),
    (67, "Israel", 1427.45, "UEFA"),
    (68, "South Africa", 1423.17, "CAF"),
    (69, "Montenegro", 1418.73, "UEFA"),
    (70, "Qatar", 1414.52, "AFC"),
    (71, "China", 1409.35, "AFC"),
    (72, "Georgia", 1404.88, "UEFA"),
    (73, "Iraq", 1400.17, "AFC"),
    (74, "UAE", 1395.82, "AFC"),
    (75, "Uzbekistan", 1391.54, "AFC"),
    (76, "Bulgaria", 1387.25, "UEFA"),
    (77, "Bahrain", 1382.71, "AFC"),
    (78, "Honduras", 1377.44, "CONCACAF"),
    (79, "Cape Verde", 1372.88, "CAF"),
    (80, "Oman", 1368.34, "AFC"),
]


# ── Ingest ───────────────────────────────────────────────────────────────────

print(f"Coefficients ingest {'(DRY RUN)' if DRY_RUN else ''}")
print()

# 1. League coefficients
print("── League Coefficients ──")
country_coeff_map = {c[1]: c[3] for c in UEFA_COUNTRY_COEFFICIENTS}
league_rows = []

for league_name, country in LEAGUE_TO_COUNTRY.items():
    coeff = country_coeff_map.get(country, 0)
    factor = coeff_to_strength(coeff)
    if league_name in SECOND_TIER_LEAGUES:
        factor = round(factor * 0.80, 3)  # 20% discount for second tier
    country_code = next(
        (c[2] for c in UEFA_COUNTRY_COEFFICIENTS if c[1] == country), None
    )
    league_rows.append((league_name, country, country_code, coeff, factor))
    print(f"  {league_name:<30} {country:<15} coeff={coeff:>8.3f}  strength={factor:.3f}")

# Add non-UEFA leagues
for league_name, factor in NON_UEFA_STRENGTH.items():
    league_rows.append((league_name, "", None, 0, factor))
    print(f"  {league_name:<30} {'(non-UEFA)':<15} coeff={'N/A':>8}  strength={factor:.3f}")

if not DRY_RUN:
    from psycopg2.extras import execute_values
    execute_values(cur, """
        INSERT INTO league_coefficients (league_name, country, country_code, uefa_coefficient, strength_factor, season)
        VALUES %s
        ON CONFLICT (league_name, season) DO UPDATE SET
            country = EXCLUDED.country,
            country_code = EXCLUDED.country_code,
            uefa_coefficient = EXCLUDED.uefa_coefficient,
            strength_factor = EXCLUDED.strength_factor,
            updated_at = now()
    """, [(r[0], r[1], r[2], r[3], r[4], "2025") for r in league_rows])
    print(f"\n  Upserted {len(league_rows)} league coefficients")

# 2. UEFA club coefficients
print("\n── Club Coefficients ──")

# Build name→club_id mapping
cur.execute("SELECT id, clubname FROM clubs")
club_name_map = {}
for row in cur.fetchall():
    club_name_map[row[1].strip().lower()] = row[0]

# Also build a fuzzy lookup with common short names
CLUB_ALIASES = {
    "arsenal": "Arsenal",
    "real madrid": "Real Madrid CF",
    "manchester city": "Manchester City",
    "bayern munich": "Bayern München",
    "bayern münchen": "Bayern München",
    "barcelona": "FC Barcelona",
    "liverpool": "Liverpool",
    "paris saint-germain": "Paris Saint-Germain",
    "psg": "Paris Saint-Germain",
    "inter milan": "Inter",
    "internazionale": "Inter",
    "borussia dortmund": "Borussia Dortmund",
    "atletico madrid": "Atlético Madrid",
    "atlético madrid": "Atlético Madrid",
    "bayer leverkusen": "Bayer 04 Leverkusen",
    "juventus": "Juventus",
    "ac milan": "AC Milan",
    "chelsea": "Chelsea",
    "napoli": "SSC Napoli",
    "manchester united": "Manchester United",
    "sporting cp": "Sporting CP",
    "benfica": "SL Benfica",
    "porto": "FC Porto",
    "rb leipzig": "RB Leipzig",
    "tottenham hotspur": "Tottenham Hotspur",
    "atalanta": "Atalanta",
    "villarreal": "Villarreal CF",
    "sevilla": "Sevilla FC",
    "feyenoord": "Feyenoord",
    "psv eindhoven": "PSV",
    "roma": "AS Roma",
    "newcastle united": "Newcastle United",
    "lazio": "SS Lazio",
    "aston villa": "Aston Villa",
    "ajax": "Ajax",
    "real sociedad": "Real Sociedad",
    "braga": "SC Braga",
    "west ham united": "West Ham United",
    "eintracht frankfurt": "Eintracht Frankfurt",
    "freiburg": "SC Freiburg",
    "brighton": "Brighton & Hove Albion",
    "monaco": "AS Monaco",
    "marseille": "Olympique de Marseille",
    "lyon": "Olympique Lyonnais",
    "celtic": "Celtic",
    "red bull salzburg": "FC Red Bull Salzburg",
    "rangers": "Rangers",
    "club brugge": "Club Brugge KV",
    "galatasaray": "Galatasaray",
    "fenerbahce": "Fenerbahçe",
    "besiktas": "Beşiktaş",
    "olympiacos": "Olympiacos",
    "slavia prague": "Slavia Praha",
    "young boys": "BSC Young Boys",
    "copenhagen": "FC København",
    "dinamo zagreb": "GNK Dinamo Zagreb",
    "red star belgrade": "Red Star Belgrade",
    "trabzonspor": "Trabzonspor",
    "anderlecht": "RSC Anderlecht",
    "sturm graz": "SK Sturm Graz",
    "paok": "PAOK",
    "az alkmaar": "AZ",
    "twente": "FC Twente",
    "rapid wien": "SK Rapid Wien",
    "sparta prague": "Sparta Praha",
    "viktoria plzen": "FC Viktoria Plzeň",
    "basel": "FC Basel",
    "bodo/glimt": "FK Bodø/Glimt",
    "molde": "Molde FK",
    "legia warsaw": "Legia Warszawa",
    "steaua bucharest": "FCSB",
    "cfr cluj": "CFR Cluj",
    "malmo": "Malmö FF",
    "ludogorets": "PFC Ludogorets Razgrad",
}

club_updates = 0
for club_name, country_code, coeff in UEFA_CLUB_COEFFICIENTS:
    # Try exact match, then alias, then lowercase contains
    club_id = None
    key = club_name.strip().lower()

    if key in club_name_map:
        club_id = club_name_map[key]
    else:
        alias = CLUB_ALIASES.get(key, "")
        if alias.lower() in club_name_map:
            club_id = club_name_map[alias.lower()]
        else:
            # Fuzzy: find clubs containing the name
            for db_name, db_id in club_name_map.items():
                if key in db_name or db_name in key:
                    club_id = db_id
                    break

    if club_id and not DRY_RUN:
        cur.execute("""
            UPDATE clubs SET uefa_coefficient = %s, uefa_rank = %s, updated_at = now()
            WHERE id = %s
        """, (coeff, UEFA_CLUB_COEFFICIENTS.index((club_name, country_code, coeff)) + 1, club_id))
        club_updates += 1
    status = f"→ id={club_id}" if club_id else "NOT FOUND"
    print(f"  {club_name:<30} coeff={coeff:>7.1f}  {status}")

print(f"\n  Updated {club_updates} clubs" if not DRY_RUN else f"\n  Would update clubs")

# 3. FIFA world rankings → nations
print("\n── FIFA World Rankings ──")

cur.execute("SELECT id, name FROM nations")
nation_name_map = {}
for row in cur.fetchall():
    nation_name_map[row[1].strip().lower()] = row[0]

NATION_ALIASES = {
    "usa": "united states",
    "south korea": "korea republic",
    "ivory coast": "côte d'ivoire",
    "dr congo": "congo dr",
    "czech republic": "czechia",
    "cape verde": "cabo verde",
    "uae": "united arab emirates",
    "china": "china pr",
    "bosnia-herzegovina": "bosnia and herzegovina",
    "north macedonia": "north macedonia",
}

nation_updates = 0
for rank, country, points, confed in FIFA_RANKINGS:
    key = country.strip().lower()
    nation_id = nation_name_map.get(key)
    if not nation_id:
        alias = NATION_ALIASES.get(key, "")
        nation_id = nation_name_map.get(alias)
    if not nation_id:
        # Fuzzy
        for db_name, db_id in nation_name_map.items():
            if key in db_name or db_name in key:
                nation_id = db_id
                break

    if nation_id and not DRY_RUN:
        cur.execute("""
            UPDATE nations SET fifa_rank = %s, fifa_points = %s, confederation = %s
            WHERE id = %s
        """, (rank, points, confed, nation_id))
        nation_updates += 1
    status = f"→ id={nation_id}" if nation_id else "NOT FOUND"
    if rank <= 20 or not nation_id:
        print(f"  {rank:>3}. {country:<25} pts={points:>8.2f}  {confed:<10} {status}")

print(f"\n  Updated {nation_updates} nations" if not DRY_RUN else f"\n  Would update nations")

cur.close()
conn.close()
print("\nDone.")
