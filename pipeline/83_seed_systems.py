"""
83_seed_systems.py — Seed tactical systems, slots, and roles.

Populates the philosophy→system→slot→role hierarchy from the
Systems & Roles Redesign spec (2026-03-29).

Usage:
    python 83_seed_systems.py              # seed all (idempotent)
    python 83_seed_systems.py --dry-run    # preview without writing
    python 83_seed_systems.py --force      # clear and re-seed
"""
import argparse
import sys

from config import POSTGRES_DSN
from lib.db import require_conn

parser = argparse.ArgumentParser(description="Seed tactical systems and roles")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Drop and re-seed all systems")
args = parser.parse_args()

conn = require_conn(autocommit=False)
cur = conn.cursor()

# ── Philosophy slug→id map ────────────────────────────────────────────────────

cur.execute("SELECT slug, id FROM tactical_philosophies")
PHIL = dict(cur.fetchall())

# ── System definitions ────────────────────────────────────────────────────────
# Each system: (philosophy_slug, slug, name, formation, defining_team, key_principle)

SYSTEMS = [
    # 1. Garra Charrúa
    ("garra_charrua", "la_celeste", "La Celeste", "4-4-2",
     "Uruguay 1950 / 2010", "Spirit and sacrifice in a compact 4-4-2"),
    ("garra_charrua", "muralla", "Muralla", "5-4-1",
     "Tabárez's Uruguay 2018", "Five-man wall, counter with conviction"),

    # 2. Catenaccio
    ("catenaccio", "grande_inter", "Grande Inter", "5-3-2",
     "Herrera's Inter 1963-66", "Lock the door, counter with precision"),
    ("catenaccio", "trincea", "Trincea", "4-5-1",
     "Capello's Milan / Allegri's Juventus", "Deep block, disciplined lines"),
    ("catenaccio", "il_muro", "Il Muro", "3-5-2",
     "Conte's Italy Euro 2016", "Three-man wall with wing-back width"),

    # 3. Joga Bonito
    ("joga_bonito", "samba", "Samba", "4-2-4",
     "Brazil 1958-62", "Four attackers, express yourself"),
    ("joga_bonito", "o_jogo", "O Jogo", "4-2-3-1",
     "Brazil 1970", "Fluid creativity behind a single striker"),
    ("joga_bonito", "ginga", "Ginga", "4-3-3",
     "Santos (Pelé) / Flamengo 2019", "Rhythm and skill from every angle"),

    # 4. Total Football
    ("total_football", "ajax_model", "Ajax Model", "4-3-3",
     "Michels/Cruyff Ajax 1970-73", "Positional interchange, anyone can play anywhere"),
    ("total_football", "oranje", "Oranje", "3-4-3",
     "Netherlands 1974 WC", "Total fluidity with three at the back"),
    ("total_football", "van_gaal_system", "Van Gaal System", "4-3-3",
     "Ajax 1995 / Van Gaal's Barcelona", "Structured positional play with universal players"),

    # 5. La Masia
    ("la_masia", "positional_play", "Positional Play", "4-3-3",
     "Guardiola's Barcelona 2008-12", "Possession as control, positional superiority"),
    ("la_masia", "inverted_build", "Inverted Build", "3-2-4-1",
     "Guardiola's City 2022-24", "Fullbacks invert, overloads in midfield"),
    ("la_masia", "relational_play", "Relational Play", "4-2-3-1",
     "De Zerbi's Brighton", "Players relate to each other, not fixed positions"),

    # 6. Gegenpressing
    ("gegenpressing", "heavy_metal", "Heavy Metal", "4-2-3-1",
     "Klopp's Dortmund 2010-13", "Win it back in 6 seconds"),
    ("gegenpressing", "red_machine", "Red Machine", "4-3-3",
     "Klopp's Liverpool 2018-20", "Relentless pressing with devastating transitions"),
    ("gegenpressing", "red_bull_model", "Red Bull Model", "4-4-2",
     "Rangnick's Leipzig / Salzburg", "Press in pairs, vertical on recovery"),
    ("gegenpressing", "kyiv_prototype", "Kyiv Prototype", "4-4-2",
     "Lobanovskyi's Dynamo 1986-88", "Scientific pressing before pressing had a name"),

    # 7. Bielsismo
    ("bielsismo", "el_loco", "El Loco", "3-3-1-3",
     "Bielsa's Athletic Bilbao / Leeds", "Man-for-man, never stop running"),
    ("bielsismo", "la_furia", "La Furia", "3-4-3",
     "Gasperini's Atalanta / Sampaoli's Chile", "Aggressive man-marking, overload everywhere"),

    # 8. Transizione
    ("transizione", "the_special_one", "The Special One", "4-2-3-1",
     "Mourinho's Inter 2010", "Defend with structure, attack with speed"),
    ("transizione", "les_bleus", "Les Bleus", "4-2-3-1",
     "Deschamps' France 2018", "World-class talent in a pragmatic shell"),
    ("transizione", "foxes", "Foxes", "4-4-2",
     "Ranieri's Leicester 2016", "Compact and lethal on the break"),

    # 9. POMO
    ("pomo", "route_one", "Route One", "4-4-2",
     "Wimbledon 1988 / Allardyce's Bolton", "Direct, territorial, set-piece dominance"),
    ("pomo", "fortress", "Fortress", "4-5-1",
     "Pulis's Stoke / Dyche's Burnley", "Defend deep, win ugly"),

    # 10. Leadership
    ("leadership", "wing_play", "Wing Play", "4-4-2",
     "Ferguson's United 1996-2001", "Width, pace, and relentless attacking"),
    ("leadership", "european_nights", "European Nights", "4-5-1",
     "Ferguson's United 2008 CL", "Pragmatic shape for big games"),
    ("leadership", "ancelotti_ball", "Ancelotti Ball", "4-3-3",
     "Ancelotti's Real Madrid 2022-24", "Let talent express itself in balanced structure"),
]

