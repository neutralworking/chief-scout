-- 022_choices_dimension_mappings.sql — Add dimension weights to options + tier to questions
-- Supports Tier 2 scenario-based questions that map to footballing identity dimensions.

-- Add dimension weights JSONB column to options
ALTER TABLE fc_options ADD COLUMN IF NOT EXISTS dimension_weights jsonb;

-- Add tier column to questions (1=gateway polls, 2=identity scenarios)
ALTER TABLE fc_questions ADD COLUMN IF NOT EXISTS tier smallint DEFAULT 1;

-- Add 5 new categories for Tier 2 questions
INSERT INTO fc_categories (slug, name, description, icon, sort_order) VALUES
    ('philosophy', 'Football Philosophy', 'How do you see the beautiful game?', '🧠', 9),
    ('squad-building', 'Squad Building', 'The DOF decisions that shape a club', '🏗️', 10),
    ('pressure', 'Pressure Moments', 'When everything is on the line', '🔥', 11),
    ('scouting', 'Scouting Eye', 'Find the talent others miss', '🔭', 12),
    ('manager', 'Manager Mind', 'The decisions that define careers', '📣', 13)
ON CONFLICT (slug) DO NOTHING;
