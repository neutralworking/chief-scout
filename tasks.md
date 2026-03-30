# Chief Scout — Outstanding Tasks

## Launch Blockers (P0)

### OTP Launch — Hard Deadline: April 7
WC 2026 playoffs complete by April 7, buzz is building now. OTP must be live and all 48 nations playable.
- [x] ~~Wikipedia squad enrichment~~ — pipeline 92 fixed + run, 720 players inserted, 48/48 nations playable
- [x] ~~Pre-compute ideal squads~~ — OTP cron run with force, 48/48 computed
- [x] ~~OTP smoke test~~ — all 48 nations clickable, squads return, ideal squad cached
- [x] ~~Women filtered from OTP~~ — `is_female` column added to `people`, 90 flagged, API filters applied
- [x] ~~Coach formations~~ — migration 050, preferred_formation seeded for 48 nations, ideal squad uses coach's real formation
- [x] ~~Formation role flexibility~~ — widened archetype lists so thin-pool nations fill slots
- [x] ~~Pipeline 92 rewrite~~ — parses "Recent call-ups" Wikipedia sections for deeper pools
- [ ] **AF ingest new leagues** — 11 leagues added to script 65 (ECU, PAR, PER, HON, PAN, CRC, JAM, EGY, CIV, QAT, IDN, IRQ, IRN) — code ready, not yet run
- [ ] **Re-run OTP cron with force** — recompute ideal squads using coach formations (after AF ingest)
- [ ] **Verify OTP conversion hook** — post-submit CS rating + upgrade CTA functional

### Production Readiness
- [x] ~~Fix Prod DB~~ — region migrated eu-central-1→eu-west-1, pooler endpoint updated
- [x] ~~Stripe keys~~ — test keys set in both .env.local files. Still need adding to Vercel for deploy.
- [x] ~~Production build verification~~ — clean build confirmed session 26
- [x] ~~Scouting notes gap~~ — 250/250 top players now have notes (pipeline 90, 249 generated via Anthropic)
- [x] ~~NEXT_PUBLIC_SITE_URL~~ — set to chief-scout.vercel.app in Vercel + all 16 env vars pushed

### Data Quality (launch-critical)
- [x] ~~Top-end role score compression~~ — Fixed: curved model conversion + top-end stretch. Mbappé 87→90, ceiling 89→92
- [ ] **3 manual profiles not found** (Tchouameni, Cubarsi, Dembele) — accent mismatches

## High Priority

### Product & UX
- [ ] **Mobile nav: More sheet polish** — test swipe-to-dismiss, add haptic feedback consideration
- [ ] **Onboarding** — no help docs or tour for new users
- [ ] **Transfer comps on player detail** — "Similar Transfers" widget using /api/transfers/comps/[playerId]

### Data Quality
- [ ] **FBRef re-import with advanced stats** — current CSV only has goals/assists. Need shooting/passing/defense HTML tables
- [ ] **LLM attribute inference expansion** — pipeline 93 covers ~190 players (level 75+). Run for more players across sessions (quota-limited). Fixes Controller/Engine/Commander model coverage.
- [ ] **Role distribution tuning** — Tuttocampista still dominant at CM. Root cause: data coverage gaps. LLM inference helps but needs broader coverage.
- [ ] **Raumdeuter → archetype** — removed as WF role, needs adding to archetype system (SACROSANCT System 2)
- [ ] **Archetype threshold tuning** — Pulse (1,037) and Outlet (1,041) still heavy; aspiring tier at 15%

## Medium Priority

### Data Quality
- [ ] **Compound score calibration** — Technical/Tactical avg 55-57/100, may need rescaling
- [ ] **Dedup improvements** — upgrade player matching from exact name to fuzzy (Levenshtein/Jaro-Winkler)
- [ ] **Data quality dashboard** — per-field completeness heatmap + stale data flags in `/admin`
- [ ] **StatsBomb event extraction** — progressive carries, pressure events, shot-creating actions from `sb_events`
- [ ] Club stadium capacities — Wikidata P115 qualifier spotty
- [ ] ~2,600 clubs without wikidata_ids — build bulk SPARQL name matcher
- [x] ~~Women's players~~ — `is_female` column on `people`, 90 flagged, filtered from OTP. Longer-term: separate pipeline TBD
- [ ] **Wikidata enrichment level 75-77** — 69_wikidata_quick_enrich.py done for 78+, lower tiers remain (~600 players)
- [ ] **Expand transfer seed data** — 19 unmatched players (accent mismatches), find Kaggle transfer fee dataset

