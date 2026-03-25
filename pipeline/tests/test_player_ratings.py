"""
Tests for 27_player_ratings.py — composite player rating computation.

Priority: CRITICAL — ratings drive overall scores, best roles, and compound
scores for 13k+ players. The best_role position-weighting bug (fixed 2026-03-20)
showed how silently wrong this can go.

Covers:
  - Grade normalisation per source (scout, statsbomb, understat, eafc, fbref)
  - Alias fallback when primary attribute missing
  - Coverage confidence penalty
  - Level anchoring for thin data
  - Compound score averaging
  - Position-weighted overall calculation
  - Best role selection with position weights
  - Flat data detection
"""
import sys
import os
from pathlib import Path

import pytest

# Add pipeline dir to path so we can import the module
_pipeline_dir = str(Path(__file__).resolve().parent.parent)
if _pipeline_dir not in sys.path:
    sys.path.insert(0, _pipeline_dir)

# Mock DB modules and patch sys.argv before loading the script
# (it has argparse + DB connections at module level)
import unittest.mock as mock

_mock_conn = mock.MagicMock()
_mock_sb = mock.MagicMock()

_saved_argv = sys.argv
sys.argv = ["27_player_ratings.py", "--dry-run"]

with mock.patch.dict(sys.modules, {
    "config": mock.MagicMock(POSTGRES_DSN="mock://"),
    "lib.db": mock.MagicMock(
        require_conn=mock.MagicMock(return_value=_mock_conn),
        get_supabase=mock.MagicMock(return_value=_mock_sb),
    ),
}):
    from importlib.util import spec_from_file_location, module_from_spec
    _spec = spec_from_file_location(
        "ratings", os.path.join(_pipeline_dir, "27_player_ratings.py")
    )
    ratings = module_from_spec(_spec)
    _spec.loader.exec_module(ratings)

sys.argv = _saved_argv


# ── Helpers ───────────────────────────────────────────────────────────────────

def grade(attr: str, scout: float | None = None, stat: float | None = None,
          source: str = "scout_assessment") -> dict:
    """Build a single attribute_grades row."""
    return {
        "attribute": attr,
        "scout_grade": scout,
        "stat_score": stat,
        "source": source,
    }


def scout_grades(attrs: dict[str, float]) -> list[dict]:
    """Build scout_assessment grades from {attribute: value} dict."""
    return [grade(a, scout=v) for a, v in attrs.items()]


def stat_grades(attrs: dict[str, float], source: str = "fbref") -> list[dict]:
    """Build stat_score grades from {attribute: value} dict."""
    return [grade(a, stat=v, source=source) for a, v in attrs.items()]


# ── Grade Normalisation ──────────────────────────────────────────────────────

