-- 023_shortlists.sql — Curated shortlists: editorial + user-created
-- Premium feature (Scout/Pro tier)

-- ── Shortlists ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shortlists (
    id              serial PRIMARY KEY,
    slug            text UNIQUE NOT NULL,
    title           text NOT NULL,
    description     text,
    icon            text,                          -- emoji
    cover_image_url text,

    -- Ownership
    author_type     text NOT NULL DEFAULT 'system', -- 'system' (editorial), 'scout' (staff), 'user'
    author_id       uuid REFERENCES fc_users(id) ON DELETE SET NULL,
    author_name     text,                          -- display name for attribution

    -- Metadata
    category        text,                          -- 'free-agents', 'wonderkids', 'bargains', 'position', 'league', 'custom'
    tags            text[],
    position_filter text,                          -- if the shortlist is position-specific (GK, CD, etc.)
    visibility      text NOT NULL DEFAULT 'public', -- 'public', 'private', 'unlisted'

    -- Sorting & display
    sort_order      integer DEFAULT 0,
    featured        boolean DEFAULT false,         -- shown on homepage/shortlists landing
    player_count    integer DEFAULT 0,             -- denormalized
    updated_at      timestamptz DEFAULT now(),
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shortlists_category ON shortlists(category);
CREATE INDEX IF NOT EXISTS idx_shortlists_author ON shortlists(author_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_featured ON shortlists(featured) WHERE featured = true;

-- ── Shortlist players (junction) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shortlist_players (
    id              serial PRIMARY KEY,
    shortlist_id    integer NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
    person_id       bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    sort_order      integer DEFAULT 0,
    scout_note      text,                          -- per-player note within this shortlist
    added_at        timestamptz DEFAULT now(),
    UNIQUE(shortlist_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlist_players_shortlist ON shortlist_players(shortlist_id);
CREATE INDEX IF NOT EXISTS idx_shortlist_players_person ON shortlist_players(person_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortlist_players ENABLE ROW LEVEL SECURITY;

-- Public shortlists readable by anyone
CREATE POLICY "anon_read_public_shortlists" ON shortlists
    FOR SELECT TO anon USING (visibility = 'public');

CREATE POLICY "anon_read_shortlist_players" ON shortlist_players
    FOR SELECT TO anon USING (
        EXISTS (SELECT 1 FROM shortlists WHERE id = shortlist_id AND visibility = 'public')
    );

-- Service role has full access
CREATE POLICY "service_all_shortlists" ON shortlists FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_shortlist_players" ON shortlist_players FOR ALL TO service_role USING (true);
