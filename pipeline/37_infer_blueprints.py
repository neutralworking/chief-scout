"""
39_infer_blueprints.py — Deterministic blueprint assignment from archetype + position + attributes.

Maps archetype + position combinations to blueprint labels using the 49 manually-assigned
blueprints as a reference taxonomy. No LLM needed — pure lookup + heuristic.

Usage:
    python 39_infer_blueprints.py --dry-run        # preview
    python 39_infer_blueprints.py                  # apply
    python 39_infer_blueprints.py --force           # overwrite existing blueprints
    python 39_infer_blueprints.py --player 123      # single player
"""
from __future__ import annotations

import argparse
import sys

import psycopg2

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Infer blueprints from archetype + position")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Overwrite existing blueprints")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

# ── Blueprint taxonomy ────────────────────────────────────────────────────────
# Derived from 49 manually-assigned blueprints.
# Key: (position_group, primary_archetype) → blueprint
# position_group: GK, DEF (CD/WD), MID (DM/CM/WM), ATT (AM/WF/CF)
# Falls through: primary archetype → position default → "Utility"

# Position-specific archetype → blueprint mappings
BLUEPRINT_MAP = {
    # ── GK ──
    ("GK", "GK"): "Shot-Stopper",
    ("GK", "GK-Controller"): "Complete Keeper",
    ("GK", "Commander"): "Shot-Stopper",
    ("GK", "Controller"): "Modern Keeper",

    # ── CD ──
    ("DEF", "Cover"): "Modern CB",
    ("DEF", "Cover-Passer"): "Libero",
    ("DEF", "Cover-Controller"): "Libero",
    ("DEF", "Cover-Destroyer"): "Modern CB",
    ("DEF", "Cover-Engine"): "Hybrid Defender",
    ("DEF", "Cover-Commander"): "Modern CB",
    ("DEF", "Cover-Powerhouse"): "Traditional CB",
    ("DEF", "Cover-Target"): "Traditional CB",
    ("DEF", "Cover-Striker"): "Hybrid Defender",
    ("DEF", "Destroyer"): "Traditional CB",
    ("DEF", "Destroyer-Cover"): "Traditional CB",
    ("DEF", "Destroyer-Target"): "Aggressive CB",
    ("DEF", "Destroyer-Commander"): "Aggressive CB",
    ("DEF", "Destroyer-Powerhouse"): "Aggressive CB",
    ("DEF", "Destroyer-Engine"): "Volante",
    ("DEF", "Destroyer-Controller"): "Libero",
    ("DEF", "Destroyer-Sprinter"): "Aggressive CB",
    ("DEF", "Controller"): "Libero",
    ("DEF", "Controller-Cover"): "Libero",
    ("DEF", "Passer"): "Progressor CB",
    ("DEF", "Passer-Cover"): "Progressor CB",
    ("DEF", "Commander"): "Traditional CB",
    ("DEF", "Commander-Cover"): "Traditional CB",
    ("DEF", "Commander-Destroyer"): "Aggressive CB",
    ("DEF", "Target"): "Traditional CB",
    ("DEF", "Powerhouse"): "Traditional CB",

    # ── WD ──
    ("WD", "Engine"): "Two-Way Full-Back",
    ("WD", "Engine-Sprinter"): "Lateral",
    ("WD", "Engine-Creator"): "Attacking Full-Back",
    ("WD", "Engine-Dribbler"): "Invertido",
    ("WD", "Engine-Cover"): "Two-Way Full-Back",
    ("WD", "Engine-Destroyer"): "Two-Way Full-Back",
    ("WD", "Engine-Commander"): "Two-Way Full-Back",
    ("WD", "Sprinter"): "Lateral",
    ("WD", "Sprinter-Engine"): "Flanker",
    ("WD", "Sprinter-Dribbler"): "Flanker",
    ("WD", "Sprinter-Cover"): "Lateral",
    ("WD", "Sprinter-Creator"): "Attacking Full-Back",
    ("WD", "Sprinter-Destroyer"): "Lateral",
    ("WD", "Creator"): "Playmaking Full-Back",
    ("WD", "Creator-Passer"): "Playmaking Full-Back",
    ("WD", "Creator-Engine"): "Attacking Full-Back",
    ("WD", "Passer"): "Ball-Playing Fullback",
    ("WD", "Passer-Engine"): "Ball-Playing Fullback",
    ("WD", "Passer-Cover"): "Ball-Playing Fullback",
    ("WD", "Passer-Creator"): "Playmaking Full-Back",
    ("WD", "Passer-Sprinter"): "Attacking Full-Back",
    ("WD", "Cover"): "Defensive Full-Back",
    ("WD", "Cover-Engine"): "Two-Way Full-Back",
    ("WD", "Destroyer"): "Defensive Full-Back",
    ("WD", "Controller"): "Invertido",
    ("WD", "Dribbler"): "Attacking Full-Back",

    # ── DM ──
    ("DM", "Controller"): "Deep-Lying Playmaker",
    ("DM", "Controller-Destroyer"): "Conductor",
    ("DM", "Controller-Engine"): "Conductor",
    ("DM", "Controller-Cover"): "Deep-Lying Playmaker",
    ("DM", "Controller-Creator"): "Regista",
    ("DM", "Destroyer"): "Anchor",
    ("DM", "Destroyer-Cover"): "Anchor",
    ("DM", "Destroyer-Engine"): "Box-to-Box Anchor",
    ("DM", "Destroyer-Commander"): "Anchor",
    ("DM", "Destroyer-Target"): "Anchor",
    ("DM", "Destroyer-Powerhouse"): "Anchor",
    ("DM", "Destroyer-Controller"): "Deep-Lying Playmaker",
    ("DM", "Destroyer-Sprinter"): "Volante",
    ("DM", "Engine"): "Volante",
    ("DM", "Engine-Destroyer"): "Volante",
    ("DM", "Engine-Cover"): "Volante",
    ("DM", "Engine-Controller"): "Conductor",
    ("DM", "Creator"): "Regista",
    ("DM", "Passer"): "Deep-Lying Playmaker",
    ("DM", "Cover"): "Holding Midfielder",
    ("DM", "Commander"): "Holding Midfielder",

    # ── CM ──
    ("CM", "Controller"): "Metronome",
    ("CM", "Controller-Creator"): "Maestro",
    ("CM", "Controller-Engine"): "Conductor",
    ("CM", "Controller-Dribbler"): "Technical Midfielder",
    ("CM", "Controller-Cover"): "Deep-Lying Playmaker",
    ("CM", "Controller-Destroyer"): "Conductor",
    ("CM", "Engine"): "Tuttocampista",
    ("CM", "Engine-Cover"): "Driver",
    ("CM", "Engine-Commander"): "Box-to-Box Creator",
    ("CM", "Engine-Creator"): "Box-to-Box Creator",
    ("CM", "Engine-Destroyer"): "Driver",
    ("CM", "Engine-Sprinter"): "Tuttocampista",
    ("CM", "Engine-Controller"): "Conductor",
    ("CM", "Creator"): "Playmaker",
    ("CM", "Creator-Engine"): "Box-to-Box Creator",
    ("CM", "Creator-Controller"): "Interior Playmaker",
    ("CM", "Creator-Passer"): "Playmaker",
    ("CM", "Creator-Dribbler"): "Technical Midfielder",
    ("CM", "Destroyer"): "Volante",
    ("CM", "Passer"): "Metronome",
    ("CM", "Passer-Creator"): "Playmaker",
    ("CM", "Cover"): "Holding Midfielder",
    ("CM", "Commander"): "General",
    ("CM", "Dribbler"): "Technical Midfielder",

    # ── WM ──
    ("WM", "Controller-Engine"): "Tireless Technician",
    ("WM", "Creator-Dribbler"): "Free-Roaming Attacker",
    ("WM", "Creator"): "False Winger",
    ("WM", "Creator-Engine"): "Work-Rate Winger",
    ("WM", "Engine"): "Tireless Technician",
    ("WM", "Engine-Creator"): "Work-Rate Winger",
    ("WM", "Controller"): "False Winger",
    ("WM", "Dribbler"): "Free-Roaming Attacker",
    ("WM", "Sprinter"): "Wide Runner",

    # ── AM ──
    ("AM", "Creator"): "Playmaker",
    ("AM", "Creator-Dribbler"): "Floating Playmaker",
    ("AM", "Creator-Controller"): "Playmaker",
    ("AM", "Creator-Engine"): "Pressing Playmaker",
    ("AM", "Creator-Passer"): "Playmaker",
    ("AM", "Creator-Striker"): "Seconda Punta",
    ("AM", "Controller"): "No.10",
    ("AM", "Controller-Creator"): "No.10",
    ("AM", "Dribbler"): "Floating Playmaker",
    ("AM", "Dribbler-Creator"): "Floating Playmaker",
    ("AM", "Engine"): "Pressing Playmaker",
    ("AM", "Striker"): "Seconda Punta",

    # ── WF ──
    ("WF", "Dribbler"): "Wizard",
    ("WF", "Dribbler-Creator"): "Wizard",
    ("WF", "Dribbler-Sprinter"): "Explosive Winger",
    ("WF", "Dribbler-Controller"): "Inventor",
    ("WF", "Dribbler-Commander"): "Explosive Winger",
    ("WF", "Dribbler-Engine"): "Work-Rate Winger",
    ("WF", "Creator"): "Inventor",
    ("WF", "Creator-Dribbler"): "Wizard",
    ("WF", "Creator-Engine"): "Inventor",
    ("WF", "Creator-Striker"): "Inverted Winger",
    ("WF", "Creator-Passer"): "False Winger",
    ("WF", "Creator-Controller"): "Inventor",
    ("WF", "Creator-Sprinter"): "Shuttler",
    ("WF", "Sprinter"): "Shuttler",
    ("WF", "Sprinter-Dribbler"): "Flanker",
    ("WF", "Sprinter-Striker"): "Inverted Winger",
    ("WF", "Sprinter-Engine"): "Shuttler",
    ("WF", "Sprinter-Creator"): "Shuttler",
    ("WF", "Sprinter-Cover"): "Defensive Winger",
    ("WF", "Sprinter-Destroyer"): "Defensive Winger",
    ("WF", "Engine"): "Work-Rate Winger",
    ("WF", "Engine-Creator"): "Work-Rate Winger",
    ("WF", "Engine-Sprinter"): "Shuttler",
    ("WF", "Engine-Dribbler"): "Work-Rate Winger",
    ("WF", "Controller"): "Inventor",
    ("WF", "Striker"): "Inverted Winger",
    ("WF", "Passer"): "False Winger",
    ("WF", "Commander"): "Work-Rate Winger",
    ("WF", "Commander-Sprinter"): "Shuttler",

    # ── CF ──
    ("CF", "Striker"): "Poacher",
    ("CF", "Striker-Creator"): "Poacher",
    ("CF", "Striker-Sprinter"): "Colossus",
    ("CF", "Striker-Target"): "Prima Punta",
    ("CF", "Striker-Engine"): "Poacher",
    ("CF", "Striker-Controller"): "Poacher",
    ("CF", "Target"): "Prima Punta",
    ("CF", "Target-Engine"): "Poacher",
    ("CF", "Target-Sprinter"): "Goal Machine",
    ("CF", "Target-Commander"): "Prima Punta",
    ("CF", "Target-Destroyer"): "Prima Punta",
    ("CF", "Target-Controller"): "Poacher",
    ("CF", "Target-Cover"): "Prima Punta",
    ("CF", "Target-Striker"): "Prima Punta",
    ("CF", "Sprinter"): "Runner",
    ("CF", "Sprinter-Dribbler"): "Mobile Striker",
    ("CF", "Sprinter-Engine"): "Runner",
    ("CF", "Sprinter-Striker"): "Mobile Striker",
    ("CF", "Sprinter-Creator"): "Mobile Striker",
    ("CF", "Creator"): "Falso Nove",
    ("CF", "Creator-Striker"): "Falso Nove",
    ("CF", "Creator-Engine"): "Spearhead",
    ("CF", "Engine"): "Spearhead",
    ("CF", "Engine-Striker"): "Spearhead",
    ("CF", "Engine-Creator"): "Spearhead",
    ("CF", "Dribbler"): "Mobile Striker",
    ("CF", "Controller"): "Falso Nove",
    ("CF", "Commander"): "Poacher",
    ("CF", "Commander-Target"): "Prima Punta",
    ("CF", "Commander-Sprinter"): "Poacher",
    ("CF", "Destroyer"): "Spearhead",
    ("CF", "Powerhouse"): "Poacher",
}

