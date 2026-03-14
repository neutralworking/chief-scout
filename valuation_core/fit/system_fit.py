"""
Tactical system fit scoring — how well a player's profile maps
to a specific tactical system (gegenpress, tiki_taka, etc.).

Uses the style compatibility tables from config.
"""

from __future__ import annotations

from valuation_core.config import TACTICAL_SYSTEMS
from valuation_core.types import PlayerProfile


def compute_system_fit(
    profile: PlayerProfile,
    target_system: str,
) -> dict[str, float]:
    """
    Compute tactical system fit across four dimensions.

    Returns dict with:
      - archetype_fit: how well archetype scores meet system requirements
      - threshold_fit: % of required attribute thresholds met
      - personality_fit: alignment of personality poles with system preferences
      - tag_compatibility: net asset vs concern tag balance
    """
    system = TACTICAL_SYSTEMS.get(target_system)
    if not system:
        return {
            "archetype_fit": 0.5,
            "threshold_fit": 0.5,
            "personality_fit": 0.5,
            "tag_compatibility": 0.5,
        }

    archetype_fit = _compute_archetype_fit(profile, system)
    threshold_fit = _compute_threshold_fit(profile, system)
    personality_fit = _compute_personality_fit(profile, system)
    tag_compat = _compute_tag_compatibility(profile, system)

    return {
        "archetype_fit": archetype_fit,
        "threshold_fit": threshold_fit,
        "personality_fit": personality_fit,
        "tag_compatibility": tag_compat,
    }


def compute_system_fit_score(
    profile: PlayerProfile,
    target_system: str,
) -> float:
    """Single composite system fit score (0.0 - 1.0)."""
    components = compute_system_fit(profile, target_system)
    # Weighted combination
    return (
        components["archetype_fit"] * 0.30
        + components["threshold_fit"] * 0.25
        + components["personality_fit"] * 0.20
        + components["tag_compatibility"] * 0.25
    )


def _compute_archetype_fit(profile: PlayerProfile, system: dict) -> float:
    """How well archetype scores meet system archetype requirements."""
    requirements = system.get("archetype_requirements", {})
    if not requirements or not profile.archetype_scores:
        return 0.5

    scores = []
    for archetype, threshold in requirements.items():
        player_score = profile.archetype_scores.get(archetype, 0.0)
        # Score is 1.0 if at/above threshold, scaled down linearly below
        if player_score >= threshold:
            scores.append(1.0)
        else:
            scores.append(max(0.0, player_score / threshold))

    return sum(scores) / len(scores) if scores else 0.5


def _compute_threshold_fit(profile: PlayerProfile, system: dict) -> float:
    """% of key attribute thresholds met for the system."""
    key_attrs = system.get("key_attributes", [])
    if not key_attrs or not profile.attributes:
        return 0.5

    met = 0
    total = len(key_attrs)
    for attr in key_attrs:
        grade_info = profile.attributes.get(attr)
        if grade_info and grade_info.effective_grade >= 6.0:
            met += 1
        elif grade_info and grade_info.effective_grade >= 4.0:
            met += 0.5

    return met / total if total > 0 else 0.5


def _compute_personality_fit(profile: PlayerProfile, system: dict) -> float:
    """Alignment of personality poles with system preferences."""
    prefs = system.get("personality_preferences", {})
    if not prefs or not profile.personality_code:
        return 0.5

    code = profile.personality_code
    # Map pole letters to positions in the 4-letter code
    pole_positions = {
        "A": 0, "I": 0,  # Game Reading
        "X": 1, "N": 1,  # Motivation
        "S": 2, "L": 2,  # Social Orientation
        "C": 3, "P": 3,  # Pressure Response
    }

    total_weight = 0.0
    alignment = 0.0

    for pole, importance in prefs.items():
        pos = pole_positions.get(pole)
        if pos is not None and pos < len(code):
            total_weight += importance
            if code[pos] == pole:
                alignment += importance

    return alignment / total_weight if total_weight > 0 else 0.5


def _compute_tag_compatibility(profile: PlayerProfile, system: dict) -> float:
    """Net balance of preferred vs concern playing style tags."""
    preferred = set(system.get("preferred_tags", []))
    concerns = set(system.get("concern_tags", []))
    player_tags = set(profile.playing_style_tags)

    if not preferred and not concerns:
        return 0.5

    asset_count = len(player_tags & preferred)
    concern_count = len(player_tags & concerns)

    max_assets = max(len(preferred), 1)

    # Score: assets boost, concerns penalize, normalize to 0-1
    raw = (asset_count / max_assets) - (concern_count * 0.15)
    return max(0.0, min(1.0, 0.5 + raw * 0.5))
