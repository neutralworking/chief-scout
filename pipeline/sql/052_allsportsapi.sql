-- Migration 052: AllSportsAPI integration tables
-- Player registry + season stats from allsportsapi.com (1,019 leagues).
-- Targets leagues NOT covered by API-Football, especially thin OTP nations.

-- ── Player registry ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS allsportsapi_players (
    allsportsapi_id  bigint PRIMARY KEY,
    name             text NOT NULL,
    country          text,
    position_type    text,           -- Goalkeepers/Defenders/Midfielders/Forwards
    age              smallint,
    birthdate        date,
    team_name        text,
    team_key         integer,
    image_url        text,
    person_id        bigint REFERENCES people(id) ON DELETE SET NULL,
    fetched_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asa_players_person ON allsportsapi_players(person_id);
CREATE INDEX IF NOT EXISTS idx_asa_players_name ON allsportsapi_players(name);

-- ── Season stats ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS allsportsapi_player_stats (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    allsportsapi_id  bigint NOT NULL REFERENCES allsportsapi_players(allsportsapi_id),
    league_id        integer NOT NULL,
    league_name      text,
    season           text NOT NULL DEFAULT '2025',
    team_name        text,
    appearances      smallint DEFAULT 0,
    minutes          integer DEFAULT 0,
    rating           numeric(4,2),
    goals            smallint DEFAULT 0,
    assists          smallint DEFAULT 0,
    shots_total      smallint DEFAULT 0,
    passes_total     smallint DEFAULT 0,
    passes_accuracy  smallint DEFAULT 0,
    key_passes       smallint DEFAULT 0,
    tackles          smallint DEFAULT 0,
    blocks           smallint DEFAULT 0,
    interceptions    smallint DEFAULT 0,
    clearances       smallint DEFAULT 0,
    duels_total      smallint DEFAULT 0,
    duels_won        smallint DEFAULT 0,
    dribble_attempts smallint DEFAULT 0,
    dribble_success  smallint DEFAULT 0,
    fouls_committed  smallint DEFAULT 0,
    dispossessed     smallint DEFAULT 0,
    cards_yellow     smallint DEFAULT 0,
    cards_red        smallint DEFAULT 0,
    pen_scored       smallint DEFAULT 0,
    pen_missed       smallint DEFAULT 0,
    person_id        bigint REFERENCES people(id) ON DELETE SET NULL,
    fetched_at       timestamptz DEFAULT now(),
    UNIQUE (allsportsapi_id, league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_asa_stats_person ON allsportsapi_player_stats(person_id);
CREATE INDEX IF NOT EXISTS idx_asa_stats_league ON allsportsapi_player_stats(league_id, season);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE allsportsapi_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE allsportsapi_player_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "anon_read_asa_players" ON allsportsapi_players
        FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "service_all_asa_players" ON allsportsapi_players
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_asa_stats" ON allsportsapi_player_stats
        FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "service_all_asa_stats" ON allsportsapi_player_stats
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
