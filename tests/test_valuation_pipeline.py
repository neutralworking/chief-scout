"""
Tests for the full valuation pipeline — end-to-end from profile to response.

Exercises both worked examples from the spec.
"""

import pytest

from valuation_core.models.ability_model import estimate_ability
from valuation_core.models.market_model import (
    ability_to_base_value,
    compute_personality_adjustment,
    estimate_market_value,
)
from valuation_core.models.context_model import compute_contextual_valuation
from valuation_core.models.ensemble import run_valuation
from valuation_core.features.profile_features import (
    compute_confidence_state,
    extract_all_profile_features,
)
from valuation_core.features.market_features import (
    compute_age_multiplier,
    compute_contract_multiplier,
)
from valuation_core.types import (
    AttributeGrade,
    ClubContext,
    Confidence,
    EvaluationContext,
    GradeType,
    MarketValue,
    PlayerProfile,
    SquadGap,
    ValuationMode,
)


# ── Example profiles ─────────────────────────────────────────────────────────

def _make_example_a() -> PlayerProfile:
    """Example A: 27yo Dribbler-Creator, well-scouted, high confidence."""
    attrs = {}
    # Creator attributes (all High confidence scout grades)
    for attr in ["creativity", "unpredictability", "vision", "guile"]:
        attrs[attr] = AttributeGrade(8.0, GradeType.SCOUT, Confidence.HIGH)
    # Dribbler attributes
    for attr in ["carries", "first_touch", "skills", "take_ons"]:
        attrs[attr] = AttributeGrade(7.5, GradeType.SCOUT, Confidence.HIGH)
    # Passer attributes
    for attr in ["pass_accuracy", "crossing", "pass_range", "through_balls"]:
        attrs[attr] = AttributeGrade(7.0, GradeType.STAT, Confidence.MEDIUM)
    # Controller attributes
    for attr in ["anticipation", "composure", "decisions", "tempo"]:
        attrs[attr] = AttributeGrade(6.5, GradeType.STAT, Confidence.MEDIUM)
    # Sprinter attributes
    for attr in ["acceleration", "balance", "movement", "pace"]:
        attrs[attr] = AttributeGrade(6.0, GradeType.STAT, Confidence.MEDIUM)
    # Engine attributes
    for attr in ["intensity", "pressing", "stamina", "versatility"]:
        attrs[attr] = AttributeGrade(5.0, GradeType.STAT, Confidence.MEDIUM)
    # Weaker archetypes — low scores
    for attr in ["blocking", "clearances", "marking", "tackling"]:
        attrs[attr] = AttributeGrade(3.0, GradeType.STAT, Confidence.LOW)
    for attr in ["aerial_duels", "heading", "jumping", "volleys"]:
        attrs[attr] = AttributeGrade(3.5, GradeType.STAT, Confidence.LOW)

    return PlayerProfile(
        person_id=1001,
        name="Marco Stellari",
        age=27,
        position="AM",
        archetype_scores={
            "Creator": 80, "Dribbler": 75, "Passer": 70, "Controller": 65,
            "Sprinter": 60, "Engine": 50, "Striker": 45, "Commander": 40,
            "Cover": 35, "Powerhouse": 30, "Destroyer": 30, "Target": 35,
            "GK": 5,
        },
        attributes=attrs,
        personality_code="INSP",
        personality_tags=["Proven at Level", "Low Maintenance"],
        playing_style_tags=[
            "Line Breaker", "Press Resistant", "Half-Space Operator",
            "Ball Progressor", "Link-Up Artist",
        ],
        contract_years_remaining=4.0,
        league="La Liga",
        club="Atletico Madrid",
        level=85,
        national_team_status="regular",
    )