### Product & Features
- [ ] **TM value sparkline** — mini chart on player detail page showing transfermarkt value history
- [ ] Add MiniRadar to shortlist detail page (`/shortlists/[slug]`)
- [ ] Add MiniRadar to club detail page key players section (`/clubs/[id]`)
- [ ] Add MiniRadar to TrendingPlayers component (homepage)
- [ ] **Formations seed** — populate from research data
- [ ] **Product polish** — glass consistency across all pages
- [ ] **Free agent grader** — ranked shortlists
- [ ] **Scouting radar** — statistical alert system
- [ ] **News-driven alerts** on player list

### Infrastructure
- [ ] **Migrate remaining understat scripts** — scripts 13, 22, 44, 10 still reference `understat_player_match_stats`

## Low Priority
- [ ] Player list pillar spark bars (needs precomputed scores or batch API)
- [ ] Clean up more duplicate players (accent variants)
- [ ] EA FC 25 fuzzy matching — ~6,900 unmatched players
- [ ] **LLM-powered name matching** — build `pipeline/lib/llm_match.py` for transliteration/accent resolution
- [ ] **Pricing page visual alignment** — redesigned to match landing page
- [x] ~~Thin-pool OTP nations~~ — pipeline 92 (Wikipedia national squads) built, covers all 48 nations

## Kickoff Clash
- [x] ~~KC DB wiring~~ — migration 036, 201 tests, pack opening, card art, rarity rebalance
- [ ] **KC v2 polish** — pack opening animation, manager cards, meta-progression, more formations
- [ ] **KC standalone theme** — felt green/amber/leather redesign

## Punter's Pad (Planned)
- [ ] **Fixture data feed** — pipeline 61 fixtures → exportable format
- [ ] **Punter's Pad scaffold** — `punters-pad` repo

---

## Completed (2026-03-30, session 30)
- [x] Systems & Roles Redesign — migration 049, 28 systems, 41 roles, pipeline 83 seed, pipeline 27 DB-driven
- [x] LLM Attribute Inference — pipeline 93, 3,475 grades for thin mental/tactical models
- [x] AM role distribution fix — Controller weight bump + LLM data → 45% Enganche / 31% Trequartista / 20% Mediapunta
- [x] GitHub Issues cleanup — 4 closed, 7 created, "Launch — May 1" milestone, labels
- [x] SACROSANCT System 4 rewritten for 41-role taxonomy
- [x] Frontend synced — role-definitions.ts, ratings.ts, compare/route.ts all updated
- [x] QA passed — all 9 checks green, TypeScript clean, zero orphan roles

## Completed (2026-03-27, session 28)
- [x] Pipeline 92 parser fixed: 4 bugs (sort-key positions, table class ordering, federation club links, redlink names)
- [x] Pipeline 92 data fixes: `date_of_birth` column name, manual ID generation, South Africa redirect, New Zealand disambiguation
- [x] 720 new players inserted across 15 thin/low nations — 48/48 WC nations now playable
- [x] Materialized view refreshed: 28,636 rows (up from 27,918)
- [x] OTP ideal squads precomputed: 48/48 nations, zero errors
- [x] Women filtered from OTP: `is_female` boolean on `people` (90 flagged), API filters on 3 endpoints
- [x] Codespace POSTGRES_DSN secret stale (eu-west-1) — needs GitHub secret update

## Completed (2026-03-26, session 27)
- [x] Fixture predictions fix: club enrichment was broken (selecting nonexistent columns), 130/149 predictions now live
- [x] Fixture preview fix: philosophy/formation data from tactical_philosophies, 11/11 predicted XI
- [x] Paywall bypass: staging + admin login skip all tier gates
- [x] Role score decompression: curved model conversion + top-end stretch (Mbappé 87→90, ceiling 89→92)
- [x] POSTGRES_DSN fixed: was pointing to eu-west-1, corrected to eu-central-1
- [x] .superpowers/ gitignored, outstanding session artifacts committed

