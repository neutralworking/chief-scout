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
- **API**: `GET /api/players/[id]`, `GET /api/players/[id]/radar`, `GET /api/players/[id]/tags`, `GET /api/players/[id]/news`
- **DB**: `people`, `player_profiles`, `player_status`, `player_market`, `player_personality`, `attribute_grades`, `key_moments`

## Player Browse / Search
- **Page**: `apps/web/src/app/players/page.tsx`
- **Components**: `PlayerCard.tsx`, `PlayerFilters.tsx`
- **API**: `GET /api/players/all`
- **DB**: `player_intelligence_card` view

## Player Editor
- **Pages**: `apps/web/src/app/editor/page.tsx` (search), `editor/[id]/page.tsx` (edit form)
- **API**: `PUT /api/players/[id]`, `POST /api/players/[id]/tags`, `POST /api/admin/attribute-update`
- **DB**: All feature tables (people, profiles, status, market, personality, tags)

## Squad
- **Page**: `apps/web/src/app/squad/page.tsx`
- **API**: `GET /api/squad`, `GET /api/club/needs`, `POST /api/club/needs/infer`
- **DB**: `clubs`, `player_profiles`, `player_status`, `club_needs`
- **Pipeline**: `30_squad_roles.py`
- **SQL**: `club_needs.sql`, `squad_additions.sql`

## Formations
- **Page**: `apps/web/src/app/formations/page.tsx`
- **Components**: `FormationDetail.tsx`
- **DB**: `formations`, `formation_slots`, `tactical_roles`
- **Pipeline**: `25_formation_slots.py`
- **SQL**: `011_formation_slots.sql`, `018_tactical_roles.sql`, `formations_insert.sql`

## Football Choices / All-Time XI
- **Page**: `apps/web/src/app/choices/page.tsx`
- **Components**: `ChoicesGame.tsx`, `ChoicesShell.tsx`, `AllTimeXI.tsx`, `CompoundMetrics.tsx`
- **API**: `GET /api/choices/categories`, `GET /api/choices`, `POST /api/choices/vote`, `GET /api/choices/squad`, `GET /api/choices/user`
- **DB**: `fc_categories`, `fc_candidates`, `fc_votes`, `fc_user_squad`, `fc_user_identity`
- **Pipeline**: `20_seed_choices.py`, `21_seed_alltime_xi.py`
- **SQL**: `015_football_choices.sql`, `016_alltime_xi.sql`

## Player Radar
- **Components**: `PlayerRadar.tsx`, `RadarChart.tsx`, `FeaturedRadar.tsx`
- **API**: `GET /api/players/[id]/radar`
- **DB**: `attribute_grades`
- **Notes**: SACROSANCT 13 models × 4 attributes = 52 total. Source priority: scout > statsbomb > fbref > understat > eafc_inferred

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
- **API**: `GET /api/admin/pipeline`, `GET /api/admin/health`, `POST /api/admin/match`, `POST /api/admin/fbref-import`, `POST /api/admin/sql`, `GET /api/admin/player-search`, `POST /api/admin/player-update`, `POST /api/admin/attribute-update`
- **Notes**: SQL console, FBRef CSV import, data health, player matching

## Clubs & Leagues
- **Pages**: `apps/web/src/app/clubs/page.tsx`, `clubs/[id]/page.tsx`, `leagues/page.tsx`
- **API**: `GET /api/club`, `GET /api/club/needs`
- **DB**: `clubs`, `nations`, `club_needs`
- **Pipeline**: `16_club_ingest.py`, `17_wikidata_clubs.py`, `18_wikidata_player_clubs.py`, `26_fix_club_assignments.py`
- **SQL**: `013_club_wikidata_columns.sql`

## Rankings
- **API**: `GET /api/rankings`
- **DB**: `player_tags` + `tags` (category = 'award_contention')
- **SQL**: `ballon_dor_tags.sql`

## Tags System
- **API**: `GET /api/tags`, `GET /api/players/[id]/tags`, `POST /api/players/[id]/tags`
- **DB**: `tags` (tag_name, category, is_scout_only), `player_tags` (player_id, tag_id)
- **Pipeline**: `29_scouting_tags.py`
- **Categories**: scouting, style, fitness, mental, tactical, contract, disciplinary, archetype, award_contention