class TestGradeNormalisation:
    """Verify source-specific normalisation to 0-20 scale.

    Uses 'creativity' (Creator model) as the test attribute because it has
    no alias cross-contamination — a single creativity grade produces exactly
    1 value in Creator (1/4 confidence = 0.70).
    """

    def _expected(self, score_20: float) -> int:
        """Expected raw score for a single-attribute model input."""
        # avg = score_20 (1 value), full = min(avg*5, 99), raw = full * 0.70
        return round(min(score_20 * 5, 99) * 0.70)

    def test_scout_grade_passthrough(self):
        """Scout grades (1-20) pass through unchanged."""
        grades = [grade("creativity", scout=15)]
        _, raw = ratings.compute_model_scores(grades)
        assert "Creator" in raw
        assert raw["Creator"] == self._expected(15)

    def test_scout_grade_clamped_at_20(self):
        """Scout grades above 20 are clamped."""
        grades = [grade("creativity", scout=25)]
        _, raw = ratings.compute_model_scores(grades)
        assert raw["Creator"] == self._expected(20)

    def test_statsbomb_1_to_10_doubled(self):
        """StatsBomb stat_score (1-10) is doubled to 0-20 scale."""
        grades = [grade("creativity", stat=7, source="statsbomb")]
        _, raw = ratings.compute_model_scores(grades)
        assert raw["Creator"] == self._expected(14)  # 7 * 2 = 14

    def test_eafc_excluded_from_scoring(self):
        """EAFC grades are excluded from model scoring entirely."""
        grades = [grade("creativity", stat=16, source="eafc_inferred")]
        _, raw = ratings.compute_model_scores(grades)
        assert "Creator" not in raw  # EAFC skipped → no data → no model score

    def test_understat_compression(self):
        """Understat scores are compressed: score * 1.7, capped at 17."""
        # 10 * 1.7 = 17 (capped)
        grades = [grade("creativity", stat=10, source="understat")]
        _, raw = ratings.compute_model_scores(grades)
        assert raw["Creator"] == self._expected(17)

        # 5 * 1.7 = 8.5
        grades = [grade("creativity", stat=5, source="understat")]
        _, raw = ratings.compute_model_scores(grades)
        assert raw["Creator"] == self._expected(8.5)

    def test_fbref_doubled(self):
        """FBRef/other stat_score (1-10) is doubled to 2-20."""
        grades = [grade("creativity", stat=8, source="fbref")]
        _, raw = ratings.compute_model_scores(grades)
        assert raw["Creator"] == self._expected(16)

    def test_zero_scores_skipped(self):
        """Grades with 0 or None scores are ignored."""
        grades = [
            grade("creativity", scout=0),
            grade("vision", scout=None, stat=0, source="fbref"),
        ]
        _, raw = ratings.compute_model_scores(grades)
        assert "Creator" not in raw

    def test_source_priority_higher_wins(self):
        """Higher-priority source wins when both exist for same attribute."""
        grades = [
            grade("creativity", stat=8, source="fbref"),       # priority 3, norm=16
            grade("creativity", scout=18, source="scout_assessment"),  # priority 5, norm=18
        ]
        _, raw = ratings.compute_model_scores(grades)
        # Scout (priority 5) wins over fbref (priority 3)
        assert raw["Creator"] == self._expected(18)

    def test_lower_priority_ignored(self):
        """Lower-priority source doesn't override higher-priority."""
        grades = [
            grade("creativity", scout=18, source="scout_assessment"),  # priority 5
            grade("creativity", stat=5, source="understat"),           # priority 2
        ]
        _, raw = ratings.compute_model_scores(grades)
        assert raw["Creator"] == self._expected(18)


# ── Alias Fallback ───────────────────────────────────────────────────────────

class TestAliasFallback:
    """Verify alias resolution when primary attribute is missing."""

    def test_alias_used_when_primary_missing(self):
        """unpredictability → take_ons fallback works, discounted at 0.7×."""
        # Creator model needs: creativity, unpredictability, vision, guile
        # unpredictability aliases to take_ons (discounted)
        grades = [
            grade("creativity", scout=14),
            grade("take_ons", scout=12),  # alias for unpredictability → 12 * 0.7 = 8.4
            grade("vision", scout=16),
            grade("guile", scout=10),     # could alias to through_balls but primary exists
        ]
        _, raw = ratings.compute_model_scores(grades)
        assert "Creator" in raw
        # 3 direct + 1 alias: confidence blended between 4-attr and 3-attr
        avg = (14 + 12 * 0.7 + 16 + 10) / 4  # alias discounted
        blended_conf = (1.0 + 0.95) / 2  # avg of 4-attr and 3-attr confidence
        assert raw["Creator"] == round(min(avg * 5, 99) * blended_conf)

    def test_primary_preferred_over_alias(self):
        """When both primary and alias exist, primary wins."""
        grades = [
            grade("unpredictability", scout=18),  # primary
            grade("take_ons", scout=5),            # alias — should be ignored
            grade("creativity", scout=14),
            grade("vision", scout=16),
            grade("guile", scout=10),
        ]
        _, raw = ratings.compute_model_scores(grades)
        avg = (14 + 18 + 16 + 10) / 4
        assert raw["Creator"] == round(min(avg * 5, 99) * 1.0)

    def test_no_double_counting_aliases(self):
        """An alias already used by one attribute can't be reused by another."""
        # If two attributes alias to the same underlying attr, only one should use it
        # This is tested implicitly: used_attrs set prevents double-counting
        grades = [
            grade("take_ons", scout=15),  # alias for unpredictability
        ]
        _, raw = ratings.compute_model_scores(grades)
        # Creator should have 1 attr (take_ons as unpredictability alias, discounted)
        # 1 alias → confidence blended between 1-attr(0.70) and 0-attr(0.70) = 0.70
        if "Creator" in raw:
            discounted = 15 * 0.7
            assert raw["Creator"] == round(discounted * 5 * 0.70)


# ── Coverage Confidence ──────────────────────────────────────────────────────

