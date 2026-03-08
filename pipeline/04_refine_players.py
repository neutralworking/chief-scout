"""
04_refine_players.py — Rule-based enrichment of the players table.

Derives / infers:
  1. market_value_tier (1-5) from level / peak + division
  2. archetype (rule-based, respects archetype_override)
  3. position   (from class + mentality, fills NULLs only)
  4. secondary_position (new column, from secondary class)

Usage:
    python pipeline/04_refine_players.py [--dry-run]
"""
from __future__ import annotations

import sys

from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv


# ── Domain constants ──────────────────────────────────────────────────────────

TOP_5_LEAGUES = frozenset({
    "Premier League", "LaLiga", "La Liga",
    "Bundesliga", "Serie A", "Ligue 1",
})
TOP_LEAGUES = TOP_5_LEAGUES | frozenset({
    "Primeira Liga", "Eredivisie", "Süper Lig",
    "Premiership", "Belgian Pro League",
})
BIG_CLUBS = frozenset({
    "Manchester City", "Real Madrid", "Bayern Munich", "Liverpool", "Barcelona",
    "PSG", "Paris Saint-Germain", "Juventus", "Inter Milan", "Arsenal", "Chelsea",
    "Atletico Madrid", "Atlético de Madrid", "Borussia Dortmund", "Napoli",
    "AC Milan", "Manchester United", "Ajax", "Porto", "Benfica", "Sporting CP",
    "Sevilla", "Tottenham Hotspur", "RB Leipzig",
})
MERCENARY_LEAGUES    = frozenset({"Saudi Pro League"})
MERCENARY_CHARS      = frozenset({"Unpredictable", "Antagonistic", "Icy", "Combative"})
LOYALIST_CHARS       = frozenset({
    "Resolute", "Tenacious", "Committed", "Reliable",
    "Passionate", "Relentless", "Hard-Tackling", "No-Nonsense",
})
TACTICIAN_CHARS      = frozenset({"Intelligent", "Composed", "Focused"})
TACTICIAN_CLASSES    = frozenset({"Controller", "Engine", "Passer", "Commander"})
ENTERTAINER_CHARS    = frozenset({"Flamboyant", "Charismatic", "Elegant"})

VALID_POSITIONS = frozenset({"GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"})


# ── Market Value Tier ─────────────────────────────────────────────────────────

def compute_mvt(level, peak, division: str | None) -> int:
    """
    Scale — game quality, not real-world euros:
      5 = world-class elite
      4 = domestic/continental top quality (Champions League regular)
      3 = solid top-flight
      2 = championship / second tier quality
      1 = lower league / minimal data
    """
    # Use level (harder to earn) if available, else weight peak down slightly
    if level:
        q = level
    elif peak:
        q = peak * 0.92   # peak ≥ 94 → q ≥ 86 → tier 4
    else:
        q = 0

    if q >= 90:   base = 5
    elif q >= 86: base = 4
    elif q >= 82: base = 3
    elif q >= 78: base = 2
    elif q > 0:   base = 1
    else:         base = 1   # no data

    div = division or ""
    if div in TOP_5_LEAGUES:
        base = max(base, 3)   # floor: top-5 quality player
    elif div in TOP_LEAGUES:
        base = max(base, 2)

    return min(base, 5)


# ── Archetype rules ───────────────────────────────────────────────────────────
#
# Rules evaluated top-down; first match wins.
#
# Design principle: each archetype describes what a player NEEDS from a club
# to sign. Rules should be tight enough that the archetype is meaningful.
#
# SUPERSTAR       needs Wealth 4, Prestige 4, Pedigree 3, Ambition 4
# SERIAL WINNER   needs Pedigree 3, Ambition 4
# PRESTIGE SEEKER needs Prestige 4, Pedigree 2
# MERCENARY       needs Wealth 4
# VETERAN PRO     needs Ambition 2, Wealth 2
# PROJECT BUILDER needs Belief 3
# LOYALIST        needs Belief 4
# TACTICIAN       needs Belief 3
# ENTERTAINER     needs Prestige 4, Atmosphere 3
# JOURNEYMAN      needs Ambition 1 (any club)

def archetype_confidence(level: float | None, peak: float | None) -> str:
    """
    How reliable is the inferred archetype?

      high   — explicit level set (scouted quality data exists)
      medium — only peak available (career high, no current scouting)
      low    — neither level nor peak (MVT is division-floor only)
    """
    if level:
        return "high"
    if peak:
        return "medium"
    return "low"


