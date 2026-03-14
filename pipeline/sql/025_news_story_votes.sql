-- Migration 025: News story voting (sentiment reactions)
-- Users can react to news stories with sentiment icons

CREATE TABLE IF NOT EXISTS news_story_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES news_stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES fc_users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('fire', 'love', 'gutted', 'shocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_news_votes_story ON news_story_votes(story_id);
CREATE INDEX IF NOT EXISTS idx_news_votes_user ON news_story_votes(user_id);

-- Aggregate view for quick vote counts per story
CREATE OR REPLACE VIEW news_story_vote_counts AS
SELECT
  story_id,
  COUNT(*) FILTER (WHERE reaction = 'fire') AS fire_count,
  COUNT(*) FILTER (WHERE reaction = 'love') AS love_count,
  COUNT(*) FILTER (WHERE reaction = 'gutted') AS gutted_count,
  COUNT(*) FILTER (WHERE reaction = 'shocked') AS shocked_count,
  COUNT(*) AS total_count
FROM news_story_votes
GROUP BY story_id;

-- RLS: anyone can read votes, authenticated can insert/update own
ALTER TABLE news_story_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read news votes"
  ON news_story_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own votes"
  ON news_story_votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own votes"
  ON news_story_votes FOR UPDATE
  USING (true)
  WITH CHECK (true);