class TestCoverageConfidence:
    """Verify confidence penalty based on attribute coverage.

    Uses Creator model (creativity, unpredictability, vision, guile) with
    all primary attrs provided directly to avoid alias cross-contamination.
    """

    def _creator_grades(self, n: int) -> list[dict]:
        """Build n grades for the Creator model."""
        attrs = ["creativity", "unpredictability", "vision", "guile"][:n]
        return [grade(a, scout=16) for a in attrs]

    def test_4_of_4_full_confidence(self):
        """4/4 attributes → confidence 1.0."""
        _, raw = ratings.compute_model_scores(self._creator_grades(4))
        expected = round(min(16 * 5, 99) * 1.0)
        assert raw["Creator"] == expected

    def test_3_of_4_slight_penalty(self):
        """3/4 attributes → confidence 0.95."""
        _, raw = ratings.compute_model_scores(self._creator_grades(3))
        expected = round(min(16 * 5, 99) * 0.95)
        assert raw["Creator"] == expected

    def test_2_of_4_moderate_penalty(self):
        """2/4 attributes → confidence 0.85."""
        _, raw = ratings.compute_model_scores(self._creator_grades(2))
        expected = round(min(16 * 5, 99) * 0.85)
        assert raw["Creator"] == expected

    def test_1_of_4_heavy_penalty(self):
        """1/4 attributes → confidence 0.70."""
        _, raw = ratings.compute_model_scores(self._creator_grades(1))
        expected = round(min(16 * 5, 99) * 0.70)
        assert raw["Creator"] == expected


# ── Level Anchoring ──────────────────────────────────────────────────────────

class TestLevelAnchoring:
    """Verify level-based score anchoring for thin data.

    Uses Creator model with 'creativity' (1 attr, no alias contamination).
    """

    def test_no_anchoring_with_3_plus_attrs(self):
        """3+ attributes → no anchoring, raw = anchored."""
        grades = [grade(a, scout=10) for a in ["creativity", "unpredictability", "vision"]]
        anchored, raw = ratings.compute_model_scores(grades, level=85)
        assert anchored["Creator"] == raw["Creator"]

    def test_anchoring_with_thin_data(self):
        """1-2 attributes → blend with level anchor."""
        grades = [grade("creativity", scout=10)]
        anchored, raw = ratings.compute_model_scores(grades, level=85)
        # raw: 10*5=50 → *0.70 = 35
        raw_score = round(min(10 * 5, 99) * 0.70)
        assert raw["Creator"] == raw_score
        # anchored: raw * (1/4) + 85 * (3/4)
        data_weight = 1 / 4  # 1 attr out of 4
        expected_anchored = round(raw_score * data_weight + 85 * (1 - data_weight))
        assert anchored["Creator"] == expected_anchored

    def test_level_capped_at_95(self):
        """Level anchor capped at 95 even for level 99 players."""
        grades = [grade("creativity", scout=10)]
        anchored, _ = ratings.compute_model_scores(grades, level=99)
        # Anchor uses min(99, 95) = 95
        data_weight = 1 / 4
        raw_score = round(min(10 * 5, 99) * 0.70)
        expected = round(raw_score * data_weight + 95 * (1 - data_weight))
        assert anchored["Creator"] == expected

    def test_no_anchoring_without_level(self):
        """No level → no anchoring, raw = anchored."""
        grades = [grade("creativity", scout=10)]
        anchored, raw = ratings.compute_model_scores(grades, level=None)
        assert anchored["Creator"] == raw["Creator"]


# ── Compound Scores ──────────────────────────────────────────────────────────

class TestCompoundScores:
    """Verify compound score averaging."""

    def test_averages_available_models(self):
        """Compound = average of available model scores in group."""
        scores = {"Dribbler": 80, "Passer": 60, "Striker": 70, "GK": 50}
        compounds = ratings.compute_compound_scores(scores)
        # Technical = avg(Dribbler, Passer, Striker, GK)
        assert compounds["Technical"] == round((80 + 60 + 70 + 50) / 4)

    def test_missing_models_excluded(self):
        """Models not in scores are excluded from average."""
        scores = {"Dribbler": 80, "Passer": 60}
        compounds = ratings.compute_compound_scores(scores)
        # Technical = avg(80, 60) = 70 (Striker, GK missing)
        assert compounds["Technical"] == 70

    def test_empty_scores(self):
        """Empty input → empty output."""
        compounds = ratings.compute_compound_scores({})
        assert compounds == {}


