# Chief Scout — Outstanding Tasks

## High Priority

### Data Freshness
- [x] ~~Materialized view auto-refresh~~ — removed; `player_intelligence_card` is a regular VIEW, no refresh needed
- [x] ~~Add `API_FOOTBALL_KEY` to Vercel env~~ — already present in .env.local, confirmed in Vercel by user

### Four-Pillar & Scoring
- [x] ~~Precompute pillar scores~~ — cron endpoint + GitHub Actions daily. 15k scored. View update SQL in `pipeline/sql/039_pillar_scores.sql`
- [x] ~~Valuation integration~~ — pillar scores feed into effective score (45/25/30 blend) + ability domain scoring (30% pillar blend). Model v1.1-pillars.
- [x] ~~Valuation GK model fix~~ — min 2 attrs per model in `valuation_core/data_loader.py`. 12,632 revalued. Kane €123m→€81m.
- [x] ~~Re-run valuation with --force~~ — 16,813 players revalued with pillar-integrated formula. Chunking fix (500/batch) solved connection drops.

### Product & UX
- [x] ~~Mobile nav: 5-tab layout~~ — Home/Players/Clubs/Compare/More (was 4 tabs)
- [ ] **Mobile nav: More sheet polish** — test swipe-to-dismiss, add haptic feedback consideration
- [x] ~~SEO advanced~~ — OG images, generateMetadata, JSON-LD. Need NEXT_PUBLIC_SITE_URL in Vercel.
- [ ] **Onboarding** — no help docs or tour for new users
- [x] ~~Fix script 04~~ — `story_types` string guard already in place (lines 376-382), verified 2026-03-20
- [x] ~~Showman→Catalyst test fix~~ — already updated, 33/33 passing (verified 2026-03-20)

## Medium Priority

### Data Quality
- [x] ~~Attribute grade backfill~~ — pipelines 66 (API-Football), 56 (EAFC), 30 (Understat) rerun. Top 250 avg grades 16→28.8. GKs in top 250 dropped 138→85.
- [ ] **FBRef re-import with advanced stats** — current CSV only has goals/assists. Need shooting/passing/defense HTML tables for meaningful grades
- [ ] **Compound score calibration** — Technical/Tactical avg 55-57/100, may need rescaling (low priority since role score is primary)
- [x] ~~Position audit (level 80+)~~ — 18 fixes applied (Worrall→CD, Alisson→GK, Militao→CD, Griezmann→CF, etc.). 6 got secondary positions. Ratings recomputed.
- [ ] **Scouting notes gap** — 46 of top 250 missing. Run LLM profiling (pipeline 72) targeted at top 250
- [ ] **Dedup improvements** — upgrade player matching from exact name to fuzzy (Levenshtein/Jaro-Winkler) with confidence scores
- [ ] **Data quality dashboard** — per-field completeness heatmap + stale data flags in `/admin`
- [ ] **StatsBomb event extraction** — progressive carries, pressure events, shot-creating actions from `sb_events`
- [ ] Club stadium capacities — Wikidata P115 qualifier spotty, needs targeted enrichment
- [ ] ~2,600 clubs without wikidata_ids — build bulk SPARQL name matcher
- [ ] Women's players: decide long-term approach (separate pipeline? same tables?)
- [ ] 3 manual profiles not found (Tchouameni, Cubarsi, Dembele) — accent mismatches
- [ ] **Wikidata enrichment level 75-77** — 69_wikidata_quick_enrich.py done for 78+, lower tiers remain (~600 players)

