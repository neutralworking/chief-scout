"""
Positional fit scoring — how well a player's archetype profile
matches what a specific position demands.

Uses the positional relevance tiers from config.
"""

from __future__ import annotations

from valuation_core.config import POSITIONAL_ARCHETYPE_TIERS
from valuation_core.types import PlayerProfile


def compute_positional_fit(
    profile: PlayerProfile,
    target_position: str,
) -> float:
    """
    Compute positional archetype fit score (0.0 – 1.0).

    Measures how well the player's archetype score distribution aligns
    with the archetypes that matter for the target position. A Dribbler-Creator
    at AM = high fit. A Dribbler-Creator at CB = poor fit.

    The score is a weighted cosine-like similarity: for each archetype relevant
    to the position, multiply the player's score by the positional weight,
    sum, and normalize against the theoretical maximum.
    """
    tiers = POSITIONAL_ARCHETYPE_TIERS.get(target_position)
    if not tiers or not profile.archetype_scores:
        return 0.5  # neutral when data is missing

    weighted_score = 0.0
    max_possible = 0.0

    for archetype, weight in tiers.items():
        player_score = profile.archetype_scores.get(archetype, 0.0)
        weighted_score += (player_score / 100.0) * weight
        max_possible += weight

    if max_possible <= 0:
        return 0.5

    raw_fit = weighted_score / max_possible

    # Check primary/secondary alignment bonus
    primary = profile.primary_archetype
    secondary = profile.secondary_archetype

    # Bonus if primary archetype is one of the top-2 weighted archetypes for this position
    top_archetypes = sorted(tiers, key=tiers.get, reverse=True)[:2]
    alignment_bonus = 0.0
    if primary in top_archetypes:
        alignment_bonus += 0.08
    if secondary in top_archetypes:
        alignment_bonus += 0.04

    return min(1.0, raw_fit + alignment_bonus)


def compute_positional_fit_detailed(
    profile: PlayerProfile,
    target_position: str,
) -> dict[str, float]:
    """
    Detailed positional fit breakdown for explainability.

    Returns per-archetype contribution to the fit score.
    """
    tiers = POSITIONAL_ARCHETYPE_TIERS.get(target_position, {})
    breakdown = {}

    for archetype, weight in tiers.items():
        player_score = profile.archetype_scores.get(archetype, 0.0)
        contribution = (player_score / 100.0) * weight
        breakdown[archetype] = {
            "player_score": player_score,
            "positional_weight": weight,
            "contribution": contribution,
        }

    return breakdown
