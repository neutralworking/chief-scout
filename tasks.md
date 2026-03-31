# Chief Scout — Outstanding Tasks

## Launch Blockers (P0)

### OTP Launch — April 7 ✓ (all design + UX + QA done)
- [ ] **Manual roster augmentation** — user can feed up-to-date squad info for thin nations if needed
- [ ] **Stripe price IDs in Vercel** — create products in Stripe, add NEXT_PUBLIC_STRIPE_SCOUT_PRICE_ID + annual + pro variants to Vercel env

## High Priority

### Product & UX
- [ ] **Onboarding** — no help docs or tour for new users
- [ ] **Transfer comps on player detail** — "Similar Transfers" widget using /api/transfers/comps/[playerId]

### Data Quality
- [ ] **FBRef re-import with advanced stats** — current CSV only has goals/assists. Need shooting/passing/defense HTML tables

## Medium Priority

### Data Quality
- [ ] **Compound score calibration** — Technical/Tactical avg 55-57/100, may need rescaling
- [ ] **Data quality dashboard** — per-field completeness heatmap + stale data flags in `/admin`
- [ ] **StatsBomb event extraction** — progressive carries, pressure events, shot-creating actions from `sb_events`
- [ ] Club stadium capacities — Wikidata P115 qualifier spotty
- [ ] ~2,600 clubs without wikidata_ids — build bulk SPARQL name matcher
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

## Kickoff Clash
- [ ] **KC v2 polish** — pack opening animation, manager cards, meta-progression, more formations
- [ ] **KC standalone theme** — felt green/amber/leather redesign

## Punter's Pad (Planned)
- [ ] **Fixture data feed** — pipeline 61 fixtures → exportable format
- [ ] **Punter's Pad scaffold** — `punters-pad` repo

---

## Completed (2026-03-31, session 39 — AF Backfill + OTP Side Awareness)
- [x] AF stats person_id backfill: 15,247 orphaned stat rows linked (442 → 15,689 matched) (b87c752)
- [x] Script 65 patched: auto-backfill on every match run prevents future drift
- [x] Archetype recompute: 287 elite + 2,483 established + 3,144 aspiring (was 2/41/6,869)
- [x] OTP: preferred side restored to formation blueprints + scorePlayerForRole (41ceb1b)
- [x] OTP: sticky info bar, role score default sort, best role in player list (97b9c21, 86eaca5)
- [x] OTP: removed player count from nation index cards
- [x] Pogba nationality fix: England → France, cap-tied flags corrected

## Completed (2026-03-31, session 38 — OTP Design + Taxonomy Refinement)
- [x] OTP design overhaul: branded SVG hero, Clash Display gradient, collapsible pitch, animated reveal, mobile-first layout (75483be)
- [x] Players filter redesign: role/archetype/league dropdowns, position-aware, More overflow (42ea370)
- [x] 42-role taxonomy: Carrilero added (CM), Inside Forward → Inverted Winger rename (09fd7c3)
- [x] Complete Forward moved from role to earned archetype, Raumdeuter → archetype (ec1ec4f, b258644)

## Completed (2026-03-31, session 37 — AllSportsAPI + Cap-Tied Tracking)
- [x] AllSportsAPI pipeline: scripts 67 (squad/stats ingest) + 68 (grade conversion) (0612ee0)
- [x] Migration 052: `allsportsapi_stats` table
- [x] Migration 053: `cap_tied` nationality tracking
- [x] Cap-tied nationality resolution for dual-national players

## Completed (2026-03-31, session 36 — Rating Calibration Overhaul)
- [x] Pipeline 27: unified stat compression (all sources ×1.5 cap 15)
- [x] Pipeline 27: proxy_inferred + llm_inferred exempt from league strength
- [x] Pipeline 27: level-scaled proxy grades (Commander differentiation)
- [x] Pipeline 27: single-model penalty normalization fix
- [x] Pipeline 27: anchored scores for role computation (replaces raw/anchored cutoff)
- [x] Pipeline 27: soft level blend + safety net (replaces hard floor)
- [x] Pipeline 27: normalized role selection bug fix (Yamal 84→89)
- [x] Pipeline 66: AF tackles_p90→tackling mapping removed + 6,733 grades purged
- [x] Pipeline 56e: trait→grade bridge (47,155 grades for 12,521 players)
- [x] 96 scout grades for 11 elite attackers (Creator + Striker attrs)
- [x] Gakpo CF→WF, Foden WM→AM position fixes
- [x] 13,132 ratings recomputed, view refreshed

