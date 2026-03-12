-- 015_transfermarkt_market_values.sql — Add Transfermarkt market value columns
-- Run in Supabase SQL Editor (Dashboard -> SQL Editor).

-- Add market value columns to player_market
ALTER TABLE player_market ADD COLUMN IF NOT EXISTS market_value_eur bigint;
ALTER TABLE player_market ADD COLUMN IF NOT EXISTS highest_market_value_eur bigint;
ALTER TABLE player_market ADD COLUMN IF NOT EXISTS market_value_date date;

-- Create transfermarkt_valuations table for historical data
CREATE TABLE IF NOT EXISTS transfermarkt_valuations (
    id              bigserial PRIMARY KEY,
    person_id       bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    transfermarkt_id text NOT NULL,
    date            date NOT NULL,
    market_value_eur bigint NOT NULL,
    club_name       text,
    club_id         integer,
    competition_id  text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (person_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tm_valuations_person ON transfermarkt_valuations(person_id);
CREATE INDEX IF NOT EXISTS idx_tm_valuations_date ON transfermarkt_valuations(date DESC);

-- RLS
ALTER TABLE transfermarkt_valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read transfermarkt_valuations" ON transfermarkt_valuations FOR SELECT USING (true);

-- Update player_intelligence_card view to include market values
DROP VIEW IF EXISTS player_intelligence_card;

CREATE OR REPLACE VIEW player_intelligence_card AS
SELECT
  p.id                AS person_id,
  p.name,
  p.date_of_birth    AS dob,
  p.height_cm,
  p.preferred_foot,
  p.active,
  p.wikidata_id,
  p.image_url,
  p.place_of_birth,
  p.transfermarkt_id,
  p.wikidata_position,

  n.name              AS nation,
  c.clubname          AS club,

  pp.position,
  pp.level,
  pp.peak,
  pp.overall,
  pp.archetype,
  pp.model_id,
  pp.blueprint,
  pp.profile_tier,

  pper.ei,
  pper.sn,
  pper.tf,
  pper.jp,
  pper.competitiveness,
  pper.coachability,
  pper.confidence     AS personality_confidence,
  CASE WHEN pper.ei IS NOT NULL AND pper.sn IS NOT NULL AND pper.tf IS NOT NULL AND pper.jp IS NOT NULL THEN
    CONCAT(
      CASE WHEN pper.ei >= 50 THEN 'A' ELSE 'I' END,
      CASE WHEN pper.sn >= 50 THEN 'X' ELSE 'N' END,
      CASE WHEN pper.tf >= 50 THEN 'S' ELSE 'L' END,
      CASE WHEN pper.jp >= 50 THEN 'C' ELSE 'P' END
    )
  END                 AS personality_type,

  pm.market_value_tier,
  pm.true_mvt,
  pm.market_premium,
  pm.scarcity_score,
  pm.transfer_fee_eur,
  pm.hg,
  pm.market_value_eur,
  pm.highest_market_value_eur,
  pm.market_value_date,

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

-- Recreate personality_style view (depends on same tables)
DROP VIEW IF EXISTS personality_style;

CREATE OR REPLACE VIEW personality_style AS
SELECT
  p.id                AS person_id,
  p.name,
  pper.ei,
  pper.sn,
  pper.tf,
  pper.jp,
  pper.competitiveness,
  pper.coachability,
  CASE WHEN pper.ei IS NOT NULL AND pper.sn IS NOT NULL AND pper.tf IS NOT NULL AND pper.jp IS NOT NULL THEN
    CONCAT(
      CASE WHEN pper.ei >= 50 THEN 'A' ELSE 'I' END,
      CASE WHEN pper.sn >= 50 THEN 'X' ELSE 'N' END,
      CASE WHEN pper.tf >= 50 THEN 'S' ELSE 'L' END,
      CASE WHEN pper.jp >= 50 THEN 'C' ELSE 'P' END
    )
  END                 AS personality_type,
  pp.position,
  pp.archetype,
  pp.model_id,
  pp.blueprint,
  pp.profile_tier

FROM people p
LEFT JOIN player_personality pper ON pper.person_id = p.id
LEFT JOIN player_profiles pp      ON pp.person_id = p.id;

COMMENT ON VIEW personality_style IS 'WHO (personality) + HOW (playing style) combined view.';
