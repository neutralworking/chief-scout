# Backlog — Chief Scout

**Last updated:** 2026-03-07
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

### 2. Define Canonical Player Data Schema
**Description:** Multiple CSV formats exist across `docs/Imports/` with inconsistent columns. `parse_rsg.py` merges by name slug which is collision-prone. A canonical schema is needed before further pipeline work.
**Acceptance Criteria:**
- Single schema definition document specifying all player fields, types, and constraints
- Primary key strategy defined (UUID or composite key, not name-based)
- Mapping tables from each CSV format to canonical schema
- `parse_rsg.py` updated to use canonical schema
**Dependencies:** PO decision on authoritative data source (STATUS.md Q1)
**Size:** M

---

## P1 — High

### 3. Complete FBRef Scraper Parser
**Description:** The n8n workflow (`docs/fbref_scraper_n8n.json`) has a placeholder parser that only extracts player names. It needs a full parser to extract stats, positions, and performance data.
**Acceptance Criteria:**
- Parser extracts: name, position, age, nationality, club, season stats (goals, assists, minutes, xG, xA)
- Data maps to canonical player schema
- Error handling for malformed HTML / rate limiting
- At least EPL fully scraped as proof of concept
**Dependencies:** #2 (canonical schema), clarity on whether n8n or `supabase-fbref-scraper` is preferred (STATUS.md Q3)
**Size:** L

### 4. Integrate Scouting Spec Amendments (A59–A65)
**Description:** 6 pending amendments in `docs/Scouting/pending_amendments.md` that affect the scouting profile template: environment qualifier, loan flag, release clause fields, U21 trajectory splits.
**Acceptance Criteria:**
- All 6 amendments integrated into the scouting profile template
- Existing 21 player profiles updated where applicable
- `pending_amendments.md` cleared or archived
**Dependencies:** None
**Size:** M

### 5. Unify CSV Import Schemas
**Description:** 33 CSV files in `docs/Imports/` use different column structures. Some are duplicates (players_updated.csv, players copy.csv). One is empty (player_import.csv).
**Acceptance Criteria:**
- Audit of all 33 CSVs: identify duplicates, empties, and outliers
- Dead files removed or archived
- Remaining files documented with purpose and column mapping
- Import script handles all remaining formats
**Dependencies:** #2 (canonical schema)
**Size:** M

### 6. Data Validation Layer
**Description:** No validation exists between data parsing and Supabase writes. Bad data (nulls, wrong types, duplicate names) can enter the database silently.
**Acceptance Criteria:**
- Validation rules defined for each field (type, range, required/optional)
- Validation runs before upsert, with clear error reporting
- Invalid records logged, not silently dropped
- Dry-run mode shows validation results
**Dependencies:** #2 (canonical schema)
**Size:** M

### 7. Director of Football Repo — PO Audit
**Description:** The Director repo (`neutralworking/director`) needs the same PO documentation suite (STATUS, BACKLOG, DECISIONS, RISKS). Deferred from this session because the repo wasn't accessible.
**Acceptance Criteria:**
- STATUS.md, BACKLOG.md, DECISIONS.md, RISKS.md created in Director repo
- Cross-references to chief-scout documented
- Shared Supabase schema contract defined
**Dependencies:** Repo access
**Size:** L

### 8. Document Shared Supabase Contract
**Description:** Chief-scout and Director share a Supabase database but there's no documented schema contract. Neither repo defines which tables/views the other reads or writes.
**Acceptance Criteria:**
- Schema contract document listing all tables, ownership (which repo writes), and consumers (which repo reads)
- Migration strategy for schema changes
- Supabase RLS policies reviewed for cross-repo access
**Dependencies:** #7 (Director audit, to understand Director's data needs)
**Size:** M

---

## P2 — Medium

