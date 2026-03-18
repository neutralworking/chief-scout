-- 035: Add kc (Kickoff Clash template) boolean to people table
-- Players flagged kc=true will be used as stat templates for fictional characters

ALTER TABLE people ADD COLUMN IF NOT EXISTS kc BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS people_kc_idx ON people(kc) WHERE kc = true;

COMMENT ON COLUMN people.kc IS 'Kickoff Clash template flag — player stats will be used to generate fictional card game characters';

-- Update the player_intelligence_card view to include fc
CREATE OR REPLACE VIEW player_intelligence_card AS
SELECT
  -- Identity (people)
  p.id                AS person_id,
  p.name,
  p.date_of_birth,
  p.height_cm,
  p.preferred_foot,
  p.active,
  p.kc,
  p.wikidata_id,
  p.image_url,
  p.transfermarkt_id,

  -- Nation & Club (resolved names)
  n.name              AS nation,
  c.clubname          AS club,

  -- Profile (player_profiles)
  pp.position,
  pp.level,
  pp.peak,
  pp.overall,
  pp.archetype,
  pp.model_id,
  pp.blueprint,
  pp.profile_tier,

  -- Personality (player_personality)
  pper.ei,
  pper.sn,
  pper.tf,
  pper.jp,
  pper.competitiveness,
  pper.coachability,
  -- Computed 4-letter personality type
  CASE WHEN pper.ei IS NOT NULL THEN
    CONCAT(
      CASE WHEN pper.ei >= 50 THEN 'E' ELSE 'I' END,
      CASE WHEN pper.sn >= 50 THEN 'S' ELSE 'N' END,
      CASE WHEN pper.tf >= 50 THEN 'T' ELSE 'F' END,
      CASE WHEN pper.jp >= 50 THEN 'J' ELSE 'P' END
    )
  END                 AS personality_type,

  -- Market (player_market)
  pm.market_value_tier,
  pm.true_mvt,
  pm.market_premium,
  pm.scarcity_score,
  pm.transfer_fee_eur,
  pm.hg,

  -- Status (player_status)
  ps.pursuit_status,
  ps.scouting_notes,
  ps.squad_role,
  ps.loan_status

FROM people p
LEFT JOIN nations n           ON n.id = p.nation_id
LEFT JOIN clubs c             ON c.id = p.club_id
LEFT JOIN player_profiles pp  ON pp.person_id = p.id
LEFT JOIN player_personality pper ON pper.person_id = p.id
LEFT JOIN player_market pm    ON pm.person_id = p.id
LEFT JOIN player_status ps    ON ps.person_id = p.id;

COMMENT ON VIEW player_intelligence_card IS 'Single-query Player Intelligence Card dossier: identity + profile + personality + market + status + kc flag.';
