-- Migration 011: Formation slots for position mapping
-- Maps each formation to our position enum with slot counts

-- Add metadata columns to formations
ALTER TABLE formations ADD COLUMN IF NOT EXISTS era TEXT;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS position_count INTEGER;

-- Create formation_slots table
CREATE TABLE IF NOT EXISTS formation_slots (
  id BIGSERIAL PRIMARY KEY,
  formation_id BIGINT REFERENCES formations(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  slot_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(formation_id, position)
);

ALTER TABLE formation_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read formation_slots" ON formation_slots FOR SELECT USING (true);