# ── Slot & Role definitions per system ────────────────────────────────────────
# Format: system_slug → list of (slot_label, position, sort_order, [(role_name, is_default, primary, secondary, rationale)])
#
# Sort order: GK=1, CBs=2-4, FBs/WBs=5-6, DMs=7-8, CMs=9-11, WMs=12-13, AMs=14, WFs=15-16, CFs=17-18

# ── Role library (reusable across systems) ────────────────────────────────────

# GK roles
R_COMANDANTE   = ("Comandante", "GK", "Commander", "Organises, commands, vocal presence")
R_SWEEPER_GK   = ("Sweeper Keeper", "GK", "Cover", "Sweeps behind high line")
R_LIBERO_GK    = ("Libero GK", "GK", "Passer", "Distribution specialist")
R_SHOTSTOPPER  = ("Shotstopper", "GK", "Powerhouse", "Reflexes, dominates the box")

# CD roles
R_CENTRALE     = ("Centrale", "Commander", "Destroyer", "Commanding CB, organises and leads")
R_DISTRIBUTOR  = ("Distributor", "Passer", "Cover", "Ball-playing CB, progressive passing")
R_STOPPER      = ("Stopper", "Powerhouse", "Destroyer", "Aggressive, front-foot, wins duels")
R_SWEEPER      = ("Sweeper", "Cover", "Controller", "Last man, reads play, covers space")

# WD roles
R_FULLBACK     = ("Fullback", "Engine", "Passer", "Gets forward, supports attacks")
R_WINGBACK     = ("Wing-back", "Engine", "Dribbler", "IS the width, covers entire flank")
R_CORNERBACK   = ("Corner Back", "Cover", "Destroyer", "Stays home, defends, marks")
R_INVERTIDO    = ("Invertido", "Controller", "Passer", "Tucks inside, becomes midfielder")

# DM roles
R_REGISTA      = ("Regista", "Passer", "Controller", "Deep quarterback, dictates with long passing")
R_PIVOTE       = ("Pivote", "Controller", "Cover", "Creative holding mid, controls and distributes")
R_ANCHOR       = ("Anchor", "Destroyer", "Cover", "Sits, disrupts, protects the back line")
R_SEGUNDO_VOL  = ("Segundo Volante", "Powerhouse", "Engine", "DM who drives forward, scores from deep")

# CM roles
R_PLAYMAKER    = ("Playmaker", "Creator", "Passer", "Runs the game with vision and range")
R_METODISTA    = ("Metodista", "Controller", "Passer", "Metronome, controls rhythm")
R_MEZZALA      = ("Mezzala", "Passer", "Creator", "Half-space creator, arrives in the box")
R_TUTTOCAMPISTA = ("Tuttocampista", "Engine", "Cover", "Box-to-box, covers every blade")

# WM roles
R_WINGER_WM    = ("Winger", "Dribbler", "Passer", "Beats man or delivers from wide")
R_TORNANTE     = ("Tornante", "Engine", "Cover", "Tracks back, full-flank both phases")
R_FALSE_WINGER = ("False Winger", "Controller", "Creator", "Starts wide, drifts inside")

