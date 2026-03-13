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
    ("DEF", "Cover-Passer"): "Ball-Playing CB",
    ("DEF", "Cover-Controller"): "Ball-Playing CB",
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
    ("DEF", "Destroyer-Engine"): "Ball Winner",
    ("DEF", "Destroyer-Controller"): "Ball-Playing CB",
    ("DEF", "Destroyer-Sprinter"): "Aggressive CB",
    ("DEF", "Controller"): "Ball-Playing CB",
    ("DEF", "Controller-Cover"): "Ball-Playing CB",
    ("DEF", "Passer"): "Progressor CB",
    ("DEF", "Passer-Cover"): "Progressor CB",
    ("DEF", "Commander"): "Traditional CB",
    ("DEF", "Commander-Cover"): "Traditional CB",
    ("DEF", "Commander-Destroyer"): "Aggressive CB",
    ("DEF", "Target"): "Traditional CB",
    ("DEF", "Powerhouse"): "Traditional CB",

    # ── WD ──
    ("WD", "Engine"): "Two-Way Full-Back",
    ("WD", "Engine-Sprinter"): "Overlapping Full-Back",
    ("WD", "Engine-Creator"): "Attacking Full-Back",
    ("WD", "Engine-Dribbler"): "Inverted Full-Back",
    ("WD", "Engine-Cover"): "Two-Way Full-Back",
    ("WD", "Engine-Destroyer"): "Two-Way Full-Back",
    ("WD", "Engine-Commander"): "Two-Way Full-Back",
    ("WD", "Sprinter"): "Overlapping Full-Back",
    ("WD", "Sprinter-Engine"): "Flanker",
    ("WD", "Sprinter-Dribbler"): "Flanker",
    ("WD", "Sprinter-Cover"): "Overlapping Full-Back",
    ("WD", "Sprinter-Creator"): "Attacking Full-Back",
    ("WD", "Sprinter-Destroyer"): "Overlapping Full-Back",
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
    ("WD", "Controller"): "Inverted Full-Back",
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
    ("DM", "Destroyer-Sprinter"): "Ball Winner",
    ("DM", "Engine"): "Ball Winner",
    ("DM", "Engine-Destroyer"): "Ball Winner",
    ("DM", "Engine-Cover"): "Ball Winner",
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
    ("CM", "Engine"): "Box-to-Box",
    ("CM", "Engine-Cover"): "Driver",
    ("CM", "Engine-Commander"): "Box-to-Box Creator",
    ("CM", "Engine-Creator"): "Box-to-Box Creator",
    ("CM", "Engine-Destroyer"): "Driver",
    ("CM", "Engine-Sprinter"): "Box-to-Box",
    ("CM", "Engine-Controller"): "Conductor",
    ("CM", "Creator"): "Playmaker",
    ("CM", "Creator-Engine"): "Box-to-Box Creator",
    ("CM", "Creator-Controller"): "Interior Playmaker",
    ("CM", "Creator-Passer"): "Playmaker",
    ("CM", "Creator-Dribbler"): "Technical Midfielder",
    ("CM", "Destroyer"): "Ball Winner",
    ("CM", "Passer"): "Metronome",
    ("CM", "Passer-Creator"): "Playmaker",
    ("CM", "Cover"): "Holding Midfielder",
    ("CM", "Commander"): "General",
    ("CM", "Dribbler"): "Technical Midfielder",

    # ── WM ──
    ("WM", "Controller-Engine"): "Tireless Technician",
    ("WM", "Creator-Dribbler"): "Free-Roaming Attacker",
    ("WM", "Creator"): "Wide Playmaker",
    ("WM", "Creator-Engine"): "Work-Rate Winger",
    ("WM", "Engine"): "Tireless Technician",
    ("WM", "Engine-Creator"): "Work-Rate Winger",
    ("WM", "Controller"): "Wide Playmaker",
    ("WM", "Dribbler"): "Free-Roaming Attacker",
    ("WM", "Sprinter"): "Wide Runner",

    # ── AM ──
    ("AM", "Creator"): "Playmaker",
    ("AM", "Creator-Dribbler"): "Floating Playmaker",
    ("AM", "Creator-Controller"): "Playmaker",
    ("AM", "Creator-Engine"): "Pressing Playmaker",
    ("AM", "Creator-Passer"): "Playmaker",
    ("AM", "Creator-Striker"): "Shadow Striker",
    ("AM", "Controller"): "No.10",
    ("AM", "Controller-Creator"): "No.10",
    ("AM", "Dribbler"): "Floating Playmaker",
    ("AM", "Dribbler-Creator"): "Floating Playmaker",
    ("AM", "Engine"): "Pressing Playmaker",
    ("AM", "Striker"): "Shadow Striker",

    # ── WF ──
    ("WF", "Dribbler"): "Wizard",
    ("WF", "Dribbler-Creator"): "Wizard",
    ("WF", "Dribbler-Sprinter"): "Explosive Winger",
    ("WF", "Dribbler-Controller"): "Inverted Winger",
    ("WF", "Dribbler-Commander"): "Explosive Winger",
    ("WF", "Dribbler-Engine"): "Work-Rate Winger",
    ("WF", "Creator"): "Inverted Winger",
    ("WF", "Creator-Dribbler"): "No.10",
    ("WF", "Creator-Engine"): "Inverted Winger",
    ("WF", "Creator-Striker"): "Inside Forward",
    ("WF", "Creator-Passer"): "Wide Playmaker",
    ("WF", "Creator-Controller"): "Inverted Winger",
    ("WF", "Creator-Sprinter"): "Direct Winger",
    ("WF", "Sprinter"): "Direct Winger",
    ("WF", "Sprinter-Dribbler"): "Flanker",
    ("WF", "Sprinter-Striker"): "Inside Forward",
    ("WF", "Sprinter-Engine"): "Direct Winger",
    ("WF", "Sprinter-Creator"): "Direct Winger",
    ("WF", "Sprinter-Cover"): "Defensive Winger",
    ("WF", "Sprinter-Destroyer"): "Defensive Winger",
    ("WF", "Engine"): "Work-Rate Winger",
    ("WF", "Engine-Creator"): "Work-Rate Winger",
    ("WF", "Engine-Sprinter"): "Direct Winger",
    ("WF", "Engine-Dribbler"): "Work-Rate Winger",
    ("WF", "Controller"): "Inverted Winger",
    ("WF", "Striker"): "Inside Forward",
    ("WF", "Passer"): "Wide Playmaker",
    ("WF", "Commander"): "Work-Rate Winger",
    ("WF", "Commander-Sprinter"): "Direct Winger",

    # ── CF ──
    ("CF", "Striker"): "Complete Striker",
    ("CF", "Striker-Creator"): "Poacher",
    ("CF", "Striker-Sprinter"): "Colossus",
    ("CF", "Striker-Target"): "Target Man",
    ("CF", "Striker-Engine"): "Complete Striker",
    ("CF", "Striker-Controller"): "Complete Striker",
    ("CF", "Target"): "Target Man",
    ("CF", "Target-Engine"): "Complete Striker",
    ("CF", "Target-Sprinter"): "Goal Machine",
    ("CF", "Target-Commander"): "Target Man",
    ("CF", "Target-Destroyer"): "Target Man",
    ("CF", "Target-Controller"): "Complete Striker",
    ("CF", "Target-Cover"): "Target Man",
    ("CF", "Target-Striker"): "Target Man",
    ("CF", "Sprinter"): "Runner",
    ("CF", "Sprinter-Dribbler"): "Mobile Striker",
    ("CF", "Sprinter-Engine"): "Runner",
    ("CF", "Sprinter-Striker"): "Mobile Striker",
    ("CF", "Sprinter-Creator"): "Mobile Striker",
    ("CF", "Creator"): "False Nine",
    ("CF", "Creator-Striker"): "False Nine",
    ("CF", "Creator-Engine"): "Pressing Forward",
    ("CF", "Engine"): "Pressing Forward",
    ("CF", "Engine-Striker"): "Pressing Forward",
    ("CF", "Engine-Creator"): "Pressing Forward",
    ("CF", "Dribbler"): "Mobile Striker",
    ("CF", "Controller"): "False Nine",
    ("CF", "Commander"): "Complete Striker",
    ("CF", "Commander-Target"): "Target Man",
    ("CF", "Commander-Sprinter"): "Complete Striker",
    ("CF", "Destroyer"): "Pressing Forward",
    ("CF", "Powerhouse"): "Complete Striker",
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