# Position → position group mapping
POS_GROUP = {
    "GK": "GK",
    "CD": "DEF", "WD": "WD",
    "DM": "DM", "CM": "CM", "WM": "WM",
    "AM": "AM", "WF": "WF", "CF": "CF",
}

# Fallback: position group → default blueprint when archetype doesn't match
POS_DEFAULTS = {
    "GK": "Shot-Stopper",
    "DEF": "Defender",
    "WD": "Full-Back",
    "DM": "Holding Midfielder",
    "CM": "Midfielder",
    "WM": "Wide Midfielder",
    "AM": "Playmaker",
    "WF": "Winger",
    "CF": "Striker",
}


# ── Personality theme → blueprint modifier ───────────────────────────────────
# SACROSANCT personality themes: General, Catalyst, Maestro, Captain, Professor
# These can shift a base blueprint to a more specific variant.

PERSONALITY_NAMES = {
    "ANLC": "General",    "ANSC": "Machine",     "INSC": "Mamba",
    "AXLC": "Catalyst",   "IXSC": "Maverick",    "IXLC": "Livewire",
    "INSP": "Maestro",    "ANLP": "Conductor",    "IXSP": "Genius",
    "INLC": "Captain",    "INLP": "Guardian",     "AXSC": "Enforcer",
    "ANSP": "Professor",  "AXSP": "Technician",   "IXLP": "Playmaker",
    "AXLP": "Orchestrator",
}

