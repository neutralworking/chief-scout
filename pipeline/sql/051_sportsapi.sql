-- Migration 051: SportsAPIPro integration
-- New table for 5-axis attribute scores from SportsAPIPro radar.
-- Also adds 'sportsapi' to transfers.source CHECK constraint.

-- ── sportsapi_attributes table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sportsapi_attributes (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id       bigint REFERENCES people(id) ON DELETE CASCADE NOT NULL,
    sportsapi_id    integer NOT NULL,
    position        text,           -- F/M/D/G (SportsAPIPro classification)
    attacking       smallint,       -- 0-100
    technical       smallint,       -- 0-100
    tactical        smallint,       -- 0-100
    defending       smallint,       -- 0-100
    creativity      smallint,       -- 0-100
    year_shift      smallint NOT NULL DEFAULT 0,  -- 0=current season, 1=last year, etc.
    fetched_at      timestamptz DEFAULT now(),
    UNIQUE (person_id, year_shift)
);

CREATE INDEX IF NOT EXISTS idx_sportsapi_attrs_person ON sportsapi_attributes(person_id);
CREATE INDEX IF NOT EXISTS idx_sportsapi_attrs_sportsapi_id ON sportsapi_attributes(sportsapi_id);

-- ── Position averages (reference baselines) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS sportsapi_position_averages (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    position        text NOT NULL,    -- F/M/D/G
    attacking       smallint,
    technical       smallint,
    tactical        smallint,
    defending       smallint,
    creativity      smallint,
    year_shift      smallint NOT NULL DEFAULT 0,
    fetched_at      timestamptz DEFAULT now(),
    UNIQUE (position, year_shift)
);

-- ── Expand transfers.source CHECK ───────────────────────────────────────────

ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_source_check;
ALTER TABLE transfers ADD CONSTRAINT transfers_source_check
    CHECK (source IN ('wikidata', 'kaggle', 'seed', 'manual', 'sportsapi'));

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE sportsapi_attributes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "anon_read_sportsapi_attrs" ON sportsapi_attributes
        FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "service_all_sportsapi_attrs" ON sportsapi_attributes
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE sportsapi_position_averages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "anon_read_sportsapi_avgs" ON sportsapi_position_averages
        FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "service_all_sportsapi_avgs" ON sportsapi_position_averages
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