## Completed (2026-03-26, session 26)
- [x] All 5 P0 launch blockers cleared
- [x] Prod DB fixed — region migrated eu-central-1→eu-west-1
- [x] Stripe keys set (test) in .env.local + Vercel
- [x] Scouting notes gap closed — 250/250 top players have notes (pipeline 90)
- [x] NEXT_PUBLIC_SITE_URL set in Vercel + 16 env vars pushed
- [x] 13 codespace secrets configured (no manual pasting on rebuild)
- [x] Scout Grading Queue — `/admin?tab=grading`, compact 0-10 click-to-grade, auto-advance
- [x] PM sync — WORKING.md, tasks.md, FEATURES.md, BRANCHES.md all updated
- [x] Revenue gating: PaywallGate + TierGatedSection on all tier-restricted pages
- [x] Gaffer Sprint 2: identity reveal, era bias fix, OTP conversion hook, onboarding
- [x] CEO assessment + launch readiness plan (May 1 target), PR #113

## Completed (2026-03-25, session 25)
- [x] Gaffer question quality pass: dated refs fixed, ACL dilemma rewritten, GOAT dupes rethemed
- [x] control_vs_chaos dimension expanded (~20→~130 across 25+ options)
- [x] Two new Gaffer categories: Contract Talks + International Duty (135 total)
- [x] Crowd intelligence feedback loop: migration 046, pipeline 46, admin widget
- [x] Materialized view: migration 047, 7 indexes, 27,918 rows, pg_trgm, RPC refresh
- [x] All migrations applied through 047 on staging
- [x] Vercel deploy fixed (hobby plan quota from rapid pushes)

## Completed (2026-03-25, session 24)
- [x] EAFC grades excluded from role scoring (pipeline 27)
- [x] GK 1.2× scout rescale removed
- [x] Level floors inverted, min grade thresholds
- [x] League strength integrated via `lib/calibration.py`
- [x] Position deflators (later removed — defender RS gap)
- [x] Proxy model inference for Sprinter/Engine/Controller/Target
- [x] CF roles expanded: Assassin, Complete Forward, Spearhead
- [x] Fox→Assassin, Sentinelle→Anchor, Vorstopper→Stopper renames
- [x] 68 tests passing (15 new)

## Completed (2026-03-24, sessions 22-23)
- [x] Transfer Comparables: migration 045, pipelines 87-89, /transfers page, 147 seed + 737 Kaggle
- [x] Scouting Notes v2: pipeline 90, migration 048, multi-perspective, admin panel
- [x] Player detail: no-scroll redesign with tab groups
- [x] Wave 2 UI: Clubs, Leagues, News, Free Agents redesigned
- [x] Wave 3 UI: Compare, Tactics, Squad redesigned
- [x] KC DB wiring: 201 tests, pack opening, card art, rarity rebalance
- [x] OTP fixes: GK filter, positions-first layout, React #310
- [x] KC mobile: full XI formations, starter packs, manager cards
- [x] Tactical philosophies: 10 seeded, 22 clubs assigned, /tactics detail
- [x] Legend archetype inference: 313 legends via compound mapping + 1,291 active players
- [x] Football-culture archetypes: Fenômeno, Kaiser, Pendolino, Tractor, etc.
- [x] Playing style traits: 16 editorial traits, pipeline 04d, trait pills
- [x] Archetype styling: centralized `lib/archetype-styles.ts`
- [x] Secondary model enrichment: 827/924 single-model compounds fixed (71%→7%)

## Completed (earlier sessions — see git log for details)
- [x] 36-Role Taxonomy, Fixture Predictions, GK Ratings, Nav v2, Design System v2
- [x] Valuation pillar integration, position audit, grade backfill
- [x] Legends system (195), On The Plane (48 nations), Kickoff Clash v4
- [x] Freemium + billing tier, per-player SEO, career XP v2
- [x] Club power ratings, shortlists CRUD, earned archetypes
- [x] Pipeline renumbering, API-Football expansion, Kaggle ingest
- [x] Mobile bottom nav, Scout Insights, compare tool
