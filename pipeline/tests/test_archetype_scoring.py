"""
Tests for 04_refine_players.py — SACROSANCT archetype scoring.

Priority: HIGH — archetypes drive the entire player classification UI.
"""
import pytest
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path

# Load the module directly (it has a top-level POSTGRES_DSN import we need to handle)
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import the scoring functions
_spec = spec_from_file_location(
    "refine", str(Path(__file__).resolve().parent.parent / "04_refine_players.py")
)
refine = module_from_spec(_spec)
_spec.loader.exec_module(refine)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_grades(scores: dict[str, float], use_scout: bool = True, source: str = "scout_assessment") -> list[dict]:
    """Build attribute_grades rows from {attribute: value} dict."""
    return [
        {
            "attribute": attr,
            "scout_grade": val if use_scout else None,
            "stat_score": None if use_scout else val,
            "source": source if use_scout else "fbref",
        }
        for attr, val in scores.items()
    ]


def score_player(grades: list[dict], position: str = "CM") -> str | None:
    """Run full scoring pipeline and return archetype."""
    attr_scores, _, has_scout, has_diff = refine.normalize_grades(grades)
    if not has_diff:
        return None
    model_scores = refine.score_models(attr_scores, position)
    return refine.best_model(model_scores)


# ── SACROSANCT Model Definitions ─────────────────────────────────────────────

class TestModelDefinitions:
    """Verify all 13 SACROSANCT models are defined with correct attributes."""

    EXPECTED_MODELS = {
        "Controller", "Commander", "Creator",
        "Target", "Sprinter", "Powerhouse",
        "Cover", "Engine", "Destroyer",
        "Dribbler", "Passer", "Striker",
        "GK",
    }

    def test_all_13_models_defined(self):
        assert set(refine.MODEL_ATTRIBUTES.keys()) == self.EXPECTED_MODELS

    def test_each_model_has_4_attributes(self):
        for model, attrs in refine.MODEL_ATTRIBUTES.items():
            assert len(attrs) == 4, f"{model} has {len(attrs)} attributes, expected 4"

    def test_no_duplicate_attributes_within_model(self):
        for model, attrs in refine.MODEL_ATTRIBUTES.items():
            assert len(attrs) == len(set(attrs)), f"{model} has duplicate attributes"

    def test_model_compounds_cover_all_models(self):
        assert set(refine.MODEL_COMPOUNDS.keys()) == self.EXPECTED_MODELS

    def test_compound_categories(self):
        expected = {
            "Controller": "Mental", "Commander": "Mental", "Creator": "Mental",
            "Target": "Physical", "Sprinter": "Physical", "Powerhouse": "Physical",
            "Cover": "Tactical", "Engine": "Tactical", "Destroyer": "Tactical",
            "Dribbler": "Technical", "Passer": "Technical", "Striker": "Technical",
            "GK": "Specialist",
        }
        assert refine.MODEL_COMPOUNDS == expected


# ── Grade Normalization ──────────────────────────────────────────────────────

