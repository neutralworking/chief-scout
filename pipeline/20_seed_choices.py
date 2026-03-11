"""
20_seed_choices.py — Seed Football Choices questions.

Seeds the fc_questions and fc_options tables with starter questions.
Questions reference people by name (matched to people.id at insert time).

Requires: migration 015_football_choices.sql applied first.

Usage:
    python 20_seed_choices.py --dry-run     # preview
    python 20_seed_choices.py               # insert questions
    python 20_seed_choices.py --force       # re-insert (delete existing first)
"""
import argparse
import sys

import psycopg2
from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Seed Football Choices questions")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Questions data ────────────────────────────────────────────────────────────
# Each question: (category_slug, question_text, subtitle, difficulty, tags, options)
# Each option: (player_name, subtitle_text)

QUESTIONS = [
    # ── GOAT Debates ─────────────────────────────────────────────────────────
    ("goat", "Greatest player of all time?", None, 1, ["all-time"],
     [("Lionel Messi", "8 Ballon d'Or"), ("Cristiano Ronaldo", "5 Ballon d'Or"),
      ("Pelé", "3 World Cups"), ("Diego Maradona", "1986 World Cup")]),

    ("goat", "Best midfielder ever?", None, 1, ["all-time", "midfield"],
     [("Zinedine Zidane", "France/Real Madrid"), ("Xavi", "Spain/Barcelona"),
      ("Andrea Pirlo", "Italy/Juventus"), ("Andrés Iniesta", "Spain/Barcelona")]),

    ("goat", "Greatest goalkeeper of all time?", None, 1, ["all-time", "goalkeeper"],
     [("Gianluigi Buffon", "Italy/Juventus"), ("Manuel Neuer", "Germany/Bayern"),
      ("Lev Yashin", "USSR/Dynamo Moscow"), ("Peter Schmeichel", "Denmark/Man Utd")]),

    ("goat", "Best striker ever?", None, 1, ["all-time", "striker"],
     [("Ronaldo Nazário", "Brazil/Real Madrid"), ("Marco van Basten", "Netherlands/AC Milan"),
      ("Gerd Müller", "Germany/Bayern"), ("Thierry Henry", "France/Arsenal")]),

    # ── Best in Position (Premier League) ────────────────────────────────────
    ("positional", "Best Premier League right-back ever?", None, 2, ["premier-league", "defenders"],
     [("Kyle Walker", "Man City/Tottenham"), ("Gary Neville", "Man United"),
      ("Pablo Zabaleta", "Man City"), ("Lauren", "Arsenal Invincibles")]),

    ("positional", "Best Premier League centre-back ever?", None, 2, ["premier-league", "defenders"],
     [("Virgil van Dijk", "Liverpool"), ("John Terry", "Chelsea"),
      ("Rio Ferdinand", "Man United"), ("Vincent Kompany", "Man City")]),

    ("positional", "Best Premier League striker ever?", None, 1, ["premier-league", "strikers"],
     [("Alan Shearer", "260 PL goals"), ("Thierry Henry", "Arsenal legend"),
      ("Wayne Rooney", "Man United record"), ("Sergio Agüero", "93:20")]),

    ("positional", "Best Premier League midfielder ever?", None, 2, ["premier-league", "midfield"],
     [("Steven Gerrard", "Liverpool"), ("Frank Lampard", "Chelsea"),
      ("Paul Scholes", "Man United"), ("Patrick Vieira", "Arsenal")]),

    ("positional", "Best Premier League winger ever?", None, 2, ["premier-league", "wingers"],
     [("Ryan Giggs", "Man United"), ("Cristiano Ronaldo", "Man United era"),
      ("Mohamed Salah", "Liverpool"), ("Eden Hazard", "Chelsea")]),

    # ── Era Wars ─────────────────────────────────────────────────────────────
    ("era", "Who wins: 2011 Barcelona or 2023 Man City?", "Peak Pep teams face off", 2, ["tactical"],
     [("Barcelona 2011", "Messi, Xavi, Iniesta"), ("Man City 2023", "Haaland, KDB, Treble winners")]),

    ("era", "Better era of defenders?", None, 2, ["defenders", "eras"],
     [("90s Italian defenders", "Maldini, Baresi, Nesta, Cannavaro"),
      ("Modern pressing defenders", "Van Dijk, Ramos, Dias, Rüdiger")]),

    ("era", "More iconic celebration?", None, 1, ["culture"],
     [("Bebeto's baby rock", "1994 World Cup"), ("Thierry Henry's slide", "Highbury"),
      ("Roger Milla's corner flag", "1990 World Cup"), ("Robbie Fowler's line sniff", "Anfield")]),

    # ── Transfer Picks ───────────────────────────────────────────────────────
    ("transfer", "You're building a new team — who do you sign first?", "One player to build around", 1, ["transfers"],
     [("Jude Bellingham", "22, CM, Real Madrid"), ("Erling Haaland", "25, CF, Man City"),
      ("Florian Wirtz", "22, AM, Leverkusen"), ("Lamine Yamal", "18, WF, Barcelona")]),

    ("transfer", "Best value signing of the 2020s?", None, 2, ["transfers", "value"],
     [("Mohamed Salah", "£34m to Liverpool"), ("Erling Haaland", "£51m release clause"),
      ("Jude Bellingham", "£88m to Real Madrid"), ("Cody Gakpo", "£37m to Liverpool")]),

    ("transfer", "Biggest flop signing ever?", None, 1, ["transfers"],
     [("Philippe Coutinho", "£142m to Barcelona"), ("Eden Hazard", "£100m to Real Madrid"),
      ("Romelu Lukaku", "£97.5m to Chelsea"), ("Ousmane Dembélé", "£135.5m to Barcelona")]),

    # ── Tactical Choices ─────────────────────────────────────────────────────
    ("tactical", "Your preferred formation?", None, 1, ["tactics"],
     [("4-3-3", "Classic attacking"), ("4-2-3-1", "Modern balanced"),
      ("3-5-2", "Wing-back system"), ("4-4-2", "Traditional English")]),

    ("tactical", "Most important position in modern football?", None, 2, ["tactics", "positions"],
     [("Deep-lying playmaker", "Rodri, Jorginho type"), ("Inverted full-back", "Cancelo, Walker type"),
      ("False 9", "Messi, Firmino type"), ("Ball-playing centre-back", "Stones, Akanji type")]),

    # ── Clutch Moments ───────────────────────────────────────────────────────
    ("clutch", "It's the Champions League final, 90th minute, you need a goal. Who takes the free kick?", None, 1, ["clutch"],
     [("Cristiano Ronaldo", "5x CL winner"), ("Lionel Messi", "4x CL winner"),
      ("David Beckham", "That free kick"), ("Juninho", "Free kick king")]),

    ("clutch", "Penalty shootout — who's your 5th taker?", "The pressure kick", 2, ["clutch", "penalties"],
     [("Zinedine Zidane", "Panenka specialist"), ("Bruno Fernandes", "Never misses"),
      ("Jorginho", "The hop, skip and jump"), ("Robert Lewandowski", "Clinical finisher")]),

    # ── Style Points ─────────────────────────────────────────────────────────
    ("style", "Most entertaining player to watch?", None, 1, ["style"],
     [("Ronaldinho", "Joy personified"), ("Jay-Jay Okocha", "Skills merchant"),
      ("Neymar", "Samba football"), ("Riyad Mahrez", "Silk on the ball")]),

    ("style", "Best dribbler of all time?", None, 1, ["style", "skills"],
     [("Lionel Messi", "Impossible close control"), ("Garrincha", "Original trickster"),
      ("Ronaldinho", "Street football on the pitch"), ("Stanley Matthews", "The Wizard of Dribble")]),

    ("style", "Most aesthetically pleasing team ever?", None, 2, ["style", "teams"],
     [("Brazil 1970", "Jogo Bonito"), ("Barcelona 2009-2012", "Tiki-Taka peak"),
      ("Arsenal 2003-04", "The Invincibles"), ("Ajax 1971-73", "Total Football")]),

    # ── Hypothetical ─────────────────────────────────────────────────────────
    ("hypothetical", "If you could have any player in their prime RIGHT NOW, who?", None, 1, ["hypothetical"],
     [("Ronaldo Nazário", "Pre-injury R9"), ("Zinedine Zidane", "2006 WC Zidane"),
      ("Ronaldinho", "2004-06 prime"), ("Thierry Henry", "Invincibles era")]),

    ("hypothetical", "Better duo?", "At their absolute peak", 2, ["hypothetical", "duos"],
     [("Messi & Neymar", "MSN Barcelona"), ("Henry & Bergkamp", "Arsenal"),
      ("Ronaldo & Benzema", "Real Madrid"), ("Suárez & Sturridge", "Liverpool 13/14")]),
]

