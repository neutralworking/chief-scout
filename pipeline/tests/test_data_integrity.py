"""
Tests for live database data integrity.

Priority: HIGH — validates that production data is consistent and correct.
Requires POSTGRES_DSN to be set (runs against live Supabase).
"""
import os
import pytest

# Skip entire module if no DB connection available
pytestmark = pytest.mark.skipif(
    not os.environ.get("POSTGRES_DSN") and not os.path.exists(
        os.path.join(os.path.dirname(__file__), "..", "..", ".env.local")
    ),
    reason="No database credentials available",
)


@pytest.fixture(scope="module")
def db():
    """Shared database connection for all tests in this module."""
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from config import POSTGRES_DSN
    import psycopg2
    import psycopg2.extras
    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    yield cur
    conn.close()


# ── View Integrity ───────────────────────────────────────────────────────────

class TestPlayerIntelligenceCardView:
    """The player_intelligence_card view is the single data source for the UI."""

    REQUIRED_COLUMNS = [
        "person_id", "name", "dob", "height_cm", "preferred_foot", "active",
        "nation", "club", "position", "level", "peak", "overall",
        "archetype", "model_id", "profile_tier", "personality_type",
        "pursuit_status", "market_value_tier", "true_mvt",
        "market_value_eur", "highest_market_value_eur", "market_value_date",
        "ei", "sn", "tf", "jp", "competitiveness", "coachability",
        "scarcity_score", "scouting_notes", "squad_role", "loan_status",
        "blueprint", "hg", "transfer_fee_eur", "market_premium",
    ]

    def test_view_exists(self, db):
        db.execute("SELECT 1 FROM player_intelligence_card LIMIT 1")
        assert db.fetchone() is not None

    def test_all_required_columns_present(self, db):
        db.execute("SELECT * FROM player_intelligence_card LIMIT 0")
        cols = {d.name for d in db.description}
        missing = [c for c in self.REQUIRED_COLUMNS if c not in cols]
        assert not missing, f"Missing columns: {missing}"

    def test_dob_column_aliased_correctly(self, db):
        """UI queries 'dob', not 'date_of_birth'."""
        db.execute("SELECT * FROM player_intelligence_card LIMIT 0")
        cols = {d.name for d in db.description}
        assert "dob" in cols, "Column 'dob' missing — UI will break"
        assert "date_of_birth" not in cols, "Should be aliased to 'dob'"

    def test_person_id_is_unique(self, db):
        db.execute("""
            SELECT person_id, count(*) as cnt
            FROM player_intelligence_card
            GROUP BY person_id
            HAVING count(*) > 1
            LIMIT 5
        """)
        dupes = db.fetchall()
        assert len(dupes) == 0, f"Duplicate person_ids: {dupes}"


# ── Archetype Data ───────────────────────────────────────────────────────────

class TestArchetypeData:
    """Verify archetype values follow SACROSANCT spec."""

    VALID_MODELS = {
        "Controller", "Commander", "Creator",
        "Target", "Sprinter", "Powerhouse",
        "Cover", "Engine", "Destroyer",
        "Dribbler", "Passer", "Striker",
        "GK",
    }

    def test_no_legacy_the_prefix_labels(self, db):
        """No 'The Journeyman', 'The Elder Statesman', etc."""
        db.execute("""
            SELECT DISTINCT archetype FROM player_profiles
            WHERE archetype LIKE 'The %%'
        """)
        legacy = [r["archetype"] for r in db.fetchall()]
        assert len(legacy) == 0, f"Legacy labels found: {legacy}"

    def test_all_archetypes_are_valid_models_or_compounds(self, db):
        """Every archetype must be a SACROSANCT model or Model-Model compound."""
        db.execute("""
            SELECT DISTINCT archetype FROM player_profiles
            WHERE archetype IS NOT NULL
        """)
        for row in db.fetchall():
            arch = row["archetype"]
            parts = arch.split("-")
            for part in parts:
                assert part in self.VALID_MODELS, (
                    f"Invalid archetype component '{part}' in '{arch}'"
                )

    def test_compound_max_two_models(self, db):
        db.execute("""
            SELECT DISTINCT archetype FROM player_profiles
            WHERE archetype IS NOT NULL AND archetype LIKE '%%-%%-%%'
        """)
        triples = [r["archetype"] for r in db.fetchall()]
        assert len(triples) == 0, f"Triple compounds found: {triples}"

    def test_gk_archetype_only_for_gk_position(self, db):
        """Pure GK archetype should only appear on GK-position players."""
        db.execute("""
            SELECT person_id, position, archetype FROM player_profiles
            WHERE archetype = 'GK' AND position != 'GK' AND position IS NOT NULL
            LIMIT 10
        """)
        mismatches = db.fetchall()
        assert len(mismatches) == 0, (
            f"Non-GK players with GK archetype: {mismatches}"
        )


