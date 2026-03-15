-- Migration 031: Tactical philosophies
-- Elevates tactical philosophy from scattered TypeScript constants to a first-class DB entity.
-- Creates the triangle: Philosophy -> Formations -> Roles

-- ── Tactical philosophies ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tactical_philosophies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  origin_story TEXT,
  key_principles TEXT[],
  defining_managers TEXT[],
  era TEXT,

  -- Scoring/fit data (migrated from valuation_core/config.py TACTICAL_SYSTEMS)
  archetype_requirements JSONB,
  personality_preferences JSONB,
  preferred_tags TEXT[],
  concern_tags TEXT[],
  key_attributes TEXT[],

  -- Radar chart dimensions (1-10 scale)
  possession_orientation SMALLINT CHECK (possession_orientation BETWEEN 1 AND 10),
  pressing_intensity SMALLINT CHECK (pressing_intensity BETWEEN 1 AND 10),
  directness SMALLINT CHECK (directness BETWEEN 1 AND 10),
  defensive_depth SMALLINT CHECK (defensive_depth BETWEEN 1 AND 10),
  width_emphasis SMALLINT CHECK (width_emphasis BETWEEN 1 AND 10),
  fluidity SMALLINT CHECK (fluidity BETWEEN 1 AND 10),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tactical_philosophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tactical_philosophies" ON tactical_philosophies FOR SELECT USING (true);

-- ── Philosophy ↔ Formation junction ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS philosophy_formations (
  id SERIAL PRIMARY KEY,
  philosophy_id INTEGER NOT NULL REFERENCES tactical_philosophies(id) ON DELETE CASCADE,
  formation_id BIGINT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  affinity TEXT NOT NULL CHECK (affinity IN ('primary', 'secondary', 'compatible')),
  notes TEXT,
  UNIQUE(philosophy_id, formation_id)
);

ALTER TABLE philosophy_formations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read philosophy_formations" ON philosophy_formations FOR SELECT USING (true);

-- ── Philosophy ↔ Role junction ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS philosophy_roles (
  id SERIAL PRIMARY KEY,
  philosophy_id INTEGER NOT NULL REFERENCES tactical_philosophies(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES tactical_roles(id) ON DELETE CASCADE,
  importance TEXT NOT NULL CHECK (importance IN ('essential', 'preferred', 'compatible')),
  rationale TEXT,
  UNIQUE(philosophy_id, role_id)
);

ALTER TABLE philosophy_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read philosophy_roles" ON philosophy_roles FOR SELECT USING (true);

-- ── Add missing tactical roles ───────────────────────────────────────────────
-- These exist in ROLE_INTELLIGENCE (TypeScript) but not in the tactical_roles table

INSERT INTO tactical_roles (name, position, description, primary_archetype, secondary_archetype) VALUES
  ('Ball-Carrying CB', 'CD', 'Drives forward with the ball, breaks lines from defence', 'Dribbler', 'Cover'),
  ('Direct Winger', 'WM', 'Beats fullback, delivers early crosses or cuts inside', 'Sprinter', 'Dribbler'),
  ('Wide Provider', 'WM', 'Width and delivery, pinpoint crossing', 'Passer', 'Engine'),
  ('Pressing Forward', 'CF', 'Leads the press, harries defenders, sets the tempo', 'Engine', 'Destroyer'),
  ('Raumdeuter', 'CF', 'Space interpreter, ghost runs, off-the-ball intelligence', 'Cover', 'Striker'),
  ('Destroyer-Creator', 'DM', 'Wins ball then launches attacks, dual-phase player', 'Destroyer', 'Creator')
ON CONFLICT (name, position) DO NOTHING;

-- ── Add philosophy_id FK to clubs ────────────────────────────────────────────

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS philosophy_id INTEGER REFERENCES tactical_philosophies(id);
