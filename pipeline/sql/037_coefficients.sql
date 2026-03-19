-- 037: League, club, and nation coefficients
-- Adds UEFA/FIFA coefficient data for league strength scaling

-- League coefficients (UEFA country coefficients)
CREATE TABLE IF NOT EXISTS league_coefficients (
    id SERIAL PRIMARY KEY,
    league_name TEXT NOT NULL,
    country TEXT NOT NULL,
    country_code TEXT,          -- ISO 2-letter
    uefa_coefficient NUMERIC(8,3),
    uefa_rank SMALLINT,
    strength_factor NUMERIC(4,3),  -- normalized 0.0-1.2 for grade scaling
    season TEXT DEFAULT '2025',
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(league_name, season)
);

-- Club coefficients (UEFA club coefficients)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS uefa_coefficient NUMERIC(8,3);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS uefa_rank SMALLINT;

-- Nation rankings (FIFA world rankings)
ALTER TABLE nations ADD COLUMN IF NOT EXISTS fifa_rank SMALLINT;
ALTER TABLE nations ADD COLUMN IF NOT EXISTS fifa_points NUMERIC(8,2);
ALTER TABLE nations ADD COLUMN IF NOT EXISTS confederation TEXT;  -- UEFA, CONMEBOL, etc.

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_league_coeff_name ON league_coefficients(league_name);
CREATE INDEX IF NOT EXISTS idx_clubs_uefa_rank ON clubs(uefa_rank) WHERE uefa_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nations_fifa_rank ON nations(fifa_rank) WHERE fifa_rank IS NOT NULL;