### Product & Features
- [ ] **TM value sparkline** — mini chart on player detail page showing transfermarkt value history over time
- [ ] Add MiniRadar to shortlist detail page (`/shortlists/[slug]`)
- [ ] Add MiniRadar to club detail page key players section (`/clubs/[id]`)
- [ ] Add MiniRadar to TrendingPlayers component (homepage)
- [ ] **Formations seed** — populate from research data
- [x] ~~Archetype styling~~ — 15 UI files updated, centralized `lib/archetype-styles.ts`, category-based colors. Build passes.
- [x] ~~Legends page polish~~ — trait pills 8→9/10px, merged Skillset column, mobile "Plays like:" labels
- [ ] **Wave 2 UI** — clubs, leagues, free agents, news pages (mockups in `.stitch/designs/`)
- [ ] **Wave 3 UI** — compare, formations, squad builder, gaffer (mockups in `.stitch/designs/`)
- [ ] **Product polish** — glass consistency
- [ ] **Recent Transfers feature** — schema, pipeline, API, frontend (see `docs/plans/recent-transfers.md`). Branch preserved: `claude/transfers-supabase-feature-mmBSP`
- [ ] **Tactical philosophies** — seed pipeline 83, club assignments, philosophy detail page (see `docs/plans/tactical-philosophies.md`)
- [ ] **Archetype threshold tuning** — Pulse (1,037) and Outlet (1,041) still heavy; aspiring tier at 15% (was 7%)
- [ ] **Free agent grader** — ranked shortlists
- [ ] **Scouting radar** — statistical alert system
- [ ] **News-driven alerts** on player list
- [x] ~~Playing style traits taxonomy~~ — 16 traits, pipeline 04d seeds 65 legends, trait pills on legends page with admin editing

### Infrastructure
- [x] ~~Valuation engine (40) timeout in orchestrator~~ — chunking added (500/batch with delete-before-insert). 16,813 players processed without drops.
- [x] ~~StatsBomb grades (31)~~ — scoped to tournaments (Euro/Copa/WC), 5,742 grades for 522 players
- [ ] **Migrate remaining understat scripts** — scripts 13, 22, 44, 10 still reference `understat_player_match_stats` (only 2022+ data remains)

## Low Priority
- [ ] Player list pillar spark bars (needs precomputed scores or batch API)
- [ ] Clean up more duplicate players (accent variants)
- [ ] EA FC 25 fuzzy matching — ~6,900 unmatched players (single-name formats)
- [ ] **LLM-powered name matching** — build `pipeline/lib/llm_match.py` for transliteration/nickname/accent resolution
- [ ] **Pricing page visual alignment** — redesigned to match landing page (needs review)

## Kickoff Clash (Sibling Product)
### Kickoff Clash — hosted at `/kickoff-clash`
- [x] ~~Data bridge~~ — 500 characters from kc_characters.json, transform.ts maps to Card[]
- [x] ~~Card detail popup~~ — bio, quirk, tags, strengths/weaknesses via InspectCardContext
- [x] ~~Title screen + persistence~~ — Continue Run / New Run, localStorage auto-save, run history
- [x] ~~Hosted on Chief Scout Vercel~~ — `/kickoff-clash` route with scoped layout + CSS vars
- [x] ~~QA fixes~~ — durability weights, secondary archetypes, z-index, mobile overlap, empty quirk
- [ ] **KC v2 polish** — pack opening animation, manager cards, meta-progression, more formations
- [ ] **KC standalone theme** — felt green/amber/leather redesign (done on standalone app, not web route)

### Punter's Pad (Planned)
- [ ] **Fixture data feed** — pipeline 61 fixtures → exportable format for virtual sportsbook
- [ ] **Punter's Pad scaffold** — `punters-pad` repo, fixture feed from CS pipeline 61

---

## On The Plane
- [x] ~~Migration 042~~ — wc_nations, otp_ideal_squads, otp_entries, otp_nation_stats tables
- [x] ~~Seed 48 WC nations~~ — pipeline 83_seed_wc_nations.py
- [x] ~~Fix 0-player count~~ — Supabase 1000-row limit, switched to exact count queries
- [x] ~~Fix player loading~~ — switched from `players` view to `player_intelligence_card`
- [x] ~~Paginate England~~ — 1473 players, .range() pagination
- [x] ~~React #310 fix~~ — spread before .sort() on useMemo array
- [x] ~~Squad picker redesign~~ — split layout: pitch + additions + player list
- [x] ~~Ideal squad computation~~ — cron endpoint `/api/cron/otp-squads` computes all 48 nations. 41 computed, 7 skipped (thin pools)
- [ ] **Remove error boundary** — temporary debug wrapper, remove once stable
- [ ] **Submit flow** — depends on ideal squad for comparison scoring

