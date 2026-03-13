"""
20_seed_choices.py — Seed Football Choices questions.

Seeds the fc_questions and fc_options tables with starter questions.
Questions reference people by name (matched to people.id at insert time).

Tier 1: Gateway polls (2-tuple options: name, subtitle)
Tier 2: Identity scenarios (3-tuple options: name, subtitle, dimension_weights)

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

# ── Tier 2 Questions ──────────────────────────────────────────────────────────
# Scenario-based questions where every option is a real player.
# Each option: (player_name, subtitle, dimension_weights_dict)
# Dimension weights shift user's identity scores (positive = high end, negative = low end):
#   flair_vs_function:   +flair / -function
#   youth_vs_experience: +youth / -experience
#   attack_vs_defense:   +attack / -defense
#   loyalty_vs_ambition: +loyalty / -ambition
#   domestic_vs_global:  +domestic / -global
#   stats_vs_eye_test:   +stats / -eye_test
#   era_bias:            "modern" / "classic" / "legend"

TIER2_QUESTIONS = [
    # ── TRANSFER SCENARIOS ────────────────────────────────────────────────────

    ("transfer", "Gap at AM. Wage space but no transfer budget. Who on a free?",
     "All available on frees, summer 2026", 2, ["transfers", "free-agents"],
     [("Bernardo Silva", "Man City, 31, free agent",
       {"flair_vs_function": -10, "youth_vs_experience": -15, "stats_vs_eye_test": 10}),
      ("Harry Wilson", "Fulham, 29, free agent",
       {"flair_vs_function": 10, "youth_vs_experience": -5, "domestic_vs_global": 15}),
      ("Julian Brandt", "Dortmund, 29, free agent",
       {"flair_vs_function": 10, "youth_vs_experience": -5, "domestic_vs_global": -10}),
      ("Neymar", "Santos, 34, free agent",
       {"flair_vs_function": 20, "youth_vs_experience": -20, "stats_vs_eye_test": -15})]),

    ("transfer", "You need a centre-back NOW. £60m budget.",
     "Title race, January window", 2, ["transfers", "defenders"],
     [("William Saliba", "Arsenal, 24, rock solid",
       {"youth_vs_experience": 10, "flair_vs_function": -10, "attack_vs_defense": -15}),
      ("Virgil van Dijk", "Liverpool, 34, proven leader",
       {"youth_vs_experience": -20, "flair_vs_function": -10, "loyalty_vs_ambition": 10}),
      ("Joško Gvardiol", "Man City, 24, ball-playing CB",
       {"youth_vs_experience": 10, "flair_vs_function": 10, "domestic_vs_global": -10}),
      ("Leny Yoro", "Man United, 20, raw potential",
       {"youth_vs_experience": 20, "flair_vs_function": 5, "stats_vs_eye_test": -15})]),

    ("transfer", "Striker injured for 3 months. Emergency loan.",
     "Who fills the gap?", 2, ["transfers", "strikers"],
     [("Darwin Núñez", "Liverpool, 26, explosive",
       {"flair_vs_function": 5, "attack_vs_defense": 15, "stats_vs_eye_test": -10}),
      ("Marcus Rashford", "Man United, 28, pace merchant",
       {"flair_vs_function": 5, "youth_vs_experience": -5, "domestic_vs_global": 15}),
      ("Randal Kolo Muani", "PSG, 26, versatile",
       {"flair_vs_function": -10, "domestic_vs_global": -10, "stats_vs_eye_test": 10}),
      ("Joshua Zirkzee", "Man United, 24, false 9",
       {"flair_vs_function": 15, "youth_vs_experience": 10, "stats_vs_eye_test": -10})]),

    ("transfer", "One signing from a relegated team. £15m max.",
     "Bargain hunting in the Championship", 2, ["transfers", "value"],
     [("Joao Pedro", "Brighton, 24, Brazilian flair",
       {"flair_vs_function": 15, "youth_vs_experience": 10, "domestic_vs_global": -10}),
      ("James Maddison", "Tottenham, 29, set-piece specialist",
       {"flair_vs_function": 10, "youth_vs_experience": -10, "domestic_vs_global": 15}),
      ("Dominic Solanke", "Tottenham, 27, reliable 15 goals",
       {"flair_vs_function": -15, "stats_vs_eye_test": 10, "domestic_vs_global": 15}),
      ("Antonee Robinson", "Fulham, 28, marauding left-back",
       {"flair_vs_function": -5, "attack_vs_defense": -10, "domestic_vs_global": -10})]),

    ("transfer", "Your backup left-back is now your starter. Upgrade for £30m?",
     "Who transforms that flank?", 2, ["transfers", "defenders"],
     [("Alphonso Davies", "Real Madrid, 25, jet-heeled",
       {"flair_vs_function": 10, "attack_vs_defense": 15, "youth_vs_experience": 10}),
      ("Theo Hernández", "AC Milan, 28, goal threat",
       {"attack_vs_defense": 20, "flair_vs_function": 5, "domestic_vs_global": -10}),
      ("Nuno Mendes", "PSG, 23, modern full-back",
       {"youth_vs_experience": 15, "attack_vs_defense": 5, "domestic_vs_global": -10}),
      ("Andy Robertson", "Liverpool, 32, relentless engine",
       {"flair_vs_function": -15, "youth_vs_experience": -15, "loyalty_vs_ambition": 15})]),

    ("transfer", "January window. Top 4 race. One signing to push you over the line.",
     "Win-now mode", 2, ["transfers", "strategy"],
     [("Bruno Fernandes", "Man United, 31, instant impact",
       {"flair_vs_function": 10, "youth_vs_experience": -10, "attack_vs_defense": 10}),
      ("Rodri", "Man City, 29, midfield anchor",
       {"flair_vs_function": -20, "attack_vs_defense": -15, "stats_vs_eye_test": 15}),
      ("Mohamed Salah", "Liverpool, 33, 20 goals guaranteed",
       {"attack_vs_defense": 20, "youth_vs_experience": -15, "stats_vs_eye_test": 10}),
      ("Moisés Caicedo", "Chelsea, 24, all-action midfielder",
       {"youth_vs_experience": 15, "flair_vs_function": -10, "stats_vs_eye_test": 10})]),

    ("transfer", "Sell-to-buy: move on your 30yo winger to fund a younger model?",
     "Short-term pain for long-term gain?", 2, ["transfers", "strategy"],
     [("Bukayo Saka", "Arsenal, 24, franchise player",
       {"youth_vs_experience": 15, "loyalty_vs_ambition": 10, "flair_vs_function": 5}),
      ("Vinícius Jr", "Real Madrid, 25, game-changer",
       {"flair_vs_function": 20, "loyalty_vs_ambition": -10, "domestic_vs_global": -15}),
      ("Phil Foden", "Man City, 25, homegrown star",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 10, "domestic_vs_global": 15}),
      ("Rafael Leão", "AC Milan, 26, raw pace and skill",
       {"flair_vs_function": 15, "stats_vs_eye_test": -15, "domestic_vs_global": -10})]),

    ("transfer", "Your rival just signed your #1 target. Plan B?",
     "Who's your alternative?", 2, ["transfers", "scouting"],
     [("Florian Wirtz", "Leverkusen, 22, generational talent",
       {"youth_vs_experience": 15, "flair_vs_function": 15, "domestic_vs_global": -10}),
      ("Martin Ødegaard", "Arsenal, 27, captain and creator",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 10, "youth_vs_experience": 5}),
      ("Jamal Musiala", "Bayern Munich, 22, dribbling genius",
       {"youth_vs_experience": 15, "flair_vs_function": 20, "stats_vs_eye_test": -10}),
      ("Cole Palmer", "Chelsea, 23, ice cold finisher",
       {"youth_vs_experience": 15, "flair_vs_function": 5, "domestic_vs_global": 15})]),

    ("transfer", "Free agent goalkeeper for a title-challenging team.",
     "Keeper market is thin", 2, ["transfers", "goalkeeper"],
     [("Keylor Navas", "Free agent, 39, CL pedigree",
       {"youth_vs_experience": -20, "loyalty_vs_ambition": -5, "stats_vs_eye_test": -10}),
      ("André Onana", "Man United, 29, ball-playing keeper",
       {"flair_vs_function": 10, "domestic_vs_global": -10, "stats_vs_eye_test": -5}),
      ("Ederson", "Man City, 32, sweeper keeper",
       {"flair_vs_function": 15, "youth_vs_experience": -10, "attack_vs_defense": 5}),
      ("Diogo Costa", "Porto, 26, shot-stopper",
       {"youth_vs_experience": 10, "domestic_vs_global": -15, "flair_vs_function": -10})]),

    ("transfer", "18-year-old wonderkid for £50m or 28-year-old international for £25m?",
     "Same position, same need", 2, ["transfers", "philosophy"],
     [("Lamine Yamal", "Barcelona, 18, once in a generation",
       {"youth_vs_experience": 20, "flair_vs_function": 15, "stats_vs_eye_test": -15}),
      ("Pedri", "Barcelona, 22, already world class",
       {"youth_vs_experience": 10, "flair_vs_function": 10, "stats_vs_eye_test": 5}),
      ("Declan Rice", "Arsenal, 27, guaranteed 8/10",
       {"youth_vs_experience": -10, "flair_vs_function": -15, "stats_vs_eye_test": 15}),
      ("N'Golo Kanté", "Al-Ittihad, 35, proven winner",
       {"youth_vs_experience": -20, "flair_vs_function": -10, "loyalty_vs_ambition": -10})]),

    ("transfer", "You can raid ONE club in the world. Which squad do you pick from?",
     "Take any 3 players", 2, ["transfers", "squad-building"],
     [("Real Madrid", "Bellingham, Vinícius, Mbappé",
       {"loyalty_vs_ambition": -15, "flair_vs_function": 15, "domestic_vs_global": -15}),
      ("Arsenal", "Saka, Saliba, Rice",
       {"loyalty_vs_ambition": 10, "flair_vs_function": -5, "domestic_vs_global": 10}),
      ("Man City", "Haaland, Foden, Rodri",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15, "domestic_vs_global": 5}),
      ("Barcelona", "Yamal, Pedri, Gavi",
       {"youth_vs_experience": 20, "flair_vs_function": 15, "domestic_vs_global": -10})]),

    ("transfer", "Your 35-year-old club legend wants a new contract. One more year?",
     "Heart vs head", 2, ["transfers", "loyalty"],
     [("Luka Modrić", "Real Madrid, 40, still dictating play",
       {"loyalty_vs_ambition": 15, "youth_vs_experience": -20, "flair_vs_function": 10}),
      ("Sergio Busquets", "Inter Miami, 37, positional genius",
       {"loyalty_vs_ambition": 10, "youth_vs_experience": -20, "flair_vs_function": -10}),
      ("Thiago Silva", "Fluminense, 41, defensive master",
       {"loyalty_vs_ambition": 15, "youth_vs_experience": -20, "attack_vs_defense": -15}),
      ("Robert Lewandowski", "Barcelona, 37, still scoring",
       {"loyalty_vs_ambition": -5, "youth_vs_experience": -20, "attack_vs_defense": 15})]),

    # ── BENCH & PRESSURE DECISIONS ────────────────────────────────────────────

    ("pressure", "15 minutes left. You need 2 goals or the season's over. Off the bench?",
     "Who changes everything?", 2, ["clutch", "strikers"],
     [("Ole Gunnar Solskjær", "Man United, super sub legend",
       {"flair_vs_function": -5, "stats_vs_eye_test": -15, "loyalty_vs_ambition": 15}),
      ("Erling Haaland", "Man City, pure goalscoring machine",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15, "attack_vs_defense": 15}),
      ("Robert Lewandowski", "Barcelona, 5 goals in 9 minutes",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15, "youth_vs_experience": -15}),
      ("Harry Kane", "Bayern Munich, big-game finisher",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15, "domestic_vs_global": -5})]),

    ("pressure", "CL final, 0-0 at half-time. Your number 10 is invisible. Replace with?",
     "Biggest decision of your career", 2, ["clutch", "midfield"],
     [("Kevin De Bruyne", "Man City, creates from nothing",
       {"flair_vs_function": 10, "stats_vs_eye_test": 10, "attack_vs_defense": 10}),
      ("Luka Modrić", "Real Madrid, controls the tempo",
       {"flair_vs_function": 10, "youth_vs_experience": -15, "stats_vs_eye_test": -10}),
      ("Bruno Fernandes", "Man United, risk-taker",
       {"flair_vs_function": 15, "attack_vs_defense": 15, "stats_vs_eye_test": -5}),
      ("İlkay Gündoğan", "Barcelona, calm under pressure",
       {"flair_vs_function": -10, "youth_vs_experience": -10, "stats_vs_eye_test": 5})]),

    ("pressure", "Winning 2-1, they've just brought on Mbappé. Shore up?",
     "Protect the lead", 2, ["clutch", "defenders"],
     [("Virgil van Dijk", "Liverpool, commanding presence",
       {"attack_vs_defense": -20, "youth_vs_experience": -10, "flair_vs_function": -10}),
      ("Rúben Dias", "Man City, organisational leader",
       {"attack_vs_defense": -15, "flair_vs_function": -15, "stats_vs_eye_test": 10}),
      ("Marquinhos", "PSG, reads the game",
       {"attack_vs_defense": -15, "domestic_vs_global": -10, "flair_vs_function": -10}),
      ("Antonio Rüdiger", "Real Madrid, aggressive stopper",
       {"attack_vs_defense": -15, "flair_vs_function": -5, "domestic_vs_global": -10})]),

    ("pressure", "Penalty shootout, 5th taker. Everything on the line.",
     "Ice in the veins", 2, ["clutch", "penalties"],
     [("Jorginho", "Chelsea/Arsenal, the hop-skip-jump",
       {"flair_vs_function": 10, "stats_vs_eye_test": -10, "attack_vs_defense": -5}),
      ("Bruno Fernandes", "Man United, never misses",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10, "attack_vs_defense": 10}),
      ("Zinedine Zidane", "France, panenka in a World Cup final",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "youth_vs_experience": -15}),
      ("Robert Lewandowski", "Barcelona, clinical finisher",
       {"flair_vs_function": -15, "stats_vs_eye_test": 15, "youth_vs_experience": -10})]),

    ("pressure", "Free kick, 25 yards, last minute of the cup final.",
     "One chance. One kick.", 2, ["clutch", "set-pieces"],
     [("Juninho", "Lyon, greatest free kick taker ever",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "domestic_vs_global": -10}),
      ("David Beckham", "England, that Greece free kick",
       {"flair_vs_function": 10, "stats_vs_eye_test": -10, "domestic_vs_global": 10}),
      ("Lionel Messi", "Argentina, left foot from God",
       {"flair_vs_function": 15, "stats_vs_eye_test": 5, "domestic_vs_global": -10}),
      ("James Ward-Prowse", "West Ham, modern set-piece king",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15, "domestic_vs_global": 15})]),

    ("pressure", "Red card at 0-0, 60 minutes left. Who comes off?",
     "Sacrifice a player to survive", 2, ["tactical", "pressure"],
     [("Mohamed Salah", "Liverpool, your main goal threat",
       {"attack_vs_defense": -20, "flair_vs_function": -10, "stats_vs_eye_test": 10}),
      ("Bukayo Saka", "Arsenal, creative spark",
       {"attack_vs_defense": -15, "flair_vs_function": -10, "youth_vs_experience": 10}),
      ("Bernardo Silva", "Man City, workrate + quality",
       {"attack_vs_defense": -5, "flair_vs_function": -5, "stats_vs_eye_test": 5}),
      ("Bruno Fernandes", "Man United, high risk high reward",
       {"attack_vs_defense": -10, "flair_vs_function": 10, "stats_vs_eye_test": -5})]),

    ("pressure", "Opposition parking the bus. 0-0 with 30 minutes left. Bring on?",
     "Unlock the defence", 2, ["tactical", "substitutions"],
     [("Jack Grealish", "Man City, draws fouls and creates chaos",
       {"flair_vs_function": 20, "attack_vs_defense": 10, "stats_vs_eye_test": -15}),
      ("Erling Haaland", "Man City, just put it in the box",
       {"flair_vs_function": -15, "attack_vs_defense": 15, "stats_vs_eye_test": 15}),
      ("Vinícius Jr", "Real Madrid, 1v1 nightmare",
       {"flair_vs_function": 20, "attack_vs_defense": 15, "domestic_vs_global": -10}),
      ("Trent Alexander-Arnold", "Liverpool, whip it in from deep",
       {"flair_vs_function": 10, "attack_vs_defense": 5, "domestic_vs_global": 15})]),

    ("pressure", "Pre-season friendly: your keeper gets injured in the warm-up. No sub keeper.",
     "Outfield player in goal. Who volunteers?", 1, ["hypothetical", "goalkeeper"],
     [("John Terry", "Chelsea, would die for the shirt",
       {"loyalty_vs_ambition": 15, "flair_vs_function": -15, "attack_vs_defense": -10}),
      ("Rio Ferdinand", "Man United, natural athlete",
       {"flair_vs_function": -5, "stats_vs_eye_test": -10, "youth_vs_experience": -10}),
      ("Vincent Kompany", "Man City, captain fantastic",
       {"loyalty_vs_ambition": 15, "flair_vs_function": -10, "attack_vs_defense": -10}),
      ("Wayne Rooney", "Man United, done everything",
       {"flair_vs_function": 5, "loyalty_vs_ambition": 10, "attack_vs_defense": 5})]),

    ("pressure", "Injury-time winner ruled out by VAR. You're the manager. Post-match interview?",
     "Which legend would you channel?", 1, ["culture", "pressure"],
     [("Sir Alex Ferguson", "Man United, hairdryer incoming",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 15, "attack_vs_defense": 10}),
      ("Pep Guardiola", "Man City, tactical monologue",
       {"flair_vs_function": 10, "stats_vs_eye_test": 15, "domestic_vs_global": -10}),
      ("Jürgen Klopp", "Liverpool, passionate but fair",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 10, "attack_vs_defense": 10}),
      ("José Mourinho", "Special One, burn it all down",
       {"flair_vs_function": -5, "loyalty_vs_ambition": -15, "attack_vs_defense": -10})]),

    # ── SQUAD BUILDING ────────────────────────────────────────────────────────

    ("squad-building", "Build your midfield 3: pick the anchor.",
     "The one who makes everyone else better", 2, ["midfield", "squad-building"],
     [("Rodri", "Man City, positional perfection",
       {"flair_vs_function": -20, "stats_vs_eye_test": 15, "attack_vs_defense": -15}),
      ("Casemiro", "Man United, destroyer",
       {"flair_vs_function": -15, "youth_vs_experience": -15, "attack_vs_defense": -20}),
      ("Declan Rice", "Arsenal, box-to-box evolution",
       {"flair_vs_function": -10, "youth_vs_experience": 5, "domestic_vs_global": 15}),
      ("Joshua Kimmich", "Bayern Munich, Swiss army knife",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10, "domestic_vs_global": -10})]),

    ("squad-building", "Your captain just retired. New armband goes to?",
     "Leadership defines culture", 2, ["squad-building", "captaincy"],
     [("Virgil van Dijk", "Liverpool, presence and authority",
       {"flair_vs_function": -10, "loyalty_vs_ambition": 10, "attack_vs_defense": -10}),
      ("Martin Ødegaard", "Arsenal, leads by example",
       {"flair_vs_function": 10, "youth_vs_experience": 5, "loyalty_vs_ambition": 10}),
      ("Bruno Fernandes", "Man United, wears heart on sleeve",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 5, "attack_vs_defense": 10}),
      ("Jude Bellingham", "Real Madrid, born leader at 22",
       {"youth_vs_experience": 15, "loyalty_vs_ambition": -10, "flair_vs_function": 10})]),

    ("squad-building", "Pick the winger who defines your team's identity.",
     "Your style starts from the flanks", 2, ["squad-building", "wingers"],
     [("Bukayo Saka", "Arsenal, reliable and clinical",
       {"flair_vs_function": -5, "youth_vs_experience": 10, "domestic_vs_global": 15}),
      ("Vinícius Jr", "Real Madrid, unstoppable on the ball",
       {"flair_vs_function": 20, "domestic_vs_global": -15, "stats_vs_eye_test": -10}),
      ("Leroy Sané", "Bayern Munich, devastating pace",
       {"flair_vs_function": 10, "domestic_vs_global": -10, "attack_vs_defense": 10}),
      ("Federico Chiesa", "Juventus, warrior mentality",
       {"flair_vs_function": 5, "loyalty_vs_ambition": 10, "domestic_vs_global": -10})]),

    ("squad-building", "Best keeper for a possession team?",
     "First pass starts with the goalkeeper", 2, ["squad-building", "goalkeeper"],
     [("Ederson", "Man City, outfield player in disguise",
       {"flair_vs_function": 15, "attack_vs_defense": 5, "stats_vs_eye_test": 10}),
      ("Manuel Neuer", "Bayern Munich, invented sweeper-keeper",
       {"flair_vs_function": 15, "youth_vs_experience": -15, "domestic_vs_global": -10}),
      ("Alisson", "Liverpool, complete goalkeeper",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10, "domestic_vs_global": -5}),
      ("Marc-André ter Stegen", "Barcelona, Cruyffian keeper",
       {"flair_vs_function": 15, "loyalty_vs_ambition": 10, "domestic_vs_global": -10})]),

    ("squad-building", "Your playmaker: creator or controller?",
     "The player who dictates your rhythm", 2, ["squad-building", "midfield"],
     [("Kevin De Bruyne", "Man City, killer through balls",
       {"flair_vs_function": 10, "attack_vs_defense": 15, "stats_vs_eye_test": 10}),
      ("Toni Kroos", "Real Madrid (retired), metronome",
       {"flair_vs_function": -10, "attack_vs_defense": -5, "stats_vs_eye_test": 10}),
      ("Bruno Fernandes", "Man United, chaos creator",
       {"flair_vs_function": 15, "attack_vs_defense": 15, "stats_vs_eye_test": -10}),
      ("Martin Ødegaard", "Arsenal, press-resistant orchestrator",
       {"flair_vs_function": 10, "attack_vs_defense": 5, "stats_vs_eye_test": 5})]),

    ("squad-building", "Centre-back partnership for the next 5 years?",
     "The foundation of everything", 2, ["squad-building", "defenders"],
     [("Saliba & Gabriel", "Arsenal, athletic and dominant",
       {"youth_vs_experience": 10, "domestic_vs_global": 5, "attack_vs_defense": -15}),
      ("Gvardiol & Dias", "Man City, composed on the ball",
       {"flair_vs_function": 5, "domestic_vs_global": -10, "stats_vs_eye_test": 10}),
      ("Bastoni & Calafiori", "Italy, progressive defenders",
       {"flair_vs_function": 10, "domestic_vs_global": -15, "youth_vs_experience": 10}),
      ("Araujo & Kounde", "Barcelona, speed and aggression",
       {"flair_vs_function": -5, "domestic_vs_global": -10, "attack_vs_defense": -10})]),

    ("squad-building", "Wage structure: one superstar or four good players?",
     "Same total cost", 2, ["squad-building", "strategy"],
     [("Kylian Mbappé", "Real Madrid, wins games alone",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -15, "stats_vs_eye_test": -5}),
      ("Declan Rice", "Arsenal, guaranteed consistency",
       {"flair_vs_function": -15, "loyalty_vs_ambition": 5, "stats_vs_eye_test": 15}),
      ("Erling Haaland", "Man City, goals are everything",
       {"attack_vs_defense": 20, "flair_vs_function": -5, "stats_vs_eye_test": 15}),
      ("Pedri", "Barcelona, system player supreme",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 10, "youth_vs_experience": 15})]),

    ("squad-building", "Your defence is ageing. Rebuild or patch?",
     "Average age 31. Champions League quarter-final this year.", 2, ["squad-building", "strategy"],
     [("Leny Yoro", "Man United, 20, project player",
       {"youth_vs_experience": 20, "stats_vs_eye_test": -15, "loyalty_vs_ambition": 5}),
      ("Alessandro Bastoni", "Inter, 26, complete modern CB",
       {"youth_vs_experience": 5, "flair_vs_function": 10, "domestic_vs_global": -10}),
      ("Virgil van Dijk", "Liverpool, 34, one more season",
       {"youth_vs_experience": -20, "loyalty_vs_ambition": 10, "stats_vs_eye_test": -5}),
      ("Castello Lukeba", "Leipzig, 22, flying under the radar",
       {"youth_vs_experience": 15, "stats_vs_eye_test": -15, "domestic_vs_global": -15})]),

    ("squad-building", "Academy graduate or marquee signing for the number 9 shirt?",
     "Your youth system just produced a striker", 2, ["squad-building", "philosophy"],
     [("Viktor Gyökeres", "Sporting, 27, 30+ goals a season",
       {"youth_vs_experience": -5, "stats_vs_eye_test": 10, "domestic_vs_global": -10}),
      ("Lamine Yamal", "Barcelona, 18, generational",
       {"youth_vs_experience": 20, "flair_vs_function": 15, "loyalty_vs_ambition": 10}),
      ("Victor Osimhen", "Napoli, 26, proven goalscorer",
       {"youth_vs_experience": -5, "domestic_vs_global": -15, "attack_vs_defense": 15}),
      ("Benjamin Šeško", "RB Leipzig, 22, raw power",
       {"youth_vs_experience": 15, "flair_vs_function": -5, "domestic_vs_global": -10})]),

    ("squad-building", "Dressing room is fractured. One player to unite the squad?",
     "Character over talent", 2, ["squad-building", "leadership"],
     [("James Milner", "Brighton (retired), Mr Reliable",
       {"flair_vs_function": -20, "loyalty_vs_ambition": 15, "youth_vs_experience": -15}),
      ("Thiago Silva", "Fluminense, quiet authority",
       {"flair_vs_function": -5, "loyalty_vs_ambition": 10, "youth_vs_experience": -20}),
      ("Jordan Henderson", "Ajax, vocal organiser",
       {"flair_vs_function": -15, "loyalty_vs_ambition": 15, "domestic_vs_global": 10}),
      ("Luka Modrić", "Real Madrid, respect from everyone",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 15, "youth_vs_experience": -15})]),

    ("squad-building", "You're managing a new club. First signing sets the culture.",
     "Statement of intent", 2, ["squad-building", "culture"],
     [("Erling Haaland", "Man City, pure ambition",
       {"loyalty_vs_ambition": -15, "attack_vs_defense": 15, "flair_vs_function": -10}),
      ("Bukayo Saka", "Arsenal, humble excellence",
       {"loyalty_vs_ambition": 10, "youth_vs_experience": 10, "flair_vs_function": -5}),
      ("Rodri", "Man City, structure and discipline",
       {"flair_vs_function": -20, "loyalty_vs_ambition": 5, "attack_vs_defense": -15}),
      ("Vinícius Jr", "Real Madrid, box office talent",
       {"flair_vs_function": 20, "loyalty_vs_ambition": -10, "attack_vs_defense": 15})]),

    # ── HISTORICAL / PEAK COMPARISONS ─────────────────────────────────────────

    ("philosophy", "Peak-for-peak, your number 9?",
     "In their absolute prime", 2, ["all-time", "strikers"],
     [("Ronaldo Nazário", "Brazil, unstoppable at Inter",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "youth_vs_experience": -10}),
      ("Thierry Henry", "Arsenal, speed, skill and intelligence",
       {"flair_vs_function": 10, "stats_vs_eye_test": 5, "domestic_vs_global": 5}),
      ("Marco van Basten", "AC Milan, technical perfection",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10, "domestic_vs_global": -10}),
      ("Erling Haaland", "Man City, modern goal machine",
       {"flair_vs_function": -15, "stats_vs_eye_test": 20, "youth_vs_experience": 10})]),

    ("philosophy", "Any midfielder in their prime — who plays for you?",
     "One shirt, any era", 2, ["all-time", "midfield"],
     [("Zinedine Zidane", "France/Real Madrid, the artist",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "youth_vs_experience": -15}),
      ("Xavi", "Spain/Barcelona, the metronome",
       {"flair_vs_function": -5, "stats_vs_eye_test": -5, "loyalty_vs_ambition": 15}),
      ("Steven Gerrard", "Liverpool, could do everything",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 20, "domestic_vs_global": 15}),
      ("Patrick Vieira", "Arsenal, power and grace",
       {"flair_vs_function": -5, "attack_vs_defense": -5, "domestic_vs_global": -10})]),

    ("philosophy", "Best centre-back to ever play?",
     "The rock at the back", 2, ["all-time", "defenders"],
     [("Franz Beckenbauer", "Germany, invented the libero",
       {"flair_vs_function": 15, "stats_vs_eye_test": -15, "youth_vs_experience": -20}),
      ("Paolo Maldini", "AC Milan, 25 years of excellence",
       {"loyalty_vs_ambition": 20, "flair_vs_function": 5, "youth_vs_experience": -15}),
      ("Franco Baresi", "AC Milan, reading the game",
       {"flair_vs_function": -5, "loyalty_vs_ambition": 20, "youth_vs_experience": -20}),
      ("Virgil van Dijk", "Liverpool, modern colossus",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10, "youth_vs_experience": 5})]),

    ("philosophy", "More impactful career?",
     "Legacy, not just ability", 2, ["all-time", "goat"],
     [("Lionel Messi", "Barcelona/PSG/Miami, loyalty then adventure",
       {"loyalty_vs_ambition": 10, "flair_vs_function": 15, "stats_vs_eye_test": 5}),
      ("Cristiano Ronaldo", "Sporting→Man Utd→Real→Juve→Al-Nassr",
       {"loyalty_vs_ambition": -20, "flair_vs_function": -10, "stats_vs_eye_test": 15}),
      ("Zinedine Zidane", "Three peak years that defined football",
       {"flair_vs_function": 20, "stats_vs_eye_test": -20, "youth_vs_experience": -15}),
      ("Diego Maradona", "Hand of God, Goal of the Century",
       {"flair_vs_function": 20, "stats_vs_eye_test": -20, "loyalty_vs_ambition": -5})]),

    ("philosophy", "Greatest team ever assembled?",
     "All-time best XI", 2, ["all-time", "teams"],
     [("Brazil 1970", "Pelé, Jairzinho, Carlos Alberto",
       {"flair_vs_function": 20, "stats_vs_eye_test": -20, "youth_vs_experience": -20}),
      ("Barcelona 2011", "Messi, Xavi, Iniesta, Busquets",
       {"flair_vs_function": 15, "stats_vs_eye_test": 5, "youth_vs_experience": -5}),
      ("Real Madrid 2017", "3 CLs in a row, Ronaldo, Modric",
       {"loyalty_vs_ambition": -10, "flair_vs_function": 5, "stats_vs_eye_test": 5}),
      ("AC Milan 1989", "Baresi, Maldini, Gullit, Van Basten",
       {"flair_vs_function": 5, "attack_vs_defense": -10, "youth_vs_experience": -15})]),

    ("philosophy", "Better duo at their peak?",
     "Two players, perfect chemistry", 2, ["all-time", "partnerships"],
     [("Messi & Neymar", "Barcelona 2015, MSN magic",
       {"flair_vs_function": 20, "attack_vs_defense": 15, "domestic_vs_global": -10}),
      ("Henry & Bergkamp", "Arsenal, beauty in motion",
       {"flair_vs_function": 15, "loyalty_vs_ambition": 15, "domestic_vs_global": 10}),
      ("Ronaldo & Benzema", "Real Madrid, deadly combination",
       {"flair_vs_function": 5, "attack_vs_defense": 15, "loyalty_vs_ambition": -10}),
      ("Suárez & Sturridge", "Liverpool 13/14, chaos football",
       {"flair_vs_function": 10, "attack_vs_defense": 20, "stats_vs_eye_test": -10})]),

    ("philosophy", "Best winger of the modern era?",
     "Since 2000", 2, ["all-time", "wingers"],
     [("Lionel Messi", "Barcelona, the complete player",
       {"flair_vs_function": 15, "stats_vs_eye_test": 10, "loyalty_vs_ambition": 10}),
      ("Cristiano Ronaldo", "Man United/Real Madrid, evolved to goal machine",
       {"flair_vs_function": -5, "stats_vs_eye_test": 15, "loyalty_vs_ambition": -15}),
      ("Neymar", "Santos/Barcelona/PSG, closest to Ronaldinho",
       {"flair_vs_function": 20, "stats_vs_eye_test": -10, "loyalty_vs_ambition": -15}),
      ("Mohamed Salah", "Liverpool, consistency machine",
       {"flair_vs_function": -5, "stats_vs_eye_test": 15, "loyalty_vs_ambition": 10})]),

    ("philosophy", "Who was the bigger loss?",
     "The departure that changed everything", 2, ["loyalty", "transfers"],
     [("Messi leaving Barcelona", "2021, end of an era",
       {"loyalty_vs_ambition": 15, "flair_vs_function": 15, "domestic_vs_global": -10}),
      ("Ronaldo leaving Real Madrid", "2018, to Juventus",
       {"loyalty_vs_ambition": -10, "flair_vs_function": -5, "domestic_vs_global": -5}),
      ("Henry leaving Arsenal", "2007, to Barcelona",
       {"loyalty_vs_ambition": -10, "flair_vs_function": 10, "domestic_vs_global": -10}),
      ("Gerrard almost leaving Liverpool", "2005, the nearly man",
       {"loyalty_vs_ambition": 20, "flair_vs_function": 5, "domestic_vs_global": 15})]),

    ("philosophy", "Best player never to win the Champions League?",
     "World class, no European crown", 2, ["all-time", "what-if"],
     [("George Best", "Man United, talent wasted?",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "youth_vs_experience": -20}),
      ("Gianluigi Buffon", "Juventus, decades of almost",
       {"loyalty_vs_ambition": 20, "flair_vs_function": -10, "youth_vs_experience": -10}),
      ("Zlatan Ibrahimović", "Everywhere except the top",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -15, "domestic_vs_global": -10}),
      ("Harry Kane", "Tottenham/Bayern, nearly man",
       {"flair_vs_function": -10, "stats_vs_eye_test": 15, "loyalty_vs_ambition": -5})]),

    # ── SCOUTING DILEMMAS ─────────────────────────────────────────────────────

    ("scouting", "Two strikers, same age. 20 goals in Ligue 1 vs 12 in the Premier League.",
     "Which output matters more?", 2, ["scouting", "strikers"],
     [("Jonathan David", "Lille, 25, prolific in France",
       {"stats_vs_eye_test": 10, "domestic_vs_global": -15, "flair_vs_function": -5}),
      ("Alexander Isak", "Newcastle, 26, proven in England",
       {"stats_vs_eye_test": -5, "domestic_vs_global": 15, "flair_vs_function": 5}),
      ("Viktor Gyökeres", "Sporting, 27, 30+ in Portugal",
       {"stats_vs_eye_test": 15, "domestic_vs_global": -15, "flair_vs_function": -5}),
      ("Ollie Watkins", "Aston Villa, 29, consistent PL performer",
       {"stats_vs_eye_test": 5, "domestic_vs_global": 15, "flair_vs_function": -10})]),

    ("scouting", "Scout says special. xG says average. Sign?",
     "The eye test vs the numbers", 2, ["scouting", "philosophy"],
     [("Jack Grealish", "Man City, watch him and you see it",
       {"stats_vs_eye_test": -20, "flair_vs_function": 20, "domestic_vs_global": 10}),
      ("Kai Havertz", "Arsenal, the data loves him",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10, "domestic_vs_global": -5}),
      ("Paulo Dybala", "Roma, moments of genius",
       {"stats_vs_eye_test": -15, "flair_vs_function": 15, "domestic_vs_global": -10}),
      ("Diogo Jota", "Liverpool, underrated by stats and eye",
       {"stats_vs_eye_test": 5, "flair_vs_function": -5, "domestic_vs_global": -5})]),

    ("scouting", "Available at 50% value but injury history. Take the risk?",
     "Talent vs durability", 2, ["scouting", "risk"],
     [("Federico Chiesa", "Juventus, 27, devastating when fit",
       {"stats_vs_eye_test": -10, "flair_vs_function": 15, "youth_vs_experience": -5}),
      ("Ousmane Dembélé", "PSG, 28, electric when available",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "loyalty_vs_ambition": -10}),
      ("Naby Keïta", "Werder Bremen, 30, what could have been",
       {"stats_vs_eye_test": -10, "flair_vs_function": 5, "domestic_vs_global": -10}),
      ("Ansu Fati", "Barcelona, 22, the next Messi tag",
       {"youth_vs_experience": 15, "flair_vs_function": 15, "stats_vs_eye_test": -15})]),

    ("scouting", "Unknown league striker, 30 goals. Bring him in?",
     "Is the goalscoring real?", 2, ["scouting", "discovery"],
     [("Victor Boniface", "Leverkusen, broke out from Belgian league",
       {"stats_vs_eye_test": 5, "domestic_vs_global": -15, "youth_vs_experience": 10}),
      ("Arne Slot", "The answer is: always scout in person",
       {"stats_vs_eye_test": -15, "domestic_vs_global": -10, "flair_vs_function": -5}),
      ("Erling Haaland", "Salzburg to Dortmund, everyone could see it",
       {"stats_vs_eye_test": 15, "domestic_vs_global": -10, "youth_vs_experience": 15}),
      ("Darwin Núñez", "Benfica to Liverpool, 34 goals triggered the move",
       {"stats_vs_eye_test": 10, "domestic_vs_global": -10, "flair_vs_function": 5})]),

    ("scouting", "Your data team flags a Championship midfielder as PL quality. Sign sight-unseen?",
     "Trust the algorithm?", 2, ["scouting", "data"],
     [("James Maddison", "Leicester → Tottenham, the obvious one",
       {"stats_vs_eye_test": 10, "domestic_vs_global": 15, "flair_vs_function": 10}),
      ("Eberechi Eze", "QPR → Crystal Palace, the eye test pick",
       {"stats_vs_eye_test": -10, "flair_vs_function": 20, "domestic_vs_global": 15}),
      ("Michael Olise", "Reading → Crystal Palace, data darling",
       {"stats_vs_eye_test": 15, "flair_vs_function": 15, "youth_vs_experience": 10}),
      ("Yves Bissouma", "Brighton → Tottenham, the numbers guy",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10, "domestic_vs_global": -5})]),

    ("scouting", "Two wingers: one dribbles past everyone, poor end product. Other creates from set routines.",
     "Which do you build around?", 2, ["scouting", "style"],
     [("Adama Traoré", "Wolves/Barcelona, unstoppable dribbler",
       {"flair_vs_function": 20, "stats_vs_eye_test": -20, "attack_vs_defense": 10}),
      ("James Ward-Prowse", "West Ham, dead-ball master",
       {"flair_vs_function": -15, "stats_vs_eye_test": 15, "attack_vs_defense": 5}),
      ("Neymar", "At his peak, both in one player",
       {"flair_vs_function": 20, "stats_vs_eye_test": -5, "domestic_vs_global": -10}),
      ("Jarrod Bowen", "West Ham, runs and positions",
       {"flair_vs_function": -10, "stats_vs_eye_test": 10, "domestic_vs_global": 15})]),

    ("scouting", "World Cup breakout star. Sign immediately or wait?",
     "Tournament form vs sustained ability", 2, ["scouting", "timing"],
     [("James Rodríguez", "2014 WC, the Golden Boot",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10, "domestic_vs_global": -10}),
      ("Enzo Fernández", "2022 WC, Best Young Player",
       {"youth_vs_experience": 15, "domestic_vs_global": -10, "stats_vs_eye_test": 5}),
      ("Daichi Kamada", "2022 WC, upset Germany",
       {"domestic_vs_global": -15, "stats_vs_eye_test": -10, "flair_vs_function": -5}),
      ("Kylian Mbappé", "2018 WC, obvious since 17",
       {"youth_vs_experience": 15, "stats_vs_eye_test": 10, "flair_vs_function": 10})]),

    ("scouting", "You're scouting in South America. One ticket home. Who?",
     "Raw talent from the continent", 2, ["scouting", "global"],
     [("Endrick", "Real Madrid, 19, Brazilian prodigy",
       {"youth_vs_experience": 20, "domestic_vs_global": -15, "flair_vs_function": 10}),
      ("Enzo Fernández", "Chelsea, already proven in Europe",
       {"youth_vs_experience": 10, "domestic_vs_global": -10, "stats_vs_eye_test": 5}),
      ("Julián Álvarez", "Atlético Madrid, Pep's utility man",
       {"flair_vs_function": -10, "domestic_vs_global": -10, "stats_vs_eye_test": 10}),
      ("Luis Díaz", "Liverpool, electrifying winger",
       {"flair_vs_function": 15, "domestic_vs_global": -15, "attack_vs_defense": 10})]),

    # ── MANAGER MIND ──────────────────────────────────────────────────────────

    ("manager", "Pre-season: system player or maverick who breaks the system?",
     "Structure vs chaos", 2, ["manager", "philosophy"],
     [("Toni Kroos", "Real Madrid (retired), the system IS him",
       {"flair_vs_function": -15, "stats_vs_eye_test": 10, "loyalty_vs_ambition": 10}),
      ("Neymar", "Everywhere, uncontrollable genius",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "loyalty_vs_ambition": -15}),
      ("Bernardo Silva", "Man City, system-dependent excellence",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10, "loyalty_vs_ambition": 5}),
      ("Jack Grealish", "Man City, doesn't fit the plan but who cares",
       {"flair_vs_function": 15, "stats_vs_eye_test": -15, "domestic_vs_global": 15})]),

    ("manager", "Your star player publicly criticises your tactics. How do you respond?",
     "Channel your inner manager", 2, ["manager", "leadership"],
     [("Pep Guardiola", "Bench him. The system is bigger than anyone.",
       {"flair_vs_function": -15, "loyalty_vs_ambition": -5, "stats_vs_eye_test": 10}),
      ("Carlo Ancelotti", "Arm around the shoulder. Win them back.",
       {"flair_vs_function": 5, "loyalty_vs_ambition": 10, "youth_vs_experience": -5}),
      ("José Mourinho", "Sell him. No one is bigger than the manager.",
       {"loyalty_vs_ambition": -20, "flair_vs_function": -10, "attack_vs_defense": -5}),
      ("Jürgen Klopp", "Clear the air, hug it out, move on.",
       {"loyalty_vs_ambition": 10, "flair_vs_function": 10, "attack_vs_defense": 10})]),

    ("manager", "New job. The board wants you to play a style. Which do you pick?",
     "Your coaching DNA", 2, ["manager", "tactics"],
     [("Tiki-taka", "Possession, patience, positional play",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10, "attack_vs_defense": -5}),
      ("Gegenpressing", "High press, transitions, intensity",
       {"flair_vs_function": -5, "attack_vs_defense": 10, "stats_vs_eye_test": -5}),
      ("Counter-attacking", "Defend deep, strike on the break",
       {"attack_vs_defense": -15, "flair_vs_function": -10, "stats_vs_eye_test": 5}),
      ("Total football", "Everyone attacks, everyone defends",
       {"flair_vs_function": 15, "attack_vs_defense": 5, "stats_vs_eye_test": -10})]),

    ("manager", "You've been sacked. What's your legacy?",
     "How do they remember you?", 2, ["manager", "culture"],
     [("Sir Alex Ferguson", "27 years, dynasty builder",
       {"loyalty_vs_ambition": 20, "youth_vs_experience": 10, "domestic_vs_global": 10}),
      ("Pep Guardiola", "Changed how football is played",
       {"flair_vs_function": 10, "stats_vs_eye_test": 15, "loyalty_vs_ambition": -5}),
      ("Brian Clough", "Took nobodies and won the European Cup",
       {"loyalty_vs_ambition": 15, "stats_vs_eye_test": -15, "youth_vs_experience": -5}),
      ("Arsène Wenger", "Revolutionised English football",
       {"youth_vs_experience": 15, "flair_vs_function": 15, "domestic_vs_global": -10})]),

    ("manager", "End of season. You finished 4th but played the best football.",
     "Do you feel like a failure?", 2, ["manager", "philosophy"],
     [("Marcelo Bielsa", "The process is everything",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "loyalty_vs_ambition": 10}),
      ("Antonio Conte", "Trophies or nothing",
       {"flair_vs_function": -20, "stats_vs_eye_test": 10, "attack_vs_defense": -10}),
      ("Unai Emery", "Improve, adapt, try again",
       {"flair_vs_function": -5, "stats_vs_eye_test": 10, "youth_vs_experience": 5}),
      ("Mauricio Pochettino", "We built something special",
       {"youth_vs_experience": 10, "loyalty_vs_ambition": 10, "flair_vs_function": 5})]),

    # ── FOOTBALL PHILOSOPHY ───────────────────────────────────────────────────

    ("philosophy", "The most important attribute in a footballer?",
     "One quality above all", 2, ["philosophy"],
     [("Lionel Messi", "Vision — seeing what others can't",
       {"flair_vs_function": 15, "stats_vs_eye_test": -10, "attack_vs_defense": 5}),
      ("N'Golo Kanté", "Work rate — the engine that never stops",
       {"flair_vs_function": -20, "stats_vs_eye_test": 5, "attack_vs_defense": -10}),
      ("Sergio Ramos", "Mentality — winning at all costs",
       {"flair_vs_function": -10, "loyalty_vs_ambition": -5, "attack_vs_defense": -10}),
      ("Ronaldinho", "Joy — football should be fun",
       {"flair_vs_function": 20, "stats_vs_eye_test": -20, "attack_vs_defense": 10})]),

    ("philosophy", "You're 1-0 up with 10 minutes left. What's the instruction?",
     "Game management", 2, ["philosophy", "tactics"],
     [("Kevin De Bruyne", "Get the second — kill the game",
       {"attack_vs_defense": 15, "flair_vs_function": 10, "stats_vs_eye_test": 5}),
      ("Virgil van Dijk", "Protect what we have",
       {"attack_vs_defense": -20, "flair_vs_function": -10, "stats_vs_eye_test": 5}),
      ("Rodri", "Control possession, run the clock",
       {"attack_vs_defense": -10, "flair_vs_function": -10, "stats_vs_eye_test": 15}),
      ("Jude Bellingham", "Keep pressing — we don't sit back",
       {"attack_vs_defense": 5, "flair_vs_function": 5, "youth_vs_experience": 10})]),

    ("philosophy", "Which signing philosophy defines you?",
     "How you build a squad", 2, ["philosophy", "transfers"],
     [("Arsenal", "Young, hungry, project players who grow together",
       {"youth_vs_experience": 20, "loyalty_vs_ambition": 10, "stats_vs_eye_test": 5}),
      ("Real Madrid", "Only the biggest names, galáctico mentality",
       {"loyalty_vs_ambition": -20, "flair_vs_function": 15, "domestic_vs_global": -15}),
      ("Liverpool", "Moneyball — find undervalued talent",
       {"stats_vs_eye_test": 20, "domestic_vs_global": -10, "flair_vs_function": -5}),
      ("Athletic Bilbao", "Only homegrown — identity above everything",
       {"loyalty_vs_ambition": 20, "domestic_vs_global": 20, "youth_vs_experience": 10})]),

    ("philosophy", "What makes a player 'world class'?",
     "Your definition of elite", 2, ["philosophy"],
     [("Erling Haaland", "Numbers. Goals. Trophies. End of.",
       {"stats_vs_eye_test": 20, "flair_vs_function": -15, "attack_vs_defense": 10}),
      ("Luka Modrić", "The ability to make everyone around you better",
       {"flair_vs_function": 10, "stats_vs_eye_test": -10, "loyalty_vs_ambition": 10}),
      ("Kylian Mbappé", "Doing it on the biggest stage when it matters",
       {"stats_vs_eye_test": -5, "flair_vs_function": 10, "attack_vs_defense": 15}),
      ("Toni Kroos", "Consistency. 8/10 every single week for a decade",
       {"stats_vs_eye_test": 10, "flair_vs_function": -10, "loyalty_vs_ambition": 5})]),

    ("philosophy", "Football is better when...",
     "Complete the sentence", 1, ["philosophy", "culture"],
     [("Ronaldinho", "...players express themselves freely",
       {"flair_vs_function": 20, "stats_vs_eye_test": -15, "attack_vs_defense": 10}),
      ("Atlético Madrid", "...the underdog wins through grit",
       {"flair_vs_function": -15, "attack_vs_defense": -10, "loyalty_vs_ambition": 15}),
      ("Ajax Academy", "...young players get their chance",
       {"youth_vs_experience": 20, "loyalty_vs_ambition": 10, "domestic_vs_global": -10}),
      ("Liverpool vs Man City", "...the rivalry pushes both teams to the limit",
       {"attack_vs_defense": 10, "flair_vs_function": 5, "domestic_vs_global": 15})]),

    ("philosophy", "The best football league in the world?",
     "Where quality lives", 2, ["philosophy", "leagues"],
     [("Premier League", "Pace, power, any given Saturday",
       {"domestic_vs_global": 15, "flair_vs_function": -5, "attack_vs_defense": 10}),
      ("La Liga", "Technical quality, tactical chess",
       {"domestic_vs_global": -10, "flair_vs_function": 15, "stats_vs_eye_test": 5}),
      ("Serie A", "Tactical mastery, defensive arts",
       {"domestic_vs_global": -10, "attack_vs_defense": -15, "flair_vs_function": -5}),
      ("Bundesliga", "Atmosphere, youth development, pressing",
       {"domestic_vs_global": -10, "youth_vs_experience": 10, "attack_vs_defense": 10})]),

    ("philosophy", "VAR is...",
     "Technology in football", 1, ["philosophy", "culture"],
     [("Arsène Wenger", "...the future. Get every decision right.",
       {"stats_vs_eye_test": 15, "flair_vs_function": -10}),
      ("Roy Keane", "...ruining the game. Let the ref decide.",
       {"stats_vs_eye_test": -20, "flair_vs_function": 10, "youth_vs_experience": -10}),
      ("Pep Guardiola", "...good in theory, terrible in execution.",
       {"stats_vs_eye_test": 5, "flair_vs_function": 5}),
      ("Diego Simeone", "...irrelevant. Winning is all that matters.",
       {"flair_vs_function": -15, "attack_vs_defense": -10, "stats_vs_eye_test": -5})]),

    # ── MORE TRANSFER/SCOUTING ────────────────────────────────────────────────

    ("transfer", "Summer window. You've got £150m. How do you spend it?",
     "One Mbappé or five solid starters?", 2, ["transfers", "strategy"],
     [("Kylian Mbappé", "One generational talent changes everything",
       {"flair_vs_function": 15, "loyalty_vs_ambition": -10, "youth_vs_experience": 5}),
      ("Five £30m players", "Depth wins titles",
       {"flair_vs_function": -10, "stats_vs_eye_test": 10, "loyalty_vs_ambition": 5}),
      ("Three £50m starters", "Balance of quality and depth",
       {"flair_vs_function": 0, "stats_vs_eye_test": 5, "loyalty_vs_ambition": 0}),
      ("£100m on two + £50m for the academy", "Win now, build for later",
       {"youth_vs_experience": 10, "loyalty_vs_ambition": 10, "stats_vs_eye_test": 5})]),

    ("scouting", "Two number 10s available. Same price. Who transforms your team?",
     "Different profiles, same role", 2, ["scouting", "midfield"],
     [("Martin Ødegaard", "Arsenal, metronomic press-resistant creator",
       {"flair_vs_function": 5, "stats_vs_eye_test": 10, "loyalty_vs_ambition": 10}),
      ("Jamal Musiala", "Bayern Munich, dribbling through lines",
       {"flair_vs_function": 15, "youth_vs_experience": 15, "stats_vs_eye_test": -10}),
      ("Phil Foden", "Man City, finds pockets of space",
       {"flair_vs_function": 10, "domestic_vs_global": 15, "loyalty_vs_ambition": 10}),
      ("Florian Wirtz", "Leverkusen, the complete package",
       {"youth_vs_experience": 15, "flair_vs_function": 10, "domestic_vs_global": -10})]),

    ("pressure", "Champions League semi-final. You're 2-0 down from the first leg.",
     "Pick the player who leads the comeback", 2, ["clutch", "pressure"],
     [("Steven Gerrard", "Liverpool, Istanbul 2005",
       {"flair_vs_function": 10, "loyalty_vs_ambition": 20, "stats_vs_eye_test": -15}),
      ("Cristiano Ronaldo", "Real Madrid, hat-trick merchant",
       {"stats_vs_eye_test": 10, "loyalty_vs_ambition": -10, "attack_vs_defense": 15}),
      ("Lionel Messi", "Barcelona, 6-1 vs PSG",
       {"flair_vs_function": 15, "stats_vs_eye_test": 5, "attack_vs_defense": 15}),
      ("Lucas Moura", "Tottenham, that night in Amsterdam",
       {"flair_vs_function": 5, "stats_vs_eye_test": -15, "youth_vs_experience": -5})]),

    ("squad-building", "Your team needs a complete reset. Which model do you follow?",
     "Rebuild philosophy", 2, ["squad-building", "philosophy"],
     [("Dortmund model", "Buy young, develop, sell high, repeat",
       {"youth_vs_experience": 20, "stats_vs_eye_test": 10, "domestic_vs_global": -10}),
      ("Chelsea model", "Spend big, hire the best, win now",
       {"loyalty_vs_ambition": -15, "youth_vs_experience": -10, "flair_vs_function": 5}),
      ("Arsenal model", "Process, culture, patience, breakthrough",
       {"youth_vs_experience": 15, "loyalty_vs_ambition": 10, "flair_vs_function": -5}),
      ("Athletic Bilbao model", "Only locals, identity is everything",
       {"loyalty_vs_ambition": 20, "domestic_vs_global": 20, "youth_vs_experience": 10})]),
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

# ── Combine all questions ──────────────────────────────────────────────────────

ALL_QUESTIONS = [(q, 1) for q in QUESTIONS] + [(q, 2) for q in TIER2_QUESTIONS]

# ── Insert questions ─────────────────────────────────────────────────────────

inserted = 0
skipped = 0
missing_persons = []

for (cat_slug, question_text, subtitle, difficulty, tags, options), tier in ALL_QUESTIONS:
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
        print(f"  [dry-run] T{tier} {cat_slug}: {question_text}")
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
    """, (cat_id, question_text, subtitle, len(options), difficulty, tags, tier))
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
