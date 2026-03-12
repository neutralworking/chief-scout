-- 019_cron_log.sql — Cron job execution log
-- Tracks automated pipeline runs (news refresh, etc.)

CREATE TABLE IF NOT EXISTS cron_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job         text NOT NULL,
  stats       jsonb,
  log         jsonb,
  ran_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cron_log_job_idx ON cron_log(job, ran_at DESC);

ALTER TABLE cron_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cron_log"
    ON cron_log FOR SELECT USING (true);

CREATE POLICY "Service insert cron_log"
    ON cron_log FOR INSERT WITH CHECK (true);
