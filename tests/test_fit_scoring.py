"""
Tests for the fit scoring system — positional, tactical, and squad fit.

Uses two canonical profiles from the spec:
  - Example A: 27yo Dribbler-Creator in a top-5 league (well-scouted)
  - Example B: 19yo Sprinter-Dribbler in a weaker league (partially scouted)
"""

import pytest

from valuation_core.fit.positional_fit import (
    compute_positional_fit,
    compute_positional_fit_detailed,
)
from valuation_core.fit.system_fit import (
    compute_system_fit,
    compute_system_fit_score,
)
from valuation_core.fit.squad_fit import compute_squad_gap_fill
from valuation_core.types import (
    AttributeGrade,
    ClubContext,
    Confidence,
    EvaluationContext,
    GradeType,
    PlayerProfile,
    SquadGap,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_example_a() -> PlayerProfile:
    """Example A: 27yo Dribbler-Creator, well-scouted."""
    return PlayerProfile(
        person_id=1001,
        name="Example Player A",
        age=27,
        position="AM",
        archetype_scores={
            "Dribbler": 73, "Creator": 71, "Passer": 62, "Controller": 58,
            "Sprinter": 55, "Engine": 45, "Striker": 40, "Cover": 30,
            "Destroyer": 20, "Commander": 35, "Powerhouse": 25, "Target": 15,
            "GK": 5,
        },
        attributes={
            "vision": AttributeGrade(9.0, GradeType.SCOUT, Confidence.HIGH),
            "take_ons": AttributeGrade(8.0, GradeType.SCOUT, Confidence.HIGH),
            "creativity": AttributeGrade(8.5, GradeType.SCOUT, Confidence.HIGH),
            "first_touch": AttributeGrade(8.0, GradeType.SCOUT, Confidence.HIGH),
            "composure": AttributeGrade(7.5, GradeType.SCOUT, Confidence.HIGH),
            "pass_accuracy": AttributeGrade(7.0, GradeType.STAT, Confidence.MEDIUM),
            "pressing": AttributeGrade(5.0, GradeType.STAT, Confidence.MEDIUM),
            "stamina": AttributeGrade(5.5, GradeType.STAT, Confidence.MEDIUM),
            "pace": AttributeGrade(6.5, GradeType.STAT, Confidence.MEDIUM),
        },
        personality_code="INSP",
        personality_tags=["Proven at Level", "Low Maintenance"],
        playing_style_tags=[
            "Line Breaker", "Press Resistant", "Half-Space Operator",
            "Ball Progressor", "Link-Up Artist",
        ],
        contract_years_remaining=4.0,
        league="La Liga",
        club="Example FC",
        level=85,
    )


def _make_example_b() -> PlayerProfile:
    """Example B: 19yo Sprinter-Dribbler, partially scouted."""
    return PlayerProfile(
        person_id=2001,
        name="Example Player B",
        age=19,
        position="WF",
        archetype_scores={
            "Sprinter": 72, "Dribbler": 68, "Engine": 50, "Striker": 45,
            "Creator": 35, "Passer": 30, "Controller": 25, "Cover": 20,
            "Destroyer": 15, "Commander": 20, "Powerhouse": 40, "Target": 25,
            "GK": 3,
        },
        attributes={
            "pace": AttributeGrade(8.5, GradeType.SCOUT, Confidence.MEDIUM),
            "acceleration": AttributeGrade(8.0, GradeType.SCOUT, Confidence.MEDIUM),
            "take_ons": AttributeGrade(7.0, GradeType.STAT, Confidence.LOW),
            "skills": AttributeGrade(6.0, GradeType.INFERRED, Confidence.LOW),
            "vision": AttributeGrade(4.0, GradeType.INFERRED, Confidence.LOW),
        },
        personality_code="IXSC",
        personality_tags=[],
        playing_style_tags=["Direct Runner", "Transition Threat"],
        contract_years_remaining=2.0,
        league="Eredivisie",
        club="Test Youth FC",
        level=70,
    )


# ── Positional Fit Tests ─────────────────────────────────────────────────────

class TestPositionalFit:
    def test_dribbler_creator_at_am_is_high_fit(self):
        profile = _make_example_a()
        fit = compute_positional_fit(profile, "AM")
        # AM position weights Creator heavily — strong fit
        assert fit >= 0.65, f"Expected high fit for Dribbler-Creator at AM, got {fit}"

    def test_dribbler_creator_at_cb_is_low_fit(self):
        profile = _make_example_a()
        fit = compute_positional_fit(profile, "CD")
        # CD position weights Destroyer/Cover — poor fit for Dribbler-Creator
        assert fit <= 0.40, f"Expected low fit for Dribbler-Creator at CB, got {fit}"

    def test_sprinter_dribbler_at_wf_is_good_fit(self):
        profile = _make_example_b()
        fit = compute_positional_fit(profile, "WF")
        assert fit >= 0.55, f"Expected good fit for Sprinter-Dribbler at WF, got {fit}"

    def test_fit_returns_neutral_for_missing_data(self):
        profile = PlayerProfile(person_id=999, name="Empty")
        fit = compute_positional_fit(profile, "CM")
        assert fit == 0.5

    def test_detailed_breakdown_has_all_archetypes(self):
        profile = _make_example_a()
        breakdown = compute_positional_fit_detailed(profile, "AM")
        assert "Creator" in breakdown
        assert "Dribbler" in breakdown


# ── System Fit Tests ──────────────────────────────────────────────────────────

class TestSystemFit:
    def test_tiki_taka_fit_for_dribbler_creator(self):
        profile = _make_example_a()
        result = compute_system_fit(profile, "tiki_taka")
        # Dribbler-Creator with Press Resistant and Ball Progressor = good tiki-taka fit
        assert result["archetype_fit"] >= 0.50
        assert result["tag_compatibility"] >= 0.50

    def test_gegenpress_fit_for_sprinter_dribbler(self):
        profile = _make_example_b()
        result = compute_system_fit(profile, "gegenpress")
        # Sprinter-Dribbler with Transition Threat = decent gegenpress fit
        assert result["tag_compatibility"] >= 0.40

    def test_catenaccio_poor_fit_for_dribbler_creator(self):
        profile = _make_example_a()
        fit = compute_system_fit_score(profile, "catenaccio")
        # Dribbler-Creator at AM is poor catenaccio fit
        assert fit <= 0.55

    def test_unknown_system_returns_neutral(self):
        profile = _make_example_a()
        result = compute_system_fit(profile, "unknown_system")
        assert result["archetype_fit"] == 0.5

    def test_personality_fit_insp_for_tiki_taka(self):
        profile = _make_example_a()
        result = compute_system_fit(profile, "tiki_taka")
        # INSP: A=0 (Instinctive), tiki_taka prefers A=0.7 and P=0.6
        # P matches (Composer), A doesn't (Instinctive not Analytical)
        # Should be moderate personality fit
        assert 0.2 <= result["personality_fit"] <= 0.8


# ── Squad Gap Fill Tests ──────────────────────────────────────────────────────

class TestSquadFit:
    def test_gap_fill_with_matching_archetypes(self):
        profile = _make_example_a()
        context = EvaluationContext(
            buying_club=ClubContext(club_name="Test FC"),
            target_position="AM",
            target_system="tiki_taka",
            squad_gaps=[
                SquadGap(
                    position="AM",
                    archetype_gaps={"Creator": 70, "Dribbler": 60},
                    style_tag_gaps=["Half-Space Operator", "Press Resistant"],
                ),
            ],
        )
        fill = compute_squad_gap_fill(profile, context)
        assert fill >= 0.70, f"Expected high gap fill, got {fill}"

    def test_gap_fill_no_gaps_returns_neutral(self):
        profile = _make_example_a()
        context = EvaluationContext(
            buying_club=ClubContext(),
            target_position="AM",
            target_system="tiki_taka",
        )
        fill = compute_squad_gap_fill(profile, context)
        assert fill == 0.5

    def test_gap_fill_wrong_position_ignored(self):
        profile = _make_example_a()
        context = EvaluationContext(
            buying_club=ClubContext(),
            target_position="AM",
            target_system="tiki_taka",
            squad_gaps=[
                SquadGap(position="CD", archetype_gaps={"Destroyer": 80}),
            ],
        )
        fill = compute_squad_gap_fill(profile, context)
        assert fill == 0.5  # gap is at CD, not AM
