"""
Layer 2: Ability + Profile → Market Value

Maps the latent ability estimate and player profile (age, contract,
position, league, personality) to a "clean" market value under
neutral conditions.

Phase 1: Rule-based using the existing CS Value formula enhanced with
archetype-driven ability estimates, personality adjustments, and
confidence-driven uncertainty bands.

Phase 2+: Monotonic GBM with quantile regression, trained on
historical transfer fees matched with pre-transfer profile snapshots.
"""

from __future__ import annotations

import math

import numpy as np

from valuation_core.config import (
    BAND_WIDTH_MULTIPLIERS,
    CONTRACT_MULTIPLIERS,
    LAMBDA_MODES,
    LEAGUE_STRENGTH,
    NATIONAL_TEAM_PREMIUM,
    POSITION_SCARCITY,
    RISK_TAGS,
    VALUE_TAGS,
)
from valuation_core.features.market_features import (
    compute_age_multiplier,
    compute_contract_multiplier,
)
from valuation_core.types import MarketValue, PlayerProfile, ValuationMode


def ability_to_base_value(ability: float) -> float:
    """
    Convert ability score (0-100) to base market value in EUR.

    Exponential curve calibrated against known transfer values:
      ability 90+ → €100m+
      ability 80  → €30-50m
      ability 70  → €8-15m
      ability 60  → €2-5m
      ability 50  → €0.5-1.5m
      ability <40 → <€500k
    """
    if ability < 30:
        return 100_000
    if ability < 40:
        return 100_000 + (ability - 30) * 40_000  # 100k - 500k
    if ability < 50:
        return 500_000 + (ability - 40) * 100_000  # 500k - 1.5m
    if ability < 60:
        return 1_500_000 + (ability - 50) * 350_000  # 1.5m - 5m
    if ability < 70:
        return 5_000_000 + (ability - 60) * 1_000_000  # 5m - 15m
    if ability < 80:
        return 15_000_000 + (ability - 70) * 3_500_000  # 15m - 50m
    if ability < 90:
        return 50_000_000 + (ability - 80) * 7_000_000  # 50m - 120m
    # 90+: elite
    return 120_000_000 + (ability - 90) * 15_000_000


def compute_personality_adjustment(profile: PlayerProfile) -> float:
    """
    Compute net multiplicative adjustment from personality tags.

    Risk tags apply discounts, value tags apply premiums.
    Returns a multiplier (e.g. 0.88 for -12% net discount).
    """
    net_adjustment = 0.0

    for tag in profile.personality_tags:
        if tag in RISK_TAGS:
            net_adjustment += RISK_TAGS[tag]
        elif tag in VALUE_TAGS:
            net_adjustment += VALUE_TAGS[tag]

    # Special interactions
    tags_set = set(profile.personality_tags)

    # High Exit Probability + Contract Sensitive = compounded risk
    if "High Exit Probability" in tags_set and "Contract Sensitive" in tags_set:
        net_adjustment -= 0.03  # additional penalty

    # Declining Trajectory modifies age curve (handled separately, but add flag)
    # Proven at Level reduces league uncertainty (handled in context)

    return 1.0 + net_adjustment


