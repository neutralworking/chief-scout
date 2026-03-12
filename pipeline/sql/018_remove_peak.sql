-- 018_remove_peak.sql — Remove peak column from player_profiles
-- Run in Supabase SQL Editor (Dashboard -> SQL Editor).

-- Drop the peak column
ALTER TABLE player_profiles DROP COLUMN IF EXISTS peak;

-- Recreate views that reference player_profiles (they don't select peak, but
-- dropping the column may invalidate cached plans)

-- player_intelligence_card view is already correct (015 version doesn't select peak)
-- personality_style view is already correct (doesn't reference peak)
