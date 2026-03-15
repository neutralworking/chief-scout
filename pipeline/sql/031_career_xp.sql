-- 031_career_xp.sql — Career XP milestones + xp_modifier on player_profiles
--
-- Stores per-player career experience milestones (trophies, loyalty, instability)
-- that feed an additive modifier on the valuation engine's effective score.

-- ── New table: player_xp ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_xp (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id       bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    milestone_key   text NOT NULL,
    milestone_label text NOT NULL,
    xp_value        smallint NOT NULL,  -- -2 to +3 per milestone
    milestone_date  date,
    source          text NOT NULL DEFAULT 'computed',
    details         jsonb,
    created_at      timestamptz DEFAULT now(),
    UNIQUE(person_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_player_xp_person ON player_xp(person_id);

-- ── New column on player_profiles ─────────────────────────────────────────────

ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS xp_modifier smallint DEFAULT 0;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE player_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_player_xp" ON player_xp
    FOR SELECT TO anon USING (true);

CREATE POLICY "service_all_player_xp" ON player_xp
    FOR ALL TO service_role USING (true) WITH CHECK (true);
