# Risk Register — Chief Scout

**Last updated:** 2026-03-07

---

## Scope Creep

### R1. GDD Describes 7+ Interconnected Systems
**Description:** The Game Design Document and Gameplay Mechanics spec cover contracts, XP/progression, training, match simulation, staff management, calendar, scouting missions, and data acquisition. Each of these is a substantial subsystem. Building all of them to the spec's level of detail is a multi-year effort.
**Impact:** High — if all systems are treated as MVP requirements, nothing ships.
**Mitigation:** Define a vertical slice. Identify the 2–3 core loops that make the game playable and defer the rest. The ROADMAP's 3-phase structure helps, but Phase 3 alone contains multiple large subsystems.
**Source:** `inbox/GameDesignDocument.md`, `inbox/Gameplay Mechanics.md`

### R2. Dashboard Spec Is Feature-Complete Before Any Code Exists
**Description:** `docs/Dashboard.md` specifies 15+ widgets, comparison tools, advanced search (FM Scout-style filtering), audit trails, mobile apps, email notifications, and opposition scouting — all before a single line of frontend code.
**Impact:** Medium — risk of building to a spec that hasn't been validated by user feedback.
**Mitigation:** Define a Dashboard MVP (see BACKLOG #9) with 3–4 core screens. Validate with users before expanding.
**Source:** `docs/Dashboard.md`

### R3. Transfer Market Spec Assumes Multiple Subsystems
**Description:** The transfer market interface spec includes agent personality systems, trustworthiness ratings, club secretary NPCs, radar visualisation, and alert mechanics — each requiring backend logic, data models, and game balance.
**Impact:** Medium — these features are engaging but each is a project in itself.
**Mitigation:** Start with basic transfer search and shortlisting. Layer in agent/secretary mechanics in later iterations.
**Source:** `inbox/transfermarket.md`

---

## Unresolved Dependencies

### R4. transfer_availability Submodule Is Empty Locally
**Description:** The git submodule at `transfer_availability/` points to `neutralworking/availability` but isn't checked out. ROADMAP Phase 1 requires merging rsg.db profiles with transfer_availability archetypes.
**Impact:** High — blocks a Phase 1 deliverable.
**Mitigation:** Check out the submodule. Assess if the availability repo is maintained and functional.
**Source:** `.gitmodules`, ROADMAP.md

### R5. FBRef Scraper Is Non-Functional
**Description:** The n8n workflow (`docs/fbref_scraper_n8n.json`) has a placeholder parser. It can fetch web pages but extracts only player names — all stat data is discarded.
**Impact:** High — no automated data pipeline for real-time player statistics.
**Mitigation:** Either complete the n8n parser or confirm that `supabase-fbref-scraper` (referenced in ROADMAP but not in this repo) is the replacement.
**Source:** `docs/fbref_scraper_n8n.json`

### R6. No Godot Project Exists in This Repo
**Description:** GDD and gameplay mechanics are fully specced. `inbox/PlayerModels.gd` contains GDScript code. But no Godot project file (`.godot`), scene files, or game assets exist.
**Impact:** Medium — game development may be happening in the Director repo, but this is unconfirmed.
**Mitigation:** Clarify which repo owns the Godot project. If Director, document the boundary.
**Source:** `inbox/PlayerModels.gd`, `inbox/GameDesignDocument.md`

### R7. Director Repo Not Audited
**Description:** The Director of Football repo (`neutralworking/director`) is a consumer of chief-scout data via shared Supabase, but it couldn't be accessed during this audit.
**Impact:** Medium — can't verify integration assumptions, shared schema usage, or Director-side requirements.
**Mitigation:** Run PO audit on Director repo in next session (BACKLOG #7).
**Source:** ROADMAP.md, user confirmation

---

## Missing Specifications

### R8. No Match Simulation Engine Spec
**Description:** The GDD implies matchday involvement and performance-based outcomes, but no specification exists for how matches are simulated or how player attributes affect results.
**Impact:** High — match simulation is core to a football game. Without it, the game loop is incomplete.
**Mitigation:** Decide whether chief-scout needs match simulation or if that's purely a Director concern.
**Source:** `inbox/GameDesignDocument.md`

### R9. No Save/Load or Persistence Spec
**Description:** The game design implies long-running campaigns (seasons, transfers, player development) but there's no specification for game state persistence.
**Impact:** Medium — fundamental for a game, but only relevant when game development begins.
**Source:** `inbox/GameDesignDocument.md`

### R10. AI Opponent Behavior Undefined
**Description:** GDD mentions "AI Directors" but doesn't define how AI-controlled teams make decisions (transfers, tactics, team selection).
**Impact:** Medium — needed for game realism but deferrable to game development phase.
**Source:** `inbox/GameDesignDocument.md`

---

## Technical Debt

### R11. Hardcoded Supabase Credentials (CRITICAL)
**Description:** `scripts/push_to_supabase.py` lines 15–16 contain a Supabase URL and JWT token in plain text, committed to git. This is a security vulnerability.
**Impact:** Critical — anyone with repo access can read/write the database.
**Mitigation:** Rotate the key immediately. Move to environment variables. See BACKLOG #1.
**Source:** `scripts/push_to_supabase.py`

### R12. Name-Based Merge Key Causes Collisions
**Description:** `parse_rsg.py` merges RSG vault records with CSV data using a slugified player name. Common names (e.g., "Mohamed Salah," "David Silva") could cause false matches or overwrites.
**Impact:** Medium — data corruption for affected players.
**Mitigation:** Introduce a composite key (name + club + DoB) or adopt an external player ID system.
**Source:** `scripts/parse_rsg.py`

### R13. No Data Validation Before Database Writes
**Description:** Pipeline scripts push data to Supabase without validation. Null values, wrong types, and malformed data can enter the database silently.
**Impact:** Medium — bad data propagates to Director repo via shared Supabase.
**Mitigation:** Add validation layer. See BACKLOG #6.
**Source:** `scripts/parse_rsg.py`, `scripts/push_to_supabase.py`

### R14. Broken Hall of Fame JSON Template
**Description:** `inbox/hallOfFame/hall_of_fame_template.json` has trailing commas and syntax errors — it's not valid JSON.
**Impact:** Low — won't parse if consumed by code.
**Mitigation:** Fix syntax. See BACKLOG #14.
**Source:** `inbox/hallOfFame/hall_of_fame_template.json`

### R15. Attribute Name Typo
**Description:** `parse_rsg.py` line 127 maps "Concentraion" (misspelled) from the CSV. If the CSV header is also misspelled, this works accidentally. If corrected in CSV, the mapping breaks.
**Impact:** Low — fragile coupling.
**Mitigation:** Fix typo in both CSV and script. Add header validation.
**Source:** `scripts/parse_rsg.py`

---

## Data Quality

### R16. RSG Database Profiles Are Inconsistently Structured
**Description:** 1,800+ player profiles in `docs/research/rsg.db/` range from 3-line stubs to 80-line deep dives. Most are freeform narrative with no consistent structure. Only 21 players (Sessions 1–5) use the structured template.
**Impact:** Medium — the parser can extract YAML frontmatter where it exists, but most profiles lack it. Scouting notes are truncated at 4,000 characters.
**Mitigation:** Accept that legacy profiles are research-only. Focus structured template on new profiling work. Consider LLM-assisted extraction for high-value legacy profiles.
**Source:** `docs/research/rsg.db/main/men/`

### R17. Inconsistent CSV Schemas Across Imports
**Description:** 33 CSV files in `docs/Imports/` use different column structures. Some are duplicates (players_updated.csv, players copy.csv). One is empty (player_import.csv). FIFA import has GK-specific columns that don't map to the chief-scout attribute system.
**Impact:** Medium — confusion about which file is authoritative. Import scripts may break on unexpected formats.
**Mitigation:** Audit and consolidate. See BACKLOG #5.
**Source:** `docs/Imports/`

### R18. Scouting Spec In Flux (6 Pending Amendments)
**Description:** `docs/Scouting/pending_amendments.md` lists 6 unintegrated changes (A59–A65) including environment qualifiers, loan flags, release clause fields, and U21 trajectory splits. The scouting template is still evolving.
**Impact:** Low-Medium — new profiles may be graded against an outdated spec.
**Mitigation:** Integrate amendments before next profiling session. See BACKLOG #4.
**Source:** `docs/Scouting/pending_amendments.md`

---

## Integration Risk

### R19. No Schema Contract Between Chief-Scout and Director
**Description:** Both repos share a Supabase instance, but there's no documented agreement on which tables each repo owns, which columns are stable, or how schema migrations are coordinated.
**Impact:** High — a schema change in chief-scout could break Director, or vice versa.
**Mitigation:** Define and document the schema contract. See BACKLOG #8.
**Source:** Inferred from architecture

### R20. Three-System Architecture With No Integration Tests
**Description:** The full system spans chief-scout (data pipeline), Supabase (shared database), and Director (game engine). No integration tests verify that data flows correctly end-to-end.
**Impact:** Medium — changes in one system can silently break another.
**Mitigation:** Define integration test suite once schema contract is established.
**Source:** Inferred from architecture

---

## Items That Could Not Be Determined

The following were not determinable from the chief-scout codebase alone:

1. **Director repo state** — What's built, what's specced, what's the game engine status?
2. **Supabase instance health** — Is the database populated? What tables exist beyond schema_additions.sql?
3. **supabase-fbref-scraper status** — Referenced in ROADMAP but not in this repo. Does it exist? Is it functional?
4. **availability repo status** — Submodule points to it but it's not checked out. Is it maintained?
5. **Credential exposure scope** — Has the hardcoded Supabase key been used by others? Has it been rotated?
6. **User base** — Is this a solo project or does it have contributors/users?
7. **Deployment environment** — Where does n8n run? Where would the Dashboard be hosted?
