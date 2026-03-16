-- 033_kaggle_tables.sql — Tables for Kaggle dataset ingestion
-- Datasets:
--   1. European Top Leagues Player Stats 25-26
--   2. Football Transfer Value Intelligence 2024
--   3. FIFA & Football Complete Dataset 1930-2022
--   4. Premier League 2024-2025 Data
--   5. European Football Injuries 2020-2025

-- ─── 1. Kaggle European League Stats ────────────────────────────────────────
-- Source: kaanyorgun/european-top-leagues-player-stats-25-26
-- Per-player season stats across top 5 European leagues (FBRef-sourced)
CREATE TABLE IF NOT EXISTS kaggle_euro_league_stats (
    id              bigserial PRIMARY KEY,
    player_name     text NOT NULL,
    nation          text,
    position        text,
    squad           text,
    league          text,
    season          text DEFAULT '2025-2026',
    age             integer,
    born            integer,
    matches_played  integer,
    starts          integer,
    minutes         integer,
    goals           integer,
    assists         integer,
    penalties_made  integer,
    penalties_att   integer,
    yellow_cards    integer,
    red_cards       integer,
    xg              real,
    npxg            real,
    xa              real,
    progressive_carries integer,
    progressive_passes  integer,
    progressive_passes_received integer,
    goals_per90     real,
    assists_per90   real,
    xg_per90        real,
    xa_per90        real,
    -- Extra columns for flexibility (datasets vary)
    raw_json        jsonb,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (player_name, squad, league, season)
);
CREATE INDEX IF NOT EXISTS idx_kaggle_euro_person ON kaggle_euro_league_stats(person_id);
CREATE INDEX IF NOT EXISTS idx_kaggle_euro_league ON kaggle_euro_league_stats(league);

-- ─── 2. Kaggle Transfer Values ──────────────────────────────────────────────
-- Source: kanchana1990/football-transfer-value-intelligence-2024
-- Player transfer valuations with biographical + performance context
CREATE TABLE IF NOT EXISTS kaggle_transfer_values (
    id              bigserial PRIMARY KEY,
    player_name     text NOT NULL,
    club            text,
    league          text,
    nation          text,
    position        text,
    age             integer,
    market_value_eur bigint,
    highest_value_eur bigint,
    transfer_fee_eur bigint,
    contract_expiry text,
    joined_date     text,
    agent           text,
    outfitter       text,
    -- Performance context
    goals           integer,
    assists         integer,
    matches         integer,
    minutes         integer,
    -- Flexibility
    raw_json        jsonb,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (player_name, club, league)
);
CREATE INDEX IF NOT EXISTS idx_kaggle_transfer_person ON kaggle_transfer_values(person_id);

-- ─── 3. FIFA Historical Matches ─────────────────────────────────────────────
-- Source: zkskhurram/fifa-and-football-complete-dataset-19302022
-- International match results + FIFA rankings (1930-2022)
CREATE TABLE IF NOT EXISTS kaggle_fifa_matches (
    id              bigserial PRIMARY KEY,
    date            date,
    home_team       text NOT NULL,
    away_team       text NOT NULL,
    home_score      integer,
    away_score      integer,
    tournament      text,
    city            text,
    country         text,
    neutral         boolean,
    home_xg         real,
    away_xg         real,
    home_penalty    integer,
    away_penalty    integer,
    raw_json        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (date, home_team, away_team)
);
CREATE INDEX IF NOT EXISTS idx_kaggle_fifa_date ON kaggle_fifa_matches(date);
CREATE INDEX IF NOT EXISTS idx_kaggle_fifa_tournament ON kaggle_fifa_matches(tournament);

CREATE TABLE IF NOT EXISTS kaggle_fifa_rankings (
    id              bigserial PRIMARY KEY,
    rank            integer NOT NULL,
    country_full    text NOT NULL,
    country_abrv    text,
    total_points    real,
    previous_points real,
    rank_change     integer,
    confederation   text,
    rank_date       date,
    raw_json        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (country_full, rank_date)
);

-- ─── 4. Kaggle Premier League Stats ─────────────────────────────────────────
-- Source: furkanark/premier-league-2024-2025-data
-- PL-specific player and/or match data for 2024-25 season
CREATE TABLE IF NOT EXISTS kaggle_pl_stats (
    id              bigserial PRIMARY KEY,
    player_name     text,
    squad           text,
    position        text,
    nation          text,
    age             integer,
    matches_played  integer,
    starts          integer,
    minutes         integer,
    goals           integer,
    assists         integer,
    yellow_cards    integer,
    red_cards       integer,
    xg              real,
    xa              real,
    npxg            real,
    progressive_carries integer,
    progressive_passes  integer,
    tackles         integer,
    interceptions   integer,
    blocks          integer,
    sca             real,
    gca             real,
    pass_completion real,
    aerial_won      integer,
    aerial_lost     integer,
    -- Match-level columns (if match data)
    match_date      date,
    home_team       text,
    away_team       text,
    home_score      integer,
    away_score      integer,
    -- Flexibility
    raw_json        jsonb,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    season          text DEFAULT '2024-2025',
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kaggle_pl_person ON kaggle_pl_stats(person_id);

-- ─── 5. European Football Injuries ──────────────────────────────────────────
-- Source: sananmuzaffarov/european-football-injuries-2020-2025
-- Player injury records across European leagues
CREATE TABLE IF NOT EXISTS kaggle_injuries (
    id              bigserial PRIMARY KEY,
    player_name     text NOT NULL,
    club            text,
    league          text,
    nation          text,
    position        text,
    age             integer,
    injury_type     text,
    injury_area     text,
    severity        text,
    days_missed     integer,
    games_missed    integer,
    season          text,
    date_from       date,
    date_until      date,
    -- Flexibility
    raw_json        jsonb,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kaggle_injuries_person ON kaggle_injuries(person_id);
CREATE INDEX IF NOT EXISTS idx_kaggle_injuries_type ON kaggle_injuries(injury_type);
CREATE INDEX IF NOT EXISTS idx_kaggle_injuries_season ON kaggle_injuries(season);

-- ─── Injury aggregates view ─────────────────────────────────────────────────
-- Pre-computed injury stats per player for scouting tags
CREATE OR REPLACE VIEW player_injury_summary AS
SELECT
    person_id,
    count(*) AS total_injuries,
    sum(days_missed) AS total_days_missed,
    sum(games_missed) AS total_games_missed,
    avg(days_missed)::real AS avg_days_per_injury,
    max(days_missed) AS worst_injury_days,
    count(DISTINCT injury_type) AS injury_types,
    count(DISTINCT season) AS seasons_with_injury,
    max(date_until) AS last_injury_date,
    CASE
        WHEN count(*) >= 8 THEN 'injury_prone'
        WHEN count(*) >= 5 THEN 'moderate_risk'
        WHEN count(*) <= 2 AND sum(days_missed) < 30 THEN 'iron_man'
        ELSE 'normal'
    END AS durability_tag
FROM kaggle_injuries
WHERE person_id IS NOT NULL
GROUP BY person_id;
