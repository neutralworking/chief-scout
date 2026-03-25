-- 046_crowd_intelligence.sql
-- Crowd intelligence tables for Gaffer vote analysis.
-- Surfaces when the crowd disagrees with DB ratings — for scout review, NOT auto-adjustment.

-- Aggregated head-to-head matchup stats from Gaffer votes
CREATE TABLE IF NOT EXISTS fc_matchup_stats (
    player_a_id     bigint NOT NULL REFERENCES people(id),
    player_b_id     bigint NOT NULL REFERENCES people(id),
    total_matchups  int NOT NULL DEFAULT 0,
    player_a_wins   int NOT NULL DEFAULT 0,
    player_b_wins   int NOT NULL DEFAULT 0,
    last_computed   timestamptz DEFAULT now(),
    PRIMARY KEY (player_a_id, player_b_id)
);

-- Per-player crowd vs DB mismatch flags
CREATE TABLE IF NOT EXISTS fc_crowd_mismatches (
    person_id       bigint PRIMARY KEY REFERENCES people(id),
    crowd_win_pct   numeric(5,2),      -- win rate across all matchups
    db_level        int,
    db_overall      int,
    mismatch_score  numeric(5,2),      -- magnitude of disagreement
    direction       text,              -- 'crowd_higher' or 'crowd_lower'
    sample_size     int,
    computed_at     timestamptz DEFAULT now()
);

-- Store dynamic votes for matchup data (head-to-head templates)
CREATE TABLE IF NOT EXISTS fc_dynamic_votes (
    id              bigserial PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES fc_users(id),
    template        text NOT NULL,
    chosen_person_id bigint REFERENCES people(id),
    opponent_ids    bigint[],
    created_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fc_matchup_stats_b ON fc_matchup_stats(player_b_id);
CREATE INDEX IF NOT EXISTS idx_fc_crowd_mismatches_direction ON fc_crowd_mismatches(direction);
CREATE INDEX IF NOT EXISTS idx_fc_crowd_mismatches_score ON fc_crowd_mismatches(mismatch_score DESC);
CREATE INDEX IF NOT EXISTS idx_fc_dynamic_votes_user ON fc_dynamic_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_fc_dynamic_votes_chosen ON fc_dynamic_votes(chosen_person_id);
