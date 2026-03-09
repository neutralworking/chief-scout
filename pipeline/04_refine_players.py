"""
04_refine_players.py — Rule-based enrichment of the players table.

Derives / infers:
  1. market_value_tier (1-5) from level / peak + division
  2. archetype (scoring-based, respects archetype_override)
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


# ── Archetype confidence ───────────────────────────────────────────────────────

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


# ── Scoring-based archetype system ────────────────────────────────────────────
#
# Each scorer returns 0-100.
# Position gate = 50 pts if position matches, then bonuses from
# class / mentality / character / physique / attributes.
#
# Cross-position archetypes (Wonderkid, Elder Statesman) build score
# entirely from age/quality/trait bonuses — no position gate.

ATTR_VALS = {"Low": 1, "Medium": 2, "High": 3, "Elite": 4}


def _attr(attributes: dict | None, key: str) -> int:
    """Get numeric attribute value (0 if missing)."""
    if not attributes:
        return 0
    return ATTR_VALS.get(str(attributes.get(key) or ""), 0)


def _score_custodian(pos: str, cls: str, q: float, ment: str, attrs: dict) -> int:
    if pos != "GK":
        return 0
    score = 50
    if cls in {"Distributor", "Sweeper"}:
        score += 25
    elif cls in {"Keeper", "Guardian"}:
        score += 15
    if q >= 88:
        score += 15
    elif q >= 83:
        score += 10
    if ment == "Balanced":
        score += 5
    # Keepers shouldn't be pace-rated (Low pace is fine for a keeper)
    if _attr(attrs, "pace") == ATTR_VALS.get("Low", 1):
        score += 5
    return min(score, 100)


def _score_colossus(pos: str, cls: str, ch: str, phy: str, q: float, attrs: dict) -> int:
    if pos != "CD":
        return 0
    score = 50
    if cls in {"Commander", "Stopper"}:
        score += 25
    elif cls == "Cover":
        score += 10
    if phy in {"Power", "Aerial"}:
        score += 15
    if q >= 86:
        score += 10
    if ch in {"Combative", "Tenacious", "No-Nonsense", "Hard-Tackling"}:
        score += 5
    if _attr(attrs, "physicality") >= ATTR_VALS["High"]:
        score += 10
    return min(score, 100)


def _score_ball_player(pos: str, cls: str, sec: str, phy: str, q: float,
                        ment: str, attrs: dict) -> int:
    if pos not in {"CD", "DM"}:
        return 0
    PLAYMAKING = {"Passer", "Playmaker", "Creator", "Controller"}
    has_primary = cls in PLAYMAKING
    has_secondary = sec in PLAYMAKING
    if not has_primary and not has_secondary:
        return 0
    score = 50
    if has_primary:
        score += 20
    if has_secondary:
        score += 10
    if phy in {"Technical", "Agile"}:
        score += 15
    if ment in {"Balanced", "Cautious"}:
        score += 10
    if q >= 85:
        score += 5
    if _attr(attrs, "vision") >= ATTR_VALS["High"]:
        score += 10
    if _attr(attrs, "first_touch") >= ATTR_VALS["High"]:
        score += 10
    return min(score, 100)


def _score_fullback(pos: str, cls: str, phy: str, q: float, ment: str, attrs: dict) -> int:
    if pos != "WD":
        return 0
    score = 50
    if cls in {"Sprinter", "Dribbler", "Winger"}:
        score += 20
    if phy in {"Pace", "Agile"}:
        score += 15
    if ment == "Attacking":
        score += 15
    if cls in {"Cover", "Defender", "defender"}:
        score += 10
    if q >= 82:
        score += 5
    if _attr(attrs, "pace") >= ATTR_VALS["High"]:
        score += 10
    if _attr(attrs, "pressing") >= ATTR_VALS["High"]:
        score += 5
    return min(score, 100)


def _score_engine(pos: str, cls: str, q: float, ch: str, phy: str, attrs: dict) -> int:
    if pos not in {"CM", "DM", "WM"}:
        return 0
    ENGINE_CLASSES = {"Engine", "Athlete", "Dynamo", "dynamo", "support"}
    if cls not in ENGINE_CLASSES:
        return 0
    score = 50
    if cls in {"Engine", "Athlete", "Dynamo", "dynamo"}:
        score += 25
    if ch in {"Combative", "Tenacious", "Relentless", "Hard-Tackling"}:
        score += 15
    if phy == "Power":
        score += 10
    if _attr(attrs, "pressing") >= ATTR_VALS["High"]:
        score += 15
    if _attr(attrs, "physicality") >= ATTR_VALS["High"]:
        score += 10
    return min(score, 100)


def _score_architect(pos: str, cls: str, q: float, ment: str, ch: str, attrs: dict) -> int:
    if pos not in {"DM", "CM"}:
        return 0
    if cls not in {"Controller", "Passer"}:
        return 0
    score = 50 + 25  # gate + gate2 class confirmed
    if ch in {"Intelligent", "Focused", "Composed"}:
        score += 15
    if ment == "Cautious":
        score += 10
    if _attr(attrs, "vision") >= ATTR_VALS["High"]:
        score += 15
    # Architects don't press — Low or Medium pressing is appropriate
    pressing = _attr(attrs, "pressing")
    if pressing > 0 and pressing <= ATTR_VALS["Medium"]:
        score += 10
    return min(score, 100)


def _score_creator(pos: str, cls: str, q: float, ment: str, attrs: dict) -> int:
    if pos not in {"CM", "AM", "WM"}:
        return 0
    if cls not in {"Playmaker", "Creator", "Passer"}:
        return 0
    score = 50 + 20  # gate + gate2
    if ment == "Attacking":
        score += 15
    if q >= 85:
        score += 15
    if _attr(attrs, "vision") >= ATTR_VALS["High"]:
        score += 15
    if _attr(attrs, "first_touch") >= ATTR_VALS["High"]:
        score += 10
    return min(score, 100)


def _score_winger(pos: str, cls: str, q: float, ment: str, phy: str, attrs: dict) -> int:
    if pos not in {"WF", "AM"}:
        return 0
    WINGER_CLASSES = {"Dribbler", "Winger", "speedster", "Speedster"}
    if cls not in WINGER_CLASSES:
        return 0
    score = 50 + 25  # gate + gate2
    if phy in {"Pace", "Agile"}:
        score += 15
    if ment == "Attacking":
        score += 10
    if _attr(attrs, "pace") >= ATTR_VALS["High"]:
        score += 15
    # Wingers are nimble not powerful — Low or Medium physicality is fine
    phys = _attr(attrs, "physicality")
    if phys > 0 and phys <= ATTR_VALS["Medium"]:
        score += 10
    return min(score, 100)


def _score_finisher(pos: str, cls: str, q: float, ment: str, attrs: dict) -> int:
    if pos != "CF":
        return 0
    FINISHER_CLASSES = {"Striker", "Acrobat", "Orthodox", "Finisher", "striker"}
    if cls not in FINISHER_CLASSES:
        return 0
    score = 50 + 25  # gate + gate2
    if ment == "Attacking":
        score += 15
    if q >= 85:
        score += 10
    phys = _attr(attrs, "physicality")
    if phys >= ATTR_VALS["Medium"]:
        score += 15
    pace = _attr(attrs, "pace")
    if pace >= ATTR_VALS["Medium"]:
        score += 10
    return min(score, 100)


def _score_target_man(pos: str, cls: str, ch: str, phy: str, attrs: dict) -> int:
    if pos != "CF":
        return 0
    if cls not in {"Aerial", "Powerhouse"}:
        return 0
    score = 50 + 25  # gate + gate2
    if phy in {"Power", "Aerial"}:
        score += 15
    if ch in {"Combative", "Tenacious", "No-Nonsense"}:
        score += 10
    if _attr(attrs, "physicality") >= ATTR_VALS["High"]:
        score += 15
    # Target men are strong not fast — Low or Medium pace fits
    pace = _attr(attrs, "pace")
    if pace > 0 and pace <= ATTR_VALS["Medium"]:
        score += 10
    return min(score, 100)


def _score_wonderkid(pos: str, q: float, age: int | None, div: str, attrs: dict) -> int:
    if age is None or age > 22 or q < 80:
        return 0
    score = 0
    if age <= 20:
        score += 40
    else:
        score += 25
    if q >= 87:
        score += 35
    elif q >= 83:
        score += 25
    else:
        score += 10
    if div in TOP_5_LEAGUES:
        score += 15
    if pos in {"WF", "CF", "AM"}:
        score += 10
    if _attr(attrs, "pace") >= ATTR_VALS["High"]:
        score += 10
    return min(score, 100)


def _score_elder_statesman(q: float, age: int | None, ch: str, div: str) -> int:
    if age is None or age < 31 or q < 78:
        return 0
    score = 0
    if age >= 34:
        score += 40
    else:
        score += 25
    if q >= 85:
        score += 35
    elif q >= 81:
        score += 20
    else:
        score += 10
    if ch in {"Resolute", "Committed", "Reliable", "Passionate", "Tenacious"}:
        score += 15
    if div in TOP_LEAGUES:
        score += 10
    return min(score, 100)


def score_archetypes(pos, cls, sec, level, peak, age, division, club,
                     mentality, character, physique, attributes=None):
    q = (level or 0) or (peak * 0.92 if peak else 0)
    pos  = pos or ""
    cls  = cls or ""
    sec  = sec or ""
    ment = mentality or ""
    ch   = character or ""
    phy  = physique or ""
    div  = division or ""
    attrs = attributes or {}

    scores = {}
    scores["The Custodian"]       = _score_custodian(pos, cls, q, ment, attrs)
    scores["The Colossus"]        = _score_colossus(pos, cls, ch, phy, q, attrs)
    scores["The Ball-Player"]     = _score_ball_player(pos, cls, sec, phy, q, ment, attrs)
    scores["The Fullback"]        = _score_fullback(pos, cls, phy, q, ment, attrs)
    scores["The Engine"]          = _score_engine(pos, cls, q, ch, phy, attrs)
    scores["The Architect"]       = _score_architect(pos, cls, q, ment, ch, attrs)
    scores["The Creator"]         = _score_creator(pos, cls, q, ment, attrs)
    scores["The Winger"]          = _score_winger(pos, cls, q, ment, phy, attrs)
    scores["The Finisher"]        = _score_finisher(pos, cls, q, ment, attrs)
    scores["The Target Man"]      = _score_target_man(pos, cls, ch, phy, attrs)
    scores["The Wonderkid"]       = _score_wonderkid(pos, q, age, div, attrs)
    scores["The Elder Statesman"] = _score_elder_statesman(q, age, ch, div)
    return scores


def best_archetype(scores: dict, threshold: int = 50) -> str:
    best_name, best_score = max(scores.items(), key=lambda x: x[1])
    if best_score >= threshold:
        return best_name
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

    # Columns now live in player_profiles — no ALTER needed

    # Load all players — compute age in SQL to avoid Python date edge cases
    print("Loading players...")
    cur.execute("""
        SELECT
            id, name, level, peak, division, club, position,
            "primary", secondary, "Mentality", "Character", "Physique",
            archetype, archetype_override, market_value_tier,
            attributes,
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
        physique  = p.get("Physique")
        cur_arch  = p["archetype"]
        cur_mvt   = p["market_value_tier"]
        age       = p["age_yrs"]   # computed by SQL, int or None
        attributes = p.get("attributes") or {}

        # ── Market Value Tier
        new_mvt = compute_mvt(level, peak, division)
        if new_mvt != cur_mvt:
            mvt_changed += 1

        # ── Archetype (scoring-based; archetype_override reset to NULL)
        effective_pos = cur_pos or _class_to_pos(prim_cls, mentality) or ""
        scores = score_archetypes(
            pos=effective_pos,
            cls=prim_cls,
            sec=sec_cls,
            level=level,
            peak=peak,
            age=age,
            division=division,
            club=club,
            mentality=mentality,
            character=character,
            physique=physique,
            attributes=attributes,
        )
        new_arch = best_archetype(scores)
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
    max_n = max(arch_dist.values()) if arch_dist else 1
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
            # player_market: market_value_tier
            cur.execute(
                "UPDATE player_market SET market_value_tier = %s WHERE person_id = %s",
                (mvt, pid),
            )
            # player_profiles: archetype, confidence, override, position, secondary
            if new_pos:
                cur.execute(
                    """UPDATE player_profiles SET
                        archetype = %s,
                        archetype_confidence = %s,
                        archetype_override = NULL,
                        position = %s::\"position\",
                        secondary_position = %s
                       WHERE person_id = %s""",
                    (arch, conf, new_pos, new_sec, pid),
                )
            else:
                cur.execute(
                    """UPDATE player_profiles SET
                        archetype = %s,
                        archetype_confidence = %s,
                        archetype_override = NULL,
                        secondary_position = %s
                       WHERE person_id = %s""",
                    (arch, conf, new_sec, pid),
                )
        conn.commit()
        done = min(i + BATCH, len(updates))
        print(f"  {done:,}/{len(updates):,}", end="\r")

    print(f"\nDone. {len(updates):,} rows committed.")
    conn.close()


if __name__ == "__main__":
    main()