def estimate_market_value(
    profile: PlayerProfile,
    ability_estimate: dict,
    mode: ValuationMode = ValuationMode.SCOUT_DOMINANT,
) -> dict:
    """
    Estimate market value from ability estimate and profile features.

    Returns dict with:
      - central: P50 value in EUR
      - p10, p25, p75, p90: quantile estimates
      - personality_adj: net personality adjustment multiplier
      - decomposition components
    """
    lam = LAMBDA_MODES.get(mode.value, 0.7)

    # ── Scout-anchored value (from archetype profile) ─────────────────────────

    ability_central = ability_estimate["central"]
    base_value = ability_to_base_value(ability_central)

    # Apply modifiers
    age_mult = compute_age_multiplier(profile.age, profile.position)
    contract_mult = compute_contract_multiplier(profile.contract_years_remaining)
    scarcity_mult = POSITION_SCARCITY.get(profile.position or "CM", 1.0)
    league_mult = LEAGUE_STRENGTH.get(
        profile.league or "default", LEAGUE_STRENGTH["default"]
    )
    national_mult = NATIONAL_TEAM_PREMIUM.get(
        profile.national_team_status or "none", 1.0
    )
    personality_mult = compute_personality_adjustment(profile)

    scout_value = (
        base_value
        * age_mult
        * contract_mult
        * scarcity_mult
        * league_mult
        * national_mult
        * personality_mult
    )

    # ── Effective score: best_role_score capped by level ──────────────────────
    # best_role_score = data-derived score in optimal role (0-100)
    # level = editorial ceiling (1-99) — the best the player can possibly be
    # effective_score = min(role_score, level) with condition modifiers

    effective_score = _compute_effective_score(profile)

    # ── Data-implied value (from effective score) ───────────────────────────
    # The effective score is the primary value driver, replacing raw level

    data_value = scout_value  # default: same as scout
    if effective_score is not None:
        score_base = _level_to_base_value(effective_score)
        data_value = (
            score_base * 1_000_000
            * age_mult
            * contract_mult
            * scarcity_mult
            * league_mult
        )

    if profile.transfer_fee_eur and profile.transfer_fee_eur > 0:
        tm_value = profile.transfer_fee_eur
        data_value = data_value * 0.6 + tm_value * 0.4

    # ── Market value reality anchor ─────────────────────────────────────────
    if profile.market_value_eur and profile.market_value_eur > 0:
        mv_anchor = profile.market_value_eur
        data_value = data_value * 0.5 + mv_anchor * 0.5

    # ── Blend scout and data values using λ ───────────────────────────────────
    confidence_state = ability_estimate.get("confidence_state", "low")
    ability_central = ability_estimate["central"]

    # Adjust λ based on data confidence
    if confidence_state == "very_low":
        lam = min(lam, 0.10)
    elif confidence_state == "low":
        lam = min(lam, 0.25)
    elif confidence_state == "medium":
        lam = min(lam, 0.40)

    # Sanity check: if effective score implies elite but ability disagrees, reduce λ
    if effective_score and effective_score >= 80:
        expected_ability = effective_score * 0.85
        level_ability_gap = max(0, expected_ability - ability_central)
        if level_ability_gap > 30:
            lam = min(lam, 0.05)
        elif level_ability_gap > 20:
            lam = min(lam, 0.15)

    central = lam * scout_value + (1 - lam) * data_value

    # ── Compute quantile bands from Monte Carlo samples ───────────────────────

    ability_samples = ability_estimate.get("samples", np.array([ability_central]))
    confidence_state = ability_estimate.get("confidence_state", "medium")
    band_mult = BAND_WIDTH_MULTIPLIERS.get(confidence_state, 1.8)

    # Generate value samples from ability samples
    value_samples = []
    for ability_sample in ability_samples:
        sample_base = ability_to_base_value(float(ability_sample))
        sample_value = (
            sample_base * age_mult * contract_mult * scarcity_mult
            * league_mult * national_mult * personality_mult
        )
        # Blend with data value
        blended = lam * sample_value + (1 - lam) * data_value
        value_samples.append(blended)

    value_arr = np.array(value_samples)

    # Widen bands based on confidence state
    median = float(np.median(value_arr))
    std = float(np.std(value_arr)) * band_mult

    p10 = max(0, int(median - 1.28 * std))
    p25 = max(0, int(median - 0.67 * std))
    p50 = int(median)
    p75 = int(median + 0.67 * std)
    p90 = int(median + 1.28 * std)

    # Ensure monotonicity of quantiles
    p10 = min(p10, p50)
    p25 = min(max(p25, p10), p50)
    p75 = max(p75, p50)
    p90 = max(p90, p75)

    # Band width ratio
    band_width_ratio = p90 / max(p10, 1)

    # Decomposition
    total_modifiers = abs(math.log(age_mult)) + abs(math.log(contract_mult)) + \
                      abs(math.log(scarcity_mult)) + abs(math.log(league_mult)) + \
                      abs(math.log(personality_mult)) + abs(math.log(national_mult))
    total_modifiers = max(total_modifiers, 0.01)

    scout_pct = lam * 100
    data_pct = (1 - lam) * 100
    # Redistribute the non-profile portion
    contract_age_pct = (abs(math.log(age_mult)) + abs(math.log(contract_mult))) / total_modifiers * data_pct
    market_pct = (abs(math.log(scarcity_mult)) + abs(math.log(league_mult)) + abs(math.log(national_mult))) / total_modifiers * data_pct
    personality_pct = abs(math.log(personality_mult)) / total_modifiers * data_pct

    return {
        "market_value": MarketValue(
            central=p50,
            p10=p10,
            p25=p25,
            p75=p75,
            p90=p90,
        ),
        "scout_anchored_value": int(scout_value),
        "data_implied_value": int(data_value),
        "personality_adjustment": personality_mult,
        "band_width_ratio": band_width_ratio,
        "decomposition": {
            "scout_profile_pct": round(scout_pct, 1),
            "performance_data_pct": round(data_pct - contract_age_pct - market_pct - personality_pct, 1),
            "contract_age_pct": round(contract_age_pct, 1),
            "market_context_pct": round(market_pct, 1),
            "personality_adj_pct": round((personality_mult - 1.0) * 100, 1),
        },
    }


