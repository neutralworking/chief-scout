-- 016_alltime_xi.sql — All-Time XI squad builder tables
-- Core Football Choices feature: build your dream XI position by position

-- ── Squad templates (XI formats) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fc_squad_templates (
    id          serial PRIMARY KEY,
    slug        text UNIQUE NOT NULL,
    name        text NOT NULL,
    formation   text NOT NULL,              -- e.g. "4-3-3", "3-5-2"
    positions   jsonb NOT NULL,             -- ordered list of {slot, position_label, position_group}
    description text,
    sort_order  integer DEFAULT 0
);

-- Seed the classic 4-3-3
INSERT INTO fc_squad_templates (slug, name, formation, positions, description, sort_order) VALUES
(
    'classic-433', 'Classic 4-3-3', '4-3-3',
    '[
        {"slot": 1,  "label": "Goalkeeper",       "group": "GK"},
        {"slot": 2,  "label": "Right Back",        "group": "DEF"},
        {"slot": 3,  "label": "Centre Back",       "group": "DEF"},
        {"slot": 4,  "label": "Centre Back",       "group": "DEF"},
        {"slot": 5,  "label": "Left Back",         "group": "DEF"},
        {"slot": 6,  "label": "Central Midfielder", "group": "MID"},
        {"slot": 7,  "label": "Central Midfielder", "group": "MID"},
        {"slot": 8,  "label": "Central Midfielder", "group": "MID"},
        {"slot": 9,  "label": "Right Winger",      "group": "FWD"},
        {"slot": 10, "label": "Striker",            "group": "FWD"},
        {"slot": 11, "label": "Left Winger",        "group": "FWD"}
    ]'::jsonb,
    'The classic 4-3-3 formation', 1
),
(
    'classic-442', 'Classic 4-4-2', '4-4-2',
    '[
        {"slot": 1,  "label": "Goalkeeper",        "group": "GK"},
        {"slot": 2,  "label": "Right Back",         "group": "DEF"},
        {"slot": 3,  "label": "Centre Back",        "group": "DEF"},
        {"slot": 4,  "label": "Centre Back",        "group": "DEF"},
        {"slot": 5,  "label": "Left Back",          "group": "DEF"},
        {"slot": 6,  "label": "Right Midfielder",   "group": "MID"},
        {"slot": 7,  "label": "Central Midfielder",  "group": "MID"},
        {"slot": 8,  "label": "Central Midfielder",  "group": "MID"},
        {"slot": 9,  "label": "Left Midfielder",    "group": "MID"},
        {"slot": 10, "label": "Striker",             "group": "FWD"},
        {"slot": 11, "label": "Striker",             "group": "FWD"}
    ]'::jsonb,
    'The classic English 4-4-2', 2
),
(
    'classic-352', 'Classic 3-5-2', '3-5-2',
    '[
        {"slot": 1,  "label": "Goalkeeper",        "group": "GK"},
        {"slot": 2,  "label": "Centre Back",        "group": "DEF"},
        {"slot": 3,  "label": "Centre Back",        "group": "DEF"},
        {"slot": 4,  "label": "Centre Back",        "group": "DEF"},
        {"slot": 5,  "label": "Right Wing Back",    "group": "MID"},
        {"slot": 6,  "label": "Central Midfielder",  "group": "MID"},
        {"slot": 7,  "label": "Central Midfielder",  "group": "MID"},
        {"slot": 8,  "label": "Central Midfielder",  "group": "MID"},
        {"slot": 9,  "label": "Left Wing Back",     "group": "MID"},
        {"slot": 10, "label": "Striker",             "group": "FWD"},
        {"slot": 11, "label": "Striker",             "group": "FWD"}
    ]'::jsonb,
    'Wing-back system with 3 centre-backs', 3
)
ON CONFLICT (slug) DO NOTHING;

-- ── User squads ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fc_squads (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES fc_users(id) ON DELETE CASCADE,
    template_id     integer NOT NULL REFERENCES fc_squad_templates(id),
    name            text DEFAULT 'My All-Time XI',
    completed       boolean DEFAULT false,   -- all 11 slots filled
    rarity_score    real,                     -- 0-100, how unique this squad is
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE(user_id, template_id)             -- one squad per template per user
);

CREATE INDEX IF NOT EXISTS idx_fc_squads_user ON fc_squads(user_id);

-- ── Squad picks (one per slot) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fc_squad_picks (
    id              bigserial PRIMARY KEY,
    squad_id        uuid NOT NULL REFERENCES fc_squads(id) ON DELETE CASCADE,
    slot            smallint NOT NULL,        -- 1-11
    player_name     text NOT NULL,            -- display name (may be legend not in DB)
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    picked_from     integer[],               -- IDs of options that were presented
    time_ms         integer,                  -- decision time
    created_at      timestamptz DEFAULT now(),
    UNIQUE(squad_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_fc_squad_picks_squad ON fc_squad_picks(squad_id);
CREATE INDEX IF NOT EXISTS idx_fc_squad_picks_player ON fc_squad_picks(player_name);

-- ── Position candidates (curated options per slot) ─────────────────────────

CREATE TABLE IF NOT EXISTS fc_position_candidates (
    id              serial PRIMARY KEY,
    template_id     integer NOT NULL REFERENCES fc_squad_templates(id),
    slot            smallint NOT NULL,
    player_name     text NOT NULL,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    subtitle        text,                     -- e.g. "Brazil, 1994-2006"
    image_url       text,
    era             text,                     -- "classic", "modern", "legend"
    sort_order      smallint DEFAULT 0,
    UNIQUE(template_id, slot, player_name)
);

CREATE INDEX IF NOT EXISTS idx_fc_candidates_template_slot ON fc_position_candidates(template_id, slot);

-- ── Aggregate pick stats (materialized for speed) ──────────────────────────

CREATE TABLE IF NOT EXISTS fc_pick_stats (
    player_name     text NOT NULL,
    slot            smallint NOT NULL,
    template_id     integer NOT NULL REFERENCES fc_squad_templates(id),
    pick_count      integer DEFAULT 0,
    pick_pct        real DEFAULT 0,           -- percentage of all squads
    updated_at      timestamptz DEFAULT now(),
    PRIMARY KEY (player_name, slot, template_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE fc_squad_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_squad_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_position_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_pick_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_fc_squad_templates" ON fc_squad_templates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fc_position_candidates" ON fc_position_candidates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fc_pick_stats" ON fc_pick_stats FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fc_squads" ON fc_squads FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fc_squad_picks" ON fc_squad_picks FOR SELECT TO anon USING (true);

CREATE POLICY "service_all_fc_squad_templates" ON fc_squad_templates FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_squads" ON fc_squads FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_squad_picks" ON fc_squad_picks FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_position_candidates" ON fc_position_candidates FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_pick_stats" ON fc_pick_stats FOR ALL TO service_role USING (true);