### 9. Dashboard MVP
**Description:** `docs/Dashboard.md` contains a 300+ line UI/UX spec. Build a minimal web dashboard covering the core scouting workflow.
**Acceptance Criteria:**
- Player search with filters (position, age, league, attributes)
- Player profile view (attributes, scouting notes, stats)
- Shortlist management (add/remove/compare)
- Data sourced from Supabase
**Dependencies:** #2 (canonical schema), #3 (FBRef data), shared Supabase populated
**Size:** L

### 10. Formation Analysis Tool
**Description:** 30+ formations are documented in markdown but not queryable. Build a tool to browse, compare, and analyse formations.
**Acceptance Criteria:**
- Formations data in Supabase (schema exists in `schema_additions.sql`)
- Browse/search interface
- Formation comparison view
- Player fit analysis (which players suit which formation)
**Dependencies:** Formations data populated in Supabase
**Size:** M

### 11. Quantify XP System
**Description:** `inbox/Experience.md` defines the XP/progression system conceptually but lacks specific values. Needs numeric tuning before implementation.
**Acceptance Criteria:**
- XP values assigned to each action type
- Level progression curve formula defined
- Challenge reward amounts specified
- Balancing document with rationale
**Dependencies:** None (design work only)
**Size:** S

### 12. Transfer Market Backend Schema
**Description:** `inbox/transfermarket.md` specifies a rich transfer market interface but no backend schema exists for agent offers, shortlists, alerts, or radar data.
**Acceptance Criteria:**
- Supabase schema for: agent_offers, shortlists, shortlist_players, alerts, transfer_news
- RLS policies defined
- Migration SQL ready to run
**Dependencies:** #8 (shared Supabase contract — Director may also write to these tables)
**Size:** M

### 13. Populate transfer_availability Submodule
**Description:** The `transfer_availability` git submodule points to `neutralworking/availability` but is empty locally. It's referenced in ROADMAP as the player decision-making model.
**Acceptance Criteria:**
- Submodule checked out and functional
- Integration point with `parse_rsg.py` documented
- Archetype merge logic implemented or scoped
**Dependencies:** `neutralworking/availability` repo status
**Size:** M

---

## P3 — Low

### 14. Fix Hall of Fame JSON
**Description:** `inbox/hallOfFame/hall_of_fame_template.json` has malformed JSON (trailing commas, syntax errors). Other HoF files are structured but unpopulated.
**Acceptance Criteria:**
- Template JSON valid and parseable
- At least one league fully populated as example
- Script to validate HoF JSON files
**Dependencies:** None
**Size:** S

### 15. Opposition Scouting Templates
**Description:** `docs/Dashboard.md` specifies opposition scouting with fixture lists and specialised templates, but no templates exist.
**Acceptance Criteria:**
- Opposition scouting template defined
- Integrates with fixture calendar
- Links to formation analysis
**Dependencies:** #9 (Dashboard MVP), #10 (Formation tool)
**Size:** M

### 16. Mobile UI Specification
**Description:** `inbox/user_interface.md` mentions a mobile interface but details are minimal compared to the desktop Dashboard spec.
**Acceptance Criteria:**
- Mobile-specific screen layouts defined
- Touch interaction patterns documented
- Responsive breakpoints specified
**Dependencies:** #9 (Dashboard MVP — desktop first)
**Size:** M

### 17. Playing Styles Implementation
**Description:** `inbox/PlayingStyles.md` defines a compatibility matrix and adaptation mechanics but with no numeric values (penalty percentages, adaptation durations).
**Acceptance Criteria:**
- Numeric values for all compatibility matrix cells
- Adaptation time durations specified
- Team cohesion formula defined
- Integration points with player attributes documented
**Dependencies:** #11 (XP system quantification — related game balance)
**Size:** M

### 18. Error Logging & Monitoring
**Description:** Pipeline scripts print errors to stdout with no structured logging. No monitoring of data pipeline health.
**Acceptance Criteria:**
- Python logging module used in all scripts
- Log levels: INFO for operations, WARNING for data issues, ERROR for failures
- Log output to file with rotation
- Summary report after each pipeline run
**Dependencies:** None
**Size:** S
