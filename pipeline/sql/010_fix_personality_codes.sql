-- 010_fix_personality_codes.sql — Fix personality type computation
-- The personality matrix uses football-native codes, not MBTI:
--   ei: Analytical (A) ≥50 | Instinctive (I) <50
--   sn: Extrinsic  (X) ≥50 | Intrinsic   (N) <50
--   tf: Soloist    (S) ≥50 | Leader      (L) <50
--   jp: Competitor (C) ≥50 | Composer    (P) <50
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).

-- ── Fix column name: normalization renamed the FK constraint but not the column ──
ALTER TABLE player_personality RENAME COLUMN player_id TO person_id;

-- ── Update player_intelligence_card view ─────────────────────────────────────

CREATE OR REPLACE VIEW player_intelligence_card AS
SELECT
  -- Identity (people)
  p.id                AS person_id,
  p.name,
  p.dob,
  p.height_cm,
  p.preferred_foot,
  p.active,
  p.wikidata_id,

  -- Nation & Club (resolved names)
  n.name              AS nation,
  c.name              AS club,

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
  -- Computed 4-letter football personality code
  CASE WHEN pper.ei IS NOT NULL THEN
    CONCAT(
      CASE WHEN pper.ei >= 50 THEN 'A' ELSE 'I' END,
      CASE WHEN pper.sn >= 50 THEN 'X' ELSE 'N' END,
      CASE WHEN pper.tf >= 50 THEN 'S' ELSE 'L' END,
      CASE WHEN pper.jp >= 50 THEN 'C' ELSE 'P' END
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

COMMENT ON VIEW player_intelligence_card IS 'Single-query Player Intelligence Card dossier: identity + profile + personality + market + status.';

-- ── Update personality_style view ────────────────────────────────────────────

CREATE OR REPLACE VIEW personality_style AS
SELECT
  p.id                AS person_id,
  p.name,

  -- WHO: Personality
  pper.ei,
  pper.sn,
  pper.tf,
  pper.jp,
  pper.competitiveness,
  pper.coachability,
  CASE WHEN pper.ei IS NOT NULL THEN
    CONCAT(
      CASE WHEN pper.ei >= 50 THEN 'A' ELSE 'I' END,
      CASE WHEN pper.sn >= 50 THEN 'X' ELSE 'N' END,
      CASE WHEN pper.tf >= 50 THEN 'S' ELSE 'L' END,
      CASE WHEN pper.jp >= 50 THEN 'C' ELSE 'P' END
    )
  END                 AS personality_type,

  -- HOW: Playing style
  pp.position,
  pp.archetype,
  pp.model_id,
  pp.blueprint,
  pp.profile_tier

FROM people p
LEFT JOIN player_personality pper ON pper.person_id = p.id
LEFT JOIN player_profiles pp      ON pp.person_id = p.id;

COMMENT ON VIEW personality_style IS 'WHO (personality) + HOW (playing style) combined view for the Player Intelligence Card display.';