## Completed (2026-03-25, session 22 — KC launch + OTP)
- [x] Kickoff Clash launched: 500 characters, data bridge, card detail, title screen, persistence
- [x] KC hosted at /kickoff-clash on Chief Scout Vercel (no separate project needed)
- [x] KC QA: durability weights, secondary archetypes, z-index, mobile overlap fixes
- [x] On The Plane: migration 042, 48 nations seeded, API routes, squad picker UI
- [x] OTP bugs: 0-player count, broken players view, pagination, React #310 frozen memo
- [x] Nav links updated: sidebar, mobile bottom nav, mobile top nav, dashboard CTAs
- [x] Build fix: SectionHeader + GradeBadge stub components (missing from feat/wave1-ui merge)
- [x] CSS fix: kickoff-clash --bg-base → --color-bg-base (invisible content on mobile)

## Completed (2026-03-22, session 19b — legends traits)
- [x] Legends page overhaul: editable Primary/Secondary, auto-derived Model label, Similar active player column
- [x] MODEL_LABELS (130 compounds) ported to TypeScript
- [x] Legend-aware similar player scoring: skillset-first + adjacent positions + quality floor (peak-9)
- [x] Playing style traits: 16 editorial traits, pipeline 04d seeds 152 traits for 65 legends
- [x] Trait pills UI: colored by category, admin add/remove dropdown
- [x] trait-update API endpoint with ALLOWED_TRAITS validation

## Completed (2026-03-22, session 20)
- [x] Valuation pillar integration — overall_pillar_score as 3rd signal (45% role / 25% pillar / 30% level), individual pillars blend into ability domains
- [x] Full revaluation — 16,813 players valued with v1.1-pillars model
- [x] Valuation engine chunking — 500/batch with delete-before-insert, fixes Supabase connection drops at >10k
- [x] Position audit — 18 corrections (level 80+), cross-referenced FBRef+Kaggle, secondary positions for versatile players
- [x] Pipeline 27 --player bug fix — stale clearing now skipped on single-player/limited runs
- [x] Full ratings recompute — 13,235 ratings restored after --player bug

## Completed (2026-03-22, session 19)
- [x] Legends page overhaul: editable Primary/Secondary, auto-derived Model label, Similar active player column
- [x] Removed Last Club + Score columns from legends
- [x] MODEL_LABELS (130 compound labels) ported to TypeScript (`apps/web/src/lib/models.ts`)
- [x] Legend-aware similar player scoring: skillset-first path, adjacent position search
- [x] Quality floor for legend similar players: `level >= peak - 9` (min 80)
- [x] Playing style traits scoped but deferred — needs taxonomy from /categorist + /dof

## Completed (2026-03-21, session 18)
- [x] FeaturedPlayer card fix: earned_archetype display, position-specific radar axes, stored best_role preference
- [x] Legend skillsets: 195 legends seeded with curated Primary-Secondary, tactical roles, playing styles (pipeline 04c)
- [x] 3 duplicate legends merged (Sivori, Kocsis, Savicevic)
- [x] "Plays Like" legend comparison: similar-players API + SimilarPlayers component
- [x] Legends page "Archetype" column renamed to "Skillset"
- [x] Airtable skillset pipeline built (04b) — tested but rejected (grade scale too coarse)

## Completed (2026-03-21, session 16 continued)
- [x] Grade backfill — pipelines 66, 56, 30 rerun. Top 250 avg grades 16→28.8
- [x] Pipeline 27 rerun with fresh grades — 13,216 ratings recomputed
- [x] Similar players algorithm rewrite — 8 factors (role, RS, archetype, pillars, personality, side, foot, club)
- [x] Player side inference — pipeline 38c, EAFC positions (5,628) + foot fallback (828) + central default (8,182)
- [x] Side added to player_intelligence_card view
- [x] Side displayed on player detail, compare, free agents, club detail pages
- [x] Level calibration pipeline (38b) — built but parked (level being phased out, role score is primary)
- [x] Level review exported to Airtable (2,590 players in Fake Players base)
- [x] Airtable credentials added to .env.local
- [x] Supabase space reclaimed: 528→293 MB (understat pre-2022 purge + player_xp drop)
- [x] understat_player_agg table created (9,595 players, preserves lifetime stats)
- [x] Pipeline 30 updated to use agg table instead of match-level data

