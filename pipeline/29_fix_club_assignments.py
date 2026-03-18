"""
29_fix_club_assignments.py — Fix people.club_id using multi-source priority.

Source priority (highest first):
  1. API-Football (latest season team_name) — freshest, per-player matched
  2. Transfermarkt valuations (latest date) — broad coverage
  3. Wikidata career history (latest start_date) — backup for gaps

Each source's club name is matched to our clubs table using:
  - Manual mapping (150+ known name variants)
  - Exact normalized match
  - Suffix-stripped match
  - Regex-cleaned match

Usage:
    python 29_fix_club_assignments.py [--dry-run] [--verbose] [--source af|tm|wd|all]
"""
from __future__ import annotations

import re
import sys
import unicodedata

from lib.db import require_conn

DRY_RUN = "--dry-run" in sys.argv
VERBOSE = "--verbose" in sys.argv

# Parse --source flag (default: all)
SOURCE_FILTER = "all"
for i, arg in enumerate(sys.argv):
    if arg == "--source" and i + 1 < len(sys.argv):
        SOURCE_FILTER = sys.argv[i + 1]


def normalize(name: str) -> str:
    """Unicode-normalize and lowercase."""
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


def strip_suffixes(name: str) -> str:
    """Remove common club suffixes like FC, CF, SC, etc."""
    for suffix in [" fc", " cf", " sc", " ac", " bc", " afc",
                   " sfc", " fk", " sk", " bk", " jk", " f.c.",
                   " c.f.", " s.c.", " calcio", " 1909", " 1919"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    for prefix in ["fc ", "ac ", "as ", "ss ", "ssc ", "sc ", "us ",
                    "afc ", "acf ", "rc ", "rcd ", "ca ", "losc ",
                    "tsv ", "sv ", "1.", "tsg "]:
        if name.startswith(prefix):
            name = name[len(prefix):].strip()
    return name


# Manual mapping: source club name (normalized) → our clubname
MANUAL_MAP: dict[str, str] = {
    # Spanish
    "fc barcelona": "Barcelona",
    "futbol club barcelona": "Barcelona",
    "real betis balompie": "Real Betis",
    "rcd espanyol barcelona": "Espanyol",
    "atletico de madrid": "Atletico Madrid",
    "atletico madrid": "Atletico Madrid",
    "club atletico de madrid": "Atletico Madrid",
    "celta de vigo": "Celta Vigo",
    "rc celta de vigo": "Celta Vigo",
    "ca osasuna": "Osasuna",
    "granada cf": "Granada",
    "real madrid cf": "Real Madrid",
    "real madrid club de futbol": "Real Madrid",
    "villarreal cf": "Villarreal",
    "valencia cf": "Valencia",
    "real sociedad": "Real Sociedad",
    "deportivo alaves": "Alaves",
    "cd leganes": "Leganes",
    "rcd mallorca": "Mallorca",
    "real valladolid cf": "Real Valladolid",
    "ud almeria": "Almeria",
    "rayo vallecano": "Rayo Vallecano",
    "getafe cf": "Getafe",
    "cadiz cf": "Cadiz",
    "ud las palmas": "Las Palmas",
    "girona fc": "Girona",
    "levante ud": "Levante",
    # English
    "brighton & hove albion": "Brighton",
    "brighton & hove albion f.c.": "Brighton",
    "brighton and hove albion": "Brighton",
    "afc bournemouth": "Bournemouth",
    "tottenham hotspur f.c.": "Tottenham Hotspur",
    "manchester city f.c.": "Manchester City",
    "manchester united f.c.": "Manchester United",
    "arsenal f.c.": "Arsenal",
    "chelsea f.c.": "Chelsea",
    "liverpool f.c.": "Liverpool",
    "newcastle united f.c.": "Newcastle United",
    "west ham united f.c.": "West Ham United",
    "aston villa f.c.": "Aston Villa",
    "wolverhampton wanderers f.c.": "Wolverhampton",
    "crystal palace f.c.": "Crystal Palace",
    "everton f.c.": "Everton",
    "fulham f.c.": "Fulham",
    "brentford f.c.": "Brentford",
    "nottingham forest f.c.": "Nottingham Forest",
    "sunderland afc": "Sunderland",
    "sunderland a.f.c.": "Sunderland",
    "rotherham united": "Rotherham",
    "leicester city f.c.": "Leicester City",
    "ipswich town f.c.": "Ipswich Town",
    "southampton f.c.": "Southampton",
    "leeds united f.c.": "Leeds United",
    "burnley f.c.": "Burnley",
    "sheffield united f.c.": "Sheffield United",
    "luton town f.c.": "Luton Town",
    # German
    "bayer 04 leverkusen": "Bayer Leverkusen",
    "fc bayern munchen": "Bayern Munich",
    "bayern munchen": "Bayern Munich",
    "fc bayern munich": "Bayern Munich",
    "rb leipzig": "RB Leipzig",
    "vfb stuttgart": "Stuttgart",
    "vfl bochum": "Bochum",
    "sc freiburg": "Freiburg",
    "vfl wolfsburg": "Wolfsburg",
    "fc schalke 04": "Schalke 04",
    "hertha bsc": "Hertha Berlin",
    "arminia bielefeld": "Bielefeld",
    "fc augsburg": "Augsburg",
    "1.fc koln": "FC Koln",
    "1. fc koln": "FC Koln",
    "1.fsv mainz 05": "Mainz 05",
    "1.fc heidenheim 1846": "Heidenheim",
    "1.fc union berlin": "Union Berlin",
    "sv werder bremen": "Werder Bremen",
    "sv darmstadt 98": "Darmstadt",
    "tsg 1899 hoffenheim": "Hoffenheim",
    "eintracht frankfurt": "Eintracht Frankfurt",
    "borussia dortmund": "Borussia Dortmund",
    "borussia monchengladbach": "Borussia Monchengladbach",
    "greuther furth": "Greuther Furth",
    # French
    "as monaco": "Monaco",
    "losc lille": "Lille",
    "osc lille": "Lille",
    "rc lens": "Lens",
    "rc strasbourg alsace": "Strasbourg",
    "stade brestois 29": "Brest",
    "angers sco": "Angers",
    "fc metz": "Metz",
    "olympique lyon": "Lyon",
    "olympique lyonnais": "Lyon",
    "olympique de marseille": "Marseille",
    "olympique marseille": "Marseille",
    "stade de reims": "Reims",
    "stade reims": "Reims",
    "stade rennais fc": "Rennes",
    "stade rennais f.c.": "Rennes",
    "montpellier hsc": "Montpellier",
    "aj auxerre": "Auxerre",
    "fc girondins de bordeaux": "Bordeaux",
    "fc girondins bordeaux": "Bordeaux",
    "toulouse fc": "Toulouse",
    "clermont foot 63": "Clermont Foot",
    "estac troyes": "Troyes",
    "as nancy-lorraine": "Nancy",
    "sm caen": "Caen",
    "fc nantes": "Nantes",
    "paris saint-germain fc": "Paris Saint-Germain",
    "paris saint-germain f.c.": "Paris Saint-Germain",
    # Italian
    "ss lazio": "Lazio",
    "acf fiorentina": "Fiorentina",
    "ssc napoli": "Napoli",
    "atalanta bc": "Atalanta",
    "torino fc": "Torino",
    "juventus fc": "Juventus",
    "juventus f.c.": "Juventus",
    "bologna fc 1909": "Bologna",
    "bologna f.c. 1909": "Bologna",
    "udinese calcio": "Udinese",
    "cagliari calcio": "Cagliari",
    "genoa cfc": "Genoa",
    "us sassuolo": "Sassuolo",
    "us cremonese": "Cremonese",
    "us salernitana 1919": "Salernitana",
    "us lecce": "Lecce",
    "parma calcio 1913": "Parma",
    "como 1907": "Como",
    "ac monza": "Monza",
    "empoli fc": "Empoli",
    "hellas verona": "Verona",
    "venezia fc": "Venezia",
    "spezia calcio": "Spezia",
    "frosinone calcio": "Frosinone",
    "uc sampdoria": "Sampdoria",
    "pisa sporting club": "Pisa",
    "delfino pescara 1936": "Pescara",
    "ac milan": "AC Milan",
    "inter milan": "Inter Milan",
    "fc internazionale milano": "Inter Milan",
    # Portuguese
    "sl benfica": "Benfica",
    "s.l. benfica": "Benfica",
    "sc braga": "Braga",
    "sporting cp": "Sporting CP",
    "sporting clube de portugal": "Sporting CP",
    "gd chaves": "Chaves",
    "gd estoril praia": "Estoril",
    "cf estrela amadora": "Estrela da Amadora",
    "cd tondela": "Tondela",
    "fc porto": "Porto",
    # Dutch
    "psv eindhoven": "PSV",
    "feyenoord rotterdam": "Feyenoord",
    "excelsior rotterdam": "Excelsior",
    "fc volendam": "Volendam",
    "az alkmaar": "AZ",
    "fc groningen": "Groningen",
    "fc twente enschede": "FC Twente",
    "fc utrecht": "Utrecht",
    "sc heerenveen": "Heerenveen",
    "go ahead eagles": "Go Ahead Eagles",
    "nec nijmegen": "NEC",
    "sparta rotterdam": "Sparta Rotterdam",
    "vitesse arnhem": "Vitesse",
    "roda jc kerkrade": "Roda JC",
    "afc ajax": "Ajax",
    # Scottish
    "celtic fc": "Celtic",
    "celtic f.c.": "Celtic",
    "rangers f.c.": "Rangers",
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
    # Turkish
    "besiktas jk": "Besiktas",
    "basaksehir fk": "Basaksehir",
    "gaziantep fk": "Gaziantep",
    "caykur rizespor": "Rizespor",
    "kasimpasa": "Kasimpasa",
    "kocaelispor": "Kocaelispor",
    "eyupspor": "Eyupspor",
    "mke ankaragucu": "Ankaragucu",
    "genclerbirligi ankara": "Genclerbirligi",
    "fenerbahce istanbul": "Fenerbahce",
    "galatasaray a.s.": "Galatasaray",
    "trabzonspor a.s.": "Trabzonspor",
    # Greek
    "olympiacos piraeus": "Olympiacos",
    "paok thessaloniki": "PAOK",
    # Saudi
    "al-hilal sfc": "Al-Hilal",
    "al-fateh sc": "Al-Fateh",
    "al ahli fc": "Al-Ahli",
    "al ahli saudi fc": "Al-Ahli",
    # Belgian
    "sint-truidense vv": "Sint-Truiden",
    "kmsk deinze": "Deinze",
    "k.r.c. genk": "Genk",
    "rsc anderlecht": "Anderlecht",
    "club brugge kv": "Club Brugge",
    # American
    "inter miami cf": "Inter Miami CF",
    "la galaxy": "LA Galaxy",
    "real salt lake": "Real Salt Lake",
    "los angeles fc": "LAFC",
    # Danish
    "brondby if": "Brondby",
    # API-Football specific names (often use local language)
    "bayern munchen": "Bayern Munich",
    "bayern münchen": "Bayern Munich",
    "paris saint germain": "Paris Saint-Germain",
    # Additional unmatched
    "kasimpasa": "Kasimpasa",
    "sk slavia prague": "Slavia Prague",
    "eyupspor": "Eyupspor",
    "fsv mainz 05": "Mainz 05",
    "kocaelispor": "Kocaelispor",
    "red bull new york": "New York Red Bulls",
    "1. fc heidenheim": "Heidenheim",
    "lech poznan": "Lech Poznan",
    "1.fc nuremberg": "Nurnberg",
    "brondby if": "Brondby",
    "rsc anderlecht": "Anderlecht",
    "club brugge kv": "Club Brugge",
    "chicago stars fc": "Chicago Stars",
    # Wikidata long names
    "wolverhampton wanderers f.c.": "Wolverhampton",
    "west ham united f.c.": "West Ham United",
    "colchester united f.c.": "Colchester United",
    "charlton athletic f.c.": "Charlton Athletic",
    "dundee united f.c.": "Dundee United",
}


def main():
    import psycopg2.extras

    print("29 — Fix Club Assignments (multi-source priority)")
    print(f"  Sources: {SOURCE_FILTER}")
    conn = require_conn()
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Load clubs ────────────────────────────────────────────────────────────
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

    print(f"  Loaded {len(clubs)} clubs")

    # Build manual map → club_id
    manual_club_ids: dict[str, int] = {}
    for src_norm, our_name in MANUAL_MAP.items():
        if our_name in clubs_by_name:
            manual_club_ids[normalize(src_norm)] = clubs_by_name[our_name]
        else:
            n = normalize(our_name)
            if n in clubs_by_norm:
                manual_club_ids[normalize(src_norm)] = clubs_by_norm[n]

    def match_club(club_name: str) -> int | None:
        """Match an external club name to our clubs.id."""
        norm = normalize(club_name)
        if norm in manual_club_ids:
            return manual_club_ids[norm]
        if norm in clubs_by_norm:
            return clubs_by_norm[norm]
        stripped = strip_suffixes(norm)
        if stripped in clubs_by_stripped:
            return clubs_by_stripped[stripped]
        if stripped in clubs_by_norm:
            return clubs_by_norm[stripped]
        cleaned = re.sub(r'\s+(fc|cf|sc|ac|bc|fk|jk|sk|sfc|afc|calcio)$', '', norm)
        if cleaned != norm and cleaned in clubs_by_norm:
            return clubs_by_norm[cleaned]
        return None

    # ── Load current assignments ──────────────────────────────────────────────
    cur.execute("SELECT id, club_id FROM people")
    current = {r["id"]: r["club_id"] for r in cur.fetchall()}

    # ── Source 1: API-Football (highest priority) ─────────────────────────────
    af_clubs: dict[int, str] = {}
    if SOURCE_FILTER in ("all", "af"):
        print("\n  Source 1: API-Football (latest season)...")
        cur.execute("""
            SELECT DISTINCT ON (person_id)
                person_id, team_name
            FROM api_football_player_stats
            WHERE person_id IS NOT NULL
              AND team_name IS NOT NULL
            ORDER BY person_id, season DESC
        """)
        for r in cur.fetchall():
            af_clubs[r["person_id"]] = r["team_name"]
        print(f"    {len(af_clubs)} players")

    # ── Source 2: Transfermarkt (second priority) ─────────────────────────────
    tm_clubs: dict[int, str] = {}
    if SOURCE_FILTER in ("all", "tm"):
        print("  Source 2: Transfermarkt (latest valuation)...")
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
        for r in cur.fetchall():
            tm_clubs[r["person_id"]] = r["club_name"]
        print(f"    {len(tm_clubs)} players")

    # ── Source 3: Wikidata career (lowest priority) ───────────────────────────
    wd_clubs: dict[int, str] = {}
    if SOURCE_FILTER in ("all", "wd"):
        print("  Source 3: Wikidata career history (latest entry)...")
        cur.execute("""
            SELECT DISTINCT ON (person_id)
                person_id, club_name
            FROM player_career_history
            WHERE club_name IS NOT NULL
              AND club_name NOT LIKE '%%national%%'
              AND club_name NOT LIKE '%%under-%%'
              AND end_date IS NULL
            ORDER BY person_id, start_date DESC NULLS LAST
        """)
        for r in cur.fetchall():
            wd_clubs[r["person_id"]] = r["club_name"]
        print(f"    {len(wd_clubs)} players")

    # ── Detect suspect TM data (youth/reserve teams for senior players) ──────
    # Only flag players whose LATEST TM entry is a youth/reserve team
    BAD_TM_PIDS: set[int] = set()
    cur.execute("""
        WITH latest_tm AS (
            SELECT DISTINCT ON (person_id) person_id, club_name
            FROM transfermarkt_valuations
            WHERE club_name IS NOT NULL
            ORDER BY person_id, date DESC
        )
        SELECT lt.person_id, lt.club_name
        FROM latest_tm lt
        JOIN player_profiles pp ON pp.person_id = lt.person_id
        WHERE pp.level >= 78
          AND (lt.club_name ~ ' (II|III|B|C|U19|U21|U23)$'
            OR lt.club_name LIKE '%%Mestalla%%'
            OR lt.club_name LIKE '%%Reserves%%'
            OR lt.club_name LIKE '%%Youth%%')
    """)
    for r in cur.fetchall():
        BAD_TM_PIDS.add(r["person_id"])
    if BAD_TM_PIDS:
        print(f"  Flagged {len(BAD_TM_PIDS)} players with youth/reserve TM data (skip TM for these)")

    # ── Merge with priority ───────────────────────────────────────────────────
    all_pids = set(af_clubs) | set(tm_clubs) | set(wd_clubs)
    print(f"\n  Total players with club data: {len(all_pids)}")

    updates: list[tuple[int, int, str, str]] = []  # (pid, new_club_id, source, club_name)
    skipped: list[tuple[int, str, str]] = []
    unmatched: dict[str, int] = {}
    source_counts = {"af": 0, "tm": 0, "wd": 0}

    for pid in all_pids:
        # Pick best source (skip TM for known-bad entities)
        club_name = None
        source = None
        if pid in af_clubs:
            club_name = af_clubs[pid]
            source = "af"
        elif pid in tm_clubs and pid not in BAD_TM_PIDS:
            club_name = tm_clubs[pid]
            source = "tm"
        elif pid in wd_clubs:
            club_name = wd_clubs[pid]
            source = "wd"

        if not club_name:
            if pid in BAD_TM_PIDS:
                skipped.append((pid, "tm", f"bad TM entity: {tm_clubs.get(pid, '?')}"))
            continue

        new_club_id = match_club(club_name)
        if new_club_id is None:
            norm = normalize(club_name)
            unmatched[norm] = unmatched.get(norm, 0) + 1
            continue

        cur_club_id = current.get(pid)
        if cur_club_id == new_club_id:
            continue  # already correct

        source_counts[source] += 1
        updates.append((pid, new_club_id, source, club_name))

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n  Updates planned: {len(updates)}")
    print(f"    From API-Football: {source_counts['af']}")
    print(f"    From Transfermarkt: {source_counts['tm']}")
    print(f"    From Wikidata: {source_counts['wd']}")
    print(f"  Skipped (bad entity): {len(skipped)}")
    print(f"  Unmatched club names: {len(unmatched)}")

    if skipped:
        cur.execute("SELECT id, name FROM people WHERE id = ANY(%s)", ([s[0] for s in skipped],))
        skip_names = {r["id"]: r["name"] for r in cur.fetchall()}
        print(f"\n  Skipped (bad TM entity — youth/reserve data for senior player):")
        for pid, src, reason in skipped:
            pname = skip_names.get(pid, f"#{pid}")
            print(f"    {pname:30s} → {reason}")

    if unmatched:
        top = sorted(unmatched.items(), key=lambda x: -x[1])[:20]
        print(f"\n  Top unmatched club names:")
        for name, cnt in top:
            print(f"    {name:<45} {cnt:>4}")

    if VERBOSE and updates:
        print(f"\n  Sample updates:")
        # Show first 20
        cur.execute("SELECT id, name FROM people WHERE id = ANY(%s)", ([u[0] for u in updates[:20]],))
        names = {r["id"]: r["name"] for r in cur.fetchall()}
        for pid, cid, src, cname in updates[:20]:
            old_cid = current.get(pid)
            pname = names.get(pid, f"#{pid}")
            print(f"    {pname:30s} {src:3s} → {cname:30s} (club_id {old_cid} → {cid})")

    if DRY_RUN:
        print("\n  --dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write ─────────────────────────────────────────────────────────────────
    print(f"\n  Writing {len(updates)} club assignments...")
    BATCH = 500
    for i in range(0, len(updates), BATCH):
        batch = [(u[1], u[0]) for u in updates[i:i + BATCH]]  # (club_id, person_id)
        cur.executemany(
            "UPDATE people SET club_id = %s, updated_at = now() WHERE id = %s",
            batch
        )
        conn.commit()

    # Clear 'Ba' misassignments (club_id=389 is a Fijian club catch-all)
    cur.execute("UPDATE people SET club_id = NULL WHERE club_id = 389")
    ba_cleared = cur.rowcount
    conn.commit()
    if ba_cleared > 0:
        print(f"  Cleared {ba_cleared} 'Ba' misassignments → NULL")

    print(f"\n  Done. {len(updates)} club assignments updated.")
    conn.close()


if __name__ == "__main__":
    main()
