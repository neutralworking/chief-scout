# Chief Scout — Roadmap

## What it is
A football scouting and player intelligence platform. Data pipeline ingests from 5+ external sources, normalizes into Supabase, computes derived insights (archetypes, personality, market valuations, ratings), and serves them through products for professional, consumer, and casual audiences.

## Architecture
```
chief-scout/
├── pipeline/                ← data pipeline (27 numbered scripts)
├── apps/web/      ← Next.js player intelligence UI
├── imports/                 ← CSV data (Real Players Active, clubs)
├── (transfer_availability removed — separate project)
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
Current: **276 Tier 1 in prod, 12,769 with ratings, 10,568 with levels, 21,683 total players, 110k+ attribute grades.**

---

## Phase 1 — Data Pipeline [DONE]
79 pipeline scripts operational. 7+ external data sources ingested and cross-linked (StatsBomb, Understat, FBRef, API-Football, Kaggle, EAFC, Wikidata, Transfermarkt).

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
- [ ] ~~Connect `supabase-fbref-scraper`~~ — DEAD. Replace with multi-source: API-Football + Fotmob

## Phase 2 — Scouting Interface [LIVE]
Core product deployed to production. Wave 1 UI redesign shipped.

- [x] App shell, player list with filters, detail page, dashboard
- [x] Four-pillar assessment (Technical/Tactical/Mental/Physical) + radar fingerprints
- [x] Earned archetype system: 29 archetypes, 8,181 classified
- [x] `/compare` — side-by-side player comparison with radar overlay
- [x] `/free-agents` — position-grouped with contract intelligence
- [x] `/legends` — retired players with editable skillsets + "Plays Like" comparisons
- [x] `/clubs` + `/leagues` with squad depth + power ratings
- [x] Admin panel, editor, scout pad, news pipeline
- [x] Staging/production separation + 276 Tier 1 promoted
- [x] Mobile bottom nav (5 tabs), mobile-first editing
- [x] Wave 1 UI: dashboard, players, detail pages redesigned
- [ ] **Wave 2 UI** — clubs, leagues, free agents, news (mockups exist)
- [ ] **Wave 3 UI** — compare, formations, squad builder, gaffer
- [ ] Scouting radar: statistical alert system
- [ ] Free agent grader: ranked shortlists

## Phase 3 — Games & Engagement [LIVE]
Three games shipping, two more planned.

- [x] **Gaffer** (`/choices`) — manager decision game, PWA, identity profiling
- [x] **Kickoff Clash** (`/kickoff-clash`) — roguelike card battler, 500 characters, fully client-side
- [x] **On The Plane** (`/on-the-plane`) — WC 2026 squad picker, 48 nations (ideal squad scoring pending)
- [ ] **Punter's Pad** — virtual sportsbook (planned, separate repo)
- [ ] KC pack opening animation, manager cards, meta-progression

## Phase 4 — News Layer [LIVE]
Automated 6x/day via GitHub Actions.

- [x] News pipeline: RSS + Gemini Flash tagging, sentiment aggregation
- [x] Dashboard news feed, `/news` page, player detail integration
- [x] News cron: GitHub Actions 6x/day (moved from Vercel Hobby 1/day limit)
- [ ] News-driven alerts on player list

## Phase 5 — Coverage Scaling [ONGOING]
110k+ grades, 12,769 ratings, 8,181 archetypes classified.

- [x] API-Football: 43 leagues, 110k grades, coefficient-scaled
- [x] EA FC 25: 9,190 players, 189k grades
- [x] Kaggle: 5 datasets integrated
- [x] Valuation v1.1-pillars: 16,813 players valued
- [ ] Scale to 500+ Tier 1 profiles
- [ ] FBRef advanced stats re-import

---

## Current Sprint
1. OTP ideal squad pipeline — populate `otp_ideal_squads` for submit/reveal flow
2. Wave 2 UI — clubs, leagues, free agents, news pages
3. KC theme sync — standalone felt/amber theme → web route

## Connects to
- `director/` — chief scout provides player data + scouting reports to the game
- ~~`supabase-fbref-scraper/`~~ — DEAD. Replaced by API-Football + Fotmob multi-source strategy
- ~~`transfer_availability/`~~ — removed (separate project, no shared code)
- News Layer — real-world stories feed availability signals + game inbox events
