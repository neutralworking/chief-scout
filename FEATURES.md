# Chief Scout — Feature Index

Quick-reference map of every feature → its key files. Use this instead of searching.

## Dashboard / Home
- **Page**: `apps/web/src/app/page.tsx`
- **Components**: `FeaturedPlayer.tsx`, `TrendingPlayers.tsx`, `PursuitPanel.tsx`, `PersonalityExplorer.tsx`
- **DB**: `player_intelligence_card` view, `news_player_tags`, `player_personality`
- **Notes**: 4-tier featured player selection (DOF Picks → Top Scouted → News Trending → Discovery)

## Player Profiles
- **Page**: `apps/web/src/app/players/[id]/page.tsx`
- **Components**: `CareerAndMoments.tsx`, `KeyMomentsList.tsx`, `PlayerStats.tsx`, `PlayerRadar.tsx`, `PersonalityBadge.tsx`, `ScoutPad.tsx`
- **API**: `GET /api/players/[id]`, `GET /api/players/[id]/radar`, `GET /api/players/[id]/tags`, `GET /api/players/[id]/news`, `GET /api/players/[id]/assessment`, `GET /api/players/[id]/similar`, `GET /api/players/[id]/valuation`, `GET /api/players/[id]/suitability`, `GET /api/players/[id]/shortlists`
- **DB**: `people`, `player_profiles`, `player_status`, `player_market`, `player_personality`, `attribute_grades`, `key_moments`
- **Notes**: No-scroll redesign with tab groups. Per-player SEO with OG images, meta tags, JSON-LD structured data. Transfer comparables widget ("Similar Transfers").

## Player Browse / Search
- **Page**: `apps/web/src/app/players/page.tsx`
- **Components**: `PlayerCard.tsx`, `PlayerFilters.tsx`, `MiniRadar.tsx`
- **API**: `GET /api/players/all`
- **DB**: `player_intelligence_card` view

## Player Editor
- **Pages**: `apps/web/src/app/editor/page.tsx` (search), `editor/[id]/page.tsx` (edit form)
- **API**: `PUT /api/players/[id]`, `POST /api/players/[id]/tags`, `POST /api/admin/attribute-update`
- **DB**: All feature tables (people, profiles, status, market, personality, tags)

## Compare Players
- **Page**: `apps/web/src/app/compare/page.tsx`
- **API**: `GET /api/players/compare?ids=1,2,3`
- **Components**: `RadarChart.tsx`
- **Lib**: `models.ts`, `personality.ts`, `archetype-styles.ts`
- **DB**: `player_intelligence_card`, `attribute_grades`, `player_personality`
- **Notes**: Side-by-side comparison of 2-3 players. Radar overlay, four-pillar stat bars, top roles, personality, market valuation, verdict chips. URL-shareable via `?ids=` param.

## Fixtures & Predictions
- **Pages**: `apps/web/src/app/fixtures/page.tsx` (list), `fixtures/[id]/page.tsx` (match preview)
- **API**: `GET /api/fixtures`, `GET /api/fixtures/[id]/preview`
- **DB**: `fixtures`, `clubs` (formation, tactical_style, offensive_style, defensive_style)
- **Pipeline**: `61_fixture_ingest.py` (football-data.org), `69_fixture_predictions.py`
- **SQL**: `030_fixtures.sql`, `044_fixture_predictions.sql`
- **Notes**: Competition tabs (PL, La Liga, BL, SA, L1, CL, EL, ECL, Championship, Eredivisie, Primeira Liga, WC, Euros). Prediction model shows W/D/L probability bars, predicted scorelines. Match preview links to scout preview with squad analysis.

## Transfers
- **Page**: `apps/web/src/app/transfers/page.tsx`
- **API**: `GET /api/transfers`, `GET /api/transfers/comps/[playerId]`
- **DB**: `transfers`, `transfer_comparables`
- **Pipeline**: `87_wikidata_transfers.py`, `88_seed_transfers.py`, `89_kaggle_to_transfers.py`
- **SQL**: `045_transfers.sql`
- **Notes**: Recent transfer feed with 147 seed + 737 Kaggle transfers. Transfer comparables library for valuation context. CS Value recalibrated against comp-blended data. Transfer comps widget on player detail page.

