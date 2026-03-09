-- 004_fbref_tables.sql — FBRef player season stats
-- Run in Supabase SQL Editor or via psql/psycopg2.

-- fbref_players: canonical FBRef player identity + link
CREATE TABLE IF NOT EXISTS fbref_players (
    fbref_id        text PRIMARY KEY,           -- FBRef player hash (from URL)
    name            text NOT NULL,
    nation          text,
    position        text,
    date_of_birth   date,
    fbref_url       text,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fbref_players_person_idx ON fbref_players(person_id);
CREATE INDEX IF NOT EXISTS fbref_players_name_idx ON fbref_players(name);

-- fbref_player_season_stats: per-player per-competition per-season stats
CREATE TABLE IF NOT EXISTS fbref_player_season_stats (
    id              bigserial PRIMARY KEY,
    fbref_id        text NOT NULL REFERENCES fbref_players(fbref_id) ON DELETE CASCADE,
    comp_id         int NOT NULL,
    comp_name       text,
    season          text NOT NULL,              -- e.g. "2023-2024"
    team            text,

    -- Standard stats
    age             text,
    minutes         int,
    matches_played  int,
    starts          int,
    goals           int,
    assists         int,
    penalties_made  int,
    penalties_att   int,
    yellow_cards    int,
    red_cards       int,

    -- Shooting
    shots           int,
    shots_on_target int,
    xg              numeric(6,2),
    npxg            numeric(6,2),
    xag             numeric(6,2),

    -- Passing
    passes_completed    int,
    passes_attempted    int,
    pass_pct            numeric(5,1),
    progressive_passes  int,
    key_passes          int,

    -- Defense
    tackles         int,
    tackles_won     int,
    interceptions   int,
    blocks          int,
    clearances      int,

    -- Possession
    touches         int,
    carries         int,
    progressive_carries int,
    successful_dribbles int,
    dribbles_attempted  int,

    -- GK stats (nullable)
    gk_saves        int,
    gk_save_pct     numeric(5,1),
    gk_clean_sheets int,
    gk_goals_against int,
    gk_psxg         numeric(6,2),

    synced_at       timestamptz DEFAULT now(),
    UNIQUE (fbref_id, comp_id, season)
);

CREATE INDEX IF NOT EXISTS fbref_pss_comp_season ON fbref_player_season_stats(comp_id, season);
CREATE INDEX IF NOT EXISTS fbref_pss_fbref_id ON fbref_player_season_stats(fbref_id);

-- fbref_sync_log: track what we've already scraped to enable incremental updates
CREATE TABLE IF NOT EXISTS fbref_sync_log (
    id              bigserial PRIMARY KEY,
    comp_id         int NOT NULL,
    season          text NOT NULL,
    stat_type       text NOT NULL,              -- 'standard', 'shooting', 'passing', etc.
    rows_fetched    int,
    synced_at       timestamptz DEFAULT now(),
    UNIQUE (comp_id, season, stat_type)
);

-- RLS
ALTER TABLE fbref_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE fbref_player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE fbref_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read fbref_players"
    ON fbref_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read fbref_player_season_stats"
    ON fbref_player_season_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read fbref_sync_log"
    ON fbref_sync_log FOR SELECT TO authenticated USING (true);
