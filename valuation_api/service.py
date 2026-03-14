"""
Service layer — bridges API schemas to valuation engine.

Handles database connections, profile loading, and response formatting.
"""

from __future__ import annotations

import os
from typing import Optional

from valuation_api.schemas import (
    ConfidenceSchema,
    ContextualFitBreakdownSchema,
    DecompositionSchema,
    DisagreementSchema,
    FlagsSchema,
    MarketValueSchema,
    SimulationRequestSchema,
    UseValueSchema,
    ValuationRequestSchema,
    ValuationResponseSchema,
)
from valuation_core.models.ensemble import run_valuation
from valuation_core.types import (
    ClubContext,
    EvaluationContext,
    PlayerProfile,
    SquadGap,
    ValuationMode,
)


def _get_connection():
    """Get a database connection."""
    import psycopg2
    dsn = os.environ.get("POSTGRES_DSN", "")
    if not dsn:
        raise ValueError("POSTGRES_DSN not configured")
    return psycopg2.connect(dsn)


def _load_profile(player_id: int) -> PlayerProfile:
    """Load player profile from database."""
    from valuation_core.data_loader import load_player_profile
    conn = _get_connection()
    try:
        profile = load_player_profile(player_id, conn)
        if not profile:
            raise ValueError(f"Player {player_id} not found")
        return profile
    finally:
        conn.close()


def _schema_to_context(schema) -> Optional[EvaluationContext]:
    """Convert API schema to internal EvaluationContext."""
    if not schema:
        return None

    buying_club = ClubContext(
        club_id=schema.buying_club.club_id,
        club_name=schema.buying_club.club_name,
        league=schema.buying_club.league,
        league_tier=schema.buying_club.league_tier,
        financial_tier=schema.buying_club.financial_tier,
        objective=schema.buying_club.objective,
    )

    selling_club = None
    if schema.selling_club:
        selling_club = ClubContext(
            club_id=schema.selling_club.club_id,
            selling_pressure=schema.selling_club.selling_pressure,
        )

    squad_gaps = [
        SquadGap(
            position=g.position,
            archetype_gaps=g.archetype_gaps,
            personality_gaps=g.personality_gaps,
            style_tag_gaps=g.style_tag_gaps,
        )
        for g in schema.squad_gaps
    ]

    return EvaluationContext(
        buying_club=buying_club,
        target_position=schema.target_position,
        target_system=schema.target_system,
        squad_gaps=squad_gaps,
        window=schema.window,
        selling_club=selling_club,
    )


def _response_to_schema(response) -> ValuationResponseSchema:
    """Convert internal ValuationResponse to API schema."""
    mv = response.market_value
    market_value = MarketValueSchema(
        central=mv.central, p10=mv.p10, p25=mv.p25,
        p75=mv.p75, p90=mv.p90,
    )

    use_value = None
    if response.use_value:
        uv = response.use_value
        fb = uv.contextual_fit_breakdown
        use_value = UseValueSchema(
            central=uv.central,
            contextual_fit_score=uv.contextual_fit_score,
            contextual_fit_breakdown=ContextualFitBreakdownSchema(
                system_archetype_fit=fb.system_archetype_fit,
                system_threshold_fit=fb.system_threshold_fit,
                system_personality_fit=fb.system_personality_fit,
                system_tag_compatibility=fb.system_tag_compatibility,
                squad_gap_fill=fb.squad_gap_fill,
            ),
        )

    dec = response.decomposition
    decomposition = DecompositionSchema(
        scout_profile_contribution=dec.scout_profile_contribution,
        performance_data_contribution=dec.performance_data_contribution,
        contract_age_contribution=dec.contract_age_contribution,
        market_context_contribution=dec.market_context_contribution,
        personality_adjustment=dec.personality_adjustment,
        playing_style_fit_adjustment=dec.playing_style_fit_adjustment,
    )

    conf = response.confidence
    confidence = ConfidenceSchema(
        profile_confidence=conf.profile_confidence,
        data_coverage=conf.data_coverage,
        overall_confidence=conf.overall_confidence,
        band_width_ratio=conf.band_width_ratio,
    )

    disagreement_schema = None
    if response.disagreement:
        d = response.disagreement
        disagreement_schema = DisagreementSchema(
            scout_anchored_value=d.scout_anchored_value,
            data_implied_value=d.data_implied_value,
            divergent_features=d.divergent_features,
            narrative=d.narrative,
        )

    flags = FlagsSchema(
        disagreement_flag=response.disagreement_flag,
        scout_data_delta=disagreement_schema,
        stale_profile=response.stale_profile,
        low_data_warning=response.low_data_warning,
        personality_risk_flags=response.personality_risk_flags,
        playing_style_risk_flags=response.style_risk_flags,
    )

    return ValuationResponseSchema(
        market_value=market_value,
        use_value=use_value,
        decomposition=decomposition,
        confidence=confidence,
        flags=flags,
        comparable_transfers=[],
        narrative=response.narrative,
        model_version=response.model_version,
    )


def run_single_valuation(
    request: ValuationRequestSchema,
) -> ValuationResponseSchema:
    """Run valuation for a single player."""
    profile = _load_profile(request.player_id)
    context = _schema_to_context(request.evaluation_context)
    mode = ValuationMode(request.mode)

    response = run_valuation(
        profile=profile,
        context=context,
        mode=mode,
        model_version=request.model_version,
    )

    return _response_to_schema(response)


def run_batch_valuation(
    requests: list[ValuationRequestSchema],
) -> list[ValuationResponseSchema]:
    """Run valuations for a batch of players."""
    return [run_single_valuation(req) for req in requests]


def run_simulation(
    request: SimulationRequestSchema,
) -> ValuationResponseSchema:
    """
    Run scenario simulation — modify profile fields and re-value.
    """
    profile = _load_profile(request.player_id)

    # Apply changes
    for field, value in request.changes.items():
        if hasattr(profile, field):
            setattr(profile, field, value)

    context = _schema_to_context(request.evaluation_context)
    mode = ValuationMode(request.mode)

    response = run_valuation(
        profile=profile,
        context=context,
        mode=mode,
    )

    return _response_to_schema(response)
