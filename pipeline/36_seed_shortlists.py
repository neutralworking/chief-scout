"""
36_seed_shortlists.py — Seed curated editorial shortlists.

Creates system-authored shortlists that showcase Chief Scout's intelligence.
These are the "Chief Scout's picks" — curated by the platform, not users.

Requires: migration 023_shortlists.sql applied first.

Usage:
    python 36_seed_shortlists.py --dry-run     # preview
    python 36_seed_shortlists.py               # insert shortlists
    python 36_seed_shortlists.py --force       # re-insert (delete existing first)
"""
import argparse
import sys

import psycopg2
from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Seed curated shortlists")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Look up people by name ──────────────────────────────────────────────────

cur.execute("SELECT id, name FROM people")
people_by_name = {}
for pid, pname in cur.fetchall():
    people_by_name[pname.lower().strip()] = pid


def find_person(name: str) -> int | None:
    norm = name.lower().strip()
    if norm in people_by_name:
        return people_by_name[norm]
    for pname, pid in people_by_name.items():
        if norm in pname or pname in norm:
            return pid
    return None


# ── Shortlists data ─────────────────────────────────────────────────────────
# (slug, title, description, icon, category, tags, featured, position_filter, players)
# players: list of (player_name, scout_note)

SHORTLISTS = [
    # ── Free Agents ──────────────────────────────────────────────────────────
    ("free-agents-summer-2026", "Free Agents: Summer 2026",
     "The best players available on free transfers this summer. Contract expired, ready to sign.",
     "📋", "free-agents", ["transfers", "free-agents", "2026"], True, None,
     [
         ("Bernardo Silva", "Man City contract expired. Elite creator, 31. Any top club."),
         ("Neymar", "Back at Santos but contract expiring. 34, injury concerns, but still Neymar."),
         ("Julian Brandt", "Dortmund departure. Versatile AM, 29. Bundesliga proven."),
         ("Harry Wilson", "Fulham, 29. Consistent PL creator, set-piece specialist."),
         ("Leroy Sané", "Bayern Munich. Pace merchant, 30. Inconsistent but devastating."),
         ("Joshua Kimmich", "Bayern Munich. Swiss army knife, 31. DM/RB/CM."),
         ("Jonathan Tah", "Bayer Leverkusen. Dominant CB, 30. Title winner."),
         ("Alphonso Davies", "Bayern Munich. Jet-heeled LB, 25. Real Madrid target."),
         ("Son Heung-min", "Tottenham legend. 33, still lethal in front of goal."),
         ("Kevin De Bruyne", "Man City. Arguably best PL midfielder ever. 34, fitness questions."),
     ]),

    # ── Wonderkids ───────────────────────────────────────────────────────────
    ("wonderkids-u21-2026", "Wonderkids: U21 Class of 2026",
     "The most exciting young talents in world football. Born 2005 or later.",
     "⭐", "wonderkids", ["youth", "wonderkids", "2026"], True, None,
     [
         ("Lamine Yamal", "Barcelona, 18. Generational talent. Already a World Cup winner."),
         ("Endrick", "Real Madrid, 19. Brazilian prodigy, raw power and finishing."),
         ("Pau Cubarsí", "Barcelona, 18. Composed CB beyond his years."),
         ("Alejandro Garnacho", "Man United, 21. Explosive winger, improving end product."),
         ("Warren Zaïre-Emery", "PSG, 20. Complete midfielder, CL-tested."),
         ("Kobbie Mainoo", "Man United, 21. England international, box-to-box intelligence."),
         ("Savinho", "Man City, 21. Brazilian flair, direct dribbler."),
         ("Mathys Tel", "Bayern Munich, 20. Versatile forward, clinical finisher."),
         ("Arda Güler", "Real Madrid, 21. Turkish creator, left-foot magician."),
         ("João Neves", "PSG, 21. Portuguese midfield metronome."),
     ]),

    # ── Premier League Best XI ───────────────────────────────────────────────
    ("premier-league-best-xi-2026", "Premier League Best XI 2025/26",
     "The Chief Scout's team of the season so far. Performance + impact.",
     "🏆", "best-xi", ["premier-league", "2026", "best-xi"], True, None,
     [
         ("David Raya", "Arsenal. Distribution and shot-stopping. The complete modern GK."),
         ("Trent Alexander-Arnold", "Liverpool. Redefining the position. Again."),
         ("William Saliba", "Arsenal. Dominant, composed. The best CB in England."),
         ("Virgil van Dijk", "Liverpool. 34 and still the standard."),
         ("Gabriel Magalhães", "Arsenal. Aerially dominant, goals from set pieces."),
         ("Rodri", "Man City. Ballon d'Or holder. Midfield anchor."),
         ("Martin Ødegaard", "Arsenal. Captain, creator, press-resistant genius."),
         ("Cole Palmer", "Chelsea. Ice cold. 23 and already a franchise player."),
         ("Mohamed Salah", "Liverpool. 20+ goals, 10+ assists. Every season."),
         ("Bukayo Saka", "Arsenal. Right wing is his. England's best player."),
         ("Erling Haaland", "Man City. The goal machine doesn't stop."),
     ]),

    # ── Bargain Transfers ────────────────────────────────────────────────────
    ("bargain-transfers-2026", "Transfer Bargains Under £25m",
     "Undervalued players available below market rate. The smart money moves.",
     "💰", "bargains", ["transfers", "value", "2026"], True, None,
     [
         ("Diogo Jota", "Liverpool. Underrated, clinical. Available if Liverpool rebuild."),
         ("Jarrod Bowen", "West Ham. Consistent PL output, late bloomer."),
         ("Dominic Solanke", "Tottenham. 15 goals a season, reliable."),
         ("Antonee Robinson", "Fulham. Marauding LB, US international."),
         ("Eberechi Eze", "Crystal Palace. Flair player, set-piece threat."),
         ("Matheus Cunha", "Wolverhampton Wanderers. Brazilian creativity at a mid-table price."),
         ("Ollie Watkins", "Aston Villa. England striker, consistent goalscorer."),
         ("Marc Guéhi", "Crystal Palace. England CB, leadership qualities."),
     ]),

    # ── Position: Centre-Backs ───────────────────────────────────────────────
    ("best-centre-backs-2026", "Best Centre-Backs in World Football",
     "The elite defenders across Europe's top 5 leagues. Ranked by the Chief Scout.",
     "🛡️", "position", ["defenders", "centre-backs", "rankings"], True, "CD",
     [
         ("William Saliba", "Arsenal. Athletic, composed, top of the position."),
         ("Virgil van Dijk", "Liverpool. Still the benchmark at 34."),
         ("Rúben Dias", "Man City. Organiser, leader, Pep's defensive brain."),
         ("Alessandro Bastoni", "Inter. Progressive ball-playing CB. Italy's future."),
         ("Dayot Upamecano", "Bayern Munich. Explosive athlete, improving reads."),
         ("Ronald Araújo", "Barcelona. Speed and aggression. Brick wall."),
         ("Joško Gvardiol", "Man City. 24, already world class. Ball-carrying CB."),
         ("Leny Yoro", "Man United. 20. The long-term project."),
         ("Castello Lukeba", "RB Leipzig. 22. Under the radar but elite potential."),
         ("Pau Cubarsí", "Barcelona. 18. Composure of a veteran."),
     ]),

    # ── Position: Attacking Midfielders ───────────────────────────────────────
    ("best-attacking-mids-2026", "Best Attacking Midfielders in World Football",
     "The creators, the number 10s, the players who unlock defences.",
     "🎯", "position", ["midfield", "attacking", "rankings"], True, "AM",
     [
         ("Martin Ødegaard", "Arsenal. Press-resistant, captain, metronomic creator."),
         ("Florian Wirtz", "Bayer Leverkusen. 22 and already Bundesliga champion."),
         ("Jamal Musiala", "Bayern Munich. Dribbling genius, close control merchant."),
         ("Cole Palmer", "Chelsea. Clinical finisher from the 10 position."),
         ("Phil Foden", "Man City. Finds pockets of space nobody else sees."),
         ("Bruno Fernandes", "Man United. Risk-taker, chaos creator. 15 assists minimum."),
         ("Pedri", "Barcelona. Xavi's heir. Effortless pass selection."),
         ("Jude Bellingham", "Real Madrid. Box-to-box but plays as a 10. Goals and assists."),
     ]),

    # ── Position: Strikers ───────────────────────────────────────────────────
    ("best-strikers-2026", "Best Strikers in World Football",
     "The goalscorers. Pure 9s, false 9s, and everything in between.",
     "⚽", "position", ["strikers", "rankings"], True, "CF",
     [
         ("Erling Haaland", "Man City. 30+ goals a season. Physically overwhelming."),
         ("Kylian Mbappé", "Real Madrid. Speed, finishing, big-game moments."),
         ("Harry Kane", "Bayern Munich. Complete striker. Goals and assists."),
         ("Viktor Gyökeres", "Sporting. 30+ in Portugal. Ready for the next step?"),
         ("Alexander Isak", "Newcastle. Elegant, clinical. PL proven."),
         ("Lautaro Martínez", "Inter. Argentine warrior. Serie A's best striker."),
         ("Victor Osimhen", "Napoli. Power, pace, finishing. African football's finest."),
         ("Benjamin Šeško", "RB Leipzig. 22. Raw power, improving rapidly."),
         ("Ollie Watkins", "Aston Villa. England's reliable 15-goal man."),
         ("Darwin Núñez", "Liverpool. Explosive, unpredictable, devastating on his day."),
     ]),

    # ── League: La Liga Hidden Gems ──────────────────────────────────────────
    ("la-liga-hidden-gems-2026", "La Liga Hidden Gems",
     "Players flying under the radar in Spain's top flight. Scouting gold.",
     "🔭", "league", ["la-liga", "scouting", "hidden-gems"], False, None,
     [
         ("Pedri", "Barcelona. World-class but still underappreciated outside Spain."),
         ("Nico Williams", "Athletic Bilbao. Explosive winger, Bilbao's crown jewel."),
         ("Dani Olmo", "Barcelona. Versatile creator, Spain's Euro hero."),
         ("Alejandro Balde", "Barcelona. Young LB, electric going forward."),
         ("Gabri Veiga", "Celta Vigo. Creative midfielder, La Liga's quiet star."),
         ("Isco", "Real Betis. Vintage creator. Still got the touch."),
         ("Álex Baena", "Villarreal. Set-piece specialist, Spain international."),
     ]),

    # ── Tactical: Ball-Playing Centre-Backs ──────────────────────────────────
    ("ball-playing-cbs-2026", "Ball-Playing Centre-Backs",
     "Modern defenders who build from the back. The Pep Guardiola shopping list.",
     "🧠", "tactical", ["defenders", "ball-playing", "tactical"], False, "CD",
     [
         ("Joško Gvardiol", "Man City. Carries the ball like a midfielder."),
         ("Alessandro Bastoni", "Inter. Left-footed, progressive, press-resistant."),
         ("William Saliba", "Arsenal. Composed on the ball, clean passing."),
         ("Pau Cubarsí", "Barcelona. 18 and already playing out under Cruyffian pressure."),
         ("Castello Lukeba", "RB Leipzig. Athlete who can play."),
         ("Leny Yoro", "Man United. The project. Technical ceiling is enormous."),
         ("Nathan Aké", "Man City. Versatile, calm, Pep-trusted."),
     ]),

    # ── Chief Scout's Watch List ─────────────────────────────────────────────
    ("chief-scout-watchlist-march-2026", "Chief Scout's Watch List — March 2026",
     "Players we're monitoring closely this month. Transfer rumours, form changes, and rising talent.",
     "👁️", "watchlist", ["watchlist", "monitoring", "2026"], True, None,
     [
         ("Florian Wirtz", "Leverkusen. Every big club wants him. Will he move this summer?"),
         ("Michael Olise", "Bayern Munich. Adapting to Bundesliga. Worth tracking."),
         ("Moisés Caicedo", "Chelsea. All-action midfielder, future captain material."),
         ("Nico Williams", "Athletic Bilbao. Release clause. Barcelona circling."),
         ("Kobbie Mainoo", "Man United. 21. England regular. How far can he go?"),
         ("Castello Lukeba", "Leipzig. Flying under everyone's radar. Not for long."),
         ("Benjamin Šeško", "Leipzig. Arsenal and others watching. Big summer ahead."),
         ("Arda Güler", "Real Madrid. Getting more minutes. Breakout season?"),
     ]),
]

