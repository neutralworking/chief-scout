"""
16_club_ingest.py — Parse clubs.csv and populate the clubs table with nation links.

Parses the wiki-link format in imports/clubs.csv, resolves nation_id from the
nations table (inserting missing nations as needed), and upserts into clubs.

Usage:
    python pipeline/16_club_ingest.py [--dry-run] [--force] [--parse-only]

Flags:
    --dry-run     Print what would be done without writing to DB
    --force       Overwrite existing clubs (by default, skips existing names)
    --parse-only  Just parse the CSV and print results (no DB connection needed)
"""
from __future__ import annotations

import re
import sys
import unicodedata

from config import POSTGRES_DSN, IMPORTS_DIR

DRY_RUN = "--dry-run" in sys.argv
FORCE = "--force" in sys.argv
PARSE_ONLY = "--parse-only" in sys.argv

CLUBS_CSV = IMPORTS_DIR / "clubs.csv"

# ── Football code → full nation name mapping ────────────────────────────────
# clubs.csv uses FIFA-style codes; nations table uses full names.
FOOTBALL_CODE_TO_NATION = {
    "ENG": "England", "GER": "Germany", "ESP": "Spain", "FRA": "France",
    "ITA": "Italy", "NED": "Netherlands", "POR": "Portugal", "BRA": "Brazil",
    "ARG": "Argentina", "SCO": "Scotland", "WAL": "Wales", "IRL": "Ireland",
    "NIR": "Northern Ireland", "BEL": "Belgium", "AUT": "Austria",
    "SUI": "Switzerland", "DEN": "Denmark", "SWE": "Sweden", "NOR": "Norway",
    "FIN": "Finland", "GRE": "Greece", "TUR": "Turkey", "RUS": "Russia",
    "UKR": "Ukraine", "POL": "Poland", "CZE": "Czech Republic",
    "CRO": "Croatia", "SRB": "Serbia", "ROM": "Romania", "BUL": "Bulgaria",
    "HUN": "Hungary", "SVK": "Slovakia", "SVN": "Slovenia",
    "USA": "United States", "MEX": "Mexico", "CAN": "Canada",
    "COL": "Colombia", "CHI": "Chile", "URU": "Uruguay", "PER": "Peru",
    "ECU": "Ecuador", "PAR": "Paraguay", "BOL": "Bolivia", "VEN": "Venezuela",
    "JPN": "Japan", "KOR": "South Korea", "CHN": "China", "AUS": "Australia",
    "NZL": "New Zealand", "RSA": "South Africa", "EGY": "Egypt",
    "NGA": "Nigeria", "GHA": "Ghana", "CMR": "Cameroon", "CIV": "Ivory Coast",
    "SEN": "Senegal", "MAR": "Morocco", "TUN": "Tunisia", "ALG": "Algeria",
    "ISR": "Israel", "SAU": "Saudi Arabia", "UAE": "United Arab Emirates",
    "QAT": "Qatar", "IRN": "Iran", "IRQ": "Iraq",
    "CRC": "Costa Rica", "HON": "Honduras", "SLV": "El Salvador",
    "GUA": "Guatemala", "PAN": "Panama", "JAM": "Jamaica",
    "TRI": "Trinidad and Tobago", "HAI": "Haiti",
    "ISL": "Iceland", "LUX": "Luxembourg", "CYP": "Cyprus",
    "MLT": "Malta", "GEO": "Georgia", "ARM": "Armenia", "AZE": "Azerbaijan",
    "KAZ": "Kazakhstan", "UZB": "Uzbekistan", "BLR": "Belarus",
    "MDA": "Moldova", "LTU": "Lithuania", "LVA": "Latvia", "EST": "Estonia",
    "MNE": "Montenegro", "BIH": "Bosnia and Herzegovina",
    "MKD": "North Macedonia", "ALB": "Albania", "SMR": "San Marino",
    "AND": "Andorra", "LIE": "Liechtenstein", "FRO": "Faroe Islands",
    "GUY": "Guyana", "SUR": "Suriname", "BER": "Bermuda",
    "IND": "India", "THA": "Thailand", "VIE": "Vietnam", "MYS": "Malaysia",
    "SGP": "Singapore", "IDN": "Indonesia", "PHI": "Philippines",
    "KEN": "Kenya", "TAN": "Tanzania", "UGA": "Uganda", "ZAM": "Zambia",
    "ZIM": "Zimbabwe", "MOZ": "Mozambique", "ANG": "Angola",
    "CGO": "Congo", "COD": "DR Congo", "GAB": "Gabon",
    "MLI": "Mali", "BUR": "Burkina Faso", "TOG": "Togo", "BEN": "Benin",
    "NIG": "Niger", "GUI": "Guinea", "MAD": "Madagascar",
    "RWA": "Rwanda", "ETH": "Ethiopia", "SUD": "Sudan",
}

# Nation name aliases found in clubs.csv (bracketed alternatives)
NATION_ALIASES = {
    "México": "Mexico", "Panamá": "Panama", "Brasil": "Brazil", "Latvija": "Latvia",
    "Schweiz": "Switzerland", "Österreich": "Austria", "Türkiye": "Turkey",
    "Polska": "Poland", "Česko": "Czech Republic", "Hrvatska": "Croatia",
    "Srbija": "Serbia", "România": "Romania", "Magyarország": "Hungary",
    "Slovensko": "Slovakia", "Slovenija": "Slovenia",
}

# Skip placeholder clubs
SKIP_NAMES = {"Lots of Players", "Free Agent", "Free Agents", "Retired", "None"}