## Key Moments & Career
- **Components**: `CareerAndMoments.tsx`, `KeyMomentsList.tsx`
- **DB**: `key_moments`, `player_career_history`, `career_metrics`
- **Pipeline**: `26_key_moments.py`, `23_career_metrics.py`
- **SQL**: `007_player_intelligence_cards.sql`, `016_career_news_tables.sql`

## Personality System
- **Components**: `PersonalityBadge.tsx`, `PersonalityExplorer.tsx`
- **Lib**: `archetype-themes.ts`
- **DB**: `player_personality` (ei, sn, tf, jp, competitiveness, coachability)

## Auth / Stripe / Profile
- **Pages**: `login/page.tsx`, `profile/page.tsx`, `pricing/page.tsx`
- **Components**: `AuthProvider.tsx`
- **API**: `GET /api/profile`, `POST /api/auth/callback`, `POST /api/auth/merge`, `POST /api/auth/signout`, `GET /api/user/tier`, `POST /api/stripe/checkout`, `POST /api/stripe/webhook`
- **Lib**: `supabase-server.ts`, `supabase-browser.ts`, `supabase-auth-server.ts`, `supabase-middleware.ts`, `stripe.ts`
- **DB**: `fc_users`, `fc_user_squad`, `fc_user_identity`
- **SQL**: `017_auth_profile.sql`

## Kickoff Clash (`/kickoff-clash`)
- **Page**: `apps/web/src/app/kickoff-clash/page.tsx`
- **Layout**: `apps/web/src/app/kickoff-clash/layout.tsx` (scoped CSS vars for game theme)
- **Lib**: `apps/web/src/lib/kickoff-clash/` — scoring.ts, run.ts, chemistry.ts, actions.ts, economy.ts, transform.ts
- **Data**: `apps/web/public/data/kc_characters.json` (500 fictional characters)
- **Notes**: Fully client-side, no Supabase. localStorage persistence. Title screen + run history.

## On The Plane (`/on-the-plane`)
- **Pages**: `apps/web/src/app/on-the-plane/page.tsx` (nations index), `[nationSlug]/page.tsx` (squad builder)
- **API**: `GET /api/on-the-plane/nations`, `GET /api/on-the-plane/nations/[id]/players`, `POST /api/on-the-plane/submit`
- **Lib**: `apps/web/src/lib/ideal-squad.ts` — pool categorization + ideal squad computation
- **DB**: `wc_nations`, `otp_ideal_squads`, `otp_entries`, `otp_nation_stats`
- **Pipeline**: `83_seed_wc_nations.py`
- **SQL**: `042_on_the_plane.sql`

## Legends (`/legends`)
- **Page**: `apps/web/src/app/legends/page.tsx`
- **API**: `GET /api/legends`, `POST /api/admin/trait-update`
- **DB**: `people` (active=false), `player_profiles`, `player_trait_scores`
- **Notes**: Editable skillsets, "Plays Like" comparisons, playing style trait pills

## Compare (`/compare`)
- **Page**: `apps/web/src/app/compare/page.tsx`
- **API**: `GET /api/players/compare`, `GET /api/players/[id]/similar`
- **Notes**: Radar overlay, four-pillar bars, role/personality/market comparison

## Free Agents (`/free-agents`)
- **Page**: `apps/web/src/app/free-agents/page.tsx`
- **API**: `GET /api/free-agents`
- **Notes**: Position-grouped layout, contract intelligence, PlayerCard component

## Layout / Sidebar
- **Layout**: `apps/web/src/app/layout.tsx`, `globals.css`
- **Components**: `Sidebar.tsx`, `MobileBottomNav.tsx`, `ServiceWorker.tsx`, `AuthProvider.tsx`, `Topbar.tsx`, `SectionHeader.tsx`
- **Lib**: `types.ts`, `features.ts`, `club-themes.ts`, `archetype-styles.ts`, `pillar-colors.ts`
- **Nav**: Sidebar (desktop) + MobileBottomNav (5 tabs: Home/Players/Clubs/Compare/More)

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
| 25 | `transfermarkt_ingest.py` | Transfermarkt values |
| 26 | `key_moments.py` | Career + news moments |
| 26 | `fix_club_assignments.py` | Repair club IDs |
| 27 | `player_ratings.py` | Composite overall rating |
| 28 | `statsbomb_grades.py` | StatsBomb → attribute grades |
| 29 | `scouting_tags.py` | Auto-assign scouting tags |
| 30 | `squad_roles.py` | DOF squad role assessment |
