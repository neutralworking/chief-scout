# Chief Scout — Outstanding Tasks

## High Priority
- [ ] **Apply migration 029** (`pipeline/sql/029_trait_scores.sql`) — player_trait_scores table + availability columns
- [ ] **Run personality rules** — `python 34_personality_rules.py` (fixes ~765 players)
- [ ] **Run personality LLM** — `python 35_personality_llm.py --min-level 85 --limit 50`
- [ ] **Manual personality review** — `/admin/personality` for top 50 players
- [ ] **Fixture Previews Setup** — see steps below
- [ ] CS Value formula still produces inflated values (Foden 174m, Rodri 153m) — needs age curve and league weighting review
- [ ] Gaffer (`/choices`) crashes browser — investigate AllTimeXI component or auth context issue
- [ ] Run `22_fbref_grades.py` — 0 fbref-sourced grades in attribute_grades table
- [ ] Revisit CSPER personality names: Blade (INSC) and Warrior (AXLC) are placeholders

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
- [ ] Club stadium capacities — Wikidata P115 qualifier spotty, needs targeted enrichment
- [ ] ~2,600 clubs without wikidata_ids — build bulk SPARQL name matcher
- [ ] Build `pipeline/32_trait_inference.py` — infer traits from FBRef stats for four-pillar
- [ ] Build `pipeline/33_physical_metrics.py` — aggregate FBRef minutes into availability scores
- [ ] Editor pillar tabs — reorganize into Technical/Tactical/Mental/Physical sections
- [ ] Apply migration 024 (network_roles + network_edits tables)
- [ ] Add materialized view auto-refresh after pipeline scripts
- [ ] Women's players: decide long-term approach
- [ ] 3 manual profiles not found (Tchouameni, Cubarsi, Dembele) — accent mismatches

## Low Priority
- [ ] Player list pillar spark bars (needs precomputed scores or batch API)
- [ ] Valuation model integration with four-pillar scores (Phase 5)
- [ ] Clean up more duplicate players (accent variants)
- [ ] Run `40_promote_to_prod.py` once prod Supabase project exists
- [ ] Network page (`/network`) — not producing suggestions

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
