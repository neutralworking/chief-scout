# Chief Scout — Roadmap

## What it is
A football scouting and management platform. The `transfer_availability` submodule models player decision-making. The `docs/research/rsg.db` vault is the knowledge base (1500+ player profiles, club data, formations). The `docs/design/` and `docs/game-data/` folders hold game design docs and data.

## Architecture
```
chief-scout/
├── pipeline/                ← data pipeline (14 numbered scripts)
├── apps/player-editor/      ← Next.js player intelligence UI
├── prototypes/              ← prototype log + tracking (INDEX.md)
├── imports/                 ← CSV data (Real Players Active, clubs)
├── transfer_availability/   ← submodule: player archetype + transfer model
├── docs/
│   ├── research/rsg.db/     ← Obsidian vault: player/club/nation database
│   ├── design/              ← game design documents
│   ├── game-data/           ← tactical styles, attributes, hall of fame
│   ├── formations/          ← formation analysis (100+ formations)
│   └── transfers/           ← transfer market research
└── archive/                 ← stale files kept for reference
```

## Phase 1 — Data Pipeline [DONE]
- [x] Parse rsg.db + Real Players CSV into merged player dataset
- [x] Push to Supabase (players + formations)
- [x] Enrich nation/position from people table + attributes
- [x] Compute archetypes, MVT, scarcity scores
- [x] Add DoF decision columns
- [x] Centralise credentials via `.env` + `config.py`
- [x] Number pipeline scripts, add Makefile automation
- [x] External data ingestion: StatsBomb, Understat, FBRef, News (scripts 08-12)
- [x] Player matching across data sources (script 10)
- [ ] Connect `supabase-fbref-scraper` output as additional data source

## Phase 2 — Scouting Interface [DONE]
- [x] **B1: App shell** — Next.js scaffold, player list with filters, detail page
- [x] **B3: Wire `player_intelligence_card` view end-to-end** — server components, Supabase queries, all zones populated
- [x] **C1: `<PersonalityBadge>` + `<ArchetypeShape>` hero components** — football personality matrix, dimension bars, archetype model fit
- [x] **C3: `<PlayerIdentityPanel>` composite** — WHO + HOW paired in reusable layout
- [x] **D3: `<KeyMomentsList>` + `<NewsModal>`** — sentiment dots, type badges, click-to-expand modal with story summary
- [x] **E3-E4: Player list refinements** — debounced search (/ shortcut), tier filter, peak sort, clear filters
- [x] **F1-F3: QA pass** — accessibility (ARIA roles on modal/tabs), responsive grids, input validation
- [ ] B2: Design token refinement (Inter/JetBrains Mono fonts, spacing)
- [ ] E1: Attribute detail drill-down with progressive disclosure
- [ ] Build web dashboard from Dashboard.md spec
- [ ] Scouting radar: statistical alert system (see Scripts.md)
- [ ] Free agent grader: Transfermarkt scraper → ranked shortlists
- [ ] Formation analysis tool: match formations in `docs/formations/` to squad

## Phase 3 — Game Integration
- [ ] Export availability scores to Director of Football game
- [ ] Inbox event generator: scouting reports as game messages
- [ ] Chief Scout role as NPC in DoF game

## Phase 4 — News Layer [IN PROGRESS]
- [x] Create `news_stories` + `news_player_tags` Supabase tables (migration 003 + 005)
- [x] `12_news_ingest.py` — RSS fetch + Gemini Flash tagging pipeline
- [x] Player name matching against `people` table (script 10)
- [x] **Scout Pad integration** — News tab on player card with tabbed UI, sentiment dots, story type badges
- [ ] Director integration — transfer rumours as inbox events
- [ ] News-driven alerts — surface breaking stories on player list

## Phase 5 — Coverage Scaling [DONE]
- [x] Scale player profiles from 23 → 50 (seed script 14)
- [x] Fill positional gaps: CD (1→6), WD (3→8), CM (3→7), DM (3→5)
- [x] Full position coverage: GK:4, CD:6, WD:8, DM:5, CM:7, WM:2, AM:2, WF:9, CF:7

## Connects to
- `director/` — chief scout provides player data + scouting reports to the game
- `supabase-fbref-scraper/` — data source
- `transfer_availability/` — player decision model
- News Layer — real-world stories feed availability signals + game inbox events
