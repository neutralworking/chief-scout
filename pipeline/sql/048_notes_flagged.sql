-- 048_notes_flagged.sql — Add flag-for-rewrite to scouting notes
ALTER TABLE player_status ADD COLUMN IF NOT EXISTS notes_flagged boolean DEFAULT false;
