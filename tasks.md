# Chief Scout — Outstanding Tasks

## High Priority

### Data Density (Strategic Priority #1)
- [ ] **Run `22_fbref_grades.py`** — 0 fbref-sourced grades in attribute_grades table. Zero-effort data density win.
- [ ] **Apply migration 029** (`pipeline/sql/029_trait_scores.sql`) — player_trait_scores table + availability columns
- [ ] **Run personality rules** — `python 34_personality_rules.py` (fixes ~765 players)
- [ ] **Run personality LLM** — `python 35_personality_llm.py --min-level 85 --limit 50`
- [ ] **Manual personality review** — `/admin/personality` for top 50 players
- [ ] **Scale to 200+ full profiles** — target by end of March (currently ~50). Requires automated generation from external data.

### External Data Replacement (FBRef scraper dead)
FBRef manual ingest (script 11) still works for saved HTML/CSV. But the automated scraper is dead. Multi-source strategy to replace and exceed FBRef coverage:

| Source | Pipeline Script | What it replaces | Status |
|--------|----------------|------------------|--------|
| **API-Football** | `pipeline/XX_api_football_ingest.py` | Season stats: passes, tackles, dribbles, shots, cards, ratings | TODO — build |
| **Fotmob** | `pipeline/XX_fotmob_ingest.py` | xG, defensive actions, passing, match ratings | TODO — build |
| **StatsBomb** (existing) | `pipeline/08_statsbomb_ingest.py` | Event-level data (select comps only) | DONE |
| **Understat** (existing) | `pipeline/09_understat_ingest.py` | xG/xA per match (top 5 leagues) | DONE |

- [ ] **Build API-Football ingest** — register key, build pipeline script, map to `attribute_grades`
- [ ] **Build Fotmob ingest** — unofficial API, build pipeline script, map to `attribute_grades`
- [ ] **Update script 22** — generalize grade computation to accept multi-source season stats (not just FBRef)
- [ ] **Update `player_id_links`** — add `source='api_football'` and `source='fotmob'` matching
- [ ] **Update `SOURCE_PRIORITY`** in frontend API routes — add new sources to priority chain

### Data Freshness (Strategic Priority #2)
- [ ] **News cron** — automated refresh every 2-4h (#53). Sprint item #1. Last automation gap.
- [ ] **Materialized view auto-refresh** — trigger after pipeline scripts

### Product & UX
- [ ] **Fixture Previews Setup** — see steps below
- [ ] **Production deployment to Vercel** — create prod Supabase project, set env vars, first promotion (#32). Blocked until profile count higher.
- [ ] **Create prod Supabase project** — prerequisite for production launch. Needs to happen this week.
- [ ] CS Value formula still produces inflated values (Foden 174m, Rodri 153m) — needs age curve and league weighting review
- [ ] Revisit CSPER personality names: Blade (INSC) and Warrior (AXLC) are placeholders

### Environment Setup
- [ ] **Create `.env.local`** with Supabase credentials — blocks all pipeline script execution in this environment

## Fixture Previews Setup
- [ ] **Run migration** `pipeline/sql/030_fixtures.sql` in Supabase SQL editor
- [ ] **Add API key**: Register at football-data.org, add `FOOTBALL_DATA_API_KEY=xxx` to `.env.local` and Vercel
- [ ] **Ingest fixtures**: `python pipeline/31_fixture_ingest.py --competition PL`
- [ ] **Fixture-based club verification**: Build `38_fixture_club_verify.py` once fixture data populated

## Radar Fingerprints — Expansion
- [ ] Add MiniRadar to shortlist detail page (`/shortlists/[slug]`)
- [ ] Add MiniRadar to club detail page key players section (`/clubs/[id]`)
- [ ] Add MiniRadar to TrendingPlayers component (homepage)
- [ ] Extract fingerprint computation to shared `lib/fingerprint.ts`
- [ ] Player comparison page (`/compare`) — overlay 2-3 fingerprint polygons

## Medium Priority
- [ ] **Comparison tool** — side-by-side player radar + stats (ROADMAP Phase 2)
- [ ] **Formations seed** — populate from research data (#54, sprint item #2)
- [ ] **Product polish** — glass consistency, archetype styling (#55, sprint item #3)
- [ ] **Free agent grader** — ranked shortlists (#26)
- [ ] **Scouting radar** — statistical alert system (#25)
- [ ] **News-driven alerts** on player list (#23)
- [ ] Club stadium capacities — Wikidata P115 qualifier spotty, needs targeted enrichment
- [ ] ~2,600 clubs without wikidata_ids — build bulk SPARQL name matcher
- [ ] Build `pipeline/32_trait_inference.py` — infer traits from FBRef stats for four-pillar
- [ ] Build `pipeline/33_physical_metrics.py` — aggregate FBRef minutes into availability scores
- [ ] Editor pillar tabs — reorganize into Technical/Tactical/Mental/Physical sections
- [ ] Apply migration 024 (network_roles + network_edits tables)
- [ ] Women's players: decide long-term approach
- [ ] 3 manual profiles not found (Tchouameni, Cubarsi, Dembele) — accent mismatches

## Low Priority
- [ ] ~~Connect `supabase-fbref-scraper`~~ — **DEAD**. Replaced by multi-source strategy (see below)
- [ ] Player list pillar spark bars (needs precomputed scores or batch API)
- [ ] Valuation model integration with four-pillar scores (Phase 5)
- [ ] Clean up more duplicate players (accent variants)
- [ ] Run `40_promote_to_prod.py` once prod Supabase project exists
- [ ] Network page (`/network`) — not producing suggestions

## Completed (2026-03-16)
- [x] Gaffer `/choices` crash — parallel category queries, stable fcUserId init, error boundary, loadSquad race guard
- [x] QA sweep merged (PR #80) — security hardening, Tier 1 filtering, design polish
- [x] Role score system — XP milestones, DoF assessments, radar fingerprints
- [x] Deployment fixes — clickable clubs, news entities, formations hidden
- [x] Submodule cleanup — `transfer_availability` removed (separate project)

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
