"""
21_seed_alltime_xi.py — Seed All-Time XI position candidates.

Populates fc_position_candidates with curated player options for each
position slot in the 4-3-3 template. Users pick from these when building
their All-Time XI.

Requires: migrations 015_football_choices.sql + 016_alltime_xi.sql applied.

Usage:
    python 21_seed_alltime_xi.py --dry-run     # preview
    python 21_seed_alltime_xi.py               # insert
    python 21_seed_alltime_xi.py --force       # clear and re-insert
"""
import argparse
import sys
import psycopg2
from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Seed All-Time XI candidates")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# Get template ID for 4-3-3
cur.execute("SELECT id FROM fc_squad_templates WHERE slug = 'classic-433'")
row = cur.fetchone()
if not row:
    print("ERROR: 4-3-3 template not found. Run migration 016 first.")
    sys.exit(1)
TEMPLATE_ID = row[0]

# Look up people for linking
cur.execute("SELECT id, name FROM people")
people = {}
for pid, pname in cur.fetchall():
    people[pname.lower().strip()] = pid

def find_person(name: str) -> int | None:
    norm = name.lower().strip()
    if norm in people:
        return people[norm]
    for pname, pid in people.items():
        if norm in pname or pname in norm:
            return pid
    return None

# ── Candidates per slot ──────────────────────────────────────────────────────
# slot: [(name, subtitle, era), ...]

