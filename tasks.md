# Chief Scout — Outstanding Tasks

## High Priority

### Data Density (Strategic Priority #1)
- [x] ~~Scale to 200+ full profiles~~ — 9,227 Tier 1 (archetype+level), 6,421 full promotion criteria. Automated pipeline did it.
- [x] ~~Manual personality review~~ — automated via script 37 (multi-signal midpoint resolution, source-quality filtering). Top 50 covered.
- [x] ~~Finish AF league expansion~~ — 38 leagues ingested (34 senior + 4 youth). Remaining youth leagues deemed low-value. 17k player-season rows.
- [x] ~~Update script 22~~ — generalized to multi-source grader (FBRef + Kaggle PL + Kaggle Euro). Shared lib/grades.py. Script 66 refactored too. 3,967 grades written (2026-03-19)

### Data Freshness (Strategic Priority #2)
- [ ] **Materialized view auto-refresh** — trigger after pipeline scripts
- [ ] **Add `API_FOOTBALL_KEY` to Vercel env** — needed for automated pipeline runs

### Four-Pillar QA (from session 13)
- [ ] **Physical pillar QA** — validate 5-component formula (age-decay, availability, sprinter/powerhouse, durability, duels)
- [ ] **Editor pillar tabs** — reorganize editor into Technical/Tactical/Mental/Physical sections
- [ ] **Precompute pillar scores** — batch API or materialized column for player list spark bars
- [ ] **Valuation integration** — feed four-pillar scores into valuation engine (Phase 5)

