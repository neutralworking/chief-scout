-- 041: Add earned archetype columns to player_intelligence_card view
-- Exposes earned_archetype, archetype_tier, legacy_tag, behavioral_tag from player_profiles

CREATE OR REPLACE VIEW player_intelligence_card AS
SELECT
  p.id AS person_id,
  p.name,
  p.date_of_birth AS dob,
  p.height_cm,
  p.preferred_foot,
  p.active,
  p.wikidata_id,
  p.image_url,
  p.place_of_birth,
  p.transfermarkt_id,
  p.wikidata_position,
  p.club_id,
  n.name AS nation,
  c.clubname AS club,
  pp.position,
  pp.level,
  pp.overall,
  pp.archetype,
  pp.model_id,
  pp.blueprint,
  pp.profile_tier,
  pp.technical_score,
  pp.tactical_score,
  pp.mental_score,
  pp.physical_score,
  pp.overall_pillar_score,
  pp.best_role,
  pp.best_role_score,
  pp.fingerprint,
  pp.side,
  pp.earned_archetype,
  pp.archetype_tier,
  pp.legacy_tag,
  pp.behavioral_tag,
  pp.legacy_score,
  pper.ei,
  pper.sn,
  pper.tf,
  pper.jp,
  pper.competitiveness,
  pper.coachability,
  pper.confidence AS personality_confidence,
  CASE
    WHEN pper.ei IS NOT NULL AND pper.sn IS NOT NULL AND pper.tf IS NOT NULL AND pper.jp IS NOT NULL THEN concat(
      CASE WHEN pper.ei >= 50 THEN 'A' ELSE 'I' END,
      CASE WHEN pper.sn >= 50 THEN 'X' ELSE 'N' END,
      CASE WHEN pper.tf >= 50 THEN 'S' ELSE 'L' END,
      CASE WHEN pper.jp >= 50 THEN 'C' ELSE 'P' END
    )
    ELSE NULL
  END AS personality_type,
  pm.market_value_tier,
  pm.true_mvt,
  pm.market_premium,
  pm.scarcity_score,
  pm.transfer_fee_eur,
  pm.hg,
  pm.market_value_eur,
  pm.highest_market_value_eur,
  pm.market_value_date,
  pm.director_valuation_meur,
  ps.pursuit_status,
  ps.scouting_notes,
  ps.squad_role,
  ps.loan_status,
  p.kc
FROM people p
LEFT JOIN nations n ON n.id = p.nation_id
LEFT JOIN clubs c ON c.id = p.club_id
LEFT JOIN player_profiles pp ON pp.person_id = p.id
LEFT JOIN player_personality pper ON pper.person_id = p.id
LEFT JOIN player_market pm ON pm.person_id = p.id
LEFT JOIN player_status ps ON ps.person_id = p.id;

COMMENT ON VIEW player_intelligence_card IS 'Single-query Player Intelligence Card dossier with earned archetypes and four-pillar scores.';
