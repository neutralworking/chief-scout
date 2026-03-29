-- 050_drop_old_role_tables.sql
-- Old tables replaced by tactical_systems + system_slots + slot_roles

-- Remove FK from formation_slots if it references tactical_roles
ALTER TABLE formation_slots DROP CONSTRAINT IF EXISTS formation_slots_role_id_fkey;
ALTER TABLE formation_slots DROP COLUMN IF EXISTS role_id;

-- Drop old tables
DROP TABLE IF EXISTS philosophy_roles;
DROP TABLE IF EXISTS philosophy_formations;
DROP TABLE IF EXISTS tactical_roles;