PERSONALITY_THEMES = {
    "General": "General",   "Machine": "General",   "Mamba": "General",
    "Catalyst": "Catalyst", "Maverick": "Catalyst",  "Livewire": "Catalyst",
    "Enforcer": "Catalyst",
    "Maestro": "Maestro",   "Conductor": "Maestro",  "Genius": "Maestro",
    "Captain": "Captain",   "Guardian": "Captain",
    "Professor": "Professor", "Technician": "Professor",
    "Playmaker": "Professor", "Orchestrator": "Professor",
}

# Personality theme can upgrade certain base blueprints to more specific variants.
# Key: (base_blueprint, personality_theme) → upgraded blueprint
# Only applied when the combination is meaningful — most base blueprints stay unchanged.
PERSONALITY_UPGRADES = {
    # ── Strikers ──
    ("Poacher", "General"):          "Clinical Finisher",
    ("Poacher", "Catalyst"):         "Goal Machine",
    ("Runner", "Catalyst"):          "Goal Machine",
    ("Spearhead", "Captain"):        "Warrior",

    # ── Wingers / Wide forwards ──
    ("Wizard", "Maestro"):           "Virtuoso",
    ("Wizard", "Catalyst"):          "Showman",
    ("Shuttler", "Catalyst"):   "Explosive Winger",
    ("Shuttler", "General"):    "Precision Winger",
    ("Inventor", "Maestro"):  "Architect",
    ("Inventor", "Professor"): "Technician",
    ("Work-Rate Winger", "Captain"): "Tireless Technician",

    # ── Attacking midfield ──
    ("Playmaker", "Maestro"):        "Virtuoso",
    ("Playmaker", "Professor"):      "Architect",
    ("Playmaker", "Catalyst"):       "Maverick",
    ("Floating Playmaker", "Maestro"): "Virtuoso",
    ("Seconda Punta", "Catalyst"):  "Goal Threat",
    ("No.10", "Maestro"):            "Virtuoso",

    # ── Central midfield ──
    ("Metronome", "Professor"):      "Architect",
    ("Metronome", "Maestro"):        "Maestro",
    ("Tuttocampista", "Captain"):     "Driver",
    ("Tuttocampista", "Catalyst"):   "Dynamo",
    ("Tuttocampista", "General"):    "General",
    ("Conductor", "Maestro"):        "Maestro",
    ("Volante", "Captain"):      "Warrior",
    ("Volante", "Catalyst"):     "Destroyer",

    # ── Defensive midfield ──
    ("Anchor", "Captain"):       "Warrior",
    ("Anchor", "General"):       "Shield",
    ("Deep-Lying Playmaker", "Maestro"):  "Regista",
    ("Deep-Lying Playmaker", "Professor"): "Regista",
    ("Regista", "Maestro"):          "Regista",

    # ── Defenders ──
    ("Modern CB", "Captain"):        "Colossus",
    ("Modern CB", "General"):        "Reading Defender",
    ("Traditional CB", "Captain"):   "Warrior",
    ("Aggressive CB", "Catalyst"):   "Destroyer",
    ("Libero", "Professor"): "Progressor CB",
    ("Libero", "Maestro"):  "Progressor CB",
    ("Two-Way Full-Back", "Captain"): "Warrior",
    ("Lateral", "Catalyst"): "Flanker",

    # ── Goalkeepers ──
    ("Shot-Stopper", "Captain"):     "Commander",
    ("Shot-Stopper", "General"):     "Commander",
    ("Modern Keeper", "Professor"):  "Complete Keeper",
}


