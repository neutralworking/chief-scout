-- 028_control_vs_chaos.sql — Add control_vs_chaos dimension to fc_users
-- Captures tactical philosophy: possession control (Guardiola/Cruyff/Sacchi) vs
-- reactive chaos (Mourinho/Simeone/Conte). HIGH = control, LOW = chaos.

ALTER TABLE fc_users
  ADD COLUMN IF NOT EXISTS control_vs_chaos integer;

-- Backfill existing users to neutral (50)
UPDATE fc_users SET control_vs_chaos = 50 WHERE control_vs_chaos IS NULL AND total_votes > 0;
