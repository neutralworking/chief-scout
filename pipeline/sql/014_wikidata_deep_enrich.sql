-- 014_wikidata_deep_enrich.sql — Schema for Wikidata deep enrichment
-- Run in Supabase SQL Editor (Dashboard > SQL Editor).
-- Adds: player nationalities, career history, image URLs, Transfermarkt IDs, position from Wikidata.

-- ── New columns on people ───────────────────────────────────────────────────

ALTER TABLE people ADD COLUMN IF NOT EXISTS image_url       TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS place_of_birth  TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS transfermarkt_id TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS wikidata_position TEXT;   -- P413 position played, raw label from Wikidata

CREATE INDEX IF NOT EXISTS idx_people_transfermarkt ON people(transfermarkt_id);

-- ── Player nationalities (P27 — can have multiple) ─────────────────────────

CREATE TABLE IF NOT EXISTS player_nationalities (
    id          bigserial PRIMARY KEY,
    person_id   bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    nation_name text NOT NULL,
    nation_wikidata_id text,
    nation_id   integer REFERENCES nations(id) ON DELETE SET NULL,
    is_primary  boolean DEFAULT false,
    created_at  timestamptz DEFAULT now(),
    UNIQUE(person_id, nation_name)
);

CREATE INDEX IF NOT EXISTS idx_player_nationalities_person ON player_nationalities(person_id);
CREATE INDEX IF NOT EXISTS idx_player_nationalities_nation ON player_nationalities(nation_id);

-- ── Player career history (P54 — full club history with dates) ─────────────

CREATE TABLE IF NOT EXISTS player_career_history (
    id          bigserial PRIMARY KEY,
    person_id   bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    club_name   text NOT NULL,
    club_wikidata_id text,
    club_id     integer REFERENCES clubs(id) ON DELETE SET NULL,
    start_date  date,
    end_date    date,                  -- NULL = current club
    is_loan     boolean DEFAULT false,
    jersey_number integer,
    sort_order  integer,               -- chronological order
    created_at  timestamptz DEFAULT now(),
    UNIQUE(person_id, club_wikidata_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_career_history_person ON player_career_history(person_id);
CREATE INDEX IF NOT EXISTS idx_career_history_club ON player_career_history(club_id);
CREATE INDEX IF NOT EXISTS idx_career_history_dates ON player_career_history(start_date, end_date);

-- ── Update intelligence card view to include new fields ─────────────────────
-- (image_url and place_of_birth added to SELECT)

CREATE OR REPLACE VIEW player_intelligence_card AS
SELECT
    pe.id AS person_id,
    pe.name,
    pe.date_of_birth AS dob,
    pe.height_cm,
    pe.preferred_foot,
    pe.active,
    pe.wikidata_id,
    pe.image_url,
    pe.place_of_birth,
    pe.transfermarkt_id,
    pe.wikidata_position,
    n.name  AS nation,
    c.name  AS club,
    pp.position,
    pp.level,
    pp.peak,
    pp.overall,
    pp.archetype,
    pp.model_id,
    pp.blueprint,
    pp.profile_tier,
    py.ei, py.sn, py.tf, py.jp,
    py.competitiveness,
    py.coachability,
    py.personality_type,
    pm.market_value_tier,
    pm.true_mvt,
    pm.market_premium,
    pm.scarcity_score,
    pm.transfer_fee_eur,
    pm.hg,
    ps.pursuit_status,
    ps.scouting_notes,
    ps.squad_role,
    ps.loan_status
FROM people pe
LEFT JOIN nations n           ON n.id  = pe.nation_id
LEFT JOIN clubs c             ON c.id  = pe.club_id
LEFT JOIN player_profiles pp  ON pp.person_id = pe.id
LEFT JOIN player_personality py ON py.person_id = pe.id
LEFT JOIN player_market pm    ON pm.person_id = pe.id
LEFT JOIN player_status ps    ON ps.person_id = pe.id;

-- ── RLS for new tables ─────────────────────────────────────────────────────

ALTER TABLE player_nationalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_career_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_nationalities" ON player_nationalities FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_career_history" ON player_career_history FOR SELECT TO anon USING (true);
CREATE POLICY "service_all_nationalities" ON player_nationalities FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_career_history" ON player_career_history FOR ALL TO service_role USING (true);