CANDIDATES = {
    # Slot 1: Goalkeeper
    1: [
        ("Gianluigi Buffon", "Italy, 1995-2023", "modern"),
        ("Manuel Neuer", "Germany, 2004-present", "modern"),
        ("Lev Yashin", "USSR, 1950-1970", "legend"),
        ("Peter Schmeichel", "Denmark, 1981-2003", "classic"),
        ("Iker Casillas", "Spain, 1999-2020", "modern"),
        ("Gordon Banks", "England, 1958-1977", "legend"),
        ("Dino Zoff", "Italy, 1961-1983", "classic"),
        ("Thibaut Courtois", "Belgium, 2009-present", "modern"),
        ("Jan Oblak", "Slovenia, 2009-present", "modern"),
        ("Edwin van der Sar", "Netherlands, 1990-2011", "classic"),
    ],
    # Slot 2: Right Back
    2: [
        ("Cafu", "Brazil, 1988-2008", "classic"),
        ("Dani Alves", "Brazil, 2001-2023", "modern"),
        ("Philipp Lahm", "Germany, 2002-2017", "modern"),
        ("Javier Zanetti", "Argentina, 1992-2014", "classic"),
        ("Kyle Walker", "England, 2009-present", "modern"),
        ("Trent Alexander-Arnold", "England, 2016-present", "modern"),
        ("Lilian Thuram", "France, 1991-2008", "classic"),
        ("Maicon", "Brazil, 2001-2017", "modern"),
        ("Gary Neville", "England, 1992-2011", "classic"),
        ("Joshua Kimmich", "Germany, 2013-present", "modern"),
    ],
    # Slot 3: Centre Back (left)
    3: [
        ("Franco Baresi", "Italy, 1977-1997", "legend"),
        ("Franz Beckenbauer", "Germany, 1964-1983", "legend"),
        ("Paolo Maldini", "Italy, 1985-2009", "classic"),
        ("Virgil van Dijk", "Netherlands, 2011-present", "modern"),
        ("Sergio Ramos", "Spain, 2003-present", "modern"),
        ("John Terry", "England, 1998-2018", "modern"),
        ("Alessandro Nesta", "Italy, 1993-2012", "classic"),
        ("Bobby Moore", "England, 1958-1977", "legend"),
        ("Fabio Cannavaro", "Italy, 1992-2011", "classic"),
        ("Rio Ferdinand", "England, 1995-2015", "modern"),
    ],
    # Slot 4: Centre Back (right)
    4: [
        ("Paolo Maldini", "Italy, 1985-2009", "classic"),
        ("Franco Baresi", "Italy, 1977-1997", "legend"),
        ("Virgil van Dijk", "Netherlands, 2011-present", "modern"),
        ("Marcel Desailly", "France, 1986-2006", "classic"),
        ("Nemanja Vidić", "Serbia, 1999-2016", "modern"),
        ("Gerard Piqué", "Spain, 2004-2022", "modern"),
        ("Matthias Sammer", "Germany, 1986-1998", "classic"),
        ("Daniel Passarella", "Argentina, 1974-1989", "legend"),
        ("Raphaël Varane", "France, 2010-2024", "modern"),
        ("Thiago Silva", "Brazil, 2002-2024", "modern"),
    ],
    # Slot 5: Left Back
    5: [
        ("Roberto Carlos", "Brazil, 1991-2015", "classic"),
        ("Paolo Maldini", "Italy, 1985-2009", "classic"),
        ("Marcelo", "Brazil, 2005-present", "modern"),
        ("Ashley Cole", "England, 2000-2019", "modern"),
        ("Andrew Robertson", "Scotland, 2012-present", "modern"),
        ("Giacinto Facchetti", "Italy, 1960-1978", "legend"),
        ("Jordi Alba", "Spain, 2008-present", "modern"),
        ("Alphonso Davies", "Canada, 2016-present", "modern"),
        ("Denis Irwin", "Ireland, 1983-2004", "classic"),
        ("Patrice Evra", "France, 2002-2019", "modern"),
    ],
    # Slot 6: Central Midfielder (defensive)
    6: [
        ("Andrea Pirlo", "Italy, 1995-2017", "modern"),
        ("Xavi", "Spain, 1997-2019", "modern"),
        ("Lothar Matthäus", "Germany, 1979-2000", "classic"),
        ("Claude Makélélé", "France, 1991-2011", "modern"),
        ("Sergio Busquets", "Spain, 2008-2023", "modern"),
        ("Patrick Vieira", "France, 1993-2011", "modern"),
        ("Rodri", "Spain, 2015-present", "modern"),
        ("N'Golo Kanté", "France, 2013-present", "modern"),
        ("Paul Scholes", "England, 1993-2013", "modern"),
        ("Luka Modrić", "Croatia, 2003-present", "modern"),
    ],
    # Slot 7: Central Midfielder (box-to-box)
    7: [
        ("Zinedine Zidane", "France, 1989-2006", "classic"),
        ("Andrés Iniesta", "Spain, 2002-2023", "modern"),
        ("Steven Gerrard", "England, 1998-2016", "modern"),
        ("Frank Lampard", "England, 1995-2016", "modern"),
        ("Michel Platini", "France, 1972-1987", "legend"),
        ("Johan Cruyff", "Netherlands, 1964-1984", "legend"),
        ("Kevin De Bruyne", "Belgium, 2008-present", "modern"),
        ("Jude Bellingham", "England, 2019-present", "modern"),
        ("Kaká", "Brazil, 2001-2017", "modern"),
        ("Frank Rijkaard", "Netherlands, 1980-1995", "classic"),
    ],
    # Slot 8: Central Midfielder (attacking)
    8: [
        ("Zinedine Zidane", "France, 1989-2006", "classic"),
        ("Diego Maradona", "Argentina, 1976-1997", "legend"),
        ("Andrés Iniesta", "Spain, 2002-2023", "modern"),
        ("Pelé", "Brazil, 1956-1977", "legend"),
        ("Kevin De Bruyne", "Belgium, 2008-present", "modern"),
        ("Ronaldinho", "Brazil, 1998-2015", "modern"),
        ("Luka Modrić", "Croatia, 2003-present", "modern"),
        ("Xavi", "Spain, 1997-2019", "modern"),
        ("Michael Laudrup", "Denmark, 1981-1998", "classic"),
        ("Florian Wirtz", "Germany, 2020-present", "modern"),
    ],
    # Slot 9: Right Winger
    9: [
        ("Lionel Messi", "Argentina, 2003-present", "modern"),
        ("Cristiano Ronaldo", "Portugal, 2002-present", "modern"),
        ("Garrincha", "Brazil, 1951-1972", "legend"),
        ("George Best", "N. Ireland, 1963-1984", "legend"),
        ("Stanley Matthews", "England, 1932-1965", "legend"),
        ("Mohamed Salah", "Egypt, 2010-present", "modern"),
        ("Arjen Robben", "Netherlands, 2001-2021", "modern"),
        ("David Beckham", "England, 1992-2013", "modern"),
        ("Lamine Yamal", "Spain, 2023-present", "modern"),
        ("Figo", "Portugal, 1989-2009", "classic"),
    ],
    # Slot 10: Centre Forward / Striker
    10: [
        ("Ronaldo Nazário", "Brazil, 1993-2011", "classic"),
        ("Pelé", "Brazil, 1956-1977", "legend"),
        ("Marco van Basten", "Netherlands, 1981-1995", "classic"),
        ("Gerd Müller", "Germany, 1963-1981", "legend"),
        ("Thierry Henry", "France, 1994-2014", "modern"),
        ("Erling Haaland", "Norway, 2016-present", "modern"),
        ("Robert Lewandowski", "Poland, 2005-present", "modern"),
        ("Romário", "Brazil, 1985-2007", "classic"),
        ("Alan Shearer", "England, 1988-2006", "classic"),
        ("Alfredo Di Stéfano", "Argentina/Spain, 1945-1966", "legend"),
    ],
    # Slot 11: Left Winger
    11: [
        ("Cristiano Ronaldo", "Portugal, 2002-present", "modern"),
        ("Ronaldinho", "Brazil, 1998-2015", "modern"),
        ("Neymar", "Brazil, 2009-present", "modern"),
        ("Thierry Henry", "France, 1994-2014", "modern"),
        ("Ryan Giggs", "Wales, 1990-2014", "classic"),
        ("Eden Hazard", "Belgium, 2007-2024", "modern"),
        ("Rivaldo", "Brazil, 1989-2015", "classic"),
        ("Kylian Mbappé", "France, 2015-present", "modern"),
        ("Hristo Stoichkov", "Bulgaria, 1984-2003", "classic"),
        ("Vinícius Júnior", "Brazil, 2017-present", "modern"),
    ],
}

