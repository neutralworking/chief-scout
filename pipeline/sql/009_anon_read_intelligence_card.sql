-- 009_anon_read_intelligence_card.sql
-- Enables anon (public) read access on all tables backing the
-- player_intelligence_card view, so the static-export Next.js app
-- can query via the Supabase anon key.
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).
-- Safe to re-run (uses IF NOT EXISTS / duplicate_object guards).

-- ── Enable RLS on core tables (idempotent) ──────────────────────────────────

ALTER TABLE people              ENABLE ROW LEVEL SECURITY;
ALTER TABLE nations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_personality  ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_market       ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_status       ENABLE ROW LEVEL SECURITY;

-- ── Anon read policies ──────────────────────────────────────────────────────
-- These allow the Supabase anon key to SELECT from each table.
-- The player_intelligence_card view joins all of them, so all need access.

DO $$ BEGIN
  CREATE POLICY "anon read people"
    ON people FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon read nations"
    ON nations FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon read clubs"
    ON clubs FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon read player_profiles"
    ON player_profiles FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon read player_personality"
    ON player_personality FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon read player_market"
    ON player_market FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon read player_status"
    ON player_status FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Authenticated read policies (belt + suspenders) ─────────────────────────
-- These may already exist but ensure coverage.

DO $$ BEGIN
  CREATE POLICY "authenticated read people"
    ON people FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated read nations"
    ON nations FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated read clubs"
    ON clubs FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated read player_profiles"
    ON player_profiles FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated read player_personality"
    ON player_personality FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated read player_market"
    ON player_market FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated read player_status"
    ON player_status FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Service role full access (for pipeline writes) ──────────────────────────

DO $$ BEGIN
  CREATE POLICY "service_role all people"
    ON people FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role all player_profiles"
    ON player_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role all player_personality"
    ON player_personality FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role all player_market"
    ON player_market FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role all player_status"
    ON player_status FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
