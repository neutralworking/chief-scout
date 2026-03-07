# Project Status — Chief Scout

**Last updated:** 2026-03-07
**Audit scope:** `neutralworking/chief-scout` repository only. The Director of Football repo (`neutralworking/director`) was not accessible and requires a separate audit.

---

## Done

### Data Assets & Knowledge Base
- **RSG Player Database**: 1,800+ player profiles in Obsidian vault (`docs/research/rsg.db/main/men/`). Freeform markdown with optional YAML frontmatter (position, club, nation, DoB, class). Quality varies — some profiles are 3 lines, others are 80-line deep dives.
- **CSV Player Data**: 524 players in `Real Players Active.csv` with 46 attributes across Mental/Physical/Tactical/Technical domains. Additional league-specific CSVs (EPL, La Liga, Eredivisie, Scottish, Turkish, Saudi, FIFA).
- **Formation Library**: 30+ tactical formations documented in `docs/Formations/` with analysis and historical context.
- **Scouting Reports**: Kicker rankings by position (9 files), personal match reports (4 files), Champions League/Bundesliga match analyses.
- **Transfer Research**: Market mechanics spec, player valuation model framework, historical transfer data (2023 window reviews).
- **Next Generation**: Youth talent lists from 2017–2022 (10 files).
- **Hall of Fame Data**: EPL, Championship, League 1, League 2 structures (JSON, partially populated).

### Player & Game Attribute Systems
- **Player Attribute Taxonomy**: 13 archetypes (Controller, Commander, Creator, Target, Sprinter, Powerhouse, Cover, Engine, Destroyer, Dribbler, Passer, Striker, GK) across 50+ attributes. Defined in `inbox/PlayerAttributes.csv`.
- **Director of Football Attributes**: 10 character archetypes (Administrator, Figurehead, Savant, Nomad, Dealmaker, Statto, Polyglot, Strategist, Financier, Motivator). Implementation-ready JSON in `inbox/DirectorAttributes.json`.
- **Tactical Styles**: 9 team styles, 10 defensive styles, 10 offensive styles defined as enumerations (`inbox/*TacticalStyles.json`).
- **Staff Tactical Preferences**: Nested decision model for Head Coach/Assistant Manager (`inbox/staffTacticalPreferences.json`). Implementation-ready.
- **Playing Styles Theory**: 5 core styles with compatibility matrix and adaptation mechanics (`inbox/PlayingStyles.md`).

### Design Documents (Specs Complete, No Implementation)
- **Game Design Document**: Full game flow — new game generation, squad population, staff creation, board expectations, narrative backstory, director attributes (`inbox/GameDesignDocument.md`).
- **Gameplay Mechanics**: Dynamic contracts, evolving player profiles, scouting missions, data acquisition, match observation, training, calendar, staff/resource management (`inbox/Gameplay Mechanics.md`).
- **Dashboard UI/UX Spec**: 300+ line comprehensive specification — scout reports, shortlists, depth charts, player profiles, comparison tools, search/filter, audit trail, scouting calendar (`docs/Dashboard.md`).
- **XP/Progression System**: Detailed leveling, challenges, milestones, XP spend design (`inbox/Experience.md`).
- **Transfer Market Interface**: Agent offers, club secretary, news feed, shortlists, radar screen, search, reports archive (`inbox/transfermarket.md`).
- **User Interface Spec**: Screen-by-screen breakdown — Roster, Team, Staff, Board, Market, Academy, Medical, Calendar, Mobile (`inbox/user_interface.md`).

### Scouting Profile Template (Sessions 1–5)
- **21 players profiled** with structured grading: archetype pair, 1–8 attribute scale with confidence levels, personality typing, flags, verdict taxonomy (Benchmark/Monitor/Scout Further/Pass), valuation ranges.
- **Player database tracker**: `docs/Scouting/player_database.md`
- **Pending amendments tracker**: `docs/Scouting/pending_amendments.md` (6 open items: A59–A65)

### Data Pipeline Scripts
- **`scripts/parse_rsg.py`** (294 lines): Parses rsg.db Obsidian vault + CSV data → merges by name slug → upserts to Supabase in batches of 200. Supports `--dry-run` for JSON export. ~80% complete.
- **`scripts/push_to_supabase.py`** (78 lines): Pushes scouting notes, formations to Supabase with retry logic. ~40% complete — has hardcoded credentials (security issue).
- **`scripts/schema_additions.sql`** (39 lines): Adds columns to players table, creates formations and transfers tables with RLS policies. ~95% complete.

---

## In Progress

### Phase 1 — Data Pipeline (from ROADMAP.md)
| Task | Status |
|------|--------|
| Basic Supabase setup and schema | Done |
| RSG.db parser (`parse_rsg.py`) | Done (needs edge case handling) |
| Player data push mechanism | Done (security fix needed) |
| Connect FBRef scraper → chief-scout format | Stub only — `docs/fbref_scraper_n8n.json` is an n8n workflow with placeholder parser |
| Merge rsg.db profiles with transfer_availability archetypes | Not started — submodule empty locally |
| Define canonical player data schema | Not started — CSV schemas are inconsistent across imports |

---

## Not Started

### Phase 2 — Scouting Interface
- Web dashboard (from `docs/Dashboard.md` spec)
- Scouting radar: statistical alert system
- Free agent grader with Transfermarkt scraper
- Formation analysis tool

### Phase 3 — Game Integration
- Export availability scores → Director of Football game
- Inbox event generator: scouting reports as game messages
- Chief Scout NPC role in Director of Football game
- Match simulation engine
- AI opponent behavior
- Save/load system

### Cross-Repo Integration
- Shared Supabase schema contract with Director repo
- Data flow documentation (chief-scout → Supabase → Director)
- Director of Football PO audit (`neutralworking/director`)

---

## Questions for the Product Owner

1. **Canonical schema**: Multiple CSV formats exist (Real Players Active, FIFA import, league-specific files) with different column structures. Which format is authoritative? Should a single canonical schema be defined, or is the merge logic in `parse_rsg.py` the intended approach?

2. **RSG database quality**: 1,200+ profiles are freeform narrative with no consistent structure. The structured scouting template (Sessions 1–5) covers only 21 players. Is there a plan to retrospectively structure the older profiles, or are they research-only?

3. **FBRef scraper**: The n8n workflow has a placeholder parser. Is this still the preferred scraping approach, or has `supabase-fbref-scraper` (referenced in ROADMAP but not in this repo) superseded it?

4. **transfer_availability submodule**: Empty locally. Is the `neutralworking/availability` repo actively maintained? What's its current state?

5. **Game engine**: GDD references Godot/GDScript (`inbox/PlayerModels.gd`) but no Godot project exists in this repo. Is game development happening in the Director repo?

6. **Shared Supabase**: What tables/views does the Director repo read from? Is there a schema contract, or is it ad-hoc?

7. **Scouting spec amendments**: 6 items (A59–A65) are pending in `docs/Scouting/pending_amendments.md`. Should these be integrated before further profiling work, or can they be deferred?

8. **Hardcoded credentials**: `scripts/push_to_supabase.py` contains a Supabase JWT token in plain text. Has this key been rotated? Should it be revoked?

9. **Priority clarity**: The ROADMAP defines 3 phases but doesn't indicate timelines or priorities within phases. What's the next milestone — completing the data pipeline, or starting on the scouting interface?

10. **Director PO audit**: The Director repo wasn't accessible in this session. Should this be prioritised as the next task?
