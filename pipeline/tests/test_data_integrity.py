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


# ── Identity Data ───────────────────────────────────────────────────────────

class TestIdentityData:
    """Validate people table data quality."""

    def test_no_empty_names(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM people
            WHERE name IS NULL OR TRIM(name) = ''
        """)
        assert db.fetchone()["cnt"] == 0, "Found players with empty names"

    def test_no_garbage_names(self, db):
        """Names should not contain code/markup artifacts."""
        db.execute("""
            SELECT count(*) as cnt FROM people
            WHERE name LIKE '```%%'
               OR name LIKE '%%{%%}%%'
               OR name LIKE '%%[%%]%%'
               OR LENGTH(name) < 3
        """)
        assert db.fetchone()["cnt"] == 0, "Found garbage player names"

    def test_no_whitespace_names(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM people
            WHERE name != TRIM(name) OR name LIKE '%%  %%'
        """)
        assert db.fetchone()["cnt"] == 0, "Found names with whitespace issues"

    def test_dob_in_range(self, db):
        """Active players should have DOB between 1960 and 2012."""
        db.execute("""
            SELECT count(*) as cnt FROM people
            WHERE active = true AND date_of_birth IS NOT NULL
              AND (date_of_birth < '1960-01-01' OR date_of_birth > '2012-01-01')
        """)
        assert db.fetchone()["cnt"] == 0, "Found players with DOB outside valid range"

    def test_height_in_range(self, db):
        """Height should be 150-215cm for active players."""
        db.execute("""
            SELECT count(*) as cnt FROM people
            WHERE active = true AND height_cm IS NOT NULL
              AND (height_cm < 150 OR height_cm > 215)
        """)
        assert db.fetchone()["cnt"] == 0, "Found players with height outside 150-215cm"

    def test_preferred_foot_valid(self, db):
        db.execute("""
            SELECT DISTINCT preferred_foot FROM people
            WHERE preferred_foot IS NOT NULL
        """)
        valid = {"Left", "Right", "Both"}
        for row in db.fetchall():
            assert row["preferred_foot"] in valid, (
                f"Invalid foot: {row['preferred_foot']}"
            )

    def test_no_accent_duplicates_at_same_club(self, db):
        """No two active players at the same club should have accent-only name differences."""
        db.execute("""
            SELECT club_id, LOWER(TRANSLATE(name,
                'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
                'aaaaaaeeeeiiiioooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'
            )) as norm_name, count(*) as cnt
            FROM people
            WHERE active = true AND club_id IS NOT NULL
            GROUP BY club_id, norm_name
            HAVING count(*) > 1
            LIMIT 10
        """)
        dupes = db.fetchall()
        assert len(dupes) == 0, f"Accent duplicates at same club: {dupes}"


# ── Status Data ─────────────────────────────────────────────────────────────

class TestStatusData:
    """Validate player_status enum values and data quality."""

    VALID_PURSUIT = {"Pass", "Watch", "Interested", "Scout Further", "Monitor", "Priority"}
    VALID_FITNESS = {"Fully Fit", "Minor Knock", "Injured", "Long-Term"}
    VALID_MENTAL = {"Sharp", "Confident", "Low", "Fragile"}
    VALID_DISCIPLINARY = {"Clear", "Cautioned", "Suspended", "Volatile"}
    VALID_TACTICAL = {"Adaptable", "Specialist", "Limited", "Versatile"}
    VALID_CONTRACT = {"Long-Term", "One Year Left", "Six Months", "Expired", "Extension Talks"}

    def test_pursuit_status_valid(self, db):
        db.execute("""
            SELECT DISTINCT pursuit_status FROM player_status
            WHERE pursuit_status IS NOT NULL
        """)
        for row in db.fetchall():
            assert row["pursuit_status"] in self.VALID_PURSUIT, (
                f"Invalid pursuit_status: {row['pursuit_status']}"
            )

    def test_fitness_tag_valid(self, db):
        db.execute("""
            SELECT DISTINCT fitness_tag FROM player_status
            WHERE fitness_tag IS NOT NULL
        """)
        for row in db.fetchall():
            assert row["fitness_tag"] in self.VALID_FITNESS, (
                f"Invalid fitness_tag: {row['fitness_tag']}"
            )

    def test_mental_tag_valid(self, db):
        db.execute("""
            SELECT DISTINCT mental_tag FROM player_status
            WHERE mental_tag IS NOT NULL
        """)
        for row in db.fetchall():
            assert row["mental_tag"] in self.VALID_MENTAL, (
                f"Invalid mental_tag: {row['mental_tag']}"
            )

    def test_disciplinary_tag_valid(self, db):
        db.execute("""
            SELECT DISTINCT disciplinary_tag FROM player_status
            WHERE disciplinary_tag IS NOT NULL
        """)
        for row in db.fetchall():
            assert row["disciplinary_tag"] in self.VALID_DISCIPLINARY, (
                f"Invalid disciplinary_tag: {row['disciplinary_tag']}"
            )

    def test_tactical_tag_valid(self, db):
        db.execute("""
            SELECT DISTINCT tactical_tag FROM player_status
            WHERE tactical_tag IS NOT NULL
        """)
        for row in db.fetchall():
            assert row["tactical_tag"] in self.VALID_TACTICAL, (
                f"Invalid tactical_tag: {row['tactical_tag']}"
            )

    def test_contract_tag_valid(self, db):
        db.execute("""
            SELECT DISTINCT contract_tag FROM player_status
            WHERE contract_tag IS NOT NULL
        """)
        for row in db.fetchall():
            assert row["contract_tag"] in self.VALID_CONTRACT, (
                f"Invalid contract_tag: {row['contract_tag']}"
            )

    def test_no_garbage_scouting_notes(self, db):
        """Scouting notes should not contain code artifacts."""
        db.execute("""
            SELECT count(*) as cnt FROM player_status
            WHERE scouting_notes LIKE '```%%'
               OR scouting_notes LIKE '%%Tactical Attributes%%'
               OR scouting_notes LIKE '---%%'
        """)
        assert db.fetchone()["cnt"] == 0, "Found garbage scouting notes"