class TestNormalizeGrades:
    """Test attribute grade normalization and scale detection."""

    def test_scout_grade_0_10_scale(self):
        grades = make_grades({"pace": 8, "acceleration": 6}, use_scout=True)
        scores, _, has_scout, has_diff = refine.normalize_grades(grades)
        assert has_scout is True
        assert has_diff is True
        assert scores["pace"] == 80.0
        assert scores["acceleration"] == 60.0

    def test_scout_grade_0_20_scale(self):
        """Legacy data on 0-20 scale auto-detected."""
        grades = make_grades({"pace": 16, "acceleration": 12}, use_scout=True)
        scores, _, has_scout, has_diff = refine.normalize_grades(grades)
        assert has_scout is True
        assert scores["pace"] == 80.0
        assert scores["acceleration"] == 60.0

    def test_stat_score_0_20_scale(self):
        grades = [
            {"attribute": "pace", "scout_grade": None, "stat_score": 14, "source": "fbref"},
            {"attribute": "acceleration", "scout_grade": None, "stat_score": 8, "source": "fbref"},
        ]
        scores, _, has_scout, has_diff = refine.normalize_grades(grades)
        assert has_scout is False
        assert has_diff is True
        assert scores["pace"] == 70.0
        assert scores["acceleration"] == 40.0

    def test_undifferentiated_data_detected(self):
        """All stat_scores identical = undifferentiated (default values)."""
        grades = [
            {"attribute": "pace", "scout_grade": None, "stat_score": 10, "source": "fbref"},
            {"attribute": "acceleration", "scout_grade": None, "stat_score": 10, "source": "fbref"},
            {"attribute": "stamina", "scout_grade": None, "stat_score": 10, "source": "fbref"},
        ]
        _, _, has_scout, has_diff = refine.normalize_grades(grades)
        assert has_scout is False
        assert has_diff is False

    def test_mixed_scout_and_stat(self):
        """Scale detection is per-source: scout /20, fbref /10."""
        grades = [
            {"attribute": "pace", "scout_grade": 16, "stat_score": None, "source": "scout_assessment"},
            {"attribute": "stamina", "scout_grade": None, "stat_score": 10, "source": "fbref"},
        ]
        scores, _, has_scout, has_diff = refine.normalize_grades(grades)
        assert has_scout is True
        assert has_diff is True
        # scout_assessment: 16/20 × 100 × 1.0 = 80.0
        assert scores["pace"] == 80.0
        # fbref: 10/10 × 100 × 1.0 = 100.0 (per-source scale)
        assert scores["stamina"] == 100.0

    def test_alias_takeons(self):
        grades = [{"attribute": "takeons", "scout_grade": 8, "stat_score": None}]
        scores, _, _, _ = refine.normalize_grades(grades)
        assert "take_ons" in scores
        assert "takeons" not in scores

    def test_alias_leadership_casing(self):
        grades = [{"attribute": "Leadership", "scout_grade": 8, "stat_score": None}]
        scores, _, _, _ = refine.normalize_grades(grades)
        assert "leadership" in scores
        assert "Leadership" not in scores

    def test_alias_unpredictability_typo(self):
        grades = [{"attribute": "unpredicability", "scout_grade": 8, "stat_score": None}]
        scores, _, _, _ = refine.normalize_grades(grades)
        assert "unpredictability" in scores


# ── Model Scoring ────────────────────────────────────────────────────────────

class TestModelScoring:
    """Test that model scoring produces correct archetypes."""

    def test_pure_sprinter(self):
        """Player with dominant pace/acceleration/movement/balance → Sprinter."""
        grades = make_grades({
            "acceleration": 9, "balance": 8, "movement": 9, "pace": 9,
            "stamina": 5, "pressing": 5, "intensity": 5, "versatility": 5,
        })
        arch = score_player(grades, "WF")
        assert arch is not None
        assert arch.startswith("Sprinter")

    def test_pure_striker(self):
        """High shooting attributes → Striker."""
        grades = make_grades({
            "short_range": 9, "mid_range": 9, "long_range": 8, "penalties": 8,
            "pace": 5, "acceleration": 5, "balance": 5, "movement": 5,
        })
        arch = score_player(grades, "CF")
        assert arch is not None
        assert arch.startswith("Striker")

    def test_pure_cover(self):
        """High defensive awareness → Cover."""
        grades = make_grades({
            "awareness": 9, "discipline": 9, "interceptions": 8, "positioning": 9,
            "blocking": 4, "marking": 4, "tackling": 4, "clearances": 4,
        })
        arch = score_player(grades, "CD")
        assert arch is not None
        assert arch.startswith("Cover")

    def test_pure_engine(self):
        grades = make_grades({
            "intensity": 9, "pressing": 9, "stamina": 9, "versatility": 8,
            "awareness": 4, "discipline": 4, "interceptions": 4, "positioning": 4,
        })
        arch = score_player(grades, "CM")
        assert arch is not None
        assert arch.startswith("Engine")

    def test_pure_creator(self):
        grades = make_grades({
            "creativity": 9, "unpredictability": 8, "vision": 9,
            "pace": 4, "acceleration": 4, "balance": 4, "movement": 4,
        })
        arch = score_player(grades, "AM")
        assert arch is not None
        assert arch.startswith("Creator")

    def test_gk_gets_gk_model(self):
        grades = make_grades({
            "agility": 8, "footwork": 7, "handling": 9, "reactions": 8,
            "pace": 3, "acceleration": 3, "balance": 3, "movement": 3,
        })
        arch = score_player(grades, "GK")
        assert arch is not None
        assert arch.startswith("GK")

    def test_gk_model_penalized_for_outfield(self):
        """GK model score is heavily penalized for outfield players."""
        grades = make_grades({
            "agility": 8, "footwork": 7, "handling": 9, "reactions": 8,
        })
        attr_scores, _, _, _ = refine.normalize_grades(grades)
        scores = refine.score_models(attr_scores, "CM")
        assert scores["GK"] < scores.get("Controller", 100) or scores["GK"] < 30

    def test_outfield_models_penalized_for_gk(self):
        """Outfield models penalized when position is GK."""
        grades = make_grades({
            "pace": 8, "acceleration": 8, "movement": 8, "balance": 8,
            "agility": 5, "footwork": 5, "handling": 5, "reactions": 5,
        })
        attr_scores, _, _, _ = refine.normalize_grades(grades)
        scores = refine.score_models(attr_scores, "GK")
        assert scores["Sprinter"] < scores["GK"]


