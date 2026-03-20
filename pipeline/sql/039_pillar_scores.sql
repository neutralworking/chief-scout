-- Migration 039: Add missing pillar score columns to player_profiles
-- technical_score and physical_score already exist

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS tactical_score smallint,
  ADD COLUMN IF NOT EXISTS mental_score smallint,
  ADD COLUMN IF NOT EXISTS overall_pillar_score smallint,
  ADD COLUMN IF NOT EXISTS pillar_updated_at timestamptz;

COMMENT ON COLUMN player_profiles.tactical_score IS 'Precomputed tactical pillar score (0-100)';
COMMENT ON COLUMN player_profiles.mental_score IS 'Precomputed mental pillar score (0-100)';
COMMENT ON COLUMN player_profiles.overall_pillar_score IS 'Average of 4 pillar scores (0-100)';
COMMENT ON COLUMN player_profiles.pillar_updated_at IS 'Last time pillar scores were batch-computed';
