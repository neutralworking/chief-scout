-- =============================================================================
-- Chief Scout — Supabase Migration
-- Availability System + Full Game Data Schema
-- Safe to run on existing databases (uses IF NOT EXISTS throughout)
-- =============================================================================

-- =============================================================================
-- SECTION 1: ENUM TYPES
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE transfer_status_enum AS ENUM (
    'not_for_sale', 'available', 'listed', 'loan_available',
    'free_agent', 'approached', 'agreed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE squad_status_enum AS ENUM (
    'key_player', 'important_player', 'rotation', 'backup', 'youth', 'loanee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE player_model_enum AS ENUM (
    'Controller', 'Commander', 'Creator',
    'Target', 'Sprinter', 'Powerhouse',
    'Cover', 'Engine', 'Destroyer',
    'Dribbler', 'Passer', 'Striker', 'GK'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE model_category_enum AS ENUM (
    'Mental', 'Physical', 'Tactical', 'Technical', 'Goalkeeper'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE availability_tier_enum AS ENUM (
    'HOT', 'WARM', 'POSSIBLE', 'DIFFICULT', 'LOCKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE offensive_style_enum AS ENUM (
    'Overload', 'Positional', 'Flair', 'Possession', 'Relational',
    'Wing Play', 'Balanced', 'Direct', 'Counter', 'Cautious'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE defensive_style_enum AS ENUM (
    'Full Press', 'High Press', 'Hybrid Press', 'Balanced', 'Adaptive',
    'Compact', 'Structured', 'Aggressive', 'Low Block', 'Park The Bus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE team_tactical_style_enum AS ENUM (
    'Tika-Taka', 'Total', 'Gegenpress', 'Garra Charrua',
    'Joga Bonito', 'Fluid', 'Pragmatic', 'POMO', 'Catennacio'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scout_recommendation_enum AS ENUM (
    'Sign', 'Monitor', 'Reject', 'Loan'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE foot_enum AS ENUM ('Right', 'Left', 'Both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE compatibility_enum AS ENUM (
    'Easy', 'Moderate', 'Difficult', 'Very Difficult'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agent_offer_status_enum AS ENUM (
    'pending', 'negotiating', 'accepted', 'rejected', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transfer_news_type_enum AS ENUM (
    'listing', 'rumour', 'contract_update', 'market_trend', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- SECTION 2: CORE REFERENCE TABLES
-- =============================================================================

-- Player archetypes (13 models)
CREATE TABLE IF NOT EXISTS player_models (
  id              SERIAL PRIMARY KEY,
  name            player_model_enum NOT NULL UNIQUE,
  category        model_category_enum NOT NULL,
  attribute_1     TEXT NOT NULL,
  attribute_2     TEXT NOT NULL,
  attribute_3     TEXT NOT NULL,
  attribute_4     TEXT NOT NULL,
  description     TEXT
);

-- All 52 player attributes
CREATE TABLE IF NOT EXISTS attributes_master (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  short_code      VARCHAR(4) NOT NULL,
  category        model_category_enum NOT NULL,
  player_model_id INT REFERENCES player_models(id) ON DELETE SET NULL,
  display_order   INT
);

-- Tactical style compatibility matrix
CREATE TABLE IF NOT EXISTS style_compatibility (
  id                   SERIAL PRIMARY KEY,
  from_style           TEXT NOT NULL,
  to_style             TEXT NOT NULL,
  compatibility        compatibility_enum NOT NULL,
  adaptation_weeks     INT NOT NULL,
  performance_modifier DECIMAL(4,2) NOT NULL, -- e.g. -0.10 = -10% performance
  UNIQUE(from_style, to_style)
);

-- Player model → tactical style affinity
CREATE TABLE IF NOT EXISTS model_style_affinity (
  id              SERIAL PRIMARY KEY,
  player_model    player_model_enum NOT NULL,
  tactical_style  TEXT NOT NULL,
  affinity        INT NOT NULL CHECK (affinity BETWEEN 0 AND 100),
  UNIQUE(player_model, tactical_style)
);

-- Director RPG attributes
CREATE TABLE IF NOT EXISTS director_attributes (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  related_attribute   TEXT NOT NULL,
  description         TEXT NOT NULL,
  staff_member        TEXT,
  current_value       INT NOT NULL DEFAULT 1 CHECK (current_value BETWEEN 1 AND 20),
  max_value           INT NOT NULL DEFAULT 20,
  availability_effect TEXT  -- describes how this stat affects the availability system
);

-- =============================================================================
-- SECTION 3: WORLD DATA TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS nations (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  football_culture    TEXT,   -- e.g. 'Possession-Oriented', 'Defensive-Minded'
  is_top_tier_league  BOOLEAN NOT NULL DEFAULT FALSE,
  reputation_modifier INT NOT NULL DEFAULT 0  -- bonus/penalty to player value
);

CREATE TABLE IF NOT EXISTS clubs (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  model_club            TEXT,                          -- historical reference club
  nation_id             INT REFERENCES nations(id),
  league_tier           INT CHECK (league_tier BETWEEN 1 AND 4),
  reputation            INT CHECK (reputation BETWEEN 0 AND 100),
  formation             TEXT,
  team_tactical_style   team_tactical_style_enum,
  offensive_style       offensive_style_enum,
  defensive_style       defensive_style_enum,
  budget_transfer       BIGINT DEFAULT 0,
  budget_wages_weekly   BIGINT DEFAULT 0,
  is_user_club          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SECTION 4: PLAYER TABLE (Availability centrepiece)
-- =============================================================================

CREATE TABLE IF NOT EXISTS players (
  id                        SERIAL PRIMARY KEY,
  name                      TEXT NOT NULL,
  age                       INT,
  nation_id                 INT REFERENCES nations(id),
  club_id                   INT REFERENCES clubs(id),
  position                  TEXT,
  foot                      foot_enum,

  -- Core ratings (hidden until scouted)
  level                     INT CHECK (level BETWEEN 1 AND 100),
  potential_level           INT CHECK (potential_level BETWEEN 1 AND 100),
  player_model              player_model_enum,
  secondary_model           player_model_enum,

  -- === AVAILABILITY PILLARS ===

  -- Pillar 1: Transfer Status (35% weight)
  transfer_status           transfer_status_enum NOT NULL DEFAULT 'not_for_sale',

  -- Pillar 2: Contract Situation (25% weight)
  contract_expiry           DATE,
  contract_months_remaining INT GENERATED ALWAYS AS (
    GREATEST(0,
      EXTRACT(YEAR FROM AGE(contract_expiry, CURRENT_DATE))::INT * 12 +
      EXTRACT(MONTH FROM AGE(contract_expiry, CURRENT_DATE))::INT
    )
  ) STORED,

  -- Pillar 3: Player Interest (20% weight) — 0 = wants to stay, 100 = desperate to leave
  player_interest           INT NOT NULL DEFAULT 50 CHECK (player_interest BETWEEN 0 AND 100),

  -- Pillar 4: Squad Status (10% weight)
  squad_status              squad_status_enum NOT NULL DEFAULT 'rotation',

  -- Financial data
  wage_weekly               INT DEFAULT 0,
  transfer_value            BIGINT DEFAULT 0,

  -- Nation/Career status
  nation_status             TEXT,  -- 'National Squad', 'Under-21', 'No Cap', etc.

  -- Scouting intel flags
  is_scouted                BOOLEAN NOT NULL DEFAULT FALSE,
  is_shortlisted            BOOLEAN NOT NULL DEFAULT FALSE,
  scout_report_count        INT NOT NULL DEFAULT 0,

  -- All 52 attributes stored as JSONB for flexibility
  -- Keys match attributes_master.name, values 1-20
  attributes                JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS players_updated_at ON players;
CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_players_updated_at();

-- =============================================================================
-- SECTION 5: AVAILABILITY SCORE FUNCTION (The Centrepiece)
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_availability_score(
  p_transfer_status     transfer_status_enum,
  p_contract_months     INT,
  p_player_interest     INT,
  p_squad_status        squad_status_enum,
  p_player_club_rep     INT,
  p_user_club_rep       INT
) RETURNS INT AS $$
DECLARE
  v_transfer_score  INT;
  v_contract_score  INT;
  v_interest_score  INT;
  v_squad_score     INT;
  v_rep_score       INT;
  v_rep_gap         INT;
  v_total           NUMERIC;
BEGIN
  -- Pillar 1: Transfer Status (35%)
  v_transfer_score := CASE p_transfer_status
    WHEN 'free_agent'      THEN 100
    WHEN 'listed'          THEN 85
    WHEN 'loan_available'  THEN 70
    WHEN 'available'       THEN 55
    WHEN 'approached'      THEN 40
    WHEN 'agreed'          THEN 95
    WHEN 'not_for_sale'    THEN 10
    ELSE 10
  END;

  -- Pillar 2: Contract Situation (25%)
  v_contract_score := CASE
    WHEN p_contract_months IS NULL  THEN 50   -- unknown
    WHEN p_contract_months = 0      THEN 100  -- expired / free agent
    WHEN p_contract_months <= 6     THEN 85   -- Bosman window
    WHEN p_contract_months <= 12    THEN 65
    WHEN p_contract_months <= 18    THEN 45
    WHEN p_contract_months <= 24    THEN 30
    WHEN p_contract_months <= 36    THEN 20
    ELSE 10
  END;

  -- Pillar 3: Player Interest (20%) — direct pass-through
  v_interest_score := COALESCE(p_player_interest, 50);

  -- Pillar 4: Squad Status (10%)
  v_squad_score := CASE p_squad_status
    WHEN 'youth'             THEN 80
    WHEN 'backup'            THEN 70
    WHEN 'loanee'            THEN 60
    WHEN 'rotation'          THEN 50
    WHEN 'important_player'  THEN 25
    WHEN 'key_player'        THEN 10
    ELSE 40
  END;

  -- Pillar 5: Reputation Gap (10%)
  v_rep_gap := COALESCE(p_user_club_rep, 65) - COALESCE(p_player_club_rep, 65);
  v_rep_score := CASE
    WHEN v_rep_gap >= 20  THEN 90
    WHEN v_rep_gap >= 10  THEN 75
    WHEN v_rep_gap >= 0   THEN 60
    WHEN v_rep_gap >= -10 THEN 40
    WHEN v_rep_gap >= -20 THEN 20
    ELSE 5
  END;

  -- Weighted composite
  v_total := (v_transfer_score  * 0.35)
           + (v_contract_score  * 0.25)
           + (v_interest_score  * 0.20)
           + (v_squad_score     * 0.10)
           + (v_rep_score       * 0.10);

  RETURN ROUND(v_total)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Availability tier classifier
CREATE OR REPLACE FUNCTION get_availability_tier(score INT)
RETURNS availability_tier_enum AS $$
BEGIN
  RETURN CASE
    WHEN score >= 80 THEN 'HOT'::availability_tier_enum
    WHEN score >= 60 THEN 'WARM'::availability_tier_enum
    WHEN score >= 40 THEN 'POSSIBLE'::availability_tier_enum
    WHEN score >= 20 THEN 'DIFFICULT'::availability_tier_enum
    ELSE 'LOCKED'::availability_tier_enum
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Style fit score: how well a player model fits a club's tactical style
CREATE OR REPLACE FUNCTION calculate_style_fit_score(
  p_player_model    player_model_enum,
  p_tactical_style  TEXT
) RETURNS INT AS $$
DECLARE
  v_affinity INT;
BEGIN
  SELECT affinity INTO v_affinity
  FROM model_style_affinity
  WHERE player_model = p_player_model
    AND tactical_style = p_tactical_style;

  RETURN COALESCE(v_affinity, 50); -- default 50 if no explicit mapping
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- SECTION 6: SCOUTING WORKFLOW TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS shortlists (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  colour      TEXT DEFAULT '#3B82F6',  -- for UI display
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shortlist_entries (
  id            SERIAL PRIMARY KEY,
  shortlist_id  INT NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
  player_id     INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  priority      INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  notes         TEXT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shortlist_id, player_id)
);

CREATE TABLE IF NOT EXISTS scout_reports (
  id                  SERIAL PRIMARY KEY,
  player_id           INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  scout_name          TEXT,
  report_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  summary             TEXT,
  model_identified    player_model_enum,
  level_estimated     INT CHECK (level_estimated BETWEEN 1 AND 100),
  potential_estimated INT CHECK (potential_estimated BETWEEN 1 AND 100),
  recommendation      scout_recommendation_enum,
  data_sources        TEXT[],   -- ['video', 'stats', 'live_observation', 'agent_report']
  raw_notes           TEXT,
  availability_score_at_report INT,  -- snapshot of score when report was written
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_news (
  id           SERIAL PRIMARY KEY,
  player_id    INT REFERENCES players(id) ON DELETE SET NULL,
  club_id      INT REFERENCES clubs(id) ON DELETE SET NULL,
  news_type    transfer_news_type_enum NOT NULL,
  headline     TEXT NOT NULL,
  body         TEXT,
  accuracy     INT DEFAULT 50 CHECK (accuracy BETWEEN 0 AND 100),  -- rumour accuracy %
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ
);

-- =============================================================================
-- SECTION 7: TRANSFER MARKET TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS agents (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  trustworthiness     INT NOT NULL DEFAULT 3 CHECK (trustworthiness BETWEEN 1 AND 5),
  aggressiveness      TEXT CHECK (aggressiveness IN ('Aggressive', 'Moderate', 'Cautious')),
  relationship_score  INT NOT NULL DEFAULT 50 CHECK (relationship_score BETWEEN 0 AND 100),
  deals_completed     INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_offers (
  id                  SERIAL PRIMARY KEY,
  agent_id            INT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  player_id           INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  asking_price        BIGINT,
  weekly_wage_demand  INT,
  hyperbole_level     INT NOT NULL DEFAULT 50 CHECK (hyperbole_level BETWEEN 0 AND 100),
  offer_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  status              agent_offer_status_enum NOT NULL DEFAULT 'pending',
  notes               TEXT
);

-- =============================================================================
-- SECTION 8: VIEWS
-- =============================================================================

-- Main scouting view: all players with computed availability score and tier
CREATE OR REPLACE VIEW players_availability_view AS
SELECT
  p.id,
  p.name,
  p.age,
  n.name                                        AS nationality,
  c.name                                        AS club_name,
  c.reputation                                  AS club_reputation,
  c.league_tier,
  p.position,
  p.foot,
  p.player_model,
  p.secondary_model,
  p.transfer_status,
  p.contract_months_remaining,
  p.player_interest,
  p.squad_status,
  p.wage_weekly,
  p.transfer_value,
  p.nation_status,
  p.is_scouted,
  p.is_shortlisted,
  -- Computed availability score
  calculate_availability_score(
    p.transfer_status,
    p.contract_months_remaining,
    p.player_interest,
    p.squad_status,
    c.reputation,
    65  -- placeholder: replace with user club reputation in app layer
  )                                             AS availability_score,
  -- Computed tier
  get_availability_tier(
    calculate_availability_score(
      p.transfer_status,
      p.contract_months_remaining,
      p.player_interest,
      p.squad_status,
      c.reputation,
      65
    )
  )                                             AS availability_tier,
  p.attributes,
  p.updated_at
FROM players p
LEFT JOIN clubs   c ON c.id = p.club_id
LEFT JOIN nations n ON n.id = p.nation_id;

-- Radar screen view: availability × style fit, ordered for bullseye display
-- In production: pass user_club_rep and tactical_style as parameters or session vars
CREATE OR REPLACE VIEW radar_view AS
SELECT
  p.id,
  p.name,
  p.age,
  p.position,
  p.player_model,
  c.name                                        AS club_name,
  c.team_tactical_style                         AS current_team_style,
  calculate_availability_score(
    p.transfer_status,
    p.contract_months_remaining,
    p.player_interest,
    p.squad_status,
    c.reputation,
    65
  )                                             AS availability_score,
  get_availability_tier(
    calculate_availability_score(
      p.transfer_status,
      p.contract_months_remaining,
      p.player_interest,
      p.squad_status,
      c.reputation,
      65
    )
  )                                             AS availability_tier,
  p.transfer_value,
  p.wage_weekly,
  p.is_scouted,
  p.attributes->>'level' AS level_if_known
FROM players p
LEFT JOIN clubs c ON c.id = p.club_id
ORDER BY availability_score DESC;

-- =============================================================================
-- SECTION 9: INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_players_transfer_status    ON players(transfer_status);
CREATE INDEX IF NOT EXISTS idx_players_squad_status       ON players(squad_status);
CREATE INDEX IF NOT EXISTS idx_players_player_model       ON players(player_model);
CREATE INDEX IF NOT EXISTS idx_players_club_id            ON players(club_id);
CREATE INDEX IF NOT EXISTS idx_players_position           ON players(position);
CREATE INDEX IF NOT EXISTS idx_players_age                ON players(age);
CREATE INDEX IF NOT EXISTS idx_players_is_shortlisted     ON players(is_shortlisted);
CREATE INDEX IF NOT EXISTS idx_players_is_scouted         ON players(is_scouted);
CREATE INDEX IF NOT EXISTS idx_clubs_league_tier          ON clubs(league_tier);
CREATE INDEX IF NOT EXISTS idx_clubs_reputation           ON clubs(reputation);
CREATE INDEX IF NOT EXISTS idx_scout_reports_player       ON scout_reports(player_id);
CREATE INDEX IF NOT EXISTS idx_transfer_news_published    ON transfer_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_shortlist_entries_player   ON shortlist_entries(player_id);
CREATE INDEX IF NOT EXISTS idx_agent_offers_status        ON agent_offers(status);

-- =============================================================================
-- SECTION 10: ROW LEVEL SECURITY (Supabase)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE nations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortlists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_news     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_offers      ENABLE ROW LEVEL SECURITY;

-- Placeholder policies — replace with your auth.uid() logic
-- Example: CREATE POLICY "Users can read all players" ON players FOR SELECT USING (true);
-- Example: CREATE POLICY "Users can update shortlists" ON shortlists FOR ALL USING (auth.uid() IS NOT NULL);

-- =============================================================================
-- SECTION 11: SEED DATA — PLAYER MODELS (13 archetypes)
-- =============================================================================

INSERT INTO player_models (name, category, attribute_1, attribute_2, attribute_3, attribute_4, description)
VALUES
  -- Mental
  ('Controller', 'Mental',    'Anticipation', 'Decisions',   'Composure',  'Tempo',        'Reads the game, controls tempo and rhythm'),
  ('Commander',  'Mental',    'Communication','Drive',        'Leadership', 'Competitiveness','Commands the team, drives standards'),
  ('Creator',    'Mental',    'Creativity',   'Guile',        'Vision',     'Flair',         'Unlocks defences with imagination and invention'),
  -- Physical
  ('Target',     'Physical',  'AerialDuels',  'Heading',      'Jumping',    'Volleys',       'Wins aerial battles, holds up play'),
  ('Sprinter',   'Physical',  'Acceleration', 'Balance',      'Movement',   'Pace',          'Electric pace, thrives on transitions'),
  ('Powerhouse', 'Physical',  'Aggression',   'Duels',        'Shielding',  'Throwing',      'Physical dominance, wins ground battles'),
  -- Tactical
  ('Cover',      'Tactical',  'Awareness',    'Discipline',   'Interceptions','Positioning', 'Smart positional play, reads danger early'),
  ('Engine',     'Tactical',  'Intensity',    'Pressing',     'Stamina',    'Versatility',   'Box-to-box work rate, adapts to any system'),
  ('Destroyer',  'Tactical',  'Blocking',     'Clearances',   'Marking',    'Tackling',      'Defensive enforcer, breaks up attacks'),
  -- Technical
  ('Dribbler',   'Technical', 'Carries',      'FirstTouch',   'Skills',     'Takeons',       'Takes players on, thrives in tight spaces'),
  ('Passer',     'Technical', 'Accuracy',     'Crossing',     'Range',      'ThroughBalls',  'Distribution specialist, creates from deep or wide'),
  ('Striker',    'Technical', 'Finishing',    'LongShots',    'Penalties',  'ShotPower',     'Clinical finisher, scores all types of goals'),
  -- Goalkeeper
  ('GK',         'Goalkeeper','Agility',      'Handling',     'Reactions',  'Sweeping',      'Shot-stopper, commanding in the area')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SECTION 12: SEED DATA — 52 ATTRIBUTES
-- =============================================================================

INSERT INTO attributes_master (name, short_code, category, player_model_id, display_order)
SELECT a.name, a.short_code, a.category::model_category_enum, pm.id, a.display_order
FROM (VALUES
  -- Mental — Controller
  ('Anticipation',    'Ant', 'Mental',     'Controller', 1),
  ('Decisions',       'Dec', 'Mental',     'Controller', 2),
  ('Composure',       'Com', 'Mental',     'Controller', 3),
  ('Tempo',           'Tem', 'Mental',     'Controller', 4),
  -- Mental — Commander
  ('Communication',   'Cmu', 'Mental',     'Commander',  5),
  ('Competitiveness', 'Cpt', 'Mental',     'Commander',  6),
  ('Drive',           'Dri', 'Mental',     'Commander',  7),
  ('Leadership',      'Lea', 'Mental',     'Commander',  8),
  -- Mental — Creator
  ('Creativity',      'Cre', 'Mental',     'Creator',    9),
  ('Flair',           'Fla', 'Mental',     'Creator',   10),
  ('Guile',           'Gui', 'Mental',     'Creator',   11),
  ('Vision',          'Vis', 'Mental',     'Creator',   12),
  -- Physical — Target
  ('AerialDuels',     'Aer', 'Physical',   'Target',    13),
  ('Heading',         'Hea', 'Physical',   'Target',    14),
  ('Jumping',         'Jum', 'Physical',   'Target',    15),
  ('Volleys',         'Vol', 'Physical',   'Target',    16),
  -- Physical — Sprinter
  ('Acceleration',    'Acc', 'Physical',   'Sprinter',  17),
  ('Balance',         'Bal', 'Physical',   'Sprinter',  18),
  ('Movement',        'Mov', 'Physical',   'Sprinter',  19),
  ('Pace',            'Pac', 'Physical',   'Sprinter',  20),
  -- Physical — Powerhouse
  ('Aggression',      'Agr', 'Physical',   'Powerhouse',21),
  ('Duels',           'Due', 'Physical',   'Powerhouse',22),
  ('Shielding',       'Shi', 'Physical',   'Powerhouse',23),
  ('Throwing',        'Thr', 'Physical',   'Powerhouse',24),
  -- Tactical — Cover
  ('Awareness',       'Awa', 'Tactical',   'Cover',     25),
  ('Discipline',      'Dis', 'Tactical',   'Cover',     26),
  ('Interceptions',   'Int', 'Tactical',   'Cover',     27),
  ('Positioning',     'Pos', 'Tactical',   'Cover',     28),
  -- Tactical — Engine
  ('Intensity',       'Isy', 'Tactical',   'Engine',    29),
  ('Pressing',        'Pre', 'Tactical',   'Engine',    30),
  ('Stamina',         'Sta', 'Tactical',   'Engine',    31),
  ('Versatility',     'Ver', 'Tactical',   'Engine',    32),
  -- Tactical — Destroyer
  ('Blocking',        'Blo', 'Tactical',   'Destroyer', 33),
  ('Clearances',      'Cle', 'Tactical',   'Destroyer', 34),
  ('Marking',         'Mar', 'Tactical',   'Destroyer', 35),
  ('Tackling',        'Tac', 'Tactical',   'Destroyer', 36),
  -- Technical — Dribbler
  ('Carries',         'Car', 'Technical',  'Dribbler',  37),
  ('FirstTouch',      'Fir', 'Technical',  'Dribbler',  38),
  ('Skills',          'Ski', 'Technical',  'Dribbler',  39),
  ('Takeons',         'Tak', 'Technical',  'Dribbler',  40),
  -- Technical — Passer
  ('Accuracy',        'Acr', 'Technical',  'Passer',    41),
  ('Crossing',        'Cro', 'Technical',  'Passer',    42),
  ('Range',           'Ran', 'Technical',  'Passer',    43),
  ('ThroughBalls',    'ThB', 'Technical',  'Passer',    44),
  -- Technical — Striker
  ('Finishing',       'Fin', 'Technical',  'Striker',   45),
  ('LongShots',       'LSh', 'Technical',  'Striker',   46),
  ('Penalties',       'Pen', 'Technical',  'Striker',   47),
  ('ShotPower',       'Spo', 'Technical',  'Striker',   48),
  -- Goalkeeper
  ('Agility',         'Agl', 'Goalkeeper', 'GK',        49),
  ('Handling',        'Han', 'Goalkeeper', 'GK',        50),
  ('Reactions',       'Rea', 'Goalkeeper', 'GK',        51),
  ('Sweeping',        'Swe', 'Goalkeeper', 'GK',        52)
) AS a(name, short_code, category, model_name, display_order)
LEFT JOIN player_models pm ON pm.name::TEXT = a.model_name
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SECTION 13: SEED DATA — STYLE COMPATIBILITY MATRIX
-- =============================================================================

INSERT INTO style_compatibility (from_style, to_style, compatibility, adaptation_weeks, performance_modifier)
VALUES
  ('Counter',     'Direct',        'Easy',          2,  0.05),
  ('Counter',     'Gegenpressing', 'Moderate',       4,  0.00),
  ('Counter',     'Possession',    'Difficult',      8, -0.10),
  ('Counter',     'Tiki-Taka',     'Very Difficult', 16,-0.20),
  ('Possession',  'Gegenpressing', 'Easy',           2,  0.05),
  ('Possession',  'Tiki-Taka',     'Easy',           2,  0.05),
  ('Possession',  'Counter',       'Difficult',      8, -0.10),
  ('Possession',  'Direct',        'Moderate',       4,  0.00),
  ('Gegenpressing','Possession',   'Easy',           2,  0.05),
  ('Gegenpressing','Counter',      'Moderate',       4,  0.00),
  ('Gegenpressing','Direct',       'Difficult',      8, -0.10),
  ('Gegenpressing','Tiki-Taka',    'Moderate',       4,  0.00),
  ('Direct',      'Counter',       'Easy',           2,  0.05),
  ('Direct',      'Possession',    'Moderate',       4,  0.00),
  ('Direct',      'Gegenpressing', 'Difficult',      8, -0.10),
  ('Direct',      'Tiki-Taka',     'Very Difficult', 16,-0.20),
  ('Tiki-Taka',   'Possession',    'Easy',           2,  0.05),
  ('Tiki-Taka',   'Gegenpressing', 'Moderate',       4,  0.00),
  ('Tiki-Taka',   'Counter',       'Very Difficult', 16,-0.20),
  ('Tiki-Taka',   'Direct',        'Very Difficult', 16,-0.20)
ON CONFLICT (from_style, to_style) DO NOTHING;

-- =============================================================================
-- SECTION 14: SEED DATA — MODEL × STYLE AFFINITIES
-- =============================================================================

INSERT INTO model_style_affinity (player_model, tactical_style, affinity)
VALUES
  -- Tika-Taka
  ('Controller',  'Tika-Taka',      90),
  ('Passer',      'Tika-Taka',      90),
  ('Creator',     'Tika-Taka',      85),
  ('Dribbler',    'Tika-Taka',      80),
  ('Engine',      'Tika-Taka',      65),
  ('Cover',       'Tika-Taka',      60),
  ('Target',      'Tika-Taka',      30),
  ('Powerhouse',  'Tika-Taka',      25),
  ('Destroyer',   'Tika-Taka',      35),
  -- Total (Possession/Press)
  ('Controller',  'Total',          85),
  ('Passer',      'Total',          85),
  ('Engine',      'Total',          80),
  ('Creator',     'Total',          75),
  ('Cover',       'Total',          70),
  ('Destroyer',   'Total',          65),
  -- Gegenpress
  ('Engine',      'Gegenpress',     95),
  ('Destroyer',   'Gegenpress',     85),
  ('Cover',       'Gegenpress',     80),
  ('Commander',   'Gegenpress',     75),
  ('Sprinter',    'Gegenpress',     70),
  ('Striker',     'Gegenpress',     65),
  ('Controller',  'Gegenpress',     60),
  -- POMO
  ('Engine',      'POMO',           90),
  ('Destroyer',   'POMO',           85),
  ('Powerhouse',  'POMO',           80),
  ('Commander',   'POMO',           75),
  ('Striker',     'POMO',           70),
  -- Pragmatic (Counter/Compact)
  ('Cover',       'Pragmatic',      85),
  ('Sprinter',    'Pragmatic',      85),
  ('Striker',     'Pragmatic',      80),
  ('Destroyer',   'Pragmatic',      80),
  ('Engine',      'Pragmatic',      70),
  ('Controller',  'Pragmatic',      65),
  -- Catennacio (Direct/Park The Bus)
  ('Destroyer',   'Catennacio',     90),
  ('Cover',       'Catennacio',     90),
  ('Target',      'Catennacio',     80),
  ('Powerhouse',  'Catennacio',     75),
  ('Engine',      'Catennacio',     70),
  -- Garra Charrua (Balanced/Aggressive)
  ('Engine',      'Garra Charrua',  85),
  ('Commander',   'Garra Charrua',  85),
  ('Powerhouse',  'Garra Charrua',  80),
  ('Destroyer',   'Garra Charrua',  75),
  ('Striker',     'Garra Charrua',  70),
  -- Joga Bonito (Flair/Balanced)
  ('Creator',     'Joga Bonito',    95),
  ('Dribbler',    'Joga Bonito',    90),
  ('Sprinter',    'Joga Bonito',    85),
  ('Passer',      'Joga Bonito',    75),
  ('Controller',  'Joga Bonito',    65),
  -- Fluid (Balanced/Adaptive)
  ('Engine',      'Fluid',          80),
  ('Controller',  'Fluid',          75),
  ('Creator',     'Fluid',          75),
  ('Cover',       'Fluid',          70),
  ('Passer',      'Fluid',          70),
  -- GK is neutral to style
  ('GK',          'Tika-Taka',      50),
  ('GK',          'Total',          50),
  ('GK',          'Gegenpress',     50),
  ('GK',          'Pragmatic',      50),
  ('GK',          'Catennacio',     60),
  ('GK',          'Garra Charrua',  50),
  ('GK',          'Joga Bonito',    50),
  ('GK',          'Fluid',          50),
  ('GK',          'POMO',           50)
ON CONFLICT (player_model, tactical_style) DO NOTHING;

-- =============================================================================
-- SECTION 15: SEED DATA — DIRECTOR ATTRIBUTES (10 RPG Stats)
-- =============================================================================

INSERT INTO director_attributes (name, related_attribute, description, staff_member, current_value, availability_effect)
VALUES
  ('Administrator', 'Productivity',       'Affects how quickly tasks are completed.',                          'Assistant',                  1, 'Faster processing of scouting missions and report generation'),
  ('Figurehead',    'Charisma',           'Influences staff morale, player happiness, and media interactions.', 'PR Director',               1, 'Reduces reputation gap penalty by up to 10 points; players more receptive'),
  ('Savant',        'Player Knowledge',   'Determines the accuracy and depth of scouting reports.',            NULL,                         1, 'Reveals accurate player_interest scores (vs. broad bands Low/Medium/High)'),
  ('Nomad',         'Network Development','Affects the ease of finding transfer targets and staff.',           NULL,                         1, 'Reveals transfer_status for un-scouted players; expands player pool'),
  ('Dealmaker',     'Negotiation Ability','Improves success in transfer and contract negotiations.',           NULL,                         1, 'Hidden +10 bonus to effective availability_score during active negotiation'),
  ('Statto',        'Tech Ability',       'Impacts the effectiveness of using data and analytics in decisions.', NULL,                       1, 'Reveals contract_expiry dates from public databases for more players'),
  ('Polyglot',      'Languages',          'Improves communication with international players, staff, and media.', NULL,                      1, 'Reduces player_interest penalty for foreign players by up to 15 points'),
  ('Strategist',    'Planning',           'Enhances the ability to plan long-term objectives and set club direction.', 'Technical Director', 1, 'Unlocks multi-season availability forecasting and trend alerts'),
  ('Financier',     'Financial Management','Improves the management of the club finances and budgeting.',      'Financial Director',         1, 'Increases effective transfer budget; better wage negotiation outcomes'),
  ('Motivator',     'Motivation',         'Boosts player and staff motivation, increasing overall performance.', 'Head of Sports Psychology', 1, 'Raises player_interest for targets who value a positive culture (+5 to +15)')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SECTION 16: SEED DATA — NATIONS (Top Tier Leagues)
-- =============================================================================

INSERT INTO nations (name, football_culture, is_top_tier_league, reputation_modifier)
VALUES
  ('England',     'Possession/Physical',   TRUE,  5),
  ('Germany',     'Gegenpressing',         TRUE,  5),
  ('Spain',       'Possession/Tiki-Taka',  TRUE,  5),
  ('France',      'Physical/Technical',    TRUE,  5),
  ('Italy',       'Tactical/Defensive',    TRUE,  5),
  ('Portugal',    'Technical/Possession',  FALSE, 3),
  ('Netherlands', 'Total Football',        FALSE, 3),
  ('Brazil',      'Joga Bonito',           FALSE, 4),
  ('Argentina',   'Technical/Garra',       FALSE, 4),
  ('Scotland',    'Direct/Physical',       FALSE, 0),
  ('Wales',       'Physical/Direct',       FALSE, 0),
  ('Ireland',     'Physical/Direct',       FALSE, 0)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SECTION 17: SEED DATA — STARTING CLUBS (League Two, Tier 4)
-- =============================================================================

-- Seed England nation id for club inserts
DO $$
DECLARE
  v_eng_id INT;
BEGIN
  SELECT id INTO v_eng_id FROM nations WHERE name = 'England';

  INSERT INTO clubs (name, model_club, nation_id, league_tier, reputation, formation, offensive_style, defensive_style)
  VALUES
    ('Accrington Stanley FC', 'Accrington Stanley', v_eng_id, 4, 61, '442',  'Direct',   'Compact'),
    ('Aldershot Town FC',     'Aldershot Town',      v_eng_id, 4, 60, NULL,   NULL,       NULL),
    ('Barnet FC',             'Barnet',              v_eng_id, 4, 60, NULL,   NULL,       NULL),
    ('Barrow AFC',            'Barrow',              v_eng_id, 4, 60, NULL,   NULL,       NULL),
    ('Bromley FC',            'Bromley',             v_eng_id, 4, 60, NULL,   NULL,       NULL),
    ('Burton Albion FC',      'Burton Albion',       v_eng_id, 4, 62, NULL,   NULL,       NULL),
    ('Cambridge United FC',   'Cambridge United',    v_eng_id, 4, 62, NULL,   NULL,       NULL),
    ('Colchester United FC',  'Colchester United',   v_eng_id, 4, 61, NULL,   NULL,       NULL),
    ('Crewe Alexandra FC',    'Crewe Alexandra',     v_eng_id, 4, 63, NULL,   NULL,       NULL),
    ('Crawley Town FC',       'Crawley Town',        v_eng_id, 4, 60, NULL,   NULL,       NULL),
    ('Doncaster Rovers FC',   'Doncaster Rovers',    v_eng_id, 4, 63, NULL,   NULL,       NULL),
    ('Exeter City FC',        'Exeter City',         v_eng_id, 4, 63, NULL,   NULL,       NULL),
    ('Fleetwood Town FC',     'Fleetwood Town',      v_eng_id, 4, 61, NULL,   NULL,       NULL),
    ('Gillingham FC',         'Gillingham',          v_eng_id, 4, 61, NULL,   NULL,       NULL),
    ('Grimsby Town FC',       'Grimsby Town',        v_eng_id, 4, 62, NULL,   NULL,       NULL),
    ('Harrogate Town AFC',    'Harrogate Town',      v_eng_id, 4, 60, NULL,   NULL,       NULL),
    ('MK Dons FC',            'MK Dons',             v_eng_id, 4, 63, NULL,   NULL,       NULL),
    ('Morecambe FC',          'Morecambe',           v_eng_id, 4, 60, NULL,   NULL,       NULL),
    ('Newport County AFC',    'Newport County',      v_eng_id, 4, 60, NULL,   NULL,       NULL),
    ('Notts County FC',       'Notts County',        v_eng_id, 4, 63, NULL,   NULL,       NULL),
    ('Salford City FC',       'Salford City',        v_eng_id, 4, 62, NULL,   NULL,       NULL),
    ('Swindon Town FC',       'Swindon Town',        v_eng_id, 4, 63, NULL,   NULL,       NULL),
    ('Tranmere Rovers FC',    'Tranmere Rovers',     v_eng_id, 4, 62, NULL,   NULL,       NULL),
    ('Walsall FC',            'Walsall',             v_eng_id, 4, 62, NULL,   NULL,       NULL)
  ON CONFLICT DO NOTHING;
END $$;

-- =============================================================================
-- SECTION 18: SEED DATA — DEFAULT SHORTLISTS
-- =============================================================================

INSERT INTO shortlists (name, description, colour)
VALUES
  ('Immediate Needs',  'Players who can improve the first team right now', '#EF4444'),
  ('Future Stars',     'High-potential players to develop over time',      '#8B5CF6'),
  ('Bargains',         'Undervalued players and free agent opportunities',  '#10B981')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
-- To verify installation:
--   SELECT COUNT(*) FROM player_models;          -- expect 13
--   SELECT COUNT(*) FROM attributes_master;      -- expect 52
--   SELECT COUNT(*) FROM style_compatibility;    -- expect 20
--   SELECT COUNT(*) FROM model_style_affinity;   -- expect ~60
--   SELECT COUNT(*) FROM director_attributes;    -- expect 10
--   SELECT COUNT(*) FROM clubs;                  -- expect 24 (League Two)
--   SELECT COUNT(*) FROM shortlists;             -- expect 3
--
-- Test availability score function:
--   SELECT calculate_availability_score('listed', 8, 70, 'rotation', 65, 65);
--   -- Expected: ~73 (WARM)
--
--   SELECT calculate_availability_score('free_agent', 0, 80, 'backup', 70, 65);
--   -- Expected: ~87 (HOT)
