"""
Market feature extraction — age curves, contract, league, macro context.

These features feed Layers 2 and 3 of the valuation stack.
"""

from __future__ import annotations

import math

from valuation_core.config import (
    AGE_CURVES,
    CONTRACT_MULTIPLIERS,
    LEAGUE_STRENGTH,
    NATIONAL_TEAM_PREMIUM,
    POSITION_SCARCITY,
    WINDOW_MULTIPLIERS,
)
from valuation_core.types import EvaluationContext, PlayerProfile


def compute_age_multiplier(age: int | None, position: str | None) -> float:
    """
    Position-specific age curve multiplier.

    Uses natural spline-like piecewise function with peak window,
    youth premium ramp, and decline phase.
    """
    if age is None:
        return 1.0

    pos = position or "CM"
    curve = AGE_CURVES.get(pos, AGE_CURVES["CM"])
    peak_start = curve["peak_start"]
    peak_end = curve["peak_end"]
    youth_peak = curve["youth_premium_peak"]
    decline_rate = curve["decline_rate"]

    if peak_start <= age <= peak_end:
        return 1.0

    if age < peak_start:
        # Youth premium curve: rises from ~0.5 at 16 to 1.2 around youth_peak,
        # then settles to 1.0 at peak_start
        if age <= 16:
            return 0.45
        elif age <= youth_peak:
            # Rising: 0.45 → 1.20 over (youth_peak - 16) years
            t = (age - 16) / (youth_peak - 16)
            return 0.45 + t * 0.75
        else:
            # Settling: 1.20 → 1.0 over (peak_start - youth_peak) years
            t = (age - youth_peak) / max(peak_start - youth_peak, 1)
            return 1.20 - t * 0.20
    else:
        # Decline phase: exponential decay
        years_past = age - peak_end
        return max(0.05, math.exp(-decline_rate * years_past))


def compute_contract_multiplier(years_remaining: float | None) -> float:
    """
    Contract years → value multiplier.

    Sharp cliff effects at <1yr and <6mo.
    """
    if years_remaining is None:
        return 0.80  # unknown contract = moderate discount

    # Interpolate between known breakpoints
    breakpoints = sorted(CONTRACT_MULTIPLIERS.keys())
    if years_remaining <= breakpoints[0]:
        return CONTRACT_MULTIPLIERS[breakpoints[0]]
    if years_remaining >= breakpoints[-1]:
        return CONTRACT_MULTIPLIERS[breakpoints[-1]]

    for i in range(len(breakpoints) - 1):
        lo, hi = breakpoints[i], breakpoints[i + 1]
        if lo <= years_remaining <= hi:
            t = (years_remaining - lo) / (hi - lo)
            return CONTRACT_MULTIPLIERS[lo] + t * (CONTRACT_MULTIPLIERS[hi] - CONTRACT_MULTIPLIERS[lo])

    return 1.0


def extract_market_features(
    profile: PlayerProfile,
    context: EvaluationContext | None = None,
) -> dict[str, float]:
    """Extract all market-condition features."""
    features: dict[str, float] = {}

    # Age features
    age = profile.age
    features["age"] = float(age) if age else 25.0
    features["age_squared"] = features["age"] ** 2
    features["age_multiplier"] = compute_age_multiplier(age, profile.position)

    # Contract features
    features["contract_years"] = profile.contract_years_remaining or 2.0
    features["contract_multiplier"] = compute_contract_multiplier(
        profile.contract_years_remaining
    )
    features["has_release_clause"] = 1.0 if profile.release_clause_eur else 0.0
    features["release_clause_eur"] = profile.release_clause_eur or 0.0

    # Wage
    if profile.current_wage_weekly_eur:
        features["wage_log"] = math.log1p(profile.current_wage_weekly_eur)
    else:
        features["wage_log"] = 0.0

    # Position scarcity
    features["position_scarcity"] = POSITION_SCARCITY.get(
        profile.position or "CM", 1.0
    )

    # League strength
    features["league_strength"] = LEAGUE_STRENGTH.get(
        profile.league or "default", LEAGUE_STRENGTH["default"]
    )

    # National team premium
    features["national_team_premium"] = NATIONAL_TEAM_PREMIUM.get(
        profile.national_team_status or "none", 1.0
    )

    # Injury
    if profile.injury_days_2yr is not None:
        features["injury_days_log"] = math.log1p(profile.injury_days_2yr)
        features["chronic_injury"] = 1.0 if profile.injury_days_2yr > 180 else 0.0
    else:
        features["injury_days_log"] = 0.0
        features["chronic_injury"] = 0.0

    # Trajectory
    trajectory_map = {
        "rising": 1.15, "peak": 1.0, "declining": 0.80,
        "newcomer": 1.10, "journeyman": 0.90, "one-club": 1.05,
    }
    features["trajectory_multiplier"] = trajectory_map.get(
        profile.trajectory or "peak", 1.0
    )

    # Context features (if evaluation context provided)
    if context:
        features["window_multiplier"] = WINDOW_MULTIPLIERS.get(
            context.window, 1.0
        )

        # Buying club context
        bc = context.buying_club
        tier_map = {"elite": 4, "high": 3, "medium": 2, "low": 1}
        features["buying_club_financial_tier"] = float(
            tier_map.get(bc.financial_tier or "medium", 2)
        )

        objective_map = {"survival": 1, "mid_table": 2, "europe": 3, "title": 4}
        features["buying_club_objective"] = float(
            objective_map.get(bc.objective or "mid_table", 2)
        )

        # Selling pressure
        if context.selling_club and context.selling_club.selling_pressure:
            features["selling_pressure"] = context.selling_club.selling_pressure
        else:
            features["selling_pressure"] = 0.3  # neutral

        # Domestic vs international
        buying_league = bc.league or ""
        selling_league = profile.league or ""
        features["domestic_move"] = 1.0 if buying_league == selling_league else 0.0
    else:
        features["window_multiplier"] = 1.0
        features["buying_club_financial_tier"] = 2.0
        features["buying_club_objective"] = 2.0
        features["selling_pressure"] = 0.3
        features["domestic_move"] = 0.0

    return features