## Completed (2026-03-31, session 35 — EAFC PlayStyle Enrichment)
- [x] SportMonks API assessed — free tier, 4 leagues, not worth integrating
- [x] EAFC PlayStyles imported (56b): 11,024 trait rows for 5,692 players, 28 mapped tags
- [x] PlayStyle inference from grades (56c): 5,489 traits for 2,535 players, 12 rules with position gating
- [x] EAFC metadata enrichment (56d): 6,532 preferred_foot backfills, 1,993 Two Footed + 937 Skill Moves traits
- [x] Side inference re-run (38c): 5,352 new sides filled from foot data
- [x] Trait→grade bridge re-run (56e): 47,155 attribute grades for 12,521 players
- [x] Ratings recompute (27): 13,132 ratings + 50,082 compound scores updated

## Completed (2026-03-31, session 34 — SportsAPIPro Integration)
- [x] SportsAPIPro API key added to `.env.local`
- [x] Migration 051: `sportsapi_attributes`, `sportsapi_position_averages` tables, transfers source constraint
- [x] Pipeline 67: attribute radar ingestion (search + fuzzy match + 5-axis fetch)
- [x] Pipeline 68: transfer history ingestion (fees, types, window inference)
- [x] 12 players enriched as proof of concept (47 attr rows, 39 transfers, 17 with fees)
- [x] `sportsapi_refresh.sh` — daily cron at noon, 30 players/batch, incremental
- [x] Rate limit handling: global bail on 429, 404 tolerance, partial commit

## Completed (2026-03-30, session 33 — Data Cleanup + Archetype Tuning)
- [x] Stale data cleanup: pipeline 30 recency decay (last_season), dedup fix, 35,586 grades rewritten
- [x] 3 name collision dupes fixed (Pape Sarr 1977, Matt Clarke 1973, Iliya Gruev 1969) — 171 mis-attributed grades deleted
- [x] 7 retired players marked inactive (Charles, Ashley Young, Pablo Ibáñez, John O'Shea, + 3 women's)
- [x] RS≥+15 over level gap: 31→2 players (both inactive legends)
- [x] Džeko: level 52→82, club→Fenerbahçe
- [x] Archetype tuning: Connector threshold (pass_acc 85→88, passes_p90 45→55, added kp90≥0.8)
- [x] Archetype tuning: Wall threshold (rating 6.8→7.0), Terrier (def_actions 4.0→5.0, tackles 2.0→2.5)
- [x] Archetype tuning: aspiring relaxation 1.25→1.18, inference cascade removed entirely
- [x] Archetype distribution: max archetype 2,874→461, aspiring tier 67%→15%
- [x] Pipeline 27 rerun: 11,376 role scores recomputed
- [x] Mobile nav: swipe-to-dismiss, haptic pulse, backdrop blur, spring easing, escape key dismiss
- [x] Git merge: 12 remote commits integrated, 6 conflicts resolved, pushed

## Completed (2026-03-30, session 32 — AF Expansion + OTP Polish)
- [x] OTP audit: 5 design questions validated as resolved, 5 UX fixes shipped
- [x] GitHub issues: #124-#128 created+closed (OTP), #117+#122 closed (Systems & Roles)
- [x] OTP UX: dedup protection, balance warnings, try again button, formation preserves XI, back-nav guard
- [x] 11 domestic leagues added to pipeline 65 (Egypt, SA, DR Congo, Iran, Iraq, Indonesia, Peru, Costa Rica, Panama, Honduras, Qatar)
- [x] 14 league coefficients seeded for new domestic leagues
- [x] SA PSL ingested: 531 stat rows, 63 player matches
- [x] Fuzzy name matching (Strategy 4): rapidfuzz JW + nationality constraint, 21 new matches
- [x] Full pipeline chain: 66 (113k grades) → 27 (11,412 ratings) → 37 (17,681 archetypes) → OTP (48/48)
- [x] `pipeline/af_refresh.sh` — one-command daily refresh script
- [x] macOS crontab: af_refresh.sh at 6am+6pm UTC daily until April 18
- [x] Full AF --all-leagues --force refresh running (background)

