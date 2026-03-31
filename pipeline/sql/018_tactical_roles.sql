-- Migration 018: Tactical roles for formation slots
-- Adds named roles to formation slots with archetype affinity mapping

-- Tactical roles reference table
CREATE TABLE IF NOT EXISTS tactical_roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,  -- which position enum this role belongs to
  description TEXT,
  primary_archetype TEXT NOT NULL,    -- best-fit archetype model
  secondary_archetype TEXT NOT NULL,  -- second-best archetype model
  UNIQUE(name, position)
);

ALTER TABLE tactical_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tactical_roles" ON tactical_roles FOR SELECT USING (true);

-- Add role column to formation_slots
ALTER TABLE formation_slots ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES tactical_roles(id);

-- Allow multiple roles per position in a formation (e.g. 2 CDs with different roles)
-- Drop old unique constraint and replace
ALTER TABLE formation_slots DROP CONSTRAINT IF EXISTS formation_slots_formation_id_position_key;
ALTER TABLE formation_slots ADD COLUMN IF NOT EXISTS slot_label TEXT;  -- e.g. "LCB", "RCB", "LWF", "RWF"

-- Seed tactical roles
INSERT INTO tactical_roles (name, position, description, primary_archetype, secondary_archetype) VALUES
  -- GK
  ('Sweeper Keeper', 'GK', 'High line, distribution, commands area', 'GK', 'Passer'),
  ('Shot Stopper', 'GK', 'Traditional, reflexes, positioning', 'GK', 'Cover'),
  -- CD
  ('Ball-Playing CB', 'CD', 'Builds from the back, progressive passing', 'Cover', 'Passer'),
  ('Stopper', 'CD', 'Front-foot, aggressive, wins duels', 'Destroyer', 'Powerhouse'),
  ('Sweeper', 'CD', 'Last man, reads danger, covers space', 'Cover', 'Controller'),
  -- WD
  ('Inverted Full-Back', 'WD', 'Tucks inside in possession, creates overloads', 'Controller', 'Passer'),
  ('Overlapping Full-Back', 'WD', 'Wide and high, delivers crosses', 'Sprinter', 'Engine'),
  ('Wing-Back', 'WD', 'Full width, both phases, tireless', 'Engine', 'Dribbler'),
  -- DM
  ('Regista', 'DM', 'Deep playmaker, dictates tempo from deep', 'Controller', 'Passer'),
  ('Anchor', 'DM', 'Shields back four, positional discipline', 'Cover', 'Destroyer'),
  ('Ball-Winner', 'DM', 'Aggressive pressing, disrupts play', 'Destroyer', 'Engine'),
  -- CM
  ('Mezzala', 'CM', 'Half-space runner, arrives in box', 'Dribbler', 'Engine'),
  ('Box-to-Box', 'CM', 'Covers both ends, energy and tackles', 'Engine', 'Destroyer'),
  ('Deep Playmaker', 'CM', 'Receives deep, orchestrates build-up', 'Controller', 'Passer'),
  -- WM
  ('Wide Playmaker', 'WM', 'Drifts inside, creates from half-spaces', 'Creator', 'Passer'),
  ('Traditional Winger', 'WM', 'Hugs touchline, crosses, direct running', 'Sprinter', 'Passer'),
  -- AM
  ('Trequartista', 'AM', 'Free-roaming 10, unpredictable movement', 'Creator', 'Dribbler'),
  ('Advanced Playmaker', 'AM', 'Links midfield to attack, final third control', 'Controller', 'Creator'),
  ('Shadow Striker', 'AM', 'Late runs into box, second striker movement', 'Sprinter', 'Striker'),
  -- WF
  ('Inverted Winger', 'WF', 'Cuts inside on opposite foot, shoots', 'Striker', 'Dribbler'),
  ('Inverted Winger', 'WF', 'Creates from inside, vision and technique', 'Creator', 'Dribbler'),
  ('Wide Forward', 'WF', 'Stretches defense, pace in behind', 'Sprinter', 'Striker'),
  -- CF
  ('Target Man', 'CF', 'Holds up play, aerial dominance', 'Target', 'Powerhouse'),
  ('Poacher', 'CF', 'Box presence, clinical finishing', 'Striker', 'Sprinter'),
  ('False 9', 'CF', 'Drops deep, links play, creates space', 'Creator', 'Controller'),
  ('Prima Punta', 'CF', 'Clinical finisher, wins headers, occupies CBs', 'Striker', 'Target')
ON CONFLICT (name, position) DO NOTHING;
