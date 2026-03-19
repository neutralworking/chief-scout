-- 037_career_xp_v2.sql — Career XP v2: categories, rarity, season tracking, XP levels
-- Extends player_xp with event taxonomy and adds xp_level to player_profiles.

-- New columns on player_xp
ALTER TABLE player_xp ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE player_xp ADD COLUMN IF NOT EXISTS rarity text DEFAULT 'common';
ALTER TABLE player_xp ADD COLUMN IF NOT EXISTS season text;

-- XP level on player_profiles (BG3-style 1-12)
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS xp_level smallint DEFAULT 1;

-- Legacy score (0-99) — combined career legacy derived from XP milestones
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS legacy_score smallint DEFAULT 0;

-- Indexes for category/rarity queries
CREATE INDEX IF NOT EXISTS idx_player_xp_category ON player_xp(person_id, category);
CREATE INDEX IF NOT EXISTS idx_player_xp_rarity ON player_xp(rarity);
