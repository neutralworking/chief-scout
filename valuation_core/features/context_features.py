"""
Context feature extraction — buying club, system fit, squad gaps.

Computed per-evaluation, not per-player.
"""

from __future__ import annotations

from valuation_core.fit.positional_fit import compute_positional_fit
from valuation_core.fit.system_fit import compute_system_fit
from valuation_core.fit.squad_fit import compute_squad_gap_fill
from valuation_core.types import EvaluationContext, PlayerProfile


def extract_context_features(
    profile: PlayerProfile,
    context: EvaluationContext,
) -> dict[str, float]:
    """
    Extract all contextual fit features for a specific evaluation.

    These are player-club-system-specific and change per evaluation request.
    """
    features: dict[str, float] = {}

    # Positional archetype fit
    pos_fit = compute_positional_fit(profile, context.target_position)
    features["positional_archetype_fit"] = pos_fit

    # System fit (archetype thresholds, personality, tags)
    system_result = compute_system_fit(profile, context.target_system)
    features["system_archetype_fit"] = system_result["archetype_fit"]
    features["system_threshold_fit"] = system_result["threshold_fit"]
    features["system_personality_fit"] = system_result["personality_fit"]
    features["system_tag_compatibility"] = system_result["tag_compatibility"]

    # Squad gap fill
    gap_fill = compute_squad_gap_fill(profile, context)
    features["squad_gap_fill"] = gap_fill

    return features
