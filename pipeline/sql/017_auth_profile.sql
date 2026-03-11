-- 017_auth_profile.sql
-- Extend fc_users for Supabase Auth integration + user preferences

-- Add auth columns to fc_users
ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE;
ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}';

-- Index for fast lookup by auth_id
CREATE INDEX IF NOT EXISTS idx_fc_users_auth_id ON fc_users(auth_id) WHERE auth_id IS NOT NULL;

-- RLS policies for authenticated users to manage their own row
DO $$
BEGIN
  -- Authenticated users can read their own row
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_users_read_own' AND tablename = 'fc_users') THEN
    CREATE POLICY "auth_users_read_own" ON fc_users FOR SELECT TO authenticated
      USING (auth_id = auth.uid());
  END IF;

  -- Authenticated users can update their own row
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_users_update_own' AND tablename = 'fc_users') THEN
    CREATE POLICY "auth_users_update_own" ON fc_users FOR UPDATE TO authenticated
      USING (auth_id = auth.uid());
  END IF;
END $$;
