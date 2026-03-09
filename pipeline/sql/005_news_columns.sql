-- 005_news_columns.sql — Add story_type to news_stories, sentiment to news_player_tags
ALTER TABLE news_stories ADD COLUMN IF NOT EXISTS story_type text;
ALTER TABLE news_player_tags ADD COLUMN IF NOT EXISTS sentiment text;

CREATE INDEX IF NOT EXISTS news_stories_source_idx ON news_stories(source);
CREATE INDEX IF NOT EXISTS news_stories_story_type_idx ON news_stories(story_type);
