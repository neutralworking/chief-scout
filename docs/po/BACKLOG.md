# Backlog — Chief Scout

**Last updated:** 2026-03-08
**Prioritisation:** P0 = Critical (do now), P1 = High (do next), P2 = Medium (planned), P3 = Low (when capacity allows)

---

## P0 — Critical

### 1. Fix Hardcoded Supabase Credentials
**Description:** `scripts/push_to_supabase.py` (lines 15–16) contains a Supabase URL and JWT token in plain text, committed to version control. This is a security vulnerability.
**Acceptance Criteria:**
- Credentials removed from source code and git history
- Script reads from environment variables (matching `parse_rsg.py`'s pattern)
- Exposed key rotated in Supabase dashboard
- `.env.example` file added with placeholder values
**Dependencies:** Supabase dashboard access
**Size:** S

### 2. Dashboard MVP
**Description:** `docs/Dashboard.md` contains a 300+ line UI/UX spec. Build a minimal web dashboard covering the core scouting workflow. Already 80% built as player-editor.
**Acceptance Criteria:**
- Player search with filters (position, age, league, attributes)
- Player profile view (attributes, scouting notes, stats)
- Shortlist management (add/remove/compare)
- Data sourced from Supabase
**Dependencies:** None (canonical schema already in Supabase)
**Size:** L

### 3. Ballon d'Or Contention Tags
**Description:** Add player-level tags for "Ballon d'Or Contention" and "Ballon d'Or Top 30 Contention" to distinguish world-class elite from the broader top-flight pool. In progress.
**Acceptance Criteria:**
- New column or tag system on players for Ballon d'Or contention level
- Tags assignable via player profile UI
- Filterable in player list
- Cross-referenced with Guardian Top 100 / other external rankings for initial population
**Dependencies:** None
**Size:** S

### 4. Add Authentication (Supabase Auth)
**Description:** Required for public deployment. Add Supabase Auth to protect the player-editor app.
**Acceptance Criteria:**
- Login/signup flow with Supabase Auth
- Protected routes require authentication
- Session management with refresh tokens
**Dependencies:** None
**Size:** M

### 5. Add Stripe Paywall
**Description:** Required for monetisation. Gate premium features behind a Stripe subscription.
**Acceptance Criteria:**
- Stripe checkout integration
- Subscription status checked on protected routes
- Billing management page
**Dependencies:** #4 (Authentication)
**Size:** M

### 6. Deploy to Vercel
**Description:** Ship the product. Deploy player-editor to Vercel with environment variables configured.
**Acceptance Criteria:**
- Production deployment on Vercel
- Environment variables configured (Supabase, Stripe)
- Custom domain configured
- CI/CD pipeline via GitHub
**Dependencies:** #4 (Authentication), #5 (Stripe)
**Size:** S

---

## P1 — High

### 7. Define Canonical Player Data Schema
**Description:** Multiple CSV formats exist across `docs/Imports/` with inconsistent columns. `parse_rsg.py` merges by name slug which is collision-prone. A canonical schema is needed before further pipeline work.
**Acceptance Criteria:**
- Single schema definition document specifying all player fields, types, and constraints
- Primary key strategy defined (UUID or composite key, not name-based)
- Mapping tables from each CSV format to canonical schema
- `parse_rsg.py` updated to use canonical schema
**Dependencies:** PO decision on authoritative data source (STATUS.md Q1)
**Size:** M

### 8. Complete FBRef Scraper Parser
**Description:** The n8n workflow (`docs/fbref_scraper_n8n.json`) has a placeholder parser that only extracts player names. It needs a full parser to extract stats, positions, and performance data.
**Acceptance Criteria:**
- Parser extracts: name, position, age, nationality, club, season stats (goals, assists, minutes, xG, xA)
- Data maps to canonical player schema
- Error handling for malformed HTML / rate limiting
- At least EPL fully scraped as proof of concept
**Dependencies:** #7 (canonical schema), clarity on whether n8n or `supabase-fbref-scraper` is preferred (STATUS.md Q3)
**Size:** L

### 9. Integrate Scouting Spec Amendments (A59–A65)
**Description:** 6 pending amendments in `docs/Scouting/pending_amendments.md` that affect the scouting profile template: environment qualifier, loan flag, release clause fields, U21 trajectory splits.
**Acceptance Criteria:**
- All 6 amendments integrated into the scouting profile template
- Existing 21 player profiles updated where applicable
- `pending_amendments.md` cleared or archived
**Dependencies:** None
**Size:** M

### 10. Data Validation Layer
**Description:** No validation exists between data parsing and Supabase writes. Bad data (nulls, wrong types, duplicate names) can enter the database silently.
**Acceptance Criteria:**
- Validation rules defined for each field (type, range, required/optional)
- Validation runs before upsert, with clear error reporting
- Invalid records logged, not silently dropped
- Dry-run mode shows validation results
**Dependencies:** #7 (canonical schema)
**Size:** M

---

## P2 — Medium

### 11. Formation Analysis Tool
**Description:** 30+ formations are documented in markdown but not queryable. Build a tool to browse, compare, and analyse formations.
**Acceptance Criteria:**
- Formations data in Supabase (schema exists in `schema_additions.sql`)
- Browse/search interface
- Formation comparison view
- Player fit analysis (which players suit which formation)
**Dependencies:** Formations data populated in Supabase
**Size:** M

---

## P3 — Low

### 12. Opposition Scouting Templates
**Description:** `docs/Dashboard.md` specifies opposition scouting with fixture lists and specialised templates, but no templates exist.
**Acceptance Criteria:**
- Opposition scouting template defined
- Integrates with fixture calendar
- Links to formation analysis
**Dependencies:** #2 (Dashboard MVP), #11 (Formation tool)
**Size:** M

### 13. Evolve Loan Status Model
**Description:** Current `loan_status` column uses the same enum as `squad_role` (`key_player`, `important_player`, `rotation`, `backup`, `youth`). This captures the loan *mission* (e.g. Xavi Simons = key player trial, Nwaneri = youth development) but lacks loan-specific metadata: direction (in/out), option/obligation type, parent club, loan expiry, and a freetext "loan mission" note.
**Acceptance Criteria:**
- Loan direction tracked (loan_in, loan_out)
- Option/obligation type (none, option_to_buy, obligation_to_buy)
- Parent club field (who owns the player)
- Loan expiry date
- Freetext loan mission note
- UI updated to show loan context on player profile and squad page
**Dependencies:** Squad assessment feature (done)
**Size:** M

### 14. Error Logging & Monitoring
**Description:** Pipeline scripts print errors to stdout with no structured logging. No monitoring of data pipeline health.
**Acceptance Criteria:**
- Python logging module used in all scripts
- Log levels: INFO for operations, WARNING for data issues, ERROR for failures
- Log output to file with rotation
- Summary report after each pipeline run
**Dependencies:** None
**Size:** S

---

## Killed

| # | Item | Reason |
|---|------|--------|
| -- | Unify CSV Import Schemas | Data already in Supabase, archaeology |
| -- | Director of Football Repo -- PO Audit | Game doesn't exist |
| -- | Document Shared Supabase Contract | No Director app reads from Supabase |
| -- | Quantify XP System | Game feature |
| -- | Transfer Market Backend Schema | No real data to populate |
| -- | Populate transfer_availability Submodule | Game integration, zero revenue |
| -- | Fix Hall of Fame JSON | Nobody pays for this |
| -- | Mobile UI Specification | Responsive CSS handles this |
| -- | Playing Styles Implementation | Game feature |
