-- 049_systems_and_roles.sql
-- Systems & Roles Redesign: philosophy→system→slot→role hierarchy
-- Replaces flat tactical_roles with bottom-up validated roles per system slot.

-- ── New tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tactical_systems (
  id SERIAL PRIMARY KEY,
  philosophy_id INT NOT NULL REFERENCES tactical_philosophies(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  formation TEXT NOT NULL,
  defining_team TEXT,
  key_principle TEXT,
  variant_of INT REFERENCES tactical_systems(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_slots (
  id SERIAL PRIMARY KEY,
  system_id INT NOT NULL REFERENCES tactical_systems(id) ON DELETE CASCADE,
  slot_label TEXT NOT NULL,
  position TEXT NOT NULL,
  sort_order INT NOT NULL,
  UNIQUE(system_id, slot_label)
);

CREATE TABLE IF NOT EXISTS slot_roles (
  id SERIAL PRIMARY KEY,
  slot_id INT NOT NULL REFERENCES system_slots(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  primary_model TEXT NOT NULL,
  secondary_model TEXT NOT NULL,
  rationale TEXT,
  UNIQUE(slot_id, role_name)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tactical_systems_philosophy ON tactical_systems(philosophy_id);
CREATE INDEX IF NOT EXISTS idx_system_slots_system ON system_slots(system_id);
CREATE INDEX IF NOT EXISTS idx_system_slots_position ON system_slots(position);
CREATE INDEX IF NOT EXISTS idx_slot_roles_slot ON slot_roles(slot_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE tactical_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tactical_systems' AND policyname = 'public_read') THEN
    CREATE POLICY public_read ON tactical_systems FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_slots' AND policyname = 'public_read') THEN
    CREATE POLICY public_read ON system_slots FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'slot_roles' AND policyname = 'public_read') THEN
    CREATE POLICY public_read ON slot_roles FOR SELECT USING (true);
  END IF;
END $$;

-- ── Convenience view: distinct valid roles per position ─────────────────────
-- Used by pipeline 27 to get role candidates without joining 3 tables each time.

CREATE OR REPLACE VIEW valid_position_roles AS
SELECT DISTINCT
  ss.position,
  sr.role_name,
  sr.primary_model,
  sr.secondary_model
FROM slot_roles sr
JOIN system_slots ss ON sr.slot_id = ss.id;
