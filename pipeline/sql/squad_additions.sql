-- Squad Assessment & Inferred Club Needs
-- Adds squad_role to players and source tracking to club_needs.

-- Squad role classification on players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS squad_role TEXT
  CHECK (squad_role IN ('key_player','important_player','rotation','backup','youth'));

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS loan_status TEXT
  CHECK (loan_status IN ('key_player','important_player','rotation','backup','youth'));

-- Source tracking on club_needs (manual vs inferred)
ALTER TABLE club_needs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'inferred'));

ALTER TABLE club_needs
  ADD COLUMN IF NOT EXISTS inferred_reason TEXT;
