# Architectural & Product Decisions — Chief Scout

**Last updated:** 2026-03-07
**Source:** Inferred from codebase, documentation, and commit history. Rationale is reconstructed where not explicitly stated.

---

## D1. Shared Supabase as Cross-Repo Integration Layer

**Decision:** Chief-scout and Director of Football (`neutralworking/director`) share a single Supabase instance. Chief-scout writes player data, scouting notes, and formations; Director reads them for game logic.

**Rationale:** Avoids building a custom API layer. Supabase provides real-time subscriptions, RLS policies, and a REST API out of the box — suitable for a two-repo architecture where one is a data producer and the other is a consumer.

**Evidence:** `scripts/push_to_supabase.py`, `scripts/schema_additions.sql` (RLS policies with public read access), ROADMAP reference to `director/` receiving data from chief-scout.

**Risk:** No schema contract exists. See RISKS.md.

---

## D2. Supabase as Backend (Not Self-Hosted Postgres or Firebase)

**Decision:** Use Supabase (hosted) for the database layer rather than self-hosted PostgreSQL, Firebase, or another BaaS.

**Rationale:** Supabase offers PostgreSQL with built-in auth, RLS, real-time, and a dashboard — reducing ops burden for a small project. The SQL-first approach aligns with the relational data model (players, formations, transfers with foreign keys).

**Evidence:** `scripts/schema_additions.sql` uses Supabase-specific RLS syntax. `parse_rsg.py` uses the `supabase-py` client library.

---

## D3. Python for Data Pipeline

**Decision:** Data pipeline scripts are written in Python, not Node.js, Go, or other languages.

**Rationale:** Python's ecosystem for data parsing (YAML, CSV, markdown) is mature. The project uses `pyyaml` for YAML frontmatter parsing and standard `csv` module. Python is also the language of the `supabase-py` client.

**Evidence:** `scripts/parse_rsg.py`, `scripts/push_to_supabase.py`.

---

## D4. Obsidian Vault as Primary Knowledge Base

**Decision:** The player research database (1,800+ profiles) is maintained as an Obsidian vault (`docs/research/rsg.db/`) with markdown files and YAML frontmatter, rather than starting with a structured database.

**Rationale:** Obsidian enables freeform note-taking, linking between profiles, and a low barrier to entry for scouting research. The markdown format is human-readable and version-controlled. The trade-off is that data is inconsistently structured across profiles.

**Evidence:** `docs/research/rsg.db/main/men/` contains 1,800+ `.md` files. `parse_rsg.py` explicitly parses this vault. `docs/Changelog.md` references "Obsidian vault learning."

**Consequence:** A parsing layer (`parse_rsg.py`) is needed to extract structured data, and profile quality varies significantly.

---

## D5. Modular Architecture via Git Submodules

**Decision:** The `transfer_availability` component is a separate repo (`neutralworking/availability`) included as a git submodule, rather than being part of the chief-scout monorepo.

**Rationale:** Separation of concerns — the player decision-making model (archetypes, transfer likelihood) is a distinct domain from scouting data collection. Submodules allow independent development and versioning.

**Evidence:** `.gitmodules` file, ROADMAP architecture diagram showing `transfer_availability/` as a submodule.

---

## D6. Data-First Approach (Knowledge Base Before Interfaces)

**Decision:** Build the research database, specifications, and data pipeline before building any user-facing interface or game integration.

**Rationale:** The project's value proposition is grounded in real football data and scouting knowledge. Building the knowledge base first ensures the interface has meaningful content from day one. This also allows the data model to stabilise before committing to a UI.

**Evidence:** Git history shows data/docs commits preceding any interface work. ROADMAP phases: Phase 1 (Data Pipeline) → Phase 2 (Scouting Interface) → Phase 3 (Game Integration). No frontend code exists.

---

## D7. 13-Archetype Player Model (Not Individual Attributes)

**Decision:** Players are categorised into 13 archetypes (Controller, Commander, Creator, Target, Sprinter, Powerhouse, Cover, Engine, Destroyer, Dribbler, Passer, Striker, GK) rather than using Football Manager's approach of 40+ individual attributes rated independently.

**Rationale:** Archetypes provide a higher-level abstraction that aligns with real-world scouting language ("he's a destroyer," "she's a creator"). This reduces the attribute space while maintaining meaningful differentiation. The archetype pair system (primary + secondary with independent scores) adds nuance.

**Evidence:** `inbox/PlayerAttributes.csv` defines 13 models. `docs/Scouting/player_database.md` grades players with archetype pairs (e.g., Creator-Dribbler 75/73). `inbox/PlayerModels.gd` implements the archetypes in GDScript.

---

## D8. n8n for Scraping Workflows

**Decision:** Use n8n (workflow automation platform) for FBRef data scraping, rather than building custom Python scrapers.

**Rationale:** n8n provides visual workflow building, scheduling, and built-in HTTP/parsing nodes. This separates the scraping orchestration from the data processing logic.

**Evidence:** `docs/fbref_scraper_n8n.json` is an n8n workflow definition with HTTP request nodes, regex extraction, and Supabase upsert.

**Status:** Currently non-functional — the parser node is a placeholder.

---

## D9. GDScript / Godot for Game Engine

**Decision:** The Director of Football game uses Godot Engine with GDScript, not Unity (C#) or Unreal (C++).

**Rationale:** Godot is open-source, lightweight, and well-suited for non-3D games. GDScript has a low learning curve. The game's UI-heavy, text-driven nature doesn't require Unity/Unreal's rendering capabilities.

**Evidence:** `inbox/PlayerModels.gd` is GDScript code. GDD references game flow that aligns with Godot's scene/node architecture.

---

## D10. Name-Based Merge Key for Player Data

**Decision:** Player records from different data sources (rsg.db, CSV, FBRef) are merged using a slugified player name, not a unique ID.

**Rationale:** No universal player ID exists across data sources. Name slugification is the simplest approach for an initial implementation.

**Evidence:** `parse_rsg.py` creates `name_slug` from player names and uses it as the merge key between RSG vault records and CSV data.

**Risk:** Name collisions are likely (e.g., multiple players named "Mohamed Salah" across generations). See RISKS.md.

---

## D11. Structured Scouting Template (Sessions 1–5)

**Decision:** A standardised scouting profile template was introduced in Sessions 1–5, featuring: overview table, archetype pair with scores, key attributes (1–8 scale with confidence), season stats, key moments (evidence base), personality typing, flags, verdict taxonomy, and valuation range.

**Rationale:** Freeform notes in rsg.db are useful for research but not actionable for the data pipeline or game integration. The structured template enables consistent grading and comparison.

**Evidence:** `docs/Scouting/Kenan Yildiz.md` and `Davis Keillor-Dunn.md` follow the template. `docs/Scouting/player_database.md` tracks all 21 profiled players.

**Status:** 21 players profiled. 1,800+ legacy profiles remain freeform. 6 spec amendments pending (A59–A65).