# ── Compound Archetypes ──────────────────────────────────────────────────────

class TestCompoundArchetypes:
    """Test compound archetype generation (Primary-Secondary)."""

    def test_compound_when_close_scores_different_categories(self):
        """Two models close in score from different categories → compound."""
        grades = make_grades({
            # Sprinter (Physical) and Dribbler (Technical) both high
            "acceleration": 9, "balance": 8, "movement": 9, "pace": 9,
            "carries": 9, "first_touch": 8, "skills": 8, "take_ons": 9,
            # Everything else low
            "blocking": 2, "marking": 2, "tackling": 2, "clearances": 2,
        })
        arch = score_player(grades, "WF")
        assert arch is not None
        assert "-" in arch, f"Expected compound, got '{arch}'"
        parts = arch.split("-")
        assert len(parts) == 2
        assert all(p in refine.MODEL_ATTRIBUTES for p in parts)

    def test_no_compound_within_same_category(self):
        """Two models from same category should NOT compound."""
        grades = make_grades({
            # Cover and Destroyer both Tactical
            "awareness": 9, "discipline": 9, "interceptions": 9, "positioning": 9,
            "blocking": 8, "clearances": 8, "marking": 8, "tackling": 8,
        })
        arch = score_player(grades, "CD")
        assert arch is not None
        # Should be single model (Cover or Destroyer), not Cover-Destroyer
        if "-" in arch:
            p1, p2 = arch.split("-")
            cat1 = refine.MODEL_COMPOUNDS[p1]
            cat2 = refine.MODEL_COMPOUNDS[p2]
            assert cat1 != cat2, f"Same-category compound: {arch} ({cat1})"

    def test_single_when_dominant(self):
        """One clearly dominant model → single archetype."""
        grades = make_grades({
            "short_range": 10, "mid_range": 10, "long_range": 10, "penalties": 10,
            "pace": 2, "acceleration": 2, "balance": 2, "movement": 2,
        })
        arch = score_player(grades, "CF")
        assert arch is not None
        assert "-" not in arch, f"Expected single, got '{arch}'"
        assert arch == "Striker"

    def test_compound_format(self):
        """Compound archetype uses 'Primary-Secondary' format."""
        scores = {"Sprinter": 80.0, "Dribbler": 78.5, "Cover": 30.0}
        result = refine.best_model(scores, threshold=15.0)
        assert result is not None
        if "-" in result:
            parts = result.split("-")
            assert parts[0] == "Sprinter"  # highest
            assert parts[1] == "Dribbler"  # second

    def test_secondary_included_at_70_percent(self):
        """Secondary model included when it reaches 70% of primary."""
        # Dribbler at 56 = 70% of Creator at 80 → compound
        scores = {"Creator": 80.0, "Dribbler": 56.0, "Cover": 20.0}
        result = refine.best_model(scores, threshold=15.0)
        assert result == "Creator-Dribbler"

    def test_secondary_excluded_below_70_percent(self):
        """Secondary below 70% of primary → single archetype."""
        # Dribbler at 55 = 68.75% of Creator at 80 → too low
        scores = {"Creator": 80.0, "Dribbler": 55.0, "Cover": 20.0}
        result = refine.best_model(scores, threshold=15.0)
        assert result == "Creator"

    def test_secondary_skips_same_category(self):
        """Secondary from same category is skipped, third from different chosen."""
        # Commander is Mental like Controller → skip. Engine is Tactical → pick it.
        scores = {"Controller": 80.0, "Commander": 75.0, "Engine": 60.0, "Cover": 20.0}
        result = refine.best_model(scores, threshold=15.0)
        assert result == "Controller-Engine"