def normalise(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def parse_clubs_csv(path) -> list[dict]:
    """Parse the wiki-link format clubs.csv into structured records."""
    raw = path.read_text(encoding="utf-8")

    # Split into individual entries by #slug pattern
    entries = re.split(r'(#[a-z0-9]+)\s*', raw)

    clubs = []
    i = 0
    while i < len(entries) - 1:
        text = entries[i].strip()
        slug = entries[i + 1].lstrip("#") if i + 1 < len(entries) else ""
        i += 2

        if not text or not slug:
            continue

        # Extract nation: ( NationName (CODE) ) or (NationName(CODE))
        # Use [^()\[\]]+ to match any nation name chars (including combining accents)
        nation_match = re.search(
            r'\(\s*([^()\[\]]+?)(?:\s*\[[^\]]*\])?\s*\(([A-Z§]{2,4})\)\s*\)\s*$',
            text
        )
        if not nation_match:
            nation_match = re.search(
                r'\(([^()\[\]]+?)(?:\[[^\]]*\])?\(([A-Z§]{2,4})\)\)',
                text
            )

        nation_name = None
        nation_code = None
        if nation_match:
            raw_nation = nation_match.group(1).strip()
            nation_code = nation_match.group(2).strip().replace("§", "")  # fix corrupted codes
            # Normalize combining accents to precomposed form for alias lookup
            raw_nation_nfc = unicodedata.normalize("NFC", raw_nation)
            nation_name = NATION_ALIASES.get(raw_nation_nfc, NATION_ALIASES.get(raw_nation, raw_nation_nfc))
            if nation_code in FOOTBALL_CODE_TO_NATION:
                nation_name = FOOTBALL_CODE_TO_NATION[nation_code]
            text = text[:nation_match.start()].strip()

        # Extract club name
        bracket_match = re.search(r'\[\[(.+?)\]\]', text)
        if bracket_match:
            club_name = bracket_match.group(1).strip()
        else:
            club_name = re.sub(r'\s*\([A-Z]{2,4}\)\s*$', '', text).strip()
            club_name = re.sub(r'^\s*\[\[|\]\]\s*$', '', club_name).strip()

        # Remove any extra descriptive text in [] after the name
        club_name = re.sub(r'\s*\[.*?\]\s*', ' ', club_name).strip()

        if not club_name or club_name in SKIP_NAMES:
            continue

        clubs.append({
            "name": club_name,
            "slug": slug,
            "nation": nation_name,
            "nation_code": nation_code,
        })

    return clubs


def deduplicate(clubs: list[dict]) -> list[dict]:
    """Deduplicate by slug."""
    seen = set()
    out = []
    for c in clubs:
        if c["slug"] not in seen:
            seen.add(c["slug"])
            out.append(c)
    return out


def main():
    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Parsing clubs from {CLUBS_CSV}")

    clubs = deduplicate(parse_clubs_csv(CLUBS_CSV))
    print(f"Unique clubs parsed: {len(clubs)}")

    # Nation coverage
    with_nation = sum(1 for c in clubs if c["nation"])
    nations_found = sorted(set(c["nation"] for c in clubs if c["nation"]))
    print(f"With nation: {with_nation}/{len(clubs)} ({len(nations_found)} distinct nations)")

    if PARSE_ONLY:
        print("\n── Sample clubs ──")
        for c in clubs[:20]:
            print(f"  {c['name']:40s} {c['nation'] or '?':20s} #{c['slug']}")
        print(f"\n── Nations ({len(nations_found)}) ──")
        for n in nations_found:
            count = sum(1 for c in clubs if c["nation"] == n)
            print(f"  {n:30s} {count:3d} clubs")
        return

    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Load existing nations ────────────────────────────────────────────────
    cur.execute("SELECT id, name FROM nations")
    nation_map = {r["name"]: r["id"] for r in cur.fetchall()}
    print(f"Existing nations in DB: {len(nation_map)}")

    # Insert missing nations
    nations_to_add = {c["nation"] for c in clubs if c["nation"] and c["nation"] not in nation_map}
    if nations_to_add:
        print(f"Inserting {len(nations_to_add)} new nations...")
        if not DRY_RUN:
            for n in sorted(nations_to_add):
                cur.execute(
                    "INSERT INTO nations (name) VALUES (%s) ON CONFLICT (name) DO NOTHING RETURNING id",
                    (n,)
                )
                result = cur.fetchone()
                if result:
                    nation_map[n] = result["id"]
                else:
                    cur.execute("SELECT id FROM nations WHERE name = %s", (n,))
                    row = cur.fetchone()
                    if row:
                        nation_map[n] = row["id"]

    # ── Load existing clubs ──────────────────────────────────────────────────
    cur.execute("SELECT id, name FROM clubs")
    existing_clubs = {normalise(r["name"]): r["id"] for r in cur.fetchall()}
    print(f"Existing clubs in DB: {len(existing_clubs)}")

    # ── Upsert clubs ─────────────────────────────────────────────────────────
    inserted = updated = skipped = 0

    for c in clubs:
        nation_id = nation_map.get(c["nation"]) if c["nation"] else None
        norm_name = normalise(c["name"])

        if norm_name in existing_clubs:
            if FORCE:
                if not DRY_RUN:
                    cur.execute(
                        "UPDATE clubs SET nation_id = %s WHERE id = %s",
                        (nation_id, existing_clubs[norm_name])
                    )
                updated += 1
            else:
                skipped += 1
        else:
            if not DRY_RUN:
                cur.execute(
                    "INSERT INTO clubs (name, nation_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (c["name"], nation_id)
                )
            inserted += 1

    print(f"Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}")

    if not DRY_RUN:
        conn.commit()
        print("Committed.")
    else:
        conn.rollback()
        print("[DRY RUN] Rolled back.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