## Free Agency
- **Page**: `apps/web/src/app/free-agents/page.tsx`
- **Components**: `PlayerCard.tsx`, `MiniRadar.tsx`
- **API**: `GET /api/free-agents`
- **DB**: `people` (contract_expiry_date), `player_status` (contract_tag), `player_intelligence_card` view, `player_profiles`, `api_football_player_stats`
- **Pipeline**: `62_populate_free_agents.py`
- **Notes**: Tabs for Free Agents / 2026 / 2027 / 2028 expiry windows. Position filter pills, sort by rating/age/value. Desktop table with mini radar + mobile card layout. Shows AF rating, goals, assists, age curve physical score.

## Kickoff Clash
- **Pages**: `apps/web/src/app/kickoff-clash/page.tsx`, `kickoff-clash/layout.tsx`
- **Lib**: `lib/kickoff-clash/run.ts`, `scoring.ts`, `economy.ts`, `actions.ts`, `chemistry.ts`, `transform.ts`
- **Pipeline**: `80_export_card_templates.py`, `80_export_character_templates.py`, `81_airtable_kc_ingest.py`, `82_kc_bios.py`
- **SQL**: `036_kickoff_clash.sql`
- **DB**: 500 KC characters derived from real player archetypes
- **Notes**: Roguelike card battler. DB-wired (migration 036 applied), 201 tests. Phases: setup (draft deck) → match (round-by-round) → shop (buy/sell/upgrade). Features: playing styles, chemistry connections, durability system, academy tiers, action cards, substitutions, pack opening, card art, rarity rebalance, manager cards, full XI formations. Custom dark theme. Mobile responsive.

## Legends
- **Page**: `apps/web/src/app/legends/page.tsx`
- **Components**: `EditableCell.tsx`
- **API**: `GET /api/legends`, `GET /api/players/[id]/similar`, `POST /api/admin/player-update`, `POST /api/admin/trait-update`
- **DB**: `people` (active=false), `player_profiles`, `player_trait_scores`
- **Notes**: 195 retired players. Position filter, search, sort by peak/role score/name. Paginated (50/page). 12 editorial traits as color-coded pills (style/tactical/physical/behavioral). "Plays Like" similarity matching to active players via lazy-loaded intersection observer. Admin mode for inline editing of peak rating, archetype (primary/secondary selector), and trait assignment.

## Network (Scout Insights)
- **Page**: `apps/web/src/app/network/page.tsx`
- **Components**: `InsightCard.tsx`
- **API**: `GET /api/insights`
- **Pipeline**: `85_scout_insights.py`
- **SQL**: `038_scout_insights.sql`
- **DB**: Scout-generated player insights with gem scores
- **Notes**: Staging-only. Position + league filters. Gem score summary stats. Admin mode with PIN login for accept/skip review workflow. Paginated with "show more" infinite scroll.

## On The Plane (World Cup Squad Picker)
- **Pages**: `apps/web/src/app/on-the-plane/page.tsx` (nation grid), `on-the-plane/[nationSlug]/page.tsx` (squad picker)
- **API**: `GET /api/on-the-plane/nations`, `GET /api/on-the-plane/nations/[id]`, `POST /api/on-the-plane/submit`
- **SQL**: `042_on_the_plane.sql`
- **DB**: `wc_nations` (confederation, FIFA ranking, group, seed, kit_emoji, slug, strength), user-submitted squads
- **Notes**: Staging-only. Pick 26-man World Cup squad + starting XI per nation. Confederation filter (UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC). Squad strength bars. Community squad count tracking.

## Shortlists
- **Pages**: `apps/web/src/app/shortlists/page.tsx` (browse), `shortlists/[slug]/page.tsx` (detail)
- **API**: `GET /api/shortlists`, `POST /api/shortlists`, `GET /api/shortlists/[slug]`, `DELETE /api/shortlists/[slug]`, `GET /api/players/[id]/shortlists`
- **SQL**: `023_shortlists.sql`
- **DB**: `shortlists`, `shortlist_players`
- **Notes**: Editorial + user-created shortlists. Categories: free-agents, wonderkids, bargains, position, best-xi, league, tactical, watchlist, custom. CRUD for user shortlists (create/delete). Featured editorial shortlists highlighted. Category filter tabs. Auth-aware — anonymous via localStorage UUID, persists across devices when signed in.
- **Pipeline**: `76_seed_shortlists.py`

