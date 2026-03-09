-- =============================================================
-- Schema migration: Normalize players into people + feature tables
-- =============================================================
BEGIN;

-- 1. Rebuild people as the core entity
-- ------------------------------------------------------------

-- Drop old FKs referencing people
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS fk_clubs_manager;
ALTER TABLE players DROP CONSTRAINT IF EXISTS fk_players_person;

-- Rename old people table and its indexes
ALTER TABLE people RENAME TO people_old;
ALTER INDEX "Players_pkey" RENAME TO people_old_pkey;
ALTER INDEX idx_people_club_id RENAME TO idx_people_old_club_id;
ALTER INDEX idx_people_nation_id RENAME TO idx_people_old_nation_id;

-- Create new clean people table
CREATE TABLE people (
    id          bigint PRIMARY KEY,
    name        text NOT NULL,
    date_of_birth date,
    height_cm   integer,
    preferred_foot text,
    nation_id   integer REFERENCES nations(id) ON DELETE SET NULL,
    club_id     integer REFERENCES clubs(id) ON DELETE SET NULL,
    active      boolean DEFAULT true,
    wikipedia_url text,
    wikidata_id text,
    international_caps integer,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_nation ON people(nation_id);
CREATE INDEX idx_people_club ON people(club_id);
CREATE INDEX idx_people_name ON people(lower(name));
CREATE INDEX idx_people_wikidata ON people(wikidata_id);

-- Populate people from players (the more complete source)
INSERT INTO people (id, name, date_of_birth, height_cm, preferred_foot,
                    nation_id, club_id, active, wikipedia_url, wikidata_id,
                    international_caps)
SELECT
    p.id,
    TRIM(p.name),
    p.date_of_birth,
    p.height_cm,
    p.preferred_foot,
    p.nation_id,
    p.club_id,
    COALESCE(p.active, true),
    p.wikipedia_url,
    p.wikidata_id,
    p.international_caps
FROM players p;

-- Overwrite with verified field_sources data where available
UPDATE people pe SET date_of_birth = pfs.value::date
FROM player_field_sources pfs
WHERE pfs.player_id = pe.id
  AND pfs.field = 'date_of_birth'
  AND pfs.confirmed = true;

UPDATE people pe SET height_cm = pfs.value::integer
FROM player_field_sources pfs
WHERE pfs.player_id = pe.id
  AND pfs.field = 'height_cm'
  AND pfs.confirmed = true;

UPDATE people pe SET wikipedia_url = pfs.value
FROM player_field_sources pfs
WHERE pfs.player_id = pe.id
  AND pfs.field = 'wikipedia_url'
  AND pfs.confirmed = true;

UPDATE people pe SET wikidata_id = pfs.value
FROM player_field_sources pfs
WHERE pfs.player_id = pe.id
  AND pfs.field = 'wikidata_id'
  AND pfs.confirmed = true;

-- Drop old people table
DROP TABLE people_old CASCADE;


-- 2. Create player_profiles (scouting/assessment)
-- ------------------------------------------------------------
CREATE TABLE player_profiles (
    person_id             bigint PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
    position              "position",
    secondary_position    text,
    side                  text,
    level                 integer,
    peak                  integer,
    overall               double precision,
    grade                 "Tier",
    model_id              integer REFERENCES models(id) ON DELETE SET NULL,
    primary_skillset_id   integer REFERENCES skillsets(id) ON DELETE SET NULL,
    secondary_skillset_id integer REFERENCES skillsets(id) ON DELETE SET NULL,
    archetype             text,
    archetype_override    text,
    archetype_confidence  text,
    blueprint             text,
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT player_profiles_archetype_confidence_check
        CHECK (archetype_confidence IN ('high', 'medium', 'low')),
    CONSTRAINT player_profiles_secondary_position_check
        CHECK (secondary_position IN ('GK','WD','CD','DM','CM','WM','AM','WF','CF'))
);

CREATE INDEX idx_player_profiles_model ON player_profiles(model_id);
CREATE INDEX idx_player_profiles_primary_skillset ON player_profiles(primary_skillset_id);
CREATE INDEX idx_player_profiles_secondary_skillset ON player_profiles(secondary_skillset_id);

INSERT INTO player_profiles (person_id, position, secondary_position, side,
    level, peak, overall, grade, model_id, primary_skillset_id,
    secondary_skillset_id, archetype, archetype_override,
    archetype_confidence, blueprint)
SELECT id, position, secondary_position, "Side",
    COALESCE(player_level, level), peak, "OVERALL", grade, model_id,
    primary_skillset_id, secondary_skillset_id, archetype,
    archetype_override, archetype_confidence, blueprint
FROM players
WHERE position IS NOT NULL
   OR level IS NOT NULL
   OR player_level IS NOT NULL
   OR peak IS NOT NULL
   OR archetype IS NOT NULL
   OR model_id IS NOT NULL;


-- 3. Create player_status (current state, changes often)
-- ------------------------------------------------------------
CREATE TABLE player_status (
    person_id         bigint PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
    fitness_tag       text DEFAULT 'Fully Fit',
    mental_tag        text DEFAULT 'Sharp',
    disciplinary_tag  text DEFAULT 'Clear',
    tactical_tag      text DEFAULT 'Adaptable',
    contract_tag      text DEFAULT 'One Year Left',
    club_status       text,
    nation_status     text,
    transfer_status   text,
    pursuit_status    text,
    fit_note          text,
    scouting_notes    text,
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT player_status_pursuit_check
        CHECK (pursuit_status IN ('Pass','Watch','Interested','Priority'))
);

INSERT INTO player_status (person_id, fitness_tag, mental_tag,
    disciplinary_tag, tactical_tag, contract_tag, club_status,
    nation_status, transfer_status, pursuit_status, fit_note,
    scouting_notes)
SELECT id, fitness_tag, mental_tag, disciplinary_tag, tactical_tag,
    contract_tag, "ClubStatus", "NationStatus", "Transfer Status",
    pursuit_status, fit_note, scouting_notes
FROM players;


-- 4. Create player_market (valuation/transfer)
-- ------------------------------------------------------------
CREATE TABLE player_market (
    person_id               bigint PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
    market_value_tier       integer,
    true_mvt                integer,
    market_premium          integer,
    transfer_fee_eur        bigint,
    director_valuation_meur integer,
    scarcity_score          integer,
    national_scarcity       integer,
    hg                      boolean,
    joined_year             integer,
    prev_club               text,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

INSERT INTO player_market (person_id, market_value_tier, true_mvt,
    market_premium, transfer_fee_eur, director_valuation_meur,
    scarcity_score, national_scarcity, hg, joined_year, prev_club)
SELECT id, market_value_tier, true_mvt, market_premium, transfer_fee_eur,
    director_valuation_meur, scarcity_score, national_scarcity, hg,
    joined_year, prev_club
FROM players
WHERE market_value_tier IS NOT NULL
   OR transfer_fee_eur IS NOT NULL
   OR hg IS NOT NULL
   OR scarcity_score IS NOT NULL
   OR true_mvt IS NOT NULL;


-- 5. Re-point dependent tables from players(id) → people(id)
-- ------------------------------------------------------------

-- attribute_grades
ALTER TABLE attribute_grades DROP CONSTRAINT attribute_grades_player_id_fkey;
ALTER TABLE attribute_grades ADD CONSTRAINT attribute_grades_person_id_fkey
    FOREIGN KEY (player_id) REFERENCES people(id) ON DELETE CASCADE;

-- player_field_sources
ALTER TABLE player_field_sources DROP CONSTRAINT player_field_sources_player_id_fkey;
ALTER TABLE player_field_sources ADD CONSTRAINT player_field_sources_person_id_fkey
    FOREIGN KEY (player_id) REFERENCES people(id) ON DELETE CASCADE;

-- player_personality
ALTER TABLE player_personality DROP CONSTRAINT player_personality_player_id_fkey;
ALTER TABLE player_personality ADD CONSTRAINT player_personality_person_id_fkey
    FOREIGN KEY (player_id) REFERENCES people(id) ON DELETE CASCADE;

-- player_tags
ALTER TABLE player_tags DROP CONSTRAINT player_tags_player_id_fkey;
ALTER TABLE player_tags ADD CONSTRAINT player_tags_person_id_fkey
    FOREIGN KEY (player_id) REFERENCES people(id) ON DELETE CASCADE;

-- transfers
ALTER TABLE transfers DROP CONSTRAINT transfers_player_id_fkey;
ALTER TABLE transfers ADD CONSTRAINT transfers_person_id_fkey
    FOREIGN KEY (player_id) REFERENCES people(id) ON DELETE CASCADE;

-- levels (benchmark players per position)
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_am_fkey;
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_cd_fkey;
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_cf_fkey;
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_cm_fkey;
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_dm_fkey;
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_gk_fkey;
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_wd_fkey;
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_wf_fkey;
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_wm_fkey;

ALTER TABLE levels ADD CONSTRAINT levels_am_fkey FOREIGN KEY (am) REFERENCES people(id);
ALTER TABLE levels ADD CONSTRAINT levels_cd_fkey FOREIGN KEY (cd) REFERENCES people(id);
ALTER TABLE levels ADD CONSTRAINT levels_cf_fkey FOREIGN KEY (cf) REFERENCES people(id);
ALTER TABLE levels ADD CONSTRAINT levels_cm_fkey FOREIGN KEY (cm) REFERENCES people(id);
ALTER TABLE levels ADD CONSTRAINT levels_dm_fkey FOREIGN KEY (dm) REFERENCES people(id);
ALTER TABLE levels ADD CONSTRAINT levels_gk_fkey FOREIGN KEY (gk) REFERENCES people(id);
ALTER TABLE levels ADD CONSTRAINT levels_wd_fkey FOREIGN KEY (wd) REFERENCES people(id);
ALTER TABLE levels ADD CONSTRAINT levels_wf_fkey FOREIGN KEY (wf) REFERENCES people(id);
ALTER TABLE levels ADD CONSTRAINT levels_wm_fkey FOREIGN KEY (wm) REFERENCES people(id);

-- Restore clubs → people FK (for manager)
ALTER TABLE clubs ADD CONSTRAINT fk_clubs_manager
    FOREIGN KEY (manager_id) REFERENCES people(id) ON DELETE SET NULL;


-- 6. Drop old players table and view
-- ------------------------------------------------------------
DROP VIEW IF EXISTS active_top_players;
DROP VIEW IF EXISTS players_with_club_availability;
DROP TABLE players CASCADE;


-- 7. Recreate active_top_players as a view on the new schema
-- ------------------------------------------------------------
CREATE VIEW active_top_players AS
SELECT
    pe.id,
    pe.name,
    pp.level,
    pp.overall,
    pp.archetype,
    ps.fitness_tag,
    ps.mental_tag,
    ps.tactical_tag,
    ps.contract_tag,
    pp.peak,
    pe.height_cm,
    pe.preferred_foot,
    pe.date_of_birth
FROM people pe
JOIN player_profiles pp ON pp.person_id = pe.id
LEFT JOIN player_status ps ON ps.person_id = pe.id
WHERE pe.active = true
  AND pp.level IS NOT NULL;


-- 8. Enable RLS and add read policies
-- ------------------------------------------------------------
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_market ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON people FOR SELECT USING (true);
CREATE POLICY "read_all" ON player_profiles FOR SELECT USING (true);
CREATE POLICY "read_all" ON player_status FOR SELECT USING (true);
CREATE POLICY "read_all" ON player_market FOR SELECT USING (true);

COMMIT;
