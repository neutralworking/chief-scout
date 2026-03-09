-- Migration 006: Update attribute_grades unique constraint to include source
-- Required for multi-source attribute scores (eafc_inferred, understat, statsbomb)

-- Drop the old unique constraint (player_id, attribute)
ALTER TABLE attribute_grades
    DROP CONSTRAINT IF EXISTS attribute_grades_player_id_attribute_key;

-- Backfill NULL source values to 'eafc_inferred' so the new constraint works
UPDATE attribute_grades SET source = 'eafc_inferred' WHERE source IS NULL;

-- Make source NOT NULL going forward
ALTER TABLE attribute_grades ALTER COLUMN source SET NOT NULL;
ALTER TABLE attribute_grades ALTER COLUMN source SET DEFAULT 'eafc_inferred';

-- Add new unique constraint including source
ALTER TABLE attribute_grades
    ADD CONSTRAINT attribute_grades_player_attribute_source_key
    UNIQUE (player_id, attribute, source);