# AM roles
R_TREQUARTISTA = ("Trequartista", "Dribbler", "Creator", "Free-roaming creator in the final third")
R_ENGANCHE     = ("Enganche", "Creator", "Controller", "The hook, receives between lines")
R_INCURSORE    = ("Incursore", "Engine", "Striker", "Raider AM who arrives in the box")
R_MEDIAPUNTA   = ("Mediapunta", "Controller", "Creator", "Combinational 10, links through short passing")
R_SECONDA_PUNTA_AM = ("Seconda Punta", "Creator", "Striker", "Second striker from AM, drops and links")

# WF roles
R_INSIDE_FWD   = ("Inside Forward", "Dribbler", "Striker", "Cuts inside on strong foot")
# Raumdeuter is now an archetype, not a role
R_WINGER_WF    = ("Winger", "Dribbler", "Passer", "Wide, beats man, delivers")
R_WIDE_PM      = ("Wide Playmaker", "Creator", "Passer", "Creates from wide, vision and passing")
R_WIDE_TARGET  = ("Wide Target Forward", "Target", "Powerhouse", "Physical presence from wide")

# CF roles
R_POACHER      = ("Poacher", "Striker", "Dribbler", "Box instinct, movement, clinical")
R_PRIMA_PUNTA  = ("Prima Punta", "Striker", "Target", "Clinical finisher, wins headers, occupies CBs")
R_FALSO_NOVE   = ("Falso Nove", "Creator", "Controller", "Drops deep, creates space")
R_SPEARHEAD    = ("Spearhead", "Engine", "Destroyer", "Leads the press from front")
R_TARGET_FWD   = ("Target Forward", "Target", "Powerhouse", "Aerial, holds up, physical reference")
R_SECONDA_PUNTA_CF = ("Seconda Punta", "Creator", "Striker", "Second striker, plays off the main striker")
R_SHADOW_STR   = ("Shadow Striker", "Sprinter", "Striker", "Pace, runs in behind, ghosts past the line")


def role_tuple(role_def, is_default=False):
    """Convert role definition to (name, is_default, primary, secondary, rationale)."""
    return (role_def[0], is_default, role_def[1], role_def[2], role_def[3])


# ── System slot definitions ──────────────────────────────────────────────────
# Each entry: (slot_label, position, sort_order, [role_tuples])

