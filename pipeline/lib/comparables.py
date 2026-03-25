"""
comparables.py — Find comparable transfers for valuation blending.

Queries the `transfer_comparables` view (joins transfers with player profiles,
career metrics, etc.) to find similar transfers and compute a weighted median
comparable value.

Usage:
    from lib.comparables import find_comparables, compute_similarity, recency_weight, weighted_median

    comps = find_comparables(conn, person_id=123, position="CF", level=88, age=24)
    # → list of dicts from transfer_comparables view
"""
from __future__ import annotations

from datetime import date, timedelta

from psycopg2.extras import RealDictCursor

# ── Position grouping ─────────────────────────────────────────────────────────

POS_GROUPS = {
    "GK": "GK",
    "WD": "DEF",
    "CD": "DEF",
    "DM": "MID",
    "CM": "MID",
    "WM": "MID",
    "AM": "MID",
    "WF": "FWD",
    "CF": "FWD",
}

# ── League tiers ──────────────────────────────────────────────────────────────

LEAGUE_TIERS: dict[str, int] = {
    # Tier 1
    "Premier League": 1,
    "La Liga": 1,
    "Bundesliga": 1,
    "Serie A": 1,
    "Ligue 1": 1,
    # Tier 2
    "Eredivisie": 2,
    "Liga Portugal": 2,
    "Championship": 2,
    "Serie B": 2,
    "Bundesliga 2": 2,
    "2. Bundesliga": 2,
    "Belgian Pro League": 2,
    "Primeira Liga": 2,
    "Scottish Premiership": 2,
    "Super Lig": 2,
}

# Trajectory adjacency for similarity scoring
_TRAJECTORY_ADJACENT = {
    "rising": {"newcomer", "peak"},
    "peak": {"rising", "declining", "one-club"},
    "declining": {"peak", "journeyman"},
    "newcomer": {"rising"},
    "journeyman": {"declining"},
    "one-club": {"peak"},
}

_TRAJECTORY_OPPOSITE = {
    "rising": {"declining"},
    "declining": {"rising"},
}


def _get_league_tier(league: str | None) -> int:
    """Return league tier (1-3). Unknown leagues default to tier 3."""
    if not league:
        return 3
    return LEAGUE_TIERS.get(league, 3)


def _months_since(d: date | None) -> float:
    """Months elapsed since a date."""
    if d is None:
        return 36.0  # default to old
    delta = date.today() - d
    return max(0, delta.days / 30.44)


# ── Core functions ────────────────────────────────────────────────────────────


def find_comparables(
    conn,
    person_id: int | None,
    position: str,
    level: int,
    age: int,
    archetype: str | None = None,
    trajectory: str | None = None,
    limit: int = 15,
) -> list[dict]:
    """
    Query the transfer_comparables view for comparable transfers.

    Filters:
      - fee_eur_m IS NOT NULL AND > 0
      - fee_type = 'permanent' (actual transfers only)
      - Same position or same position group
      - Age ±3 years
      - Level ±5 (when level available on the transfer via the view)
      - Last 4 years only
    """
    pos_group = POS_GROUPS.get(position, "")
    same_group_positions = [p for p, g in POS_GROUPS.items() if g == pos_group] if pos_group else [position]

    cutoff_date = date.today() - timedelta(days=4 * 365)

    conditions = [
        "fee_eur_m IS NOT NULL",
        "fee_eur_m > 0",
        "fee_type = 'permanent'",
        "confidence != 'low'",
        "transfer_date >= %s",
        "age_at_transfer BETWEEN %s AND %s",
    ]
    params: list = [cutoff_date, age - 3, age + 3]

    # Position: exact match OR same group
    placeholders = ", ".join(["%s"] * len(same_group_positions))
    conditions.append(f"position IN ({placeholders})")
    params.extend(same_group_positions)

    # Exclude the player themselves
    if person_id:
        conditions.append("(player_id IS NULL OR player_id != %s)")
        params.append(person_id)

    # Level filter — tighter band (±3) for meaningful comparisons
    conditions.append("(level IS NULL OR level BETWEEN %s AND %s)")
    params.extend([level - 3, level + 3])

    where = " AND ".join(conditions)

    sql = f"""
        SELECT *
        FROM transfer_comparables
        WHERE {where}
        ORDER BY transfer_date DESC
        LIMIT %s
    """
    params.append(limit)

    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(sql, params)
    results = [dict(row) for row in cur.fetchall()]
    cur.close()
    return results


