-- 038_earned_archetypes.sql
-- Add earned archetype system alongside existing skillset (archetype column)
--
-- Architecture:
--   player_profiles.archetype = skillset (compound model, e.g. "Striker-Sprinter") — UNCHANGED
--   player_profiles.earned_archetype = earned identity label (e.g. "Hitman", "Maestro", "Rock")
--   player_profiles.archetype_tier = elite/established/aspiring/unclassified
--   player_profiles.legacy_tag = Icon/Legendary/Wonderkid/Veteran
--   player_profiles.behavioral_tag = Ironclad

-- New columns
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS earned_archetype text,
  ADD COLUMN IF NOT EXISTS archetype_tier text DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS legacy_tag text,
  ADD COLUMN IF NOT EXISTS behavioral_tag text;

-- Constraints
ALTER TABLE player_profiles
  ADD CONSTRAINT player_profiles_archetype_tier_check
  CHECK (archetype_tier IN ('elite', 'established', 'aspiring', 'unclassified'));

-- Index for filtering by archetype
CREATE INDEX IF NOT EXISTS idx_player_profiles_earned_archetype
  ON player_profiles (earned_archetype) WHERE earned_archetype IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_profiles_archetype_tier
  ON player_profiles (archetype_tier) WHERE archetype_tier != 'unclassified';

-- Comment for clarity
COMMENT ON COLUMN player_profiles.archetype IS 'Skillset: compound playing model (e.g. Striker-Sprinter). Historically named archetype.';
COMMENT ON COLUMN player_profiles.earned_archetype IS 'Earned identity label (e.g. Hitman, Maestro, Rock). Stat+personality gated.';
COMMENT ON COLUMN player_profiles.archetype_tier IS 'Tier: elite, established, aspiring, unclassified';
COMMENT ON COLUMN player_profiles.legacy_tag IS 'Career modifier: Icon, Legendary, Wonderkid, Veteran';
COMMENT ON COLUMN player_profiles.behavioral_tag IS 'Behavioral modifier: Ironclad';
