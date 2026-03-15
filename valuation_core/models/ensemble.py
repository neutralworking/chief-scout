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

from valuation_core.config import (
    DISAGREEMENT_THRESHOLD_STDEV,
    DOF_CONFIDENCE_BANDS,
    DOF_COMMERCIAL_MULTIPLIER,
)
from valuation_core.features.profile_features import compute_confidence_state
from valuation_core.models.ability_model import estimate_ability
from valuation_core.models.market_model import estimate_market_value
from valuation_core.models.context_model import compute_contextual_valuation
from valuation_core.explain.narrative_generator import generate_narrative
from valuation_core.types import (
    ConfidenceReport,
    Decomposition,
    DisagreementReport,
    DofAssessment,
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
    dof_assessment: DofAssessment | None = None,
    corrections: "CorrectionSet | None" = None,
) -> ValuationResponse:
    """
    Run the full 3-layer valuation pipeline.

    If no evaluation context is provided, returns market value only
    (no contextual fit or use value).

    If corrections is provided (from dof_corrections.compute_corrections),
    applies learned DoF calibration factors to the standard engine output.
    """
    # ── DoF anchor mode ───────────────────────────────────────────────────────
    # When a DoF assessment exists, it overrides the normal valuation flow.
    # The DoF's valuations become the anchor, with confidence-driven bands.

    if dof_assessment and mode == ValuationMode.DOF_ANCHOR:
        return _run_dof_anchor_valuation(profile, dof_assessment, context, model_version)

    # ── Layer 1: Ability estimation ───────────────────────────────────────────

    ability = estimate_ability(profile)

    # ── Layer 2: Market value ─────────────────────────────────────────────────

    market_result = estimate_market_value(profile, ability, mode)
    market_value = market_result["market_value"]

    # ── Apply DoF-learned corrections (if available) ─────────────────────────

    if corrections and corrections.n_assessments > 0:
        from valuation_core.calibration.dof_corrections import apply_corrections
        correction_mult = apply_corrections(
            market_value.central, profile, corrections, dof_assessment,
        ) / max(market_value.central, 1)
        market_value = MarketValue(
            central=int(market_value.central * correction_mult),
            p10=int(market_value.p10 * correction_mult),
            p25=int(market_value.p25 * correction_mult),
            p75=int(market_value.p75 * correction_mult),
            p90=int(market_value.p90 * correction_mult),
        )
        # Also correct the scout/data anchored values for disagreement detection
        market_result["scout_anchored_value"] = int(market_result["scout_anchored_value"] * correction_mult)
        market_result["data_implied_value"] = int(market_result["data_implied_value"] * correction_mult)

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


