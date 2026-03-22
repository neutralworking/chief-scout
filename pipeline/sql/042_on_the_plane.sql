-- Migration 042: On The Plane — World Cup Squad Picker Game
-- Tables for WC nation registry, ideal squads, user entries, and aggregated stats.

-- ── World Cup 2026 participating nations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS wc_nations (
  nation_id       bigint PRIMARY KEY REFERENCES nations(id),
  confederation   text NOT NULL,          -- UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC
  fifa_ranking     int,
  group_letter    text,                   -- A-L (when drawn)
  seed            int,                    -- 1-4
  kit_emoji       text,                   -- 🇧🇷 🇫🇷 etc.
  slug            text UNIQUE NOT NULL,   -- url-safe: brazil, france, etc.
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE wc_nations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read wc_nations" ON wc_nations FOR SELECT USING (true);

-- ── Pre-computed ideal squads (one per nation, refreshable) ──────────────────
CREATE TABLE IF NOT EXISTS otp_ideal_squads (
  id              bigserial PRIMARY KEY,
  nation_id       bigint NOT NULL REFERENCES nations(id) UNIQUE,
  formation       text NOT NULL,          -- e.g. "4-3-3"
  squad_json      jsonb NOT NULL,         -- [{person_id, name, position, pool_category, is_starter, slot, role_score}]
  pool_json       jsonb,                  -- full national pool with categories (cached)
  strength        real,                   -- composite squad rating 0-100
  computed_at     timestamptz DEFAULT now()
);

ALTER TABLE otp_ideal_squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read otp_ideal_squads" ON otp_ideal_squads FOR SELECT USING (true);

-- ── User squad submissions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_entries (
  id              bigserial PRIMARY KEY,
  user_id         text NOT NULL,          -- localStorage UUID or Supabase auth ID
  nation_id       bigint NOT NULL REFERENCES nations(id),
  formation       text NOT NULL,
  squad_json      jsonb NOT NULL,         -- [{person_id, position, is_starter, slot}]
  score           real,                   -- match score vs ideal (0-100)
  score_breakdown jsonb,                  -- {squad_matches, xi_matches, formation_match, tier}
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, nation_id)              -- one entry per user per nation (upsert)
);

ALTER TABLE otp_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own otp_entries" ON otp_entries
  FOR SELECT USING (true);
CREATE POLICY "service write otp_entries" ON otp_entries
  FOR ALL USING (true) WITH CHECK (true);

-- ── Aggregated stats per nation ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_nation_stats (
  nation_id               bigint PRIMARY KEY REFERENCES nations(id),
  total_entries           int DEFAULT 0,
  avg_score               real,
  most_picked_player_id   bigint REFERENCES people(id),
  most_picked_formation   text,
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE otp_nation_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read otp_nation_stats" ON otp_nation_stats FOR SELECT USING (true);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_otp_entries_nation ON otp_entries(nation_id);
CREATE INDEX IF NOT EXISTS idx_otp_entries_user   ON otp_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_wc_nations_slug    ON wc_nations(slug);
