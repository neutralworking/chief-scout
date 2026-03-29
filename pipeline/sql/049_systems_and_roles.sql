-- 049_systems_and_roles.sql
-- New hierarchy: philosophy > system > slot > role
-- Replaces: tactical_roles, philosophy_formations, philosophy_roles

-- ── New tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tactical_systems (
  id SERIAL PRIMARY KEY,
  philosophy_id INT REFERENCES tactical_philosophies(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  formation TEXT NOT NULL,
  defining_team TEXT,
  key_principle TEXT,
  variant_of INT REFERENCES tactical_systems(id)
);

CREATE TABLE IF NOT EXISTS system_slots (
  id SERIAL PRIMARY KEY,
  system_id INT REFERENCES tactical_systems(id) ON DELETE CASCADE,
  slot_label TEXT NOT NULL,
  position TEXT NOT NULL,
  sort_order INT NOT NULL,
  UNIQUE(system_id, slot_label)
);

CREATE TABLE IF NOT EXISTS slot_roles (
  id SERIAL PRIMARY KEY,
  slot_id INT REFERENCES system_slots(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  primary_model TEXT NOT NULL,
  secondary_model TEXT NOT NULL,
  rationale TEXT,
  UNIQUE(slot_id, role_name)
);

-- ── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX idx_tactical_systems_philosophy ON tactical_systems(philosophy_id);
CREATE INDEX idx_system_slots_system_id ON system_slots(system_id);
CREATE INDEX idx_system_slots_position ON system_slots(position);
CREATE INDEX idx_slot_roles_slot_id ON slot_roles(slot_id);

-- ── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE tactical_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON tactical_systems FOR SELECT USING (true);
CREATE POLICY "public_read" ON system_slots FOR SELECT USING (true);
CREATE POLICY "public_read" ON slot_roles FOR SELECT USING (true);