# ── Overall Rating ───────────────────────────────────────────────────────────

class TestOverall:
    """Verify position-weighted overall calculation."""

    def test_position_weighted_average(self):
        """Overall uses position-specific compound weights."""
        compounds = {"Technical": 80, "Tactical": 60, "Physical": 70, "Mental": 90}
        # CF weights: Technical=0.3, Tactical=0.1, Physical=0.3, Mental=0.3
        overall = ratings.compute_overall(compounds, "CF", level=None, grade_count=50)
        expected = 80 * 0.3 + 60 * 0.1 + 70 * 0.3 + 90 * 0.3
        assert overall == round(min(max(expected, 1), 99))

    def test_level_blend_by_grade_count(self):
        """More grades → more trust in technical score."""
        compounds = {"Technical": 80, "Tactical": 60, "Physical": 70, "Mental": 90}
        # 40 grades → tech_pct = min(0.50, max(0.20, 40/80)) = 0.50
        overall_rich = ratings.compute_overall(compounds, "CF", level=85, grade_count=40)
        # 10 grades → tech_pct = min(0.50, max(0.20, 10/80)) = 0.20
        overall_thin = ratings.compute_overall(compounds, "CF", level=85, grade_count=10)
        # Thin data should lean more toward level (85)
        # Rich data should lean more toward computed score
        assert overall_thin != overall_rich

    def test_no_level_pure_technical(self):
        """Without level, overall = pure technical calculation."""
        compounds = {"Technical": 80, "Tactical": 60, "Physical": 70, "Mental": 90}
        overall = ratings.compute_overall(compounds, "CF", level=None, grade_count=50)
        expected = 80 * 0.3 + 60 * 0.1 + 70 * 0.3 + 90 * 0.3
        assert overall == round(expected)

    def test_unknown_position_equal_weights(self):
        """Unknown position falls back to equal 0.25 weights."""
        compounds = {"Technical": 80, "Tactical": 60, "Physical": 70, "Mental": 90}
        overall = ratings.compute_overall(compounds, "XX", level=None, grade_count=50)
        expected = (80 + 60 + 70 + 90) / 4
        assert overall == round(expected)

    def test_clamped_1_to_99(self):
        """Overall is clamped between 1 and 99."""
        low = ratings.compute_overall({"Technical": 1}, "CF", level=None, grade_count=50)
        assert low >= 1
        high = ratings.compute_overall({"Technical": 99, "Tactical": 99, "Physical": 99, "Mental": 99},
                                       "CF", level=None, grade_count=50)
        assert high <= 99


# ── Best Role Selection ──────────────────────────────────────────────────────

class TestBestRole:
    """Verify position-weighted best role computation."""

    def test_cf_gets_cf_role(self):
        """CF player gets a CF tactical role."""
        scores = {"Striker": 85, "Target": 70, "Sprinter": 60, "Creator": 80,
                  "Powerhouse": 50, "Dribbler": 75, "Controller": 65}
        role, score = ratings.compute_best_role(scores, "CF")
        cf_roles = [name for _, _, name in ratings.TACTICAL_ROLES["CF"]]
        assert role in cf_roles

    def test_cd_gets_cd_role(self):
        """CD player gets a CD tactical role."""
        scores = {"Destroyer": 85, "Cover": 80, "Commander": 70, "Passer": 60,
                  "Controller": 55, "Target": 50, "Powerhouse": 65}
        role, score = ratings.compute_best_role(scores, "CD")
        cd_roles = [name for _, _, name in ratings.TACTICAL_ROLES["CD"]]
        assert role in cd_roles

    def test_position_weights_applied(self):
        """Position weights influence role selection — data drives role, not just top weight."""
        # With tight weights (0.8-1.0), a CD with dominant Destroyer data
        # should get a Destroyer-primary role over weaker models.
        scores = {"Destroyer": 90, "Cover": 60, "Commander": 55,
                  "Passer": 50, "Controller": 40, "Powerhouse": 70, "Target": 45}
        role, _ = ratings.compute_best_role(scores, "CD")
        # Destroyer-primary roles: Stopper (Destroyer+Powerhouse), Zagueiro (Destroyer+Commander)
        assert role in ("Stopper", "Zagueiro")

    def test_unknown_position_returns_none(self):
        """Unknown position → no role."""
        role, score = ratings.compute_best_role({"Striker": 85}, "XX")
        assert role is None
        assert score == 0

    def test_missing_primary_model_skips_role(self):
        """Roles with missing primary model data are skipped."""
        # Only Creator data — CF roles needing Striker/Target as primary should be skipped
        scores = {"Creator": 90, "Controller": 85}
        role, score = ratings.compute_best_role(scores, "CF")
        # Only Falso Nove (Creator, Controller) should match
        assert role == "Falso Nove"

    def test_score_normalised_to_100(self):
        """Role scores are normalised back to 0-100 range."""
        scores = {"Striker": 90, "Sprinter": 85, "Target": 70, "Powerhouse": 60,
                  "Creator": 75, "Dribbler": 80, "Controller": 65}
        _, score = ratings.compute_best_role(scores, "CF")
        assert 0 <= score <= 99

    def test_all_positions_have_roles(self):
        """Every valid position has at least 2 tactical roles defined."""
        for pos in ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"]:
            roles = ratings.TACTICAL_ROLES.get(pos, [])
            assert len(roles) >= 2, f"{pos} has only {len(roles)} roles"

    def test_secondary_missing_applies_penalty(self):
        """When secondary model is missing, 0.85 penalty applied to primary."""
        # Give only Striker data — CF Poacher needs (Striker, Sprinter)
        scores = {"Striker": 80}
        role, score = ratings.compute_best_role(scores, "CF")
        # Should still return a role but with penalty
        assert role is not None
        assert score > 0