def _make_example_b() -> PlayerProfile:
    """Example B: 19yo Sprinter-Dribbler, partially scouted, low confidence."""
    attrs = {}
    # Sprinter — medium confidence scout grades on 2 of 4
    attrs["pace"] = AttributeGrade(8.5, GradeType.SCOUT, Confidence.MEDIUM)
    attrs["acceleration"] = AttributeGrade(8.0, GradeType.SCOUT, Confidence.MEDIUM)
    attrs["balance"] = AttributeGrade(6.0, GradeType.INFERRED, Confidence.LOW)
    attrs["movement"] = AttributeGrade(6.5, GradeType.INFERRED, Confidence.LOW)
    # Dribbler — mostly inferred
    attrs["take_ons"] = AttributeGrade(7.0, GradeType.STAT, Confidence.LOW)
    attrs["carries"] = AttributeGrade(6.5, GradeType.STAT, Confidence.LOW)
    attrs["skills"] = AttributeGrade(6.0, GradeType.INFERRED, Confidence.LOW)
    attrs["first_touch"] = AttributeGrade(5.5, GradeType.INFERRED, Confidence.LOW)
    # Everything else inferred at low scores
    for attr in ["vision", "creativity", "composure", "decisions"]:
        attrs[attr] = AttributeGrade(4.0, GradeType.INFERRED, Confidence.LOW)

    return PlayerProfile(
        person_id=2001,
        name="Tiago Mendes",
        age=19,
        position="WF",
        archetype_scores={
            "Sprinter": 72, "Dribbler": 62, "Engine": 48, "Striker": 42,
            "Powerhouse": 40, "Creator": 32, "Passer": 28, "Controller": 25,
            "Cover": 20, "Destroyer": 15, "Commander": 18, "Target": 22,
            "GK": 3,
        },
        attributes=attrs,
        personality_code="IXSC",
        personality_tags=[],
        playing_style_tags=["Direct Runner", "Transition Threat"],
        contract_years_remaining=2.0,
        league="Eredivisie",
        club="FC Twente",
        level=70,
        national_team_status="none",
    )


# ── Ability Model Tests ───────────────────────────────────────────────────────

class TestAbilityModel:
    def test_ability_estimate_returns_required_keys(self):
        profile = _make_example_a()
        result = estimate_ability(profile, n_samples=20)
        assert "central" in result
        assert "std" in result
        assert "domain_scores" in result
        assert "confidence_state" in result

    def test_well_scouted_player_has_higher_ability(self):
        a = estimate_ability(_make_example_a(), n_samples=50)
        b = estimate_ability(_make_example_b(), n_samples=50)
        assert a["central"] > b["central"]

    def test_well_scouted_has_lower_variance(self):
        a = estimate_ability(_make_example_a(), n_samples=50)
        b = estimate_ability(_make_example_b(), n_samples=50)
        # Relative std (coefficient of variation) should be lower for A
        cv_a = a["std"] / max(a["central"], 1)
        cv_b = b["std"] / max(b["central"], 1)
        assert cv_a < cv_b, f"Expected A ({cv_a:.3f}) to have lower CV than B ({cv_b:.3f})"

    def test_domain_scores_are_populated(self):
        result = estimate_ability(_make_example_a(), n_samples=20)
        for domain in ["attacking", "defensive", "possession", "transition"]:
            assert domain in result["domain_scores"]
            assert result["domain_scores"][domain] >= 0


# ── Market Model Tests ────────────────────────────────────────────────────────

class TestMarketModel:
    def test_ability_to_base_value_monotonic(self):
        """Higher ability should produce higher base value."""
        prev = 0
        for ability in range(30, 100, 5):
            val = ability_to_base_value(ability)
            assert val >= prev, f"Non-monotonic at ability={ability}"
            prev = val

    def test_personality_adjustment_risk_tags(self):
        profile = PlayerProfile(
            person_id=999, name="Test",
            personality_tags=["High Exit Probability", "Contract Sensitive"],
        )
        adj = compute_personality_adjustment(profile)
        # Should be < 1.0 (discount)
        assert adj < 1.0
        # Combined: -0.08 -0.06 -0.03 = -0.17
        assert abs(adj - 0.83) < 0.01

    def test_personality_adjustment_value_tags(self):
        profile = PlayerProfile(
            person_id=999, name="Test",
            personality_tags=["Proven at Level", "Undroppable"],
        )
        adj = compute_personality_adjustment(profile)
        assert adj > 1.0

    def test_age_multiplier_peak_is_one(self):
        mult = compute_age_multiplier(27, "CM")
        assert 0.95 <= mult <= 1.05

    def test_age_multiplier_decline(self):
        mult = compute_age_multiplier(33, "CM")
        assert mult < 0.85  # CM peaks 25-30, decline by 33

    def test_contract_multiplier_free_agent(self):
        mult = compute_contract_multiplier(0.0)
        assert mult <= 0.15

    def test_contract_multiplier_long_term(self):
        mult = compute_contract_multiplier(4.0)
        assert mult >= 0.95


# ── Context Model Tests ───────────────────────────────────────────────────────

class TestContextModel:
    def test_contextual_valuation_returns_use_value(self):
        profile = _make_example_a()
        mv = MarketValue(central=45_000_000, p10=30_000_000, p25=37_000_000,
                        p75=55_000_000, p90=65_000_000)
        context = EvaluationContext(
            buying_club=ClubContext(
                club_name="Manchester City",
                league="Premier League",
                financial_tier="elite",
                objective="title",
            ),
            target_position="AM",
            target_system="tiki_taka",
        )
        result = compute_contextual_valuation(profile, mv, context)
        assert result["use_value"].central > 0
        assert 0 <= result["use_value"].contextual_fit_score <= 1