SYSTEM_SLOTS = {
    # ── 1. Garra Charrúa ─────────────────────────────────────────────────────
    "la_celeste": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_CORNERBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_CORNERBACK)]),
        ("RCM", "CM", 6,  [role_tuple(R_TUTTOCAMPISTA, True), role_tuple(R_MEZZALA)]),
        ("LCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True), role_tuple(R_PLAYMAKER)]),
        ("RM",  "WM", 8,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("LM",  "WM", 9,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("RS",  "CF", 10, [role_tuple(R_SPEARHEAD, True), role_tuple(R_TARGET_FWD)]),
        ("LS",  "CF", 11, [role_tuple(R_PRIMA_PUNTA), role_tuple(R_POACHER)]),
    ],
    "muralla": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_STOPPER, True)]),
        ("CB",  "CD", 3,  [role_tuple(R_CENTRALE, True), role_tuple(R_SWEEPER)]),
        ("LCB", "CD", 4,  [role_tuple(R_STOPPER, True)]),
        ("RWB", "WD", 5,  [role_tuple(R_CORNERBACK, True), role_tuple(R_FULLBACK)]),
        ("LWB", "WD", 6,  [role_tuple(R_CORNERBACK, True), role_tuple(R_FULLBACK)]),
        ("RCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RM",  "WM", 9,  [role_tuple(R_TORNANTE, True)]),
        ("LM",  "WM", 10, [role_tuple(R_TORNANTE, True)]),
        ("CF",  "CF", 11, [role_tuple(R_TARGET_FWD, True), role_tuple(R_SPEARHEAD)]),
    ],

    # ── 2. Catenaccio ────────────────────────────────────────────────────────
    "grande_inter": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_STOPPER, True)]),
        ("CB",  "CD", 3,  [role_tuple(R_SWEEPER, True)]),
        ("LCB", "CD", 4,  [role_tuple(R_STOPPER, True)]),
        ("RWB", "WD", 5,  [role_tuple(R_WINGBACK, True), role_tuple(R_FULLBACK)]),
        ("LWB", "WD", 6,  [role_tuple(R_WINGBACK, True), role_tuple(R_FULLBACK)]),
        ("RCM", "CM", 7,  [role_tuple(R_METODISTA, True), role_tuple(R_TUTTOCAMPISTA)]),
        ("LCM", "CM", 8,  [role_tuple(R_MEZZALA, True)]),
        ("AM",  "AM", 9,  [role_tuple(R_TREQUARTISTA, True), role_tuple(R_ENGANCHE)]),
        ("RS",  "CF", 10, [role_tuple(R_POACHER, True), role_tuple(R_SPEARHEAD)]),
        ("LS",  "CF", 11, [role_tuple(R_SECONDA_PUNTA_CF, True)]),
    ],
    "trincea": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("RB",  "WD", 4,  [role_tuple(R_CORNERBACK, True)]),
        ("LB",  "WD", 5,  [role_tuple(R_CORNERBACK, True)]),
        ("RDM", "DM", 6,  [role_tuple(R_ANCHOR, True), role_tuple(R_PIVOTE)]),
        ("RCM", "CM", 7,  [role_tuple(R_METODISTA, True)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RM",  "WM", 9,  [role_tuple(R_TORNANTE, True)]),
        ("LM",  "WM", 10, [role_tuple(R_TORNANTE, True)]),
        ("CF",  "CF", 11, [role_tuple(R_TARGET_FWD, True), role_tuple(R_POACHER)]),
    ],
    "il_muro": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_STOPPER, True)]),
        ("CB",  "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 4,  [role_tuple(R_STOPPER, True)]),
        ("RWB", "WD", 5,  [role_tuple(R_WINGBACK, True)]),
        ("LWB", "WD", 6,  [role_tuple(R_WINGBACK, True)]),
        ("RCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("CM",  "CM", 8,  [role_tuple(R_METODISTA, True), role_tuple(R_PLAYMAKER)]),
        ("LCM", "CM", 9,  [role_tuple(R_MEZZALA, True)]),
        ("RS",  "CF", 10, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_SPEARHEAD)]),
        ("LS",  "CF", 11, [role_tuple(R_POACHER, True), role_tuple(R_SECONDA_PUNTA_CF)]),
    ],

    # ── 3. Joga Bonito ───────────────────────────────────────────────────────
    "samba": [
        ("GK",  "GK", 1,  [role_tuple(R_SHOTSTOPPER, True), role_tuple(R_COMANDANTE)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("RDM", "DM", 6,  [role_tuple(R_PIVOTE, True)]),
        ("LDM", "DM", 7,  [role_tuple(R_ANCHOR, True)]),
        ("RW",  "WF", 8,  [role_tuple(R_WINGER_WF, True), role_tuple(R_INSIDE_FWD)]),
        ("LW",  "WF", 9,  [role_tuple(R_WINGER_WF, True), role_tuple(R_INSIDE_FWD)]),
        ("RS",  "CF", 10, [role_tuple(R_POACHER, True), role_tuple(R_PRIMA_PUNTA)]),
        ("LS",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_SECONDA_PUNTA_CF)]),
    ],
    "o_jogo": [
        ("GK",  "GK", 1,  [role_tuple(R_SHOTSTOPPER, True)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("RDM", "DM", 6,  [role_tuple(R_PIVOTE, True)]),
        ("LDM", "DM", 7,  [role_tuple(R_SEGUNDO_VOL, True), role_tuple(R_ANCHOR)]),
        ("RW",  "WF", 8,  [role_tuple(R_WINGER_WF, True), role_tuple(R_WIDE_PM)]),
        ("AM",  "AM", 9,  [role_tuple(R_TREQUARTISTA, True), role_tuple(R_ENGANCHE)]),
        ("LW",  "WF", 10, [role_tuple(R_WINGER_WF, True), role_tuple(R_INSIDE_FWD)]),
        ("CF",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_FALSO_NOVE)]),
    ],
    "ginga": [
        ("GK",  "GK", 1,  [role_tuple(R_SHOTSTOPPER, True), role_tuple(R_SWEEPER_GK)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("DM",  "DM", 6,  [role_tuple(R_PIVOTE, True), role_tuple(R_REGISTA)]),
        ("RCM", "CM", 7,  [role_tuple(R_MEZZALA, True), role_tuple(R_PLAYMAKER)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RW",  "WF", 9,  [role_tuple(R_WINGER_WF, True), role_tuple(R_INSIDE_FWD)]),
        ("LW",  "WF", 10, [role_tuple(R_WINGER_WF, True), role_tuple(R_INSIDE_FWD)]),
        ("CF",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_POACHER)]),
    ],

    # ── 4. Total Football ────────────────────────────────────────────────────
    "ajax_model": [
        ("GK",  "GK", 1,  [role_tuple(R_SWEEPER_GK, True), role_tuple(R_LIBERO_GK)]),
        ("RCB", "CD", 2,  [role_tuple(R_DISTRIBUTOR, True), role_tuple(R_CENTRALE)]),
        ("LCB", "CD", 3,  [role_tuple(R_DISTRIBUTOR, True), role_tuple(R_SWEEPER)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("DM",  "DM", 6,  [role_tuple(R_PIVOTE, True), role_tuple(R_REGISTA)]),
        ("RCM", "CM", 7,  [role_tuple(R_MEZZALA, True), role_tuple(R_PLAYMAKER)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_FALSO_NOVE)]),
    ],
    "oranje": [
        ("GK",  "GK", 1,  [role_tuple(R_SWEEPER_GK, True)]),
        ("RCB", "CD", 2,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("CB",  "CD", 3,  [role_tuple(R_SWEEPER, True)]),
        ("LCB", "CD", 4,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("RCM", "CM", 5,  [role_tuple(R_MEZZALA, True), role_tuple(R_TUTTOCAMPISTA)]),
        ("CM",  "CM", 6,  [role_tuple(R_PLAYMAKER, True), role_tuple(R_METODISTA)]),
        ("LCM", "CM", 7,  [role_tuple(R_MEZZALA, True), role_tuple(R_TUTTOCAMPISTA)]),
        ("RW",  "WF", 8,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 10, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_FALSO_NOVE)]),
    ],
    "van_gaal_system": [
        ("GK",  "GK", 1,  [role_tuple(R_SWEEPER_GK, True), role_tuple(R_LIBERO_GK)]),
        ("RCB", "CD", 2,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_DISTRIBUTOR, True), role_tuple(R_CENTRALE)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_INVERTIDO)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_INVERTIDO)]),
        ("DM",  "DM", 6,  [role_tuple(R_PIVOTE, True), role_tuple(R_REGISTA)]),
        ("RCM", "CM", 7,  [role_tuple(R_MEZZALA, True)]),
        ("LCM", "CM", 8,  [role_tuple(R_PLAYMAKER, True)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_POACHER)]),
    ],

    # ── 5. La Masia ──────────────────────────────────────────────────────────
    "positional_play": [
        ("GK",  "GK", 1,  [role_tuple(R_LIBERO_GK, True), role_tuple(R_SWEEPER_GK)]),
        ("RCB", "CD", 2,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_INVERTIDO, True), role_tuple(R_FULLBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_INVERTIDO, True), role_tuple(R_FULLBACK)]),
        ("DM",  "DM", 6,  [role_tuple(R_PIVOTE, True), role_tuple(R_REGISTA)]),
        ("RCM", "CM", 7,  [role_tuple(R_MEZZALA, True), role_tuple(R_METODISTA)]),
        ("LCM", "CM", 8,  [role_tuple(R_METODISTA, True), role_tuple(R_PLAYMAKER)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WIDE_PM)]),
        ("CF",  "CF", 11, [role_tuple(R_FALSO_NOVE, True), role_tuple(R_PRIMA_PUNTA)]),
    ],
    "inverted_build": [
        ("GK",  "GK", 1,  [role_tuple(R_LIBERO_GK, True)]),
        ("RCB", "CD", 2,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("CB",  "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 4,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("RB",  "WD", 5,  [role_tuple(R_INVERTIDO, True)]),
        ("LB",  "WD", 6,  [role_tuple(R_INVERTIDO, True)]),
        ("RW",  "WF", 7,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("AM",  "AM", 8,  [role_tuple(R_TREQUARTISTA, True), role_tuple(R_SECONDA_PUNTA_AM)]),
        ("LW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WIDE_PM)]),
        ("CF",  "CF", 10, [role_tuple(R_FALSO_NOVE, True), role_tuple(R_PRIMA_PUNTA)]),
    ],
    "relational_play": [
        ("GK",  "GK", 1,  [role_tuple(R_LIBERO_GK, True), role_tuple(R_SWEEPER_GK)]),
        ("RCB", "CD", 2,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_INVERTIDO, True), role_tuple(R_FULLBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_INVERTIDO, True), role_tuple(R_FULLBACK)]),
        ("RDM", "DM", 6,  [role_tuple(R_REGISTA, True), role_tuple(R_PIVOTE)]),
        ("LDM", "DM", 7,  [role_tuple(R_PIVOTE, True)]),
        ("AM",  "AM", 8,  [role_tuple(R_TREQUARTISTA, True), role_tuple(R_ENGANCHE)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_WIDE_PM, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_FALSO_NOVE, True), role_tuple(R_PRIMA_PUNTA)]),
    ],

    # ── 6. Gegenpressing ─────────────────────────────────────────────────────
    "heavy_metal": [
        ("GK",  "GK", 1,  [role_tuple(R_SWEEPER_GK, True), role_tuple(R_COMANDANTE)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("RDM", "DM", 6,  [role_tuple(R_ANCHOR, True), role_tuple(R_PIVOTE)]),
        ("LDM", "DM", 7,  [role_tuple(R_SEGUNDO_VOL, True)]),
        ("AM",  "AM", 8,  [role_tuple(R_TREQUARTISTA, True), role_tuple(R_INCURSORE)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_SPEARHEAD, True), role_tuple(R_PRIMA_PUNTA)]),
    ],
    "red_machine": [
        ("GK",  "GK", 1,  [role_tuple(R_SWEEPER_GK, True), role_tuple(R_LIBERO_GK)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("DM",  "DM", 6,  [role_tuple(R_ANCHOR, True), role_tuple(R_PIVOTE)]),
        ("RCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True), role_tuple(R_MEZZALA)]),
        ("LCM", "CM", 8,  [role_tuple(R_MEZZALA, True), role_tuple(R_METODISTA)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_SPEARHEAD, True), role_tuple(R_PRIMA_PUNTA)]),
    ],
    "red_bull_model": [
        ("GK",  "GK", 1,  [role_tuple(R_SWEEPER_GK, True)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True)]),
        ("RCM", "CM", 6,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("LCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True), role_tuple(R_MEZZALA)]),
        ("RM",  "WM", 8,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("LM",  "WM", 9,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("RS",  "CF", 10, [role_tuple(R_SPEARHEAD, True), role_tuple(R_SHADOW_STR)]),
        ("LS",  "CF", 11, [role_tuple(R_SPEARHEAD, True), role_tuple(R_POACHER)]),
    ],
    "kyiv_prototype": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True)]),
        ("RCM", "CM", 6,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("LCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RM",  "WM", 8,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("LM",  "WM", 9,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("RS",  "CF", 10, [role_tuple(R_SPEARHEAD, True)]),
        ("LS",  "CF", 11, [role_tuple(R_SHADOW_STR, True), role_tuple(R_POACHER)]),
    ],

    # ── 7. Bielsismo ─────────────────────────────────────────────────────────
    "el_loco": [
        ("GK",  "GK", 1,  [role_tuple(R_SWEEPER_GK, True)]),
        ("RCB", "CD", 2,  [role_tuple(R_STOPPER, True)]),
        ("CB",  "CD", 3,  [role_tuple(R_DISTRIBUTOR, True)]),
        ("LCB", "CD", 4,  [role_tuple(R_STOPPER, True)]),
        ("RDM", "DM", 5,  [role_tuple(R_ANCHOR, True)]),
        ("CDM", "DM", 6,  [role_tuple(R_PIVOTE, True)]),
        ("LDM", "DM", 7,  [role_tuple(R_SEGUNDO_VOL, True)]),
        ("AM",  "AM", 8,  [role_tuple(R_TREQUARTISTA, True), role_tuple(R_INCURSORE)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_SPEARHEAD, True), role_tuple(R_PRIMA_PUNTA)]),
    ],
    "la_furia": [
        ("GK",  "GK", 1,  [role_tuple(R_SWEEPER_GK, True)]),
        ("RCB", "CD", 2,  [role_tuple(R_STOPPER, True)]),
        ("CB",  "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 4,  [role_tuple(R_STOPPER, True)]),
        ("RWB", "WD", 5,  [role_tuple(R_WINGBACK, True)]),
        ("LWB", "WD", 6,  [role_tuple(R_WINGBACK, True)]),
        ("RCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True), role_tuple(R_MEZZALA)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_SPEARHEAD, True), role_tuple(R_PRIMA_PUNTA)]),
    ],

    # ── 8. Transizione ───────────────────────────────────────────────────────
    "the_special_one": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_CORNERBACK, True), role_tuple(R_FULLBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_CORNERBACK, True), role_tuple(R_FULLBACK)]),
        ("RDM", "DM", 6,  [role_tuple(R_ANCHOR, True)]),
        ("LDM", "DM", 7,  [role_tuple(R_PIVOTE, True), role_tuple(R_SEGUNDO_VOL)]),
        ("AM",  "AM", 8,  [role_tuple(R_TREQUARTISTA, True), role_tuple(R_SECONDA_PUNTA_AM)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_TARGET_FWD)]),
    ],
    "les_bleus": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True), role_tuple(R_DISTRIBUTOR)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_CORNERBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_CORNERBACK)]),
        ("RDM", "DM", 6,  [role_tuple(R_ANCHOR, True), role_tuple(R_PIVOTE)]),
        ("LDM", "DM", 7,  [role_tuple(R_SEGUNDO_VOL, True)]),
        ("AM",  "AM", 8,  [role_tuple(R_SECONDA_PUNTA_AM, True), role_tuple(R_TREQUARTISTA)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("CF",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_SHADOW_STR)]),
    ],
    "foxes": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_CORNERBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_CORNERBACK)]),
        ("RCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True), role_tuple(R_METODISTA)]),
        ("RM",  "WM", 9,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("LM",  "WM", 10, [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE), role_tuple(R_FALSE_WINGER)]),
        ("RS",  "CF", 11, [role_tuple(R_SHADOW_STR, True), role_tuple(R_POACHER)]),
        ("LS",  "CF", 12, [role_tuple(R_SPEARHEAD, True), role_tuple(R_TARGET_FWD)]),
    ],

    # ── 9. POMO ──────────────────────────────────────────────────────────────
    "route_one": [
        ("GK",  "GK", 1,  [role_tuple(R_SHOTSTOPPER, True), role_tuple(R_COMANDANTE)]),
        ("RCB", "CD", 2,  [role_tuple(R_STOPPER, True), role_tuple(R_CENTRALE)]),
        ("LCB", "CD", 3,  [role_tuple(R_STOPPER, True), role_tuple(R_CENTRALE)]),
        ("RB",  "WD", 4,  [role_tuple(R_CORNERBACK, True), role_tuple(R_FULLBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_CORNERBACK, True), role_tuple(R_FULLBACK)]),
        ("RCM", "CM", 6,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("LCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RM",  "WM", 8,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("LM",  "WM", 9,  [role_tuple(R_WINGER_WM, True), role_tuple(R_TORNANTE)]),
        ("RS",  "CF", 10, [role_tuple(R_TARGET_FWD, True), role_tuple(R_SPEARHEAD)]),
        ("LS",  "CF", 11, [role_tuple(R_POACHER, True), role_tuple(R_SHADOW_STR)]),
    ],
    "fortress": [
        ("GK",  "GK", 1,  [role_tuple(R_SHOTSTOPPER, True), role_tuple(R_COMANDANTE)]),
        ("RCB", "CD", 2,  [role_tuple(R_STOPPER, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_STOPPER, True), role_tuple(R_CENTRALE)]),
        ("RB",  "WD", 4,  [role_tuple(R_CORNERBACK, True)]),
        ("LB",  "WD", 5,  [role_tuple(R_CORNERBACK, True)]),
        ("DM",  "DM", 6,  [role_tuple(R_ANCHOR, True)]),
        ("RCM", "CM", 7,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RM",  "WM", 9,  [role_tuple(R_TORNANTE, True)]),
        ("LM",  "WM", 10, [role_tuple(R_TORNANTE, True)]),
        ("CF",  "CF", 11, [role_tuple(R_TARGET_FWD, True), role_tuple(R_SPEARHEAD)]),
    ],

    # ── 10. Leadership ───────────────────────────────────────────────────────
    "wing_play": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True), role_tuple(R_STOPPER)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("RCM", "CM", 7,  [role_tuple(R_PLAYMAKER, True), role_tuple(R_MEZZALA)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RM",  "WM", 9,  [role_tuple(R_WINGER_WM, True)]),
        ("LM",  "WM", 10, [role_tuple(R_WINGER_WM, True)]),
        ("RS",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_POACHER)]),
        ("LS",  "CF", 12, [role_tuple(R_SECONDA_PUNTA_CF, True), role_tuple(R_SHADOW_STR)]),
    ],
    "european_nights": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SHOTSTOPPER)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True), role_tuple(R_DISTRIBUTOR)]),
        ("RB",  "WD", 4,  [role_tuple(R_CORNERBACK, True), role_tuple(R_FULLBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_CORNERBACK, True), role_tuple(R_FULLBACK)]),
        ("DM",  "DM", 6,  [role_tuple(R_ANCHOR, True), role_tuple(R_PIVOTE)]),
        ("RCM", "CM", 7,  [role_tuple(R_METODISTA, True), role_tuple(R_PLAYMAKER)]),
        ("LCM", "CM", 8,  [role_tuple(R_TUTTOCAMPISTA, True)]),
        ("RM",  "WM", 9,  [role_tuple(R_TORNANTE, True), role_tuple(R_WINGER_WM)]),
        ("LM",  "WM", 10, [role_tuple(R_TORNANTE, True), role_tuple(R_FALSE_WINGER)]),
        ("CF",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_TARGET_FWD)]),
    ],
    "ancelotti_ball": [
        ("GK",  "GK", 1,  [role_tuple(R_COMANDANTE, True), role_tuple(R_SWEEPER_GK)]),
        ("RCB", "CD", 2,  [role_tuple(R_CENTRALE, True), role_tuple(R_DISTRIBUTOR)]),
        ("LCB", "CD", 3,  [role_tuple(R_CENTRALE, True)]),
        ("RB",  "WD", 4,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("LB",  "WD", 5,  [role_tuple(R_FULLBACK, True), role_tuple(R_WINGBACK)]),
        ("DM",  "DM", 6,  [role_tuple(R_PIVOTE, True), role_tuple(R_ANCHOR)]),
        ("RCM", "CM", 7,  [role_tuple(R_PLAYMAKER, True), role_tuple(R_MEZZALA)]),
        ("LCM", "CM", 8,  [role_tuple(R_METODISTA, True), role_tuple(R_TUTTOCAMPISTA)]),
        ("RW",  "WF", 9,  [role_tuple(R_INSIDE_FWD, True), role_tuple(R_WINGER_WF)]),
        ("LW",  "WF", 10, [role_tuple(R_WIDE_PM, True), role_tuple(R_INSIDE_FWD)]),
        ("CF",  "CF", 11, [role_tuple(R_PRIMA_PUNTA, True), role_tuple(R_POACHER)]),
    ],
}