# ── Archetype Naming Convention ──────────────────────────────────────────────

class TestNamingConvention:
    """Per SACROSANCT: archetypes are bare nouns, never 'The X'."""

    def test_all_model_names_are_bare_nouns(self):
        for model in refine.MODEL_ATTRIBUTES:
            assert not model.startswith("The "), f"Model '{model}' uses 'The' prefix"
            assert model[0].isupper(), f"Model '{model}' not capitalized"

    def test_scoring_never_produces_the_prefix(self):
        """Even with edge cases, output is always bare noun."""
        grades = make_grades({
            "pace": 8, "acceleration": 8, "movement": 8, "balance": 8,
        })
        arch = score_player(grades, "WF")
        if arch:
            assert not arch.startswith("The ")

    def test_no_journeyman_fallback(self):
        """'The Journeyman' should never appear — NULL instead."""
        # Empty grades → undifferentiated
        grades = make_grades({"pace": 5, "acceleration": 5}, use_scout=False)
        # All same value = undifferentiated
        grades = [
            {"attribute": "pace", "scout_grade": None, "stat_score": 10, "source": "fbref"},
            {"attribute": "acceleration", "scout_grade": None, "stat_score": 10, "source": "fbref"},
        ]
        _, _, _, has_diff = refine.normalize_grades(grades)
        assert has_diff is False  # Would return None archetype


# ── Market Value Tier ────────────────────────────────────────────────────────

class TestMarketValueTier:
    """Test MVT computation."""

    def test_world_class(self):
        assert refine.compute_mvt(92, None, "Premier League") == 5

    def test_top_quality(self):
        assert refine.compute_mvt(87, None, "LaLiga") == 4

    def test_solid_top_flight(self):
        assert refine.compute_mvt(83, None, "Serie A") == 3

    def test_top5_league_floor(self):
        """Top-5 league player never below tier 3."""
        assert refine.compute_mvt(70, None, "Premier League") == 3

    def test_top_league_floor(self):
        """Top league player never below tier 2."""
        assert refine.compute_mvt(70, None, "Eredivisie") == 2

    def test_peak_fallback(self):
        """When no level, use peak * 0.92."""
        # peak=95 → q=87.4 → tier 4
        assert refine.compute_mvt(None, 95, None) == 4

    def test_no_data(self):
        assert refine.compute_mvt(None, None, None) == 1

    def test_max_cap(self):
        assert refine.compute_mvt(99, None, "Premier League") == 5


# ── Archetype Confidence ─────────────────────────────────────────────────────

class TestArchetypeConfidence:
    def test_scout_grades_high(self):
        assert refine.archetype_confidence(True, True) == "high"

    def test_stat_only_medium(self):
        assert refine.archetype_confidence(True, False) == "medium"

    def test_no_grades_low(self):
        assert refine.archetype_confidence(False, False) == "low"


# ── Edge Cases ───────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_grades(self):
        scores, _, has_scout, has_diff = refine.normalize_grades([])
        assert scores == {}
        assert has_scout is False
        assert has_diff is False

    def test_single_attribute_insufficient(self):
        """Need at least 2 of 4 core attributes to score a model."""
        grades = make_grades({"pace": 10})  # Only 1 Sprinter attribute
        attr_scores, _, _, _ = refine.normalize_grades(grades)
        scores = refine.score_models(attr_scores, "WF")
        assert scores["Sprinter"] == 0.0

    def test_two_attributes_sufficient(self):
        """2 of 4 core attributes is enough to score."""
        grades = make_grades({"pace": 10, "acceleration": 10})
        attr_scores, _, _, _ = refine.normalize_grades(grades)
        scores = refine.score_models(attr_scores, "WF")
        assert scores["Sprinter"] > 0

    def test_none_position_handled(self):
        grades = make_grades({"pace": 8, "acceleration": 8, "movement": 8, "balance": 8})
        arch = score_player(grades, None)
        assert arch is not None  # Should still work

    def test_threshold_boundary(self):
        """Score exactly at threshold should pass."""
        result = refine.best_model({"Sprinter": 15.0}, threshold=15.0)
        assert result == "Sprinter"

    def test_below_threshold_returns_none(self):
        result = refine.best_model({"Sprinter": 14.9}, threshold=15.0)
        assert result is None
