# Chief Scout — Outstanding Tasks

## High Priority

### Data Density (Strategic Priority #1)
- [x] ~~Run `22_fbref_grades.py`~~ — 1,418 grades (limited by FBRef CSV coverage: only goals/assists columns populated). Stale rows cleaned (2026-03-18)
- [x] **Apply migration 029** (`pipeline/sql/029_trait_scores.sql`) — player_trait_scores table + availability columns
- [x] **Run personality rules** — `python 34_personality_rules.py` (15 players updated)
- [x] **Run personality LLM** — `python 35_personality_llm.py --min-level 85 --limit 50`
- [ ] **Manual personality review** — `/admin/personality` for top 50 players (LLM pass done, needs human QA)
- [ ] **Scale to 200+ full profiles** — target by end of March (currently ~50). Requires automated generation from external data.

### External Data Replacement (FBRef scraper dead)
FBRef manual ingest (script 11) now works via CSV import (`pipeline/fbref_paste_to_csv.py`). EPL, La Liga, Bundesliga 2025-26 CSVs added. Multi-source strategy to exceed coverage:

| Source | Pipeline Script | What it replaces | Status |
|--------|----------------|------------------|--------|
| **FBRef CSV** | `pipeline/11_fbref_ingest.py` | Season stats via pasted CSVs | DONE (PR #84, #86) |
| **Kaggle datasets** | `pipeline/45-50_kaggle_*.py` | Euro leagues, transfers, FIFA historical, PL stats, injuries | DONE — 5 datasets downloaded, 4 ingested (2026-03-17) |
| **API-Football** | `pipeline/65-69_api_football_*.py` | Season stats + match + import + positions + grades | DONE — 4,906 rows, 36,799 grades, 4,666 matched (2026-03-18) |
| **Fotmob** | — | xG, defensive actions, passing, match ratings | SKIPPED — unofficial API risk |
| **StatsBomb** (existing) | `pipeline/08_statsbomb_ingest.py` | Event-level data (select comps only) | DONE |
| **Understat** (existing) | `pipeline/09_understat_ingest.py` | xG/xA per match (top 5 leagues) | DONE |

- [x] ~~Build API-Football ingest~~ — Pro sub ($30/mo), scripts 65+66, migration 034, 14 attributes, 1,301 players graded (2026-03-18)
- [x] ~~Build Fotmob ingest~~ — SKIPPED: unofficial API, same risk as FBRef scraper death
- [x] ~~Update script 22~~ — unified multi-source grade engine (cross-source percentiles). Replaces scripts 22/30/31/66. 6 adapters (FBRef, API-Football, Understat, StatsBomb, Kaggle Euro, Kaggle PL). 59,924 grades for 6,044 players (2026-03-19)
- [x] ~~Update `player_id_links`~~ — `source='api_football'` matching built into 65_api_football_ingest.py (2026-03-18)
- [x] ~~Update `SOURCE_PRIORITY`~~ — `api_football` added to models.py, models.ts, valuation_core/config.py (2026-03-18)
- [ ] **Extend API-Football to secondary leagues** — Eredivisie, Liga Portugal, Championship, Super Lig, Jupiler Pro (configured, not yet fetched)
- [x] ~~Improve API-Football matching~~ — Script 67 (match+import): 4,666 matched (was 600), 1,507 new players imported, 5-strategy matching (2026-03-18)
- [x] ~~Add API-Football to Vercel env~~ — `API_FOOTBALL_KEY` set in Vercel (2026-03-19)

### Data Freshness (Strategic Priority #2)
- [ ] **News cron** — automated refresh every 2-4h (#53). Sprint item #1. Last automation gap.
- [ ] **Materialized view auto-refresh** — trigger after pipeline scripts

### Product & UX
- [x] ~~Production deployment to Vercel~~ — chief-scout-prod.vercel.app live (2026-03-16)
- [x] ~~Create prod Supabase project~~ — qfzhvoyvlxsbajbnifds, 276 players promoted (2026-03-16)
- [ ] **XP system v2** — move to real XP scale (Ballon d'Or=1000, World Cup=500, debut=10) with separate integration into valuation engine. Current small-modifier system is interim.
- [x] ~~CS Value formula inflation~~ — fixed (2026-03-16)

- [x] ~~Revisit CSPER personality names~~ — Blade→Mamba, Warrior→Catalyst, Genius→Spark. Centralised in lib/personality.ts (2026-03-17)
- [x] ~~Pipeline script renumbering~~ — 37 files renamed, zero collisions, clean ranges 01-79 (2026-03-18)

## Fixture Previews — Remaining
- [x] ~~Run migration `030_fixtures.sql`~~ — applied 2026-03-16
- [x] ~~Add API key to `.env.local` + Vercel~~ — done 2026-03-16
- [x] ~~Ingest fixtures (all 5 leagues, 415 matches)~~ — done 2026-03-16
- [ ] **Fixture-based club verification**: Build `38_fixture_club_verify.py` once fixture data populated
- [ ] **Add Vercel env var to preview** — git repo not connected, only production set

## Radar Fingerprints — Expansion
- [x] ~~Percentile-based fingerprints~~ — position-group percentiles via pipeline/51_fingerprints.py (2026-03-17)
- [x] ~~Remove on-the-fly fingerprint computation~~ — API reads from view, 160 lines removed (2026-03-17)
- [x] ~~Role-specific radar axes~~ — 45+ role→axis mappings in lib/role-radar.ts, pipeline 60 computes per-role percentiles (2026-03-17)
- [ ] Add MiniRadar to shortlist detail page (`/shortlists/[slug]`)
- [ ] Add MiniRadar to club detail page key players section (`/clubs/[id]`)
- [ ] Add MiniRadar to TrendingPlayers component (homepage)
- [ ] Player comparison page (`/compare`) — overlay 2-3 fingerprint polygons

## Go-to-Market (from CEO review)
- [x] ~~Production Supabase~~ — qfzhvoyvlxsbajbnifds (EU West), 276 Tier 1 players promoted (2026-03-16)
- [x] ~~Analytics~~ — Plausible script, prod only (2026-03-16)
- [x] ~~Landing page~~ — hero, features, live player cards, pricing CTA (2026-03-16)
- [x] ~~SEO basics~~ — sitemap.xml, robots.txt, OG meta tags (2026-03-16)
- [ ] **SEO advanced** — per-player OG images, structured data
- [ ] **Onboarding** — no help docs or tour for new users
- [ ] **Pricing page visual alignment** — redesigned to match landing page (2026-03-16, needs review)

## Medium Priority

### Data Quality
- [ ] **Dedup improvements** — upgrade player matching from exact name to fuzzy (Levenshtein/Jaro-Winkler) with confidence scores. Flag ambiguous for manual review (plan A2)
- [ ] **Data quality dashboard** — per-field completeness heatmap + stale data flags in `/admin`. API route exists (`/api/admin/data-quality`), needs UI (plan A3)
- [ ] **StatsBomb event extraction** — extract progressive carries, pressure events, shot-creating actions from existing `sb_events` data (plan B2)
- [ ] Club stadium capacities — Wikidata P115 qualifier spotty, needs targeted enrichment
- [ ] ~2,600 clubs without wikidata_ids — build bulk SPARQL name matcher
- [ ] Build trait inference script — infer traits from FBRef stats for four-pillar (slot: 63+)
- [ ] Build physical metrics script — aggregate FBRef minutes into availability scores (slot: 64+)
- [ ] Editor pillar tabs — reorganize into Technical/Tactical/Mental/Physical sections
- [ ] Add materialized view auto-refresh after pipeline scripts
- [ ] Women's players: decide long-term approach
- [ ] 3 manual profiles not found (Tchouameni, Cubarsi, Dembele) — accent mismatches
- [ ] **Fix script 04** (`refine_players.py`) — crashes on news_sentiment_agg `story_types` (string not dict)
- [ ] **Wikidata enrichment level 75-77** — 69_wikidata_quick_enrich.py done for 78+, lower tiers remain (~600 players)

### Pipeline Infrastructure (ALL COMPLETE)
- [x] ~~Script renumbering~~ — 37 files, clean ranges 01-79, zero collisions (2026-03-18)
- [x] ~~Pipeline orchestrator~~ — `run_all.py`: 20 steps, dependency order, cron_log, --steps/--from/--dry-run (2026-03-18)
- [x] ~~Incremental processing~~ — `lib/incremental.py`: cron_log delta detection, wired into ratings (7360→1 player on change) (2026-03-18)
- [x] ~~Shared DB connection~~ — `lib/db.py`: require_conn(), get_supabase(), get_dict_cursor(), chunked_upsert() (2026-03-18)
- [x] ~~Post-pipeline validation~~ — `63_validate.py`: 6 categories, 28 checks, logs to cron_log (2026-03-18)
- [x] ~~Parallel pipeline execution~~ — `--parallel` flag, ThreadPoolExecutor, level-based grouping (2026-03-18)
- [x] ~~Single MODEL_ATTRIBUTES source~~ — `lib/models.ts` + `lib/models.py`, removed from 10+ files (2026-03-18)

### Product & Features
- [x] ~~Comparison tool~~ — /compare with radar overlay, four-pillar bars, 13 model scores, roles, personality, market, verdict (2026-03-18)
- [ ] **Formations seed** — populate from research data (#54, sprint item #2)
- [x] ~~Editor redesign~~ — scout-first layout, compound archetype selector, position-filtered blueprints, collapsible sections, mobile touch targets (2026-03-17)
- [ ] **Product polish** — glass consistency, archetype styling (#55, sprint item #3)
- [ ] **Free agent grader** — ranked shortlists (#26)
- [ ] **Scouting radar** — statistical alert system (#25)
- [ ] **News-driven alerts** on player list (#23)

### Data Enrichment
- [ ] Apply migration 024 (network_roles + network_edits tables)

### New Scripts (session 10)
- [x] ~~67_af_match_and_import.py~~ — 3-phase: sync person_id, improved matching, import new players (2026-03-18)
- [x] ~~68_af_infer_positions.py~~ — infer position from AF stats heuristics (2026-03-18)
- [x] ~~69_wikidata_quick_enrich.py~~ — search API + entity data for DOB/height/nation/foot (2026-03-18)
- [x] ~~29_fix_club_assignments.py rewrite~~ — multi-source priority (AF→TM→WD), youth/reserve detection, 50+ AF short names (2026-03-18)
- [x] ~~60_fingerprints.py fix~~ — position-specific 4-axis replacing generic 6-axis (2026-03-18)

## Kickoff Clash (Card Game)
- [x] ~~Core mechanics design~~ — docs/design/kickoff-clash-mechanics.md (2026-03-19)
- [x] ~~Game designer skill~~ — `.claude/commands/game-designer.md` (2026-03-19)
- [x] ~~DB migration~~ — `pipeline/sql/036_kickoff_clash.sql`, 7 tables (2026-03-19, NOT applied)
- [x] ~~App scaffold~~ — `apps/kickoff-clash/`, Next.js 16.1.6, port 3001 (2026-03-19)
- [x] ~~Card generation pipeline~~ — `pipeline/80_export_card_templates.py` (2026-03-19)
- [x] ~~Scoring engine~~ — scoring.ts (790 lines), chemistry.ts (346), economy.ts (241) (2026-03-19)
- [x] ~~Game UI~~ — page.tsx (957 lines), run.ts (445 lines), all phases playable (2026-03-19)
- [ ] **Apply migration 036** to Supabase
- [ ] **Run card generation** — `python 80_export_card_templates.py` (populate kc_cards from CS data)
- [ ] **Wire DB cards** into game (replace hardcoded SAMPLE_CARDS)
- [ ] **UI/UX polish** — fix layout issues, card visuals, scoring animation, pitch layout
- [ ] **Shop card pick flow** — 1-of-3 selection modal
- [ ] **Manager cards** — implement modifier system (The Dugout)
- [ ] **Chemistry Book** — meta-progression synergy collection
- [ ] **Sound/haptics** — satisfying whistle blow, synergy trigger sounds
- [ ] **PWA** — manifest + service worker for add-to-homescreen

## Low Priority
- [ ] Player list pillar spark bars (needs precomputed scores or batch API)
- [ ] Valuation model integration with four-pillar scores (Phase 5)
- [ ] Clean up more duplicate players (accent variants)
- [ ] EA FC 25 fuzzy matching — ~6,900 unmatched players (single-name formats). Improvable with alias expansion or LLM matching
- [ ] **LLM-powered name matching** — build `pipeline/lib/llm_match.py` for transliteration/nickname/accent resolution (plan G4)

## Completed (2026-03-19, session 11)
- [x] Git merge: stashed local changes, committed, pulled 124 commits, resolved conflicts in pipeline/11 + pipeline/27 (took upstream)
- [x] Kickoff Clash mechanics design — CEO strategy, design-manager architecture, game-designer mechanics (economy, scoring, chemistry, roles)
- [x] Core mechanics doc: `docs/design/kickoff-clash-mechanics.md`
- [x] `/game-designer` skill created
- [x] Migration 036: 7 KC tables (kc_cards, kc_runs, kc_run_cards, kc_matches, kc_modifiers, kc_run_modifiers, kc_chemistry_book)
- [x] App scaffold: `apps/kickoff-clash/` — Next.js 16.1.6, dark theme, port 3001
- [x] Card generation pipeline: `pipeline/80_export_card_templates.py` — 38 comedic surnames, 5 bio themes, dry-run tested
- [x] Scoring engine: scoring.ts (31 role abilities, 5 playing styles), chemistry.ts (4-tier synergies, 20 role combos), economy.ts (stadiums, attendance, shop)
- [x] Run state: run.ts (38 sample cards, 5 opponents, full lifecycle)
- [x] Game UI: page.tsx (setup → arrange → score → shop → win/loss), builds clean
- [x] Marked API-Football Vercel env task done

## Completed (2026-03-18, session 10)
- [x] Radar fix: position-specific 4-axis replacing generic 6-axis (CD shows DES/COV/CMD/PAS, not DEF/CRE/ATK/PWR/PAC/DRV)
- [x] Club assignment overhaul: script 29 rewritten with AF→TM→WD priority, youth/reserve detection, 50+ AF short name mappings
- [x] 1,100+ club assignments fixed, Benzema manually corrected (wrong Wikidata entity)
- [x] 133 stale "Free Agent" + 78 stale "Expiring" contract tags cleared (players actively playing in AF data)
- [x] AF matching + import: 4,666 matched (was 600), 1,507 new players imported (script 67)
- [x] Position inference from AF stats: 1,468 positions inferred (script 68)
- [x] Wikidata quick enrichment: 201 top players enriched with DOB/height/nation/foot (script 69)
- [x] FBRef grades refreshed (1,418), 991 stale rows from old scale cleaned
- [x] Full enrichment chain re-run: grades (36,799 AF), ratings (8,591), fingerprints (8,594), levels (1,175 inferred), personalities (1,135), blueprints (30), scouting tags (455)
- [x] 813 missing player_profiles stubs + 2,215 player_status + 2,204 player_market stubs created

## Completed (2026-03-18, session 9)
- [x] `/next-up` skill — prioritised task queue with skill suggestions, auto-run candidates
- [x] External data strategy decided — API-Football Pro ($30/mo), Fotmob skipped (unofficial API risk)
- [x] API-Football pipeline — migration 034, scripts 65 (ingest) + 66 (grades), 2,642 player-season rows across top 5 leagues
- [x] Player matching: 1,758/2,642 matched (67%), multi-word surname + initial matching + club disambiguation
- [x] 13,211 attribute_grades written (source='api_football'), 14 attributes, position-group percentiles
- [x] SOURCE_PRIORITY updated in all 3 locations (models.py, models.ts, valuation_core/config.py)
- [x] Full pipeline run — ratings, fingerprints, tags, roles, personality, valuations all recomputed with new data
- [x] Pipeline orchestrator fixes: .env.local loading, per-step timeout, supports_force flag, valuation marked optional
- [x] Fixed infer_levels (model_id NULL instead of string), career_xp (batch psycopg2 instead of REST), dof_valuation (mode constraint)

## Completed (2026-03-18, session 8)
- [x] Dashboard overhaul — condensed featured, fixed sentiment dots (`--sentiment-*` → `--color-sentiment-*`), removed position/personality panels, added fixtures/contract watch/rising stars/market movers/key moments intelligence widgets
- [x] Sidebar: "Formations" → "Tactics"
- [x] Scout Pad v2 — bulk level/role editor table with infinite scroll, inline editing of position + level, filters by position/pursuit/search
- [x] Scout Pad API route (`/api/scout-pad`) — paginated player_intelligence_card query with sorting/filtering

## Completed (2026-03-18, session 7)
- [x] Rating formula overhaul — coverage-scaled blend (50% tech at 40+ grades, 20% at thin data), peak removed, stale compounds cleaned
- [x] ~38 level corrections applied (Ballon d'Or / Guardian calibration), 15 reverted after user review
- [x] Players page: inline editable index with +/- steppers, admin login, nation flags, xG, FBRef+Kaggle stats, page size selector
- [x] "Needs Review" sort — surfaces biggest |level - overall| divergence
- [x] Editor: Level/Peak promoted to Scouting Profile section (always visible)
- [x] Display swap: level→overall across all pages (free agents, clubs, fixtures, shortlists, formations, network, review, admin)
- [x] API routes updated to sort by overall, return stats data
- [x] Pipeline 52 (calibrate_from_edits) — source bias detection, kNN level prediction, auto-apply
- [x] network_edits audit logging fixed (UUID user_id bug)
- [x] Seeded 38 corrections into network_edits as training data

## Completed (2026-03-17, session 6)
- [x] Role score full calibration — aliases, level floors, understat compression, GK remap. 7,363 players rated. Validated: Haaland 89, Mbappé 89, Kane 85, Yamal 86, Palmer 84, Alisson 86, Ederson 80
- [x] Kaggle data pipeline — migration 033 applied, 5 datasets downloaded, 4 ingested (euro leagues 4277, PL stats 574, injuries 15603, transfer values 508)
- [x] Fixed 49_kaggle_injuries.py (fitness→fitness_tag), 46_kaggle_transfer_values.py (rglob for nested dirs)
- [x] Pipeline 27: raw/anchored model score split, attribute alias system (10 fallbacks), double-count prevention
- [x] Understat compression (×1.7 cap 17), GK model remapped to scout-graded attrs

## Completed (2026-03-17, session 5)
- [x] XP system fully implemented — migration 031, pipeline 44, valuation engine, UI XP tab. User expanded with tiered trophies, academy grads, promotion climbers
- [x] EA FC 25 attribute import — purged 418k broken rows, reimported 189k real grades from Kaggle dataset (pipeline 51). 9,190 players matched via multi-strategy matching + 24 manual aliases
- [x] Role score inflation fix — coverage penalty in pipeline 27 prevents thin-data models scoring 90. Before: 67 players at 90. After: proper gradient (Mbappé 82, Palmer 90, Haaland 76)
- [x] Retired players filtered from /players Network page (active=true filter on API)
- [x] Pipeline 27 re-run with fixes — 7,353 players re-rated

## Completed (2026-03-16, session 4)
- [x] XP system fully live — migration 031 applied to Supabase, pipeline 44 run (4,589 players, 11,663 milestones), valuation engine XP modifier in effective_score, UI XP tab on player detail pages
- [x] User expanded pipeline 44 with tiered trophies (elite/major/minor), academy graduates, early starters, promotion climbers, late bloomers, loan success, consecutive seasons. XP cap raised to [-5, +12].

## Completed (2026-03-16, session 3)
- [x] FBRef CSV import: paste-to-CSV parser + EPL/La Liga/Bundesliga 2025-26 data (PRs #83, #84, #86)
- [x] Kaggle dataset pipelines: 5 scripts (45-50), migration 033 (PR #85)
- [x] Player sort by role score + valuation bug fixes (PR #87)
- [x] QA sweep: security hardening, error boundaries, loading states (PR #80)
- [x] Docs cleanup: removed 10+ stale plan/spec files

## Completed (2026-03-16, session 2)
- [x] Role score on player detail page — headline number with level ceiling suffix
- [x] Best role name next to position badge on player profile
- [x] Migration 032: `best_role_score` added to `player_intelligence_card` view + `club_id`
- [x] DoF assessment system: migration, API routes, editor UI section, pipeline scripts 42-43
- [x] XP system: migration 031, pipeline 44, valuation engine integration
- [x] All changes pushed to main (28 files, +2,877 lines)

## Completed (2026-03-16, session 1)
- [x] All pending migrations applied (023-029, 027-028, 030-032)
- [x] Role score displaying on PlayerCard (replaces level as primary, fallback to level muted)
- [x] Best role label shown alongside personality type on PlayerCard
- [x] Club names clickable on PlayerCard → `/clubs/[id]`
- [x] `club_id` added to `player_intelligence_card` view
- [x] News HTML entity decoding fixed (Football Italia smart quotes/dashes)
- [x] Formations marked staging-only in sidebar nav
- [x] `transfer_availability` submodule separated (standalone repo)
- [x] Personality rules run — 765 players corrected (loyalty→intrinsic, comp→intrinsic, etc.)
- [x] Personality LLM run — top 50 players (level 85+) reassessed via Groq, 47 type changes
- [x] CS Value formula inflation fixed
- [x] Gaffer crash fixed

## Completed (2026-03-15)
- [x] Four-pillar assessment system (Technical/Tactical/Mental/Physical) — lib + API + UI + SACROSANCT
- [x] Trait-role impact matrix (19 traits × 26 roles)
- [x] FourPillarDashboard component on player detail page
- [x] Physical score column on free agents page
- [x] Personality-role alignment in FormationDetail
- [x] Personality reassessment UI at /admin/personality
- [x] Personality reassessment pipeline: rules (34) + LLM (35)
- [x] player_personality added to admin update API
- [x] Gyökeres personality fixed: IXSC→INSC (Blade)
- [x] Club dedup: 28 duplicates merged, 119 players reassigned (script 37)
- [x] Arsenal wikidata fixed (was Lesotho Defence Force FC), stadium corrected
- [x] 20 major clubs seeded with wikidata_ids
- [x] 204 clubs enriched with stadium/country/founded from Wikidata
- [x] Club verification pipeline (script 36): 60+ stale transfers fixed
- [x] Manual club fixes: Zubimendi→Arsenal, Garnacho→Chelsea, Lookman→Atletico, etc.
- [x] Jesus Navas marked inactive (retired Dec 2024)
- [x] MiniRadar fingerprint on PlayerCard and free agents page
- [x] Free agents "ex-{club}" display fix
- [x] Club league_name data quality — major clubs fixed, duplicates merged

## Completed (2026-03-14)
- [x] Fix player levels: tiered league caps in 34_fix_levels.py
- [x] Apply 35_manual_profiles.py (267 DOF profiles)
- [x] Rebalance overall formula (65% level / 35% compound)
- [x] Fix Vitinha duplicate + display issue
- [x] Merge Vinicius + Ødegaard duplicates
- [x] Fix admin panel button styling
- [x] Rename personality types: Provocateur→Livewire, Showman→Warrior, Hunter→Blade
- [x] Fix women's player levels + CS values (NULLed out)
- [x] Fix league mappings: Benfica, Celtic, Al-Ahli, Al-Ittihad
- [x] Add PlayerQuickEdit to player detail page
- [x] Delete 14 stale git branches
- [x] Create /wrap-up skill