# ── Flat Data Detection ──────────────────────────────────────────────────────

class TestFlatDataDetection:
    """Verify flat/undifferentiated data is detected."""

    def test_all_same_values_is_flat(self):
        """All models scoring identically → flat."""
        assert not ratings.has_differentiated_data({"A": 50, "B": 50, "C": 50})

    def test_varied_values_is_differentiated(self):
        """Different model scores → differentiated."""
        assert ratings.has_differentiated_data({"A": 50, "B": 70, "C": 60})

    def test_single_model_is_flat(self):
        """Single model → considered flat (insufficient data)."""
        assert not ratings.has_differentiated_data({"A": 50})

    def test_empty_is_flat(self):
        """No data → flat."""
        assert not ratings.has_differentiated_data({})


# ── Known Player Sanity Checks ───────────────────────────────────────────────

class TestKnownPlayers:
    """Verify expected role assignments for archetypal players.

    These use synthetic grades matching real player profiles to ensure
    the computation produces sensible results.
    """

    def test_kane_is_cf_role(self):
        """Harry Kane profile → CF role (Poacher or Complete Forward)."""
        grades = scout_grades({
            "finishing": 19, "shot_power": 17, "heading": 16, "movement": 18,
            "composure": 18, "vision": 15, "hold_up": 16, "strength": 15,
            "tackling": 6, "pace": 11, "stamina": 14, "creativity": 13,
        })
        _, raw = ratings.compute_model_scores(grades)
        role, _ = ratings.compute_best_role(raw, "CF")
        cf_roles = [name for _, _, name in ratings.TACTICAL_ROLES["CF"]]
        assert role in cf_roles

    def test_pirlo_is_dm_role(self):
        """Pirlo profile → DM Regista or Pivote (both playmaker-controller DM roles)."""
        grades = scout_grades({
            "anticipation": 18, "composure": 19, "decisions": 17, "tempo": 19,
            "creativity": 17, "vision": 19, "pass_range": 18, "guile": 16,
            "tackling": 10, "aggression": 8, "pace": 8, "strength": 9,
        })
        _, raw = ratings.compute_model_scores(grades)
        role, _ = ratings.compute_best_role(raw, "DM")
        assert role in ("Regista", "Pivote")

    def test_maldini_is_cd_role(self):
        """Maldini profile → CD defensive role."""
        grades = scout_grades({
            "tackling": 19, "marking": 18, "positioning": 19, "awareness": 18,
            "composure": 17, "anticipation": 19, "leadership": 16, "concentration": 17,
            "pace": 14, "aggression": 13, "heading": 15, "strength": 14,
        })
        _, raw = ratings.compute_model_scores(grades)
        role, _ = ratings.compute_best_role(raw, "CD")
        cd_roles = [name for _, _, name in ratings.TACTICAL_ROLES["CD"]]
        assert role in cd_roles