# ── Resolve category IDs ────────────────────────────────────────────────────

cur.execute("SELECT id, slug FROM fc_categories")
cat_map = {slug: cid for cid, slug in cur.fetchall()}

# ── Optionally clear existing ────────────────────────────────────────────────

if args.force and not args.dry_run:
    print("Force mode: clearing existing questions...")
    cur.execute("DELETE FROM fc_votes")
    cur.execute("DELETE FROM fc_options")
    cur.execute("DELETE FROM fc_questions")

# ── Look up people by name ──────────────────────────────────────────────────

cur.execute("SELECT id, name FROM people")
people_by_name = {}
for pid, pname in cur.fetchall():
    people_by_name[pname.lower().strip()] = pid

def find_person(name: str) -> int | None:
    norm = name.lower().strip()
    if norm in people_by_name:
        return people_by_name[norm]
    # Partial match
    for pname, pid in people_by_name.items():
        if norm in pname or pname in norm:
            return pid
    return None

# ── Insert questions ─────────────────────────────────────────────────────────

inserted = 0
skipped = 0

for cat_slug, question_text, subtitle, difficulty, tags, options in QUESTIONS:
    cat_id = cat_map.get(cat_slug)
    if not cat_id:
        print(f"  WARNING: category '{cat_slug}' not found, skipping")
        skipped += 1
        continue

    # Check if question already exists
    cur.execute("SELECT id FROM fc_questions WHERE question_text = %s", (question_text,))
    if cur.fetchone():
        if not args.force:
            skipped += 1
            continue

    if args.dry_run:
        print(f"  [dry-run] {cat_slug}: {question_text}")
        for name, sub in options:
            pid = find_person(name)
            print(f"    → {name} ({sub}) [person_id={pid or '?'}]")
        inserted += 1
        continue

    cur.execute("""
        INSERT INTO fc_questions (category_id, question_text, subtitle, option_count, difficulty, tags)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (cat_id, question_text, subtitle, len(options), difficulty, tags))
    q_id = cur.fetchone()[0]

    for i, (name, sub) in enumerate(options):
        pid = find_person(name)
        cur.execute("""
            INSERT INTO fc_options (question_id, person_id, label, subtitle, sort_order)
            VALUES (%s, %s, %s, %s, %s)
        """, (q_id, pid, name, sub, i))

    inserted += 1

print(f"\n── Summary ──")
print(f"  Inserted: {inserted}")
print(f"  Skipped:  {skipped}")
if args.dry_run:
    print("  (dry-run — no data was written)")

cur.close()
conn.close()
print("Done.")