## Completed (2026-03-20, session 16)
- [x] DoF data quality sweep on top 250 players
- [x] GK best_role fix — base model fallback, 830/830 GKs now have roles
- [x] FBRef priority demotion (3→0) — was poisoning through_balls/creativity/vision for 325 players
- [x] Pipeline 27 rerun — 12,769 ratings + 49,710 compound scores recomputed
- [x] 9 new tests for GK fallback + fbref priority (52 total passing)

## Completed (2026-03-20, session 15)
- [x] Mobile bottom nav: top pill strip → bottom tab bar (Home/Players/Admin/More) + grouped sheet
- [x] Mobile bottom nav QA: 13 vitest tests, all passing
- [x] StatusBar hidden on mobile (was overlapping bottom nav)

## Completed (2026-03-19-20, sessions 13-14)
- [x] Earned archetype system: 45 archetypes, stat+personality gated, pipeline 37
- [x] Role renames: Shadow Striker→Second Striker, Carrier added, Tornante/Fluidificante dropped
- [x] Editor pillar tabs: Technical/Tactical/Mental/Physical reorganization
- [x] Four-pillar QA pass: all 5 issues fixed (commit c9e35b2)
- [x] Career XP v2: 159 milestone types, legacy score, BG3-style levels
- [x] Club power ratings: 4-pillar composite (0-100) with pipeline + UI
- [x] User shortlists: CRUD API, AddToShortlist UI, owner controls
- [x] Test suite: 231 tests, stale role names fixed, KC durability
- [x] InsightCard redesign: KC-card-inspired visual language
- [x] Radar fingerprint fixes: proxies, role mapping, pool sizing, CSS
- [x] Featured player pool: blended DOF picks + 500 Tier 1 rotation
- [x] Level inference engine: admin buttons, pipeline 38/39
- [x] Trait inference: pipeline 36c (infer_traits) + 36b (fitness_tags) + 36 (mental_tags)
- [x] Scout Insights → /network with editable triage workflow
- [x] Pursuit status removed from all UI
- [x] U16/U18/U21/U23 age filters on /players

## Completed (2026-03-19, sessions 12-13)
- [x] CS Value formula recalibrated against 10 DoF anchors
- [x] Four-pillar assessment rebuilt: fix scale bugs, remove level anchor, wire real data sources
- [x] Physical pillar rebuilt: 5-component data-driven formula
- [x] LLM Profiles button added to admin panel
- [x] UEFA/FIFA coefficient system: pipeline 70, migration 037
- [x] API-Football expanded to 43 leagues, coefficient-scaled grades
- [x] News cron moved to GitHub Actions (6x/day)
- [x] Dual skill sets + MODEL_LABELS taxonomy
- [x] Kickoff Clash: migration 035, pipeline 80, KCCard, /kc-preview, Love2D prototype, itch.io
- [x] Players page overhaul: flags, league filter, CS value editing
- [x] Radar: contrast stretch, proxy attributes, scale bug fix, quality filter
- [x] Sidebar category grouping, Legends mobile nav + editable cards
- [x] Comparison tool live at /compare

## Completed (2026-03-18, sessions 9-11)
- [x] Pipeline renumbering + infrastructure (orchestrator, incremental, validation, parallel)
- [x] API-Football pipeline: migration 034, scripts 65-69, 4,906 rows, 36,799 grades
- [x] Role score calibration: 9 targets validated
- [x] Kaggle data pipeline: 5 datasets, migration 033
- [x] Dashboard overhaul: intelligence widgets
- [x] Scout Pad v2: bulk level/role editor table
- [x] Club assignment overhaul: 1,100+ clubs fixed

## Completed (2026-03-16-17, sessions 4-6)
- [x] Production deployment + 276 Tier 1 promoted
- [x] XP system v1 + EA FC 25 reimport
- [x] Personality rename + role score inflation fix
- [x] Landing page, SEO basics, analytics
- [x] Editor redesign + overall rating transition

## Completed (2026-03-14-15, sessions 1-3)
- [x] Four-pillar assessment system
- [x] Personality reassessment + club dedup
- [x] MiniRadar fingerprint + DoF assessment system
- [x] All pending migrations applied (023-035)