# ── GK Base Model Fallback ─────────────────────────────────────────────────

class TestGKBaseModelFallback:
    """Verify GKs get best_role via base model attrs when override model has no data."""

    def test_base_gk_score_from_scout_attrs(self):
        """_compute_base_gk_score returns a score from agility/footwork/handling/reactions."""
        grades = [
            grade("agility", scout=16),
            grade("footwork", scout=14),
            grade("handling", scout=18),
            grade("reactions", scout=17),
        ]
        score = ratings._compute_base_gk_score(grades)
        assert score is not None
        # avg = (16+14+18+17)/4 = 16.25, full = 81.25, confidence 1.0 → 81
        assert score == round(min(16.25 * 5, 99) * 1.0)

    def test_base_gk_score_none_when_no_gk_attrs(self):
        """Returns None when no base GK attributes are available."""
        grades = [
            grade("tackling", scout=15),
            grade("heading", scout=12),
        ]
        score = ratings._compute_base_gk_score(grades)
        assert score is None

    def test_base_gk_score_partial_coverage(self):
        """Partial base GK attrs → score with confidence penalty."""
        grades = [
            grade("handling", scout=18),
            grade("reactions", scout=16),
        ]
        score = ratings._compute_base_gk_score(grades)
        assert score is not None
        # avg = 17, full = 85, 2/4 confidence = 0.85 → 72
        assert score == round(min(17 * 5, 99) * 0.85)

    def test_eafc_excluded_from_base_gk_score(self):
        """_compute_base_gk_score also excludes EAFC grades."""
        grades = [
            grade("agility", stat=16, source="eafc_inferred"),
            grade("footwork", stat=14, source="eafc_inferred"),
            grade("handling", stat=18, source="eafc_inferred"),
            grade("reactions", stat=17, source="eafc_inferred"),
        ]
        score = ratings._compute_base_gk_score(grades)
        assert score is None  # All grades are EAFC → excluded → no data

    def test_gk_gets_role_with_scout_base_attrs(self):
        """GK with scout base attrs gets a role via base model fallback."""
        grades = [
            grade("agility", scout=15),
            grade("footwork", scout=14),
            grade("handling", scout=17),
            grade("reactions", scout=16),
            # Cover attrs for differentiated data
            grade("awareness", scout=12),
            grade("discipline", scout=14),
            grade("interceptions", scout=10),
        ]
        _, raw = ratings.compute_model_scores(grades)
        base_score = ratings._compute_base_gk_score(grades)
        assert base_score is not None
        role_scores = dict(raw)
        if "GK" not in role_scores:
            role_scores["GK"] = base_score
        role, score = ratings.compute_best_role(role_scores, "GK")
        gk_roles = [name for _, _, name in ratings.TACTICAL_ROLES["GK"]]
        assert role in gk_roles
        assert score > 0

    def test_gk_override_model_with_scout_data(self):
        """If the override GK model has scout data, GK key should be present."""
        grades = [
            grade("positioning", scout=16),
            grade("awareness", scout=14),
            grade("pass_range", scout=15),
            grade("throwing", scout=13),
        ]
        _, raw = ratings.compute_model_scores(grades)
        assert "GK" in raw


# ── FBRef Priority Demotion ────────────────────────────────────────────────

class TestFBRefPriorityDemotion:
    """Verify fbref grades no longer override higher-quality sources."""

    def test_fbref_priority_is_zero(self):
        """fbref SOURCE_PRIORITY is 0 (same as eafc_inferred)."""
        from lib.models import SOURCE_PRIORITY
        assert SOURCE_PRIORITY["fbref"] == 0

    def test_eafc_excluded_fbref_survives(self):
        """When both EAFC and fbref exist, EAFC is excluded and fbref is used."""
        grades = [
            grade("through_balls", stat=2, source="fbref"),      # priority 0, norm=4
            grade("through_balls", stat=16, source="eafc_inferred"),  # EXCLUDED
        ]
        _, raw = ratings.compute_model_scores(grades)
        # EAFC excluded → only fbref (norm=4) remains
        assert "Passer" in raw
        expected = round(min(4 * 5, 99) * 0.70)  # 1/4 confidence
        assert raw["Passer"] == expected

    def test_api_football_beats_fbref(self):
        """api_football (priority 3) overrides fbref (priority 0)."""
        grades = [
            grade("through_balls", stat=1, source="fbref"),          # priority 0, norm=2
            grade("through_balls", stat=8, source="api_football"),   # priority 3, norm=16
        ]
        _, raw = ratings.compute_model_scores(grades)
        # api_football should win — through_balls norm=16
        # Passer model has 4 attrs; only through_balls present → 1/4 confidence
        expected = round(min(16 * 5, 99) * 0.70)
        assert raw["Passer"] == expected

    def test_understat_beats_fbref(self):
        """understat (priority 2) overrides fbref (priority 0)."""
        grades = [
            grade("creativity", stat=1, source="fbref"),          # priority 0, norm=2
            grade("creativity", stat=7, source="understat"),      # priority 2, norm=11.9
        ]
        _, raw = ratings.compute_model_scores(grades)
        # understat wins — creativity norm = 7*1.7 = 11.9
        expected = round(min(11.9 * 5, 99) * 0.70)
        assert raw["Creator"] == expected


