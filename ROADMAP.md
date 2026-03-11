# Chief Scout — Roadmap

## What it is
A football scouting and player intelligence platform. Data pipeline ingests from 5+ external sources, normalizes into Supabase, computes derived insights (archetypes, personality, market valuations), and serves them through products for professional, consumer, and casual audiences.

## Architecture
```
chief-scout/
├── pipeline/                ← data pipeline (24 numbered scripts)
├── apps/player-editor/      ← Next.js player intelligence UI (deployed on Vercel)
├── .claude/commands/        ← Claude Code skills (18 slash commands)
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
- [x] Club ingestion from CSV (script 16)
- [x] Wikidata club enrichment — league, stadium, capacity, founded year, logo (script 17)
- [x] Wikidata player-club linking via P54 (script 18)
- [x] Deep Wikidata enrichment — citizenship, career history, position, image, Transfermarkt ID (script 19)
- [x] FBRef → attribute grades with positional percentiles (script 22)
- [x] Career trajectory metrics — loyalty/mobility scores, trajectory labels (script 23)
- [x] News sentiment aggregation — buzz/sentiment scores, trend windows (script 24)
- [ ] Connect `supabase-fbref-scraper` output as additional data source

## Phase 2 — Scouting Interface [DONE]
Full-width responsive UI with player/club/league pages, collapsible mobile sidebar.

- [x] App shell — Next.js scaffold, player list with filters, detail page
- [x] Wire `player_intelligence_card` view end-to-end
- [x] `<PersonalityBadge>` + `<ArchetypeShape>` hero components
- [x] `<PlayerIdentityPanel>` composite
- [x] `<KeyMomentsList>` + `<NewsModal>`
- [x] Player list refinements — debounced search, tier filter, peak sort
- [x] QA pass — accessibility, responsive grids, input validation
- [x] Full-width layout, collapsible mobile sidebar
- [x] Overhauled player detail page with `<PlayerStats>`
- [x] Club detail pages with squad view
- [x] League pages with top-5 tiering
- [x] Production deployment on Vercel
- [ ] **News page (`/news`)** — sidebar links to a page that doesn't exist yet
- [ ] **Formations page** — references missing tables (`formations`, `formation_slots`)
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
Pipeline works, sentiment aggregated, player tags in place. UI page still missing.

- [x] Create `news_stories` + `news_player_tags` tables (migration 003 + 005)
- [x] `12_news_ingest.py` — RSS fetch + Gemini Flash tagging pipeline
- [x] Player name matching against `people` table (script 10)
- [x] Scout Pad integration — News tab on player card
- [x] `24_news_sentiment.py` — sentiment/buzz scores, story type breakdown, trend windows
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

## Phase 6 — Admin Panel & Operational Tooling [DONE]
Browser-based pipeline management at `/admin`.

- [x] `/admin` route with tabbed UI
- [x] Import tab — FBRef CSV upload, client-side parse, upsert to Supabase
- [x] Pipeline tab — table row counts, ID link source breakdown
- [x] Health tab — north star (full profiles), coverage bars per table
- [x] Player quick-edit and search from admin
- [x] API routes: `/api/admin/fbref-import`, `/api/admin/pipeline`, `/api/admin/health`, `/api/admin/player-search`, `/api/admin/player-update`

## Phase 7 — Football Choices [DONE]
PWA-ready comparison game at `/choices`.

- [x] Question/vote game loop — pick between 2-5 players per question
- [x] 8 categories: GOAT Debates, Best in Position, Era Wars, Transfer Picks, Tactical, Clutch, Style, Hypothetical
- [x] Footballing Identity profile from vote patterns
- [x] All-Time XI squad builder with formation picker and positional candidate search
- [x] Anonymous users via localStorage UUID → `fc_users`
- [x] PWA: `manifest.json` + `sw.js` for add-to-home-screen, offline caching
- [x] Seed scripts: `20_seed_choices.py`, `21_seed_alltime_xi.py`
- [x] API routes: choices, vote, categories, user, candidates, squad
- [x] Migrations: 015 (Football Choices), 016 (All-Time XI)

## Phase 8 — Claude Code Skills [DONE]
18 slash commands for fast iteration across all domains.

- [x] Business: `/ceo`, `/marketing`, `/dof`
- [x] Football: `/scout`, `/data-analyst`
- [x] Infrastructure: `/devops`, `/pipeline`, `/supabase`, `/db-migrate`
- [x] Development: `/project-manager`, `/design-manager`, `/qa-manager`, `/debugger`
- [x] Operations: `/pr`, `/git-clean`, `/prototype-tracker`
- [x] Sprint: `/sprint-data-dashboard`

---

## What's Next
1. **Data push** — Run migrations 013-016, execute pipeline 16-24, confirm 50 profiles, scale to 200+
2. **`/news` page** — standalone news feed using existing `news_stories` + `news_sentiment_agg` data
3. **User accounts** — replace localStorage UUIDs with Supabase Auth
4. **Monetization model** — free tier (Choices, limited views) → pro tier (full scouting, admin, API)

## Connects to
- `director/` — chief scout provides player data + scouting reports to the game
- `supabase-fbref-scraper/` — data source
- `transfer_availability/` — player decision model
- News Layer — real-world stories feed availability signals + game inbox events
