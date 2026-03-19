"""
XP Detectors — modular milestone detection for Career XP v2.

Each detector module exposes a `detect(player_data) -> list[dict]` function
that returns milestone dicts with keys:
  milestone_key, milestone_label, xp_value, rarity, category,
  milestone_date (optional), source, details (JSON string)
"""

from pipeline.xp_detectors.origin import detect as detect_origin
from pipeline.xp_detectors.quests import detect as detect_quests
from pipeline.xp_detectors.combat import detect as detect_combat
from pipeline.xp_detectors.exploration import detect as detect_exploration
from pipeline.xp_detectors.character import detect as detect_character
from pipeline.xp_detectors.adversity import detect as detect_adversity
from pipeline.xp_detectors.reputation import detect as detect_reputation
from pipeline.xp_detectors.bonds import detect as detect_bonds
from pipeline.xp_detectors.cursed import detect as detect_cursed
from pipeline.xp_detectors.stats_deep import detect as detect_stats_deep

ALL_DETECTORS = [
    detect_origin,
    detect_quests,
    detect_combat,
    detect_exploration,
    detect_character,
    detect_adversity,
    detect_reputation,
    detect_bonds,
    detect_cursed,
    detect_stats_deep,
]

# XP Level thresholds (BG3-style exponential curve)
XP_LEVELS = [
    # (level, cumulative_xp_required, modifier, title)
    (1,   0,   0, "Novice"),
    (2,   3,   0, "Apprentice"),
    (3,   9,  +1, "Journeyman"),
    (4,  19,  +1, "Professional"),
    (5,  34,  +2, "Established"),
    (6,  54,  +2, "Veteran"),
    (7,  82,  +3, "Distinguished"),
    (8, 120,  +4, "Elite"),
    (9, 170,  +5, "World Class"),
    (10, 240, +6, "Legendary"),
    (11, 340, +7, "Immortal"),
    (12, 490, +8, "GOAT"),
]


def compute_xp_level(total_xp: int) -> tuple[int, int, str]:
    """Given total positive XP, return (level, modifier, title)."""
    level, modifier, title = 1, 0, "Novice"
    for lv, threshold, mod, name in XP_LEVELS:
        if total_xp >= threshold:
            level, modifier, title = lv, mod, name
        else:
            break
    return level, modifier, title


def compute_negative_modifier(negative_xp: int) -> int:
    """Compute penalty modifier from total negative XP (passed as positive value)."""
    if negative_xp <= 0:
        return 0
    if negative_xp <= 5:
        return -1
    if negative_xp <= 12:
        return -2
    if negative_xp <= 20:
        return -3
    return -5


# ── Legacy Score ─────────────────────────────────────────────────────────────
# RPG-style career legacy score. Big numbers. Top players hit 3000-5000+.
# A journeyman might have 200. A 20-year-old prospect, 50.

RARITY_MULTIPLIERS = {
    "legendary": 25, "epic": 15, "rare": 8, "uncommon": 4, "common": 2, "cursed": -3,
}

def compute_legacy_score(milestones: list[dict]) -> int:
    """
    Compute an RPG-style legacy score from milestones.

    The score is unbounded but practically ranges 0-9999.
    Components stack multiplicatively:

      Base = sum of (xp_value × rarity_multiplier) for each milestone
      Breadth bonus = +15% per category beyond 3 (max +100% at 10 cats)
      Streak bonus = +25% if 3+ epic/legendary events
      Penalty = cursed events subtract directly

    Targets:
      - GOAT (Messi with awards): 5000+
      - Elite career (Kane, KDB): 2500-4000
      - Established pro: 800-1500
      - Young talent: 100-400
      - Journeyman: 50-200
    """
    if not milestones:
        return 0

    # Base: each milestone contributes xp × rarity multiplier
    base = 0
    epic_legendary_count = 0
    positive_events = 0
    for m in milestones:
        xp = m["xp_value"]
        rarity = m.get("rarity", "common")
        mult = RARITY_MULTIPLIERS.get(rarity, 2)
        if xp > 0:
            base += xp * mult
            positive_events += 1
        else:
            base += abs(xp) * mult  # cursed mult is negative, so this subtracts

        if rarity in ("epic", "legendary"):
            epic_legendary_count += 1

    # Volume bonus — more events = richer career story
    # Use n^0.6 — rewards volume more than sqrt but still diminishing
    volume_mult = max(1.0, positive_events ** 0.6) if positive_events > 0 else 1.0

    # Streak bonus — multiple epic/legendary events = generational career
    # Requires genuine accumulation, not just 3 one-club events
    streak_bonus = 1.0
    if epic_legendary_count >= 10:
        streak_bonus = 2.0
    elif epic_legendary_count >= 6:
        streak_bonus = 1.5
    elif epic_legendary_count >= 4:
        streak_bonus = 1.25

    score = base * volume_mult * streak_bonus
    return max(0, round(score))
