"""
20_seed_choices.py — Seed Gaffer questions.

Seeds the fc_questions and fc_options tables with Gaffer-voice questions.
Questions reference people by name (matched to people.id at insert time).

All questions use a conversational, managerial voice — second person, present
tense, pub-chat energy. Dimension weights map choices to identity dimensions.

Requires: migration 015_football_choices.sql + 022_choices_dimension_mappings.sql

Usage:
    python 20_seed_choices.py --dry-run     # preview
    python 20_seed_choices.py               # insert questions
    python 20_seed_choices.py --force       # re-insert (delete existing first)
"""
import argparse
import json
import sys

import psycopg2
from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Seed Gaffer questions")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Ensure Gaffer categories exist ─────────────────────────────────────────────
# Replace old 13 categories with 8 Gaffer-themed ones

GAFFER_CATEGORIES = [
    ("dugout", "The Dugout", "In-match decisions — bench calls, subs, tactical changes", "🏟️", 1),
    ("transfer", "Transfer Window", "Buying, selling, free agents, budget dilemmas", "💰", 2),
    ("pub", "The Pub", "Classic football debates, GOAT arguments, hot takes", "🍺", 3),
    ("academy", "Academy vs Chequebook", "Youth development vs ready-made signings", "🎓", 4),
    ("scouting", "Scouting Report", "Player evaluation dilemmas, data vs instinct", "🔍", 5),
    ("dressing-room", "Dressing Room", "Man-management, captaincy, squad dynamics", "👔", 6),
    ("press", "Press Conference", "How you handle media, controversy, pressure", "🎤", 7),
    ("dream-xi", "Dream XI", "Best-ever debates, era comparisons, all-time picks", "⭐", 8),
]

# Upsert categories
for slug, name, desc, icon, sort_order in GAFFER_CATEGORIES:
    cur.execute("""
        INSERT INTO fc_categories (slug, name, description, icon, sort_order)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (slug) DO UPDATE SET name = %s, description = %s, icon = %s, sort_order = %s
    """, (slug, name, desc, icon, sort_order, name, desc, icon, sort_order))

# Remove old categories that aren't in the current Gaffer set
# Must delete questions/options referencing old categories first (FK constraint)
gaffer_slugs = [c[0] for c in GAFFER_CATEGORIES]
cur.execute("""
    DELETE FROM fc_options WHERE question_id IN (
        SELECT q.id FROM fc_questions q
        JOIN fc_categories c ON c.id = q.category_id
        WHERE c.slug != ALL(%s)
    )
""", (gaffer_slugs,))
cur.execute("""
    DELETE FROM fc_questions WHERE category_id IN (
        SELECT id FROM fc_categories WHERE slug != ALL(%s)
    )
""", (gaffer_slugs,))
cur.execute("""
    DELETE FROM fc_categories WHERE slug != ALL(%s)
""", (gaffer_slugs,))
deleted = cur.rowcount
if deleted:
    print(f"  Removed {deleted} old categories")

# ── Questions data ────────────────────────────────────────────────────────────
# Format: (category_slug, question_text, subtitle, difficulty, tags, options)
# Options: (name, subtitle, dimension_weights) — all questions get weights