# ── Clear if force ───────────────────────────────────────────────────────────

if args.force and not args.dry_run:
    print("Force mode: clearing existing candidates...")
    cur.execute("DELETE FROM fc_position_candidates WHERE template_id = %s", (TEMPLATE_ID,))

# ── Insert candidates ────────────────────────────────────────────────────────

inserted = 0
skipped = 0

for slot, candidates in CANDIDATES.items():
    for i, (name, subtitle, era) in enumerate(candidates):
        pid = find_person(name)

        if args.dry_run:
            print(f"  Slot {slot:2d} ({['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'][slot-1]:3s}): "
                  f"{name:25s} [{era:7s}] person_id={pid or '?'}")
            inserted += 1
            continue

        try:
            cur.execute("""
                INSERT INTO fc_position_candidates
                    (template_id, slot, player_name, person_id, subtitle, era, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (template_id, slot, player_name) DO UPDATE SET
                    person_id = EXCLUDED.person_id,
                    subtitle = EXCLUDED.subtitle,
                    era = EXCLUDED.era,
                    sort_order = EXCLUDED.sort_order
            """, (TEMPLATE_ID, slot, name, pid, subtitle, era, i))
            inserted += 1
        except Exception as e:
            print(f"  ERROR inserting {name} slot {slot}: {e}")
            skipped += 1

print(f"\n── Summary ──")
print(f"  Inserted: {inserted}")
print(f"  Skipped:  {skipped}")
if args.dry_run:
    print("  (dry-run — no data was written)")

cur.close()
conn.close()
print("Done.")
