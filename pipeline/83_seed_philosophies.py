#!/usr/bin/env python3
"""
Seed tactical philosophies, tactical systems, system slots, and slot roles.

10 named philosophies drawn from Inverting the Pyramid, each with visible lineage,
prophets and disciples, and real names football people use.

28 tactical systems across the 10 philosophies, each with ~11 slots and default roles.
41 roles total, differentiated by position + model compound.

Usage:
    python pipeline/83_seed_philosophies.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── 10 Tactical Philosophies ─────────────────────────────────────────────────

PHILOSOPHIES = [
    {
        "name": "Garra Charrúa",
        "slug": "garra_charrua",
        "tagline": "Football is a fight. Spirit, sacrifice, collective will over individual talent.",
        "origin_story": (
            "Born in the mud of Montevideo's Estadio Centenario, 1930. Uruguay — a nation of three million — "
            "won the first World Cup by refusing to lose. José Nasazzi, the captain who played with a broken rib. "
            "Obdulio Varela, who in the 1950 Maracanazo took the ball from the net after Brazil scored, walked "
            "slowly to the centre circle, and told his teammates: 'The game starts now.' They won 2-1. "
            "Garra Charrúa is not a tactical system — it is a belief that will defeats skill, that the smaller "
            "nation can beat the empire if it fights harder. Óscar Tabárez rebuilt this philosophy for the "
            "modern era, reaching the 2010 semi-finals with disciplined defending and Luis Suárez's infamous "
            "handball — an act of pure garra. It runs through Diego Godín's headers, Forlán's thunder, "
            "and every Uruguayan player who treats a friendly like a cup final."
        ),
        "key_principles": [
            "Never beaten until the whistle",
            "Collective sacrifice over individual brilliance",
            "Physical and mental toughness as non-negotiable",
            "Controlled aggression in the tackle",
            "Defensive resilience as foundation",
        ],
        "defining_managers": ["Nasazzi", "Varela", "Tabárez", "Mazurkiewicz"],
        "era": "1930-present",
        "archetype_requirements": {"Destroyer": 55, "Powerhouse": 50, "Commander": 50, "Cover": 45},
        "personality_preferences": {"C": 0.8, "L": 0.6},
        "preferred_tags": [
            "Controlled Aggressor", "Deep Defender", "Cover Shadow",
            "Compactor", "Recoverer", "Big Game Player",
        ],
        "concern_tags": ["Luxury Player", "Tempo Setter", "Drop Deep Creator"],
        "key_attributes": ["tackling", "aggression", "stamina", "leadership"],
        "possession_orientation": 3,
        "pressing_intensity": 5,
        "directness": 6,
        "defensive_depth": 7,
        "width_emphasis": 4,
        "fluidity": 3,
    },
    {
        "name": "Catenaccio",
        "slug": "catenaccio",
        "tagline": "The lock. Defensive organisation as art. Concede nothing, punish everything.",
        "origin_story": (
            "The Swiss invented it — Karl Rappan's verrou (bolt) in the 1930s, a spare man behind the defence. "
            "But the Italians perfected it. Nereo Rocco at Padova and then AC Milan weaponised defensive solidity "
            "into a European Cup-winning philosophy. Helenio Herrera's Grande Inter (1963-66) made it infamous: "
            "Tarcisio Burgnich and Giacinto Facchetti at the back, Armando Picchi as the libero, Sandro Mazzola "
            "as the counter-attacking dagger. They won two European Cups conceding almost nothing. "
            "The genius of catenaccio was misunderstood — it was not negative football but disciplined football. "
            "Facchetti was the first attacking full-back, overlapping 60 years before Trent Alexander-Arnold. "
            "The philosophy says: make yourself impossible to beat, then strike with precision. Trapattoni carried "
            "it to Juventus. Capello refined it at Milan. It lives in every Italian side that wins 1-0 and "
            "celebrates like they've won the World Cup."
        ),
        "key_principles": [
            "Defensive organisation above all",
            "The libero — spare man behind the line",
            "Counter-attack as primary offensive weapon",
            "Tactical discipline over individual expression",
            "Clinical finishing from few chances",
        ],
        "defining_managers": ["Rappan", "Rocco", "Herrera", "Trapattoni", "Capello"],
        "era": "1950s-1990s",
        "archetype_requirements": {"Cover": 60, "Destroyer": 55, "Commander": 50, "Controller": 45},
        "personality_preferences": {"A": 0.6, "L": 0.6, "P": 0.5},
        "preferred_tags": [
            "Deep Defender", "Cover Shadow", "Compactor", "Controlled Aggressor",
            "High Line Defender", "Tactical Fouler",
        ],
        "concern_tags": ["Press Trigger", "Counter-Press Leader", "Width Provider"],
        "key_attributes": ["positioning", "marking", "tackling", "discipline"],
        "possession_orientation": 3,
        "pressing_intensity": 3,
        "directness": 7,
        "defensive_depth": 9,
        "width_emphasis": 4,
        "fluidity": 2,
    },
    {
        "name": "Joga Bonito",
        "slug": "joga_bonito",
        "tagline": "Football is joy. Individual expression within the collective. The beautiful game.",
        "origin_story": (
            "It started on the beaches of Rio and the futsal courts of São Paulo. When Brazil unveiled the 4-2-4 "
            "at the 1958 World Cup, the world saw football as art for the first time. Zagallo — the first tactical "
            "winger, dropping deep then arriving late — was the prototype of the inverted forward. Pelé was 17. "
            "Garrincha dribbled past five men because it made him happy. By 1970, Brazil had perfected the form: "
            "Gérson as the deep regista, Rivellino floating between the lines, Tostão as a false nine before "
            "the term existed, Jairzinho scoring in every game. Sócrates and Corinthians Democracy in the 1980s "
            "proved it was a political philosophy too — football as liberation. Ronaldinho at Barcelona (2003-06) "
            "was its modern peak: the elastico, the no-look pass, the standing ovation at the Bernabéu. "
            "Joga Bonito says: football exists to create beauty. Winning is the consequence of playing with joy."
        ),
        "key_principles": [
            "Individual expression within collective framework",
            "Skill and creativity as primary weapons",
            "Joy and spontaneity over rigid structure",
            "Attacking football as moral imperative",
            "Improvisation in the final third",
        ],
        "defining_managers": ["Zagallo", "Telê Santana", "Sócrates", "Ronaldinho", "Pelé"],
        "era": "1958-present",
        "archetype_requirements": {"Dribbler": 60, "Creator": 55, "Striker": 50, "Sprinter": 45},
        "personality_preferences": {"I": 0.6, "X": 0.5},
        "preferred_tags": [
            "Ball Progressor", "Line Breaker", "Link-Up Artist",
            "Flair Player", "Width Provider", "Set-Piece Delivery",
        ],
        "concern_tags": ["Deep Defender", "Compactor", "Positional Anchor"],
        "key_attributes": ["skills", "creativity", "first_touch", "take_ons"],
        "possession_orientation": 6,
        "pressing_intensity": 4,
        "directness": 5,
        "defensive_depth": 4,
        "width_emphasis": 7,
        "fluidity": 8,
    },
    {
        "name": "Total Football",
        "slug": "total_football",
        "tagline": "Every player can play every position. The team is a fluid organism.",
        "origin_story": (
            "Rinus Michels didn't invent Total Football — he systematised what Ajax's youth academy had been "
            "cultivating since the 1960s. The idea: if every player understands every position, the team becomes "
            "impossible to mark. When Cruyff dropped deep, the centre-back pushed up. When the left-back attacked, "
            "the left winger covered. The Netherlands at the 1974 World Cup played the most revolutionary football "
            "ever seen — they didn't win, but they changed everything. Ernst Happel took the principles to Club "
            "Brugge and Feyenoord. Van Gaal codified it into a system at Ajax in the 1990s — his 3-position rule "
            "(every player must be able to play three positions) became gospel. Total Football's true legacy is "
            "not the Netherlands of 1974 but the idea that positional rigidity is a prison. When the structure is "
            "understood deeply enough, it can be broken — and that breaking creates superiority."
        ),
        "key_principles": [
            "Positional interchange — any player, any position",
            "Compressing and expanding the pitch as a unit",
            "Technical universality as minimum requirement",
            "The team as organism, not collection of parts",
            "Pressing as collective act of spatial control",
        ],
        "defining_managers": ["Michels", "Cruyff", "Happel", "Van Gaal"],
        "era": "1970s-present",
        "archetype_requirements": {"Engine": 50, "Passer": 50, "Controller": 50, "Dribbler": 45},
        "personality_preferences": {"A": 0.5, "N": 0.6},
        "preferred_tags": [
            "Ball Progressor", "Press Resistant", "Inverted Player",
            "Line Breaker", "Counter-Press Leader", "Two-Footed",
        ],
        "concern_tags": ["Positional Anchor", "Deep Defender"],
        "key_attributes": ["versatility", "vision", "decisions", "stamina"],
        "possession_orientation": 7,
        "pressing_intensity": 7,
        "directness": 5,
        "defensive_depth": 4,
        "width_emphasis": 6,
        "fluidity": 10,
    },
    {
        "name": "La Masia",
        "slug": "la_masia",
        "tagline": "Positional play from the academy up. The ball is the best defender.",
        "origin_story": (
            "Johan Cruyff arrived at Barcelona in 1988 and planted a seed that would take twenty years to bloom. "
            "He restructured the youth academy — La Masia, the farmhouse next to Camp Nou — around one principle: "
            "every team, from Under-8s to the first team, plays the same way. 4-3-3, positional play, the ball "
            "always on the ground. Guardiola was his first disciple — a midfielder so slight he could barely head "
            "the ball, but who understood space better than anyone alive. When Guardiola returned as manager in "
            "2008, La Masia produced Xavi, Iniesta, Messi, Busquets, Pedro, Puyol. The team that won everything "
            "between 2008-2012 was not bought — it was grown. Xavi's 150 passes per game. Iniesta's ability to "
            "receive in impossible spaces. Messi as false nine against Real Madrid, a position that didn't exist "
            "until that night. Third-man combinations — the idea that the pass after the pass after the pass is "
            "the one that kills you. Xavi continued it as manager. Luis Enrique adapted it. The philosophy says: "
            "if you have the ball, they cannot score."
        ),
        "key_principles": [
            "Positional superiority — always outnumber in the zone",
            "The ball as primary defensive weapon",
            "Third-man combinations as attacking mechanism",
            "Academy as philosophical conveyor belt",
            "Technical excellence as non-negotiable baseline",
        ],
        "defining_managers": ["Cruyff", "Guardiola", "Xavi", "Luis Enrique", "Van Gaal"],
        "era": "1988-present",
        "archetype_requirements": {"Passer": 60, "Controller": 55, "Dribbler": 50, "Creator": 45},
        "personality_preferences": {"A": 0.7, "P": 0.6},
        "preferred_tags": [
            "Press Resistant", "Tempo Setter", "Positional Anchor",
            "Ball Progressor", "Link-Up Artist", "Half-Space Operator",
        ],
        "concern_tags": ["Direct Runner", "Phase Skipper", "Long Throw Weapon"],
        "key_attributes": ["pass_accuracy", "composure", "first_touch", "vision"],
        "possession_orientation": 10,
        "pressing_intensity": 7,
        "directness": 2,
        "defensive_depth": 3,
        "width_emphasis": 6,
        "fluidity": 7,
    },
    {
        "name": "Gegenpressing",
        "slug": "gegenpressing",
        "tagline": "The best moment to win the ball is the moment you lose it.",
        "origin_story": (
            "Viktor Maslov, manager of Dynamo Kyiv in the 1960s, was the father. He withdrew his wingers into "
            "midfield, invented zonal marking, and demanded systematic pressing — ideas so ahead of their time "
            "that Soviet football barely noticed. Valeriy Lobanovskyi inherited Maslov's Kyiv and added data: "
            "'Football is a system of twenty-two elements in two groups.' Arrigo Sacchi watched Lobanovskyi and "
            "built AC Milan (1987-91) around the 25-metre principle — the gap between the defensive and attacking "
            "lines could never exceed 25 metres. Sacchi's Milan pressed as a single organism and won two European "
            "Cups. Ralf Rangnick codified it in Germany as Gegenpressing — the counter-press — at Hoffenheim and "
            "RB Leipzig. Jürgen Klopp took Rangnick's ideas, added heavy metal energy, and created the most "
            "exciting team in Europe at Borussia Dortmund (2010-14) and Liverpool (2015-24). Nagelsmann and "
            "Marsch continue the lineage. The philosophy: the ball is won, not possessed. The transition moment "
            "— the five seconds after losing the ball — is the most dangerous moment in football. Attack it."
        ),
        "key_principles": [
            "Counter-press within 5 seconds of losing possession",
            "High defensive line compresses the pitch",
            "Vertical transitions as primary attacking weapon",
            "Intensity and stamina as non-negotiable",
            "The pressing tree: triggers, traps, and cover shadows",
        ],
        "defining_managers": ["Maslov", "Lobanovskyi", "Sacchi", "Rangnick", "Klopp", "Nagelsmann"],
        "era": "1960s-present",
        "archetype_requirements": {"Engine": 55, "Sprinter": 50, "Destroyer": 45, "Powerhouse": 40},
        "personality_preferences": {"C": 0.7, "N": 0.6},
        "preferred_tags": [
            "Press Trigger", "Counter-Press Leader", "Transition Threat",
            "Compactor", "Recoverer", "Direct Runner", "Phase Skipper",
        ],
        "concern_tags": ["Deep Defender", "Hold-Up Target", "Positional Anchor"],
        "key_attributes": ["pressing", "stamina", "intensity", "aggression"],
        "possession_orientation": 5,
        "pressing_intensity": 10,
        "directness": 7,
        "defensive_depth": 3,
        "width_emphasis": 6,
        "fluidity": 6,
    },
    {
        "name": "Bielsismo",
        "slug": "bielsismo",
        "tagline": "Football is geometry and effort. A moral obligation to attack.",
        "origin_story": (
            "Marcelo Bielsa is football's monk — a man who watches 300 matches to prepare for one, who sleeps "
            "in the training ground, who resigned from Lazio after two days because the club didn't sign the "
            "players he demanded. His Argentina (1998-2004) played the most aggressive football the national team "
            "had ever attempted. His Athletic Bilbao (2011-12) reached two finals playing only Basque players in "
            "a 3-3-1-3 that pressed man-for-man across the entire pitch. At Leeds (2018-21), he turned a "
            "Championship side into the most watchable team in England through sheer intensity and geometric "
            "width. Bielsismo demands: every player presses their direct opponent, creating 1v1 duels across "
            "the pitch. The 3-3-1-3 creates extreme width and numerical superiority in wide areas. Players run "
            "13km per game. There is no energy management — you either give everything or you betray the idea. "
            "His disciples — Pochettino, Sampaoli, Simeone (early career), even Guardiola, who called Bielsa "
            "'the best manager in the world' — have spread his influence across global football. Bielsa has won "
            "almost nothing, but his ideas have won everything."
        ),
        "key_principles": [
            "Man-oriented pressing across the entire pitch",
            "Extreme width — stretch the defence to breaking point",
            "Geometric superiority in wide areas",
            "Total commitment — no energy conservation",
            "Moral obligation to attack regardless of scoreline",
        ],
        "defining_managers": ["Bielsa", "Pochettino", "Sampaoli", "Gallardo"],
        "era": "1992-present",
        "archetype_requirements": {"Engine": 60, "Sprinter": 55, "Dribbler": 50, "Destroyer": 45},
        "personality_preferences": {"N": 0.7, "C": 0.6},
        "preferred_tags": [
            "Press Trigger", "Counter-Press Leader", "Width Provider",
            "Direct Runner", "Transition Threat", "Recoverer",
        ],
        "concern_tags": ["Positional Anchor", "Luxury Player", "Deep Defender"],
        "key_attributes": ["stamina", "pressing", "pace", "intensity"],
        "possession_orientation": 5,
        "pressing_intensity": 9,
        "directness": 6,
        "defensive_depth": 2,
        "width_emphasis": 10,
        "fluidity": 7,
    },
    {
        "name": "Transizione",
        "slug": "transizione",
        "tagline": "Defend with structure, strike on the break. Transition as the decisive moment.",
        "origin_story": (
            "Carlos Bilardo won the 1986 World Cup with Argentina playing cynical, brilliant, ruthless football "
            "— Maradona's genius weaponised by a manager who understood that football is war by other means. "
            "Diego Simeone was Bilardo's spiritual heir. When he took over Atlético Madrid in 2011, they were "
            "a mid-table mess. Within three years they won La Liga, reached the Champions League final, and "
            "terrified Barcelona and Real Madrid. The system: a 4-4-2 defensive block so compact you could "
            "cover it with a bedsheet. Every player within 25 metres of every other player. The block absorbs "
            "pressure, then explodes on the counter through Koke's switches and the speed of the front two. "
            "Germán Burgos, his assistant, embodied the mentality — a former goalkeeper with a face like a "
            "clenched fist. Mourinho's Inter in 2010 showed the philosophy at its peak — structured defence, "
            "lethal transitions, winning the Champions League against Barcelona with discipline and precision. "
            "Deschamps' France in 2018, Ranieri's Leicester in 2016 — all variants of the same idea: "
            "absorb, transition, punish."
        ),
        "key_principles": [
            "Compact defensive block — 25m between lines",
            "Counter-attack as art form",
            "Controlled aggression in every duel",
            "Set pieces as legitimate primary weapon",
            "Collective suffering as path to victory",
        ],
        "defining_managers": ["Bilardo", "Simeone", "Mourinho", "Deschamps", "Ranieri"],
        "era": "2011-present",
        "archetype_requirements": {"Cover": 55, "Destroyer": 50, "Sprinter": 55, "Striker": 45},
        "personality_preferences": {"I": 0.6, "C": 0.6, "L": 0.5},
        "preferred_tags": [
            "Transition Threat", "Phase Skipper", "Direct Runner",
            "Deep Defender", "Cover Shadow", "Third-Man Runner",
        ],
        "concern_tags": ["Tempo Setter", "Positional Anchor", "Drop Deep Creator"],
        "key_attributes": ["pace", "acceleration", "movement", "positioning"],
        "possession_orientation": 3,
        "pressing_intensity": 5,
        "directness": 8,
        "defensive_depth": 8,
        "width_emphasis": 5,
        "fluidity": 3,
    },
    {
        "name": "POMO",
        "slug": "pomo",
        "tagline": "Post-modern pragmatism. Set pieces, territory, physical superiority. The anti-aesthetic.",
        "origin_story": (
            "Charles Reep was an RAF wing commander who, in the 1950s, sat in the stands at Swindon Town and "
            "counted passes. His conclusion: most goals come from moves of three passes or fewer, and the most "
            "dangerous area is the penalty box. Therefore: get the ball into the box as quickly as possible, by "
            "any means necessary. Long balls, set pieces, second balls, physical dominance. Reep influenced "
            "Graham Taylor's Watford — direct football from the Fourth Division to the First in five years — "
            "and the Wimbledon Crazy Gang that won the 1988 FA Cup by terrorising Liverpool. Sam Allardyce "
            "took Reep's insights and added analytics: Bolton Wanderers in the 2000s used ProZone data to "
            "optimise set piece delivery, defensive structure, and physical output. Tony Pulis at Stoke, "
            "Sean Dyche at Burnley — a promoted side that survived four Premier League seasons on a budget "
            "a tenth of their rivals by being impossible to beat at home. Rory Delap's long throws became "
            "a genuine tactical weapon. POMO is football's answer to punk: ugly, effective, and contemptuous "
            "of the beautiful game. It says: aesthetics are a luxury. Points are earned through structure, "
            "set pieces, and making the opposition as uncomfortable as possible."
        ),
        "key_principles": [
            "Set pieces as primary attacking weapon",
            "Territory over possession — get the ball into their half",
            "Physical superiority in every aerial duel",
            "Second balls as tactical currency",
            "Make the opposition uncomfortable",
        ],
        "defining_managers": ["Reep", "Taylor", "Wimbledon Crazy Gang", "Allardyce", "Pulis", "Dyche"],
        "era": "1980s-present",
        "archetype_requirements": {"Target": 55, "Powerhouse": 55, "Destroyer": 50, "Cover": 50},
        "personality_preferences": {"C": 0.6, "X": 0.5},
        "preferred_tags": [
            "Aerial Target", "Set-Piece Delivery", "Box Crasher",
            "Long Throw Weapon", "Deep Defender", "Controlled Aggressor",
        ],
        "concern_tags": ["Tempo Setter", "Press Resistant", "Half-Space Operator"],
        "key_attributes": ["heading", "aerial_duels", "aggression", "stamina"],
        "possession_orientation": 2,
        "pressing_intensity": 4,
        "directness": 10,
        "defensive_depth": 8,
        "width_emphasis": 5,
        "fluidity": 2,
    },
    {
        "name": "Leadership",
        "slug": "leadership",
        "tagline": "Leadership as philosophy. Mentality monsters. Winning from losing positions.",
        "origin_story": (
            "Bill Shankly built Liverpool on socialist principles — 'The socialism I believe in is everybody "
            "working for each other' — and created a club that believed it could never lose. Brian Clough took "
            "a nothing club, Nottingham Forest, and won back-to-back European Cups through force of personality "
            "and an unshakeable belief that his players were better than they thought they were. But Alex "
            "Ferguson perfected leadership as football philosophy. Twenty-six years at Manchester United "
            "(1986-2013), 38 trophies, but the system was never the point. The point was the hairdryer — the "
            "volcanic blast of criticism that could reduce a millionaire to tears — and then the arm around "
            "the shoulder the next day. Ferguson's United won because they believed they would win. 'Fergie "
            "Time' — the phenomenon of scoring decisive late goals — was not luck but culture. The squad was "
            "always evolving: Robson to Keane to Scholes to Ronaldo. He sold players a year too early rather "
            "than a year too late. He made stars feel replaceable and reserves feel important. His tactical "
            "flexibility was total — 4-4-2, 4-3-3, 4-5-1, whatever the game demanded. The philosophy was not "
            "a formation or a pressing trigger but a statement: this club does not accept defeat."
        ),
        "key_principles": [
            "Leadership and squad management above all tactics",
            "Mentality — the refusal to accept defeat",
            "Tactical flexibility — the system serves the players",
            "Sell a year early, never a year late",
            "Winning culture as self-reinforcing organism",
        ],
        "defining_managers": ["Shankly", "Clough", "Ferguson", "Ancelotti"],
        "era": "1960s-present",
        "archetype_requirements": {"Commander": 55, "Engine": 50, "Sprinter": 50, "Striker": 45},
        "personality_preferences": {"C": 0.7, "L": 0.6, "X": 0.5},
        "preferred_tags": [
            "Big Game Player", "Direct Runner", "Transition Threat",
            "Counter-Press Leader", "Width Provider", "Box Crasher",
        ],
        "concern_tags": ["Luxury Player", "Positional Anchor"],
        "key_attributes": ["drive", "leadership", "composure", "stamina"],
        "possession_orientation": 5,
        "pressing_intensity": 6,
        "directness": 7,
        "defensive_depth": 5,
        "width_emphasis": 8,
        "fluidity": 5,
    },
]

# ── 41 Tactical Roles ───────────────────────────────────────────────────────
# (role_name, position, primary_model, secondary_model)

ROLES = [
    ("Comandante",         "GK", "GK",         "Commander"),
    ("Sweeper Keeper",     "GK", "GK",         "Cover"),
    ("Distributor",        "GK", "GK",         "Passer"),
    ("Shotstopper",        "GK", "GK",         "Powerhouse"),
    ("Centrale",           "CD", "Commander",   "Destroyer"),
    ("Distributor",        "CD", "Passer",      "Cover"),
    ("Stopper",            "CD", "Powerhouse",  "Destroyer"),
    ("Sweeper",            "CD", "Cover",       "Controller"),
    ("Colossus",           "CD", "Target",      "Powerhouse"),
    ("Fullback",           "WD", "Engine",      "Passer"),
    ("Wing-back",          "WD", "Engine",      "Dribbler"),
    ("Corner Back",        "WD", "Cover",       "Destroyer"),
    ("Invertido",          "WD", "Controller",  "Passer"),
    ("Regista",            "DM", "Passer",      "Controller"),
    ("Pivote",             "DM", "Controller",  "Cover"),
    ("Anchor",             "DM", "Cover",       "Destroyer"),
    ("Ball Winner",        "DM", "Engine",      "Destroyer"),
    ("Segundo Volante",    "DM", "Powerhouse",  "Engine"),
    ("Playmaker",          "CM", "Passer",      "Creator"),
    ("Metodista",          "CM", "Controller",  "Passer"),
    ("Mezzala",            "CM", "Engine",      "Creator"),
    ("Tuttocampista",      "CM", "Engine",      "Cover"),
    ("Winger",             "WM", "Dribbler",    "Passer"),
    ("Tornante",           "WM", "Engine",      "Cover"),
    ("False Winger",       "WM", "Controller",  "Creator"),
    ("Wide Playmaker",     "WM", "Creator",     "Passer"),
    ("Trequartista",       "AM", "Dribbler",    "Creator"),
    ("Enganche",           "AM", "Creator",     "Controller"),
    ("Boxcrasher",         "AM", "Sprinter",    "Striker"),
    ("Inside Forward",     "WF", "Dribbler",    "Striker"),
    ("Raumdeuter",         "WF", "Engine",      "Striker"),
    ("Winger",             "WF", "Dribbler",    "Passer"),
    ("Wide Playmaker",     "WF", "Creator",     "Passer"),
    ("Wide Target Forward","WF", "Target",      "Powerhouse"),
    ("Prima Punta",        "CF", "Striker",     "Target"),
    ("Complete Forward",   "CF", "Striker",     "Creator"),
    ("Falso Nove",         "CF", "Creator",     "Controller"),
    ("Spearhead",          "CF", "Engine",      "Striker"),
    ("Target Forward",     "CF", "Target",      "Powerhouse"),
    ("Seconda Punta",      "CF", "Creator",     "Striker"),
    ("Shadow Striker",     "CF", "Sprinter",    "Striker"),
]

# Build lookup: (role_name, position) -> (primary, secondary)
ROLE_LOOKUP = {(r[0], r[1]): (r[2], r[3]) for r in ROLES}

# ── 28 Tactical Systems ─────────────────────────────────────────────────────
# Each system: slug, name, philosophy_slug, formation, defining_team, key_principle, slots
# Each slot: (label, position, sort_order, default_role, [alt_roles])

SYSTEMS = [
    # ── Garra Charrua ──
    {
        "slug": "la_celeste", "name": "La Celeste",
        "philosophy_slug": "garra_charrua", "formation": "4-4-2",
        "defining_team": "Uruguay 1950 / 2010",
        "key_principle": "Spirit and sacrifice define the team",
        "slots": [
            ("GK",  "GK", 1, "Comandante",    []),
            ("LCB", "CD", 2, "Centrale",       []),
            ("RCB", "CD", 3, "Stopper",        []),
            ("LB",  "WD", 4, "Corner Back",    []),
            ("RB",  "WD", 5, "Fullback",       []),
            ("LM",  "WM", 6, "Tornante",       []),
            ("RM",  "WM", 7, "Winger",         []),
            ("LCM", "DM", 8, "Anchor",         []),
            ("RCM", "CM", 9, "Tuttocampista",  []),
            ("LF",  "CF", 10, "Target Forward", []),
            ("RF",  "CF", 11, "Spearhead",     []),
        ],
    },
    {
        "slug": "muralla", "name": "Muralla",
        "philosophy_slug": "garra_charrua", "formation": "5-4-1",
        "defining_team": "Tabarez's Uruguay 2018",
        "key_principle": "The wall — five-man defensive block",
        "slots": [
            ("GK",  "GK", 1, "Comandante",    []),
            ("LCB", "CD", 2, "Stopper",        []),
            ("CCB", "CD", 3, "Centrale",       []),
            ("RCB", "CD", 4, "Sweeper",        []),
            ("LWB", "WD", 5, "Corner Back",    []),
            ("RWB", "WD", 6, "Corner Back",    []),
            ("LM",  "WM", 7, "Tornante",       []),
            ("RM",  "WM", 8, "Winger",         []),
            ("LCM", "DM", 9, "Anchor",         []),
            ("RCM", "CM", 10, "Tuttocampista", []),
            ("CF",  "CF", 11, "Target Forward", []),
        ],
    },
    # ── Catenaccio ──
    {
        "slug": "grande_inter", "name": "Grande Inter",
        "philosophy_slug": "catenaccio", "formation": "5-3-2",
        "defining_team": "Herrera's Inter 1963-66",
        "key_principle": "Lock the door, then counter with precision",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",   []),
            ("LCB", "CD", 2, "Stopper",        []),
            ("CCB", "CD", 3, "Sweeper",        []),
            ("RCB", "CD", 4, "Stopper",        []),
            ("LWB", "WD", 5, "Wing-back",      []),
            ("RWB", "WD", 6, "Wing-back",      []),
            ("LCM", "CM", 7, "Metodista",      []),
            ("CDM", "DM", 8, "Anchor",         []),
            ("RCM", "CM", 9, "Mezzala",        []),
            ("LF",  "CF", 10, "Seconda Punta", []),
            ("RF",  "CF", 11, "Prima Punta",       []),
        ],
    },
    {
        "slug": "trincea", "name": "Trincea",
        "philosophy_slug": "catenaccio", "formation": "4-5-1",
        "defining_team": "Capello's Milan / Allegri's Juventus",
        "key_principle": "Trench warfare, disciplined low block",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",    []),
            ("LCB", "CD", 2, "Centrale",        []),
            ("RCB", "CD", 3, "Stopper",         []),
            ("LB",  "WD", 4, "Corner Back",     []),
            ("RB",  "WD", 5, "Corner Back",     []),
            ("LM",  "WM", 6, "Tornante",        []),
            ("RM",  "WM", 7, "Tornante",        []),
            ("LCM", "CM", 8, "Tuttocampista",   []),
            ("CDM", "DM", 9, "Anchor",          []),
            ("RCM", "CM", 10, "Metodista",      []),
            ("CF",  "CF", 11, "Target Forward",  []),
        ],
    },
    {
        "slug": "il_muro", "name": "Il Muro",
        "philosophy_slug": "catenaccio", "formation": "3-5-2",
        "defining_team": "Conte's Italy Euro 2016",
        "key_principle": "The wall of three, wing-backs provide width",
        "slots": [
            ("GK",  "GK", 1, "Comandante",     []),
            ("LCB", "CD", 2, "Stopper",         []),
            ("CCB", "CD", 3, "Centrale",        []),
            ("RCB", "CD", 4, "Stopper",         []),
            ("LWB", "WD", 5, "Wing-back",       []),
            ("RWB", "WD", 6, "Wing-back",       []),
            ("LCM", "CM", 7, "Tuttocampista",   []),
            ("CDM", "DM", 8, "Anchor",          []),
            ("RCM", "CM", 9, "Mezzala",         []),
            ("LF",  "CF", 10, "Seconda Punta",  []),
            ("RF",  "CF", 11, "Spearhead",      []),
        ],
    },
    # ── Joga Bonito ──
    {
        "slug": "samba", "name": "Samba",
        "philosophy_slug": "joga_bonito", "formation": "4-2-4",
        "defining_team": "Brazil 1958-62",
        "key_principle": "Four forwards, two holding — pure attacking expression",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",      []),
            ("LCB", "CD", 2, "Sweeper",           []),
            ("RCB", "CD", 3, "Centrale",          []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LDM", "DM", 6, "Pivote",            []),
            ("RDM", "DM", 7, "Segundo Volante",   []),
            ("LW",  "WF", 8, "Winger",            []),
            ("RW",  "WF", 9, "Winger",            []),
            ("LF",  "CF", 10, "Complete Forward",  []),
            ("RF",  "CF", 11, "Prima Punta",           []),
        ],
    },
    {
        "slug": "o_jogo", "name": "O Jogo",
        "philosophy_slug": "joga_bonito", "formation": "4-2-3-1",
        "defining_team": "Brazil 1970",
        "key_principle": "The beautiful game at its peak",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",      []),
            ("LCB", "CD", 2, "Sweeper",           []),
            ("RCB", "CD", 3, "Centrale",          []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LDM", "DM", 6, "Pivote",            []),
            ("RDM", "DM", 7, "Segundo Volante",   []),
            ("LW",  "WF", 8, "Wide Playmaker",    []),
            ("AM",  "AM", 9, "Trequartista",      []),
            ("RW",  "WF", 10, "Winger",           []),
            ("CF",  "CF", 11, "Complete Forward",  []),
        ],
    },
    {
        "slug": "ginga", "name": "Ginga",
        "philosophy_slug": "joga_bonito", "formation": "4-3-3",
        "defining_team": "Santos (Pele) / Flamengo 2019",
        "key_principle": "Rhythm, flair, improvisation",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",     []),
            ("LCB", "CD", 2, "Sweeper",          []),
            ("RCB", "CD", 3, "Centrale",         []),
            ("LB",  "WD", 4, "Fullback",         []),
            ("RB",  "WD", 5, "Wing-back",        []),
            ("LCM", "CM", 6, "Playmaker",        []),
            ("CDM", "DM", 7, "Pivote",           []),
            ("RCM", "CM", 8, "Mezzala",          []),
            ("LW",  "WF", 9, "Winger",           []),
            ("RW",  "WF", 10, "Inside Forward",  []),
            ("CF",  "CF", 11, "Complete Forward", []),
        ],
    },
    # ── Total Football ──
    {
        "slug": "ajax_model", "name": "Ajax Model",
        "philosophy_slug": "total_football", "formation": "4-3-3",
        "defining_team": "Michels/Cruyff Ajax 1970-73",
        "key_principle": "Every player can play every position",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("RCB", "CD", 3, "Sweeper",           []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LCM", "CM", 6, "Playmaker",         []),
            ("CDM", "DM", 7, "Pivote",            []),
            ("RCM", "CM", 8, "Tuttocampista",     []),
            ("LW",  "WF", 9, "Winger",            []),
            ("RW",  "WF", 10, "Inside Forward",   []),
            ("CF",  "CF", 11, "Complete Forward",  []),
        ],
    },
    {
        "slug": "oranje", "name": "Oranje",
        "philosophy_slug": "total_football", "formation": "3-4-3",
        "defining_team": "Netherlands 1974 WC",
        "key_principle": "Positional interchange as philosophy",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("CCB", "CD", 3, "Sweeper",           []),
            ("RCB", "CD", 4, "Distributor",       []),
            ("LM",  "WM", 5, "Winger",            []),
            ("LCM", "CM", 6, "Tuttocampista",     []),
            ("RCM", "CM", 7, "Playmaker",         []),
            ("RM",  "WM", 8, "Winger",            []),
            ("LW",  "WF", 9, "Inside Forward",    []),
            ("CF",  "CF", 10, "Falso Nove",       []),
            ("RW",  "WF", 11, "Inside Forward",   []),
        ],
    },
    {
        "slug": "van_gaal_system", "name": "Van Gaal System",
        "philosophy_slug": "total_football", "formation": "4-3-3",
        "defining_team": "Ajax 1995 / Van Gaal's Barcelona",
        "key_principle": "Structured positional play with width",
        "slots": [
            ("GK",  "GK", 1, "Distributor",      []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("RCB", "CD", 3, "Sweeper",           []),
            ("LB",  "WD", 4, "Wing-back",         []),
            ("RB",  "WD", 5, "Wing-back",         []),
            ("LCM", "CM", 6, "Metodista",         []),
            ("CDM", "DM", 7, "Regista",           []),
            ("RCM", "CM", 8, "Mezzala",           []),
            ("LW",  "WF", 9, "Winger",            []),
            ("RW",  "WF", 10, "Inside Forward",   []),
            ("CF",  "CF", 11, "Complete Forward",  []),
        ],
    },
    # ── La Masia ──
    {
        "slug": "positional_play", "name": "Positional Play",
        "philosophy_slug": "la_masia", "formation": "4-3-3",
        "defining_team": "Guardiola's Barcelona 2008-12",
        "key_principle": "Positional superiority through systematic spacing",
        "slots": [
            ("GK",  "GK", 1, "Distributor",      []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("RCB", "CD", 3, "Sweeper",           []),
            ("LB",  "WD", 4, "Invertido",         []),
            ("RB",  "WD", 5, "Invertido",         []),
            ("CDM", "DM", 6, "Pivote",            []),
            ("LCM", "CM", 7, "Mezzala",           []),
            ("RCM", "CM", 8, "Metodista",         []),
            ("LW",  "WF", 9, "Inside Forward",    []),
            ("RW",  "WF", 10, "Inside Forward",   []),
            ("CF",  "CF", 11, "Falso Nove",       []),
        ],
    },
    {
        "slug": "inverted_build", "name": "Inverted Build",
        "philosophy_slug": "la_masia", "formation": "3-2-4-1",
        "defining_team": "Guardiola's City 2022-24",
        "key_principle": "Fullbacks invert, overloads everywhere",
        "slots": [
            ("GK",  "GK", 1, "Distributor",       []),
            ("LCB", "CD", 2, "Distributor",        []),
            ("CCB", "CD", 3, "Centrale",           []),
            ("RCB", "CD", 4, "Distributor",        []),
            ("LDM", "DM", 5, "Pivote",             []),
            ("RDM", "DM", 6, "Regista",            []),
            ("LW",  "WF", 7, "Inside Forward",     []),
            ("LAM", "AM", 8, "Enganche",           []),
            ("RAM", "AM", 9, "Trequartista",       []),
            ("RW",  "WF", 10, "Wide Playmaker",    []),
            ("CF",  "CF", 11, "Complete Forward",   []),
        ],
    },
    {
        "slug": "relational_play", "name": "Relational Play",
        "philosophy_slug": "la_masia", "formation": "4-2-3-1",
        "defining_team": "De Zerbi's Brighton",
        "key_principle": "Position as suggestion, relation as rule",
        "slots": [
            ("GK",  "GK", 1, "Distributor",      []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("RCB", "CD", 3, "Sweeper",           []),
            ("LB",  "WD", 4, "Invertido",         []),
            ("RB",  "WD", 5, "Invertido",         []),
            ("LDM", "DM", 6, "Pivote",            []),
            ("RDM", "DM", 7, "Regista",           []),
            ("LW",  "WF", 8, "Wide Playmaker",    []),
            ("AM",  "AM", 9, "Enganche",          []),
            ("RW",  "WF", 10, "Inside Forward",   []),
            ("CF",  "CF", 11, "Falso Nove",       []),
        ],
    },
    # ── Gegenpressing ──
    {
        "slug": "heavy_metal", "name": "Heavy Metal",
        "philosophy_slug": "gegenpressing", "formation": "4-2-3-1",
        "defining_team": "Klopp's Dortmund 2010-13",
        "key_principle": "Win the ball, go for the throat",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Stopper",           []),
            ("RCB", "CD", 3, "Centrale",          []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LDM", "DM", 6, "Ball Winner",       []),
            ("RDM", "DM", 7, "Anchor",            []),
            ("LW",  "WF", 8, "Raumdeuter",        []),
            ("AM",  "AM", 9, "Trequartista",      []),
            ("RW",  "WF", 10, "Raumdeuter",       []),
            ("CF",  "CF", 11, "Spearhead",        []),
        ],
    },
    {
        "slug": "red_machine", "name": "Red Machine",
        "philosophy_slug": "gegenpressing", "formation": "4-3-3",
        "defining_team": "Klopp's Liverpool 2018-20",
        "key_principle": "Organised chaos with relentless intensity",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Centrale",          []),
            ("RCB", "CD", 3, "Stopper",           []),
            ("LB",  "WD", 4, "Wing-back",         []),
            ("RB",  "WD", 5, "Wing-back",         []),
            ("CDM", "DM", 6, "Anchor",            []),
            ("LCM", "CM", 7, "Mezzala",           []),
            ("RCM", "CM", 8, "Tuttocampista",     []),
            ("LW",  "WF", 9, "Inside Forward",    []),
            ("RW",  "WF", 10, "Inside Forward",   []),
            ("CF",  "CF", 11, "Spearhead",        []),
        ],
    },
    {
        "slug": "red_bull_model", "name": "Red Bull Model",
        "philosophy_slug": "gegenpressing", "formation": "4-4-2",
        "defining_team": "Rangnick's Leipzig / Salzburg",
        "key_principle": "Press in pairs, transition in seconds",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Stopper",           []),
            ("RCB", "CD", 3, "Stopper",           []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LM",  "WM", 6, "Tornante",          []),
            ("RM",  "WM", 7, "Tornante",          []),
            ("LDM", "DM", 8, "Ball Winner",       []),
            ("RCM", "CM", 9, "Tuttocampista",     []),
            ("LF",  "CF", 10, "Spearhead",        []),
            ("RF",  "CF", 11, "Shadow Striker",    []),
        ],
    },
    {
        "slug": "kyiv_prototype", "name": "Kyiv Prototype",
        "philosophy_slug": "gegenpressing", "formation": "4-4-2",
        "defining_team": "Lobanovskyi's Dynamo 1986-88",
        "key_principle": "Scientific football, universal pressing",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",      []),
            ("LCB", "CD", 2, "Centrale",          []),
            ("RCB", "CD", 3, "Stopper",           []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LM",  "WM", 6, "False Winger",      []),
            ("RM",  "WM", 7, "Winger",            []),
            ("LCM", "CM", 8, "Tuttocampista",     []),
            ("RCM", "CM", 9, "Playmaker",         []),
            ("LF",  "CF", 10, "Spearhead",        []),
            ("RF",  "CF", 11, "Prima Punta",           []),
        ],
    },
    # ── Bielsismo ──
    {
        "slug": "el_loco", "name": "El Loco",
        "philosophy_slug": "bielsismo", "formation": "3-3-1-3",
        "defining_team": "Bielsa's Athletic Bilbao / Leeds",
        "key_principle": "Geometric width, man-for-man, no compromise",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Stopper",           []),
            ("CCB", "CD", 3, "Distributor",       []),
            ("RCB", "CD", 4, "Stopper",           []),
            ("LM",  "WM", 5, "Winger",            []),
            ("CDM", "DM", 6, "Ball Winner",       []),
            ("RM",  "WM", 7, "Winger",            []),
            ("AM",  "AM", 8, "Trequartista",      []),
            ("LW",  "WF", 9, "Inside Forward",    []),
            ("CF",  "CF", 10, "Spearhead",        []),
            ("RW",  "WF", 11, "Inside Forward",   []),
        ],
    },
    {
        "slug": "la_furia", "name": "La Furia",
        "philosophy_slug": "bielsismo", "formation": "3-4-3",
        "defining_team": "Gasperini's Atalanta / Sampaoli's Chile",
        "key_principle": "Aggressive 3-at-back, wing-back mayhem",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Stopper",           []),
            ("CCB", "CD", 3, "Centrale",          []),
            ("RCB", "CD", 4, "Stopper",           []),
            ("LWB", "WD", 5, "Wing-back",         []),
            ("LCM", "CM", 6, "Mezzala",           []),
            ("RCM", "CM", 7, "Tuttocampista",     []),
            ("RWB", "WD", 8, "Wing-back",         []),
            ("LW",  "WF", 9, "Raumdeuter",        []),
            ("CF",  "CF", 10, "Complete Forward",  []),
            ("RW",  "WF", 11, "Inside Forward",   []),
        ],
    },
    # ── Transizione ──
    {
        "slug": "the_special_one", "name": "The Special One",
        "philosophy_slug": "transizione", "formation": "4-2-3-1",
        "defining_team": "Mourinho's Inter 2010",
        "key_principle": "Defend with structure, kill on the break",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",     []),
            ("LCB", "CD", 2, "Centrale",         []),
            ("RCB", "CD", 3, "Stopper",          []),
            ("LB",  "WD", 4, "Corner Back",      []),
            ("RB",  "WD", 5, "Corner Back",      []),
            ("LDM", "DM", 6, "Anchor",           []),
            ("RDM", "DM", 7, "Ball Winner",      []),
            ("LW",  "WF", 8, "Raumdeuter",       []),
            ("AM",  "AM", 9, "Enganche",         []),
            ("RW",  "WF", 10, "Inside Forward",  []),
            ("CF",  "CF", 11, "Prima Punta",         []),
        ],
    },
    {
        "slug": "les_bleus", "name": "Les Bleus",
        "philosophy_slug": "transizione", "formation": "4-2-3-1",
        "defining_team": "Deschamps' France 2018",
        "key_principle": "Talent managed through discipline and transitions",
        "slots": [
            ("GK",  "GK", 1, "Comandante",           []),
            ("LCB", "CD", 2, "Centrale",              []),
            ("RCB", "CD", 3, "Colossus",              []),
            ("LB",  "WD", 4, "Corner Back",           []),
            ("RB",  "WD", 5, "Fullback",              []),
            ("LDM", "DM", 6, "Anchor",                []),
            ("RDM", "DM", 7, "Segundo Volante",       []),
            ("LW",  "WF", 8, "Wide Target Forward",   []),
            ("AM",  "AM", 9, "Boxcrasher",            []),
            ("RW",  "WF", 10, "Raumdeuter",           []),
            ("CF",  "CF", 11, "Target Forward",        []),
        ],
    },
    {
        "slug": "foxes", "name": "Foxes",
        "philosophy_slug": "transizione", "formation": "4-4-2",
        "defining_team": "Ranieri's Leicester 2016",
        "key_principle": "Counter-attack perfection with pace and heart",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",      []),
            ("LCB", "CD", 2, "Colossus",          []),
            ("RCB", "CD", 3, "Centrale",          []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LM",  "WM", 6, "Winger",            []),
            ("RM",  "WM", 7, "Winger",            []),
            ("LDM", "DM", 8, "Anchor",            []),
            ("RCM", "CM", 9, "Tuttocampista",     []),
            ("LF",  "CF", 10, "Shadow Striker",    []),
            ("RF",  "CF", 11, "Target Forward",    []),
        ],
    },
    # ── POMO ──
    {
        "slug": "route_one", "name": "Route One",
        "philosophy_slug": "pomo", "formation": "4-4-2",
        "defining_team": "Wimbledon 1988 / Allardyce's Bolton",
        "key_principle": "Direct, territorial, set-piece kings",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",       []),
            ("LCB", "CD", 2, "Colossus",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Fullback",           []),
            ("RB",  "WD", 5, "Fullback",           []),
            ("LM",  "WM", 6, "Winger",             []),
            ("RM",  "WM", 7, "Wide Playmaker",     []),
            ("LDM", "DM", 8, "Ball Winner",        []),
            ("RCM", "CM", 9, "Tuttocampista",      []),
            ("LF",  "CF", 10, "Prima Punta",           []),
            ("RF",  "CF", 11, "Target Forward",    []),
        ],
    },
    {
        "slug": "fortress", "name": "Fortress",
        "philosophy_slug": "pomo", "formation": "4-5-1",
        "defining_team": "Pulis's Stoke / Dyche's Burnley",
        "key_principle": "Defend deep, win ugly, never surrender",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",       []),
            ("LCB", "CD", 2, "Colossus",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Corner Back",        []),
            ("RB",  "WD", 5, "Corner Back",        []),
            ("LM",  "WM", 6, "Tornante",           []),
            ("RM",  "WM", 7, "Tornante",           []),
            ("LDM", "DM", 8, "Anchor",             []),
            ("CDM", "DM", 9, "Ball Winner",        []),
            ("RCM", "CM", 10, "Tuttocampista",     []),
            ("CF",  "CF", 11, "Target Forward",    []),
        ],
    },
    # ── Leadership ──
    {
        "slug": "wing_play", "name": "Wing Play",
        "philosophy_slug": "leadership", "formation": "4-4-2",
        "defining_team": "Ferguson's United 1996-2001",
        "key_principle": "Width, pace, and never-say-die spirit",
        "slots": [
            ("GK",  "GK", 1, "Comandante",        []),
            ("LCB", "CD", 2, "Centrale",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Fullback",           []),
            ("RB",  "WD", 5, "Fullback",           []),
            ("LM",  "WM", 6, "Winger",             []),
            ("RM",  "WM", 7, "Wide Playmaker",     []),
            ("LCM", "CM", 8, "Playmaker",          []),
            ("RCM", "CM", 9, "Mezzala",            []),
            ("LF",  "CF", 10, "Prima Punta",           []),
            ("RF",  "CF", 11, "Complete Forward",   []),
        ],
    },
    {
        "slug": "european_nights", "name": "European Nights",
        "philosophy_slug": "leadership", "formation": "4-5-1",
        "defining_team": "Ferguson's United 2008 CL",
        "key_principle": "Adapt, contain, then unleash",
        "slots": [
            ("GK",  "GK", 1, "Comandante",        []),
            ("LCB", "CD", 2, "Centrale",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Corner Back",        []),
            ("RB",  "WD", 5, "Fullback",           []),
            ("LM",  "WM", 6, "Tornante",           []),
            ("RM",  "WM", 7, "False Winger",       []),
            ("LCM", "CM", 8, "Tuttocampista",      []),
            ("CDM", "DM", 9, "Anchor",             []),
            ("RCM", "CM", 10, "Playmaker",         []),
            ("CF",  "CF", 11, "Complete Forward",   []),
        ],
    },
    {
        "slug": "ancelotti_ball", "name": "Ancelotti Ball",
        "philosophy_slug": "leadership", "formation": "4-3-3",
        "defining_team": "Ancelotti's Real Madrid 2022-24",
        "key_principle": "Balance, experience, big-game mentality",
        "slots": [
            ("GK",  "GK", 1, "Comandante",        []),
            ("LCB", "CD", 2, "Centrale",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Fullback",           []),
            ("RB",  "WD", 5, "Fullback",           []),
            ("CDM", "DM", 6, "Anchor",             []),
            ("LCM", "CM", 7, "Mezzala",            []),
            ("RCM", "CM", 8, "Playmaker",          []),
            ("LW",  "WF", 9, "Inside Forward",     []),
            ("RW",  "WF", 10, "Winger",            []),
            ("CF",  "CF", 11, "Complete Forward",   []),
        ],
    },
]


# ── Functions ────────────────────────────────────────────────────────────────


def rename_philosophies(dry_run: bool = False) -> None:
    """Rename Cholismo -> Transizione, Fergie Time -> Leadership in-place."""
    renames = [
        ("cholismo", "transizione", "Transizione"),
        ("fergie_time", "leadership", "Leadership"),
    ]
    for old_slug, new_slug, new_name in renames:
        if dry_run:
            print(f"  [DRY] Rename {old_slug} -> {new_slug}")
            continue
        sb.table("tactical_philosophies").update({
            "slug": new_slug, "name": new_name
        }).eq("slug", old_slug).execute()
        print(f"  Renamed {old_slug} -> {new_slug}")


def seed_philosophies(dry_run: bool = False) -> None:
    print(f"{'[DRY RUN] ' if dry_run else ''}Seeding {len(PHILOSOPHIES)} tactical philosophies...")

    for phil in PHILOSOPHIES:
        row = {
            "name": phil["name"],
            "slug": phil["slug"],
            "tagline": phil["tagline"],
            "origin_story": phil["origin_story"],
            "key_principles": phil["key_principles"],
            "defining_managers": phil["defining_managers"],
            "era": phil["era"],
            "archetype_requirements": json.dumps(phil["archetype_requirements"]),
            "personality_preferences": json.dumps(phil["personality_preferences"]),
            "preferred_tags": phil["preferred_tags"],
            "concern_tags": phil["concern_tags"],
            "key_attributes": phil["key_attributes"],
            "possession_orientation": phil["possession_orientation"],
            "pressing_intensity": phil["pressing_intensity"],
            "directness": phil["directness"],
            "defensive_depth": phil["defensive_depth"],
            "width_emphasis": phil["width_emphasis"],
            "fluidity": phil["fluidity"],
        }
        print(f"  {phil['name']} ({phil['slug']})")
        if not dry_run:
            sb.table("tactical_philosophies").upsert(row, on_conflict="slug").execute()

    print("Done seeding philosophies.\n")


def seed_systems(dry_run: bool = False) -> None:
    """Seed tactical_systems, system_slots, and slot_roles."""
    # Get philosophy ID map
    result = sb.table("tactical_philosophies").select("id, slug").execute()
    phil_map = {r["slug"]: r["id"] for r in result.data}

    if not dry_run:
        # Clear existing data (cascade will handle slots + roles)
        sb.table("tactical_systems").delete().neq("id", 0).execute()

    total_systems = 0
    total_slots = 0
    total_roles = 0

    for sys_def in SYSTEMS:
        phil_id = phil_map.get(sys_def["philosophy_slug"])
        if not phil_id:
            print(f"  WARNING: philosophy '{sys_def['philosophy_slug']}' not found")
            continue

        system_row = {
            "philosophy_id": phil_id,
            "slug": sys_def["slug"],
            "name": sys_def["name"],
            "formation": sys_def["formation"],
            "defining_team": sys_def.get("defining_team"),
            "key_principle": sys_def.get("key_principle"),
        }

        if dry_run:
            print(f"  [DRY] System: {sys_def['name']} ({sys_def['formation']})")
            total_systems += 1
            for label, pos, sort, default_role, alts in sys_def["slots"]:
                total_slots += 1
                total_roles += 1 + len(alts)
            continue

        # Insert system
        res = sb.table("tactical_systems").insert(system_row).execute()
        system_id = res.data[0]["id"]
        total_systems += 1

        for label, pos, sort, default_role, alts in sys_def["slots"]:
            # Insert slot
            slot_row = {
                "system_id": system_id,
                "slot_label": label,
                "position": pos,
                "sort_order": sort,
            }
            slot_res = sb.table("system_slots").insert(slot_row).execute()
            slot_id = slot_res.data[0]["id"]
            total_slots += 1

            # Insert default role
            key = (default_role, pos)
            if key not in ROLE_LOOKUP:
                print(f"  WARNING: role '{default_role}' at {pos} not in ROLE_LOOKUP")
                continue
            primary, secondary = ROLE_LOOKUP[key]
            role_row = {
                "slot_id": slot_id,
                "role_name": default_role,
                "is_default": True,
                "primary_model": primary,
                "secondary_model": secondary,
            }
            sb.table("slot_roles").insert(role_row).execute()
            total_roles += 1

            # Insert alt roles
            for alt_role in alts:
                alt_key = (alt_role, pos)
                if alt_key not in ROLE_LOOKUP:
                    print(f"  WARNING: alt role '{alt_role}' at {pos} not in ROLE_LOOKUP")
                    continue
                ap, as_ = ROLE_LOOKUP[alt_key]
                alt_row = {
                    "slot_id": slot_id,
                    "role_name": alt_role,
                    "is_default": False,
                    "primary_model": ap,
                    "secondary_model": as_,
                }
                sb.table("slot_roles").insert(alt_row).execute()
                total_roles += 1

    print(f"  {total_systems} systems, {total_slots} slots, {total_roles} roles seeded")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed tactical philosophies + systems")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    rename_philosophies(dry_run=args.dry_run)
    seed_philosophies(dry_run=args.dry_run)
    seed_systems(dry_run=args.dry_run)

    print("All done!")
