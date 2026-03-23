# Chief Scout — Outstanding Tasks

## Continue Today (from yesterday's session)
- [ ] **Wave 1 UI polish** — merged to main (64e21ec), but likely needs QA pass on dashboard, player list, player detail
- [ ] **Kickoff Clash v4** — game loop wired, shop/match/pack phases built. Needs: migration 036, DB wiring, testing
- [ ] **Legends polish** — trait pills, similar players, editable archetypes all shipped. Review quality of legend-to-active scoring

## High Priority

### Product & UX
- [ ] **Onboarding** — no help docs or tour for new users
- [ ] **Product polish** — glass consistency, archetype styling

### Data & Pipeline
- [ ] **Materialized view auto-refresh** — trigger after pipeline scripts
- [ ] **Add `API_FOOTBALL_KEY` to Vercel env** — needed for automated pipeline runs
- [ ] **Valuation integration** — feed four-pillar scores into valuation engine (Phase 5)
- [ ] **Fix script 04** (`refine_players.py`) — crashes on news_sentiment_agg `story_types` (string not dict)

### Monetization
- [ ] **Stripe integration QA** — billing tier system added (416e23a), needs end-to-end testing
- [ ] **Shortlist Stripe gate** — enforce Scout/Pro tier for shortlist creation (currently open)

## Kickoff Clash (Sibling Product — `apps/kickoff-clash/`)
- [x] ~~Felt table theme + design tokens~~
- [x] ~~Hand evaluation engine: roll, discard, evaluate~~
- [x] ~~Joker system: 8 manager cards~~
- [x] ~~GameShell: full game loop~~
- [x] ~~Supporting screens: title, setup, postmatch, shop, end~~
- [x] ~~v4: pack opening, match phase, shop phase, formations, tactics~~
- [x] ~~500 fake characters from Airtable + LLM bios~~
- [ ] **Apply migration 036** — 7 KC tables not yet in Supabase
- [ ] **Wire DB cards** — replace hardcoded SAMPLE_CARDS with kc_cards fetch
- [ ] **Run persistence** — currently all client-side state, lost on refresh
- [ ] **Rarity bracket rebalance** — 70% Epic at min-level 50, needs wider bands
- [ ] **Game engine tests** — 5,600+ lines untested

### Punter's Pad (future)
- [ ] **Fixture data feed** — pipeline 61 fixtures → exportable format
- [ ] **Punter's Pad scaffold** — `punters-pad` repo

## User Shortlists — Remaining
- [x] ~~CRUD API + AddToShortlist UI + owner controls~~
- [ ] **Unlisted sharing polish** — frontend verification needed
- [ ] **Reorder players** — drag-to-reorder within shortlist detail
- [ ] **Per-player scout notes** — inline edit on shortlist detail (owner only)

## Fixture Previews
- [ ] **Fixture-based club verification** — build `38_fixture_club_verify.py`
- [ ] **Add Vercel env var to preview** — git repo not connected

## Medium Priority

### Data Quality
- [ ] **Dedup improvements** — fuzzy matching (Levenshtein/Jaro-Winkler) with confidence scores
- [ ] **Data quality dashboard** — per-field completeness heatmap in `/admin`
- [ ] **StatsBomb event extraction** — progressive carries, pressure events from `sb_events`
- [ ] ~2,600 clubs without wikidata_ids — bulk SPARQL matcher
- [ ] **Wikidata enrichment level 75-77** — ~600 players remain
- [ ] Women's players: decide long-term approach

### Product & Features
- [ ] **Formations seed** — populate from research data
- [ ] **Free agent grader** — ranked shortlists
- [ ] **Scouting radar** — statistical alert system
- [ ] **News-driven alerts** on player list

### Data Enrichment
- [ ] Apply migration 024 (network_roles + network_edits tables)

## Low Priority
- [ ] Clean up more duplicate players (accent variants)
- [ ] EA FC 25 fuzzy matching — ~6,900 unmatched
- [ ] **LLM-powered name matching** — `pipeline/lib/llm_match.py`