# ── Level Sanity ────────────────────────────────────────────────────────────

class TestLevelSanity:
    """Validate player level ranges and consistency."""

    def test_levels_in_range(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_profiles
            WHERE level IS NOT NULL AND (level < 1 OR level > 99)
        """)
        assert db.fetchone()["cnt"] == 0, "Found levels outside 1-99"

    def test_peak_in_range(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_profiles
            WHERE peak IS NOT NULL AND (peak < 1 OR peak > 99)
        """)
        assert db.fetchone()["cnt"] == 0, "Found peak outside 1-99"

    def test_overall_in_range(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_profiles
            WHERE overall IS NOT NULL AND (overall < 1 OR overall > 99)
        """)
        assert db.fetchone()["cnt"] == 0, "Found overall outside 1-99"

    def test_archetype_confidence_valid(self, db):
        db.execute("""
            SELECT DISTINCT archetype_confidence FROM player_profiles
            WHERE archetype_confidence IS NOT NULL
        """)
        valid = {"high", "medium", "low"}
        for row in db.fetchall():
            assert row["archetype_confidence"] in valid, (
                f"Invalid archetype_confidence: {row['archetype_confidence']}"
            )


# ── Cross-Table Coverage ────────────────────────────────────────────────────

class TestCrossTableCoverage:
    """Ensure feature tables reference valid people and check coverage."""

    def test_status_references_valid_people(self, db):
        db.execute("""
            SELECT count(*) as cnt FROM player_status ps
            LEFT JOIN people p ON p.id = ps.person_id
            WHERE p.id IS NULL
        """)
        assert db.fetchone()["cnt"] == 0

    def test_no_duplicate_profiles(self, db):
        """Each person should have at most one profile."""
        db.execute("""
            SELECT person_id, count(*) as cnt FROM player_profiles
            GROUP BY person_id HAVING count(*) > 1
        """)
        dupes = db.fetchall()
        assert len(dupes) == 0, f"Duplicate profiles: {dupes}"

    def test_no_duplicate_personalities(self, db):
        db.execute("""
            SELECT person_id, count(*) as cnt FROM player_personality
            GROUP BY person_id HAVING count(*) > 1
        """)
        dupes = db.fetchall()
        assert len(dupes) == 0, f"Duplicate personalities: {dupes}"

    def test_no_duplicate_market(self, db):
        db.execute("""
            SELECT person_id, count(*) as cnt FROM player_market
            GROUP BY person_id HAVING count(*) > 1
        """)
        dupes = db.fetchall()
        assert len(dupes) == 0, f"Duplicate market records: {dupes}"

    def test_no_duplicate_status(self, db):
        db.execute("""
            SELECT person_id, count(*) as cnt FROM player_status
            GROUP BY person_id HAVING count(*) > 1
        """)
        dupes = db.fetchall()
        assert len(dupes) == 0, f"Duplicate status records: {dupes}"
