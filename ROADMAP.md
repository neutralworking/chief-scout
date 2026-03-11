# Chief Scout — Roadmap

## What it is
A football scouting and player intelligence platform. Data pipeline ingests from 5+ external sources, normalizes into Supabase, computes derived insights (archetypes, personality, market valuations), and serves them through products for professional, consumer, and casual audiences.

## Architecture
```
chief-scout/
├── pipeline/                ← data pipeline (15 numbered scripts)
├── apps/player-editor/      ← Next.js player intelligence UI
├── prototypes/              ← prototype log + tracking (INDEX.md)
├── imports/                 ← CSV data (Real Players Active, clubs)
├── transfer_availability/   ← submodule: player archetype + transfer model
├── docs/
│   ├── research/rsg.db/     ← Obsidian research vault (reference data)
│   ├── design/              ← game design documents
│   ├── game-data/           ← tactical styles, attributes, hall of fame
│   ├── formations/          ← formation analysis (100+ formations)
│   └── transfers/           ← transfer market research
└── archive/                 ← stale files kept for reference
```

## Strategic Priorities (in order)
1. **Data density** — Maximum high-quality structured player data in Supabase
2. **Data freshness** — Automation to keep data current without manual terminal work
3. **Derived insights** — Unique computed metrics, archetypes, personality, market intelligence
4. **Products** — Frontends for professional (scouting tool), consumer (player intel), casual (games)

## North Star Metric
Full player profiles in production (profile + personality + market + attributes + status).
Current: **23 confirmed full profiles.** Target: **200+ by end of March.**

---

## Phase 1 — Data Pipeline [DONE]
- [x] Parse research vault + Real Players CSV into merged player dataset
- [x] Push to Supabase (players + formations)
- [x] Enrich nation/position from people table + attributes
- [x] Compute archetypes, MVT, scarcity scores
- [x] Add DoF decision columns
- [x] Centralise credentials via `.env` + `config.py`
- [x] Number pipeline scripts, add Makefile automation
- [x] External data ingestion: StatsBomb, Understat, FBRef, News (scripts 08-12)
- [x] Player matching across data sources (script 10)
- [x] Stat metrics computation (script 13)
- [x] Wikidata enrichment + external ID cross-linking (script 15)
- [ ] Connect `supabase-fbref-scraper` output as additional data source

## Phase 2 — Scouting Interface [PARTIAL — needs maintenance]
Built but prototypes are outdated against current schema. Detail pages may not render in production.

- [x] App shell — Next.js scaffold, player list with filters, detail page
- [x] Wire `player_intelligence_card` view end-to-end
- [x] `<PersonalityBadge>` + `<ArchetypeShape>` hero components
- [x] `<PlayerIdentityPanel>` composite
- [x] `<KeyMomentsList>` + `<NewsModal>`
- [x] Player list refinements — debounced search, tier filter, peak sort
- [x] QA pass — accessibility, responsive grids, input validation
- [ ] **Admin panel (`/admin`)** — NOT BUILT. Import, pipeline status, data health
- [ ] **News page (`/news`)** — NOT BUILT. Sidebar links to 404
- [ ] **Formations page** — References missing tables (`formations`, `formation_slots`)
- [ ] **Production deployment** — No vercel.json, env config may be incomplete
- [ ] Design token refinement (Inter/JetBrains Mono fonts, spacing)
- [ ] Attribute detail drill-down with progressive disclosure
- [ ] Scouting radar: statistical alert system
- [ ] Free agent grader: Transfermarkt scraper → ranked shortlists

## Phase 3 — Game Integration [DEFERRED]
Parked until data density justifies it.

- [ ] Export availability scores to Director of Football game
- [ ] Inbox event generator: scouting reports as game messages
- [ ] Chief Scout role as NPC in DoF game

## Phase 4 — News Layer [PARTIAL]
Pipeline works. UI integration exists but news page missing, alerts not built.

- [x] Create `news_stories` + `news_player_tags` tables (migration 003 + 005)
- [x] `12_news_ingest.py` — RSS fetch + Gemini Flash tagging pipeline
- [x] Player name matching against `people` table (script 10)
- [x] Scout Pad integration — News tab on player card
- [ ] `/news` page — standalone news feed view
- [ ] News-driven alerts — surface breaking stories on player list
- [ ] Director integration — transfer rumours as inbox events

## Phase 5 — Coverage Scaling [PARTIAL]
Seed script supports 50 profiles but only 23 confirmed in production DB.

- [x] Seed script written for 50 players (script 14)
- [x] Positional coverage design: GK:4, CD:6, WD:8, DM:5, CM:7, WM:2, AM:2, WF:9, CF:7
- [ ] Confirm all 50 seeded in production
- [ ] Scale beyond 50 via automated profile generation from external data
- [ ] Target: 200+ full profiles

## Phase 6 — Admin Panel & Operational Tooling [NOT STARTED]
The single biggest bottleneck. Every data operation currently requires terminal access.

- [ ] `/admin` route with tabbed UI
- [ ] Import tab — FBRef CSV upload, client-side parse, upsert to Supabase
- [ ] Pipeline tab — table row counts, sync timestamps, freshness indicators
- [ ] Health tab — coverage metrics, trigger player matching, data quality checks
- [ ] API routes: `/api/admin/fbref-import`, `/api/admin/pipeline`, `/api/admin/health`, `/api/admin/match`

---

## Connects to
- `director/` — chief scout provides player data + scouting reports to the game
- `supabase-fbref-scraper/` — data source
- `transfer_availability/` — player decision model
- News Layer — real-world stories feed availability signals + game inbox events
