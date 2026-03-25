-- 015_football_choices.sql — Schema for Football Choices game
-- A "swipe-style" comparison game where users pick between 2-5 player options.
-- Builds user footballing identity profiles and generates preference data.

-- ── User profiles (anonymous or named) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS fc_users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name    text,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),

    -- Footballing Identity metrics (computed from votes)
    total_votes     integer DEFAULT 0,
    -- Style dimensions (0-100 scale, computed)
    flair_vs_function   integer,   -- prefers skillful vs effective players
    youth_vs_experience integer,   -- prefers young prospects vs proven veterans
    attack_vs_defense   integer,   -- gravitates to attackers vs defenders
    loyalty_vs_ambition integer,   -- values one-club loyalty vs big moves
    domestic_vs_global  integer,   -- prefers own league vs worldwide
    stats_vs_eye_test   integer,   -- data-driven vs vibes-based
    era_bias            text       -- computed: "modern", "classic", "timeless"
);

-- ── Question categories ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fc_categories (
    id          serial PRIMARY KEY,
    slug        text UNIQUE NOT NULL,
    name        text NOT NULL,
    description text,
    icon        text,          -- emoji or icon name
    sort_order  integer DEFAULT 0
);

-- Seed categories
INSERT INTO fc_categories (slug, name, description, icon, sort_order) VALUES
    ('goat', 'GOAT Debates', 'All-time greatest player arguments', '🐐', 1),
    ('positional', 'Best in Position', 'Who''s the best at their position?', '⚽', 2),
    ('era', 'Era Wars', 'Compare players across different decades', '⏳', 3),
    ('transfer', 'Transfer Picks', 'Who would you sign?', '✍️', 4),
    ('tactical', 'Tactical Choices', 'Build your ideal team/system', '📋', 5),
    ('clutch', 'Clutch Moments', 'Who do you want in the big moments?', '🏆', 6),
    ('style', 'Style Points', 'Who''s more entertaining to watch?', '🎨', 7),
    ('hypothetical', 'What If?', 'Hypothetical matchups and scenarios', '🤔', 8)
ON CONFLICT (slug) DO NOTHING;

-- ── Questions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fc_questions (
    id              serial PRIMARY KEY,
    category_id     integer REFERENCES fc_categories(id),
    question_text   text NOT NULL,
    subtitle        text,                     -- optional context line
    option_count    smallint NOT NULL DEFAULT 2 CHECK (option_count BETWEEN 2 AND 5),
    difficulty      smallint DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),  -- 1=easy, 3=hard
    tags            text[],                   -- searchable tags like 'premier-league', 'defenders'
    active          boolean DEFAULT true,
    created_at      timestamptz DEFAULT now(),
    total_votes     integer DEFAULT 0,        -- denormalized for sorting
    skip_count      integer DEFAULT 0,        -- how often users skip this question
    pick_count      smallint DEFAULT 1        -- how many options to pick (1=single, 2+=multi)
);

-- ── Question options (each option = a player card) ─────────────────────────

CREATE TABLE IF NOT EXISTS fc_options (
    id              serial PRIMARY KEY,
    question_id     integer NOT NULL REFERENCES fc_questions(id) ON DELETE CASCADE,
    person_id       bigint REFERENCES people(id) ON DELETE SET NULL,
    label           text NOT NULL,            -- display name (may differ from people.name for legends)
    subtitle        text,                     -- e.g. "2004-2016" or "237 goals"
    image_url       text,                     -- override image for this context
    sort_order      smallint NOT NULL DEFAULT 0,
    vote_count      integer DEFAULT 0         -- denormalized
);

CREATE INDEX IF NOT EXISTS idx_fc_options_question ON fc_options(question_id);
CREATE INDEX IF NOT EXISTS idx_fc_options_person ON fc_options(person_id);

-- ── Votes (one per user per question) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS fc_votes (
    id              bigserial PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES fc_users(id) ON DELETE CASCADE,
    question_id     integer NOT NULL REFERENCES fc_questions(id) ON DELETE CASCADE,
    chosen_option_id integer NOT NULL REFERENCES fc_options(id) ON DELETE CASCADE,
    time_ms         integer,                  -- how long the user took to decide
    created_at      timestamptz DEFAULT now(),
    UNIQUE(user_id, question_id)              -- one vote per question per user
);

CREATE INDEX IF NOT EXISTS idx_fc_votes_user ON fc_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_fc_votes_question ON fc_votes(question_id);
CREATE INDEX IF NOT EXISTS idx_fc_votes_option ON fc_votes(chosen_option_id);

-- ── Skips (track when users skip a question) ───────────────────────────────

CREATE TABLE IF NOT EXISTS fc_skips (
    id              bigserial PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES fc_users(id) ON DELETE CASCADE,
    question_id     integer NOT NULL REFERENCES fc_questions(id) ON DELETE CASCADE,
    created_at      timestamptz DEFAULT now()
);

-- ── Vote streaks / achievements ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fc_achievements (
    id              serial PRIMARY KEY,
    slug            text UNIQUE NOT NULL,
    name            text NOT NULL,
    description     text,
    icon            text,
    threshold       integer                   -- votes/streak needed
);

CREATE TABLE IF NOT EXISTS fc_user_achievements (
    user_id         uuid REFERENCES fc_users(id) ON DELETE CASCADE,
    achievement_id  integer REFERENCES fc_achievements(id) ON DELETE CASCADE,
    unlocked_at     timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, achievement_id)
);

-- Seed achievements
INSERT INTO fc_achievements (slug, name, description, icon, threshold) VALUES
    ('first_vote', 'First Pick', 'Cast your first vote', '👆', 1),
    ('ten_votes', 'Getting Warmed Up', 'Cast 10 votes', '🔥', 10),
    ('fifty_votes', 'Scout''s Eye', 'Cast 50 votes', '👁️', 50),
    ('hundred_votes', 'Chief Scout', 'Cast 100 votes', '🏅', 100),
    ('speed_demon', 'Speed Demon', 'Answer in under 1 second', '⚡', NULL),
    ('contrarian', 'Against the Grain', 'Pick the least popular option 10 times', '🔄', 10),
    ('category_master', 'Category Master', 'Complete all questions in a category', '🎓', NULL)
ON CONFLICT (slug) DO NOTHING;

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE fc_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_user_achievements ENABLE ROW LEVEL SECURITY;

-- Anon can read questions, categories, options, achievements
CREATE POLICY "anon_read_fc_categories" ON fc_categories FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fc_questions" ON fc_questions FOR SELECT TO anon USING (active = true);
CREATE POLICY "anon_read_fc_options" ON fc_options FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fc_achievements" ON fc_achievements FOR SELECT TO anon USING (true);

-- Service role has full access
CREATE POLICY "service_all_fc_users" ON fc_users FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_categories" ON fc_categories FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_questions" ON fc_questions FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_options" ON fc_options FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_votes" ON fc_votes FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_skips" ON fc_skips FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_achievements" ON fc_achievements FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_fc_user_achievements" ON fc_user_achievements FOR ALL TO service_role USING (true);

-- Anon can read their own user profile (via cookie-based UUID)
CREATE POLICY "anon_read_own_fc_user" ON fc_users FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fc_votes" ON fc_votes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fc_user_achievements" ON fc_user_achievements FOR SELECT TO anon USING (true);