## Tactics
- **Page**: `apps/web/src/app/tactics/page.tsx` (server component)
- **Components**: `TacticsPage.tsx`
- **Lib**: `tactical-philosophies.ts`
- **DB**: `tactical_philosophies`, `philosophy_formations`, `philosophy_roles`, `formations`, `formation_slots`, `tactical_roles`, `player_intelligence_card`
- **Pipeline**: `25_formation_slots.py`, `31_seed_philosophies.py`, `83_seed_philosophies.py`, `86_stat_roles.py`
- **SQL**: `011_formation_slots.sql`, `018_tactical_roles.sql`, `031_tactical_philosophies.sql`, `043_role_redesign.sql`
- **Notes**: 10 tactical philosophies (Tiki-Taka, Gegenpressing, Catenaccio, etc.) with formation affinity mapping. 36-role taxonomy across 9 positions. Role browser with archetype affinity. Formation → philosophy badges. Tracked player mapping by position.

## League Stats
- **Page**: `apps/web/src/app/stats/page.tsx`
- **API**: `GET /api/stats`
- **DB**: `api_football_player_stats`, `player_id_links`, `people`
- **Notes**: API-Football season stats browser across 38 leagues (Top 5, Europe T2, Europe T3, Americas, Asia/Other). Client-side sort by rating/goals/assists/appearances/minutes/pass%/tackles/interceptions/duels%/dribbles%/cards. Position filter. Sticky header with scroll. Links to player profiles when matched.

## Player Review
- **Page**: `apps/web/src/app/review/page.tsx`
- **API**: `GET /api/admin/personality-queue`, `POST /api/admin/player-update`, `POST /api/admin/bulk-update`
- **DB**: `player_personality`, `player_profiles`, `player_status`, `attribute_grades`, `player_trait_scores`, `career_metrics`
- **Notes**: Personality reassessment queue. Split pane: player list + assessment panel. 4 MBTI dimension sliders (EI/SN/TF/JP) with live type code preview. Competitiveness + coachability sliders. Filters: needs review / reviewed / all. Sort by peak or level. Include/exclude retired toggle. Bulk actions: flag/unflag for Kickoff Clash templates. Shows scouting notes, career trajectory, loyalty score, top attributes, tags as assessment context.

## KC Preview
- **Page**: `apps/web/src/app/kc-preview/page.tsx`
- **Notes**: Redirect to `/kickoff-clash`. Legacy route.

## Squad
- **Page**: `apps/web/src/app/squad/page.tsx`
- **API**: `GET /api/squad`, `GET /api/club/needs`, `POST /api/club/needs/infer`
- **DB**: `clubs`, `player_profiles`, `player_status`, `club_needs`
- **Pipeline**: `33_squad_roles.py`
- **SQL**: `club_needs.sql`, `squad_additions.sql`

## Formations
- **Page**: `apps/web/src/app/formations/page.tsx`
- **Components**: `FormationDetail.tsx`
- **DB**: `formations`, `formation_slots`, `tactical_roles`
- **Pipeline**: `25_formation_slots.py`
- **SQL**: `011_formation_slots.sql`, `018_tactical_roles.sql`, `formations_insert.sql`

## Gaffer (Football Choices / All-Time XI)
- **Page**: `apps/web/src/app/choices/page.tsx`
- **Components**: `ChoicesGame.tsx`, `ChoicesShell.tsx`, `AllTimeXI.tsx`, `CompoundMetrics.tsx`
- **API**: `GET /api/choices/categories`, `GET /api/choices`, `POST /api/choices/vote`, `GET /api/choices/squad`, `GET /api/choices/user`
- **DB**: `fc_categories`, `fc_candidates`, `fc_votes`, `fc_user_squad`, `fc_user_identity`, `fc_crowd_votes`
- **Pipeline**: `20_seed_choices.py`, `21_seed_alltime_xi.py`, `46_crowd_intelligence.py`
- **SQL**: `015_football_choices.sql`, `016_alltime_xi.sql`, `045_gaffer_multipick.sql`, `046_crowd_intelligence.sql`
- **Notes**: 135 questions across 10 categories (The Dugout, Transfer Window, The Pub, Academy vs Chequebook, Scouting Report, Dressing Room, Press Conference, Dream XI, Contract Talks, International Duty). Manager identity reveal from vote patterns. Era bias fix (dated refs updated to 2026 active players). OTP conversion hook. Crowd intelligence feedback loop.

