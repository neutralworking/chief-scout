# Chief Scout — Project Instructions

## Stack
- **App**: Next.js (Turbopack) in `apps/player-editor/`
- **DB**: Supabase (project ref: `fnvlemkbhohyouhjebwf`, region: EU Frankfurt)
- **Pipeline**: Python scripts in `pipeline/`
- **Skills**: Custom commands in `.claude/commands/` (see below)

## Database Schema (normalized 2026-03-09)
The old monolithic `players` table has been split. A **`players` view** exists for backward compatibility (reads only).

| Table | Purpose | Key columns |
|---|---|---|
| `people` | Core identity | name, dob, height_cm, preferred_foot, nation_id, club_id, active, wikidata_id |
| `player_profiles` | Scouting assessment | position, level, peak, overall, archetype, model_id, skillset IDs, blueprint |
| `player_status` | Mutable state | fitness/mental/disciplinary/tactical/contract tags, pursuit_status, scouting_notes, squad_role, loan_status |
| `player_market` | Valuation | market_value_tier, true_mvt, market_premium, scarcity_score, transfer_fee_eur, hg |
| `player_personality` | MBTI + traits | ei/sn/tf/jp scores, competitiveness, coachability |
| `attribute_grades` | Per-attribute scores | player_id, attribute, scout_grade, stat_score |
| `player_tags` | Tag associations | player_id → tags(id) |
| `player_field_sources` | Verified data provenance | player_id, field, value, confirmed |

**Write rules**: Never write to the `players` view. Target the specific table:
- Profile data → `player_profiles` (key: `person_id`)
- Status/tags → `player_status` (key: `person_id`)
- Market data → `player_market` (key: `person_id`)
- Identity data → `people` (key: `id`)

## Environment
- Root `.env.local`: pipeline credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, POSTGRES_DSN, GEMINI_API_KEY)
- `apps/player-editor/.env.local`: Next.js credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, NEXT_PUBLIC_*)
- Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GEMINI_API_KEY, CRON_SECRET
- Both local env files point to the `fnvlemkbhohyouhjebwf` project

## Security
- Old project (`njulrlyfiamklxptvlun`) has compromised keys in git history — do NOT use
- Never commit `.env.local` files or hardcode credentials
- Service role keys go through backend only, never exposed to client

