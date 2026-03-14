"""
Narrative generation — human-readable valuation summaries.

Produces templated explanations following the spec's narrative format.
"""

from __future__ import annotations

from valuation_core.types import (
    DisagreementReport,
    EvaluationContext,
    MarketValue,
    PlayerProfile,
    UseValue,
)


def generate_narrative(
    profile: PlayerProfile,
    market_value: MarketValue,
    use_value: UseValue | None,
    ability: dict,
    personality_mult: float,
    context: EvaluationContext | None = None,
    disagreement: DisagreementReport | None = None,
) -> str:
    """Generate a human-readable valuation narrative."""
    parts = []

    # ── Central value + band ──────────────────────────────────────────────────

    central_str = _format_eur(market_value.central)
    band_str = f"{_format_eur(market_value.p10)}–{_format_eur(market_value.p90)}"
    parts.append(f"Valued at {central_str} (band: {band_str}).")

    # ── Archetype profile description ─────────────────────────────────────────

    primary = profile.primary_archetype
    secondary = profile.secondary_archetype
    if primary and secondary:
        p_score = profile.archetype_scores.get(primary, 0)
        s_score = profile.archetype_scores.get(secondary, 0)
        archetype_desc = (
            f"The valuation is driven primarily by a "
            f"{primary}-{secondary} profile ({p_score:.0f}/{s_score:.0f})"
        )

        # Highlight top attributes
        top_attrs = _get_top_attributes(profile, n=2)
        if top_attrs:
            attr_str = " and ".join(
                f"{a} {g:.0f}" for a, g in top_attrs
            )
            archetype_desc += f" with {attr_str}"

        parts.append(archetype_desc + ".")

    # ── Age/contract context ──────────────────────────────────────────────────

    age_contract = []
    if profile.age:
        age_contract.append(f"At {profile.age}")
    if profile.contract_years_remaining:
        yrs = profile.contract_years_remaining
        age_contract.append(
            f"with {yrs:.0f} year{'s' if yrs != 1 else ''} remaining"
        )

    if age_contract:
        phase = _age_phase(profile.age, profile.position)
        age_str = " ".join(age_contract)
        parts.append(f"{age_str}, the age-contract profile {phase}.")

    # ── Personality adjustment ────────────────────────────────────────────────

    adj_pct = (personality_mult - 1.0) * 100
    if abs(adj_pct) > 1:
        risk_tags = [t for t in profile.personality_tags if t in (
            "Contract Sensitive", "Commercially Motivated", "High Exit Probability",
            "High Maintenance", "Declining Trajectory", "Environmental Sensitivity",
            "Disciplinary Vulnerability", "Individual Agenda",
            "Unproven at Sustained Level",
        )]
        value_tags = [t for t in profile.personality_tags if t in (
            "Undroppable", "Culture Setter", "Proven at Level",
            "Big Game Player", "Captain Material", "Low Maintenance",
            "Context Neutral",
        )]

        if adj_pct < 0 and risk_tags:
            tag_str = ", ".join(risk_tags)
            parts.append(
                f"Personality risk tags ({tag_str}) apply a "
                f"{adj_pct:+.0f}% discount."
            )
        elif adj_pct > 0 and value_tags:
            tag_str = ", ".join(value_tags)
            parts.append(
                f"Personality value tags ({tag_str}) apply a "
                f"+{adj_pct:.0f}% premium."
            )

    # ── Performance cross-check ───────────────────────────────────────────────

    if disagreement:
        parts.append(disagreement.narrative)
    elif profile.performance:
        parts.append(
            "Performance data broadly supports the scout profile."
        )

    # ── Contextual fit ────────────────────────────────────────────────────────

    if use_value and context:
        fit = use_value.contextual_fit_score
        system_name = context.target_system.replace("_", " ").title()
        fit_desc = _fit_descriptor(fit)

        fit_parts = [
            f"Contextual fit for a {system_name} system is "
            f"{fit:.2f} — {fit_desc}"
        ]

        # Highlight key tags that align or conflict
        if profile.playing_style_tags:
            from valuation_core.config import TACTICAL_SYSTEMS
            system = TACTICAL_SYSTEMS.get(context.target_system, {})
            preferred = set(system.get("preferred_tags", []))
            concerns = set(system.get("concern_tags", []))
            player_tags = set(profile.playing_style_tags)

            matching = player_tags & preferred
            conflicting = player_tags & concerns

            if matching:
                fit_parts.append(
                    f"{', '.join(list(matching)[:3])} tags align"
                )
            if conflicting:
                fit_parts.append(
                    f"but {', '.join(list(conflicting)[:2])} "
                    f"{'is' if len(conflicting) == 1 else 'are'} a concern"
                )

        parts.append(". ".join(fit_parts) + ".")

    return " ".join(parts)


def _format_eur(value: int) -> str:
    """Format EUR value in human-readable form."""
    if value >= 1_000_000_000:
        return f"€{value / 1_000_000_000:.1f}bn"
    if value >= 1_000_000:
        return f"€{value / 1_000_000:.1f}m"
    if value >= 1_000:
        return f"€{value / 1_000:.0f}k"
    return f"€{value:,}"


def _get_top_attributes(
    profile: PlayerProfile, n: int = 3
) -> list[tuple[str, float]]:
    """Get top N attributes by effective grade."""
    sorted_attrs = sorted(
        profile.attributes.items(),
        key=lambda x: x[1].effective_grade,
        reverse=True,
    )
    return [
        (name.replace("_", " ").title(), grade.effective_grade)
        for name, grade in sorted_attrs[:n]
    ]


def _age_phase(age: int | None, position: str | None) -> str:
    """Describe the age-value phase."""
    if age is None:
        return "is in an unknown phase"
    if age <= 21:
        return "supports a high-potential valuation with significant upside"
    if age <= 24:
        return "supports a rising valuation near pre-peak"
    if age <= 29:
        return "supports a near-peak valuation"
    if age <= 31:
        return "indicates early decline with reduced transfer premium"
    return "reflects a late-career profile with limited resale"


def _fit_descriptor(fit: float) -> str:
    """Human-readable fit level."""
    if fit >= 0.85:
        return "excellent fit"
    if fit >= 0.70:
        return "strong fit"
    if fit >= 0.55:
        return "moderate fit"
    if fit >= 0.40:
        return "partial fit with concerns"
    return "poor fit"
