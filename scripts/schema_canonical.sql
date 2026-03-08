-- schema_canonical.sql — Canonical schema for Chief Scout
-- Run in Supabase SQL Editor. Drops and recreates all tables cleanly.
-- WARNING: This will destroy existing data in these tables.

-- ── Drop existing tables ────────────────────────────────────────────────────

DROP TABLE IF EXISTS scouting_profiles CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS player_attributes CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- ── Trigger function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── players ─────────────────────────────────────────────────────────────────

CREATE TABLE players (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    slug            text UNIQUE NOT NULL,
    dob             date,
    nationality     text,
    position        text,
    positions       text[],
    club            text,
    league          text,
    level           int,
    peak            int,
    mentality       text,
    foot            text,
    primary_class   text,
    secondary_class text,
    model           text,
    physique        text,
    character       text,
    base_value      bigint,
    is_active       boolean DEFAULT true,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE TRIGGER players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ── player_attributes ───────────────────────────────────────────────────────

CREATE TABLE player_attributes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    mental          jsonb,
    physical        jsonb,
    tactical        jsonb,
    technical       jsonb,
    import_source   text,
    imported_at     timestamptz DEFAULT now()
);

-- ── player_stats ────────────────────────────────────────────────────────────

CREATE TABLE player_stats (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season          text NOT NULL,
    club            text,
    league          text,
    appearances     int,
    minutes         int,
    goals           int,
    assists         int,
    xg              numeric(5,2),
    xa              numeric(5,2),
    raw             jsonb,
    created_at      timestamptz DEFAULT now(),
    UNIQUE (player_id, season, club)
);

-- ── scouting_profiles ───────────────────────────────────────────────────────

CREATE TABLE scouting_profiles (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id           uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    archetype_primary   text,
    archetype_secondary text,
    verdict             text CHECK (verdict IN ('Benchmark', 'Monitor', 'Scout Further', 'Pass')),
    valuation_low       int,
    valuation_high      int,
    personality_type    text,
    flags               text[],
    notes               text,
    version             int DEFAULT 1,
    scouted_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE TRIGGER scouting_profiles_updated_at
    BEFORE UPDATE ON scouting_profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouting_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read players"
    ON players FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read player_attributes"
    ON player_attributes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read player_stats"
    ON player_stats FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated read scouting_profiles"
    ON scouting_profiles FOR SELECT
    TO authenticated
    USING (true);
