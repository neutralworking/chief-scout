#!/usr/bin/env python3
"""
Seed tactical philosophies, philosophy-formation links, and philosophy-role links.

10 named philosophies drawn from Inverting the Pyramid, each with visible lineage,
prophets and disciples, and real names football people use.

Usage:
    python pipeline/31_seed_philosophies.py [--dry-run]
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
        "name": "Cholismo",
        "slug": "cholismo",
        "tagline": "Controlled aggression. The compact block as collective weapon. Win ugly, win always.",
        "origin_story": (
            "Carlos Bilardo won the 1986 World Cup with Argentina playing cynical, brilliant, ruthless football "
            "— Maradona's genius weaponised by a manager who understood that football is war by other means. "
            "Diego Simeone was Bilardo's spiritual heir. When he took over Atlético Madrid in 2011, they were "
            "a mid-table mess. Within three years they won La Liga, reached the Champions League final, and "
            "terrified Barcelona and Real Madrid. The system: a 4-4-2 defensive block so compact you could "
            "cover it with a bedsheet. Every player within 25 metres of every other player. The block absorbs "
            "pressure, then explodes on the counter through Koke's switches and the speed of the front two. "
            "Germán Burgos, his assistant, embodied the mentality — a former goalkeeper with a face like a "
            "clenched fist. Cholismo demands: you suffer, you sacrifice, you fight for every centimetre, and "
            "when the moment comes — the transition, the set piece, the second ball — you are clinical. "
            "Simeone's Atlético spent a decade competing against squads worth three times as much by sheer "
            "force of collective will and tactical discipline."
        ),
        "key_principles": [
            "Compact defensive block — 25m between lines",
            "Counter-attack as art form",
            "Controlled aggression in every duel",
            "Set pieces as legitimate primary weapon",
            "Collective suffering as path to victory",
        ],
        "defining_managers": ["Bilardo", "Simeone", "Burgos"],
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
        "name": "Fergie Time",
        "slug": "fergie_time",
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
        "defining_managers": ["Shankly", "Clough", "Ferguson"],
        "era": "1960s-2013",
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

# ── Philosophy ↔ Formation affinities ────────────────────────────────────────
# Maps philosophy slug → list of (formation_name, affinity)

PHILOSOPHY_FORMATIONS = {
    "garra_charrua": [
        ("4-4-2", "primary"),
        ("4-5-1", "primary"),
        ("5-4-1", "secondary"),
        ("5-3-2", "secondary"),
        ("4-4-1-1", "compatible"),
    ],
    "catenaccio": [
        ("5-3-2", "primary"),
        ("5-4-1", "primary"),
        ("3-5-2", "secondary"),
        ("4-5-1", "secondary"),
        ("4-4-1-1", "compatible"),
        ("4-3-1-2", "compatible"),
    ],
    "joga_bonito": [
        ("4-2-4", "primary"),
        ("4-3-3", "secondary"),
        ("4-2-3-1", "secondary"),
        ("3-4-3", "compatible"),
        ("4-2-2-2", "compatible"),
    ],
    "total_football": [
        ("4-3-3", "primary"),
        ("3-4-3", "secondary"),
        ("3-3-4", "secondary"),
        ("4-2-3-1", "compatible"),
        ("3-3-1-3", "compatible"),
    ],
    "la_masia": [
        ("4-3-3", "primary"),
        ("4-6-0", "primary"),
        ("4-2-3-1", "secondary"),
        ("3-4-3", "secondary"),
        ("4-1-2-1-2", "compatible"),
    ],
    "gegenpressing": [
        ("4-2-3-1", "primary"),
        ("4-3-3", "primary"),
        ("4-4-2", "secondary"),
        ("3-4-3", "secondary"),
        ("4-1-2-1-2", "compatible"),
    ],
    "bielsismo": [
        ("3-3-1-3", "primary"),
        ("3-4-3", "secondary"),
        ("3-3-4", "secondary"),
        ("4-3-3", "compatible"),
        ("4-2-3-1", "compatible"),
    ],
    "cholismo": [
        ("4-4-2", "primary"),
        ("4-3-1-2", "primary"),
        ("4-5-1", "secondary"),
        ("5-3-2", "secondary"),
        ("4-4-1-1", "compatible"),
    ],
    "pomo": [
        ("4-4-2", "primary"),
        ("4-5-1", "primary"),
        ("5-4-1", "secondary"),
        ("4-4-1-1", "secondary"),
        ("3-5-2", "compatible"),
    ],
    "fergie_time": [
        ("4-4-2", "primary"),
        ("4-3-3", "secondary"),
        ("4-5-1", "secondary"),
        ("4-2-3-1", "secondary"),
        ("4-4-1-1", "compatible"),
    ],
}

# ── Philosophy ↔ Role affinities ─────────────────────────────────────────────
# Maps philosophy slug → list of (role_name, importance, rationale)

PHILOSOPHY_ROLES = {
    "garra_charrua": [
        ("Vorstopper", "essential", "The warrior CB — wins duels, sets the tone"),
        ("Volante", "essential", "Aggressive midfield enforcer"),
        ("Anchor", "preferred", "Shields the defence with discipline"),
        ("Prima Punta", "preferred", "Holds ball up, aerial threat from set pieces"),
        ("Tuttocampista", "preferred", "Covers every blade of grass"),
        ("Shotstopper", "compatible", "Traditional keeper, commands area"),
    ],
    "catenaccio": [
        ("Sweeper", "essential", "The libero — last man, reads danger"),
        ("Vorstopper", "essential", "Marks the striker, wins every duel"),
        ("Anchor", "essential", "Positional discipline in front of defence"),
        ("Poacher", "preferred", "Clinical from few chances"),
        ("Invertido", "preferred", "Tucks in defensively, adds numbers"),
        ("Regista", "compatible", "Controls tempo from deep"),
    ],
    "joga_bonito": [
        ("Trequartista", "essential", "The free-roaming 10 — pure creativity"),
        ("Inside Forward", "essential", "Cuts inside, creates and scores"),
        ("Inventor", "preferred", "Drifts and creates from the flanks"),
        ("Falso Nove", "preferred", "Drops deep, links play"),
        ("Mezzala", "preferred", "Arrives in the box from deep"),
        ("Spearhead", "compatible", "All-round threat"),
    ],
    "total_football": [
        ("Tuttocampista", "essential", "Covers multiple positions seamlessly"),
        ("Libero", "essential", "Defender who joins the attack"),
        ("Mezzala", "essential", "Half-space runner, positional interchange"),
        ("Corredor", "preferred", "Full-pitch coverage"),
        ("Falso Nove", "preferred", "Positional fluidity in attack"),
        ("Regista", "preferred", "Deep orchestrator"),
    ],
    "la_masia": [
        ("Regista", "essential", "The Busquets role — dictates tempo from the pivot"),
        ("Pivote", "essential", "The Xavi role — receives deep, orchestrates"),
        ("Mezzala", "essential", "The Iniesta role — arrives in the box from the half-space"),
        ("Libero", "essential", "Builds from the back"),
        ("Falso Nove", "preferred", "The Messi role — drops deep, creates space"),
        ("Invertido", "preferred", "Tucks inside to form midfield diamond"),
        ("Sweeper Keeper", "preferred", "High line, distribution"),
    ],
    "gegenpressing": [
        ("Spearhead", "essential", "Leads the counter-press from the front"),
        ("Volante", "essential", "Wins the ball in the middle third"),
        ("Tuttocampista", "essential", "Covers both ends with intensity"),
        ("Corredor", "preferred", "Full-pitch energy"),
        ("Inside Forward", "preferred", "Presses and transitions"),
        ("Sweeper Keeper", "preferred", "High line support, distribution"),
    ],
    "bielsismo": [
        ("Corredor", "essential", "Extreme width, tireless running"),
        ("Spearhead", "essential", "Man-marks the CB, relentless"),
        ("Volante", "essential", "Man-oriented pressing in midfield"),
        ("Direct Winger", "preferred", "Beats fullback 1v1, creates width"),
        ("Mezzala", "preferred", "Arrives in the box from the half-space"),
        ("Libero", "compatible", "Starts attacks from the back"),
    ],
    "cholismo": [
        ("Anchor", "essential", "Shields the back four, positional anchor"),
        ("Vorstopper", "essential", "Aggressive, front-foot CB"),
        ("Poacher", "essential", "Clinical from counter-attacks"),
        ("Extremo", "preferred", "Pace on the transition"),
        ("Tuttocampista", "preferred", "Covers the midfield"),
        ("Lateral", "compatible", "Provides width when needed"),
    ],
    "pomo": [
        ("Prima Punta", "essential", "Aerial dominance, hold-up play"),
        ("Vorstopper", "essential", "Physical, aggressive defending"),
        ("Lateral", "preferred", "Delivers set-piece crosses"),
        ("Anchor", "preferred", "Sits and protects"),
        ("Winger", "preferred", "Delivers crosses into the box"),
        ("Poacher", "compatible", "Feeds off second balls and set pieces"),
    ],
    "fergie_time": [
        ("Tuttocampista", "essential", "The Keane/Scholes engine room"),
        ("Inside Forward", "essential", "The Ronaldo/Giggs wing threat"),
        ("Spearhead", "essential", "The all-round 9"),
        ("Direct Winger", "preferred", "Pace and directness on the flanks"),
        ("Libero", "preferred", "Builds from the back when needed"),
        ("Sweeper Keeper", "compatible", "Commands the area"),
    ],
}


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


def seed_philosophy_formations(dry_run: bool = False) -> None:
    # Fetch formation name→id map
    formations_resp = sb.table("formations").select("id, name").execute()
    formation_map = {f["name"]: f["id"] for f in (formations_resp.data or [])}

    # Fetch philosophy slug→id map
    phil_resp = sb.table("tactical_philosophies").select("id, slug").execute()
    phil_map = {p["slug"]: p["id"] for p in (phil_resp.data or [])}

    print(f"{'[DRY RUN] ' if dry_run else ''}Seeding philosophy-formation links...")
    inserted = 0
    skipped = 0

    for slug, links in PHILOSOPHY_FORMATIONS.items():
        phil_id = phil_map.get(slug)
        if not phil_id:
            print(f"  WARNING: philosophy '{slug}' not found in DB")
            continue
        for formation_name, affinity in links:
            formation_id = formation_map.get(formation_name)
            if not formation_id:
                print(f"  WARNING: formation '{formation_name}' not found for {slug}")
                skipped += 1
                continue
            row = {
                "philosophy_id": phil_id,
                "formation_id": formation_id,
                "affinity": affinity,
            }
            if not dry_run:
                sb.table("philosophy_formations").upsert(
                    row, on_conflict="philosophy_id,formation_id"
                ).execute()
            inserted += 1

    print(f"  {inserted} links inserted, {skipped} skipped\n")


def seed_philosophy_roles(dry_run: bool = False) -> None:
    # Fetch role name→id map
    roles_resp = sb.table("tactical_roles").select("id, name").execute()
    role_map = {r["name"]: r["id"] for r in (roles_resp.data or [])}

    # Fetch philosophy slug→id map
    phil_resp = sb.table("tactical_philosophies").select("id, slug").execute()
    phil_map = {p["slug"]: p["id"] for p in (phil_resp.data or [])}

    print(f"{'[DRY RUN] ' if dry_run else ''}Seeding philosophy-role links...")
    inserted = 0
    skipped = 0

    for slug, links in PHILOSOPHY_ROLES.items():
        phil_id = phil_map.get(slug)
        if not phil_id:
            print(f"  WARNING: philosophy '{slug}' not found in DB")
            continue
        for role_name, importance, rationale in links:
            role_id = role_map.get(role_name)
            if not role_id:
                print(f"  WARNING: role '{role_name}' not found for {slug}")
                skipped += 1
                continue
            row = {
                "philosophy_id": phil_id,
                "role_id": role_id,
                "importance": importance,
                "rationale": rationale,
            }
            if not dry_run:
                sb.table("philosophy_roles").upsert(
                    row, on_conflict="philosophy_id,role_id"
                ).execute()
            inserted += 1

    print(f"  {inserted} links inserted, {skipped} skipped\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed tactical philosophies")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    seed_philosophies(dry_run=args.dry_run)
    seed_philosophy_formations(dry_run=args.dry_run)
    seed_philosophy_roles(dry_run=args.dry_run)

    print("All done!")