def _compute_effective_score(profile: PlayerProfile) -> int | None:
    """
    Compute the effective score that drives valuation.

    Signals (in priority order):
      1. best_role_score (data-derived, from archetype fit to best tactical role)
      2. overall_pillar_score (precomputed Technical+Tactical+Mental+Physical avg)
      3. level (editorial ceiling)

    When multiple signals exist, we blend them:
      - role_score + pillar + level: 45% role, 25% pillar, 30% level
      - role_score + level (no pillar): 60% role, 40% level
      - role_score + pillar (no level): 65% role, 35% pillar
      - pillar + level (no role): 40% pillar, 60% level
      - single signal: use directly

    Level is always the ceiling — blended score cannot exceed it.

    Condition modifiers reduce score below ceiling:
      - Trajectory: declining players score lower
      - Profile tier: skeleton profiles get penalised
    """
    role_score = profile.best_role_score
    pillar = profile.overall_pillar_score
    level = profile.level

    if role_score is None and pillar is None and level is None:
        return None

    # Count available signals
    signals = sum(1 for s in (role_score, pillar, level) if s is not None)

    if signals == 3:
        # All three: role is primary, pillar validates, level caps
        blended = role_score * 0.45 + pillar * 0.25 + level * 0.30
        effective = int(min(blended, level))
    elif role_score is not None and level is not None:
        # No pillar data — original blend
        blended = role_score * 0.6 + level * 0.4
        effective = int(min(blended, level))
    elif role_score is not None and pillar is not None:
        # No level — pillar provides quality context
        blended = role_score * 0.65 + pillar * 0.35
        effective = int(blended)
    elif pillar is not None and level is not None:
        # No role score — pillar is a data-derived stand-in
        blended = pillar * 0.40 + level * 0.60
        effective = int(min(blended, level))
    elif role_score is not None:
        effective = role_score
    elif pillar is not None:
        effective = pillar
    else:
        effective = level

    # Condition modifiers
    if profile.trajectory == "declining":
        effective = max(effective - 5, 40)

    if role_score is None and pillar is None and profile.profile_tier == 3:
        effective = max(effective - 3, 40)

    # XP modifier (career experience)
    if profile.xp_modifier is not None and profile.xp_modifier != 0:
        effective = max(effective + profile.xp_modifier, 40)
        if level is not None:
            effective = min(effective, level)  # never exceed ceiling

    return effective


def _level_to_base_value(level: int) -> float:
    """Convert scouting level (1-99) to base value in millions EUR.
    Mirrors the existing 31_cs_value.py curve."""
    if level < 65:
        return 0.1
    if level < 70:
        return 0.5 + (level - 65) * 0.3
    if level < 75:
        return 2.0 + (level - 70) * 0.6
    if level < 80:
        return 5.0 + (level - 75) * 2.0
    if level < 85:
        return 15.0 + (level - 80) * 6.0
    if level < 90:
        return 45.0 + (level - 85) * 15.0
    return 120.0 + (level - 90) * 25.0