# ── Personality Data ─────────────────────────────────────────────────────────

class TestPersonalityData:
    """Validate personality dimension scores and type codes."""

    VALID_CODES = {
        "ANLC", "ANSC", "INSC", "AXLC", "IXSC", "IXLC",
        "INSP", "ANLP", "IXSP", "INLC", "INLP", "AXSC",
        "ANSP", "AXSP", "IXLP", "AXLP",
    }

    def test_dimension_scores_in_range(self, db):
        """ei/sn/tf/jp must be 0-100."""
        for dim in ["ei", "sn", "tf", "jp"]:
            db.execute(f"""
                SELECT count(*) as cnt FROM player_personality
                WHERE {dim} IS NOT NULL AND ({dim} < 0 OR {dim} > 100)
            """)
            assert db.fetchone()["cnt"] == 0, f"{dim} has out-of-range values"

    def test_personality_type_codes_valid(self, db):
        """All computed personality codes must be one of the 16 valid types."""
        db.execute("""
            SELECT DISTINCT personality_type FROM player_intelligence_card
            WHERE personality_type IS NOT NULL
        """)
        for row in db.fetchall():
            code = row["personality_type"]
            assert code in self.VALID_CODES, f"Invalid personality code: {code}"

    def test_traits_in_range(self, db):
        """Competitiveness and coachability must be 0-100."""
        for trait in ["competitiveness", "coachability"]:
            db.execute(f"""
                SELECT count(*) as cnt FROM player_personality
                WHERE {trait} IS NOT NULL AND ({trait} < 0 OR {trait} > 100)
            """)
            assert db.fetchone()["cnt"] == 0, f"{trait} has out-of-range values"


# ── Market Data ──────────────────────────────────────────────────────────────

class TestMarketData:
    def test_market_value_eur_non_negative(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_market
            WHERE market_value_eur IS NOT NULL AND market_value_eur < 0
        """)
        assert db.fetchone()["cnt"] == 0

    def test_highest_gte_current(self, db):
        """Highest market value should be >= current market value."""
        db.execute("""
            SELECT count(*) as cnt FROM player_market
            WHERE market_value_eur IS NOT NULL
              AND highest_market_value_eur IS NOT NULL
              AND highest_market_value_eur < market_value_eur
        """)
        assert db.fetchone()["cnt"] == 0

    def test_mvt_in_range(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_market
            WHERE market_value_tier IS NOT NULL
              AND (market_value_tier < 1 OR market_value_tier > 5)
        """)
        assert db.fetchone()["cnt"] == 0


# ── Attribute Grades ─────────────────────────────────────────────────────────

class TestAttributeGrades:
    def test_no_negative_grades(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM attribute_grades
            WHERE (scout_grade IS NOT NULL AND scout_grade < 0)
               OR (stat_score IS NOT NULL AND stat_score < 0)
        """)
        assert db.fetchone()["cnt"] == 0

    def test_scout_grades_scale(self, db):
        """Scout grades should be on 0-20 scale (legacy) or 0-10 (new)."""
        db.execute("SELECT max(scout_grade) as mx FROM attribute_grades")
        mx = db.fetchone()["mx"]
        assert mx is not None
        assert mx <= 20, f"Scout grade {mx} exceeds maximum scale"

    def test_stat_scores_scale(self, db):
        db.execute("SELECT max(stat_score) as mx FROM attribute_grades")
        mx = db.fetchone()["mx"]
        assert mx is not None
        assert mx <= 20, f"Stat score {mx} exceeds maximum scale"


# ── Referential Integrity ────────────────────────────────────────────────────

class TestReferentialIntegrity:
    def test_profiles_reference_valid_people(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_profiles pp
            LEFT JOIN people p ON p.id = pp.person_id
            WHERE p.id IS NULL
        """)
        assert db.fetchone()["cnt"] == 0

    def test_personality_reference_valid_people(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_personality pp
            LEFT JOIN people p ON p.id = pp.person_id
            WHERE p.id IS NULL
        """)
        assert db.fetchone()["cnt"] == 0

    def test_market_reference_valid_people(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_market pm
            LEFT JOIN people p ON p.id = pm.person_id
            WHERE p.id IS NULL
        """)
        assert db.fetchone()["cnt"] == 0

    def test_attribute_grades_reference_valid_people(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM attribute_grades ag
            LEFT JOIN people p ON p.id = ag.player_id
            WHERE p.id IS NULL
        """)
        assert db.fetchone()["cnt"] == 0


# ── Position Data ────────────────────────────────────────────────────────────

class TestPositionData:
    VALID_POSITIONS = {"GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"}

    def test_positions_valid(self, db):
        db.execute("""
            SELECT DISTINCT position FROM player_profiles
            WHERE position IS NOT NULL
        """)
        for row in db.fetchall():
            assert row["position"] in self.VALID_POSITIONS, (
                f"Invalid position: {row['position']}"
            )
