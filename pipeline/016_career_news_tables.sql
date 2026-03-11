-- =============================================================================
-- Migration 016: Career Metrics + News Sentiment Tables
-- Safe to run on existing databases (uses IF NOT EXISTS throughout)
-- =============================================================================

-- ── career_metrics ──────────────────────────────────────────────────────────
-- Derived trajectory metrics computed from player_career_history.
-- One row per player, refreshed by 23_career_metrics.py.

CREATE TABLE IF NOT EXISTS career_metrics (
    person_id       UUID PRIMARY KEY REFERENCES people(id),
    clubs_count     INT,              -- total distinct clubs
    loan_count      INT,              -- total loan spells
    career_years    NUMERIC(4,1),     -- span from first start_date to now or last end_date
    avg_tenure_yrs  NUMERIC(4,1),     -- average years per club
    max_tenure_yrs  NUMERIC(4,1),     -- longest single-club spell
    current_club_yrs NUMERIC(4,1),    -- years at current club (NULL if end_date set)
    loyalty_score   INT,              -- 1-20: long tenures + few moves = high
    mobility_score  INT,              -- 1-20: many moves + short tenures = high
    trajectory      TEXT,             -- label: 'rising', 'peak', 'declining', 'journeyman', 'one-club', 'newcomer'
    leagues_count   INT,              -- distinct leagues played in (via club → league)
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_metrics_trajectory ON career_metrics(trajectory);

-- ── news_sentiment_agg ──────────────────────────────────────────────────────
-- Aggregated sentiment trends from news_player_tags.
-- One row per player, refreshed by 24_news_sentiment.py.

CREATE TABLE IF NOT EXISTS news_sentiment_agg (
    person_id           UUID PRIMARY KEY REFERENCES people(id),
    total_mentions      INT,              -- total news stories mentioning this player
    positive_count      INT,
    negative_count      INT,
    neutral_count       INT,
    avg_confidence      NUMERIC(4,3),     -- avg tag confidence across all mentions
    sentiment_score     INT,              -- 1-20: net positive sentiment
    buzz_score          INT,              -- 1-20: volume of recent mentions
    story_types         JSONB,            -- {"transfer": 5, "performance": 3, ...}
    dominant_type       TEXT,             -- most frequent story_type
    last_mention_at     TIMESTAMPTZ,      -- most recent story published_at
    trend_7d            NUMERIC(5,2),     -- mentions in last 7 days
    trend_30d           NUMERIC(5,2),     -- mentions in last 30 days
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_sentiment_buzz ON news_sentiment_agg(buzz_score DESC);
CREATE INDEX IF NOT EXISTS idx_news_sentiment_sentiment ON news_sentiment_agg(sentiment_score DESC);