## Pipeline Scripts
Run via `make pipeline` or individually (`make statsbomb`, `make understat`, etc.):
- `01–07` → core player data pipeline (parse → push to Supabase)
- `08_statsbomb_ingest.py` → StatsBomb open data → `sb_competitions/matches/events/lineups`. Flags: `--competition`, `--dry-run`, `--force`
- `09_understat_ingest.py` → Understat xG → `understat_matches/player_match_stats`. Flags: `--league`, `--season`, `--dry-run`, `--force`
- `10_player_matching.py` → Links external player IDs to `people.id` via `player_id_links`. Flags: `--source understat|statsbomb|fbref|all`, `--dry-run`
- `11_fbref_ingest.py` → FBRef season stats → `fbref_players/fbref_player_season_stats`. Flags: `--comp`, `--season`, `--seasons-back`, `--dry-run`, `--force`
- `12_news_ingest.py` → RSS + Gemini Flash → `news_stories/news_player_tags`. Flags: `--source`, `--fetch-only`, `--process-only`, `--limit`, `--dry-run`, `--force`
- `13_stat_metrics.py` → Aggregate StatsBomb events + Understat xG into per-player attribute scores → `attribute_grades`
- `14_seed_profiles.py` → Seed full player profiles (50 curated players with all 6 tables)
- `15_wikidata_enrich.py` → Wikidata SPARQL → backfill DOB/height/foot + cross-link IDs. Flags: `--phase 1|2|3`, `--player`, `--force`, `--batch-size`
- `16_club_ingest.py` → Parse `imports/clubs.csv` → `clubs` + `nations` tables. Flags: `--dry-run`, `--force`, `--parse-only`
- `17_wikidata_clubs.py` → Wikidata SPARQL → enrich clubs with league, stadium, capacity, founded year, logo. Flags: `--dry-run`, `--force`, `--club`, `--limit`, `--batch-sparql`, `--verbose`. Requires migration `013_club_wikidata_columns.sql`.
- `18_wikidata_player_clubs.py` → Batch-update player clubs from Wikidata P54. Improved alias matching + reports missing clubs. Flags: `--dry-run`, `--force`, `--player`, `--league`, `--limit`, `--batch-sparql`, `--verbose`, `--create-missing`.
- `19_wikidata_deep_enrich.py` → Deep Wikidata enrichment: P27 (citizenship), P54 (career history), P413 (position), P18 (image), P2446 (Transfermarkt ID), P19 (birthplace). Flags: `--dry-run`, `--force`, `--player`, `--league`, `--limit`, `--phase identity|career`, `--batch-size`. Requires migration `014_wikidata_deep_enrich.sql`.
- `20_seed_choices.py` → Seed Football Choices game questions and options. Flags: `--dry-run`, `--force`. Requires migration `015_football_choices.sql`.
- `21_seed_alltime_xi.py` → Seed all-time XI data
- `22_fbref_grades.py` → FBRef season stats → `attribute_grades` (source='fbref'). Converts defensive, passing, dribbling, GK stats into 1-20 grades via positional percentiles. Flags: `--season`, `--position attacker|midfielder|defender|gk|all`, `--min-minutes`, `--dry-run`, `--force`.
- `23_career_metrics.py` → Career trajectory metrics from `player_career_history` → `career_metrics`. Computes loyalty/mobility scores (1-20), trajectory labels (rising/peak/declining/journeyman/one-club/newcomer), tenure stats. Flags: `--player`, `--limit`, `--dry-run`, `--force`. Requires migration `016_career_news_tables.sql`.
- `24_news_sentiment.py` → News sentiment aggregation from `news_player_tags` → `news_sentiment_agg`. Computes sentiment/buzz scores (1-20), story type breakdown, 7d/30d trend windows. Flags: `--player`, `--days`, `--limit`, `--dry-run`, `--force`. Requires migration `016_career_news_tables.sql`.
- `25_formation_slots.py` → Populate `formation_slots` with role-assigned slots from `tactical_roles`. Flags: `--dry-run`. Requires migration `018_tactical_roles.sql`.
- `25_transfermarkt_ingest.py` → Fetch Transfermarkt market values → Supabase. Requires migration `015_transfermarkt_market_values.sql`.
- `26_key_moments.py` → Career milestones + news moments → `key_moments`. Flags: `--player`, `--limit`, `--source career|news|all`, `--dry-run`, `--force`.
- `26_fix_club_assignments.py` → Fix/repair club_id assignments on people table
- `27_player_ratings.py` → Composite overall rating from attribute grades → `player_profiles.overall` + compound scores to `attribute_grades` (source='computed'). Flags: `--player`, `--limit`, `--dry-run`, `--force`.
- `27_understat_grades.py` → Understat xG/xA → `attribute_grades` (source='understat')
- `28_statsbomb_grades.py` → StatsBomb event data → `attribute_grades` (source='statsbomb')
- `29_scouting_tags.py` → Auto-assign scouting tags based on player data (attributes, career, news sentiment)
- `30_squad_roles.py` → DOF-level squad role assessment

## External Data Tables (migration 003 — applied)
| Table | Source | Purpose |
|---|---|---|
| `sb_competitions/matches/events/lineups` | StatsBomb open data | Event-level match data |
| `understat_matches` + `understat_player_match_stats` | Understat | xG/xA/npxG per match |
| `news_stories` + `news_player_tags` | RSS + Gemini Flash | News ingestion + player tagging (migration 003 + 005) |
| `fbref_players` + `fbref_player_season_stats` | FBRef | Season stats (35+ cols: xG, passing, defense, possession, GK) (migration 004) |
| `player_id_links` | Script 10 | Maps people.id ↔ external source IDs (understat, statsbomb, fbref) |
| `player_nationalities` | Wikidata P27 | Dual/multiple citizenships per player (migration 014) |
| `player_career_history` | Wikidata P54 | Full club career with dates, loan flags, jersey numbers (migration 014) |
| `fc_users/questions/options/votes` | Football Choices | Tinder-style comparison game + user footballing identity (migration 015) |
| `career_metrics` | Script 23 | Per-player career trajectory: loyalty/mobility scores, tenure stats, trajectory label (migration 016) |
| `news_sentiment_agg` | Script 24 | Per-player news sentiment: buzz/sentiment scores, story types, trend windows (migration 016) |
| `tactical_roles` | Script 13 | Named roles per position with archetype affinity (Regista, Inside Forward, etc.) (migration 018) |

