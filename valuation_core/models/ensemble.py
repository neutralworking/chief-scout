"""
Model orchestrator — runs the full 3-layer valuation stack.

Coordinates:
  Layer 1: Profile → Ability estimate
  Layer 2: Ability → Market value
  Layer 3: Market value → Contextual fee band

Handles disagreement detection, narrative generation, and
response assembly.
"""

from __future__ import annotations

import math

from valuation_core.config import DISAGREEMENT_THRESHOLD_STDEV
from valuation_core.features.profile_features import compute_confidence_state
from valuation_core.models.ability_model import estimate_ability
from valuation_core.models.market_model import estimate_market_value
from valuation_core.models.context_model import compute_contextual_valuation
from valuation_core.explain.narrative_generator import generate_narrative
from valuation_core.types import (
    ConfidenceReport,
    Decomposition,
    DisagreementReport,
    EvaluationContext,
    MarketValue,
    PlayerProfile,
    ValuationMode,
    ValuationResponse,
)


def run_valuation(
    profile: PlayerProfile,
    context: EvaluationContext | None = None,
    mode: ValuationMode = ValuationMode.SCOUT_DOMINANT,
    model_version: str = "v1.0",
) -> ValuationResponse:
    """
    Run the full 3-layer valuation pipeline.

    If no evaluation context is provided, returns market value only
    (no contextual fit or use value).
    """
    # ── Layer 1: Ability estimation ───────────────────────────────────────────

    ability = estimate_ability(profile)

    # ── Layer 2: Market value ─────────────────────────────────────────────────

    market_result = estimate_market_value(profile, ability, mode)
    market_value = market_result["market_value"]

    # ── Layer 3: Contextual adjustment (if context provided) ──────────────────

    use_value = None
    style_fit_adj = 0.0

    if context:
        context_result = compute_contextual_valuation(
            profile, market_value, context
        )
        market_value = context_result["adjusted_market_value"]
        use_value = context_result["use_value"]
        style_fit_adj = context_result["style_fit_adjustment_pct"]

    # ── Disagreement detection ────────────────────────────────────────────────

    scout_val = market_result["scout_anchored_value"]
    data_val = market_result["data_implied_value"]
    ability_std = ability["std"]

    disagreement_flag = False
    disagreement = None

    if ability_std > 0:
        # Convert to value-space standard deviation
        value_std = market_value.central * (ability_std / max(ability["central"], 1))
        delta = abs(scout_val - data_val)

        if delta > value_std * DISAGREEMENT_THRESHOLD_STDEV:
            disagreement_flag = True

            # Identify divergent features
            divergent = _identify_divergent_features(profile)

            narrative = (
                f"Scout profile implies €{scout_val:,.0f} "
                f"({profile.primary_archetype}-{profile.secondary_archetype} "
                f"profile at age {profile.age}). "
                f"Data implies €{data_val:,.0f}. "
                f"Disagreement driven by: {', '.join(divergent[:3])}."
            )

            disagreement = DisagreementReport(
                scout_anchored_value=scout_val,
                data_implied_value=data_val,
                divergent_features=divergent,
                narrative=narrative,
            )

    # ── Confidence report ─────────────────────────────────────────────────────

    confidence_state = ability["confidence_state"]
    data_coverage = _compute_data_coverage(profile)

    overall_conf = "medium"
    if confidence_state == "high" and data_coverage > 0.7:
        overall_conf = "high"
    elif confidence_state in ("low", "very_low") or data_coverage < 0.3:
        overall_conf = "low"

    confidence = ConfidenceReport(
        profile_confidence=round(_profile_confidence_score(profile), 3),
        data_coverage=round(data_coverage, 3),
        overall_confidence=overall_conf,
        band_width_ratio=round(market_result["band_width_ratio"], 2),
    )

    # ── Decomposition ─────────────────────────────────────────────────────────

    dec = market_result["decomposition"]
    decomposition = Decomposition(
        scout_profile_contribution=dec["scout_profile_pct"],
        performance_data_contribution=dec["performance_data_pct"],
        contract_age_contribution=dec["contract_age_pct"],
        market_context_contribution=dec["market_context_pct"],
        personality_adjustment=dec["personality_adj_pct"],
        playing_style_fit_adjustment=style_fit_adj,
    )

    # ── Personality risk flags ────────────────────────────────────────────────

    from valuation_core.config import RISK_TAGS
    personality_risks = [t for t in profile.personality_tags if t in RISK_TAGS]

    # ── Stale / low-data warnings ─────────────────────────────────────────────

    stale = any(g.stale for g in profile.attributes.values())
    low_data = data_coverage < 0.3

    # ── Narrative ─────────────────────────────────────────────────────────────

    narrative = generate_narrative(
        profile=profile,
        market_value=market_value,
        use_value=use_value,
        ability=ability,
        personality_mult=market_result["personality_adjustment"],
        context=context,
        disagreement=disagreement,
    )

    return ValuationResponse(
        market_value=market_value,
        use_value=use_value,
        decomposition=decomposition,
        confidence=confidence,
        disagreement_flag=disagreement_flag,
        disagreement=disagreement,
        stale_profile=stale,
        low_data_warning=low_data,
        personality_risk_flags=personality_risks,
        style_risk_flags=[],
        comparable_transfers=[],
        narrative=narrative,
        model_version=model_version,
    )


def _identify_divergent_features(profile: PlayerProfile) -> list[str]:
    """Identify features where scout and data sources diverge."""
    divergent = []
    for attr, grade in profile.attributes.items():
        if grade.grade_type.value == "scout" and grade.effective_grade >= 7:
            # Check if there's a stat-based grade that's much lower
            # (simplified — in production, compare against FBref/SB data)
            if grade.confidence.value == "low":
                divergent.append(f"{attr} graded {grade.effective_grade} [scout, low confidence]")
    return divergent if divergent else ["overall profile shape"]


def _compute_data_coverage(profile: PlayerProfile) -> float:
    """Compute fraction of performance features available."""
    total_possible = 48  # all attributes
    available = sum(
        1 for g in profile.attributes.values()
        if g.grade_type.value in ("scout", "stat")
    )
    perf_coverage = len(profile.performance) / 20 if profile.performance else 0
    return min(1.0, (available / total_possible * 0.7) + (perf_coverage * 0.3))


def _profile_confidence_score(profile: PlayerProfile) -> float:
    """Weighted mean confidence across all attributes."""
    from valuation_core.config import CONFIDENCE_WEIGHTS
    if not profile.attributes:
        return 0.3
    scores = [
        CONFIDENCE_WEIGHTS.get(g.confidence.value, 0.3)
        for g in profile.attributes.values()
    ]
    return sum(scores) / len(scores)