## Scouting Notes v2
- **Pipeline**: `90_scouting_notes.py`
- **SQL**: `048_notes_flagged.sql`
- **DB**: `player_status` (scouting_notes, notes_flagged)
- **API**: `POST /api/admin/flag-notes`, `POST /api/admin/rewrite-notes`
- **Notes**: Multi-perspective intelligence pipeline. Admin panel with "Flag for Rewrite" button and "Top 10 Missing" shortcut. Notes written from scout, analyst, and DoF perspectives.

## Crowd Intelligence (Gaffer)
- **DB**: `fc_crowd_votes`, `fc_crowd_feedback`
- **Pipeline**: `46_crowd_intelligence.py`
- **SQL**: `046_crowd_intelligence.sql`
- **API**: `GET /api/admin/crowd-stats`, `POST /api/admin/reseed-gaffer`
- **Notes**: Dynamic vote storage, community intelligence feedback loop, admin widget for crowd stats.

## Revenue Gating
- **Components**: `PaywallGate.tsx`, `TierGatedSection.tsx`, `PlayerTeaser.tsx`, `UpgradeCTA.tsx`
- **Lib**: `stripe.ts`, `env.ts`
- **API**: `GET /api/user/tier`, `POST /api/stripe/checkout`, `POST /api/stripe/webhook`
- **SQL**: `040_billing_tier.sql`
- **Notes**: Freemium tier system. PaywallGate wraps restricted pages, TierGatedSection for inline gating. Stripe checkout + webhook integration. Needs STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET to function.

## Player Radar
- **Components**: `PlayerRadar.tsx`, `RadarChart.tsx`, `FeaturedRadar.tsx`, `MiniRadar.tsx`
- **API**: `GET /api/players/[id]/radar`
- **DB**: `attribute_grades`
- **Notes**: SACROSANCT 13 models x 4 attributes = 52 total. Source priority: scout > statsbomb > fbref > understat > eafc_inferred

## News / ScoutPad
- **Pages**: `apps/web/src/app/news/page.tsx`, `scout-pad/page.tsx`
- **Components**: `ScoutPad.tsx`
- **API**: `GET /api/news`, `GET /api/players/[id]/news`, `GET /api/cron/news`
- **DB**: `news_stories`, `news_player_tags`
- **Pipeline**: `12_news_ingest.py`, `24_news_sentiment.py`
- **SQL**: `003_news_statsbomb_understat.sql`, `005_news_columns.sql`

## Admin Panel
- **Page**: `apps/web/src/app/admin/page.tsx`
- **Components**: `AdminActions.tsx`
- **API**: `GET /api/admin/pipeline`, `GET /api/admin/health`, `GET /api/admin/pipeline-health`, `GET /api/admin/dashboard`, `GET /api/admin/data-quality`, `GET /api/admin/recent-changes`, `POST /api/admin/match`, `POST /api/admin/fbref-import`, `POST /api/admin/sql`, `GET /api/admin/player-search`, `POST /api/admin/player-update`, `POST /api/admin/attribute-update`, `POST /api/admin/bulk-update`, `GET /api/admin/personality-queue`, `POST /api/admin/trait-update`, `POST /api/admin/refresh-cards`, `POST /api/admin/reseed-gaffer`, `GET /api/admin/attribute-grades`, `POST /api/admin/club-analysis`, `POST /api/admin/valuation`
- **Notes**: SQL console, FBRef CSV import, data health, player matching, attribute grades viewer, club analysis, valuation tools

## Clubs & Leagues
- **Pages**: `apps/web/src/app/clubs/page.tsx`, `clubs/[id]/page.tsx`, `leagues/page.tsx`
- **API**: `GET /api/club`, `GET /api/club/needs`
- **DB**: `clubs`, `nations`, `club_needs`
- **Pipeline**: `16_club_ingest.py`, `17_wikidata_clubs.py`, `18_wikidata_player_clubs.py`, `29_fix_club_assignments.py`, `68_club_ratings.py`
- **SQL**: `013_club_wikidata_columns.sql`, `039_club_ratings.sql`
- **Notes**: Club power ratings (Phase 1 shipped). Club detail shows squad, position depth, archetypes.

