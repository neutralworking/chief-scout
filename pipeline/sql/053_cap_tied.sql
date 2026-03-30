-- Migration 053: Cap-tied nationality tracking
-- Adds is_cap_tied to player_nationalities so OTP only shows players
-- for the nation they actually represent internationally.
-- Uncapped players (no is_cap_tied=true anywhere) still appear in all eligible nations.

ALTER TABLE player_nationalities ADD COLUMN IF NOT EXISTS is_cap_tied boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pn_cap_tied ON player_nationalities(person_id) WHERE is_cap_tied = true;

-- ── Backfill: mark cap-tied where nationality matches people.nation_id ──────
-- people.nation_id is the primary/representing nation. If a player_nationalities
-- row matches it, that's the nation they play for.

UPDATE player_nationalities pn
SET is_cap_tied = true
FROM people p
WHERE pn.person_id = p.id
  AND pn.nation_id = p.nation_id
  AND pn.is_cap_tied = false;

-- ── RPC: get eligible dual nationals for OTP ────────────────────────────────
-- Returns person_ids eligible for a nation: cap-tied to that nation,
-- OR uncapped (no is_cap_tied=true row anywhere).

CREATE OR REPLACE FUNCTION get_eligible_dual_nationals(p_nation_id integer)
RETURNS TABLE(person_id bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT pn.person_id
  FROM player_nationalities pn
  JOIN people p ON p.id = pn.person_id
  WHERE pn.nation_id = p_nation_id
    AND p.active = true
    AND p.is_female IS NOT TRUE
    AND (
      pn.is_cap_tied = true
      OR NOT EXISTS (
        SELECT 1 FROM player_nationalities pn2
        WHERE pn2.person_id = pn.person_id AND pn2.is_cap_tied = true
      )
    );
END;
$$ LANGUAGE plpgsql STABLE;
