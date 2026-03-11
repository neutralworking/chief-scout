-- ============================================================
-- 008 — Left-Back Profiles: Calafiori & Chilwell
-- Chief Scout assessment 2026-03-09
-- Addresses DOF-flagged coverage gap: zero LBs profiled
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. RICCARDO CALAFIORI — Arsenal
-- ──────────────────────────────────────────────────────────────

INSERT INTO people (name, dob, height_cm, preferred_foot, nation_id, club_id, active)
VALUES (
  'Riccardo Calafiori',
  '2002-05-19',
  188,
  'Left',
  (SELECT id FROM nations WHERE name = 'Italy'),
  (SELECT id FROM clubs WHERE name = 'Arsenal'),
  true
)
ON CONFLICT DO NOTHING
RETURNING id;

-- Store the person_id for subsequent inserts
-- (Use a CTE approach for idempotent re-runs)
WITH calafiori AS (
  SELECT id FROM people WHERE name = 'Riccardo Calafiori' LIMIT 1
)

-- Profile
INSERT INTO player_profiles (person_id, position, level, peak, overall, archetype, blueprint, profile_tier)
SELECT id, 'WD', 83, 88, 83, 'Passer-Cover', 'Ball-Playing Fullback', 1
FROM calafiori
ON CONFLICT (person_id) DO UPDATE SET
  position     = EXCLUDED.position,
  level        = EXCLUDED.level,
  peak         = EXCLUDED.peak,
  overall      = EXCLUDED.overall,
  archetype    = EXCLUDED.archetype,
  blueprint    = EXCLUDED.blueprint,
  profile_tier = EXCLUDED.profile_tier,
  updated_at   = now();

WITH calafiori AS (
  SELECT id FROM people WHERE name = 'Riccardo Calafiori' LIMIT 1
)
INSERT INTO player_personality (person_id, ei, sn, tf, jp, competitiveness, coachability)
SELECT id,
  72,   -- ei: high = Analytical (A) — structured, reads the game through patterns
  30,   -- sn: low = Intrinsic (N) — self-motivated, consistent output
  35,   -- tf: low = Leader (L) — vocal, organizes the backline
  68    -- jp: high = Competitor (C) — front-footed, aggressive, thrives on confrontation
  , 8, 8
FROM calafiori
ON CONFLICT (person_id) DO UPDATE SET
  ei = EXCLUDED.ei, sn = EXCLUDED.sn, tf = EXCLUDED.tf, jp = EXCLUDED.jp,
  competitiveness = EXCLUDED.competitiveness, coachability = EXCLUDED.coachability,
  updated_at = now();

WITH calafiori AS (
  SELECT id FROM people WHERE name = 'Riccardo Calafiori' LIMIT 1
)
INSERT INTO player_market (person_id, market_value_tier, true_mvt, market_premium, scarcity_score, transfer_fee_eur, hg)
SELECT id, 2, 2, 1, 75, 42000000, false
FROM calafiori
ON CONFLICT (person_id) DO UPDATE SET
  market_value_tier = EXCLUDED.market_value_tier,
  true_mvt          = EXCLUDED.true_mvt,
  market_premium    = EXCLUDED.market_premium,
  scarcity_score    = EXCLUDED.scarcity_score,
  transfer_fee_eur  = EXCLUDED.transfer_fee_eur,
  updated_at        = now();

WITH calafiori AS (
  SELECT id FROM people WHERE name = 'Riccardo Calafiori' LIMIT 1
)
INSERT INTO player_status (person_id, pursuit_status, scouting_notes, squad_role)
SELECT id, 'Monitor',
  E'Ball-playing LCB/LB hybrid. Smooth progressive carrier — drives from deep with power and close control. '
  E'Shields the ball exceptionally well under pressure. Strong in wide-channel defending. '
  E'Aerial presence at 188cm unusual for a fullback. Passing range from deep is a standout trait. '
  E'Still adapting to Premier League intensity. Arteta uses him as inverted LB and LCB in a back 3. '
  E'Italy international — started Euro 2024 group stages. High ceiling if he stays fit. '
  E'Verdict: Monitor — already at a top club, not available, but track development.',
  'rotation'
FROM calafiori
ON CONFLICT (person_id) DO UPDATE SET
  pursuit_status = EXCLUDED.pursuit_status,
  scouting_notes = EXCLUDED.scouting_notes,
  squad_role     = EXCLUDED.squad_role,
  updated_at     = now();