# ── Optionally clear existing ────────────────────────────────────────────────

if args.force and not args.dry_run:
    print("Force mode: clearing existing shortlists...")
    cur.execute("DELETE FROM shortlist_players")
    cur.execute("DELETE FROM shortlists")

# ── Insert shortlists ────────────────────────────────────────────────────────

inserted = 0
skipped = 0
missing_persons = []

for (slug, title, description, icon, category, tags, featured,
     position_filter, players) in SHORTLISTS:

    # Check if shortlist already exists
    cur.execute("SELECT id FROM shortlists WHERE slug = %s", (slug,))
    if cur.fetchone():
        if not args.force:
            skipped += 1
            continue

    if args.dry_run:
        print(f"  [dry-run] {slug}: {title} ({len(players)} players)")
        for name, note in players:
            pid = find_person(name)
            if not pid:
                missing_persons.append(name)
            print(f"    → {name} [person_id={pid or '?'}] — {note[:60]}")
        inserted += 1
        continue

    cur.execute("""
        INSERT INTO shortlists (slug, title, description, icon, category, tags, featured,
                                position_filter, author_type, author_name, player_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'system', 'Chief Scout', %s)
        RETURNING id
    """, (slug, title, description, icon, category, tags, featured,
          position_filter, len(players)))
    shortlist_id = cur.fetchone()[0]

    for i, (name, note) in enumerate(players):
        pid = find_person(name)
        if not pid:
            missing_persons.append(name)
            continue
        cur.execute("""
            INSERT INTO shortlist_players (shortlist_id, person_id, sort_order, scout_note)
            VALUES (%s, %s, %s, %s)
        """, (shortlist_id, pid, i, note))

    inserted += 1

print(f"\n── Summary ──")
print(f"  Inserted: {inserted}")
print(f"  Skipped:  {skipped}")
if missing_persons:
    unique_missing = sorted(set(missing_persons))
    print(f"  Missing persons ({len(unique_missing)}): {', '.join(unique_missing[:20])}")
if args.dry_run:
    print("  (dry-run — no data was written)")

cur.close()
conn.close()
print("Done.")
