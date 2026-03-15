-- 030_transfers.sql
-- Recent Transfers registry
-- Master table of transfer records for valuation comparables and frontend display

-- ── Transfers table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transfers (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_name          text NOT NULL,
    player_id            bigint REFERENCES people(id) ON DELETE SET NULL,
    age_at_transfer      int,
    position             text,
    from_club            text NOT NULL,
    from_league          text,
    to_club              text NOT NULL,
    to_league            text,
    fee_eur_m            numeric(6,2),           -- fee in EUR millions. 0 for free/loan. NULL if undisclosed
    fee_type             text NOT NULL CHECK (fee_type IN (
        'permanent', 'loan', 'loan_obligation', 'loan_option',
        'free', 'swap', 'pre_agreed', 'undisclosed'
    )),
    deal_context         text CHECK (deal_context IN (
        'release_clause', 'transfer_request', 'contract_expiring',
        'mutual_termination', 'club_decision', 'player_surplus',
        'financial_distress', 'pre_contract', 'loan_recall', 'other'
    )),
    loan_fee_eur_m       numeric(6,2),
    obligation_fee_eur_m numeric(6,2),
    contract_years       numeric(3,1),
    transfer_date        date NOT NULL,
    window               text,                   -- e.g. '2025_jan', '2025_summer'
    primary_archetype    text,                   -- Chief Scout archetype label
    notes                text,
    source_url           text,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now(),

    UNIQUE(player_name, transfer_date, to_club)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transfers_player_name ON transfers(player_name);
CREATE INDEX IF NOT EXISTS idx_transfers_player_id   ON transfers(player_id);
CREATE INDEX IF NOT EXISTS idx_transfers_position    ON transfers(position);
CREATE INDEX IF NOT EXISTS idx_transfers_window      ON transfers(window);
CREATE INDEX IF NOT EXISTS idx_transfers_fee         ON transfers(fee_eur_m);
CREATE INDEX IF NOT EXISTS idx_transfers_date        ON transfers(transfer_date DESC);

-- ── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_transfers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transfers_updated ON transfers;
CREATE TRIGGER trg_transfers_updated
    BEFORE UPDATE ON transfers
    FOR EACH ROW EXECUTE FUNCTION update_transfers_timestamp();

-- ── View: transfer_comparables (enriched with player profile data) ──────────

CREATE OR REPLACE VIEW transfer_comparables AS
SELECT
    t.*,
    pp.archetype   AS profile_archetype,
    pp.overall,
    pp.blueprint,
    pp.position    AS profile_position,
    pe.nation_id,
    n.name         AS nation
FROM transfers t
LEFT JOIN player_profiles pp ON pp.person_id = t.player_id
LEFT JOIN people pe          ON pe.id = t.player_id
LEFT JOIN nations n          ON n.id = pe.nation_id;

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "anon_read_transfers" ON transfers
        FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "authenticated_read_transfers" ON transfers
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "service_all_transfers" ON transfers
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
