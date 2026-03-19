-- 034_api_football.sql — API-Football player season stats
-- Stores per-season aggregated stats from API-Football (api-sports.io)

CREATE TABLE IF NOT EXISTS api_football_players (
    id              BIGSERIAL PRIMARY KEY,
    api_football_id INTEGER NOT NULL,
    name            TEXT NOT NULL,
    person_id       BIGINT REFERENCES people(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (api_football_id)
);

CREATE TABLE IF NOT EXISTS api_football_player_stats (
    id                  BIGSERIAL PRIMARY KEY,
    api_football_id     INTEGER NOT NULL,
    person_id           BIGINT REFERENCES people(id) ON DELETE SET NULL,
    season              TEXT NOT NULL,
    league_id           INTEGER,
    league_name         TEXT,
    team_name           TEXT,
    appearances         INTEGER DEFAULT 0,
    minutes             INTEGER DEFAULT 0,
    rating              NUMERIC(4,2),
    -- Attacking
    goals               INTEGER DEFAULT 0,
    assists             INTEGER DEFAULT 0,
    shots_total         INTEGER DEFAULT 0,
    shots_on            INTEGER DEFAULT 0,
    -- Passing
    passes_total        INTEGER DEFAULT 0,
    passes_key          INTEGER DEFAULT 0,
    passes_accuracy     NUMERIC(5,2),
    -- Defending
    tackles_total       INTEGER DEFAULT 0,
    blocks              INTEGER DEFAULT 0,
    interceptions       INTEGER DEFAULT 0,
    -- Duels
    duels_total         INTEGER DEFAULT 0,
    duels_won           INTEGER DEFAULT 0,
    -- Dribbling
    dribbles_attempted  INTEGER DEFAULT 0,
    dribbles_success    INTEGER DEFAULT 0,
    -- Discipline
    fouls_drawn         INTEGER DEFAULT 0,
    fouls_committed     INTEGER DEFAULT 0,
    cards_yellow        INTEGER DEFAULT 0,
    cards_red           INTEGER DEFAULT 0,
    -- Penalties
    penalties_scored    INTEGER DEFAULT 0,
    penalties_missed    INTEGER DEFAULT 0,
    -- Metadata
    fetched_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (api_football_id, season, league_id)
);

-- Index for person_id joins (grade computation)
CREATE INDEX IF NOT EXISTS idx_afps_person_id ON api_football_player_stats(person_id);
CREATE INDEX IF NOT EXISTS idx_afps_season ON api_football_player_stats(season);

-- Add api_football to player_id_links source options (informational — no enum constraint)
COMMENT ON TABLE api_football_players IS 'API-Football player registry with person_id links';
COMMENT ON TABLE api_football_player_stats IS 'Per-season stats from API-Football Pro (api-sports.io)';
