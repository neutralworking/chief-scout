-- 003_news_statsbomb_understat.sql — Migration 003 for Chief Scout
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).
-- Adds three new data layers:
--   • StatsBomb open data  (sb_competitions, sb_matches, sb_events, sb_lineups)
--   • Understat xG data    (understat_matches, understat_player_match_stats)
--   • News ingestion layer (news_stories, news_player_tags)

-- ── StatsBomb: open data ─────────────────────────────────────────────────────

-- sb_competitions: one row per competition+season available in StatsBomb open data
CREATE TABLE IF NOT EXISTS sb_competitions (
  competition_id       int NOT NULL,
  competition_name     text NOT NULL,
  country_name         text,
  competition_gender   text,
  season_id            int NOT NULL,
  season_name          text,
  synced_at            timestamptz DEFAULT now(),
  PRIMARY KEY (competition_id, season_id)
);

-- sb_matches: match metadata
CREATE TABLE IF NOT EXISTS sb_matches (
  match_id             int PRIMARY KEY,
  competition_id       int NOT NULL,
  season_id            int NOT NULL,
  match_date           date,
  kick_off             time,
  home_team_id         int,
  home_team_name       text,
  away_team_id         int,
  away_team_name       text,
  home_score           int,
  away_score           int,
  match_status         text,
  stadium              text,
  referee              text,
  synced_at            timestamptz DEFAULT now(),
  FOREIGN KEY (competition_id, season_id) REFERENCES sb_competitions(competition_id, season_id)
);

-- sb_events: one row per event, key fields extracted + full raw JSONB
CREATE TABLE IF NOT EXISTS sb_events (
  id                   uuid PRIMARY KEY,
  match_id             int NOT NULL REFERENCES sb_matches(match_id) ON DELETE CASCADE,
  index                int,
  period               int,
  minute               int,
  second               int,
  type                 text,
  team                 text,
  player               text,
  position             text,
  location             float[],
  under_pressure       boolean,
  raw                  jsonb NOT NULL,
  UNIQUE (match_id, index)
);

CREATE INDEX IF NOT EXISTS sb_events_match_id_idx ON sb_events(match_id);
CREATE INDEX IF NOT EXISTS sb_events_type_idx ON sb_events(type);
CREATE INDEX IF NOT EXISTS sb_events_player_idx ON sb_events(player);

-- sb_lineups: players in each match
CREATE TABLE IF NOT EXISTS sb_lineups (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id             int NOT NULL REFERENCES sb_matches(match_id) ON DELETE CASCADE,
  team_id              int,
  team_name            text,
  player_id            int,
  player_name          text,
  jersey_number        int,
  country              text,
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS sb_lineups_player_idx ON sb_lineups(player_name);

-- ── Understat: xG data ───────────────────────────────────────────────────────

-- understat_matches: match-level xG data
CREATE TABLE IF NOT EXISTS understat_matches (
  id                   int PRIMARY KEY,
  league               text NOT NULL,
  season               text NOT NULL,
  match_date           timestamptz,
  home_team            text,
  away_team            text,
  home_goals           int,
  away_goals           int,
  home_xg              numeric(5,3),
  away_xg              numeric(5,3),
  forecast_w           numeric(5,3),
  forecast_d           numeric(5,3),
  forecast_l           numeric(5,3),
  synced_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS understat_matches_league_season ON understat_matches(league, season);

-- understat_player_match_stats: player stats per match
CREATE TABLE IF NOT EXISTS understat_player_match_stats (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id             int NOT NULL REFERENCES understat_matches(id) ON DELETE CASCADE,
  player_id            int,
  player_name          text,
  team                 text,
  h_a                  text,        -- 'h' or 'a'
  position             text,
  time                 int,         -- minutes played
  goals                int,
  assists              int,
  shots                int,
  key_passes           int,
  yellow               int,
  red                  int,
  xg                   numeric(5,3),
  xa                   numeric(5,3),
  npg                  int,         -- non-penalty goals
  npxa                 numeric(5,3),
  xgchain              numeric(5,3),
  xgbuildup            numeric(5,3),
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS understat_pms_player_idx ON understat_player_match_stats(player_name);
CREATE INDEX IF NOT EXISTS understat_pms_match_idx ON understat_player_match_stats(match_id);

-- ── News Layer ───────────────────────────────────────────────────────────────

-- news_stories: ingested articles awaiting and post Gemini processing
CREATE TABLE IF NOT EXISTS news_stories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline      text NOT NULL,
  summary       text,
  body          text,
  source        text,
  url           text UNIQUE,
  published_at  timestamptz,
  ingested_at   timestamptz DEFAULT now(),
  processed     boolean DEFAULT false,
  gemini_raw    jsonb
);

CREATE INDEX IF NOT EXISTS news_stories_processed_idx ON news_stories(processed);
CREATE INDEX IF NOT EXISTS news_stories_published_idx ON news_stories(published_at DESC);

-- news_player_tags: links stories to players identified by Gemini
CREATE TABLE IF NOT EXISTS news_player_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id      uuid REFERENCES news_stories(id) ON DELETE CASCADE,
  player_id     uuid REFERENCES players(id) ON DELETE CASCADE,
  story_type    text,
  confidence    float,
  UNIQUE (story_id, player_id)
);

CREATE INDEX IF NOT EXISTS news_player_tags_player_idx ON news_player_tags(player_id);

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE sb_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE understat_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE understat_player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_player_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read sb_competitions"
    ON sb_competitions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read sb_matches"
    ON sb_matches FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read sb_events"
    ON sb_events FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read sb_lineups"
    ON sb_lineups FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read understat_matches"
    ON understat_matches FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read understat_player_match_stats"
    ON understat_player_match_stats FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read news_stories"
    ON news_stories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read news_player_tags"
    ON news_player_tags FOR SELECT
    TO authenticated
    USING (true);
