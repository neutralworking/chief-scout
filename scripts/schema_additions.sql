-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- Adds missing columns to players table and creates formations table

-- 1. Add scouting and bio columns to players
ALTER TABLE players 
  ADD COLUMN IF NOT EXISTS scouting_notes TEXT,
  ADD COLUMN IF NOT EXISTS hg BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_fee_eur BIGINT,
  ADD COLUMN IF NOT EXISTS joined_year INTEGER,
  ADD COLUMN IF NOT EXISTS prev_club TEXT;

-- 2. Create formations table
CREATE TABLE IF NOT EXISTS formations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  structure TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create transfers table (for player history)
CREATE TABLE IF NOT EXISTS transfers (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id),
  from_club TEXT,
  to_club TEXT,
  fee_eur BIGINT,
  year INTEGER,
  notes TEXT
);

-- 4. Enable RLS on new tables (recommended)
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- 5. Public read access
CREATE POLICY "public read formations" ON formations FOR SELECT USING (true);
CREATE POLICY "public read transfers" ON transfers FOR SELECT USING (true);