def main():
    if args.force:
        print("Force mode: clearing existing systems, slots, and roles...")
        if not args.dry_run:
            cur.execute("DELETE FROM slot_roles")
            cur.execute("DELETE FROM system_slots")
            cur.execute("DELETE FROM tactical_systems")

    # Check existing
    cur.execute("SELECT COUNT(*) FROM tactical_systems")
    existing = cur.fetchone()[0]
    if existing > 0 and not args.force:
        print(f"  {existing} systems already exist. Use --force to re-seed.")
        return

    # Insert systems
    system_ids = {}
    for phil_slug, slug, name, formation, defining_team, key_principle in SYSTEMS:
        phil_id = PHIL.get(phil_slug)
        if phil_id is None:
            print(f"  WARNING: Philosophy '{phil_slug}' not found, skipping system '{slug}'")
            continue
        if args.dry_run:
            print(f"  [DRY] System: {name} ({formation}) → {phil_slug}")
            system_ids[slug] = slug  # placeholder
        else:
            cur.execute("""
                INSERT INTO tactical_systems (philosophy_id, slug, name, formation, defining_team, key_principle)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (phil_id, slug, name, formation, defining_team, key_principle))
            system_ids[slug] = cur.fetchone()[0]

    print(f"  Inserted {len(system_ids)} systems")

    # Insert slots and roles
    total_slots = 0
    total_roles = 0
    for system_slug, slots in SYSTEM_SLOTS.items():
        sys_id = system_ids.get(system_slug)
        if sys_id is None:
            print(f"  WARNING: System '{system_slug}' not found, skipping slots")
            continue
        for slot_label, position, sort_order, roles in slots:
            if args.dry_run:
                print(f"  [DRY] Slot: {system_slug}/{slot_label} ({position}) → {len(roles)} roles")
                total_slots += 1
                total_roles += len(roles)
                continue
            cur.execute("""
                INSERT INTO system_slots (system_id, slot_label, position, sort_order)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (sys_id, slot_label, position, sort_order))
            slot_id = cur.fetchone()[0]
            total_slots += 1
            for role_name, is_default, primary, secondary, rationale in roles:
                cur.execute("""
                    INSERT INTO slot_roles (slot_id, role_name, is_default, primary_model, secondary_model, rationale)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (slot_id, role_name, is_default, primary, secondary, rationale))
                total_roles += 1

    print(f"  Inserted {total_slots} slots, {total_roles} roles")

    # Validate: check distinct roles per position
    if not args.dry_run:
        cur.execute("""
            SELECT ss.position, COUNT(DISTINCT sr.role_name) as role_count,
                   ARRAY_AGG(DISTINCT sr.role_name ORDER BY sr.role_name)
            FROM slot_roles sr
            JOIN system_slots ss ON sr.slot_id = ss.id
            GROUP BY ss.position
            ORDER BY ss.position
        """)
        print("\n  Valid roles per position:")
        total_distinct = 0
        for pos, count, roles in cur.fetchall():
            print(f"    {pos}: {count} — {', '.join(roles)}")
            total_distinct += count
        print(f"  Total distinct role×position: {total_distinct}")

    if not args.dry_run:
        conn.commit()
        print("\nDone — systems and roles seeded.")
    else:
        print("\n[DRY RUN] No changes written.")


if __name__ == "__main__":
    main()
