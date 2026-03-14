-- 027_transfer_valuation.sql
-- Transfer Valuation Engine tables
-- Stores valuation results, comparable transfers, and contextual fit analyses

-- ── Player valuations (one per player × evaluation context) ───────────────────

CREATE TABLE IF NOT EXISTS player_valuations (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id       bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,

    -- Core valuation outputs (EUR)
    market_value_p10    bigint,
    market_value_p25    bigint,
    market_value_p50    bigint,          -- central estimate
    market_value_p75    bigint,
    market_value_p90    bigint,

    -- Use value (contextual)
    use_value_central   bigint,
    contextual_fit_score numeric(4,3),   -- 0.000 – 1.000

    -- Contextual fit breakdown
    system_archetype_fit    numeric(4,3),
    system_threshold_fit    numeric(4,3),
    system_personality_fit  numeric(4,3),
    system_tag_compatibility numeric(4,3),
    squad_gap_fill          numeric(4,3),

    -- Decomposition (percentages, sum to ~100)
    scout_profile_pct       numeric(5,2),
    performance_data_pct    numeric(5,2),
    contract_age_pct        numeric(5,2),
    market_context_pct      numeric(5,2),
    personality_adj_pct     numeric(5,2),
    style_fit_adj_pct       numeric(5,2),

    -- Confidence
    profile_confidence      numeric(4,3),
    data_coverage           numeric(4,3),
    overall_confidence      text CHECK (overall_confidence IN ('high', 'medium', 'low')),
    band_width_ratio        numeric(5,2),

    -- Flags
    disagreement_flag       boolean DEFAULT false,
    scout_anchored_value    bigint,
    data_implied_value      bigint,
    divergent_features      text[],
    disagreement_narrative  text,
    stale_profile           boolean DEFAULT false,
    low_data_warning        boolean DEFAULT false,
    personality_risk_flags  text[],
    style_risk_flags        text[],

    -- Evaluation context
    mode                    text CHECK (mode IN ('scout_dominant', 'balanced', 'data_dominant')),
    target_position         text,
    target_system           text,
    buying_club_id          bigint REFERENCES clubs(id),
    model_version           text DEFAULT 'v1.0',

    -- Narrative
    narrative               text,

    -- Metadata
    evaluated_at            timestamptz DEFAULT now(),
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_valuations_person
    ON player_valuations(person_id);
CREATE INDEX IF NOT EXISTS idx_player_valuations_evaluated
    ON player_valuations(evaluated_at DESC);

-- ── Comparable transfers (linked to a valuation) ─────────────────────────────

CREATE TABLE IF NOT EXISTS valuation_comparables (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    valuation_id    bigint NOT NULL REFERENCES player_valuations(id) ON DELETE CASCADE,
    person_id       bigint REFERENCES people(id),
    player_name     text NOT NULL,
    from_club       text,
    to_club         text,
    fee_eur         bigint,
    transfer_date   date,
    age_at_transfer int,
    position        text,
    archetype       text,
    similarity_score numeric(4,3),       -- how close in archetype space
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_valuation_comparables_valuation
    ON valuation_comparables(valuation_id);

-- ── Valuation config (style compatibility, positional tiers — reference data) ─

CREATE TABLE IF NOT EXISTS valuation_config (
    key             text PRIMARY KEY,
    value           jsonb NOT NULL,
    description     text,
    updated_at      timestamptz DEFAULT now()
);

-- ── Add trigger for updated_at ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_valuation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_player_valuations_updated ON player_valuations;
CREATE TRIGGER trg_player_valuations_updated
    BEFORE UPDATE ON player_valuations
    FOR EACH ROW EXECUTE FUNCTION update_valuation_timestamp();

-- ── RLS (anon read, service write) ────────────────────────────────────────────

ALTER TABLE player_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_comparables ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_config ENABLE ROW LEVEL SECURITY;

-- Anon can read valuations
CREATE POLICY "anon_read_valuations" ON player_valuations
    FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_comparables" ON valuation_comparables
    FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_config" ON valuation_config
    FOR SELECT TO anon USING (true);

-- Service role full access
CREATE POLICY "service_all_valuations" ON player_valuations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_comparables" ON valuation_comparables
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_config" ON valuation_config
    FOR ALL TO service_role USING (true) WITH CHECK (true);