# ── Full Pipeline Tests ──────────────────────────────────────────────────────

class TestFullPipeline:
    def test_example_a_full_valuation(self):
        """Worked example A: established starter, well-scouted."""
        profile = _make_example_a()
        context = EvaluationContext(
            buying_club=ClubContext(
                club_name="Manchester City",
                league="Premier League",
                financial_tier="elite",
                objective="title",
            ),
            target_position="AM",
            target_system="tiki_taka",
        )

        response = run_valuation(profile, context, ValuationMode.SCOUT_DOMINANT)

        # Should produce a reasonable valuation for a top-league 27yo AM
        assert response.market_value.central > 10_000_000
        assert response.market_value.central < 200_000_000
        assert response.market_value.p10 < response.market_value.central
        assert response.market_value.p90 > response.market_value.central

        # Should have use value with contextual fit
        assert response.use_value is not None
        assert 0 <= response.use_value.contextual_fit_score <= 1

        # Confidence should be high-ish (well-scouted player)
        assert response.confidence.overall_confidence in ("high", "medium")

        # Band should be relatively tight (well-scouted)
        assert response.confidence.band_width_ratio < 5.0

        # Narrative should be non-empty
        assert len(response.narrative) > 50

        # No personality risk flags
        assert len(response.personality_risk_flags) == 0

    def test_example_b_full_valuation(self):
        """Worked example B: breakout prospect, partially scouted."""
        profile = _make_example_b()
        context = EvaluationContext(
            buying_club=ClubContext(
                club_name="Brighton",
                league="Premier League",
                financial_tier="medium",
                objective="europe",
            ),
            target_position="WF",
            target_system="gegenpress",
        )

        response = run_valuation(profile, context, ValuationMode.BALANCED)

        # Should produce lower valuation than Example A
        assert response.market_value.central < 50_000_000

        # Band should be wider (low confidence)
        assert response.confidence.band_width_ratio > 2.0

        # Confidence should be lower
        assert response.confidence.overall_confidence in ("low", "medium")

        # Low data warning likely
        # (may or may not trigger depending on exact thresholds)

    def test_example_a_higher_than_b(self):
        """Example A should be valued higher than Example B."""
        a = run_valuation(_make_example_a(), mode=ValuationMode.SCOUT_DOMINANT)
        b = run_valuation(_make_example_b(), mode=ValuationMode.SCOUT_DOMINANT)
        assert a.market_value.central > b.market_value.central

    def test_wider_band_for_lower_confidence(self):
        """Example B should have wider P10-P90 band than Example A."""
        a = run_valuation(_make_example_a(), mode=ValuationMode.SCOUT_DOMINANT)
        b = run_valuation(_make_example_b(), mode=ValuationMode.SCOUT_DOMINANT)
        band_a = a.market_value.p90 - a.market_value.p10
        band_b = b.market_value.p90 - b.market_value.p10
        ratio_a = band_a / max(a.market_value.central, 1)
        ratio_b = band_b / max(b.market_value.central, 1)
        assert ratio_b > ratio_a

    def test_mode_affects_scout_contribution(self):
        """Scout-dominant mode should have higher scout contribution."""
        profile = _make_example_a()
        scout = run_valuation(profile, mode=ValuationMode.SCOUT_DOMINANT)
        data = run_valuation(profile, mode=ValuationMode.DATA_DOMINANT)
        assert scout.decomposition.scout_profile_contribution > data.decomposition.scout_profile_contribution


# ── Confidence Tests ──────────────────────────────────────────────────────────

class TestConfidence:
    def test_high_confidence_for_well_scouted(self):
        profile = _make_example_a()
        state = compute_confidence_state(profile)
        assert state in ("high", "medium")

    def test_low_confidence_for_mostly_inferred(self):
        profile = _make_example_b()
        state = compute_confidence_state(profile)
        assert state in ("low", "very_low")


# ── Feature Extraction Tests ─────────────────────────────────────────────────

class TestFeatureExtraction:
    def test_all_features_numeric(self):
        profile = _make_example_a()
        features = extract_all_profile_features(profile)
        for key, val in features.items():
            assert isinstance(val, (int, float)), f"Feature {key} is not numeric: {type(val)}"

    def test_archetype_features_present(self):
        profile = _make_example_a()
        features = extract_all_profile_features(profile)
        assert "archetype_creator" in features
        assert "archetype_dribbler" in features
        assert "primary_secondary_gap" in features