def infer_archetype(
    mvt: int,
    age: int | None,
    division: str | None,
    club: str | None,
    mentality: str | None,
    character: str | None,
    primary_class: str | None,
) -> str:
    div  = division or ""
    clb  = club or ""
    ment = mentality or ""
    ch   = character or ""
    cls  = primary_class or ""

    # 1. SUPERSTAR — demands everything; world-class + elite environment
    #    Tight: requires mvt 5 (level 90+ or peak 94+ in top-5) AND top-5 league
    if mvt == 5 and div in TOP_5_LEAGUES:
        return "The Superstar"

    # 2. MERCENARY — money first; Saudi move is the clearest real-world signal
    #    We only use the league signal, not character — character data is too sparse
    #    and character traits like "Combative" describe playing style, not motivation
    if div in MERCENARY_LEAGUES and age and age >= 29 and mvt >= 3:
        return "The Mercenary"

    # 3. SERIAL WINNER — trophy hunter; elite quality at a winning institution
    #    Tight: top-4 quality (level 86+), at a known winning club, Attacking
    if mvt >= 4 and clb in BIG_CLUBS and ment == "Attacking":
        return "The Serial Winner"

    # 4. VETERAN PRO — career stage drives decisions; currently active, older player
    #    Requires a current club or division — historical/retired players with no
    #    active affiliation fall through to Journeyman (they're used for comparison,
    #    not as live transfer targets, so career-stage archetype doesn't apply)
    if age and age >= 31 and mvt <= 3 and (div or clb):
        return "The Veteran Pro"

    # 5. PRESTIGE SEEKER — brand/status conscious; needs big league + quality
    if mvt >= 3 and div in TOP_5_LEAGUES and ment == "Attacking":
        return "The Prestige Seeker"

    # 6. PROJECT BUILDER — believes in the mission; young + growing quality
    #    Young players (≤23) with enough quality to have options
    if age and age <= 23 and mvt >= 2:
        return "The Project Builder"

    # 7. LOYALIST — identity and belonging above all else
    #    Character-driven; not superseded by quality/age rules above
    if ch in LOYALIST_CHARS:
        return "The Loyalist"

    # 8. TACTICIAN — system/philosophy follower; needs all three signals
    if ch in TACTICIAN_CHARS and ment == "Cautious" and cls in TACTICIAN_CLASSES:
        return "The Tactician"

    # 9. ENTERTAINER — showman; character + enough quality to matter
    if ch in ENTERTAINER_CHARS and mvt >= 3:
        return "The Entertainer"

    # 10. JOURNEYMAN — asks little, fits almost anywhere
    return "The Journeyman"


# ── Position inference ────────────────────────────────────────────────────────

DEFINITIVE_POS: dict[str, str] = {
    # GK
    "Keeper": "GK", "Guardian": "GK", "Distributor": "GK",
    "Sweeper": "GK", "shotstopper": "GK", "goalkeeper": "GK",
    # Defenders
    "Stopper": "CD", "Commander": "CD", "Cover": "CD",
    "guard": "CD", "Defender": "CD", "defender": "CD", "commander": "CD",
    # Holding mid
    "Controller": "DM",
    # Central mid
    "Engine": "CM", "Passer": "CM", "Playmaker": "CM",
    "Athlete": "CM", "dynamo": "CM", "support": "CM",
    # Striker
    "Striker": "CF", "Acrobat": "CF", "Orthodox": "CF",
    "striker": "CF", "Finisher": "CF", "attacker": "CF",
    # Wide fwd
    "Dribbler": "WF", "Winger": "WF", "speedster": "WF",
}

# Ambiguous: resolved by mentality
AMBIGUOUS_POS: dict[str, tuple[str, str, str]] = {
    #                    Attacking  Balanced  Cautious
    "Aerial":    ("CF",   "CD",   "CD"),
    "Sprinter":  ("WF",   "WF",   "WD"),
    "Creator":   ("AM",   "CM",   "CM"),
    "Powerhouse": ("CM",  "DM",   "DM"),
    "creator":   ("AM",   "CM",   "CM"),
    "attacker":  ("CF",   "WF",   "WF"),
}


def _class_to_pos(cls: str | None, mentality: str | None) -> str | None:
    if not cls:
        return None
    cls = cls.strip()
    if cls in DEFINITIVE_POS:
        return DEFINITIVE_POS[cls]
    if cls in AMBIGUOUS_POS:
        atk, bal, cau = AMBIGUOUS_POS[cls]
        if mentality == "Attacking": return atk
        if mentality == "Cautious":  return cau
        return bal
    return None


