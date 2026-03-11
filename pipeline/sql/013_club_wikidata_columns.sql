-- 013_club_wikidata_columns.sql — Add Wikidata enrichment columns to clubs
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).
-- Adds columns for Wikidata-sourced club metadata: QID, league, stadium, etc.

-- ── New columns on clubs ─────────────────────────────────────────────────────

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS wikidata_id        TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS short_name         TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS league_name        TEXT;          -- current league/competition name
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS league_wikidata_id TEXT;          -- league QID for cross-referencing
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS league_level       SMALLINT;     -- pyramid level (1=top flight, 2=second tier, etc.)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium            TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium_capacity   INT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS founded_year       SMALLINT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS logo_url           TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS country            TEXT;          -- denormalized country name from Wikidata
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clubs_wikidata ON clubs(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_clubs_league   ON clubs(league_name);
CREATE INDEX IF NOT EXISTS idx_clubs_nation   ON clubs(nation_id);

-- ── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION clubs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clubs_updated_at_trigger ON clubs;
CREATE TRIGGER clubs_updated_at_trigger
  BEFORE UPDATE ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION clubs_updated_at();