## Rankings
- **API**: `GET /api/rankings`
- **DB**: `player_tags` + `tags` (category = 'award_contention')
- **SQL**: `ballon_dor_tags.sql`

## Tags System
- **API**: `GET /api/tags`, `GET /api/players/[id]/tags`, `POST /api/players/[id]/tags`
- **DB**: `tags` (tag_name, category, is_scout_only), `player_tags` (player_id, tag_id)
- **Pipeline**: `32_scouting_tags.py`
- **Categories**: scouting, style, fitness, mental, tactical, contract, disciplinary, archetype, award_contention

## Key Moments & Career
- **Components**: `CareerAndMoments.tsx`, `KeyMomentsList.tsx`
- **DB**: `key_moments`, `player_career_history`, `career_metrics`
- **Pipeline**: `26_key_moments.py`, `23_career_metrics.py`
- **SQL**: `007_player_intelligence_cards.sql`, `016_career_news_tables.sql`

## Personality System
- **Components**: `PersonalityBadge.tsx`, `PersonalityExplorer.tsx`
- **Lib**: `personality.ts`, `archetype-themes.ts`
- **DB**: `player_personality` (ei, sn, tf, jp, competitiveness, coachability, is_inferred, confidence)
- **Pipeline**: `34_personality_rules.py`, `35_personality_llm.py`, `36_infer_personality.py`

## Auth / Stripe / Profile
- **Pages**: `login/page.tsx`, `profile/page.tsx`, `pricing/page.tsx`
- **Components**: `AuthProvider.tsx`
- **API**: `GET /api/profile`, `POST /api/auth/callback`, `POST /api/auth/merge`, `POST /api/auth/signout`, `GET /api/user/tier`, `POST /api/stripe/checkout`, `POST /api/stripe/webhook`
- **Lib**: `supabase-server.ts`, `supabase-browser.ts`, `supabase-auth-server.ts`, `supabase-middleware.ts`, `stripe.ts`
- **DB**: `fc_users`, `fc_user_squad`, `fc_user_identity`
- **SQL**: `017_auth_profile.sql`, `040_billing_tier.sql`
- **Notes**: Freemium tier system with Stripe checkout + webhook integration. PlayerTeaser + UpgradeCTA gating for non-subscribers.

## 36-Role Four-Pillar Taxonomy
- **Lib**: `lib/assessment/four-pillars.ts`, `lib/assessment/trait-role-impact.ts`, `lib/models.ts`
- **Pipeline**: `27_player_ratings.py`, `60_fingerprints.py`, `86_stat_roles.py`
- **SQL**: `043_role_redesign.sql`
- **DB**: `tactical_roles` (36 roles across 9 positions), `player_profiles` (best_role, best_role_score), precomputed pillar scores
- **Notes**: 36 named tactical roles (4 per position). Four pillars: Technical (Dribbler/Passer/Striker/GK), Tactical (Cover/Destroyer/Engine), Mental (Controller/Commander/Creator), Physical (Sprinter/Powerhouse/Target). Each role uses weighted pillar combination.

## Precomputed Four-Pillar Assessment Scores
- **API**: `GET /api/players/[id]/assessment`, `GET /api/cron/assessments`
- **DB**: `pillar_scores` (precomputed), `attribute_grades`
- **SQL**: `039_pillar_scores.sql`, `040_pillar_scores_view.sql`
- **Notes**: Daily cron job recomputes Technical/Tactical/Mental/Physical scores for all rated players. Scores exposed via player detail page and assessment API.

## Career XP System
- **Pipeline**: `44_career_xp.py`
- **SQL**: `031_career_xp.sql`, `037_career_xp_v2.sql`
- **DB**: `career_xp` (milestones, xp_modifier, legacy_score)
- **Notes**: 159 milestone types. BG3-style leveling. Legacy score derived from career achievements. V2 adds more granular milestone categories.

