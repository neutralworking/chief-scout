-- Migration 029: Player trait severity scores
-- Stores per-player behavioral/tactical traits with severity (1-10) and source.
-- Used by the four-pillar assessment system (Tactical pillar → Trait Profile sub-score).

CREATE TABLE IF NOT EXISTS player_trait_scores (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  trait TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('style', 'physical', 'tactical', 'behavioral')),
  severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 10),
  source TEXT NOT NULL DEFAULT 'inferred',  -- 'inferred' (from stats), 'scout', 'editor'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, trait, source)
);

CREATE INDEX IF NOT EXISTS idx_trait_scores_player ON player_trait_scores(player_id);
CREATE INDEX IF NOT EXISTS idx_trait_scores_trait ON player_trait_scores(trait);
CREATE INDEX IF NOT EXISTS idx_trait_scores_category ON player_trait_scores(category);

-- Add availability_score and durability_score to career_metrics
ALTER TABLE career_metrics
  ADD COLUMN IF NOT EXISTS availability_score SMALLINT,
  ADD COLUMN IF NOT EXISTS durability_score SMALLINT;

COMMENT ON TABLE player_trait_scores IS 'Per-player trait severities for four-pillar tactical assessment';
COMMENT ON COLUMN player_trait_scores.severity IS '1=minor, 5=moderate, 10=defining characteristic';
COMMENT ON COLUMN player_trait_scores.source IS 'How the trait was determined: inferred (stats pipeline), scout (manual), editor (UI)';
