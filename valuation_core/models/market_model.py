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

    # ── Data-implied value (from level/TM anchor if available) ────────────────

    data_value = scout_value  # default: same as scout
    if profile.level is not None:
        # Use existing CS Value formula as data anchor
        from valuation_core.config import AGE_CURVES
        level_base = _level_to_base_value(profile.level)
        data_value = (
            level_base * 1_000_000
            * age_mult
            * contract_mult
            * scarcity_mult
            * league_mult
        )

    if profile.transfer_fee_eur and profile.transfer_fee_eur > 0:
        # If we have a TM anchor, blend it in
        tm_value = profile.transfer_fee_eur
        data_value = data_value * 0.6 + tm_value * 0.4

    # ── Blend scout and data values using λ ───────────────────────────────────

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