## Club Power Ratings
- **Pipeline**: `68_club_ratings.py`, `70_coefficients_ingest.py`
- **SQL**: `039_club_ratings.sql`, `037_coefficients.sql`
- **DB**: `club_ratings`, `uefa_coefficients`
- **Notes**: Phase 1 shipped. Squad-average rating, depth scores. UEFA coefficient ingestion. Phase 2 (Elo system) planned.

## Earned Archetypes
- **Pipeline**: `37_compute_archetypes.py`
- **SQL**: `038_earned_archetypes.sql`, `041_view_earned_archetype.sql`
- **DB**: `player_profiles` (earned_archetype, archetype_tier)
- **Notes**: Archetypes derived from stats rather than manual assignment. Tiered confidence: gold/silver/bronze.

## Layout / Navigation
- **Layout**: `apps/web/src/app/layout.tsx`, `globals.css`
- **Components**: `Sidebar.tsx`, `ServiceWorker.tsx`, `AuthProvider.tsx`
- **Lib**: `types.ts`, `features.ts`, `club-themes.ts`, `archetype-themes.ts`, `archetype-styles.ts`, `env.ts`
- **Nav categories**:
  - **Scouting**: Dashboard, Players, Network (staging), Stats, Free Agency, Compare, Legends
  - **Browse**: Clubs, Leagues, Tactics, Fixtures, News
  - **Games**: Gaffer, Kickoff Clash (staging), On The Plane (staging)
  - **Admin**: Admin (staging), Editor (staging)
- **Notes**: Production mode hides staging-only routes. Admin PIN login for elevated privileges.

## Design System v2 (Vibrant Data)
- **Fonts**: Clash Display (headings) + Bricolage Grotesque (body)
- **Files**: `globals.css`, `layout.tsx`
- **Notes**: Brand gradient, warm surfaces, 12px radius, card system with `--bg-surface` / `--bg-elevated` / `--bg-base` layers. CSS variables for accent colors: `--color-accent-technical` (gold), `--color-accent-tactical` (purple), `--color-accent-mental` (green), `--color-accent-physical` (blue), `--color-accent-personality` (yellow). 58 files touched in the redesign.

## SEO
- **Files**: `apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`
- **Notes**: Per-player OG images + meta tags + JSON-LD structured data. Dynamic sitemap generation. robots.txt configuration.

