# Chief Scout — Roadmap

## What it is
A football scouting and player intelligence platform. Data pipeline ingests from 5+ external sources, normalizes into Supabase, computes derived insights (archetypes, personality, market valuations, ratings), and serves them through products for professional, consumer, and casual audiences.

## Architecture
```
chief-scout/
├── pipeline/                ← data pipeline (27 numbered scripts)
├── apps/web/      ← Next.js player intelligence UI
├── imports/                 ← CSV data (Real Players Active, clubs)
├── transfer_availability/   ← submodule: player archetype + transfer model
├── docs/
│   ├── research/rsg.db/     ← Obsidian research vault (reference data)
│   ├── systems/             ← SACROSANCT.md (classification taxonomy)
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
Current: **~50 seeded full profiles, 941 with computed ratings, 4,464 with level data, 19,341 total players.**

---

## Phase 1 — Data Pipeline [DONE]
All 27 pipeline scripts operational. 5+ external data sources ingested and cross-linked.

- [x] Parse research vault + Real Players CSV into merged player dataset
- [x] Push to Supabase (players + formations)
- [x] Enrich nation/position from people table + attributes
- [x] Compute archetypes, MVT, scarcity scores
- [x] External data ingestion: StatsBomb, Understat, FBRef, News (scripts 08-12)
- [x] Player matching across data sources (script 10)
- [x] Stat metrics computation (script 13)
- [x] Seed 50 full profiles (script 14)
- [x] Wikidata enrichment: identity, career history, clubs, deep enrich (scripts 15-19)
- [x] Club ingestion + Wikidata enrichment (scripts 16-17)
- [x] FBRef → attribute grades pipeline (script 22)
- [x] Career metrics: loyalty, mobility, trajectory (script 23)
- [x] News sentiment aggregation (script 24)
- [x] Key moments from career + news (script 26)
- [x] Composite player ratings: model scores → compound → overall (script 27)
- [ ] Connect `supabase-fbref-scraper` output as additional data source

## Phase 2 — Scouting Interface [FUNCTIONAL]
Core UI built and working. Needs design polish pass.

- [x] App shell — Next.js scaffold, player list with filters, detail page
- [x] `player_intelligence_card` view wired end-to-end
- [x] `<PersonalityBadge>` + themed personality cards
- [x] Player detail: radar, career timeline, key moments, FBRef stats, personality
- [x] Dashboard: featured player, news feed with tags, trending, browse by position/personality
- [x] Position/role radar with 13 playing models + role fit scoring
- [x] Server-side pagination for players (was loading all 19k)
- [x] `/clubs` + `/leagues` pages with paginated data
- [x] `/news` page with Tailwind + glass design system
- [x] Football Choices game — PWA with category voting + identity building
- [x] Admin panel (`/admin`) — Import, Pipeline status, Data health tabs
- [ ] **Formations page** — tables exist but empty, need seed from research (#54)
- [ ] **Product polish** — glass styling consistency, archetype differentiation (#55)
- [ ] **Comparison tool** — side-by-side player radar + stats
- [x] Staging/production environment separation — env detection, route filtering, sidebar gating
- [ ] Production deployment to Vercel — create prod project, set env vars, first promotion (#32)
- [ ] Scouting radar: statistical alert system (#25)
- [ ] Free agent grader: ranked shortlists (#26)

## Phase 3 — Game Integration [DEFERRED]
Parked until data density justifies it.

- [ ] Export availability scores to Director of Football game
- [ ] Inbox event generator: scouting reports as game messages
- [ ] Chief Scout role as NPC in DoF game
- [ ] Transfer rumours as Director inbox events (#24)

## Phase 4 — News Layer [FUNCTIONAL — needs automation]
Pipeline works, UI integrated. Missing automated refresh.

- [x] `news_stories` + `news_player_tags` tables (migration 003 + 005)
- [x] `12_news_ingest.py` — RSS fetch + Gemini Flash tagging
- [x] Player name matching against `people` table
- [x] Dashboard news feed with player tags + sentiment dots
- [x] `/news` standalone page with filters + glass design
- [x] Scout Pad integration — news tab on player detail
- [x] Key moments derived from news stories (script 26)
- [x] News sentiment aggregation per player (script 24)
- [ ] **News cron** — automated refresh every 2-4h (#53)
- [ ] News-driven alerts on player list (#23)

## Phase 5 — Coverage Scaling [IN PROGRESS]
Pipeline supports automated profile generation. Manual data work ongoing.

- [x] Seed script for 50 players (script 14)
- [x] FBRef grades → attribute_grades for all matched players (script 22)
- [x] Composite ratings for 941 players with differentiated data (script 27)
- [ ] Scale full profiles via automated generation from external data
- [ ] Target: 200+ full profiles by end of March

## Phase 6 — Admin Panel & Operational Tooling [DONE]
- [x] `/admin` route with tabbed UI
- [x] Import tab — FBRef CSV upload, parse, upsert
- [x] Pipeline tab — table row counts, sync timestamps, freshness
- [x] Health tab — coverage metrics, trigger player matching
- [x] API routes: fbref-import, pipeline, health, match

---

## Current Sprint
1. News cron — automated pipeline refresh (#53)
2. Formations seed — populate from research data (#54)
3. Product polish — glass consistency, archetype styling (#55)

## Connects to
- `director/` — chief scout provides player data + scouting reports to the game
- `supabase-fbref-scraper/` — data source
- `transfer_availability/` — player decision model
- News Layer — real-world stories feed availability signals + game inbox events
