-- 007_player_intelligence_cards.sql — Migration 007 for Chief Scout
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).
-- Adds the Player Intelligence Cards data layer:
--   • key_moments table (editorial moments linked to news stories)
--   • profile_tier column on player_profiles
--   • player_intelligence_card view (single-query dossier)
--   • personality_style view (WHO + HOW combined)
--   • Supporting indexes and RLS policies

-- ── Key Moments table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS key_moments (
  id              bigserial PRIMARY KEY,
  person_id       bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  news_story_id   uuid REFERENCES news_stories(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  moment_date     date,
  moment_type     text,          -- 'goal', 'assist', 'performance', 'controversy', 'milestone'
  source_url      text,          -- external link when no news_story linked
  sentiment       text,          -- 'positive', 'negative', 'neutral'
  display_order   integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE key_moments IS 'Editorial key moments per player, optionally linked to news_stories for evidence.';
COMMENT ON COLUMN key_moments.title IS 'Editorial label, e.g. "Derby della Mole solo goal"';
COMMENT ON COLUMN key_moments.moment_type IS 'One of: goal, assist, performance, controversy, milestone';
COMMENT ON COLUMN key_moments.sentiment IS 'One of: positive, negative, neutral';

-- ── Indexes for key_moments ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS key_moments_person_id_idx ON key_moments(person_id);
CREATE INDEX IF NOT EXISTS key_moments_news_story_id_idx ON key_moments(news_story_id);

-- ── RLS for key_moments ────────────────────────────────────────────────────

ALTER TABLE key_moments ENABLE ROW LEVEL SECURITY;

-- Anon read access (public viewer)
DO $$ BEGIN
  CREATE POLICY "anon read key_moments"
    ON key_moments FOR SELECT
    TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated read access
DO $$ BEGIN
  CREATE POLICY "authenticated read key_moments"
    ON key_moments FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role full access (insert/update/delete via backend)
DO $$ BEGIN
  CREATE POLICY "service_role all key_moments"
    ON key_moments FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Updated-at trigger for key_moments ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS key_moments_updated_at ON key_moments;
CREATE TRIGGER key_moments_updated_at
  BEFORE UPDATE ON key_moments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Profile tier on player_profiles ────────────────────────────────────────

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS profile_tier smallint DEFAULT 3;

-- Add check constraint (1=full intelligence card, 2=data-derived, 3=skeleton)
DO $$ BEGIN
  ALTER TABLE player_profiles
    ADD CONSTRAINT player_profiles_tier_check CHECK (profile_tier BETWEEN 1 AND 3);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mark existing profiles as Tier 1 (the 21 scout-assessed profiles)
-- These are profiles that have an archetype set (indicating deep assessment)
UPDATE player_profiles
SET profile_tier = 1
WHERE archetype IS NOT NULL
  AND profile_tier IS DISTINCT FROM 1;

CREATE INDEX IF NOT EXISTS player_profiles_tier_idx ON player_profiles(profile_tier);

-- ── Player Intelligence Card view ──────────────────────────────────────────
-- Single-query dossier combining identity, profile, personality, market, status.

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

COMMENT ON VIEW player_intelligence_card IS 'Single-query Player Intelligence Card dossier: identity + profile + personality + market + status.';

-- ── Personality + Style view (WHO + HOW) ───────────────────────────────────
-- Lightweight view pairing personality (WHO the player is) with playing style (HOW they play).

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
      CASE WHEN pper.ei >= 50 THEN 'E' ELSE 'I' END,
      CASE WHEN pper.sn >= 50 THEN 'S' ELSE 'N' END,
      CASE WHEN pper.tf >= 50 THEN 'T' ELSE 'F' END,
      CASE WHEN pper.jp >= 50 THEN 'J' ELSE 'P' END
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