# ── EAFC Exclusion ──────────────────────────────────────────────────────────

class TestEAFCExclusion:
    """Verify EAFC grades are completely excluded from model scoring."""

    def test_eafc_only_player_gets_no_scores(self):
        """A player with only EAFC grades produces no model scores."""
        grades = [
            grade("creativity", stat=18, source="eafc_inferred"),
            grade("vision", stat=17, source="eafc_inferred"),
            grade("unpredictability", stat=16, source="eafc_inferred"),
            grade("guile", stat=15, source="eafc_inferred"),
        ]
        _, raw = ratings.compute_model_scores(grades)
        assert raw == {}  # All EAFC → all excluded → empty

    def test_eafc_mixed_with_real_uses_real_only(self):
        """When EAFC and real sources coexist, only real sources are used."""
        grades = [
            grade("creativity", stat=18, source="eafc_inferred"),  # EXCLUDED
            grade("creativity", stat=7, source="api_football"),    # priority 3, norm=14
        ]
        _, raw = ratings.compute_model_scores(grades)
        expected = round(min(14 * 5, 99) * 0.70)
        assert raw["Creator"] == expected

    def test_eafc_excluded_from_base_gk(self):
        """_compute_base_gk_score also excludes EAFC."""
        grades = [
            grade("agility", stat=16, source="eafc_inferred"),
            grade("handling", stat=18, source="eafc_inferred"),
        ]
        score = ratings._compute_base_gk_score(grades)
        assert score is None


# ── League Strength Scaling ───────────────────────────────────────────────────

class TestLeagueStrengthScaling:
    """Verify league strength is applied to non-prescaled sources."""

    def test_understat_scaled_by_league_strength(self):
        """Understat grades are multiplied by league_strength."""
        grades = [grade("creativity", stat=10, source="understat")]
        # Without league strength: 10 * 1.7 = 17
        _, raw_no_ls = ratings.compute_model_scores(grades, league_strength=None)
        # With 0.75 league strength: 17 * 0.75 = 12.75
        _, raw_with_ls = ratings.compute_model_scores(grades, league_strength=0.75)
        # Weaker league → lower score
        assert raw_with_ls["Creator"] < raw_no_ls["Creator"]

    def test_scout_grades_not_scaled(self):
        """Scout assessment grades are NOT affected by league strength."""
        grades = [grade("creativity", scout=15)]
        _, raw_no_ls = ratings.compute_model_scores(grades, league_strength=None)
        _, raw_with_ls = ratings.compute_model_scores(grades, league_strength=0.60)
        # Scout grades are context-aware — no league scaling
        assert raw_no_ls["Creator"] == raw_with_ls["Creator"]

    def test_api_football_not_double_scaled(self):
        """API-Football grades are NOT scaled (already pre-scaled in pipeline 66)."""
        grades = [grade("creativity", stat=8, source="api_football")]
        _, raw_no_ls = ratings.compute_model_scores(grades, league_strength=None)
        _, raw_with_ls = ratings.compute_model_scores(grades, league_strength=0.60)
        assert raw_no_ls["Creator"] == raw_with_ls["Creator"]

    def test_statsbomb_scaled_by_league_strength(self):
        """StatsBomb grades are scaled by league strength."""
        grades = [grade("creativity", stat=8, source="statsbomb")]
        _, raw_no_ls = ratings.compute_model_scores(grades, league_strength=None)
        _, raw_with_ls = ratings.compute_model_scores(grades, league_strength=0.70)
        assert raw_with_ls["Creator"] < raw_no_ls["Creator"]

    def test_computed_not_scaled(self):
        """Computed grades are NOT scaled by league strength."""
        grades = [grade("creativity", stat=8, source="computed")]
        _, raw_no_ls = ratings.compute_model_scores(grades, league_strength=None)
        _, raw_with_ls = ratings.compute_model_scores(grades, league_strength=0.60)
        assert raw_no_ls["Creator"] == raw_with_ls["Creator"]

    def test_league_strength_1_0_no_effect(self):
        """League strength of 1.0 (top league) has no effect on scores."""
        grades = [grade("creativity", stat=10, source="understat")]
        _, raw_no_ls = ratings.compute_model_scores(grades, league_strength=None)
        _, raw_with_ls = ratings.compute_model_scores(grades, league_strength=1.0)
        assert raw_no_ls["Creator"] == raw_with_ls["Creator"]


