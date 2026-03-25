"""
37b_legend_archetypes.py — Assign earned archetypes to legends via model compound mapping.

Legends lack API-Football stats, so pipeline 37 can't classify them. This script
maps their Primary-Secondary model compound to an earned archetype using football
knowledge, with position gates and player-specific overrides.

Football-culture archetypes (from real nicknames):
  Fenômeno, Kaiser, Pendolino, Tractor, Arrow, Bomber, Pitbull

Standard archetypes (from pipeline 37):
  Virtuoso, Conjurer, Marksman, Hunter, Fox, Architect, Artisan, Pulse, Fulcrum,
  Marshal, Warrior, Goliath, Bastion, Fortress, Outlet, Wall, Sweeper

Writes to: player_profiles.earned_archetype, archetype_tier

Usage:
    python 37b_legend_archetypes.py              # compute all (peak >= 88)
    python 37b_legend_archetypes.py --dry-run    # preview
    python 37b_legend_archetypes.py --player 10296  # single player (Maradona)
    python 37b_legend_archetypes.py --force      # overwrite existing
    python 37b_legend_archetypes.py --min-peak 85  # lower threshold
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn

parser = argparse.ArgumentParser(description="Legend archetype inference")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--player", type=int, help="Debug single player")
parser.add_argument("--force", action="store_true", help="Overwrite existing earned_archetype")
parser.add_argument("--min-peak", type=int, default=88, help="Minimum peak to process (default 88)")
parser.add_argument("--active", action="store_true", help="Also process active players (uses compound mapping)")
parser.add_argument("--min-level", type=int, default=85, help="Minimum level for active players (default 85)")
args = parser.parse_args()

DRY_RUN = args.dry_run

# ── Player Overrides ──────────────────────────────────────────────────────────
# Checked BEFORE compound mapping. For legends whose identity isn't captured
# by their model compound alone.

PLAYER_OVERRIDES = {
    # Legends
    8224:  "Arrow",       # Alfredo Di Stéfano — La Saeta Rubia
    11368: "Bomber",      # Gerd Müller — Der Bomber
    9086:  "Arrow",       # Bobby Charlton — thunderbolt directness
    10479: "Pitbull",     # Edgar Davids — De Pitbull
    18294: "Virtuoso",    # Valentino Mazzola — complete inside forward
    8691:  "Hunter",      # Arjen Robben — cut-inside specialist, not Fenômeno
    # Active
    20176: "Fenômeno",    # Kylian Mbappé — compound is just "Sprinter" but he's a Fenômeno
    7812:  "Pendolino",   # Achraf Hakimi — compound is "Creator" but he's the modern Cafú
    13979: "Virtuoso",    # Lionel Messi — compound is just "Creator" but he's THE Virtuoso
    9809:  "Marksman",    # Cristiano Ronaldo — not Fox
    20177: "Conjurer",    # Vinícius Júnior — Sprinter-Dribbler maps to Outlet but he's a magician
    10772: "Bomber",      # Erling Haaland — instinctive goalscorer, not Fenômeno
    13152: "Virtuoso",    # Jude Bellingham — Engine-Creator does everything, not Fulcrum
}

# ── Position-Gated Compounds ─────────────────────────────────────────────────
# These compounds map to football-culture names ONLY when the player's position
# matches. Otherwise they fall through to the standard mapping.
#
# Format: (compound, required_positions) → archetype

POSITION_GATED = {
    ("Controller-Cover", ("CD",)):        "Kaiser",      # Beckenbauer — libero
    ("Controller-Destroyer", ("CD",)):    "Kaiser",      # defensive brain CB
    ("Engine-Sprinter", ("WD",)):         "Pendolino",   # Cafú — attacking FB shuttle
    ("Engine-Dribbler", ("WD",)):         "Pendolino",   # Dani Alves
    ("Engine-Commander", ("WD",)):        "Tractor",     # Zanetti, Carlos Alberto — tireless FB
    ("Engine-Powerhouse", ("WD",)):       "Tractor",     # tireless physical FB
    ("Engine-Cover", ("WD",)):            "Tractor",     # defensive tireless FB
    ("Engine-Destroyer", ("WD",)):        "Tractor",     # tireless defensive FB
    # Fenômeno only for CF — WF Striker-Sprinters get Hunter
    ("Striker-Sprinter", ("CF",)):        "Fenômeno",    # R9, Eusébio, Romário
    # Rock for Destroyer-heavy CB/DM — blocking profile
    ("Destroyer-Passer", ("CD", "DM")):   "Rock",        # Koundé, Makélélé type
    ("Destroyer-Cover", ("CD", "DM")):    "Rock",        # shield
    ("Destroyer-Controller", ("CD", "DM")):"Rock",       # defensive brain
    # Marshal only for CB/DM/CM — WF/AM/CF fall through to compound
    ("Commander-Engine", ("CD", "DM", "CM")): "Marshal", # Matthäus
    ("Commander-Striker", ("CD", "DM", "CM")): "Marshal", # Gerrard
    ("Striker-Engine", ("CD", "DM", "CM")): "Marshal",   # Lampard (CM scorer)
}

# ── Compound → Archetype Mapping ─────────────────────────────────────────────
# Single table — no tier gating. Football-culture names where they capture a
# TYPE of player, standard names everywhere else.

LEGEND_EARNED = {
    # ── DRIBBLER PRIMARY ──────────────────────────────────────────
    "Dribbler-Creator":     "Conjurer",       # Maradona, Ronaldinho, Best, Hazard, Figo
    "Dribbler-Sprinter":    "Conjurer",       # Garrincha, Giggs — magic dribblers
    "Dribbler-Controller":  "Artisan",        # Iniesta, Matthews — elegant infiltrator
    "Dribbler-Powerhouse":  "Virtuoso",       # Gullit — complete
    "Dribbler-Commander":   "Virtuoso",       # complete captain
    "Dribbler-Engine":      "Outlet",         # counter-attacker
    "Dribbler-Striker":     "Virtuoso",       # goals + flair
    "Dribbler-Cover":       "Artisan",        # modern defender who carries
    "Dribbler-Destroyer":   "Outlet",         # chaos dribbler
    "Dribbler-Target":      "Virtuoso",       # acrobatic
    "Dribbler-Passer":      "Conjurer",       # silk

    # ── CREATOR PRIMARY ───────────────────────────────────────────
    "Creator-Dribbler":     "Artisan",        # Cruyff, Zidane, Baggio, Hagi
    "Creator-Striker":      "Artisan",        # Zico, Totti, Meazza
    "Creator-Passer":       "Architect",      # Rivera, David Silva, Didi
    "Creator-Controller":   "Architect",      # controlled creator
    "Creator-Engine":       "Fulcrum",        # Deco — dynamic playmaker
    "Creator-Sprinter":     "Conjurer",       # Kaká — pace + magic
    "Creator-Powerhouse":   "Fulcrum",        # Rivellino — power playmaker
    "Creator-Cover":        "Architect",      # quarterback CB
    "Creator-Commander":    "Architect",      # general
    "Creator-Destroyer":    "Fulcrum",        # disruptive creator
    "Creator-Target":       "Artisan",        # target playmaker

    # ── STRIKER PRIMARY ───────────────────────────────────────────
    "Striker-Creator":      "Virtuoso",       # Pelé, Platini, Rivaldo — complete
    "Striker-Sprinter":     "Hunter",         # fallback for non-CF (WF gets this); CF gated to Fenômeno
    "Striker-Powerhouse":   "Marksman",       # Puskás, Shearer, Batistuta — power
    "Striker-Controller":   "Marksman",       # Van Basten, Bergkamp — clinical
    "Striker-Engine":       "Virtuoso",       # fallback for non-CM (CM gated to Marshal); versatile scorer
    "Striker-Cover":        "Fox",            # poacher instinct
    "Striker-Target":       "Marksman",       # Ibrahimović — aerial + power
    "Striker-Destroyer":    "Warrior",        # Tévez — combative scorer
    "Striker-Dribbler":     "Virtuoso",       # goals + flair = complete
    "Striker-Commander":    "Marshal",        # captain goalscorer
    "Striker-Passer":       "Artisan",        # clinical playmaker

    # ── PASSER PRIMARY ────────────────────────────────────────────
    "Passer-Controller":    "Architect",      # Pirlo, Xavi, Scholes, Xabi Alonso
    "Passer-Creator":       "Architect",      # Laudrup, Fàbregas, Didi
    "Passer-Powerhouse":    "Fulcrum",        # Verón
    "Passer-Engine":        "Pulse",          # Brehme
    "Passer-Cover":         "Architect",      # deep distributor
    "Passer-Commander":     "Architect",      # general
    "Passer-Destroyer":     "Pulse",          # recycler
    "Passer-Sprinter":      "Architect",      # transition passer
    "Passer-Dribbler":      "Conjurer",       # silk
    "Passer-Target":        "Architect",      # quarterback
    "Passer-Striker":       "Artisan",        # scorer-provider

    # ── CONTROLLER PRIMARY ────────────────────────────────────────
    # Note: Controller-Cover → Kaiser via POSITION_GATED (CB only)
    "Controller-Cover":     "Fortress",       # fallback for non-CB
    "Controller-Passer":    "Metronome",      # Xavi, Kroos — metronomic tempo
    "Controller-Creator":   "Artisan",        # composed creator
    "Controller-Engine":    "Fulcrum",        # Pedri — engine brain
    "Controller-Dribbler":  "Artisan",        # ball magnet
    "Controller-Destroyer": "Fortress",       # defensive brain (non-CB fallback)
    "Controller-Powerhouse":"Sentinel",        # anchor
    "Controller-Sprinter":  "Pulse",          # glider
    "Controller-Striker":   "Artisan",        # clinical
    "Controller-Target":    "Sentinel",        # composed CB
    "Controller-Commander": "Pulse",          # tempo dictator

    # ── COMMANDER PRIMARY ─────────────────────────────────────────
    "Commander-Engine":     "Virtuoso",       # fallback for non-CM (CM gated to Marshal); complete player
    "Commander-Cover":      "Fortress",       # Kompany
    "Commander-Destroyer":  "Warrior",        # Keane — fierce
    "Commander-Striker":    "Marshal",        # Gerrard — captain scorer
    "Commander-Controller": "Pulse",          # organizer
    "Commander-Powerhouse": "Goliath",        # Vieira — physical dominant
    "Commander-Sprinter":   "Marshal",        # driving force
    "Commander-Dribbler":   "Virtuoso",       # complete captain
    "Commander-Passer":     "Architect",      # director
    "Commander-Creator":    "Artisan",        # talisman
    "Commander-Target":     "Goliath",        # aerial commander

    # ── COVER PRIMARY ─────────────────────────────────────────────
    "Cover-Commander":      "Fortress",       # Maldini, Moore, Sammer
    "Cover-Controller":     "Fortress",       # Baresi, Scirea, Nesta, Lahm
    "Cover-Powerhouse":     "Sentinel",        # Thuram, Cannavaro, Lúcio
    "Cover-Destroyer":      "Sentinel",        # hard-nosed
    "Cover-Passer":         "Fortress",       # Piqué
    "Cover-Sprinter":       "Fortress",       # Ashley Cole
    "Cover-Engine":         "Sentinel",        # mobile CB
    "Cover-Dribbler":       "Fortress",       # advancing CB
    "Cover-Creator":        "Fortress",       # quarterback CB
    "Cover-Target":         "Sentinel",        # towering CB
    "Cover-Striker":        "Fortress",       # libero scorer

    # ── ENGINE PRIMARY ────────────────────────────────────────────
    # Note: Engine-Sprinter/Dribbler/Commander → gated via POSITION_GATED for WD
    "Engine-Commander":     "Marshal",        # non-WD fallback
    "Engine-Sprinter":      "Outlet",         # non-WD fallback
    "Engine-Dribbler":      "Outlet",         # non-WD fallback
    "Engine-Striker":       "Fulcrum",        # Neeskens — arrives to score
    "Engine-Powerhouse":    "Warrior",        # non-WD fallback
    "Engine-Controller":    "Pulse",          # metronome
    "Engine-Cover":         "Marshal",        # non-WD fallback
    "Engine-Destroyer":     "Warrior",        # machine
    "Engine-Passer":        "Pulse",          # Brehme-type
    "Engine-Creator":       "Fulcrum",        # heartbeat
    "Engine-Target":        "Warrior",        # athlete

    # ── DESTROYER PRIMARY ─────────────────────────────────────────
    "Destroyer-Commander":  "Warrior",        # Rijkaard, Passarella
    "Destroyer-Powerhouse": "Sentinel",        # Stam, Vidić
    "Destroyer-Passer":     "Sentinel",        # Makélélé
    "Destroyer-Cover":      "Sentinel",        # shield
    "Destroyer-Controller": "Fortress",       # lynchpin
    "Destroyer-Engine":     "Warrior",        # machine
    "Destroyer-Sprinter":   "Warrior",        # shadow
    "Destroyer-Creator":    "Warrior",        # disruptor
    "Destroyer-Dribbler":   "Warrior",        # surge
    "Destroyer-Target":     "Sentinel",        # immovable
    "Destroyer-Striker":    "Marshal",        # predator

    # ── SPRINTER PRIMARY ──────────────────────────────────────────
    "Sprinter-Striker":     "Hunter",         # Henry, Bale, Jairzinho
    "Sprinter-Dribbler":    "Outlet",         # Gento
    "Sprinter-Creator":     "Conjurer",       # pace + vision
    "Sprinter-Commander":   "Marshal",        # driving force
    "Sprinter-Engine":      "Outlet",         # shuttler
    "Sprinter-Controller":  "Outlet",         # glider
    "Sprinter-Cover":       "Fortress",       # pace defender
    "Sprinter-Destroyer":   "Warrior",        # shadow
    "Sprinter-Powerhouse":  "Goliath",        # juggernaut
    "Sprinter-Target":      "Hunter",         # leaper
    "Sprinter-Passer":      "Outlet",         # transition

    # ── POWERHOUSE PRIMARY ────────────────────────────────────────
    "Powerhouse-Controller":"Fulcrum",        # Seedorf, Yaya Touré — power + intelligence
    "Powerhouse-Striker":   "Marksman",       # Drogba
    "Powerhouse-Commander": "Goliath",        # boss
    "Powerhouse-Destroyer": "Warrior",        # enforcer
    "Powerhouse-Engine":    "Warrior",        # horse
    "Powerhouse-Cover":     "Sentinel",        # dominator
    "Powerhouse-Sprinter":  "Goliath",        # athlete
    "Powerhouse-Dribbler":  "Virtuoso",       # tank with skill
    "Powerhouse-Creator":   "Fulcrum",        # power playmaker
    "Powerhouse-Passer":    "Sentinel",        # rock
    "Powerhouse-Target":    "Goliath",        # colossus

    # ── TARGET PRIMARY ────────────────────────────────────────────
    "Target-Powerhouse":    "Goliath",
    "Target-Commander":     "Goliath",
    "Target-Striker":       "Marksman",       # aerial scorer
    "Target-Destroyer":     "Sentinel",
    "Target-Engine":        "Warrior",
    "Target-Controller":    "Sentinel",
    "Target-Cover":         "Sentinel",
    "Target-Passer":        "Architect",
    "Target-Creator":       "Artisan",
    "Target-Dribbler":      "Virtuoso",
    "Target-Sprinter":      "Hunter",

    # ── GK ────────────────────────────────────────────────────────
    "GK-Commander":         "Wall",           # Yashin, Buffon, Kahn, Zoff, Schmeichel
    "GK-Cover":             "Wall",           # Casillas, Banks, Čech — shot-stoppers
    "GK-Controller":        "Wall",           # van der Sar — good feet but not a sweeper
    "GK-Passer":            "Sweeper",        # actual distribution GK (Neuer type)
    "GK-Sprinter":          "Wall",           # aggressive off-line but not sweeper-keeper

    # ── SINGLE-MODEL FALLBACKS ────────────────────────────────────
    "GK":                   "Wall",
    "Controller":           "Pulse",
    "Commander":            "Marshal",
    "Creator":              "Conjurer",
    "Dribbler":             "Conjurer",
    "Passer":               "Architect",
    "Striker":              "Marksman",
    "Cover":                "Fortress",
    "Engine":               "Marshal",
    "Destroyer":            "Warrior",
    "Sprinter":             "Outlet",
    "Powerhouse":           "Goliath",
    "Target":               "Goliath",
}


def resolve_archetype(pid, compound, position):
    """Resolve earned archetype: override → position-gated → compound → primary fallback."""
    # 1. Player override
    if pid in PLAYER_OVERRIDES:
        return PLAYER_OVERRIDES[pid]

    # 2. Position-gated compound
    for (comp, positions), archetype in POSITION_GATED.items():
        if compound == comp and position in positions:
            return archetype

    # 3. Compound lookup
    earned = LEGEND_EARNED.get(compound)
    if earned:
        return earned

    # 4. Primary model fallback
    primary = compound.split("-")[0] if compound else None
    if primary:
        return LEGEND_EARNED.get(primary)

    return None


def main():
    conn = require_conn()
    cur = conn.cursor()

    # ── Load players ──────────────────────────────────────────────
    if args.active:
        # Active players: compound mapping overrides stat-based archetypes
        where_clauses = [
            "p.active = true",
            f"pp.level >= {args.min_level}",
            "pp.archetype IS NOT NULL",
        ]
    else:
        # Legends: peak-gated
        where_clauses = [
            "p.active = false",
            f"pp.peak >= {args.min_peak}",
            "pp.archetype IS NOT NULL",
        ]

    if args.player:
        where_clauses = [f"p.id = {args.player}"]

    if not args.force and not args.player:
        where_clauses.append("pp.earned_archetype IS NULL")

    where_sql = " AND ".join(where_clauses)

    rating_col = "pp.level" if args.active else "pp.peak"
    cur.execute(f"""
        SELECT p.id, p.name, pp.archetype, {rating_col}, pp.position,
               pp.earned_archetype
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        WHERE {where_sql}
        ORDER BY {rating_col} DESC NULLS LAST, p.name
    """)
    legends = cur.fetchall()
    mode = "active" if args.active else "legends"
    threshold = f"min level {args.min_level}" if args.active else f"min peak {args.min_peak}"
    print(f"Loaded {len(legends)} {mode} ({threshold})")

    # ── Process ───────────────────────────────────────────────────
    assigned = 0
    skipped = 0
    unmapped = []
    updates = []

    for pid, name, compound, peak, position, existing_ea in legends:
        earned = resolve_archetype(pid, compound, position)

        if not earned:
            unmapped.append((pid, name, compound, peak))
            skipped += 1
            continue

        rating = peak or 0  # This is level for --active, peak for legends
        if args.active:
            tier = "elite" if rating >= 90 else "established"
        else:
            tier = "elite" if rating >= 93 else "established"
        source = "OVERRIDE" if pid in PLAYER_OVERRIDES else "gated" if any(
            compound == c and position in p for (c, p) in POSITION_GATED
        ) else "compound"

        if DRY_RUN or args.player:
            marker = "→" if not existing_ea else "≡" if existing_ea == earned else "⇒"
            print(f"  {marker} {peak or 0:>3d}  {position or '?':>3s}  {compound:30s}  →  {earned:15s} ({tier:11s})  [{source:8s}]  {name}")
        else:
            updates.append((earned, tier, pid))

        assigned += 1

    # ── Write ─────────────────────────────────────────────────────
    if not DRY_RUN and not args.player and updates:
        batch_size = 500
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]
            cur.executemany("""
                UPDATE player_profiles
                SET earned_archetype = %s, archetype_tier = %s
                WHERE person_id = %s
            """, batch)
        conn.commit()
        print(f"\nWritten {len(updates)} updates to player_profiles")

    # ── Report ────────────────────────────────────────────────────
    print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Results:")
    print(f"  Assigned: {assigned}")
    print(f"  Skipped:  {skipped}")

    if unmapped:
        print(f"\n  Unmapped compounds ({len(unmapped)}):")
        for pid, name, compound, peak in unmapped[:20]:
            print(f"    {peak or 0:>3d}  {compound:30s}  {name}")

    # Distribution
    if not args.player:
        cur.execute("""
            SELECT pp.earned_archetype, COUNT(*) as cnt
            FROM people p
            JOIN player_profiles pp ON pp.person_id = p.id
            WHERE p.active = false AND pp.earned_archetype IS NOT NULL
            GROUP BY 1
            ORDER BY cnt DESC
        """)
        print(f"\n  Legend archetype distribution:")
        for ea, cnt in cur.fetchall():
            print(f"    {cnt:>4d}  {ea}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
