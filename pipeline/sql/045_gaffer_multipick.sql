-- 045_gaffer_multipick.sql — Multi-pick support for Gaffer questions
-- Adds pick_count to fc_questions (default 1) and relaxes the unique constraint
-- on fc_votes to allow multiple option picks per question.

-- Add pick_count column
ALTER TABLE fc_questions ADD COLUMN IF NOT EXISTS pick_count smallint DEFAULT 1;

-- Drop old unique constraint (one vote per user per question)
ALTER TABLE fc_votes DROP CONSTRAINT IF EXISTS fc_votes_user_id_question_id_key;

-- New unique: one vote per user per question per option (allows multi-pick)
CREATE UNIQUE INDEX IF NOT EXISTS fc_votes_user_question_option
  ON fc_votes(user_id, question_id, chosen_option_id);
