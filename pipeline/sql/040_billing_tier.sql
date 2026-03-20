-- 040_billing_tier.sql
-- Add billing tier + Stripe customer ID to fc_users for subscription management

ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free';
ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Constrain tier to valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fc_users_tier_check'
  ) THEN
    ALTER TABLE fc_users ADD CONSTRAINT fc_users_tier_check
      CHECK (tier IN ('free', 'scout', 'pro'));
  END IF;
END $$;

-- Index for Stripe webhook lookups by customer ID
CREATE INDEX IF NOT EXISTS idx_fc_users_stripe_customer_id
  ON fc_users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Service role needs to update tier via Stripe webhooks (bypasses RLS by default)
-- No additional policy needed — service role key already bypasses RLS