## Branch Cleanup
20 unmerged remote branches — see `BRANCHES.md`. Most are stale or cherry-picked.

---

## Completed (2026-03-22-23, sessions 19-21)

### Wave 1 UI Redesign
- [x] Design tokens: pit bg, panel borders, sharp edges (9ef9c52)
- [x] Topbar, SectionHeader, GradeBadge components (2ed28f5)
- [x] PlayerCard redesign: sharp edges, model label, four-pillar color scheme (31fa344, 1db9dd9)
- [x] Compact PlayerCard: 3-row layout with flags, inline pillars (b6ca559)
- [x] Dashboard redesign: news-first, FeaturedPlayer 2-col layout (6350255)
- [x] Player List: sticky search, remove Tier 1/pursuit, panel styling (2dabd8f)
- [x] Player Detail: best roles panel, sharp panels (9f887d8)
- [x] 5-tab mobile nav + bottom tab bar (5753a72, 9371dcd)
- [x] Sharp edge sweep: remove all rounded corners (627d286)
- [x] Wave 1 merged to main (64e21ec)

### Kickoff Clash v3→v4
- [x] Felt table theme + design tokens (821b42c)
- [x] Hand evaluation engine + joker system (64fe92f, ca9934f)
- [x] PlayerCard, HandPhase, ScoreReveal, GameShell (ac5da41→dfe4f30)
- [x] 500 fake characters from Airtable + LLM bios + procedural avatars (0c6fc56)
- [x] KC launch: card detail, title screen, persistence (e4ff3f2)
- [x] v4: pack opening, tactic cards (12), formations (6) (d32df8a, d3e922d, 8f51c9b)
- [x] v4: MatchPhase (11-card XI, subs, tactics), ShopPhase, GameShell v4 (1bca3fe→8e80ae3)
- [x] /kickoff-clash route on Chief Scout Vercel (1ae94bf)

### Legends System
- [x] Legend skillsets: seed 195 legends, "Plays Like" comparison (c9d13a1)
- [x] Editable Primary/Secondary, MODEL_LABELS TS port (8184fa3, ea76755)
- [x] 12 editorial playing style traits + trait API + pipeline 04d (06893e5→306650d)
- [x] Trait pills with admin editing, source dedup (715bca7, fe0e7d9)
- [x] Legend-aware similar player scoring + quality floor (3f17a11, 3a7cfc2, f131f19)

### New Features
- [x] On The Plane: World Cup squad picker game + migration 042 (d38f8d2, c2b4ce9)
- [x] Freemium strategy: PlayerTeaser, UpgradeCTA, tier system (8154bf1)
- [x] Billing tier system: migration, Stripe wiring, tier gating (416e23a)
- [x] Precomputed four-pillar scores: cron endpoint + daily automation (b9b94d2)
- [x] Per-player SEO: dynamic OG images, meta tags, JSON-LD (0e7143c)
- [x] Tactics screen: 10 tactical philosophies + role browser (e688c10)
- [x] Role icons: greatest player per tactical role (8700c0b)
- [x] Blueprint computation module extracted (68a19de)
- [x] Design system + Stitch prototyping setup (a81eb8c)
- [x] v2 mockups: 16 screens + clubs/leagues/formations/gaffer mockups (f10fd00, 49c9f86)
- [x] Tactical Command UI mockups (ddbc4ee)

### Fixes
- [x] PlayerRadar role mismatch: prefer stored best_role (25ebcda)
- [x] Deduplicate tactical roles (a61029a)
- [x] Data sweep: GK roles, fbref fix, side inference, similar players rewrite (7869183)
- [x] QA: durability weights, secondary archetypes, z-index, mobile overlap (d1f00d3)
- [x] England crash: paginate people query (9e04b6b)
- [x] React #310: memoized sort mutation (11bca4a)
- [x] Free agents: shared compact PlayerCard (781925e)
- [x] Mobile nav + featured player fixes (1817002)