def infer_blueprint(
    position: str,
    archetype: str | None,
    personality_type: str | None = None,
) -> str | None:
    """Infer blueprint from position + archetype, optionally refined by personality."""
    if not position or not archetype:
        return None

    group = POS_GROUP.get(position)
    if not group:
        return None

    # Step 1: Base blueprint from archetype + position
    base = None
    key = (group, archetype)
    if key in BLUEPRINT_MAP:
        base = BLUEPRINT_MAP[key]

    if not base:
        primary = archetype.split("-")[0] if "-" in archetype else archetype
        key = (group, primary)
        if key in BLUEPRINT_MAP:
            base = BLUEPRINT_MAP[key]

    if not base:
        base = POS_DEFAULTS.get(group)

    if not base:
        return None

    # Step 2: Personality upgrade (model + personality → blueprint)
    if personality_type:
        pname = PERSONALITY_NAMES.get(personality_type)
        if pname:
            theme = PERSONALITY_THEMES.get(pname)
            if theme:
                upgraded = PERSONALITY_UPGRADES.get((base, theme))
                if upgraded:
                    return upgraded

    return base


# ── Main ──────────────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

print("37 — Infer Blueprints from Model + Personality + Position")

# Load players needing blueprints
where_clause = "WHERE pp.archetype IS NOT NULL AND pp.position IS NOT NULL"
if not FORCE:
    where_clause += " AND (pp.blueprint IS NULL OR pp.blueprint = '')"
