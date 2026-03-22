"""
Layer 1: Profile → Latent Ability Estimation

Estimates the player's latent sporting contribution as a function of
their scouting profile and objective performance data.

Output: A latent ability estimate (0-100 scale) representing expected
contribution to team performance for the player's position.

In Phase 1, this is a rule-based model using archetype fit and
attribute quality. In Phase 2+, it will be an ensemble of CatBoost + LightGBM
trained on historical performance data.
"""

from __future__ import annotations

import numpy as np

from valuation_core.config import (
    COMPOUND_MODELS,
    CONFIDENCE_NOISE_SCALE,
    MONTE_CARLO_SAMPLES,
    POSITIONAL_ARCHETYPE_TIERS,
    SOURCE_PRIORITY,
)
from valuation_core.features.profile_features import compute_confidence_state
from valuation_core.types import PlayerProfile


def estimate_ability(
    profile: PlayerProfile,
    n_samples: int = MONTE_CARLO_SAMPLES,
) -> dict:
    """
    Estimate latent ability from the scouting profile.

    Returns:
        dict with:
          - central: point estimate (0-100)
          - samples: array of Monte Carlo samples
          - std: standard deviation of samples
          - domain_scores: breakdown by domain (attacking, defensive, possession, transition)
          - confidence_state: "high" | "medium" | "low" | "very_low"
    """
    confidence_state = compute_confidence_state(profile)

    # Run Monte Carlo samples with confidence-driven noise
    samples = []
    domain_samples = {"attacking": [], "defensive": [], "possession": [], "transition": []}

    for _ in range(n_samples):
        perturbed = _perturb_profile(profile)
        ability, domains = _compute_ability_from_profile(perturbed, profile.position, profile)
        samples.append(ability)
        for domain, score in domains.items():
            domain_samples[domain].append(score)

    samples_arr = np.array(samples)

    return {
        "central": float(np.median(samples_arr)),
        "mean": float(np.mean(samples_arr)),
        "samples": samples_arr,
        "std": float(np.std(samples_arr)),
        "domain_scores": {
            domain: float(np.median(vals)) for domain, vals in domain_samples.items()
        },
        "confidence_state": confidence_state,
    }


def _perturb_profile(profile: PlayerProfile) -> dict[str, float]:
    """
    Create a perturbed version of archetype scores based on attribute confidence.

    Low-confidence attributes get more noise, widening the value band.
    """
    perturbed_scores = {}
    rng = np.random.default_rng()

    for model, score in profile.archetype_scores.items():
        # Determine average confidence of this model's attributes
        from valuation_core.config import MODEL_ATTRIBUTES
        model_attrs = MODEL_ATTRIBUTES.get(model, [])
        noise_scales = []
        for attr in model_attrs:
            grade_info = profile.attributes.get(attr)
            if grade_info:
                conf = grade_info.confidence.value
            else:
                conf = "low"
            noise_scales.append(CONFIDENCE_NOISE_SCALE.get(conf, 0.30))

        avg_noise = np.mean(noise_scales) if noise_scales else 0.30

        # Apply Gaussian noise scaled by confidence
        noise = rng.normal(0, score * avg_noise)
        perturbed_scores[model] = max(0.0, min(100.0, score + noise))

    return perturbed_scores


def _compute_ability_from_profile(
    archetype_scores: dict[str, float],
    position: str | None,
    profile: "PlayerProfile | None" = None,
) -> tuple[float, dict[str, float]]:
    """
    Rule-based ability estimation from archetype scores.

    Phase 1: Weighted combination of archetype scores using positional
    relevance tiers. The ability score reflects how strong the player is
    at the archetypes that matter for their position.

    Returns: (ability_score, domain_breakdown)
    """
    pos = position or "CM"
    tiers = POSITIONAL_ARCHETYPE_TIERS.get(pos, {})

    if not tiers:
        # Fallback: simple mean of all scores
        all_scores = list(archetype_scores.values())
        ability = np.mean(all_scores) if all_scores else 50.0
        return ability, {"attacking": ability, "defensive": ability,
                        "possession": ability, "transition": ability}

    # Positionally-weighted ability
    weighted_sum = 0.0
    weight_total = 0.0
    for arch, weight in tiers.items():
        score = archetype_scores.get(arch, 0.0)
        weighted_sum += score * weight
        weight_total += weight

    ability = weighted_sum / weight_total if weight_total > 0 else 50.0

    # Domain breakdown
    domains = _compute_domain_scores(archetype_scores, profile)

    return ability, domains


def _compute_domain_scores(
    archetype_scores: dict[str, float],
    profile: "PlayerProfile | None" = None,
) -> dict[str, float]:
    """Break down ability into tactical domains.

    When pillar scores are available, blend them with archetype-derived
    domain scores (70% archetype, 30% pillar) for more stable estimates.
    """
    # Attacking: Striker, Creator, Dribbler, Sprinter
    attacking_models = ["Striker", "Creator", "Dribbler", "Sprinter"]
    attacking = np.mean([archetype_scores.get(m, 0) for m in attacking_models])

    # Defensive: Destroyer, Cover, Commander, Powerhouse
    defensive_models = ["Destroyer", "Cover", "Commander", "Powerhouse"]
    defensive = np.mean([archetype_scores.get(m, 0) for m in defensive_models])

    # Possession: Passer, Controller, Dribbler, Creator
    possession_models = ["Passer", "Controller", "Dribbler", "Creator"]
    possession = np.mean([archetype_scores.get(m, 0) for m in possession_models])

    # Transition: Sprinter, Engine, Dribbler, Striker
    transition_models = ["Sprinter", "Engine", "Dribbler", "Striker"]
    transition = np.mean([archetype_scores.get(m, 0) for m in transition_models])

    domains = {
        "attacking": float(attacking),
        "defensive": float(defensive),
        "possession": float(possession),
        "transition": float(transition),
    }

    # Blend with pillar scores when available (pillars map to domains)
    if profile is not None:
        pillar_map = {
            "attacking": profile.technical_score,   # Technical → attacking quality
            "defensive": profile.tactical_score,     # Tactical → defensive reads
            "possession": profile.mental_score,      # Mental → possession composure
            "transition": profile.physical_score,    # Physical → transition pace
        }
        for domain, pillar in pillar_map.items():
            if pillar is not None:
                # Blend: 70% archetype-derived, 30% pillar
                domains[domain] = domains[domain] * 0.7 + pillar * 0.3

    return domains
