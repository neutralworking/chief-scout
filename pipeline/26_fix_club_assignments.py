"""
26_fix_club_assignments.py — Fix people.club_id using Transfermarkt data.

Uses latest transfermarkt_valuations.club_name as ground truth and matches
to our clubs table using multi-strategy normalization.

Also fixes the 'Ba' (Fijian club) misassignment bug where 774 players were
incorrectly linked to clubs.id=389.

Usage:
    python pipeline/26_fix_club_assignments.py [--dry-run] [--verbose]
"""
from __future__ import annotations

import sys
import re
import unicodedata

from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv
VERBOSE = "--verbose" in sys.argv


def normalize(name: str) -> str:
    """Unicode-normalize and lowercase."""
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


def strip_suffixes(name: str) -> str:
    """Remove common club suffixes like FC, CF, SC, etc."""
    # Remove trailing suffixes
    for suffix in [" fc", " cf", " sc", " ac", " bc", " afc",
                   " sfc", " fk", " sk", " bk", " jk", " f.c.",
                   " c.f.", " s.c.", " calcio", " 1909", " 1919"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    # Remove leading prefixes
    for prefix in ["fc ", "ac ", "as ", "ss ", "ssc ", "sc ", "us ",
                    "afc ", "acf ", "rc ", "rcd ", "ca ", "losc ",
                    "tsv ", "sv ", "1.", "tsg "]:
        if name.startswith(prefix):
            name = name[len(prefix):].strip()
    return name


# Manual mapping for known mismatches (TM name → our clubname)
MANUAL_MAP: dict[str, str] = {
    "fc barcelona": "Barcelona",
    "bayer 04 leverkusen": "Bayer Leverkusen",
    "real betis balompie": "Real Betis",
    "rcd espanyol barcelona": "Espanyol",
    "psv eindhoven": "PSV",
    "brighton & hove albion": "Brighton",
    "afc bournemouth": "Bournemouth",
    "ss lazio": "Lazio",
    "acf fiorentina": "Fiorentina",
    "ssc napoli": "Napoli",
    "atalanta bc": "Atalanta",
    "torino fc": "Torino",
    "juventus fc": "Juventus",
    "bologna fc 1909": "Bologna",
    "udinese calcio": "Udinese",
    "cagliari calcio": "Cagliari",
    "genoa cfc": "Genoa",
    "us sassuolo": "Sassuolo",
    "us cremonese": "Cremonese",
    "us salernitana 1919": "Salernitana",
    "us lecce": "Lecce",
    "celtic fc": "Celtic",
    "1.fc koln": "FC Koln",
    "1.fsv mainz 05": "Mainz 05",
    "1.fc heidenheim 1846": "Heidenheim",
    "1.fc union berlin": "Union Berlin",
    "sv werder bremen": "Werder Bremen",
    "sv darmstadt 98": "Darmstadt 98",
    "tsg 1899 hoffenheim": "Hoffenheim",
    "losc lille": "Lille",
    "rc lens": "Lens",
    "rc strasbourg alsace": "Strasbourg",
    "stade brestois 29": "Brest",
    "angers sco": "Angers",
    "fc metz": "Metz",
    "olympique lyon": "Lyon",
    "olympique de marseille": "Marseille",
    "atletico de madrid": "Atletico Madrid",
    "celta de vigo": "Celta Vigo",
    "ca osasuna": "Osasuna",
    "granada cf": "Granada",
    "besiktas jk": "Besiktas",
    "basaksehir fk": "Basaksehir",
    "gaziantep fk": "Gaziantep",
    "caykur rizespor": "Rizespor",
    "feyenoord rotterdam": "Feyenoord",
    "excelsior rotterdam": "Excelsior",
    "fc volendam": "Volendam",
    "al-hilal sfc": "Al-Hilal",
    "al-fateh sc": "Al-Fateh",
    "fc bayern munchen": "Bayern Munich",
    "fc augsburg": "Augsburg",
    "rb leipzig": "RB Leipzig",
    "vfb stuttgart": "Stuttgart",
    "vfl bochum": "Bochum",
    "sc freiburg": "Freiburg",
    "vfl wolfsburg": "Wolfsburg",
    "fc schalke 04": "Schalke 04",
    "hertha bsc": "Hertha Berlin",
    "arminia bielefeld": "Bielefeld",
    "as monaco": "Monaco",
    "stade de reims": "Reims",
    "fc nantes": "Nantes",
    "stade rennais fc": "Rennes",
    "fc girondins de bordeaux": "Bordeaux",
    "toulouse fc": "Toulouse",
    "clermont foot 63": "Clermont Foot",
    "inter miami cf": "Inter Miami",
    "la galaxy": "LA Galaxy",
    "real salt lake": "Real Salt Lake",
    "sunderland afc": "Sunderland",
    "ross county fc": "Ross County",
    "st. mirren fc": "St Mirren",
    "st. johnstone fc": "St Johnstone",
    "dundee fc": "Dundee",
    "kilmarnock fc": "Kilmarnock",
    "motherwell fc": "Motherwell",
    "hibernian fc": "Hibernian",
    "aberdeen fc": "Aberdeen",
    "heart of midlothian": "Hearts",
    "livingston fc": "Livingston",
    "fc groningen": "Groningen",
    "fc twente enschede": "FC Twente",
    "fc utrecht": "Utrecht",
    "sc heerenveen": "Heerenveen",
    "go ahead eagles": "Go Ahead Eagles",
    "nec nijmegen": "NEC",
    "sparta rotterdam": "Sparta Rotterdam",
    "vitesse arnhem": "Vitesse",
    "roda jc kerkrade": "Roda JC",
    "parma calcio 1913": "Parma",
    "como 1907": "Como",
    "ac monza": "Monza",
    "empoli fc": "Empoli",
    "hellas verona": "Verona",
    "venezia fc": "Venezia",
    "spezia calcio": "Spezia",
    "frosinone calcio": "Frosinone",
    "real valladolid cf": "Real Valladolid",
    "ud almeria": "Almeria",
    "rayo vallecano": "Rayo Vallecano",
    "getafe cf": "Getafe",
    "cadiz cf": "Cadiz",
    "ud las palmas": "Las Palmas",
    "girona fc": "Girona",
    "rc celta de vigo": "Celta Vigo",
    "real madrid cf": "Real Madrid",
    "villarreal cf": "Villarreal",
    "valencia cf": "Valencia",
    "real sociedad": "Real Sociedad",
    "deportivo alaves": "Alaves",
    "cd leganes": "Leganes",
    "rcd mallorca": "Mallorca",
    # German — missing from first pass
    "1.fc koln": "1. FC Koln",
    "sv darmstadt 98": "Darmstadt",
    "tsg 1899 hoffenheim": "TSG Hoffenheim",
    "vfl bochum": "VfL Bochum",
    "hertha bsc": "Hertha BSC",
    "1.fc nuremberg": "1. FC Nurnberg",
    "fc augsburg": "FC Augsburg",
    # French
    "olympique marseille": "Marseille",
    "olympique de marseille": "Marseille",
    "stade reims": "Reims",
    "stade de reims": "Reims",
    "montpellier hsc": "Montpellier",
    "aj auxerre": "Auxerre",
    "fc girondins bordeaux": "Bordeaux",
    "estac troyes": "Troyes",
    "as nancy-lorraine": "Nancy",
    "sm caen": "Caen",
    # Portuguese
    "sl benfica": "Benfica",
    "gd chaves": "Chaves",
    "gd estoril praia": "Estoril",
    "cf estrela amadora": "Estrela da Amadora",
    "cd tondela": "Tondela",
    "sc braga": "Braga",
    # Greek
    "olympiacos piraeus": "Olympiacos",
    "paok thessaloniki": "PAOK",
    # Turkish
    "kasimpasa": "Kasimpasa",
    "kocaelispor": "Kocaelispor",
    "eyupspor": "Eyupspor",
    "mke ankaragucu": "Ankaragucu",
    "genclerbirligi ankara": "Genclerbirligi",
    # Italian
    "pisa sporting club": "Pisa",
    "uc sampdoria": "Sampdoria",
    "delfino pescara 1936": "Pescara",
    # English
    "rotherham united": "Rotherham",
    "inter miami cf": "Inter Miami CF",
    "livingston fc": "Livingston FC",
    "fc groningen": "FC Groningen",
    "venezia fc": "Venezia FC",
    # Dutch
    "az alkmaar": "AZ",
    # Danish
    "brondby if": "Brondby",
    # Belgian
    "sint-truidense vv": "Sint-Truiden",
    "kmsk deinze": "Deinze",
    # Other
    "levante ud": "Levante",
    "como 1907": "Como",
    "parma calcio 1913": "Parma",
}


def main():
    import psycopg2
    import psycopg2.extras

    print("26 — Fix Club Assignments (from Transfermarkt data)")
    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Load all clubs
    cur.execute("SELECT id, clubname FROM clubs")
    clubs = cur.fetchall()
    clubs_by_name: dict[str, int] = {}
    clubs_by_norm: dict[str, int] = {}
    clubs_by_stripped: dict[str, int] = {}

    for c in clubs:
        clubs_by_name[c["clubname"]] = c["id"]
        norm = normalize(c["clubname"])
        clubs_by_norm[norm] = c["id"]
        stripped = strip_suffixes(norm)
        clubs_by_stripped[stripped] = c["id"]

    print(f"Loaded {len(clubs)} clubs")

    # Build manual map → club_id
    manual_club_ids: dict[str, int] = {}
    manual_missing = []
    for tm_norm, our_name in MANUAL_MAP.items():
        if our_name in clubs_by_name:
            manual_club_ids[tm_norm] = clubs_by_name[our_name]
        else:
            # Try normalized match
            n = normalize(our_name)
            if n in clubs_by_norm:
                manual_club_ids[tm_norm] = clubs_by_norm[n]
            else:
                manual_missing.append((tm_norm, our_name))

    if manual_missing:
        print(f"  Warning: {len(manual_missing)} manual mappings have no target club:")
        for tm, ours in manual_missing[:10]:
            print(f"    {tm!r} → {ours!r}")

    def match_tm_club(tm_club_name: str) -> int | None:
        """Match a TM club name to our clubs.id."""
        norm = normalize(tm_club_name)

        # 1. Manual override
        if norm in manual_club_ids:
            return manual_club_ids[norm]

        # 2. Exact normalized match
        if norm in clubs_by_norm:
            return clubs_by_norm[norm]

        # 3. Strip suffixes
        stripped = strip_suffixes(norm)
        if stripped in clubs_by_stripped:
            return clubs_by_stripped[stripped]
        if stripped in clubs_by_norm:
            return clubs_by_norm[stripped]

        # 4. Try removing common suffix patterns with regex
        cleaned = re.sub(r'\s+(fc|cf|sc|ac|bc|fk|jk|sk|sfc|afc|calcio)$', '', norm)
        if cleaned != norm and cleaned in clubs_by_norm:
            return clubs_by_norm[cleaned]

        return None

    # Get latest TM club for each player
    print("Loading latest Transfermarkt club assignments...")
    cur.execute("""
        SELECT DISTINCT ON (person_id)
            person_id, club_name
        FROM transfermarkt_valuations
        WHERE club_name IS NOT NULL
          AND club_name != 'Without Club'
          AND club_name != 'Retired'
          AND club_name != 'Career Break'
        ORDER BY person_id, date DESC
    """)
    latest_tm = cur.fetchall()
    print(f"  {len(latest_tm):,} players with TM club data")

    # Get current club assignments
    cur.execute("SELECT id, club_id FROM people")
    current = {r["id"]: r["club_id"] for r in cur.fetchall()}

    # Match and plan updates
    updates: list[tuple[int, int]] = []  # (person_id, new_club_id)
    unmatched: dict[str, int] = {}
    fixed_ba = 0
    fixed_null = 0
    fixed_other = 0

    for row in latest_tm:
        pid = row["person_id"]
        tm_club = row["club_name"]
        new_club_id = match_tm_club(tm_club)

        if new_club_id is None:
            norm = normalize(tm_club)
            unmatched[norm] = unmatched.get(norm, 0) + 1
            continue

        cur_club_id = current.get(pid)
        if cur_club_id == new_club_id:
            continue  # already correct

        if cur_club_id == 389:
            fixed_ba += 1
        elif cur_club_id is None:
            fixed_null += 1
        else:
            fixed_other += 1

        updates.append((new_club_id, pid))

    # Summary
    print(f"\nPlan:")
    print(f"  Total fixes: {len(updates):,}")
    print(f"    Fixed 'Ba' misassignment: {fixed_ba:,}")
    print(f"    Fixed NULL club: {fixed_null:,}")
    print(f"    Fixed other: {fixed_other:,}")
    print(f"  Unmatched TM clubs: {len(unmatched)}")

    if unmatched and VERBOSE:
        print("\n  Top unmatched TM club names:")
        for name, cnt in sorted(unmatched.items(), key=lambda x: -x[1])[:30]:
            print(f"    {name:<40} {cnt:>4}")

    if unmatched:
        top_unmatched = sorted(unmatched.items(), key=lambda x: -x[1])[:10]
        print(f"\n  Top 10 unmatched:")
        for name, cnt in top_unmatched:
            print(f"    {name:<40} {cnt:>4}")

    if DRY_RUN:
        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # Write updates
    print(f"\nWriting {len(updates):,} club assignments...")
    BATCH = 500
    for i in range(0, len(updates), BATCH):
        batch = updates[i:i + BATCH]
        cur.executemany(
            "UPDATE people SET club_id = %s, updated_at = now() WHERE id = %s",
            batch
        )
        conn.commit()
        done = min(i + BATCH, len(updates))
        print(f"  {done:,}/{len(updates):,}", end="\r")

    # Also: null out club_id for any remaining Ba-assigned players (they're wrong)
    cur.execute("UPDATE people SET club_id = NULL WHERE club_id = 389")
    remaining_ba = cur.rowcount
    conn.commit()
    if remaining_ba > 0:
        print(f"\n  Cleared {remaining_ba:,} remaining 'Ba' misassignments → NULL")

    print(f"\nDone. {len(updates):,} club assignments fixed.")
    conn.close()


if __name__ == "__main__":
    main()
