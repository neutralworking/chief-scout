-- 039_club_ratings.sql — Club Power Ratings (4-pillar composite)
-- xG diff (35%) + squad value (25%) + defensive intensity (20%) + buildup quality (20%)

CREATE TABLE IF NOT EXISTS club_ratings (
    id              SERIAL PRIMARY KEY,
    club_id         INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    season          TEXT NOT NULL DEFAULT '2025',

    -- Composite
    power_rating    NUMERIC(5,2) NOT NULL,  -- 0-100
    projected_gd    NUMERIC(5,3),           -- per match
    confidence      NUMERIC(3,2) NOT NULL,  -- 0-1

    -- Four pillars (each 0-100)
    xg_diff_score       NUMERIC(5,2),
    squad_value_score   NUMERIC(5,2),
    defensive_score     NUMERIC(5,2),
    buildup_score       NUMERIC(5,2),

    -- Raw inputs
    xg_diff_raw         NUMERIC(6,3),
    squad_value_meur    NUMERIC(10,2),
    dapm_raw            NUMERIC(5,2),
    pass_acc_raw        NUMERIC(5,2),

    -- Meta
    data_sources    TEXT[],
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(club_id, season)
);

CREATE INDEX IF NOT EXISTS idx_club_ratings_power ON club_ratings(power_rating DESC);

-- Cache on clubs for list views
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS power_rating NUMERIC(5,2);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS power_confidence NUMERIC(3,2);