### Product & UX
- [ ] **XP system v2** — move to real XP scale (Ballon d'Or=1000, World Cup=500, debut=10). Current small-modifier system is interim.
- [ ] **SEO advanced** — per-player OG images, structured data
- [ ] **Onboarding** — no help docs or tour for new users

## Fixture Previews — Remaining
- [ ] **Fixture-based club verification**: Build `38_fixture_club_verify.py` once fixture data populated
- [ ] **Add Vercel env var to preview** — git repo not connected, only production set

## Radar Fingerprints — Expansion
- [ ] Add MiniRadar to shortlist detail page (`/shortlists/[slug]`)
- [ ] Add MiniRadar to club detail page key players section (`/clubs/[id]`)
- [ ] Add MiniRadar to TrendingPlayers component (homepage)

## Kickoff Clash (Sibling Product)
### Kickoff Clash game (`~/Documents/kickoff-clash/`)
- [ ] **Fix love.js web build** — exception in browser, works native. Debug WebGL/canvas/data loading
- [ ] **Deck building screen** — collect cards, pick 5 for a match
- [ ] **Match/battle system** — formation slots, archetype synergy combos
- [ ] **Scoring system** — synergy multipliers (Brick Wall, Through Ball, etc.)
- [ ] **Roguelike run** — beat opponents, earn packs between rounds

### Chief Scout side (remaining)
- [ ] **Fixture data feed for Punter's Pad** — pipeline 61 fixtures → exportable format for virtual sportsbook
- [ ] **Punter's Pad scaffold** — `punters-pad` repo, fixture feed from CS pipeline 61

## Go-to-Market
- [ ] **Pricing page visual alignment** — redesigned to match landing page (2026-03-16, needs review)

## Medium Priority

### Data Quality
- [ ] **Dedup improvements** — upgrade player matching from exact name to fuzzy (Levenshtein/Jaro-Winkler) with confidence scores
- [ ] **Data quality dashboard** — per-field completeness heatmap + stale data flags in `/admin`
- [ ] **StatsBomb event extraction** — progressive carries, pressure events, shot-creating actions from `sb_events`
- [ ] Club stadium capacities — Wikidata P115 qualifier spotty, needs targeted enrichment
- [ ] ~2,600 clubs without wikidata_ids — build bulk SPARQL name matcher
- [ ] Build trait inference script — infer traits from stats for four-pillar (slot: 63+)
- [ ] Build physical metrics script — aggregate minutes into availability scores (slot: 64+)
- [ ] Add materialized view auto-refresh after pipeline scripts
- [ ] Women's players: decide long-term approach
- [ ] 3 manual profiles not found (Tchouameni, Cubarsi, Dembele) — accent mismatches
- [ ] **Fix script 04** (`refine_players.py`) — crashes on news_sentiment_agg `story_types` (string not dict)
- [ ] **Wikidata enrichment level 75-77** — 69_wikidata_quick_enrich.py done for 78+, lower tiers remain (~600 players)

### Product & Features
- [ ] **Formations seed** — populate from research data (#54)
- [ ] **Product polish** — glass consistency, archetype styling (#55)
- [ ] **Free agent grader** — ranked shortlists (#26)
- [ ] **Scouting radar** — statistical alert system (#25)
- [ ] **News-driven alerts** on player list (#23)

### Data Enrichment
- [ ] Apply migration 024 (network_roles + network_edits tables)

## Low Priority
- [ ] Player list pillar spark bars (needs precomputed scores or batch API)
- [ ] Clean up more duplicate players (accent variants)
- [ ] EA FC 25 fuzzy matching — ~6,900 unmatched players (single-name formats)
- [ ] **LLM-powered name matching** — build `pipeline/lib/llm_match.py` for transliteration/nickname/accent resolution

---

## Completed (2026-03-19, sessions 12-13)
- [x] CS Value formula recalibrated against 10 DoF anchors (Yamal 250m, Gabriel 100m, Kane 80m, etc.)
- [x] Four-pillar QA: 7 issues found, 5 fix tasks created
- [x] Four-pillar assessment rebuilt: fix scale bugs, remove level anchor, wire real data sources
- [x] Physical pillar rebuilt: 5-component data-driven formula (age-decay, availability, sprinter/powerhouse, durability, duels)
- [x] LLM Profiles button added to admin panel + context-enriched bio-only profiling
- [x] UEFA/FIFA coefficient system: pipeline 70, migration 037, league-strength grade scaling
- [x] API-Football expanded to 43 leagues (25 ingested), coefficient-scaled grades
- [x] News cron moved to GitHub Actions (6x/day), Vercel crons reduced to 1
- [x] Dual skill sets restored: two-model archetypes from data, personality-informed blueprints
- [x] MODEL_LABELS: human-readable names aligned with Real Players Active.csv taxonomy
- [x] Position-aware affinity tiebreaker for skill set scoring
- [x] Role scoring improved: source quality discounting, batch pipeline ops
- [x] Kickoff Clash: migration 035, 324 players KC-flagged, pipeline 80, KCCard component, /kc-preview
- [x] Kickoff Clash: Love2D prototype, itch.io setup (neutralworking.itch.io/kickoff-clash)
- [x] Players page overhaul: flags, league filter, CS value editing, text size
- [x] League coverage expanded across stats/fixtures/leagues, clubs sort + player page retention fixed
- [x] AF ingest fix: reconnect before write + chunked inserts for large leagues
- [x] Radar: contrast stretch, proxy attributes, scale bug fix, rate-stat quality filter
- [x] Sidebar category grouping, Legends mobile nav + editable cards
- [x] Inventor role retired → Inverted Winger (201 DB rows)
- [x] Comparison tool live at /compare (radar overlay, four-pillar bars, roles, personality, market)
- [x] `peak` added to player_intelligence_card view, 4,554 active peaks re-estimated

## Completed (2026-03-18, sessions 9-11)
- [x] Pipeline renumbering (37 files, clean ranges 01-79)
- [x] Pipeline infrastructure complete: orchestrator, incremental, validation, parallel, shared models
- [x] API-Football pipeline: migration 034, scripts 65-69, 4,906 rows, 36,799 grades, 4,666 matched
- [x] Role score calibration: 9 targets validated, aliases, level floors, GK remap
- [x] Kaggle data pipeline: 5 datasets, migration 033, 4 ingested
- [x] Players page: FBRef stats, age+flags, accent-insensitive search, EditableCell (serialized flush + sendBeacon)
- [x] Dashboard overhaul: intelligence widgets (fixtures, contracts, rising stars, market movers, key moments)
- [x] Scout Pad v2: bulk level/role editor table with infinite scroll
- [x] Club assignment overhaul: script 29, AF→TM→WD priority, 1,100+ clubs fixed
- [x] Full enrichment chain: grades, ratings, fingerprints, levels, personalities, blueprints, tags
- [x] Gaffer date_of_birth→dob fix, level thresholds raised

## Completed (2026-03-16-17, sessions 4-6)
- [x] Production deployment: chief-scout-prod.vercel.app, prod Supabase, 276 Tier 1 promoted
- [x] XP system: migration 031, pipeline 44, valuation engine, tiered trophies
- [x] EA FC 25 reimport: 189k grades from Kaggle, 9,190 players matched
- [x] FBRef CSV import: paste-to-CSV + EPL/La Liga/Bundesliga 2025-26
- [x] Personality rename: Blade→Mamba, Warrior→Catalyst, Genius→Spark
- [x] Role score inflation fix, coverage penalty
- [x] Landing page, SEO basics, analytics (Plausible)
- [x] Editor redesign: scout-first layout, compound archetype selector
- [x] Overall rating transition: coverage-scaled formula, calibration pipeline

## Completed (2026-03-14-15, sessions 1-3)
- [x] Four-pillar assessment system (lib + API + UI + SACROSANCT)
- [x] Personality reassessment: rules (765) + LLM (top 50)
- [x] Club dedup: 28 merged, 204 enriched, Arsenal wikidata fixed
- [x] MiniRadar fingerprint on PlayerCard and free agents
- [x] DoF assessment system: migration, API, editor UI, pipeline 42-43
- [x] All pending migrations applied (023-035)
- [x] Role score on player detail + PlayerCard
- [x] CS Value formula inflation fixed