QUESTIONS = [
    # ══════════════════════════════════════════════════════════════════════════
    # THE DUGOUT — In-match decisions
    # ══════════════════════════════════════════════════════════════════════════

    ("dugout", "The clock hits 70 minutes. You need two goals or the season is over. Who are you bringing off the bench?",
     None, 2, ["pressure", "clutch"],
     [("Zlatan Ibrahimović", "The ego, the presence, the chaos",
       {"flair_vs_function": 15, "youth_vs_experience": -15, "attack_vs_defense": 15}),
      ("Erling Haaland", "Pure goals. Nothing else matters.",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15, "attack_vs_defense": 15}),
      ("Steven Gerrard", "Drags teams through by sheer will",
       {"loyalty_vs_ambition": 15, "stats_vs_eye_test": -10, "flair_vs_function": 10}),
      ("Ole Gunnar Solskjær", "The baby-faced assassin. Supersub.",
       {"stats_vs_eye_test": -10, "youth_vs_experience": -10, "flair_vs_function": -5})]),

    ("dugout", "You're 2-1 up in the semi-final. They've just brought Mbappé on. What's your call?",
     None, 2, ["tactical", "pressure"],
     [("Bring on another centre-back", "Shut up shop. Protect the lead.",
       {"attack_vs_defense": -20, "flair_vs_function": -10}),
      ("Match them — bring on your fastest winger", "Fight fire with fire",
       {"attack_vs_defense": 10, "flair_vs_function": 10}),
      ("Change nothing — trust your shape", "The system got you here",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 10}),
      ("Push higher — press them into mistakes", "Courage. They won't expect it.",
       {"attack_vs_defense": 15, "flair_vs_function": 15})]),

    ("dugout", "Your number 10 has been invisible all night. CL final, 0-0, 55th minute. Do you hook him?",
     None, 3, ["pressure", "man-management"],
     [("Take him off — this is too big to be sentimental", "Ruthless. Results first.",
       {"flair_vs_function": -15, "loyalty_vs_ambition": -10}),
      ("Give him until 70 — he's earned that", "Loyalty matters in the big moments",
       {"loyalty_vs_ambition": 15, "youth_vs_experience": -5}),
      ("Move him deeper — change his role, not his night", "Tactical flexibility",
       {"flair_vs_function": 10, "stats_vs_eye_test": 10}),
      ("Leave him — these players produce magic from nowhere", "Trust the talent",
       {"flair_vs_function": 15, "stats_vs_eye_test": -15})]),

    ("dugout", "It's 0-0 at half-time. Your centre-forward has had zero touches in the box. What do you change?",
     None, 2, ["tactical"],
     [("Switch to a false 9 — drag their centre-backs out", "Create the space yourself",
       {"flair_vs_function": 15, "stats_vs_eye_test": 10}),
      ("Throw on a second striker — overload the box", "More bodies, more chances",
       {"attack_vs_defense": 15, "flair_vs_function": -5}),
      ("Tell the full-backs to bomb forward — width wins games", "Stretch them",
       {"attack_vs_defense": 10, "flair_vs_function": 10}),
      ("Stay patient — one chance is all you need", "The game comes to you",
       {"flair_vs_function": -10, "attack_vs_defense": -10})]),

    ("dugout", "Injury crisis. Your first-choice keeper is out. Academy kid or a veteran free agent for the cup final?",
     None, 2, ["pressure", "youth"],
     [("Academy kid — he's been waiting for this moment", "Believe in your own",
       {"youth_vs_experience": 20, "loyalty_vs_ambition": 10}),
      ("Sign the veteran — too much on the line", "Experience for the big occasion",
       {"youth_vs_experience": -20, "flair_vs_function": -10}),
      ("Play the reserve keeper — he's next in line", "Trust the squad",
       {"loyalty_vs_ambition": 10, "flair_vs_function": -5}),
      ("Outfield player in goal — go full chaos", "Fortune favours the brave",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15})]),

    ("dugout", "Last 15 minutes, you're chasing the game. The opposition are parking the bus. Who do you throw on?",
     None, 2, ["tactical", "pressure"],
     [("A tricky winger — beat them 1v1", "Individual brilliance breaks low blocks",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10}),
      ("A target man — get crosses in", "Aerial dominance when they're deep",
       {"flair_vs_function": -10, "attack_vs_defense": 10}),
      ("A midfielder who can shoot from range", "Sometimes you just need to let fly",
       {"stats_vs_eye_test": -10, "flair_vs_function": 10}),
      ("Your fastest player — pure pace against tired legs", "Speed kills",
       {"stats_vs_eye_test": 10, "attack_vs_defense": 15})]),

    # ══════════════════════════════════════════════════════════════════════════
    # TRANSFER WINDOW — Buying, selling, free agents
    # ══════════════════════════════════════════════════════════════════════════

    ("transfer", "You've got a need for a number 10 — you're good in wage budget but low on transfer budget. Who are you taking in on a free this summer?",
     "See who else is available on our free agent list", 2, ["transfer", "free-agent"],
     [("Bernardo Silva", "Proven at the highest level. Consistent.",
       {"flair_vs_function": -5, "youth_vs_experience": -10, "stats_vs_eye_test": 10}),
      ("Neymar", "Genius level talent. Baggage included.",
       {"flair_vs_function": 20, "youth_vs_experience": -15, "stats_vs_eye_test": -15}),
      ("Julian Brandt", "Underrated. Smart. Low drama.",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10, "domestic_vs_global": -10}),
      ("Harry Wilson", "Homegrown, knows the league, pennies on the pound",
       {"domestic_vs_global": 20, "youth_vs_experience": 5, "flair_vs_function": -10})]),

    ("transfer", "£60m for one centre-back. Who's your man?",
     None, 2, ["transfer", "defence"],
     [("William Saliba", "Young, proven, ball-playing",
       {"youth_vs_experience": 10, "flair_vs_function": 5, "stats_vs_eye_test": 10}),
      ("Virgil van Dijk", "The complete defender. Presence.",
       {"youth_vs_experience": -15, "flair_vs_function": -5, "stats_vs_eye_test": -5}),
      ("Joško Gvardiol", "Versatile, aggressive, modern defender",
       {"youth_vs_experience": 15, "domestic_vs_global": -10, "attack_vs_defense": -5}),
      ("Leny Yoro", "18 years old. Generational bet.",
       {"youth_vs_experience": 20, "stats_vs_eye_test": -10, "flair_vs_function": 5})]),

    ("transfer", "Your board says sell one to fund three. Which star goes?",
     None, 2, ["transfer", "squad-building"],
     [("Your 28-year-old striker on massive wages", "Cash in at peak value",
       {"stats_vs_eye_test": 15, "loyalty_vs_ambition": -15}),
      ("Your exciting 20-year-old winger", "Sell high on potential. Reinvest.",
       {"youth_vs_experience": -10, "stats_vs_eye_test": 10, "loyalty_vs_ambition": -10}),
      ("Nobody — tell the board to find the money", "Principles over balance sheets",
       {"loyalty_vs_ambition": 20, "flair_vs_function": 5}),
      ("Your captain — the wages free up everything", "Ruthless but rational",
       {"loyalty_vs_ambition": -20, "stats_vs_eye_test": 15})]),

    ("transfer", "January window. You're 4th, three points off the top. One signing to push you over the line. What do you prioritise?",
     None, 2, ["transfer", "tactical"],
     [("A proven goalscorer — 15+ goals guaranteed", "Goals win titles",
       {"stats_vs_eye_test": 10, "flair_vs_function": -5, "attack_vs_defense": 10}),
      ("A midfield destroyer — control the middle", "Dominate the engine room",
       {"attack_vs_defense": -15, "flair_vs_function": -10}),
      ("A creative midfielder — unlock parked buses", "The key to breaking teams down",
       {"flair_vs_function": 15, "attack_vs_defense": 10}),
      ("A leader — someone who's won it before", "Mentality over ability",
       {"youth_vs_experience": -15, "stats_vs_eye_test": -10, "loyalty_vs_ambition": 10})]),

    ("transfer", "Your rivals just signed your number one target. Plan B time. What do you do?",
     None, 2, ["transfer", "philosophy"],
     [("Overpay for the next-best option — you can't go into the season short", "Desperation spend",
       {"flair_vs_function": -10, "stats_vs_eye_test": -10, "loyalty_vs_ambition": -5}),
      ("Look at a different league for a hidden gem", "Trust your scouting network",
       {"domestic_vs_global": -15, "stats_vs_eye_test": 10, "flair_vs_function": 5}),
      ("Promote from within — give a young player the chance", "Opportunity from adversity",
       {"youth_vs_experience": 20, "loyalty_vs_ambition": 10}),
      ("Wait. Don't panic buy. Reassess in January.", "Patience is a strategy",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15})]),

    ("transfer", "A 35-year-old club legend wants a new two-year deal. He's lost a yard of pace but the fans love him. What do you do?",
     None, 2, ["transfer", "loyalty"],
     [("Give him the deal — loyalty is everything", "You don't discard legends",
       {"loyalty_vs_ambition": 20, "youth_vs_experience": -10}),
      ("One year only — protect the club", "Respect with pragmatism",
       {"loyalty_vs_ambition": 5, "stats_vs_eye_test": 10}),
      ("Let him go — the squad needs to evolve", "Sentiment doesn't win trophies",
       {"loyalty_vs_ambition": -15, "youth_vs_experience": 10}),
      ("Offer a coaching role — keep him in the family", "Transition him, don't dump him",
       {"loyalty_vs_ambition": 10, "flair_vs_function": -5})]),

    ("transfer", "You can raid ONE club in the world. Take three players. Which club?",
     None, 2, ["transfer", "dream"],
     [("Real Madrid", "Bellingham, Vinícius Jr, the galáctico pipeline",
       {"flair_vs_function": 10, "loyalty_vs_ambition": -10, "domestic_vs_global": -10}),
      ("Arsenal", "Saka, Saliba, Rice — the process generation",
       {"youth_vs_experience": 10, "flair_vs_function": -5, "domestic_vs_global": 10}),
      ("Barcelona", "Yamal, Pedri, the La Masia magic",
       {"youth_vs_experience": 15, "flair_vs_function": 15, "domestic_vs_global": -10}),
      ("Manchester City", "Haaland, Rodri, the machine",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10})]),

    # ══════════════════════════════════════════════════════════════════════════
    # THE PUB — Classic debates
    # ══════════════════════════════════════════════════════════════════════════

    ("pub", "Right, settle this. Greatest number 9 of all time?",
     None, 1, ["goat", "striker"],
     [("Ronaldo Nazário", "Two World Cups, three FIFA World Player awards",
       {"flair_vs_function": 15, "youth_vs_experience": -5, "stats_vs_eye_test": -10}),
      ("Thierry Henry", "Arsenal, Barcelona — the complete forward",
       {"flair_vs_function": 10, "domestic_vs_global": -5}),
      ("Marco van Basten", "That volley. Those three Ballon d'Ors.",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10, "youth_vs_experience": -15}),
      ("Erling Haaland", "Numbers don't lie. And his are absurd.",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10, "youth_vs_experience": 10})]),

    ("pub", "One player in their absolute prime, dropped into today's game. Who's making the biggest impact?",
     None, 2, ["goat", "era"],
     [("Zinedine Zidane", "2006 Zidane. Grace under pressure.",
       {"flair_vs_function": 15, "youth_vs_experience": -15, "stats_vs_eye_test": -10}),
      ("Ronaldo Nazário", "1997 R9. Before the injuries took everything.",
       {"flair_vs_function": 20, "youth_vs_experience": -10, "stats_vs_eye_test": -10}),
      ("Ronaldinho", "2004-06 Ronaldinho. Football as art.",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15}),
      ("Lionel Messi", "2012 Messi. 91 goals in a calendar year.",
       {"stats_vs_eye_test": 15, "flair_vs_function": 10})]),

    ("pub", "Greatest Premier League season of all time?",
     None, 1, ["goat", "era"],
     [("Arsenal 03/04", "The Invincibles. Unbeaten. End of discussion.",
       {"flair_vs_function": 10, "attack_vs_defense": 10, "domestic_vs_global": 10}),
      ("Man City 17/18", "100 points. Centurions. Pep's machine.",
       {"stats_vs_eye_test": 15, "flair_vs_function": 5}),
      ("Man United 98/99", "The Treble. Ferguson's greatest act.",
       {"loyalty_vs_ambition": 10, "stats_vs_eye_test": -10}),
      ("Chelsea 04/05", "15 goals conceded all season. Mourinho's fortress.",
       {"attack_vs_defense": -15, "flair_vs_function": -15})]),

    ("pub", "You're picking one player for a kickabout in the park. Who makes it the most fun?",
     None, 1, ["style", "fun"],
     [("Ronaldinho", "Samba magic on every touch",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15}),
      ("Jay-Jay Okocha", "So good they named him twice",
       {"flair_vs_function": 20, "domestic_vs_global": -10}),
      ("Neymar", "Skills, flair, drama",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10}),
      ("Riyad Mahrez", "Silk on the ball, makes it look easy",
       {"flair_vs_function": 10, "domestic_vs_global": -5})]),

    ("pub", "Best midfielder ever? No qualifiers. Just the best.",
     None, 1, ["goat", "midfield"],
     [("Zinedine Zidane", "France, Real Madrid — the artist",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10}),
      ("Xavi", "Spain, Barcelona — the architect",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10}),
      ("Andrea Pirlo", "Italy, Juventus — the conductor",
       {"flair_vs_function": 15, "youth_vs_experience": -10}),
      ("Steven Gerrard", "Liverpool — dragged teams through on will alone",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 5, "stats_vs_eye_test": -10})]),

    ("pub", "One penalty taker. Everything on the line. Cup final. 90th minute. Who's stepping up?",
     None, 2, ["pressure", "clutch"],
     [("Zinedine Zidane", "The Panenka in a World Cup final",
       {"flair_vs_function": 20, "stats_vs_eye_test": -10}),
      ("Bruno Fernandes", "Lives for these moments. Ice cold.",
       {"stats_vs_eye_test": 10, "flair_vs_function": -5}),
      ("Jorginho", "The skip technique. Nerves of steel.",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10}),
      ("Robert Lewandowski", "The machine doesn't miss",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10})]),

    ("pub", "It's 2026. Who's the best player on the planet right now?",
     None, 1, ["current"],
     [("Erling Haaland", "Goals, goals, goals",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10}),
      ("Vinícius Jr", "Ballon d'Or holder. The moment is his.",
       {"flair_vs_function": 15, "domestic_vs_global": -10}),
      ("Jude Bellingham", "Already running Real Madrid at 22",
       {"youth_vs_experience": 10, "loyalty_vs_ambition": -5}),
      ("Lamine Yamal", "17 and already the best. Generational.",
       {"youth_vs_experience": 20, "flair_vs_function": 10})]),

    # ══════════════════════════════════════════════════════════════════════════
    # ACADEMY VS CHEQUEBOOK — Youth vs ready-made
    # ══════════════════════════════════════════════════════════════════════════

    ("academy", "You've got a talented 17-year-old and a proven 28-year-old for the same position. Season starts Saturday. Who plays?",
     None, 2, ["youth", "philosophy"],
     [("The 17-year-old — sink or swim", "Talent develops under pressure",
       {"youth_vs_experience": 20, "stats_vs_eye_test": -10}),
      ("The 28-year-old — it's not a development league", "Win first, develop later",
       {"youth_vs_experience": -20, "stats_vs_eye_test": 10}),
      ("Rotate — start the veteran, sub the kid on at 60", "Best of both worlds",
       {"youth_vs_experience": 5, "flair_vs_function": -5}),
      ("Base it purely on pre-season form", "Earn it. Age is irrelevant.",
       {"stats_vs_eye_test": 15, "youth_vs_experience": 0})]),

    ("academy", "Your academy produces a wonderkid. PSG offer £80m. He's 19. What do you do?",
     None, 2, ["transfer", "youth"],
     [("Sell — £80m funds the next five years", "Smart business funds dynasties",
       {"stats_vs_eye_test": 15, "loyalty_vs_ambition": -15}),
      ("Keep him — he's the future of this club", "You don't sell your crown jewels",
       {"loyalty_vs_ambition": 20, "youth_vs_experience": 15}),
      ("Sell but with a buyback clause", "Have your cake and eat it",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": -5}),
      ("Double his wages and give him the shirt", "Make him feel like a king",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 5})]),

    ("academy", "Which development model would you build your club around?",
     None, 2, ["philosophy", "squad-building"],
     [("Dortmund — buy young, develop, sell high", "The talent factory",
       {"youth_vs_experience": 15, "stats_vs_eye_test": 10, "domestic_vs_global": -10}),
      ("Athletic Bilbao — only locals, identity above all", "The purest model in football",
       {"domestic_vs_global": 20, "loyalty_vs_ambition": 20, "youth_vs_experience": 10}),
      ("Ajax — total football from age 6", "The philosophy runs through everything",
       {"flair_vs_function": 15, "youth_vs_experience": 15}),
      ("Chelsea — spend big, loan army, brute force", "If it works, does it matter how?",
       {"loyalty_vs_ambition": -15, "stats_vs_eye_test": 10, "flair_vs_function": -10})]),

    ("academy", "Your 16-year-old academy striker has just scored a hat-trick in the youth cup. Do you fast-track him?",
     None, 2, ["youth"],
     [("Put him in the first-team squad now — talent can't wait", "Strike while the iron's hot",
       {"youth_vs_experience": 20, "flair_vs_function": 10}),
      ("Loan him to League One — real football, not youth football", "Learn the hard way",
       {"youth_vs_experience": 10, "domestic_vs_global": 15, "flair_vs_function": -10}),
      ("Keep him in the academy — protect his development", "Don't rush what you can nurture",
       {"youth_vs_experience": 5, "flair_vs_function": -5}),
      ("Promote him but shield him — 10-minute cameos only", "Gradual exposure",
       {"youth_vs_experience": 10, "flair_vs_function": -5})]),

    # ══════════════════════════════════════════════════════════════════════════
    # SCOUTING REPORT — Data vs instinct
    # ══════════════════════════════════════════════════════════════════════════

    ("scouting", "Your data team says sign him — elite xG, top-percentile progressive carries. Your chief scout says 'I've watched him ten times and he goes missing in big games.' Who do you trust?",
     None, 3, ["scouting", "data"],
     [("The data — the eye lies, numbers don't", "Modern football is analytics",
       {"stats_vs_eye_test": 20, "flair_vs_function": -10}),
      ("The scout — context matters more than spreadsheets", "Football can't be reduced to numbers",
       {"stats_vs_eye_test": -20, "flair_vs_function": 10}),
      ("Send another scout — one opinion isn't enough", "Due diligence over dogma",
       {"stats_vs_eye_test": 5, "flair_vs_function": -5}),
      ("Watch him yourself — you're the gaffer, own the decision", "Trust your own judgement",
       {"stats_vs_eye_test": -10, "loyalty_vs_ambition": 10})]),

    ("scouting", "30 goals in the Eredivisie. You backing him to do it in the Prem?",
     None, 2, ["scouting", "transfer"],
     [("Yes — goals are goals. Sign him.", "Goalscorers score in any league",
       {"stats_vs_eye_test": 15, "domestic_vs_global": -10}),
      ("No — the Eredivisie flatters attackers", "League context matters",
       {"domestic_vs_global": 15, "stats_vs_eye_test": -5}),
      ("Only if he's under 24 — time to adapt", "Youth + goals = worth the gamble",
       {"youth_vs_experience": 10, "stats_vs_eye_test": 5}),
      ("Depends on the fee — cheap enough, it's worth the punt", "Risk management",
       {"stats_vs_eye_test": 10, "flair_vs_function": -10})]),

    ("scouting", "A player is available at 50% of his market value. Elite ability, but two ACL injuries. Do you take the risk?",
     None, 2, ["scouting", "transfer"],
     [("Absolutely — talent at that price is rare", "Calculated risk for massive upside",
       {"flair_vs_function": 10, "stats_vs_eye_test": -10}),
      ("No chance — you're buying someone else's problem", "Availability is the best ability",
       {"stats_vs_eye_test": 10, "flair_vs_function": -10}),
      ("Only on a heavily incentivised deal — low base, high bonuses", "Protect the downside",
       {"stats_vs_eye_test": 15, "flair_vs_function": -5}),
      ("Sign him and build a team around protecting him", "Genius is worth accommodating",
       {"flair_vs_function": 15, "loyalty_vs_ambition": 10})]),

    ("scouting", "Two number 10s available. Same price. One is a metronomic press-resistant creator. The other dribbles through lines like they don't exist. Who transforms your team?",
     None, 2, ["scouting", "style"],
     [("Martin Ødegaard", "Arsenal, metronome, the conductor",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10, "loyalty_vs_ambition": 10}),
      ("Jamal Musiala", "Bayern Munich, dribbling through lines",
       {"flair_vs_function": 15, "youth_vs_experience": 15, "stats_vs_eye_test": -10}),
      ("Phil Foden", "Man City, finds pockets of space",
       {"flair_vs_function": 10, "domestic_vs_global": 15}),
      ("Florian Wirtz", "Leverkusen, the complete package",
       {"youth_vs_experience": 15, "flair_vs_function": 10, "domestic_vs_global": -10})]),

    ("scouting", "World Cup breakout star — 22 years old, three spectacular goals, never heard of him before the tournament. Your chairman wants him. Do you sign?",
     None, 2, ["scouting", "transfer"],
     [("Immediately — tournament form IS real form", "Seize the moment",
       {"stats_vs_eye_test": -15, "flair_vs_function": 10}),
      ("Wait six months — see if it's sustainable", "Sample size matters",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10}),
      ("Only if your scouts already had him on a list", "Good scouting confirms, not discovers",
       {"stats_vs_eye_test": 10, "flair_vs_function": -5}),
      ("Let someone else overpay — pick him up when it goes wrong", "Patience pays",
       {"stats_vs_eye_test": 15, "loyalty_vs_ambition": -10})]),

    # ══════════════════════════════════════════════════════════════════════════
    # DRESSING ROOM — Man-management
    # ══════════════════════════════════════════════════════════════════════════

    ("dressing-room", "Your captain just retired. Who gets the armband?",
     None, 2, ["leadership", "squad"],
     [("Your best player — earned by ability", "The best leads by example",
       {"flair_vs_function": 10, "stats_vs_eye_test": 5}),
      ("Your longest-serving player — earned by loyalty", "The armband means service",
       {"loyalty_vs_ambition": 20, "youth_vs_experience": -5}),
      ("Your loudest voice — earned by personality", "Leaders aren't quiet",
       {"flair_vs_function": -5, "stats_vs_eye_test": -10}),
      ("Let the squad vote — it's their dressing room", "Democracy in the squad",
       {"loyalty_vs_ambition": 5, "flair_vs_function": -5})]),

    ("dressing-room", "Your star player publicly criticises your tactics in a post-match interview. What do you do?",
     None, 2, ["man-management", "pressure"],
     [("Bench him next game — nobody is bigger than the team", "Authority must be respected",
       {"loyalty_vs_ambition": -5, "flair_vs_function": -15}),
      ("Have a private word — address it behind closed doors", "Handle it like an adult",
       {"loyalty_vs_ambition": 10, "flair_vs_function": -5}),
      ("Sell him — disloyalty is a cancer in a squad", "Make an example",
       {"loyalty_vs_ambition": -20, "flair_vs_function": -10}),
      ("Shrug it off — big characters have big opinions", "Channel the fire, don't extinguish it",
       {"flair_vs_function": 15, "loyalty_vs_ambition": 5})]),

    ("dressing-room", "Two players fall out in training. Your first-choice partnership. The derby is Saturday. How do you handle it?",
     None, 2, ["man-management"],
     [("Lock them in a room — sort it out or neither plays", "Force the resolution",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 10}),
      ("Play both — professionals play through it", "The pitch sorts everything out",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10}),
      ("Drop one — send a message", "Standards don't bend for talent",
       {"loyalty_vs_ambition": -10, "flair_vs_function": -10}),
      ("Talk to them individually — understand the issue first", "Every conflict has context",
       {"flair_vs_function": 5, "loyalty_vs_ambition": 10})]),

    ("dressing-room", "Your club signs a new player on massive wages — double what your current best player earns. The squad knows. What do you do?",
     None, 2, ["squad", "man-management"],
     [("Give your best player a raise — keep things fair", "Parity prevents problems",
       {"loyalty_vs_ambition": 10, "stats_vs_eye_test": -5}),
      ("Nothing — wages are private and performance-based", "Market rates are market rates",
       {"stats_vs_eye_test": 15, "loyalty_vs_ambition": -10}),
      ("Address it openly — be transparent with the squad", "Honest leadership",
       {"loyalty_vs_ambition": 5, "flair_vs_function": -5}),
      ("This is why you don't overpay — bad decision by the board", "You'd never have done this",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": 15})]),

    # ══════════════════════════════════════════════════════════════════════════
    # PRESS CONFERENCE — Media handling
    # ══════════════════════════════════════════════════════════════════════════

    ("press", "VAR rules out your injury-time winner. Post-match interview. What are you?",
     None, 1, ["media", "personality"],
     [("Furious — let them have it", "Ferguson would've had the referee's head",
       {"flair_vs_function": 10, "stats_vs_eye_test": -10, "loyalty_vs_ambition": 10}),
      ("Calm — 'we'll look at the footage and move on'", "Guardiola composure",
       {"flair_vs_function": -10, "stats_vs_eye_test": 10}),
      ("Philosophical — 'these things even out over a season'", "The Wenger approach",
       {"flair_vs_function": 5, "stats_vs_eye_test": 5}),
      ("Sarcastic — 'I prefer not to speak'", "The Mourinho special",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -5})]),

    ("press", "You've just lost 4-0. Your team was awful. What do you say?",
     None, 1, ["media", "personality"],
     [("'I take full responsibility' — shield the players", "The buck stops with you",
       {"loyalty_vs_ambition": 15, "flair_vs_function": -5}),
      ("'We were unacceptable and they know it' — call them out", "Accountability matters",
       {"loyalty_vs_ambition": -10, "flair_vs_function": -10}),
      ("'We'll analyse and respond' — give nothing away", "Never show weakness",
       {"stats_vs_eye_test": 10, "flair_vs_function": -10}),
      ("'The performance was a disgrace but we'll be back' — passion and defiance", "Show them you care",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 5})]),

    ("press", "A journalist asks if you're going to get sacked. What's your answer?",
     None, 1, ["media", "pressure"],
     [("'I have the full backing of the board' — stay on message", "Political survival",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 5}),
      ("'That's a question for the board, not me' — deflect", "Don't give them the headline",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10}),
      ("'I'm the best manager this club has had in years' — front foot", "Confidence under fire",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -5}),
      ("Walk out — you don't dignify that with a response", "Actions speak louder",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 10})]),

    # ══════════════════════════════════════════════════════════════════════════
    # DREAM XI — All-time debates
    # ══════════════════════════════════════════════════════════════════════════

    ("dream-xi", "Greatest goalkeeper of all time?",
     None, 1, ["goat", "goalkeeper"],
     [("Gianluigi Buffon", "Italy, Juventus — longevity and class",
       {"loyalty_vs_ambition": 10, "youth_vs_experience": -10}),
      ("Manuel Neuer", "Germany, Bayern — the sweeper-keeper revolution",
       {"flair_vs_function": 10, "stats_vs_eye_test": 5}),
      ("Lev Yashin", "USSR — the Black Spider, the original",
       {"youth_vs_experience": -15, "stats_vs_eye_test": -10}),
      ("Peter Schmeichel", "Denmark, Man Utd — the Great Dane",
       {"loyalty_vs_ambition": 5, "domestic_vs_global": 10})]),

    ("dream-xi", "Best centre-back pairing of all time?",
     None, 1, ["goat", "defence"],
     [("Baresi & Maldini", "AC Milan — the Italian wall",
       {"attack_vs_defense": -15, "flair_vs_function": -5, "domestic_vs_global": -10}),
      ("Ferdinand & Vidić", "Man Utd — blood and thunder",
       {"attack_vs_defense": -10, "domestic_vs_global": 10, "loyalty_vs_ambition": 10}),
      ("Terry & Carvalho", "Chelsea — Mourinho's fortress",
       {"attack_vs_defense": -15, "flair_vs_function": -10}),
      ("Saliba & Gabriel", "Arsenal — the modern partnership",
       {"youth_vs_experience": 15, "attack_vs_defense": -5, "domestic_vs_global": 10})]),

    ("dream-xi", "Best team ever assembled?",
     None, 1, ["goat", "era"],
     [("Brazil 1970", "Pelé, Jairzinho, Rivelino — the beautiful game",
       {"flair_vs_function": 20, "stats_vs_eye_test": -10}),
      ("Barcelona 2011", "Xavi, Iniesta, Messi — tiki-taka perfection",
       {"flair_vs_function": 15, "stats_vs_eye_test": 5}),
      ("Real Madrid 2017", "Three CLs in a row. Ronaldo, Modrić, Kroos.",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": -5}),
      ("AC Milan 1989", "Sacchi, van Basten, Gullit — tactical revolution",
       {"flair_vs_function": -5, "attack_vs_defense": -10, "domestic_vs_global": -10})]),

    ("dream-xi", "Best left foot in football history?",
     None, 1, ["goat", "style"],
     [("Lionel Messi", "The greatest of all time",
       {"stats_vs_eye_test": 10, "flair_vs_function": 10}),
      ("Diego Maradona", "The Hand of God, the Goal of the Century",
       {"flair_vs_function": 15, "stats_vs_eye_test": -15}),
      ("Roberto Carlos", "That free kick against France",
       {"attack_vs_defense": 10, "flair_vs_function": 15}),
      ("Arjen Robben", "Le Cut Inside Man. You knew it was coming. Couldn't stop it.",
       {"flair_vs_function": 5, "domestic_vs_global": -10})]),

    ("dream-xi", "One player never to win the Champions League that deserved it most?",
     None, 1, ["goat", "narrative"],
     [("Zlatan Ibrahimović", "Won everything else. The one that got away.",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -10}),
      ("Harry Kane", "The ultimate striker in the wrong places at the wrong times",
       {"stats_vs_eye_test": 15, "loyalty_vs_ambition": -5}),
      ("Gianluigi Buffon", "Finals, heartbreak, decades of brilliance",
       {"loyalty_vs_ambition": 15, "youth_vs_experience": -10}),
      ("George Best", "Before the Champions League even existed in this form",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15})]),

    # ══════════════════════════════════════════════════════════════════════════
    # MORE DUGOUT — tactical depth
    # ══════════════════════════════════════════════════════════════════════════

    ("dugout", "Your team has won three on the bounce playing ugly. Do you change the style?",
     None, 2, ["philosophy", "tactical"],
     [("No — winning is the only style that matters", "Results breed confidence",
       {"flair_vs_function": -15, "stats_vs_eye_test": 10}),
      ("Yes — this isn't sustainable and it's not who we are", "Identity over points",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10}),
      ("Tweak it — add some flair while keeping the solidity", "Evolution, not revolution",
       {"flair_vs_function": 5, "stats_vs_eye_test": 5}),
      ("Let the players decide — they're the ones on the pitch", "Empower the squad",
       {"loyalty_vs_ambition": 10, "flair_vs_function": 5})]),

    # ══════════════════════════════════════════════════════════════════════════
    # MORE TRANSFER — budget games
    # ══════════════════════════════════════════════════════════════════════════

    ("transfer", "£150m to spend. How do you allocate it?",
     None, 2, ["transfer", "squad-building"],
     [("One Mbappé — a single superstar changes everything", "Galáctico mentality",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -10, "stats_vs_eye_test": -5}),
      ("Five £30m players — depth wins titles", "Squad quality over individual brilliance",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10}),
      ("Three £50m starters — quality across the spine", "Balance is key",
       {"flair_vs_function": 0, "stats_vs_eye_test": 5}),
      ("£100m on two + £50m for the academy", "Win now AND build for later",
       {"youth_vs_experience": 10, "loyalty_vs_ambition": 10})]),

    # ══════════════════════════════════════════════════════════════════════════
    # MORE SCOUTING — deeper dilemmas
    # ══════════════════════════════════════════════════════════════════════════

    ("scouting", "You're scouting South America. Budget for one more flight home. Which player do you bring back a report on?",
     None, 2, ["scouting", "global"],
     [("Endrick", "Real Madrid prodigy, raw power",
       {"youth_vs_experience": 15, "domestic_vs_global": -15, "flair_vs_function": 10}),
      ("Enzo Fernández", "World Cup hero, already proven in Europe",
       {"youth_vs_experience": 5, "stats_vs_eye_test": 10, "domestic_vs_global": -10}),
      ("Julián Álvarez", "Versatile, smart, undervalued",
       {"stats_vs_eye_test": 10, "flair_vs_function": -5, "domestic_vs_global": -10}),
      ("Luis Díaz", "Electric winger, transforms attacks",
       {"flair_vs_function": 15, "domestic_vs_global": -10})]),

    # ══════════════════════════════════════════════════════════════════════════
    # MORE DRESSING ROOM — squad culture
    # ══════════════════════════════════════════════════════════════════════════

    ("dressing-room", "Your squad is fractured after a bad run. One signing to unite the dressing room. Who?",
     None, 2, ["squad", "man-management"],
     [("James Milner", "Professional. Standards. Every single day.",
       {"flair_vs_function": -15, "loyalty_vs_ambition": 15}),
      ("David Silva", "Quiet genius. Leads by example.",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 10}),
      ("Luka Modrić", "Grace under pressure. Universally respected.",
       {"flair_vs_function": 15, "loyalty_vs_ambition": 10, "domestic_vs_global": -10}),
      ("Jordan Henderson", "Vocal, commanding, grabs the collar",
       {"loyalty_vs_ambition": 15, "domestic_vs_global": 15, "flair_vs_function": -10})]),

    ("dressing-room", "New job. Your first signing sets the culture. What kind of player do you bring in?",
     None, 2, ["squad-building", "philosophy"],
     [("A hungry young striker — ambition and energy", "Set the tone with intent",
       {"youth_vs_experience": 15, "attack_vs_defense": 10}),
      ("A veteran leader — experience and standards", "Foundation first",
       {"youth_vs_experience": -15, "loyalty_vs_ambition": 10}),
      ("A holding midfielder — structure before flair", "Control the game, control the club",
       {"flair_vs_function": -15, "attack_vs_defense": -10}),
      ("A flair player — excite the fans, change the vibe", "Entertainment first",
       {"flair_vs_function": 20, "attack_vs_defense": 10})]),

    # ══════════════════════════════════════════════════════════════════════════
    # MORE PUB — spicy takes
    # ══════════════════════════════════════════════════════════════════════════

    ("pub", "Best football league in the world right now?",
     None, 1, ["debate"],
     [("Premier League", "Money, depth, drama — it's the show",
       {"domestic_vs_global": 15, "stats_vs_eye_test": 10}),
      ("La Liga", "Real, Barça, the technical quality is unmatched",
       {"flair_vs_function": 10, "domestic_vs_global": -10}),
      ("Serie A", "Tactical chess, it's back to its best",
       {"flair_vs_function": -10, "attack_vs_defense": -10, "domestic_vs_global": -10}),
      ("Bundesliga", "Youth, atmosphere, proper football",
       {"youth_vs_experience": 10, "domestic_vs_global": -10})]),

    ("pub", "VAR — good or bad for the game?",
     None, 1, ["debate"],
     [("Good — the right decisions matter more than speed", "Justice over vibes",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10}),
      ("Bad — it's killing the emotion of football", "Football is about passion, not perfection",
       {"flair_vs_function": 15, "stats_vs_eye_test": -15}),
      ("Good idea, terrible execution", "Technology needs better humans behind it",
       {"stats_vs_eye_test": 5, "flair_vs_function": 5}),
      ("Don't care — just get on with the game", "Football was fine before all this",
       {"flair_vs_function": 5, "stats_vs_eye_test": -5})]),

    # ══════════════════════════════════════════════════════════════════════════
    # MORE PRESS — character reveals
    # ══════════════════════════════════════════════════════════════════════════

    ("press", "You've just won the league. First thing you do?",
     None, 1, ["personality"],
     [("Champagne — celebrate with the players", "Moments like these are why you do it",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 10}),
      ("Call your family — they sacrificed too", "Football is nothing without perspective",
       {"loyalty_vs_ambition": 15, "flair_vs_function": -5}),
      ("Start planning for next season — one title isn't a dynasty", "Relentless",
       {"loyalty_vs_ambition": -5, "stats_vs_eye_test": 10}),
      ("Slide on the pitch in front of the fans — you're a kid again", "Let the emotion take you",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10})]),

    ("press", "You've been sacked. How do you want to be remembered?",
     None, 2, ["personality", "philosophy"],
     [("'He gave everything' — passion and commitment", "All heart",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 10}),
      ("'He changed the style of football at this club' — tactical legacy", "The game evolved",
       {"flair_vs_function": 15, "stats_vs_eye_test": 10}),
      ("'He won trophies' — silverware is all that matters", "Results are the legacy",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15}),
      ("'He brought through the youth' — a generation of players owe him", "The tree you plant",
       {"youth_vs_experience": 20, "loyalty_vs_ambition": 15})]),

    # ══════════════════════════════════════════════════════════════════════════
    # MORE ACADEMY — development philosophy
    # ══════════════════════════════════════════════════════════════════════════

    ("academy", "What's the most important thing to develop in a young player?",
     None, 2, ["youth", "philosophy"],
     [("Technical skill — everything else can be taught later", "Touch is king",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10}),
      ("Football IQ — read the game, the rest follows", "Thinking players win games",
       {"stats_vs_eye_test": 10, "flair_vs_function": -5}),
      ("Mentality — hunger, resilience, winning mindset", "Talent is common. Mental strength isn't.",
       {"flair_vs_function": -10, "stats_vs_eye_test": -5}),
      ("Physicality — modern football demands athletes", "Speed and power open doors",
       {"stats_vs_eye_test": 10, "flair_vs_function": -15})]),

    # ══════════════════════════════════════════════════════════════════════════
    # SPRINT 2 — Additional questions (added 2026-03-14)
    # ══════════════════════════════════════════════════════════════════════════

    # ── ACADEMY — youth vs buying, loans, academy structure ──────────────────

    ("academy", "Your best academy prospect is 18 and plays the same position as your captain. How do you handle the pathway?",
     None, 2, ["youth", "man-management"],
     [("Send the kid on loan — he needs minutes, not a bench", "Development needs game time",
       {"youth_vs_experience": 10, "domestic_vs_global": 10, "loyalty_vs_ambition": -5}),
      ("Rotate them — cup games for the kid, league for the captain", "Everyone has a role",
       {"youth_vs_experience": 5, "flair_vs_function": -5}),
      ("Start the kid — if he's good enough, he's old enough", "Talent doesn't wait",
       {"youth_vs_experience": 20, "loyalty_vs_ambition": -10}),
      ("Sell the captain while he still has value — the future is now", "Cold but rational",
       {"youth_vs_experience": 15, "loyalty_vs_ambition": -20, "stats_vs_eye_test": 15})]),

    ("academy", "You're designing your academy from scratch. What's the non-negotiable philosophy?",
     None, 2, ["philosophy", "youth"],
     [("Every team plays the same formation, 1st team down to U12", "Ajax model — identity from day one",
       {"flair_vs_function": 10, "youth_vs_experience": 15}),
      ("Winning doesn't matter until U18 — development only", "Process over results",
       {"youth_vs_experience": 20, "stats_vs_eye_test": -10, "flair_vs_function": 15}),
      ("Compete to win at every level — winning is a habit", "Champions are made early",
       {"youth_vs_experience": 10, "flair_vs_function": -10, "stats_vs_eye_test": 10}),
      ("Let coaches have freedom — different styles produce different players", "Diversity breeds creativity",
       {"flair_vs_function": 15, "youth_vs_experience": 10})]),

    ("academy", "A rival academy kid, 15 years old, is available. You'd have to pay £3m in compensation. Your own academy has a player in the same position. Worth it?",
     None, 2, ["youth", "transfer"],
     [("Pay it — you can never have too much talent", "Stockpile the gems",
       {"youth_vs_experience": 15, "stats_vs_eye_test": 10, "loyalty_vs_ambition": -10}),
      ("No — believe in your own. That money goes to facilities.", "Faith in the system",
       {"loyalty_vs_ambition": 15, "youth_vs_experience": 10, "domestic_vs_global": 10}),
      ("Take both — competition raises everyone's level", "Iron sharpens iron",
       {"youth_vs_experience": 15, "flair_vs_function": -5}),
      ("Scout him for two more years — 15 is too early to commit £3m", "Patience over panic",
       {"stats_vs_eye_test": 15, "youth_vs_experience": 5})]),

    ("academy", "Your academy has produced six first-team players in three years. The board wants to cut the academy budget and buy ready-made. Your response?",
     None, 3, ["youth", "philosophy"],
     [("Fight it — the academy IS the club's identity", "Some things are bigger than a spreadsheet",
       {"loyalty_vs_ambition": 20, "youth_vs_experience": 20}),
      ("Compromise — keep the academy but accept you need signings too", "Balance wins arguments",
       {"youth_vs_experience": 10, "stats_vs_eye_test": 5}),
      ("Agree — the academy has done its job, now spend the money", "Pragmatism over romanticism",
       {"youth_vs_experience": -15, "stats_vs_eye_test": 15, "loyalty_vs_ambition": -10}),
      ("Threaten to resign — if they don't value youth, they don't value you", "Principles are non-negotiable",
       {"loyalty_vs_ambition": 15, "youth_vs_experience": 20, "flair_vs_function": 10})]),

    ("academy", "Your 19-year-old loanee is tearing it up in the Championship — 12 goals by January. Do you recall him?",
     None, 2, ["youth", "tactical"],
     [("Recall — he's ready and you need goals", "Strike while the iron's hot",
       {"youth_vs_experience": 15, "stats_vs_eye_test": 10}),
      ("Leave him — let him finish what he started", "Consistency of experience matters more",
       {"youth_vs_experience": 10, "loyalty_vs_ambition": 10, "domestic_vs_global": 10}),
      ("Recall and sell with a buyback — cash in on the hype", "Business-smart",
       {"stats_vs_eye_test": 15, "loyalty_vs_ambition": -15}),
      ("Recall and loan him to a Prem club instead — step up the level", "Controlled progression",
       {"youth_vs_experience": 10, "domestic_vs_global": 10})]),

    ("academy", "What age should a player make their first-team debut to fulfil their potential?",
     None, 1, ["youth", "philosophy"],
     [("16-17 — the greats always show it early", "Messi debuted at 16. Enough said.",
       {"youth_vs_experience": 20, "flair_vs_function": 10}),
      ("18-20 — old enough to handle it, young enough to grow", "The sweet spot",
       {"youth_vs_experience": 10, "flair_vs_function": -5}),
      ("Whenever they're ready — age is just a number", "Development isn't linear",
       {"stats_vs_eye_test": 10, "youth_vs_experience": 5}),
      ("21+ — let them cook properly first", "Patience produces better players",
       {"youth_vs_experience": -10, "flair_vs_function": -10, "stats_vs_eye_test": 5})]),

    ("academy", "You can invest in ONE academy facility upgrade. What is it?",
     None, 1, ["youth", "infrastructure"],
     [("A world-class analytics lab — data from age 12", "Track everything, miss nothing",
       {"stats_vs_eye_test": 20, "youth_vs_experience": 10}),
      ("Full-size indoor pitch — train year-round in any weather", "Hours on the ball win everything",
       {"flair_vs_function": 10, "youth_vs_experience": 10}),
      ("Sports psychology department — mental game wins", "The mind makes the player",
       {"flair_vs_function": -5, "youth_vs_experience": 10, "stats_vs_eye_test": -5}),
      ("Boarding school — bring in talent from everywhere", "Widen the net, find the diamonds",
       {"domestic_vs_global": -15, "youth_vs_experience": 15})]),

    # ── SCOUTING — data vs eye test, moneyball, hidden gems ──────────────────

    ("scouting", "Moneyball in football — genius or nonsense?",
     None, 2, ["scouting", "data", "philosophy"],
     [("Genius — Brentford proved it works", "Data democratises football",
       {"stats_vs_eye_test": 20, "flair_vs_function": -10, "domestic_vs_global": -10}),
      ("Nonsense — football is too chaotic for spreadsheets", "You can't quantify heart",
       {"stats_vs_eye_test": -20, "flair_vs_function": 15}),
      ("It works for recruitment, not for coaching", "The right tool for the right job",
       {"stats_vs_eye_test": 10, "flair_vs_function": 5}),
      ("It works up to a point — then you need the eye", "Data gets you 80%, talent spotting gets the rest",
       {"stats_vs_eye_test": 5, "flair_vs_function": 5})]),

    ("scouting", "You're building a scouting department from zero. First hire?",
     None, 2, ["scouting", "squad-building"],
     [("A data analyst — build the database first", "Information is power",
       {"stats_vs_eye_test": 20, "flair_vs_function": -10}),
      ("An experienced continental scout — eyes in every league", "Relationships open doors",
       {"stats_vs_eye_test": -10, "domestic_vs_global": -15}),
      ("A former player who knows what quality looks like", "Takes one to know one",
       {"stats_vs_eye_test": -15, "flair_vs_function": 10}),
      ("A young video analyst — modern scouting is remote first", "Watch the world from your desk",
       {"stats_vs_eye_test": 15, "youth_vs_experience": 10, "domestic_vs_global": -10})]),

    ("scouting", "Your data model flags a 24-year-old centre-back from the Croatian league. Top 1% in progressive carries, aerial duels, and pressures. Nobody else is watching him. But he's never played above that level. Do you bid?",
     None, 3, ["scouting", "data", "transfer"],
     [("Bid immediately — this is what scouting is for", "First mover advantage wins",
       {"stats_vs_eye_test": 15, "domestic_vs_global": -15, "flair_vs_function": -5}),
      ("Send a scout to watch five games first — data needs context", "Numbers don't tell you about composure",
       {"stats_vs_eye_test": 5, "flair_vs_function": 5}),
      ("Wait for him to move to a better league — let someone else take the risk", "Let the market prove it",
       {"stats_vs_eye_test": 10, "domestic_vs_global": 10}),
      ("Too risky — the jump from Croatia to a top-five league is massive", "There's a reason nobody's watching",
       {"domestic_vs_global": 15, "stats_vs_eye_test": -5})]),

    ("scouting", "Which league is the most undervalued for scouting right now?",
     None, 1, ["scouting", "global"],
     [("Portuguese Liga", "The player factory — always producing",
       {"domestic_vs_global": -10, "stats_vs_eye_test": 10, "youth_vs_experience": 10}),
      ("Argentine Primera", "Raw talent, pennies on the pound",
       {"domestic_vs_global": -15, "flair_vs_function": 15, "youth_vs_experience": 10}),
      ("Belgian Pro League", "Europe's stepping stone — De Bruyne, Lukaku, Courtois all came through",
       {"domestic_vs_global": -10, "stats_vs_eye_test": 10}),
      ("MLS", "Seriously — it's getting better every year and still cheap",
       {"domestic_vs_global": -5, "stats_vs_eye_test": -10, "flair_vs_function": -5})]),

    ("scouting", "You've got two reports on the same player. One scout says 'best I've seen in five years.' The other says 'not top-flight quality.' What now?",
     None, 2, ["scouting", "process"],
     [("Trust the more experienced scout", "Seniority counts",
       {"stats_vs_eye_test": -10, "youth_vs_experience": -10}),
      ("Send a third scout — break the tie", "Process over opinion",
       {"stats_vs_eye_test": 5, "flair_vs_function": -5}),
      ("Watch him yourself — big decisions need the gaffer's eyes", "Own the call",
       {"stats_vs_eye_test": -10, "loyalty_vs_ambition": 10}),
      ("Pull the data — let the numbers adjudicate", "Remove the subjectivity",
       {"stats_vs_eye_test": 20, "flair_vs_function": -10})]),

    ("scouting", "You find a gem in League Two. 22 years old, unbelievable on the ball, never been scouted by anyone above. But he's never played in front of more than 3,000 people. Concern?",
     None, 2, ["scouting", "pressure"],
     [("No concern — talent is talent at any level", "Diamonds are found in the rough",
       {"stats_vs_eye_test": -10, "flair_vs_function": 15, "domestic_vs_global": 10}),
      ("Big concern — the mental jump is the hardest part", "Lower league ability doesn't always translate",
       {"stats_vs_eye_test": 10, "flair_vs_function": -10}),
      ("Buy him cheap, loan him to the Championship as a test", "De-risk the investment",
       {"stats_vs_eye_test": 10, "youth_vs_experience": 5, "domestic_vs_global": 10}),
      ("Sign him but give him a season to acclimatise — no pressure", "Ease the transition",
       {"loyalty_vs_ambition": 10, "youth_vs_experience": 5})]),

    ("scouting", "Transfer deadline day. Your chief scout has been tracking a player for six months. The data team just found a statistically better option, but there's been no live scouting. Clock's ticking. Who do you sign?",
     None, 3, ["scouting", "data", "pressure"],
     [("The scouted player — six months of due diligence trumps everything", "Process wins",
       {"stats_vs_eye_test": -10, "flair_vs_function": 5}),
      ("The data pick — the numbers are objectively better", "Trust the model",
       {"stats_vs_eye_test": 20, "flair_vs_function": -10}),
      ("Neither — don't panic buy", "Deadline day deals are usually bad deals",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": 5}),
      ("Both — if you can afford it, why not?", "More options, more competition",
       {"stats_vs_eye_test": 5, "flair_vs_function": 5, "loyalty_vs_ambition": -10})]),

    # ── PRESS — media handling, mind games, deflection ───────────────────────

    ("press", "Your biggest rival's manager takes a shot at you in his press conference. How do you respond?",
     None, 1, ["media", "personality"],
     [("Fire back — give them a headline they'll regret", "Mind games are part of the sport",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -5}),
      ("Ignore it completely — don't give them the oxygen", "Silence is power",
       {"flair_vs_function": -10, "stats_vs_eye_test": 10}),
      ("Laugh it off — 'I don't talk about managers from smaller clubs'", "Mockery is the ultimate disrespect",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -10}),
      ("Compliment them — kill them with kindness", "Take the high road every time",
       {"flair_vs_function": -5, "loyalty_vs_ambition": 5})]),

    ("press", "A transfer rumour links your best player to Real Madrid. Journalists won't stop asking. How do you handle it?",
     None, 2, ["media", "transfer"],
     [("Deny everything — 'he's not going anywhere'", "Control the narrative",
       {"loyalty_vs_ambition": 15, "flair_vs_function": -5}),
      ("'I can't control what other clubs do' — stay neutral", "Don't fuel the fire",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10}),
      ("Use it as motivation — 'shows how well we're doing'", "Spin it positive",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 5}),
      ("Refuse to answer — 'next question'", "Shut it down. Move on.",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 10})]),

    ("press", "You're asked to comment on a referee's performance after a controversial defeat. What's your play?",
     None, 2, ["media", "pressure"],
     [("Go nuclear — 'that was the worst refereeing I've ever seen'", "Sometimes you have to say what everyone's thinking",
       {"flair_vs_function": 15, "stats_vs_eye_test": -15, "loyalty_vs_ambition": 5}),
      ("'I'd rather not get fined' — subtle dig without crossing the line", "Say everything by saying nothing",
       {"flair_vs_function": 10, "stats_vs_eye_test": 5}),
      ("'We should have been good enough that it didn't matter'", "Take responsibility, deflect the controversy",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 10, "stats_vs_eye_test": 10}),
      ("'The data shows we had 22 shots. That's the real issue.'", "Redirect to performance metrics",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10})]),

    ("press", "You've signed a controversial player — incredible talent, awful reputation. First press conference. What's your opening line?",
     None, 2, ["media", "man-management"],
     [("'Judge him on what he does here, not what happened before'", "Fresh start narrative",
       {"loyalty_vs_ambition": 10, "flair_vs_function": 5}),
      ("'I sign players who make us better. End of story.'", "No apologies, no explanations",
       {"flair_vs_function": -5, "stats_vs_eye_test": 15}),
      ("'I've spoken to him privately and I'm convinced he's changed'", "Personal guarantee",
       {"loyalty_vs_ambition": 15, "stats_vs_eye_test": -10}),
      ("'The fans will love him when they see what he can do'", "Let the football do the talking",
       {"flair_vs_function": 15, "stats_vs_eye_test": -5})]),

    ("press", "Mid-season interview. You're asked: 'What's the biggest lesson management has taught you?'",
     None, 1, ["personality", "philosophy"],
     [("'People are more important than systems'", "Man-management is everything",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 5}),
      ("'Preparation beats inspiration'", "The work happens Monday to Friday",
       {"stats_vs_eye_test": 15, "flair_vs_function": -15}),
      ("'Trust your instincts — over-thinking kills you'", "Gut feeling is underrated",
       {"stats_vs_eye_test": -15, "flair_vs_function": 15}),
      ("'You're only as good as the players you recruit'", "Scouting is the real game",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": -5})]),

    ("press", "Social media blows up over something your player posted. The club's comms team wants a statement. What do you say?",
     None, 2, ["media", "man-management"],
     [("'It's a private matter between the player and the club'", "Keep it in-house",
       {"loyalty_vs_ambition": 10, "flair_vs_function": -10}),
      ("'He's been spoken to and it won't happen again'", "Acknowledge, discipline, move on",
       {"loyalty_vs_ambition": 5, "flair_vs_function": -5}),
      ("'Players are human beings — they're allowed opinions'", "Defend your player publicly",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 15}),
      ("Say nothing — never respond to social media noise", "Don't feed the algorithm",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10})]),

    ("press", "Post-match, you're asked about your title chances after going top of the league. What's your approach?",
     None, 1, ["media", "pressure"],
     [("'We take it game by game' — classic deflection", "Never look at the table in March",
       {"flair_vs_function": -10, "stats_vs_eye_test": 5}),
      ("'We're going to win it' — put the pressure on everyone else", "Own it. Believe it.",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -5}),
      ("'Ask me in May' — buy yourself time", "Don't make predictions you can't control",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10}),
      ("'The lads deserve credit — they've been unbelievable'", "Shine the light on the squad",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 5})]),

    # ── DREAM XI — era comparisons, best-ever debates ────────────────────────

    ("dream-xi", "Greatest right-back of all time?",
     None, 1, ["goat", "defence"],
     [("Cafu", "Brazil, AC Milan — the relentless overlapper",
       {"attack_vs_defense": 10, "flair_vs_function": 10, "domestic_vs_global": -10}),
      ("Philipp Lahm", "Germany, Bayern — played every position, mastered them all",
       {"flair_vs_function": -10, "stats_vs_eye_test": 10, "domestic_vs_global": -10}),
      ("Dani Alves", "Brazil, Barcelona — the most decorated player in history",
       {"flair_vs_function": 15, "attack_vs_defense": 10, "domestic_vs_global": -10}),
      ("Trent Alexander-Arnold", "Liverpool — redefining the position in real time",
       {"flair_vs_function": 15, "youth_vs_experience": 15, "domestic_vs_global": 10})]),

    ("dream-xi", "Best striker partnership of all time?",
     None, 1, ["goat", "attack"],
     [("Shearer & Sheringham", "England — Euros '96, telepathic",
       {"domestic_vs_global": 15, "flair_vs_function": -5}),
      ("Henry & Bergkamp", "Arsenal — artist and architect",
       {"flair_vs_function": 15, "domestic_vs_global": 10}),
      ("Ronaldo & Raúl", "Real Madrid — galácticos at their peak",
       {"flair_vs_function": 10, "domestic_vs_global": -10, "loyalty_vs_ambition": -5}),
      ("Suárez & Messi", "Barcelona — football from another dimension",
       {"flair_vs_function": 15, "stats_vs_eye_test": 10, "domestic_vs_global": -10})]),

    ("dream-xi", "Greatest manager of all time?",
     None, 1, ["goat", "management"],
     [("Sir Alex Ferguson", "27 years, 38 trophies, Man United",
       {"loyalty_vs_ambition": 20, "domestic_vs_global": 10, "youth_vs_experience": 5}),
      ("Pep Guardiola", "Tiki-taka revolution, trophies everywhere",
       {"flair_vs_function": 10, "stats_vs_eye_test": 15}),
      ("Arrigo Sacchi", "Changed how football was played — never played professionally",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15, "domestic_vs_global": -10}),
      ("Johan Cruyff", "Total Football — the philosophy that changed everything",
       {"flair_vs_function": 20, "youth_vs_experience": 15, "domestic_vs_global": -10})]),

    ("dream-xi", "You're picking an all-time XI. Formation?",
     None, 1, ["goat", "tactical"],
     [("4-3-3 — the modern standard. Balance and width.", "Attack and defence in harmony",
       {"attack_vs_defense": 5, "flair_vs_function": -5}),
      ("4-4-2 — if it's good enough for Fergie, it's good enough for me", "The classic",
       {"domestic_vs_global": 10, "flair_vs_function": -10, "stats_vs_eye_test": -5}),
      ("3-5-2 — midfield domination, wing-backs provide width", "Control the game",
       {"attack_vs_defense": -5, "flair_vs_function": 5}),
      ("4-2-3-1 — one magical number 10 behind the striker", "Build the team around genius",
       {"flair_vs_function": 15, "attack_vs_defense": 10})]),

    ("dream-xi", "Greatest World Cup goal of all time?",
     None, 1, ["goat", "moments"],
     [("Maradona vs England, 1986", "The solo run. The hand of God gets the headlines, but this was divine.",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15}),
      ("Carlos Alberto vs Italy, 1970", "The team goal. Nine passes. The perfect finish.",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10}),
      ("Zinedine Zidane vs Brazil, 2006", "The volleyed pass to himself. Quarterfinal masterclass.",
       {"flair_vs_function": 15, "youth_vs_experience": -10}),
      ("Robin van Persie vs Spain, 2014", "The flying header. Courage. Audacity.",
       {"flair_vs_function": 15, "attack_vs_defense": 10})]),

    ("dream-xi", "Best free-kick taker in football history?",
     None, 1, ["goat", "style"],
     [("Juninho Pernambucano", "200+ free-kick goals. The undisputed king.",
       {"flair_vs_function": 15, "stats_vs_eye_test": 10, "domestic_vs_global": -10}),
      ("David Beckham", "That foot. That technique. Iconic.",
       {"flair_vs_function": 10, "domestic_vs_global": 10}),
      ("Lionel Messi", "The numbers speak — no one's scored more in the modern era",
       {"stats_vs_eye_test": 15, "flair_vs_function": 5}),
      ("Siniša Mihajlović", "28 career free-kick goals from Serie A centre-back position",
       {"stats_vs_eye_test": -10, "attack_vs_defense": 10, "domestic_vs_global": -10})]),

    ("dream-xi", "Greatest left-back of all time?",
     None, 1, ["goat", "defence"],
     [("Paolo Maldini", "25 years at Milan. Defending as art.",
       {"attack_vs_defense": -10, "loyalty_vs_ambition": 20, "domestic_vs_global": -10}),
      ("Roberto Carlos", "That left foot could launch satellites",
       {"flair_vs_function": 15, "attack_vs_defense": 10, "domestic_vs_global": -10}),
      ("Ashley Cole", "Arsenal, Chelsea — the complete full-back, both ways",
       {"attack_vs_defense": -5, "domestic_vs_global": 15, "flair_vs_function": -5}),
      ("Marcelo", "Real Madrid — samba football from the back line",
       {"flair_vs_function": 20, "attack_vs_defense": 10, "domestic_vs_global": -10})]),

    ("dream-xi", "Best Champions League final performance ever?",
     None, 1, ["goat", "moments"],
     [("Zidane vs Leverkusen, 2002", "That volley. The greatest single goal in a final.",
       {"flair_vs_function": 20, "stats_vs_eye_test": -10}),
      ("Messi vs Man United, 2011", "Ran the game. Scored. Assisted. Untouchable.",
       {"stats_vs_eye_test": 15, "flair_vs_function": 10}),
      ("Gerrard vs AC Milan, 2005", "Down 3-0 at half-time. He willed them back.",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 10, "stats_vs_eye_test": -10}),
      ("Gareth Bale vs Liverpool, 2018", "Bicycle kick off the bench. Supersub royalty.",
       {"flair_vs_function": 15, "youth_vs_experience": -5})]),

    ("dream-xi", "One era of football you'd go back and watch live. Which one?",
     None, 1, ["goat", "era"],
     [("1970s Brazil — Pelé, Jairzinho, Rivelino at their peak", "When football was pure joy",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15}),
      ("Late 1980s Serie A — Maradona, Van Basten, Gullit in one league", "The golden age of tactics AND talent",
       {"flair_vs_function": 10, "attack_vs_defense": -10, "domestic_vs_global": -10}),
      ("2000s Champions League — Ronaldinho, Zidane, Henry, peak Ronaldo", "Superstar era",
       {"flair_vs_function": 15, "domestic_vs_global": -10}),
      ("Right now — Messi's farewell, Haaland's rise, Yamal's emergence", "We're living through history",
       {"youth_vs_experience": 10, "stats_vs_eye_test": 10})]),

    # ── DUGOUT — more tactical dilemmas ──────────────────────────────────────

    ("dugout", "Pre-season. You inherit a squad that plays 4-4-2 but you're a 4-3-3 man. How fast do you change it?",
     None, 2, ["tactical", "philosophy"],
     [("Immediately — my way from day one", "The system doesn't bend to the players",
       {"flair_vs_function": 10, "loyalty_vs_ambition": -10}),
      ("Gradually — introduce it over the first two months", "Evolution, not revolution",
       {"flair_vs_function": 5, "stats_vs_eye_test": 5}),
      ("Stick with 4-4-2 this season — win first, then transform", "Pragmatism before ideology",
       {"flair_vs_function": -15, "loyalty_vs_ambition": 10}),
      ("Play both — rotate formations based on the opponent", "Tactical flexibility is the system",
       {"stats_vs_eye_test": 10, "flair_vs_function": 5})]),

    ("dugout", "You're playing away to a side two leagues below you in the cup. They've got a plastic pitch. How do you approach it?",
     None, 1, ["tactical", "cupset"],
     [("Full strength — respect every opponent, take no chances", "Cups are won by taking them seriously",
       {"flair_vs_function": -10, "stats_vs_eye_test": 10}),
      ("Rotate the squad — rest the big names, give fringe players a chance", "Squad depth is for nights like these",
       {"youth_vs_experience": 10, "loyalty_vs_ambition": 5}),
      ("Match their intensity — long balls, physical, scrap for it", "When in Rome",
       {"flair_vs_function": -15, "attack_vs_defense": -5}),
      ("Play the kids — it's a great learning experience", "Every game is a classroom",
       {"youth_vs_experience": 20, "flair_vs_function": 5})]),

    ("dugout", "Derby day. Your centre-back picks up a yellow in the 20th minute. He's rash at the best of times. What do you do?",
     None, 2, ["tactical", "pressure"],
     [("Sub him at half-time — you can't afford to go down to ten", "Don't be a hero",
       {"flair_vs_function": -15, "stats_vs_eye_test": 15}),
      ("Leave him on — he knows the stakes, he'll be careful", "Trust your players",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 10}),
      ("Move him to a less combative position — full-back or midfield", "Tactical problem, tactical solution",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10}),
      ("Give him the hairdryer at half-time and send him back out", "Fear of the manager keeps discipline",
       {"flair_vs_function": -5, "loyalty_vs_ambition": 5})]),

    ("dugout", "You're up 1-0 in a final. Midfielder goes down injured in the 75th minute. You've got a defender and an attacker on the bench. Who comes on?",
     None, 2, ["tactical", "pressure"],
     [("The defender — protect the lead at all costs", "One goal is enough if you keep the sheet",
       {"attack_vs_defense": -20, "flair_vs_function": -10}),
      ("The attacker — kill the game on the break", "The best defence is a second goal",
       {"attack_vs_defense": 15, "flair_vs_function": 10}),
      ("The defender in midfield — pragmatic but structured", "Adapt with what you've got",
       {"attack_vs_defense": -10, "stats_vs_eye_test": 10}),
      ("Tell the players to figure it out — they know the system", "Empower the team",
       {"loyalty_vs_ambition": 10, "flair_vs_function": 5})]),

    ("dugout", "Your team plays better without your best player. The stats prove it. Do you drop him?",
     None, 3, ["tactical", "data", "man-management"],
     [("Drop him — the team is bigger than any individual", "Data doesn't lie",
       {"stats_vs_eye_test": 20, "flair_vs_function": -15, "loyalty_vs_ambition": -10}),
      ("Never — he's the best player, you build around him", "Genius deserves accommodation",
       {"flair_vs_function": 15, "stats_vs_eye_test": -15}),
      ("Change the system to get the best out of him AND the team", "The manager's job is to solve this puzzle",
       {"flair_vs_function": 10, "stats_vs_eye_test": 5}),
      ("Talk to him — maybe he needs a different role", "Communication before decisions",
       {"loyalty_vs_ambition": 10, "flair_vs_function": 5})]),

    ("dugout", "Extra time in a cup tie. You've used all your subs. Your striker is limping. Do you tell him to stay up front or drop deep?",
     None, 2, ["tactical", "pressure"],
     [("Stay up front — we need an outlet, even if he's a passenger", "One moment of quality is all it takes",
       {"attack_vs_defense": 15, "flair_vs_function": 10}),
      ("Drop deep — press from the front is impossible, help the midfield", "Work rate over glamour",
       {"attack_vs_defense": -10, "flair_vs_function": -10}),
      ("Stand on the halfway line — stretch the play, make them think twice", "Psychological warfare",
       {"flair_vs_function": 10, "stats_vs_eye_test": -5}),
      ("Tell him to go down and waste time — it's about survival now", "Win ugly if you have to",
       {"flair_vs_function": -15, "attack_vs_defense": -10})]),

    # ── TRANSFER — more market dilemmas ──────────────────────────────────────

    ("transfer", "Your striker scores 20 goals a season but his off-field behaviour is a nightmare. He's just been arrested. What do you do?",
     None, 3, ["transfer", "man-management"],
     [("Sell immediately — the club's reputation comes first", "No player is worth the chaos",
       {"loyalty_vs_ambition": -15, "flair_vs_function": -10, "stats_vs_eye_test": 10}),
      ("Stand by him — everyone deserves a second chance", "Loyalty when it's hardest",
       {"loyalty_vs_ambition": 20, "flair_vs_function": 10}),
      ("Suspend, assess, decide after the legal process", "Due process, not knee-jerk",
       {"stats_vs_eye_test": 10, "flair_vs_function": -5}),
      ("Keep him but fine him everything — make it hurt financially", "Punishment without losing the asset",
       {"stats_vs_eye_test": 15, "loyalty_vs_ambition": -5})]),

    ("transfer", "You're offered a swap deal: your solid 7/10 centre-mid for their inconsistent 10/10 winger. He'll be brilliant or invisible. Take it?",
     None, 2, ["transfer", "philosophy"],
     [("Take it — you can't buy 10/10 talent", "Ceiling over floor every time",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10}),
      ("Decline — consistency wins leagues", "You know what you've got",
       {"flair_vs_function": -15, "stats_vs_eye_test": 15, "loyalty_vs_ambition": 10}),
      ("Only if they add cash — talent premium goes both ways", "Make them pay for unpredictability",
       {"stats_vs_eye_test": 10, "flair_vs_function": 5}),
      ("Take it and then sign a cheap replacement for the midfielder", "Best of both worlds",
       {"flair_vs_function": 10, "stats_vs_eye_test": 5, "loyalty_vs_ambition": -5})]),

    ("transfer", "You can sign a player from one of these clubs. Same position, same price. Where are you shopping?",
     None, 1, ["transfer", "global"],
     [("Ajax", "Technically elite, tactically intelligent — the Dutch school",
       {"youth_vs_experience": 15, "flair_vs_function": 10, "domestic_vs_global": -10}),
      ("Atlético Madrid", "Grit, intensity, knows how to suffer — Simeone-proof",
       {"flair_vs_function": -15, "attack_vs_defense": -10, "domestic_vs_global": -10}),
      ("Napoli", "Serie A schooled — tactical IQ through the roof",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10, "domestic_vs_global": -10}),
      ("Brighton", "Data-picked, system-trained, Premier League ready",
       {"stats_vs_eye_test": 20, "domestic_vs_global": 15})]),

    ("transfer", "Free agent window. You can sign ONE veteran on a free. Who's adding the most value?",
     None, 1, ["transfer", "free-agent"],
     [("A 33-year-old Champions League winner — been there, done it", "Experience money can't buy",
       {"youth_vs_experience": -15, "loyalty_vs_ambition": 5}),
      ("A 29-year-old who's been injured for a year — was elite before", "Massive upside if he recovers",
       {"flair_vs_function": 10, "stats_vs_eye_test": -10}),
      ("A 26-year-old from a relegated club — needs a fresh start", "Right age, wrong situation",
       {"stats_vs_eye_test": 10, "domestic_vs_global": 10}),
      ("A 22-year-old released from a big club — couldn't break through", "Talent that needs unlocking",
       {"youth_vs_experience": 15, "stats_vs_eye_test": -5})]),

    # ── PUB — more spicy debates ─────────────────────────────────────────────

    ("pub", "Messi or Ronaldo? Come on. Pick one.",
     None, 1, ["goat", "debate"],
     [("Messi — the magician. Football as art.", "Genius can't be taught",
       {"flair_vs_function": 15, "stats_vs_eye_test": -5}),
      ("Ronaldo — the machine. Relentless. Self-made greatness.", "Hard work beats talent",
       {"flair_vs_function": -10, "stats_vs_eye_test": 10, "loyalty_vs_ambition": -10}),
      ("Messi — but only because of the World Cup", "2022 settled it",
       {"flair_vs_function": 10, "domestic_vs_global": -5}),
      ("Ronaldo — he did it in four different leagues", "Adaptability is the real GOAT measure",
       {"domestic_vs_global": -15, "loyalty_vs_ambition": -10})]),

    ("pub", "Is football getting better or worse?",
     None, 1, ["debate", "era"],
     [("Better — athletes are faster, tactics are deeper, the game evolves", "Progress is real",
       {"stats_vs_eye_test": 15, "youth_vs_experience": 10}),
      ("Worse — too much money, no soul, no characters left", "Football lost its identity",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 15, "stats_vs_eye_test": -10}),
      ("Different — you can't compare eras, just enjoy them", "Nostalgia is a trap",
       {"flair_vs_function": 5, "stats_vs_eye_test": 5}),
      ("The football is better, the culture is worse", "The game is great, the circus around it isn't",
       {"stats_vs_eye_test": 10, "flair_vs_function": 10})]),

    ("pub", "Should players manage their own clubs after they retire?",
     None, 1, ["debate", "management"],
     [("Yes — they understand the game from the inside", "Playing experience is irreplaceable",
       {"stats_vs_eye_test": -10, "flair_vs_function": 10}),
      ("No — managing is a completely different skill set", "Zidane is the exception, not the rule",
       {"stats_vs_eye_test": 10, "flair_vs_function": -10}),
      ("Only if they coach their way up properly — no shortcuts", "Earn it like everyone else",
       {"loyalty_vs_ambition": 10, "youth_vs_experience": -5}),
      ("Depends on the player — leaders become managers, individuals don't", "Captains yes, Number 10s no",
       {"flair_vs_function": -5, "loyalty_vs_ambition": 10})]),

    ("pub", "What matters more — winning trophies or playing beautiful football?",
     None, 1, ["debate", "philosophy"],
     [("Trophies — nobody remembers the runners-up", "Silver polish doesn't pay",
       {"flair_vs_function": -15, "stats_vs_eye_test": 15}),
      ("Beautiful football — that's why we watch the game", "Winning ugly is still ugly",
       {"flair_vs_function": 20, "stats_vs_eye_test": -10}),
      ("Both — the best teams do both", "It's not a trade-off",
       {"flair_vs_function": 10, "stats_vs_eye_test": 5}),
      ("Ask the fans — they'd take a trophy any way it comes", "Romance is for neutrals",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 10})]),

    ("pub", "Is there a position more important than centre-forward?",
     None, 1, ["debate", "tactical"],
     [("No — goals win games, full stop", "The game is about putting the ball in the net",
       {"attack_vs_defense": 15, "flair_vs_function": 5}),
      ("Centre-back — you can't win anything with a leaky defence", "Defence wins championships",
       {"attack_vs_defense": -15, "flair_vs_function": -10}),
      ("Defensive midfielder — controls everything, the heartbeat", "Busquets, Rodri, Makelele — the invisible kings",
       {"attack_vs_defense": -5, "flair_vs_function": -10, "stats_vs_eye_test": 10}),
      ("Goalkeeper — one mistake and it's over. Huge responsibility.", "The last line defines everything",
       {"attack_vs_defense": -15, "stats_vs_eye_test": 5})]),

    ("pub", "The financial fair play rules — protecting the game or protecting the elite?",
     None, 2, ["debate", "politics"],
     [("Protecting the game — clubs need to live within their means", "Sustainability matters",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": 10}),
      ("Protecting the elite — it stops new money challenging the old guard", "The ladder's been pulled up",
       {"loyalty_vs_ambition": -15, "flair_vs_function": 10}),
      ("Good idea, badly enforced — the rules only apply to some", "Selective justice is no justice",
       {"stats_vs_eye_test": 5, "loyalty_vs_ambition": -5}),
      ("Scrap the lot — let the market decide", "Football is entertainment, not a charity",
       {"flair_vs_function": 5, "loyalty_vs_ambition": -10, "stats_vs_eye_test": -10})]),

    # ── DRESSING ROOM — more squad dynamics ──────────────────────────────────

    ("dressing-room", "Half-time. You're 3-0 down. What's the dressing room speech?",
     None, 2, ["man-management", "pressure"],
     [("Tear into them — unacceptable performance, make them feel it", "Anger can be a weapon",
       {"flair_vs_function": -10, "loyalty_vs_ambition": -5}),
      ("Stay calm — outline three clear tactical changes", "Clear heads, clear plan",
       {"stats_vs_eye_test": 15, "flair_vs_function": -5}),
      ("Appeal to their pride — 'you're better than this, show me'", "Light the fire from within",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 10}),
      ("Say nothing — let the silence speak louder than words", "Sometimes the void is more powerful",
       {"flair_vs_function": 5, "stats_vs_eye_test": -5})]),

    ("dressing-room", "Your assistant manager disagrees with your team selection in front of the coaching staff. How do you handle it?",
     None, 2, ["man-management", "leadership"],
     [("Shut it down publicly — the gaffer's word is final", "Authority is non-negotiable",
       {"flair_vs_function": -10, "loyalty_vs_ambition": -10}),
      ("Hear them out — good managers listen to their staff", "Collaboration makes better decisions",
       {"loyalty_vs_ambition": 10, "stats_vs_eye_test": 5}),
      ("Address it privately afterwards — don't undermine either of you", "Handle it behind closed doors",
       {"loyalty_vs_ambition": 5, "flair_vs_function": -5}),
      ("Thank them for challenging you — encourage a culture of debate", "The best staff pushes back",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 15})]),

    ("dressing-room", "End of season. You have to release five players. One is a loyal servant who's past it. One is a young player who hasn't developed. Do you tell them face to face or let the director handle it?",
     None, 2, ["man-management", "leadership"],
     [("Face to face — they deserve to hear it from you", "Respect is telling the truth yourself",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 5}),
      ("Let the director handle it — it's not personal, it's business", "Distance protects the relationship",
       {"loyalty_vs_ambition": -10, "stats_vs_eye_test": 10}),
      ("Tell the veteran yourself, let the director handle the youngster", "Different situations, different approaches",
       {"loyalty_vs_ambition": 5, "youth_vs_experience": -5}),
      ("Call a squad meeting — be transparent about the whole clear-out", "No secrets. Everyone knows where they stand.",
       {"loyalty_vs_ambition": 10, "flair_vs_function": -5})]),

    ("dressing-room", "A senior player refuses to play in a new position you've asked him to try. What do you do?",
     None, 2, ["man-management", "tactical"],
     [("Bench him — if you won't adapt, you won't play", "Flexibility is not optional",
       {"loyalty_vs_ambition": -15, "flair_vs_function": -10}),
      ("Explain your reasoning — sell the vision, earn his buy-in", "Persuasion over power",
       {"loyalty_vs_ambition": 10, "flair_vs_function": 5}),
      ("Drop the idea — play him where he's comfortable", "Don't fix what isn't broken",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 10}),
      ("Give him one game to prove you wrong — then decide", "Let the pitch settle the argument",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": 5})]),

    # ── SCOUTING — one more ──────────────────────────────────────────────────

    ("scouting", "What's the single most overrated stat in football?",
     None, 1, ["scouting", "data"],
     [("Possession — you can have 70% and lose", "Meaningless if you don't create",
       {"stats_vs_eye_test": -10, "flair_vs_function": 10}),
      ("Pass completion — safe sideways passes inflate it", "Tells you nothing about quality",
       {"stats_vs_eye_test": -10, "flair_vs_function": 5}),
      ("Goals — without context, a goalscoring record is misleading", "Who scored them and against whom?",
       {"stats_vs_eye_test": -5, "flair_vs_function": -5}),
      ("None — every stat has value if you know how to read it", "There are no bad metrics, only bad analysts",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10})]),

    # ══════════════════════════════════════════════════════════════════════════
    # SPRINT 2 — Additional questions (added 2026-03-14)
    # ══════════════════════════════════════════════════════════════════════════

    # ── DREAM XI — best-ever debates, era comparisons ────────────────────────

    ("dream-xi", "You're building the greatest midfield three of all time. Who's your number 6 — the anchor?",
     None, 2, ["goat", "era"],
     [("Claude Makélélé", "Invented the role. Everyone since is measured against him.",
       {"flair_vs_function": -15, "attack_vs_defense": -15}),
      ("Sergio Busquets", "Nobody reads the game better. Positional perfection.",
       {"flair_vs_function": -10, "stats_vs_eye_test": 10}),
      ("Patrick Vieira", "Dominated physically and technically. Box-to-box before it was a thing.",
       {"flair_vs_function": 10, "attack_vs_defense": 5}),
      ("Lothar Matthäus", "Could do everything. The complete midfielder.",
       {"flair_vs_function": 5, "domestic_vs_global": -10})]),

    ("dream-xi", "Greatest centre-back partnership in history?",
     None, 1, ["goat", "era", "defence"],
     [("Maldini & Nesta", "AC Milan poetry. Elegance and reading of the game.",
       {"flair_vs_function": 10, "domestic_vs_global": -10}),
      ("Ferdinand & Vidic", "United's wall. One read it, one destroyed it.",
       {"flair_vs_function": -5, "domestic_vs_global": 15}),
      ("Cannavaro & Nesta", "Italy 2006. A World Cup won on defending.",
       {"attack_vs_defense": -15, "domestic_vs_global": -10}),
      ("Terry & Carvalho", "Mourinho's Chelsea. 15 goals conceded in a season.",
       {"attack_vs_defense": -15, "flair_vs_function": -10, "domestic_vs_global": 10})]),

    ("dream-xi", "If you could pick ONE player from any era to build your team around, who would it be?",
     None, 2, ["goat", "philosophy"],
     [("Lionel Messi", "The greatest individual talent football has ever seen.",
       {"flair_vs_function": 20, "stats_vs_eye_test": 10}),
      ("Johan Cruyff", "Changed the game itself. Player, philosopher, revolutionary.",
       {"flair_vs_function": 15, "youth_vs_experience": 10}),
      ("Diego Maradona", "Could win it single-handedly. Pure magic and will.",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15}),
      ("Pelé", "Three World Cups. The original complete forward.",
       {"domestic_vs_global": -15, "flair_vs_function": 10})]),

    ("dream-xi", "Best goalkeeper you've ever seen?",
     None, 1, ["goat"],
     [("Gianluigi Buffon", "Longevity, presence, big-game temperament. The standard.",
       {"loyalty_vs_ambition": 15, "domestic_vs_global": -10}),
      ("Manuel Neuer", "Reinvented the position. A sweeper who happens to save shots.",
       {"flair_vs_function": 10, "stats_vs_eye_test": 10}),
      ("Lev Yashin", "The Black Spider. Changed what a goalkeeper could be.",
       {"domestic_vs_global": -15, "flair_vs_function": 5}),
      ("Peter Schmeichel", "The star-fish save. Commanded his area like a king.",
       {"domestic_vs_global": 10, "attack_vs_defense": -10})]),

    # ── PRESS CONFERENCE — media handling, mind games ─────────────────────────

    ("press", "Your rival manager calls your team 'a small club with no history.' How do you respond?",
     None, 2, ["media", "pressure", "rivalry"],
     [("Laugh it off — results do the talking", "Cool head, warm revenge on the pitch",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 10}),
      ("Fire back — 'Ask him how many points behind us he is'", "Never let a slight go unanswered",
       {"flair_vs_function": 10, "attack_vs_defense": 10}),
      ("Use it as motivation — stick the quote on the dressing room wall", "Fuel the fire",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 5}),
      ("Ignore it completely — never mention other managers", "Wenger school of diplomacy",
       {"flair_vs_function": -15, "stats_vs_eye_test": 5})]),

    ("press", "A journalist asks if you'll resign after three straight losses. What do you say?",
     None, 2, ["media", "pressure"],
     [("'I'll be here longer than you will' — defiance", "Show strength under fire",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 15}),
      ("'We need to improve and I take responsibility' — measured", "Accountability without drama",
       {"flair_vs_function": -10, "stats_vs_eye_test": 5}),
      ("'Next question' — shut it down", "Don't dignify it with a response",
       {"flair_vs_function": -5, "attack_vs_defense": -5}),
      ("'Results haven't been good enough but the process is right' — data-backed", "Xg doesn't lie",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10})]),

    ("press", "Your star player posts something controversial on social media. The press are asking you about it. What do you do?",
     None, 2, ["media", "management"],
     [("'That's a private matter — I'll deal with it internally'", "Close ranks, handle it behind closed doors",
       {"loyalty_vs_ambition": 10, "flair_vs_function": -5}),
      ("'He's a grown man and he'll answer for himself'", "Distance yourself, protect the club",
       {"loyalty_vs_ambition": -10, "flair_vs_function": 5}),
      ("Fine him and make a public statement — set the standard", "Zero tolerance, no ambiguity",
       {"flair_vs_function": -10, "loyalty_vs_ambition": -5}),
      ("Support him publicly — 'Players are humans with opinions'", "Stand by your people",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 10})]),

    # ── DRESSING ROOM — man-management, squad dynamics ─────────────────────────

    ("dressing-room", "Two senior players aren't speaking to each other. It's affecting the squad. What's your move?",
     None, 2, ["management", "squad"],
     [("Get them in a room together — hash it out, no leaving until it's resolved", "Direct confrontation",
       {"flair_vs_function": -5, "loyalty_vs_ambition": 5}),
      ("Sell one of them — you can't have a divided dressing room", "Ruthless but effective",
       {"loyalty_vs_ambition": -15, "flair_vs_function": -10}),
      ("Let the captain deal with it — it's a player issue, not a manager issue", "Empower leadership",
       {"loyalty_vs_ambition": 10, "youth_vs_experience": -5}),
      ("Ignore it — professionals should sort themselves out", "Stay out of it",
       {"flair_vs_function": -5, "loyalty_vs_ambition": -5})]),

    ("dressing-room", "Your squad needs a new captain. Who do you pick?",
     None, 1, ["management", "leadership"],
     [("Your best player — lead by example on the pitch", "Quality inspires more than words",
       {"flair_vs_function": 15, "youth_vs_experience": -5}),
      ("Your longest-serving player — loyalty and commitment", "The armband means belonging",
       {"loyalty_vs_ambition": 15, "youth_vs_experience": -10}),
      ("Your most vocal leader — someone who'll demand standards", "Voice matters more than talent",
       {"flair_vs_function": -10, "attack_vs_defense": -5}),
      ("Let the squad vote — they know who they'd follow into battle", "Democracy builds trust",
       {"loyalty_vs_ambition": 10, "flair_vs_function": 5})]),

    # ── TRANSFER WINDOW — buying, selling, market timing ──────────────────────

    ("transfer", "You've got £50m to spend. How do you allocate it?",
     None, 2, ["transfer", "strategy"],
     [("One marquee signing — £50m on one player who transforms the team", "Quality over quantity",
       {"flair_vs_function": 15, "stats_vs_eye_test": -5}),
      ("Two good players at £25m each — strengthen two positions", "Balance and depth",
       {"flair_vs_function": -5, "stats_vs_eye_test": 5}),
      ("Five £10m signings — squad depth wins titles", "Moneyball approach",
       {"stats_vs_eye_test": 15, "flair_vs_function": -15}),
      ("Save it — wait for January when prices drop", "Patience is a weapon",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": -10})]),

    ("transfer", "A rival club offers £80m for your 23-year-old academy graduate. He's your best player. What do you do?",
     None, 3, ["transfer", "loyalty"],
     [("Reject it — he's priceless, you can't replace what he means to the fans", "Loyalty over money",
       {"loyalty_vs_ambition": 20, "youth_vs_experience": 10}),
      ("Accept it — £80m rebuilds an entire squad", "Business sense wins titles long-term",
       {"loyalty_vs_ambition": -15, "stats_vs_eye_test": 10}),
      ("Reject and give him a new contract with a higher release clause", "Protect the asset",
       {"loyalty_vs_ambition": 10, "stats_vs_eye_test": 5}),
      ("Accept but only if they include a buyback clause", "Have your cake and eat it",
       {"stats_vs_eye_test": 15, "loyalty_vs_ambition": 5})]),

    # ── THE DUGOUT — in-match decisions ───────────────────────────────────────

    ("dugout", "You're 1-0 up in a cup semi-final with 20 minutes left. Your formation?",
     None, 2, ["tactical", "pressure"],
     [("Stay as you are — don't change a winning game", "If it ain't broke...",
       {"flair_vs_function": -10, "attack_vs_defense": -10}),
      ("Go 5-4-1 — shut up shop and see it out", "Pragmatism wins trophies",
       {"attack_vs_defense": -20, "flair_vs_function": -15}),
      ("Push for a second — kill the game", "The best defence is attack",
       {"attack_vs_defense": 15, "flair_vs_function": 10}),
      ("Fresh legs in midfield — control the game with energy", "Manage the phases",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10})]),

    ("dugout", "Your team is dominating possession but can't score. It's 0-0 at half-time. What do you change?",
     None, 2, ["tactical"],
     [("Nothing — keep doing what you're doing, the goal will come", "Trust the process",
       {"stats_vs_eye_test": 10, "flair_vs_function": -5}),
      ("Bring on a target man — go more direct", "Change the angle of attack",
       {"flair_vs_function": -15, "attack_vs_defense": 10}),
      ("Push your full-backs higher — overload the wide areas", "Width creates space",
       {"attack_vs_defense": 10, "flair_vs_function": 5}),
      ("Bring on your most unpredictable player — disrupt their defensive structure", "Chaos is a ladder",
       {"flair_vs_function": 20, "stats_vs_eye_test": -10})]),

    # ── THE PUB — classic debates ─────────────────────────────────────────────

    ("pub", "Premier League or Champions League — which matters more?",
     None, 1, ["debate", "philosophy"],
     [("Premier League — 38 games, no hiding, consistency wins", "The truest test of quality",
       {"domestic_vs_global": 15, "stats_vs_eye_test": 10}),
      ("Champions League — you're remembered for the nights under the lights", "The pinnacle of club football",
       {"domestic_vs_global": -15, "flair_vs_function": 10}),
      ("Both — you need to compete on all fronts", "The treble is the only real achievement",
       {"flair_vs_function": 5, "loyalty_vs_ambition": 5}),
      ("Neither — it's about building something lasting", "Legacy over silverware",
       {"loyalty_vs_ambition": 15, "youth_vs_experience": 10})]),

    ("pub", "Could the best team of the 90s beat a modern relegation side?",
     None, 1, ["debate", "era"],
     [("Absolutely — class is permanent, the 90s were harder", "Old school was tougher",
       {"flair_vs_function": 10, "domestic_vs_global": 10}),
      ("No chance — the worst Prem team today is fitter, faster, more organised", "The game has evolved",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10}),
      ("Depends on the rules — VAR and back-pass rule change everything", "Context matters",
       {"stats_vs_eye_test": 10, "flair_vs_function": 5}),
      ("Who cares — comparing eras is pointless", "Enjoy both for what they are",
       {"flair_vs_function": -5, "stats_vs_eye_test": -5})]),

    # ══════════════════════════════════════════════════════════════════════════
    # HISTORIAN'S TACTICAL QUESTIONS — control_vs_chaos dimension (2026-03-14)
    # ══════════════════════════════════════════════════════════════════════════

    # ── DUGOUT — tactical philosophy ──────────────────────────────────────────

    ("dugout", "Your centre-backs are quick but not great in the air. Where do you set your defensive line?",
     None, 2, ["tactical", "philosophy"],
     [("High line, squeeze the pitch", "Sacchi, Guardiola, Nagelsmann — compress space, dominate territory",
       {"control_vs_chaos": 15, "attack_vs_defense": 10, "flair_vs_function": -5}),
      ("Drop deep, invite them on", "Mourinho, Simeone, Dyche — absorb pressure, strike on the break",
       {"control_vs_chaos": -15, "attack_vs_defense": -10, "flair_vs_function": -10}),
      ("Depends on the opponent", "Pragmatic — read the game, adapt the line",
       {"control_vs_chaos": -5, "stats_vs_eye_test": 10}),
      ("Flexible — high in possession, drop in transition", "Klopp's hybrid — best of both worlds",
       {"control_vs_chaos": 5, "flair_vs_function": 5, "attack_vs_defense": 5})]),

    ("dugout", "Opposition goalkeeper has the ball. What are your forwards doing?",
     None, 2, ["tactical", "pressing"],
     [("Pressing immediately — force errors, win it high", "Klopp's Dortmund, Rangnick's RB Leipzig",
       {"control_vs_chaos": -10, "attack_vs_defense": 15, "flair_vs_function": 5}),
      ("Holding shape, waiting for the trigger pass", "Conte's low block — patience, then counter",
       {"control_vs_chaos": -15, "attack_vs_defense": -10, "flair_vs_function": -10}),
      ("Pressing in a coordinated trap — let them play into our press", "Guardiola's positional pressing — controlled aggression",
       {"control_vs_chaos": 15, "attack_vs_defense": 5, "stats_vs_eye_test": 10}),
      ("Man-marking their centre-backs — chaos from the front", "Bielsa's mad science — relentless, reckless, glorious",
       {"control_vs_chaos": -10, "flair_vs_function": 15, "attack_vs_defense": 15})]),

    ("dugout", "How do you want your team to play out from the back?",
     None, 2, ["tactical", "build-up"],
     [("Short, always — even under pressure", "Guardiola, de Zerbi — the ball is safest at your feet",
       {"control_vs_chaos": 20, "flair_vs_function": 10, "stats_vs_eye_test": 10}),
      ("Long and direct to the front man", "Allardyce, Dyche, Pulis — bypass the press, win the second ball",
       {"control_vs_chaos": -15, "flair_vs_function": -15, "attack_vs_defense": 10}),
      ("Mixed — short when they let us, long when they press", "Ancelotti pragmatism — read the moment, choose the method",
       {"control_vs_chaos": 5, "stats_vs_eye_test": 5}),
      ("Through the thirds — bypass midfield, find the 10", "Conte's vertical passing — direct but not long",
       {"control_vs_chaos": -5, "flair_vs_function": 5, "attack_vs_defense": 5})]),

    ("dugout", "Your team is struggling to break down a deep block. How do you create space?",
     None, 2, ["tactical", "attacking"],
     [("Wide play — stretch them ear to ear, deliver crosses", "Traditional English approach — Moyes at Everton, Allardyce's Blackburn",
       {"control_vs_chaos": -5, "flair_vs_function": -10, "attack_vs_defense": 10}),
      ("Half-space overloads — mezzalas, inverted wingers, positional rotations", "Guardiola, Nagelsmann — the geometry of space",
       {"control_vs_chaos": 15, "flair_vs_function": 10, "stats_vs_eye_test": 10}),
      ("Individual brilliance — give it to your best dribbler and let him go", "The Neymar school — chaos creates what systems cannot",
       {"control_vs_chaos": -15, "flair_vs_function": 20, "stats_vs_eye_test": -10}),
      ("Set pieces — work on them relentlessly, they're worth 10+ goals a season", "The post-2018 analytics revolution — dead balls win titles",
       {"control_vs_chaos": 5, "stats_vs_eye_test": 15, "flair_vs_function": -10})]),

    ("dugout", "You've just won the ball in your own half. What's the first thought?",
     None, 2, ["tactical", "transition"],
     [("Counter-attack immediately — vertical, fast, ruthless", "Mourinho's Inter, Klopp's Dortmund — strike before they reset",
       {"control_vs_chaos": -15, "attack_vs_defense": 15, "flair_vs_function": 10}),
      ("Secure possession first — patience, reset, build again", "Guardiola's City, Xavi's Barca — the ball is the weapon",
       {"control_vs_chaos": 20, "attack_vs_defense": -5, "flair_vs_function": -5}),
      ("It depends who's on the ball — playmaker plays, centre-back goes long", "Pragmatic — read the situation, not the manual",
       {"control_vs_chaos": 0, "stats_vs_eye_test": 10}),
      ("Spring the trap — we press so high we're already in their half", "Bielsa, Rangnick — transition IS the system",
       {"control_vs_chaos": -10, "attack_vs_defense": 15, "flair_vs_function": 10})]),

    ("dugout", "Do you want your deepest midfielder to be a destroyer or a creator?",
     None, 2, ["tactical", "midfield"],
     [("Destroyer — protect the back four at all costs", "Makelele, Kante, Casemiro — the shield that frees the sword",
       {"control_vs_chaos": -10, "attack_vs_defense": -15, "flair_vs_function": -10}),
      ("Creator — the game flows through him", "Pirlo, Busquets, Rodri — tempo, vision, control",
       {"control_vs_chaos": 15, "flair_vs_function": 10, "attack_vs_defense": 5}),
      ("Both — a Vieira, a Yaya Toure, someone who does everything", "The complete midfielder — rare but transformative",
       {"control_vs_chaos": 5, "flair_vs_function": 15, "attack_vs_defense": 5}),
      ("Neither — play a double pivot and share the burden", "The modern pragmatic solution — spread the risk",
       {"control_vs_chaos": 5, "stats_vs_eye_test": 10, "flair_vs_function": -10})]),

    # ── DREAM XI — tactical history ───────────────────────────────────────────

    ("dream-xi", "Greatest tactical innovation in football history?",
     None, 2, ["goat", "tactical", "history"],
     [("Total Football — Michels' Ajax, Cruyff's philosophy", "Every player plays every position. Football as fluid art.",
       {"control_vs_chaos": 10, "flair_vs_function": 20, "domestic_vs_global": -15}),
      ("The W-M formation — Herbert Chapman's revolution", "The shape that created modern football. Arsenal in the 1930s.",
       {"control_vs_chaos": 10, "stats_vs_eye_test": 10, "flair_vs_function": -10}),
      ("Catenaccio — Herrera's Inter, the art of the lock", "Defensive perfection. Italy's gift to tactical football.",
       {"control_vs_chaos": -15, "attack_vs_defense": -15, "domestic_vs_global": -10}),
      ("Gegenpressing — Klopp and Rangnick's pressing revolution", "Win the ball back in 6 seconds. The modern game's defining idea.",
       {"control_vs_chaos": -10, "attack_vs_defense": 15, "flair_vs_function": 5})]),

    ("dream-xi", "Who changed the game more — Sacchi, Cruyff, or Guardiola?",
     None, 2, ["goat", "tactical", "management"],
     [("Arrigo Sacchi", "Never played professionally, revolutionised defending. Coordinated pressing, the offside trap as art.",
       {"control_vs_chaos": 15, "flair_vs_function": -10, "stats_vs_eye_test": 15, "domestic_vs_global": -10}),
      ("Johan Cruyff", "Total Football as player AND manager. Created La Masia, created Barcelona's DNA.",
       {"control_vs_chaos": 15, "flair_vs_function": 20, "youth_vs_experience": 15, "domestic_vs_global": -10}),
      ("Pep Guardiola", "Took Cruyff's ideas and perfected them. Tiki-taka, positional play, the false 9.",
       {"control_vs_chaos": 20, "flair_vs_function": 15, "stats_vs_eye_test": 10}),
      ("None of them — Rinus Michels invented it all and they're footnotes", "The General. Without Michels, none of them exist.",
       {"control_vs_chaos": 10, "flair_vs_function": 10, "domestic_vs_global": -15})]),
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
# All Gaffer questions are Tier 2 (dimension-weighted)

inserted = 0
skipped = 0
missing_persons = []

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
        for opt in options:
            name = opt[0]
            sub = opt[1]
            weights = opt[2] if len(opt) > 2 else None
            pid = find_person(name)
            w_str = f" weights={weights}" if weights else ""
            if not pid:
                missing_persons.append(name)
            print(f"    → {name} ({sub}) [person_id={pid or '?'}]{w_str}")
        inserted += 1
        continue

    cur.execute("""
        INSERT INTO fc_questions (category_id, question_text, subtitle, option_count, difficulty, tags, tier)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (cat_id, question_text, subtitle, len(options), difficulty, tags, 2))
    q_id = cur.fetchone()[0]

    for i, opt in enumerate(options):
        name = opt[0]
        sub = opt[1]
        weights = opt[2] if len(opt) > 2 else None
        pid = find_person(name)
        if not pid:
            missing_persons.append(name)
        cur.execute("""
            INSERT INTO fc_options (question_id, person_id, label, subtitle, sort_order, dimension_weights)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (q_id, pid, name, sub, i, json.dumps(weights) if weights else None))

    inserted += 1

print(f"\n── Summary ──")
print(f"  Inserted: {inserted}")
print(f"  Skipped:  {skipped}")
if missing_persons:
    unique_missing = sorted(set(missing_persons))
    print(f"  Missing persons ({len(unique_missing)}): {', '.join(unique_missing[:20])}")
    if len(unique_missing) > 20:
        print(f"    ... and {len(unique_missing) - 20} more")
if args.dry_run:
    print("  (dry-run — no data was written)")

cur.close()
conn.close()
print("Done.")