def _run_dof_anchor_valuation(
    profile: PlayerProfile,
    dof: DofAssessment,
    context: EvaluationContext | None,
    model_version: str,
) -> ValuationResponse:
    """
    DoF-anchored valuation: the DoF's valuations are near-absolute authority.

    1. worth_any_team_meur → market_value.central (P50)
    2. worth_right_team_meur → use_value.central
    3. Bands from DoF confidence level
    4. DoF dimension scores override pillar scores at 90/10 blend
    5. Commercial score maps to multiplier
    """
    from valuation_core.types import ContextualFitBreakdown, UseValue

    # ── Market value from DoF anchor ────────────────────────────────────────
    central_eur = int(dof.worth_any_team_meur * 1_000_000)
    band = DOF_CONFIDENCE_BANDS.get(dof.confidence, 0.20)

    p50 = central_eur
    p10 = int(central_eur * (1 - band * 1.28))
    p25 = int(central_eur * (1 - band * 0.67))
    p75 = int(central_eur * (1 + band * 0.67))
    p90 = int(central_eur * (1 + band * 1.28))

    market_value = MarketValue(central=p50, p10=p10, p25=p25, p75=p75, p90=p90)

    # ── Use value from DoF ──────────────────────────────────────────────────
    use_value_central = int(dof.worth_right_team_meur * 1_000_000)
    context_premium = dof.worth_right_team_meur / max(dof.worth_any_team_meur, 0.1)

    use_value = UseValue(
        central=use_value_central,
        contextual_fit_score=min(context_premium / 2.0, 1.0),
        contextual_fit_breakdown=ContextualFitBreakdown(
            system_archetype_fit=0.0,
            system_threshold_fit=0.0,
            system_personality_fit=0.0,
            system_tag_compatibility=0.0,
            squad_gap_fill=0.0,
        ),
    )

    # ── Run standard layers for disagreement detection ──────────────────────
    # 10% data retention keeps the disagreement detector working
    ability = estimate_ability(profile)
    standard_result = estimate_market_value(profile, ability, ValuationMode.SCOUT_DOMINANT)
    standard_central = standard_result["market_value"].central

    # ── Disagreement ────────────────────────────────────────────────────────
    disagreement_flag = False
    disagreement = None
    delta = abs(central_eur - standard_central)
    threshold = central_eur * 0.5  # flag if standard differs by >50%

    if standard_central > 0 and delta > threshold:
        disagreement_flag = True
        divergent = _identify_divergent_features(profile)
        disagreement = DisagreementReport(
            scout_anchored_value=central_eur,
            data_implied_value=standard_central,
            divergent_features=divergent,
            narrative=(
                f"DoF values at €{central_eur/1e6:.0f}m (any team) / "
                f"€{use_value_central/1e6:.0f}m (right team). "
                f"Standard engine implies €{standard_central/1e6:.0f}m. "
                f"Delta: {delta/1e6:.0f}m."
            ),
        )

    # ── Confidence ──────────────────────────────────────────────────────────
    conf_map = {"conviction": "high", "informed": "medium", "impression": "low"}
    overall_conf = conf_map.get(dof.confidence, "medium")

    confidence = ConfidenceReport(
        profile_confidence=1.0 if dof.confidence == "conviction" else 0.7,
        data_coverage=round(_compute_data_coverage(profile), 3),
        overall_confidence=overall_conf,
        band_width_ratio=round(p90 / max(p10, 1), 2),
    )

    # ── Decomposition (DoF-dominated) ───────────────────────────────────────
    decomposition = Decomposition(
        scout_profile_contribution=95.0,
        performance_data_contribution=5.0,
        contract_age_contribution=0.0,
        market_context_contribution=0.0,
        personality_adjustment=0.0,
        playing_style_fit_adjustment=0.0,
    )

    # ── Commercial multiplier info in narrative ─────────────────────────────
    commercial_mult = DOF_COMMERCIAL_MULTIPLIER.get(dof.commercial, 1.0)

    narrative = (
        f"DoF assessment ({dof.confidence}): "
        f"Technical {dof.technical}/10, Physical {dof.physical}/10, "
        f"Tactical {dof.tactical}/10, Personality {dof.personality}/10, "
        f"Commercial {dof.commercial}/10 ({commercial_mult:.2f}x), "
        f"Availability {dof.availability}/10. "
        f"Worth €{dof.worth_any_team_meur:.0f}m (any team), "
        f"€{dof.worth_right_team_meur:.0f}m (right team). "
        f"Context premium: {context_premium:.2f}x."
    )

    from valuation_core.config import RISK_TAGS
    personality_risks = [t for t in profile.personality_tags if t in RISK_TAGS]

    return ValuationResponse(
        market_value=market_value,
        use_value=use_value,
        decomposition=decomposition,
        confidence=confidence,
        disagreement_flag=disagreement_flag,
        disagreement=disagreement,
        stale_profile=False,
        low_data_warning=False,
        personality_risk_flags=personality_risks,
        style_risk_flags=[],
        comparable_transfers=[],
        narrative=narrative,
        model_version=model_version,
    )