## Pipeline Scripts (numbered)
| # | Script | Purpose |
|---|--------|---------|
| 01 | `parse_rsg.py` | Parse RSG CSV |
| 02 | `insert_missing.py` | Backfill missing IDs |
| 03 | `enrich_nation_pos.py` | Nation/position from Wikidata |
| 04 | `refine_players.py` | Data quality, archetype scoring |
| 05 | `add_valuation.py` | Market value tiers |
| 06 | `add_dof_columns.py` | DOF assessment fields |
| 07 | `push_to_supabase.py` | Push to Supabase |
| 08 | `statsbomb_ingest.py` | StatsBomb events |
| 09 | `understat_ingest.py` | Understat xG/xA |
| 10 | `player_matching.py` | Link external IDs |
| 11 | `fbref_ingest.py` | FBRef season stats |
| 12 | `news_ingest.py` | RSS + Gemini tagging |
| 13 | `stat_metrics.py` | Stat-based attribute scores |
| 14 | `seed_profiles.py` | Seed 98 curated players |
| 15 | `wikidata_enrich.py` | Wikidata DOB/height/foot |
| 16 | `club_ingest.py` | Club data |
| 17 | `wikidata_clubs.py` | Club Wikidata enrichment |
| 18 | `wikidata_player_clubs.py` | Player→club linking |
| 19 | `wikidata_deep_enrich.py` | Deep Wikidata (career, image, TM ID) |
| 20 | `seed_choices.py` | Football Choices questions |
| 21 | `seed_alltime_xi.py` | All-Time XI candidates |
| 22 | `fbref_grades.py` | FBRef → attribute grades |
| 23 | `career_metrics.py` | Career trajectory/loyalty |
| 24 | `news_sentiment.py` | News sentiment scores |
| 25 | `formation_slots.py` | Formation slot definitions |
| 26 | `key_moments.py` | Career + news moments |
| 27 | `player_ratings.py` | Composite overall + best_role + compound scores |
| 28 | `transfermarkt_ingest.py` | Transfermarkt values |
| 29 | `fix_club_assignments.py` | Repair club IDs |
| 30 | `understat_grades.py` | Understat → attribute grades |
| 31 | `statsbomb_grades.py` | StatsBomb → attribute grades |
| 31 | `seed_philosophies.py` | Seed tactical philosophies |
| 32 | `scouting_tags.py` | Auto-assign scouting tags |
| 33 | `squad_roles.py` | DOF squad role assessment |
| 34 | `personality_rules.py` | Rule-based personality corrections |
| 35 | `personality_llm.py` | LLM personality reassessment |
| 36 | `infer_personality.py` | Heuristic personality from attributes |
| 36 | `mental_tags.py` | Mental trait tagging |
| 37 | `compute_archetypes.py` | Earned archetype computation |
| 37 | `infer_blueprints.py` | Blueprint from archetype + position |
| 37 | `personality_review.py` | Personality review queue |
| 38 | `infer_levels.py` | Infer levels from compound scores |
| 39 | `current_level.py` | Age-decay current level |
| 40 | `valuation_engine.py` | Transfer valuations |
| 41 | `dof_valuations.py` | DoF-anchored valuations |
| 42 | `dof_calibration.py` | DoF calibration corrections |
| 43 | `cs_value.py` | Chief Scout Value (independent valuation) |
| 44 | `career_xp.py` | Career XP milestones → xp_modifier |
| 45 | `promote_to_prod.py` | Promote Tier 1 to production |
| 50 | `kaggle_download.py` | Download Kaggle datasets |
| 51 | `kaggle_euro_leagues.py` | European Top Leagues stats |
| 52 | `kaggle_transfer_values.py` | Transfer value intelligence |
| 52 | `calibrate_from_edits.py` | Calibrate from manual edits |
| 53 | `kaggle_fifa_historical.py` | FIFA matches 1930-2022 |
| 54 | `kaggle_pl_stats.py` | PL 2024-2025 data |
| 55 | `kaggle_injuries.py` | Injuries 2020-2025 → fitness tags |
| 56 | `eafc_reimport.py` | EA FC 25 ratings → attribute grades |
| 60 | `fingerprints.py` | Role-specific percentile radar fingerprints |
| 61 | `fixture_ingest.py` | Fixtures from football-data.org |
| 62 | `populate_free_agents.py` | Contract expiry + free agent tags |
| 63 | `validate.py` | Data validation |
| 65 | `api_football_ingest.py` | API-Football Pro stats (38 leagues) |
| 66 | `api_football_grades.py` | API-Football → attribute grades |
| 67 | `af_match_and_import.py` | AF match + import (PL cleanup) |
| 68 | `af_infer_positions.py` | Infer CS positions from AF data |
| 68 | `club_ratings.py` | Club power ratings |
| 69 | `fixture_predictions.py` | Fixture score predictions |
| 69 | `wikidata_quick_enrich.py` | Quick Wikidata enrichment |
| 70 | `coefficients_ingest.py` | UEFA coefficient data |
| 70 | `wikipedia_style.py` | Style of play tag extraction |
| 71 | `dof_profiles.py` | DoF deep profiling |
| 72 | `gemini_profiles.py` | Gemini-powered profiling |
| 73 | `fix_levels.py` | Level correction heuristics |
| 74 | `manual_profiles.py` | Manual DoF profile application |
| 75 | `data_cleanup.py` | Duplicate merging + mapping fixes |
| 76 | `seed_shortlists.py` | Editorial shortlist seeding |
| 77 | `verify_clubs.py` | Club verification via Wikidata |
| 78 | `club_cleanup.py` | Club dedup + enrichment fix |
| 79 | `data_sanitize.py` | Data sanitation + gap reporting |
| 80 | `export_card_templates.py` | Export card templates for KC |
| 80 | `export_character_templates.py` | Export player templates for KC |
| 81 | `airtable_kc_ingest.py` | Airtable KC character ingest |
| 82 | `kc_bios.py` | KC character bios |
| 83 | `seed_philosophies.py` | Seed tactical philosophies |
| 83 | `seed_wc_nations.py` | Seed World Cup nations |
| 85 | `scout_insights.py` | Generate scout insights (gems) |
| 86 | `stat_roles.py` | Stat-based role computation |
