"""
Layer 3: Market Value → Contextual Fee Band

Adjusts the neutral market value for deal-specific context
to produce the final fee band and contextual fit score.
"""

from __future__ import annotations

from valuation_core.config import WINDOW_MULTIPLIERS
from valuation_core.fit.positional_fit import compute_positional_fit
from valuation_core.fit.system_fit import compute_system_fit_score, compute_system_fit
from valuation_core.fit.squad_fit import compute_squad_gap_fill
from valuation_core.types import (
    ContextualFitBreakdown,
    EvaluationContext,
    MarketValue,
    PlayerProfile,
    UseValue,
)


def compute_contextual_valuation(
    profile: PlayerProfile,
    market_value: MarketValue,
    context: EvaluationContext,
) -> dict:
    """
    Apply contextual adjustments to market value.

    Returns:
      - adjusted_market_value: MarketValue with context adjustments
      - use_value: UseValue with contextual fit
      - contextual_fit_breakdown: detailed fit components
      - style_fit_adjustment: net % from playing style compatibility
    """
    # ── Contextual fit scoring ────────────────────────────────────────────────

    pos_fit = compute_positional_fit(profile, context.target_position)
    system_fit_components = compute_system_fit(profile, context.target_system)
    system_fit_score = compute_system_fit_score(profile, context.target_system)
    gap_fill = compute_squad_gap_fill(profile, context)

    # Composite contextual fit (0-1)
    contextual_fit = (
        pos_fit * 0.25
        + system_fit_components["archetype_fit"] * 0.20
        + system_fit_components["threshold_fit"] * 0.15
        + system_fit_components["personality_fit"] * 0.15
        + system_fit_components["tag_compatibility"] * 0.10
        + gap_fill * 0.15
    )

    fit_breakdown = ContextualFitBreakdown(
        system_archetype_fit=round(system_fit_components["archetype_fit"], 3),
        system_threshold_fit=round(system_fit_components["threshold_fit"], 3),
        system_personality_fit=round(system_fit_components["personality_fit"], 3),
        system_tag_compatibility=round(system_fit_components["tag_compatibility"], 3),
        squad_gap_fill=round(gap_fill, 3),
    )

    # ── Context adjustments to market value ───────────────────────────────────

    window_mult = WINDOW_MULTIPLIERS.get(context.window, 1.0)

    # Selling pressure discount
    selling_discount = 1.0
    if context.selling_club and context.selling_club.selling_pressure:
        # Higher pressure = lower fee (buyer's advantage)
        selling_discount = 1.0 - (context.selling_club.selling_pressure * 0.15)

    # Urgency premium (title-chasing club buying in winter)
    urgency_premium = 1.0
    if context.buying_club.objective == "title" and context.window == "winter":
        urgency_premium = 1.08

    # Release clause cap
    release_cap = None
    if profile.release_clause_eur and profile.release_clause_eur > 0:
        release_cap = profile.release_clause_eur

    # Apply adjustments
    adj_factor = window_mult * selling_discount * urgency_premium
    adjusted_p50 = int(market_value.central * adj_factor)
    adjusted_p10 = int(market_value.p10 * adj_factor)
    adjusted_p25 = int(market_value.p25 * adj_factor)
    adjusted_p75 = int(market_value.p75 * adj_factor)
    adjusted_p90 = int(market_value.p90 * adj_factor)

    # Cap at release clause if present
    if release_cap:
        adjusted_p50 = min(adjusted_p50, int(release_cap))
        adjusted_p75 = min(adjusted_p75, int(release_cap))
        adjusted_p90 = min(adjusted_p90, int(release_cap))

    adjusted_mv = MarketValue(
        central=adjusted_p50,
        p10=adjusted_p10,
        p25=adjusted_p25,
        p75=adjusted_p75,
        p90=adjusted_p90,
    )

    # ── Use value = market value × contextual fit multiplier ──────────────────
    # Fit > 0.5 means player is worth more to this club than the general market
    # Fit < 0.5 means player is worth less to this club
    fit_multiplier = 0.6 + contextual_fit * 0.8  # range: 0.6 - 1.4

    use_value_central = int(adjusted_p50 * fit_multiplier)

    use_value = UseValue(
        central=use_value_central,
        contextual_fit_score=round(contextual_fit, 3),
        contextual_fit_breakdown=fit_breakdown,
    )

    # Style fit adjustment %
    style_adj_pct = round((fit_multiplier - 1.0) * 100, 1)

    return {
        "adjusted_market_value": adjusted_mv,
        "use_value": use_value,
        "style_fit_adjustment_pct": style_adj_pct,
        "contextual_fit": contextual_fit,
    }