-- Calafiori: Attribute Grades (scout-inferred from video + public data)
WITH calafiori AS (
  SELECT id FROM people WHERE name = 'Riccardo Calafiori' LIMIT 1
)
INSERT INTO attribute_grades (player_id, attribute, scout_grade, stat_score, source, is_inferred, confidence)
SELECT calafiori.id, v.attribute, v.scout_grade, v.stat_score, 'scout_assessment', false, v.confidence
FROM calafiori,
(VALUES
  -- TECHNICAL: Dribbler model
  ('carries',         15, NULL, 'High'),
  ('first_touch',     14, NULL, 'High'),
  ('skills',          11, NULL, 'Medium'),
  ('take_ons',        12, NULL, 'Medium'),
  -- TECHNICAL: Passer model
  ('pass_accuracy',   15, NULL, 'High'),
  ('crossing',        13, NULL, 'Medium'),
  ('pass_range',      16, NULL, 'High'),
  ('through_balls',   12, NULL, 'Medium'),
  -- TACTICAL: Cover model
  ('awareness',       15, NULL, 'High'),
  ('discipline',      14, NULL, 'High'),
  ('interceptions',   14, NULL, 'Medium'),
  ('positioning',     14, NULL, 'High'),
  -- TACTICAL: Destroyer model
  ('blocking',        13, NULL, 'Medium'),
  ('clearances',      13, NULL, 'Medium'),
  ('marking',         13, NULL, 'Medium'),
  ('tackling',        14, NULL, 'High'),
  -- TACTICAL: Engine model
  ('intensity',       14, NULL, 'Medium'),
  ('pressing',        13, NULL, 'Medium'),
  ('stamina',         14, NULL, 'Medium'),
  ('versatility',     16, NULL, 'High'),
  -- PHYSICAL: Sprinter model
  ('acceleration',    13, NULL, 'Medium'),
  ('balance',         13, NULL, 'Medium'),
  ('movement',        13, NULL, 'Medium'),
  ('pace',            12, NULL, 'Medium'),
  -- PHYSICAL: Powerhouse model
  ('aggression',      14, NULL, 'High'),
  ('duels',           14, NULL, 'Medium'),
  ('shielding',       16, NULL, 'High'),
  ('throwing',        10, NULL, 'Low'),
  -- PHYSICAL: Target model
  ('aerial_duels',    15, NULL, 'High'),
  ('heading',         13, NULL, 'Medium'),
  ('jumping',         14, NULL, 'Medium'),
  ('volleys',         10, NULL, 'Low')
) AS v(attribute, scout_grade, stat_score, confidence)
ON CONFLICT (player_id, attribute, source) DO UPDATE SET
  scout_grade = EXCLUDED.scout_grade,
  confidence  = EXCLUDED.confidence,
  updated_at  = now();


-- ──────────────────────────────────────────────────────────────
-- 2. BEN CHILWELL — Chelsea
-- ──────────────────────────────────────────────────────────────

INSERT INTO people (name, dob, height_cm, preferred_foot, nation_id, club_id, active)
VALUES (
  'Ben Chilwell',
  '1996-12-21',
  178,
  'Left',
  (SELECT id FROM nations WHERE name = 'England'),
  (SELECT id FROM clubs WHERE name = 'Chelsea'),
  true
)
ON CONFLICT DO NOTHING
RETURNING id;

WITH chilwell AS (
  SELECT id FROM people WHERE name = 'Ben Chilwell' LIMIT 1
)
INSERT INTO player_profiles (person_id, position, level, peak, overall, archetype, blueprint, profile_tier)
SELECT id, 'WD', 74, 84, 74, 'Passer-Engine', 'Attacking Fullback', 1
FROM chilwell
ON CONFLICT (person_id) DO UPDATE SET
  position     = EXCLUDED.position,
  level        = EXCLUDED.level,
  peak         = EXCLUDED.peak,
  overall      = EXCLUDED.overall,
  archetype    = EXCLUDED.archetype,
  blueprint    = EXCLUDED.blueprint,
  profile_tier = EXCLUDED.profile_tier,
  updated_at   = now();

WITH chilwell AS (
  SELECT id FROM people WHERE name = 'Ben Chilwell' LIMIT 1
)
INSERT INTO player_personality (person_id, ei, sn, tf, jp, competitiveness, coachability)
SELECT id,
  65,   -- ei: Analytical (A) — positionally coached, follows tactical shape
  60,   -- sn: leaning Extrinsic (X) — big-game performer, occasion-driven
  40,   -- tf: leaning Leader (L) — vocal at Leicester and England, organizes
  38    -- jp: leaning Composer (P) — composed on the ball, calm under press
  , 6, 7
FROM chilwell
ON CONFLICT (person_id) DO UPDATE SET
  ei = EXCLUDED.ei, sn = EXCLUDED.sn, tf = EXCLUDED.tf, jp = EXCLUDED.jp,
  competitiveness = EXCLUDED.competitiveness, coachability = EXCLUDED.coachability,
  updated_at = now();

