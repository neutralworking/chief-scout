-- 038_scout_insights.sql — Pre-computed scout insights (hidden gems, stat mismatches, etc.)
CREATE TABLE IF NOT EXISTS scout_insights (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,       -- 'hidden_gem' (future: 'xg_outlier', 'stat_mismatch')
  gem_score NUMERIC(5,2) NOT NULL,
  headline TEXT,                    -- "Clinical finisher flying under the radar"
  prose TEXT,                       -- Gemini-generated 2-3 sentence scout commentary
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  season TEXT NOT NULL DEFAULT '2025',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(person_id, insight_type, season)
);
CREATE INDEX IF NOT EXISTS idx_scout_insights_gem ON scout_insights(gem_score DESC);
CREATE INDEX IF NOT EXISTS idx_scout_insights_person ON scout_insights(person_id);