## Completed (2026-03-20, sessions 14-18)

### Features & UI
- [x] User shortlists: CRUD API, AddToShortlist UI, owner controls, visibility (289d2a3)
- [x] Scout Insights → /network: hidden gems, triage, InsightCard redesign (e28bcb5, 9ee9b82)
- [x] Career XP v2 "The Footballer's Odyssey": 159 milestones, legacy score, BG3 levels (ebd8ddc)
- [x] Club power ratings: 4-pillar composite (0-100), pipeline 68, migration 039 (45ff917)
- [x] Club strengths/weaknesses auto-report (cc5cf72)
- [x] Comparison tool at /compare (radar overlay, pillars, roles, personality, market)
- [x] Age group filters U16-U23 on /players (3345735)
- [x] Admin consolidated 5 tabs + Levels/Club Analysis buttons (9a7df27, 4632dfc)
- [x] Editor pillar tabs: Technical/Tactical/Mental/Physical (a8b37b7)
- [x] Free Agents → Free Agency rename (7237292)
- [x] Gaffer mobile cards + stat quiz (6f0ba92)
- [x] Pursuit status removed from all UI, sidebar Gems→Network (1d88e4d)
- [x] Featured player pool: DOF + 500 Tier 1, 3x rotation (339c368)

### Pipeline & Data
- [x] Pipeline 86: algorithmic best_role from AF stats (5927531)
- [x] Earned archetype system + Inventor→Creative Winger (ec80b30, 68c06fe)
- [x] Personality review optimized: source-quality filter, batch writes (a8b37b7)

### QA & Fixes
- [x] Test suite: 370 tests (Python + TS) (bd73d48)
- [x] Four-pillar QA: all 5 issues fixed (c9e35b2)
- [x] Radar fingerprints: proxies, role mapping, pool sizing (7f097db)
- [x] Squad roles fix (efc1033)
- [x] KC cards: full bio, normalized ratings, deduped attrs, durability (2ede946, bd73d48)

## Completed (2026-03-19, sessions 12-13)
- [x] CS Value recalibrated against 10 DoF anchors
- [x] Four-pillar rebuilt: real data, physical 5-component formula
- [x] UEFA/FIFA coefficient system (pipeline 70, migration 037)
- [x] API-Football expanded to 43 leagues, coefficient-scaled grades
- [x] News cron → GitHub Actions 6x/day
- [x] Dual skill sets + MODEL_LABELS taxonomy
- [x] LLM profiling (context-enriched bio mode)
- [x] Kickoff Clash: KC flagging, pipeline 80, KCCard, Love2D, itch.io
- [x] /players overhaul, /compare, radar fixes, sidebar regroup
- [x] Inventor → Inverted Winger (201 DB rows)

## Completed (2026-03-18, sessions 9-11)
- [x] Pipeline renumbering + infrastructure (orchestrator, incremental, validation)
- [x] API-Football pipeline: migration 034, scripts 65-69, 36,799 grades
- [x] Kaggle data pipeline: 5 datasets, migration 033
- [x] Dashboard overhaul, Scout Pad v2, club assignment overhaul
- [x] Full enrichment chain: grades→ratings→fingerprints→levels→personalities→blueprints→tags

## Completed (2026-03-16-17, sessions 4-8)
- [x] Production deployment: chief-scout-prod.vercel.app, prod Supabase
- [x] XP system, EA FC 25 reimport (189k grades), FBRef CSV import
- [x] Landing page, SEO basics, analytics (Plausible)
- [x] Editor redesign, overall rating transition, role score inflation fix

## Completed (2026-03-14-15, sessions 1-3)
- [x] Four-pillar assessment system (lib + API + UI + SACROSANCT)
- [x] Personality reassessment, club dedup, MiniRadar, DoF assessment
- [x] All pending migrations applied (023-035)
