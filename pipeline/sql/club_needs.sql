-- Club Needs & Settings
-- Tracks the Director's positional priorities and club configuration.

CREATE TABLE IF NOT EXISTS club_needs (
  id SERIAL PRIMARY KEY,
  position TEXT NOT NULL CHECK (position IN ('GK','WD','CD','DM','CM','WM','AM','WF','CF')),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),  -- 5 = desperate need
  min_mvt INTEGER DEFAULT 3,  -- minimum market value tier acceptable
  preferred_archetype TEXT,
  preferred_foot TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed with defaults
INSERT INTO club_settings (key, value) VALUES
  ('club_name', 'My Club'),
  ('division', 'Premier League'),
  ('transfer_budget_meur', '50'),
  ('wage_budget_weekly', '500000')
ON CONFLICT (key) DO NOTHING;