if args.player:
    where_clause += f" AND pp.person_id = {args.player}"

cur.execute(f"""
    SELECT pp.person_id, p.name, pp.position, pp.archetype, pp.blueprint,
           CASE WHEN pper.ei IS NOT NULL AND pper.sn IS NOT NULL
                     AND pper.tf IS NOT NULL AND pper.jp IS NOT NULL THEN
             CONCAT(
               CASE WHEN pper.ei >= 50 THEN 'A' ELSE 'I' END,
               CASE WHEN pper.sn >= 50 THEN 'X' ELSE 'N' END,
               CASE WHEN pper.tf >= 50 THEN 'S' ELSE 'L' END,
               CASE WHEN pper.jp >= 50 THEN 'C' ELSE 'P' END
             )
           END AS personality_type
    FROM player_profiles pp
    JOIN people p ON p.id = pp.person_id
    LEFT JOIN player_personality pper ON pper.person_id = pp.person_id
    {where_clause}
    ORDER BY p.name
""")
players = cur.fetchall()
print(f"  {len(players)} players to process")

if not players:
    print("  Nothing to do.")
    cur.close()
    conn.close()
    sys.exit(0)

updated = 0
skipped = 0
personality_enhanced = 0
updates = []

for pid, name, position, archetype, existing_bp, personality_type in players:
    blueprint = infer_blueprint(position, archetype, personality_type)
    if not blueprint:
        skipped += 1
        continue

    # Track if personality actually changed the blueprint
    base_bp = infer_blueprint(position, archetype, None)
    if blueprint != base_bp:
        personality_enhanced += 1

    updates.append((blueprint, pid))
    updated += 1

    if args.player or DRY_RUN and updated <= 30:
        marker = f" (was: {existing_bp})" if existing_bp else ""
        pers = f" [{personality_type}]" if personality_type else ""
        print(f"  {name:35s} {position:4s} {archetype:30s}{pers:8s} → {blueprint}{marker}")

if not DRY_RUN and updates:
    for bp, pid in updates:
        cur.execute(
            "UPDATE player_profiles SET blueprint = %s, updated_at = now() WHERE person_id = %s",
            (bp, pid),
        )

print(f"\n  Assigned: {updated}")
print(f"  Personality-enhanced: {personality_enhanced}")
print(f"  Skipped (no match): {skipped}")

if DRY_RUN:
    print("\n  --dry-run: no writes.")

cur.close()
conn.close()
print("Done.")