def infer_blueprint(position: str, archetype: str | None) -> str | None:
    """Infer blueprint from position + archetype."""
    if not position or not archetype:
        return None

    group = POS_GROUP.get(position)
    if not group:
        return None

    # Try exact match first
    key = (group, archetype)
    if key in BLUEPRINT_MAP:
        return BLUEPRINT_MAP[key]

    # Try with just primary archetype (before the hyphen)
    primary = archetype.split("-")[0] if "-" in archetype else archetype
    key = (group, primary)
    if key in BLUEPRINT_MAP:
        return BLUEPRINT_MAP[key]

    # Fallback to position default
    return POS_DEFAULTS.get(group)


# ── Main ──────────────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

print("39 — Infer Blueprints from Archetype + Position")

# Load players needing blueprints
where_clause = "WHERE pp.archetype IS NOT NULL AND pp.position IS NOT NULL"
if not FORCE:
    where_clause += " AND (pp.blueprint IS NULL OR pp.blueprint = '')"
if args.player:
    where_clause += f" AND pp.person_id = {args.player}"

cur.execute(f"""
    SELECT pp.person_id, p.name, pp.position, pp.archetype, pp.blueprint
    FROM player_profiles pp
    JOIN people p ON p.id = pp.person_id
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
updates = []

for pid, name, position, archetype, existing_bp in players:
    blueprint = infer_blueprint(position, archetype)
    if not blueprint:
        skipped += 1
        continue

    updates.append((blueprint, pid))
    updated += 1

    if args.player or DRY_RUN and updated <= 30:
        marker = f" (was: {existing_bp})" if existing_bp else ""
        print(f"  {name:35s} {position:4s} {archetype:30s} → {blueprint}{marker}")

if not DRY_RUN and updates:
    for bp, pid in updates:
        cur.execute(
            "UPDATE player_profiles SET blueprint = %s, updated_at = now() WHERE person_id = %s",
            (bp, pid),
        )

print(f"\n  Assigned: {updated}")
print(f"  Skipped (no match): {skipped}")

if DRY_RUN:
    print("\n  --dry-run: no writes.")

cur.close()
conn.close()
print("Done.")
