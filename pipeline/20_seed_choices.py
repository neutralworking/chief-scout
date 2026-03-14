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
gaffer_slugs = [c[0] for c in GAFFER_CATEGORIES]
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