WITH chilwell AS (
  SELECT id FROM people WHERE name = 'Ben Chilwell' LIMIT 1
)
INSERT INTO player_market (person_id, market_value_tier, true_mvt, market_premium, scarcity_score, transfer_fee_eur, hg)
SELECT id, 4, 5, -2, 20, 55800000, true
FROM chilwell
ON CONFLICT (person_id) DO UPDATE SET
  market_value_tier = EXCLUDED.market_value_tier,
  true_mvt          = EXCLUDED.true_mvt,
  market_premium    = EXCLUDED.market_premium,
  scarcity_score    = EXCLUDED.scarcity_score,
  transfer_fee_eur  = EXCLUDED.transfer_fee_eur,
  updated_at        = now();

WITH chilwell AS (
  SELECT id FROM people WHERE name = 'Ben Chilwell' LIMIT 1
)
INSERT INTO player_status (person_id, pursuit_status, scouting_notes, squad_role, fitness_tag, contract_tag)
SELECT id, 'Pass',
  E'Once a top-tier attacking LB — excellent crosser, intelligent runner, good final-third output. '
  E'ACL tear (Nov 2021) was the turning point. Recurring knee issues have limited him to fragments since. '
  E'Managed just ~30 PL appearances across 2022-23, 2023-24, and 2024-25 seasons combined. '
  E'At 29, the physical decline from chronic injury is severe — pace, acceleration, and recovery all diminished. '
  E'Chelsea looking to move him on. Contract situation complicated (high wages, low suitors). '
  E'England career effectively over. Was a starter under Southgate pre-injury. '
  E'Verdict: Pass — too much injury risk and physical decline. The player we''d be signing no longer exists.',
  'surplus',
  'injury_prone',
  'expiring'
FROM chilwell
ON CONFLICT (person_id) DO UPDATE SET
  pursuit_status = EXCLUDED.pursuit_status,
  scouting_notes = EXCLUDED.scouting_notes,
  squad_role     = EXCLUDED.squad_role,
  fitness_tag    = EXCLUDED.fitness_tag,
  contract_tag   = EXCLUDED.contract_tag,
  updated_at     = now();

-- Chilwell: Attribute Grades (pre-injury peak in parenthetical notes; current grades reflect post-injury state)
WITH chilwell AS (
  SELECT id FROM people WHERE name = 'Ben Chilwell' LIMIT 1
)
INSERT INTO attribute_grades (player_id, attribute, scout_grade, stat_score, source, is_inferred, confidence)
SELECT chilwell.id, v.attribute, v.scout_grade, v.stat_score, 'scout_assessment', false, v.confidence
FROM chilwell,
(VALUES
  -- TECHNICAL: Dribbler model
  ('carries',         11, NULL, 'Medium'),     -- was 14 pre-injury
  ('first_touch',     13, NULL, 'Medium'),
  ('skills',          10, NULL, 'Low'),
  ('take_ons',        10, NULL, 'Low'),        -- was 13
  -- TECHNICAL: Passer model
  ('pass_accuracy',   14, NULL, 'Medium'),
  ('crossing',        15, NULL, 'High'),       -- still his best trait
  ('pass_range',      13, NULL, 'Medium'),
  ('through_balls',   11, NULL, 'Medium'),
  -- TACTICAL: Cover model
  ('awareness',       13, NULL, 'Medium'),
  ('discipline',      13, NULL, 'Medium'),
  ('interceptions',   12, NULL, 'Low'),
  ('positioning',     13, NULL, 'Medium'),
  -- TACTICAL: Destroyer model
  ('blocking',        10, NULL, 'Low'),
  ('clearances',      11, NULL, 'Low'),
  ('marking',         11, NULL, 'Low'),
  ('tackling',        12, NULL, 'Medium'),
  -- TACTICAL: Engine model
  ('intensity',       10, NULL, 'Medium'),     -- was 14 pre-injury
  ('pressing',        10, NULL, 'Medium'),     -- was 13
  ('stamina',         10, NULL, 'Medium'),     -- was 14, biggest concern
  ('versatility',     11, NULL, 'Medium'),
  -- PHYSICAL: Sprinter model
  ('acceleration',    10, NULL, 'Medium'),     -- was 14 pre-injury
  ('balance',         12, NULL, 'Medium'),
  ('movement',        13, NULL, 'Medium'),     -- still reads the game
  ('pace',            10, NULL, 'Medium'),     -- was 14, significant loss
  -- PHYSICAL: Powerhouse model
  ('aggression',      11, NULL, 'Medium'),
  ('duels',           11, NULL, 'Low'),
  ('shielding',       11, NULL, 'Low'),
  ('throwing',        10, NULL, 'Low'),
  -- PHYSICAL: Target model
  ('aerial_duels',    11, NULL, 'Low'),
  ('heading',         10, NULL, 'Low'),
  ('jumping',         10, NULL, 'Low'),
  ('volleys',         10, NULL, 'Low')
) AS v(attribute, scout_grade, stat_score, confidence)
ON CONFLICT (player_id, attribute, source) DO UPDATE SET
  scout_grade = EXCLUDED.scout_grade,
  confidence  = EXCLUDED.confidence,
  updated_at  = now();

COMMIT;