## Completed (2026-03-30, session 31 — OTP QA)
- [x] OTP scoring rebalance: `scorePlayerForSlot()` using pipeline 27 `best_role_score` + position guard
- [x] Star players now appear in ideal XIs (Rice, Bellingham, Kane, Mbappe, Saliba, Dembele)
- [x] GKs can no longer fill outfield slots (SLOT_POSITION_MAP enforced)
- [x] Strength normalisation fixed: /230 → direct (role score = percentage)
- [x] Women's filter: `.eq("is_female", false)` → `.neq("is_female", true)` across 3 endpoints
- [x] Dual nationals now filtered for is_female in cron + players route
- [x] 91 women flagged by club name + 1 manual (Selma Bacha)
- [x] BLUEPRINT_ROLE_MAP: duplicate Prima Punta key fixed, Shuttler→Winger added
- [x] Default position filter: GK → All (users see full pool on load)
- [x] Share text includes URL
- [x] Recall threshold: age>28 caps<20 → age>30 caps<50
- [x] 48/48 ideal squads recomputed with new scoring, 0 errors
- [x] 18 new vitest tests for scorePlayerForSlot

## Completed (2026-03-29/30, session 30)
- [x] Systems & Roles: migration 049 (3 tables), pipeline 83 rewrite (28 systems, 308 slots, 41 roles)
- [x] Pipeline 27: 41-role TACTICAL_ROLES, POSITION_WEIGHTS fixed (6 missing models, 2 stale GK names)
- [x] Frontend: formation-intelligence.ts (41 roles), tactics pages query new tables, TS interfaces
- [x] SACROSANCT System 4 updated, migration 050 created (not applied)
- [x] Poacher → Prima Punta (Striker+Target) — not a system role, was inflating scores
- [x] API-Football compression ×1.5 cap 15 — percentile ranks treated as quality (gap 54→9)
- [x] Garbage override: AF ≤3/20 doesn't clobber understat ≥10.5/20
- [x] GK POSITION_WEIGHTS: "Organiser"/"Shotstopper" → Commander(0.95)/Powerhouse(0.9)
- [x] DM/WF POSITION_WEIGHTS: Engine added to DM, Target/Powerhouse/Passer added to WF
- [x] Archetype renames: Distributor→Conductor (961), Colossus→Titan (318)
- [x] Position fixes: Dembélé→CF, Bellingham→AM, Ronaldo→CF
- [x] Enzo Fernández dupe merged (accented + unaccented)
- [x] 68 scout grades across 9 players (Bruno→Enganche, Kane→Complete Forward, Donnarumma→Comandante, etc.)
- [x] Philosophy renames: Cholismo→Transizione, Fergie Time→Leadership
- [x] All 41 roles have assigned players, uniform -5 to -8 RS vs level delta
- [x] Understat compression unified with AF: both ×1.5 cap 15. Gap ≥+15: 13→8.
- [x] Dembélé moved back to WF (Inverted Winger 89) — no CF role uses Dribbler model

## Completed (sessions 24-28 — see git log for details)
- [x] Pipeline 92 parser + data fixes, 720 new players, 48/48 OTP nations (session 28)
- [x] Fixture predictions fix, paywall bypass, role score decompression (session 27)
- [x] All P0 launch blockers cleared, Gaffer Sprint 2, revenue gating (session 26)
- [x] Gaffer quality pass, crowd intelligence, materialized view (session 25)
- [x] Role score overhaul: EAFC excluded, league strength, proxy models (session 24)
- [x] Transfer Comparables, Scouting Notes v2, Wave 2+3 UI, KC DB wiring (sessions 22-23)

## Completed (earlier sessions — see git log for details)
- [x] 36→42-Role Taxonomy, Fixture Predictions, GK Ratings, Nav v2, Design System v2
- [x] Valuation pillar integration, position audit, grade backfill
- [x] Legends system (195), On The Plane (48 nations), Kickoff Clash v4
- [x] Freemium + billing tier, per-player SEO, career XP v2
- [x] Club power ratings, shortlists CRUD, earned archetypes
- [x] Pipeline renumbering, API-Football expansion, Kaggle ingest
- [x] Mobile bottom nav, Scout Insights, compare tool
