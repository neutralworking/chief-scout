-- 020_goals_awards_contract.sql
-- Add columns for Wikidata goals/awards enrichment and Transfermarkt contract data.

-- P6509: total career goals from Wikidata
ALTER TABLE people ADD COLUMN IF NOT EXISTS total_goals integer;

-- P166: awards (Ballon d'Or, Golden Boot, etc.) from Wikidata — stored as JSON array
ALTER TABLE people ADD COLUMN IF NOT EXISTS awards jsonb;

-- Contract expiry from Transfermarkt dataset (dcaribou/transfermarkt-datasets)
ALTER TABLE people ADD COLUMN IF NOT EXISTS contract_expiry_date date;
ALTER TABLE people ADD COLUMN IF NOT EXISTS agent_name text;

-- Index for contract expiry queries (find expiring contracts)
CREATE INDEX IF NOT EXISTS idx_people_contract_expiry ON people(contract_expiry_date)
    WHERE contract_expiry_date IS NOT NULL;
