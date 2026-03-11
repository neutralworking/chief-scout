-- 012_storage_cleanup.sql — Reclaim Supabase storage
-- Free tier: 500 MB database. sb_events alone (~3.25M rows) likely uses 300+ MB.
--
-- Strategy: Truncate raw event data that has already been aggregated into
-- attribute_grades via 13_stat_metrics.py. Can re-ingest from StatsBomb
-- open data at any time with: python 08_statsbomb_ingest.py
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).

-- ── Check current sizes (run this first to see the damage) ──────────────────
-- SELECT
--   schemaname || '.' || tablename AS table,
--   pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
-- LIMIT 20;

-- ── Truncate large raw data tables ──────────────────────────────────────────
-- sb_events is by far the largest (~3.25M rows, ~300+ MB).
-- CASCADE will also clear sb_lineups via FK if needed.
TRUNCATE sb_events CASCADE;
TRUNCATE sb_lineups;

-- ── Reclaim disk space ──────────────────────────────────────────────────────
-- VACUUM is automatic on Supabase but we can hint it.
VACUUM (ANALYZE) sb_events;
VACUUM (ANALYZE) sb_lineups;

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT 'sb_events' AS table_name, count(*) AS rows FROM sb_events
UNION ALL
SELECT 'sb_lineups', count(*) FROM sb_lineups
UNION ALL
SELECT 'sb_matches', count(*) FROM sb_matches
UNION ALL
SELECT 'attribute_grades', count(*) FROM attribute_grades;