def compute_similarity(target: dict, comp: dict) -> float:
    """
    Score a comparable transfer against the target player (0.0 – 1.0).

    7 dimensions with weights summing to 1.0:
      Position (0.25), Level band (0.20), Age band (0.15),
      Archetype (0.15), League tier (0.10), Trajectory (0.10),
      Recency (0.05).
    """
    score = 0.0

    # 1. Position (0.25)
    t_pos = target.get("position", "")
    c_pos = comp.get("position", "")
    if t_pos == c_pos:
        score += 0.25
    elif POS_GROUPS.get(t_pos) == POS_GROUPS.get(c_pos) and POS_GROUPS.get(t_pos):
        score += 0.125  # same group = 0.5 * weight
    # else 0

    # 2. Level band (0.20)
    t_level = target.get("level")
    c_level = comp.get("level")
    if t_level is not None and c_level is not None:
        diff = abs(t_level - c_level)
        if diff <= 2:
            score += 0.20
        elif diff <= 4:
            score += 0.12  # 0.6 * 0.20
        elif diff <= 7:
            score += 0.06  # 0.3 * 0.20
    else:
        score += 0.10  # neutral when unknown

    # 3. Age band (0.15)
    t_age = target.get("age")
    c_age = comp.get("age_at_transfer")
    if t_age is not None and c_age is not None:
        diff = abs(t_age - c_age)
        if diff <= 1:
            score += 0.15
        elif diff == 2:
            score += 0.105  # 0.7 * 0.15
        elif diff == 3:
            score += 0.06   # 0.4 * 0.15
    else:
        score += 0.075

    # 4. Archetype (0.15)
    t_arch = target.get("archetype")
    c_arch = comp.get("primary_archetype") or comp.get("profile_archetype")
    if t_arch and c_arch and t_arch.lower() == c_arch.lower():
        score += 0.15
    elif not t_arch or not c_arch:
        score += 0.075  # neutral
    # else 0

    # 5. League tier (0.10)
    # Use to_league for the comp (destination league reflects buying market)
    c_league = comp.get("to_league")
    t_tier = 1  # target is presumably being bought at top level
    c_tier = _get_league_tier(c_league)
    tier_diff = abs(t_tier - c_tier)
    if tier_diff == 0:
        score += 0.10
    elif tier_diff == 1:
        score += 0.05
    else:
        score += 0.02

    # 6. Trajectory (0.10)
    t_traj = target.get("trajectory")
    c_traj = comp.get("trajectory")
    if t_traj and c_traj:
        if t_traj == c_traj:
            score += 0.10
        elif c_traj in _TRAJECTORY_ADJACENT.get(t_traj, set()):
            score += 0.05
        elif c_traj in _TRAJECTORY_OPPOSITE.get(t_traj, set()):
            score += 0.0
        else:
            score += 0.025
    else:
        score += 0.05  # neutral

    # 7. Recency (0.05)
    months = _months_since(comp.get("transfer_date"))
    if months <= 6:
        score += 0.05
    elif months <= 12:
        score += 0.04
    elif months <= 24:
        score += 0.025
    else:
        score += 0.01

    # Confidence penalty: low-confidence fees (estimated, not real) get discounted
    confidence = comp.get("confidence", "medium")
    if confidence == "low":
        score *= 0.6
    elif confidence == "high":
        score *= 1.1  # slight boost for curated data

    return min(1.0, score)


def recency_weight(transfer_date: date | None) -> float:
    """Weight that decays with time: 1.0 / (1 + months_since / 12)."""
    months = _months_since(transfer_date)
    return 1.0 / (1.0 + months / 12.0)


def weighted_median(values: list[float], weights: list[float]) -> float:
    """Compute weighted median of values with corresponding weights."""
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]

    # Sort by value, carry weights along
    pairs = sorted(zip(values, weights), key=lambda x: x[0])
    sorted_values = [p[0] for p in pairs]
    sorted_weights = [p[1] for p in pairs]

    total_weight = sum(sorted_weights)
    if total_weight <= 0:
        return sorted_values[len(sorted_values) // 2]

    cumulative = 0.0
    half = total_weight / 2.0
    for i, (val, w) in enumerate(zip(sorted_values, sorted_weights)):
        cumulative += w
        if cumulative >= half:
            return val

    return sorted_values[-1]