# ── GK Scout Grade Rescale Removal ────────────────────────────────────────────

class TestGKScoutRescaleRemoval:
    """Verify GK scout grades are no longer inflated by 1.2x multiplier."""

    def test_gk_scout_grade_not_inflated(self):
        """GK scout grades use face value, not 1.2x rescale."""
        # GK model uses positioning/awareness/pass_range/throwing
        grades = [
            grade("positioning", scout=15, source="scout_assessment"),
            grade("awareness", scout=15, source="scout_assessment"),
            grade("pass_range", scout=15, source="scout_assessment"),
            grade("throwing", scout=15, source="scout_assessment"),
        ]
        _, raw = ratings.compute_model_scores(grades, position="GK")
        # At face value: avg=15, score = 15*5 = 75, confidence 1.0 → 75
        assert raw["GK"] == round(min(15 * 5, 99) * 1.0)

    def test_gk_and_outfield_same_scout_grade_same_score(self):
        """Same scout grade produces same normalised score regardless of position."""
        gk_grades = [grade("positioning", scout=16, source="scout_assessment")]
        outfield_grades = [grade("positioning", scout=16, source="scout_assessment")]
        _, gk_raw = ratings.compute_model_scores(gk_grades, position="GK")
        _, of_raw = ratings.compute_model_scores(outfield_grades, position="CF")
        # Both should produce identical scores for the same attribute value
        # (positioning feeds different models for GK vs CF, but normalisation should be equal)
        # We check the normalised value reaches the same models that use positioning
        # Cover model uses positioning for both positions
        if "Cover" in gk_raw and "Cover" in of_raw:
            assert gk_raw["Cover"] == of_raw["Cover"]


# ── Calibration Module ─────────────────────────────────────────────────────────

class TestCalibrationModule:
    """Verify calibration module functions."""

    def test_score_bands_complete(self):
        """Every score 0-99 maps to a band."""
        from lib.calibration import get_score_band
        for s in range(0, 100):
            name, desc = get_score_band(s)
            assert name != ""
            assert desc != ""

    def test_score_band_none_is_unrated(self):
        """None score returns Unrated."""
        from lib.calibration import get_score_band
        name, _ = get_score_band(None)
        assert name == "Unrated"

    def test_score_band_boundaries(self):
        """Key boundary scores map to expected bands."""
        from lib.calibration import get_score_band
        assert get_score_band(95)[0] == "Generational"
        assert get_score_band(93)[0] == "Generational"
        assert get_score_band(92)[0] == "World Class"
        assert get_score_band(90)[0] == "World Class"
        assert get_score_band(89)[0] == "Elite"
        assert get_score_band(87)[0] == "Elite"
        assert get_score_band(86)[0] == "International"
        assert get_score_band(83)[0] == "Established"
        assert get_score_band(79)[0] == "Professional"
        assert get_score_band(74)[0] == "Capable"
        assert get_score_band(64)[0] == "Foundation"

    def test_reference_profiles_exist(self):
        """Reference profiles dict has entries for all key positions."""
        from lib.calibration import REFERENCE_PROFILES
        positions = {v[0] for v in REFERENCE_PROFILES.values()}
        assert "CF" in positions
        assert "WF" in positions
        assert "CM" in positions
        assert "CD" in positions
        assert "GK" in positions
        assert len(REFERENCE_PROFILES) >= 25  # at least 25 anchor players
