-- 036_kickoff_clash.sql — Kickoff Clash card battler / roguelike schema
-- Card game built on Chief Scout data. Balatro meets football.
-- Tables: kc_cards, kc_modifiers, kc_runs, kc_run_cards, kc_matches,
--         kc_run_modifiers, kc_chemistry_book

-- ── Card library ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kc_cards (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    bio                 TEXT,
    position            TEXT NOT NULL,              -- GK/CD/WD/DM/CM/WM/AM/WF/CF
    archetype           TEXT NOT NULL,              -- primary archetype
    secondary_archetype TEXT,
    tactical_role       TEXT,                       -- Regista, Volante, etc.
    personality_type    TEXT,                       -- 4-letter code (ANSC, IXLC, etc.)
    personality_theme   TEXT,                       -- General/Catalyst/Maestro/Captain/Professor
    power               INT NOT NULL CHECK (power BETWEEN 1 AND 100),
    rarity              TEXT NOT NULL CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary')),
    art_seed            TEXT,                       -- deterministic seed for card art generation
    ability_name        TEXT,                       -- role-specific ability name
    ability_text        TEXT,                       -- ability description
    gate_pull           INT DEFAULT 0,             -- fans attracted per match
    durability          TEXT NOT NULL DEFAULT 'standard' CHECK (durability IN ('glass', 'fragile', 'standard', 'iron', 'titanium', 'phoenix')),
    source_person_id    INT REFERENCES people(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kc_cards_position ON kc_cards(position);
CREATE INDEX IF NOT EXISTS idx_kc_cards_rarity ON kc_cards(rarity);
CREATE INDEX IF NOT EXISTS idx_kc_cards_archetype ON kc_cards(archetype);
CREATE INDEX IF NOT EXISTS idx_kc_cards_source_person ON kc_cards(source_person_id);

-- ── Modifier cards (manager / stadium / fan / economy) ───────────────────────

CREATE TABLE IF NOT EXISTS kc_modifiers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    effect      JSONB NOT NULL,
    rarity      TEXT NOT NULL CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary')),
    category    TEXT NOT NULL CHECK (category IN ('manager', 'stadium', 'fan', 'economy')),
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kc_modifiers_category ON kc_modifiers(category);

-- ── Roguelike runs ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kc_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES fc_users(id) ON DELETE SET NULL,
    formation       TEXT NOT NULL,
    playing_style   TEXT NOT NULL,
    cash            INT DEFAULT 0,
    stadium_tier    INT DEFAULT 1,
    score           INT DEFAULT 0,
    round           INT DEFAULT 1,
    wins            INT DEFAULT 0,
    losses          INT DEFAULT 0,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'abandoned')),
    started_at      TIMESTAMPTZ DEFAULT now(),
    ended_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kc_runs_user ON kc_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_kc_runs_status ON kc_runs(status);

-- ── Cards in a run's deck ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kc_run_cards (
    id              SERIAL PRIMARY KEY,
    run_id          UUID NOT NULL REFERENCES kc_runs(id) ON DELETE CASCADE,
    card_id         INT NOT NULL REFERENCES kc_cards(id),
    slot            TEXT,                           -- formation slot (e.g. "CM_L") or NULL for bench
    modifiers       JSONB DEFAULT '{}',
    acquired_round  INT DEFAULT 1,
    injured         BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_kc_run_cards_run ON kc_run_cards(run_id);
CREATE INDEX IF NOT EXISTS idx_kc_run_cards_card ON kc_run_cards(card_id);

-- ── Matches within a run ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kc_matches (
    id                  SERIAL PRIMARY KEY,
    run_id              UUID NOT NULL REFERENCES kc_runs(id) ON DELETE CASCADE,
    round               INT NOT NULL,
    opponent_name       TEXT NOT NULL,
    opponent_style      TEXT,
    opponent_score      INT,
    player_score        INT,
    attendance          INT,
    revenue             INT,
    result              TEXT CHECK (result IN ('win', 'draw', 'loss')),
    synergies_triggered JSONB DEFAULT '[]',
    played_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kc_matches_run ON kc_matches(run_id);

-- ── Modifiers active in a run ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kc_run_modifiers (
    id              SERIAL PRIMARY KEY,
    run_id          UUID NOT NULL REFERENCES kc_runs(id) ON DELETE CASCADE,
    modifier_id     INT NOT NULL REFERENCES kc_modifiers(id),
    acquired_round  INT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_kc_run_modifiers_run ON kc_run_modifiers(run_id);
CREATE INDEX IF NOT EXISTS idx_kc_run_modifiers_modifier ON kc_run_modifiers(modifier_id);

-- ── Chemistry book (meta-progression, persists across runs) ──────────────────

CREATE TABLE IF NOT EXISTS kc_chemistry_book (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES fc_users(id) ON DELETE CASCADE,
    synergy_key     TEXT NOT NULL,                  -- unique identifier for the synergy
    synergy_name    TEXT NOT NULL,
    synergy_tier    INT NOT NULL CHECK (synergy_tier BETWEEN 1 AND 4),
    discovered_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, synergy_key)
);

CREATE INDEX IF NOT EXISTS idx_kc_chemistry_book_user ON kc_chemistry_book(user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE kc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE kc_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kc_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kc_run_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE kc_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE kc_run_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kc_chemistry_book ENABLE ROW LEVEL SECURITY;

-- Anon can read card/modifier library
CREATE POLICY "anon_read_kc_cards" ON kc_cards FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_kc_modifiers" ON kc_modifiers FOR SELECT TO anon USING (true);

-- Service role has full access
CREATE POLICY "service_all_kc_cards" ON kc_cards FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_kc_modifiers" ON kc_modifiers FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_kc_runs" ON kc_runs FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_kc_run_cards" ON kc_run_cards FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_kc_matches" ON kc_matches FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_kc_run_modifiers" ON kc_run_modifiers FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_kc_chemistry_book" ON kc_chemistry_book FOR ALL TO service_role USING (true);

-- Anon can read own run data and chemistry book (via service-role API routes)
CREATE POLICY "anon_read_kc_runs" ON kc_runs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_kc_run_cards" ON kc_run_cards FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_kc_matches" ON kc_matches FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_kc_run_modifiers" ON kc_run_modifiers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_kc_chemistry_book" ON kc_chemistry_book FOR SELECT TO anon USING (true);

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE kc_cards IS 'Kickoff Clash card library — fictional players derived from Chief Scout data';
COMMENT ON TABLE kc_modifiers IS 'Kickoff Clash modifier cards — manager/stadium/fan/economy effects';
COMMENT ON TABLE kc_runs IS 'Kickoff Clash roguelike runs — one season per run';
COMMENT ON TABLE kc_run_cards IS 'Cards in a run deck — slotted into formation or on bench';
COMMENT ON TABLE kc_matches IS 'Individual matches within a Kickoff Clash run';
COMMENT ON TABLE kc_run_modifiers IS 'Active modifiers during a run';
COMMENT ON TABLE kc_chemistry_book IS 'Meta-progression: discovered synergies persist across runs';
