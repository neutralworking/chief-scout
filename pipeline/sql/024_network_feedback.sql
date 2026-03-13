-- 024_network_feedback.sql
-- Network feedback: permissions for delegated scouting work

CREATE TABLE IF NOT EXISTS network_roles (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL,                          -- fc_users.id or auth.users
    scope_type  TEXT NOT NULL DEFAULT 'global',          -- global | league | club
    scope_id    BIGINT,                                  -- clubs.id or NULL for league (matched by name)
    scope_name  TEXT,                                     -- league name or club name (denormalized for display)
    role        TEXT NOT NULL DEFAULT 'editor',           -- admin | editor | viewer
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, scope_type, scope_id)
);

-- Feedback log: track every edit for audit
CREATE TABLE IF NOT EXISTS network_edits (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID,                                    -- who made the edit (NULL = system/owner)
    person_id   BIGINT NOT NULL REFERENCES people(id),
    field       TEXT NOT NULL,                            -- e.g. 'level', 'overall', 'passing'
    old_value   TEXT,
    new_value   TEXT,
    table_name  TEXT NOT NULL,                            -- player_profiles, attribute_grades, etc.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_edits_person ON network_edits(person_id);
CREATE INDEX IF NOT EXISTS idx_network_edits_user ON network_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_network_roles_user ON network_roles(user_id);
