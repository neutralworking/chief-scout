-- Migration 044: Fixture Predictions
-- Adds prediction columns to fixtures + support for international/continental competitions.

-- ── Competition type (domestic / continental / international) ──────────────────
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS competition_type TEXT DEFAULT 'domestic';
COMMENT ON COLUMN fixtures.competition_type IS 'domestic | continental | international';

-- ── Nation references for international fixtures ──────────────────────────────
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS home_nation_id BIGINT REFERENCES nations(id);
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS away_nation_id BIGINT REFERENCES nations(id);

-- ── Cached prediction columns ─────────────────────────────────────────────────
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS predicted_home_goals NUMERIC(4,2);
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS predicted_away_goals NUMERIC(4,2);
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS home_win_prob NUMERIC(4,3);
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS draw_prob NUMERIC(4,3);
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS away_win_prob NUMERIC(4,3);
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS prediction_confidence NUMERIC(3,2);
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS predictions_computed_at TIMESTAMPTZ;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_type ON fixtures(competition_type);
CREATE INDEX IF NOT EXISTS idx_fixtures_home_nation ON fixtures(home_nation_id) WHERE home_nation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fixtures_away_nation ON fixtures(away_nation_id) WHERE away_nation_id IS NOT NULL;