## Custom Skills (Slash Commands)
Available via `/command` in Claude Code sessions. Defined in `.claude/commands/`.

| Command | Role | Use for |
|---|---|---|
| `/ceo` | CEO | Business strategy, commercial decisions, product-market fit |
| `/dof` | Director of Football | Transfer strategy, squad building, player valuation, market timing |
| `/marketing` | Head of Marketing | Brand, content, community, growth, launch strategy |
| `/project-manager` | Project Manager | Task decomposition, sequencing, scope estimation |
| `/design-manager` | Architect | Schema design, migrations, architecture review |
| `/qa-manager` | QA Lead | Data validation, pipeline testing, regression checks |
| `/supabase` | DB Specialist | Queries, mutations, migrations, RLS debugging |
| `/debugger` | Debugger | Error investigation, root cause analysis, fixes |
| `/scout` | Chief Scout | Player assessments, comparisons, searches, data updates |
| `/data-analyst` | Data Analyst | External data source expertise (StatsBomb, Understat, FBRef, Opta, Wikidata), metric interpretation, cross-source validation |
| `/pipeline` | Pipeline Engineer | Run/debug/extend pipeline scripts 01-20 |
| `/prototype-tracker` | Prototype Tracker | Log new prototypes, update status, review progress |
| `/devops` | DevOps Engineer | Secrets management, service access, migrations, CI/CD, health checks |
| `/db-migrate` | Migration Runner | Table cleanup, SQL migrations, before/after size reporting |
| `/git-clean` | Git Housekeeper | Branch cleanup, stale refs, secrets audit, repo hygiene |
| `/categorist` | Categorist | Player classification taxonomy: personality types, archetypes, traits, tags |

**Key reference**: `docs/systems/SACROSANCT.md` — single source of truth for all classification systems.

**Workflow examples**:
- Business: `/ceo` for strategy → `/marketing` for go-to-market → `/project-manager` to break down
- Football: `/dof` for transfer priorities → `/scout` for player data → `/supabase` to query
- Infrastructure: `/devops` to check credentials → `/pipeline` to run scripts → `/supabase` to verify
- Technical: `/project-manager` to plan → `/design-manager` for schema → `/supabase` to implement → `/qa-manager` to validate

## Admin Panel (`/admin`)
Single-page dashboard at `apps/player-editor/src/app/admin/page.tsx`.

- **News Pipeline**: Manual refresh button (triggers `/api/cron/news`)
- **Quick Stats**: Total players, Tier 1 profiles (scout-assessed with archetype), tracked, news counts
- **Data Coverage**: Progress bars for profiles, personality, market, status, wikidata enrichment
- **External Data**: Understat match/player stats
- **Club Coverage**: Nation, league, wikidata, stadium coverage bars

News cron runs daily at 6am UTC via Vercel (`vercel.json`). Requires `GEMINI_API_KEY` in Vercel env vars for Gemini Flash processing phase.

## Football Choices (`/choices`)
PWA-ready comparison game at `apps/player-editor/app/choices/page.tsx`.

- Users pick between 2-5 player options per question
- Builds a "Footballing Identity" profile from vote patterns
- Categories: GOAT Debates, Best in Position, Era Wars, Transfer Picks, Tactical, Clutch, Style, Hypothetical
- Anonymous users via localStorage UUID → `fc_users`
- API routes: `GET /api/choices` (next question), `POST /api/choices/vote`, `GET /api/choices/categories`, `GET /api/choices/user`
- PWA: `manifest.json` + `sw.js` for add-to-home-screen, offline caching
- Seed questions: `python 20_seed_choices.py`

CSV import generates deterministic `fbref_id` as `csv_{comp_id}_{season}_{team_slug}_{name_slug}`. Player matching uses normalized exact name matching (no fuzzy).

## Conventions
- Player IDs = `people.id` (same as old `players.id`)
- All feature tables use `person_id` as FK to `people(id)`
- Position enum: GK, WD, CD, DM, CM, WM, AM, WF, CF
- Pursuit status: Pass, Watch, Interested, Priority
- Archetype confidence: high, medium, low