def infer_positions(
    primary_cls: str | None,
    secondary_cls: str | None,
    mentality: str | None,
) -> tuple[str | None, str | None]:
    primary_pos   = _class_to_pos(primary_cls, mentality)
    secondary_pos = _class_to_pos(secondary_cls, mentality)
    if secondary_pos == primary_pos:
        secondary_pos = None
    return primary_pos, secondary_pos


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    import psycopg2
    import psycopg2.extras

    print("Connecting...")
    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Add secondary_position column (idempotent)
    cur.execute("""
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS secondary_position TEXT
            CHECK (secondary_position IN ('GK','WD','CD','DM','CM','WM','AM','WF','CF'))
    """)
    # Add archetype_confidence column (idempotent)
    cur.execute("""
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS archetype_confidence TEXT
            CHECK (archetype_confidence IN ('high','medium','low'))
    """)

    # Load all players — compute age in SQL to avoid Python date edge cases
    print("Loading players...")
    cur.execute("""
        SELECT
            id, name, level, peak, division, club, position,
            "primary", secondary, "Mentality", "Character",
            archetype, archetype_override, market_value_tier,
            EXTRACT(YEAR FROM AGE('2026-03-05'::date, date_of_birth))::INTEGER AS age_yrs
        FROM players
    """)
    players = cur.fetchall()
    print(f"  {len(players):,} players loaded.")

    # Build update plan
    arch_dist: dict[str, int] = {}
    mvt_changed = arch_changed = pos_set = sec_set = 0
    updates: list[tuple] = []

    for p in players:
        pid      = p["id"]
        level    = p["level"]
        peak     = p["peak"]
        division = p["division"]
        club     = p["club"]
        cur_pos  = p["position"]
        prim_cls = p["primary"]
        sec_cls  = p["secondary"]
        mentality = p["Mentality"]
        character = p["Character"]
        cur_arch = p["archetype"]
        # archetype_override was auto-populated during import (mostly "The Journeyman")
        # and is not a reliable signal for genuine manual overrides.
        # We clear it here and re-infer everything from real signals.
        cur_mvt   = p["market_value_tier"]
        age       = p["age_yrs"]   # computed by SQL, int or None

        # ── Market Value Tier
        new_mvt = compute_mvt(level, peak, division)
        if new_mvt != cur_mvt:
            mvt_changed += 1

        # ── Archetype (always re-infer; archetype_override reset to NULL)
        new_arch = infer_archetype(new_mvt, age, division, club, mentality, character, prim_cls)
        new_conf = archetype_confidence(level, peak)
        arch_dist[new_arch] = arch_dist.get(new_arch, 0) + 1
        if new_arch != cur_arch:
            arch_changed += 1

        # ── Primary position (only fill if NULL)
        new_pos = None
        if not cur_pos and prim_cls:
            inferred = _class_to_pos(prim_cls, mentality)
            if inferred in VALID_POSITIONS:
                new_pos = inferred
                pos_set += 1

        # ── Secondary position
        new_sec = None
        effective_primary = cur_pos or new_pos
        inferred_p, inferred_s = infer_positions(prim_cls, sec_cls, mentality)
        if inferred_s and inferred_s != effective_primary:
            new_sec = inferred_s
            sec_set += 1

        updates.append((pid, new_mvt, new_arch, new_conf, new_pos, new_sec))

    # ── Summary
    print(f"\nPlan:")
    print(f"  MVT updated for {mvt_changed:,} players")
    print(f"  Archetype changed for {arch_changed:,} players")
    print(f"  Primary position inferred for {pos_set:,} players")
    print(f"  Secondary position inferred for {sec_set:,} players")
    print(f"\nArchetype distribution:")
    max_n = max(arch_dist.values())
    for arch, n in sorted(arch_dist.items(), key=lambda x: -x[1]):
        bar = "█" * round(n / max_n * 30)
        pct = n / len(players) * 100
        print(f"  {arch:<22} {bar:<30} {n:>6,}  ({pct:.1f}%)")

    if DRY_RUN:
        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write
    print("\nWriting to DB...")
    BATCH = 500
    for i in range(0, len(updates), BATCH):
        batch = updates[i:i + BATCH]
        for pid, mvt, arch, conf, new_pos, new_sec in batch:
            if new_pos:
                cur.execute(
                    """UPDATE players SET
                        market_value_tier = %s,
                        archetype = %s,
                        archetype_confidence = %s,
                        archetype_override = NULL,
                        position = %s::\"position\",
                        secondary_position = %s
                       WHERE id = %s""",
                    (mvt, arch, conf, new_pos, new_sec, pid),
                )
            else:
                cur.execute(
                    """UPDATE players SET
                        market_value_tier = %s,
                        archetype = %s,
                        archetype_confidence = %s,
                        archetype_override = NULL,
                        secondary_position = %s
                       WHERE id = %s""",
                    (mvt, arch, conf, new_sec, pid),
                )
        conn.commit()
        done = min(i + BATCH, len(updates))
        print(f"  {done:,}/{len(updates):,}", end="\r")

    print(f"\nDone. {len(updates):,} rows committed.")
    conn.close()


if __name__ == "__main__":
    main()
