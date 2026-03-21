# Chief Scout — Project Instructions

## Stack
- **App**: Next.js (Turbopack) in `apps/web/`
- **DB**: Supabase (project ref: `fnvlemkbhohyouhjebwf`, region: EU Frankfurt)
- **Pipeline**: Python scripts in `pipeline/`
- **Skills**: Custom commands in `.claude/commands/` + SKILL.md skills in `.claude/skills/` (see below)
- **UI Components**: shadcn/ui (selective) in `apps/web/src/components/ui/` — Dialog, DropdownMenu, Select, Tooltip
- **Design System**: Stitch MCP + `.stitch/DESIGN.md` for UI prototyping

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
| `player_trait_scores` | Behavioral/tactical traits | player_id, trait, category, severity (1-10), source |

**Write rules**: Never write to the `players` view. Target the specific table:
- Profile data → `player_profiles` (key: `person_id`)
- Status/tags → `player_status` (key: `person_id`)
- Market data → `player_market` (key: `person_id`)
- Identity data → `people` (key: `id`)

## Environments (Staging / Production)

| | Staging | Production |
|---|---|---|
| **Purpose** | Internal tools, data entry, pipeline work | Public-facing product + marketing |
| **Supabase** | `fnvlemkbhohyouhjebwf` (EU Frankfurt) | Separate prod project (TBD) |
| **Vercel** | Preview/staging deployment | Production deployment |
| **NEXT_PUBLIC_APP_ENV** | `staging` (default) | `production` |
| **Routes** | All routes available | No `/admin`, `/editor`, `/scout-pad`, `/squad` |
| **Data** | All players (WIP + finished) | **Tier 1 only** — complete profiles |

### Data promotion rule
Only players with ALL of these populated go to prod:
- `people`: name, DOB, height, foot, nation, club
- `player_profiles`: position, archetype, blueprint, level, overall
- `player_personality`: MBTI scores + competitiveness + coachability
- `player_market`: market_value_tier, true_mvt, scarcity_score
- `player_status`: scouting_notes (pursuit_status optional)
- `attribute_grades`: 20+ grades

Use `python pipeline/45_promote_to_prod.py --dry-run` to preview, then run without `--dry-run` to push.

### Environment variables
- Root `.env.local`: pipeline credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, POSTGRES_DSN, GEMINI_API_KEY, PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_KEY)
- `apps/web/.env.local`: Next.js credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, NEXT_PUBLIC_*, NEXT_PUBLIC_APP_ENV)
- Vercel staging: SUPABASE_URL, SUPABASE_SERVICE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GEMINI_API_KEY, CRON_SECRET
- Vercel prod: Same as staging but pointing to prod Supabase + `NEXT_PUBLIC_APP_ENV=production`

## Security
- Old project (`njulrlyfiamklxptvlun`) has compromised keys in git history — do NOT use
- Never commit `.env.local` files or hardcode credentials
- Service role keys go through backend only, never exposed to client

## Pipeline Scripts
Run via `make pipeline` or individually (`make statsbomb`, `make understat`, etc.):

### 01-07: Core data (parse → push)
- `01_parse_rsg.py` → Parse RSG.db Obsidian vault → Supabase
- `02_insert_missing.py` → Insert new players
- `03_enrich_nation_pos.py` → Fill nation/position gaps
- `04_refine_players.py` → Archetype scoring + personality inference
- `05_add_valuation.py` → Valuation dimensions
- `06_add_dof_columns.py` → DOF decision columns
- `07_push_to_supabase.py` → Full data push

### 08-12: External ingest
- `08_statsbomb_ingest.py` → StatsBomb open data. Flags: `--competition`, `--dry-run`, `--force`
- `09_understat_ingest.py` → Understat xG. Flags: `--league`, `--season`, `--dry-run`, `--force`
- `10_player_matching.py` → Link external IDs. Flags: `--source understat|statsbomb|fbref|all`, `--dry-run`
- `11_fbref_ingest.py` → FBRef CSV import. Flags: `--comp`, `--season`, `--dry-run`, `--force`
- `12_news_ingest.py` → RSS + Gemini Flash → news. Flags: `--source`, `--fetch-only`, `--process-only`, `--limit`, `--dry-run`

### 13-21: Enrichment & seeding
- `13_stat_metrics.py` → StatsBomb + Understat → attribute_grades
- `14_seed_profiles.py` → Seed curated player profiles
- `15_wikidata_enrich.py` → DOB/height/foot from Wikidata. Flags: `--phase 1|2|3`
- `16_club_ingest.py` → clubs.csv → clubs + nations
- `17_wikidata_clubs.py` → Club enrichment (stadium, capacity, founded)
- `18_wikidata_player_clubs.py` → Player club assignments from Wikidata P54
- `19_wikidata_deep_enrich.py` → Deep enrichment (citizenship, career, image, Transfermarkt ID)
- `20_seed_choices.py` → Gaffer game questions
- `21_seed_alltime_xi.py` → All-time XI data

### 22-31: Grade computation
- `22_fbref_grades.py` → FBRef stats → attribute_grades (source='fbref')
- `23_career_metrics.py` → Career trajectory (loyalty/mobility scores)
- `24_news_sentiment.py` → News sentiment aggregation
- `25_formation_slots.py` → Formation role slots
- `26_key_moments.py` → Career milestones + news moments
- `27_player_ratings.py` → Composite overall + best_role + compound scores
- `28_transfermarkt_ingest.py` → Transfermarkt market values
- `29_fix_club_assignments.py` → Fix club_id assignments
- `30_understat_grades.py` → Understat → attribute_grades (source='understat')
- `31_statsbomb_grades.py` → StatsBomb → attribute_grades (source='statsbomb')

### 32-39: Profiling & inference
- `32_scouting_tags.py` → Auto-assign scouting tags
- `33_squad_roles.py` → DOF squad role assessment
- `34_personality_rules.py` → Rule-based personality corrections
- `35_personality_llm.py` → LLM personality reassessment
- `36_infer_personality.py` → Heuristic personality from attributes
- `37_infer_blueprints.py` → Blueprint from archetype + position
- `38_infer_levels.py` → Infer levels from compound scores
- `39_current_level.py` → Age-decay current level

### 40-45: Valuation & production
- `40_valuation_engine.py` → Transfer valuations
- `41_dof_valuations.py` → DoF-anchored valuations
- `42_dof_calibration.py` → DoF calibration corrections
- `43_cs_value.py` → Chief Scout Value (independent valuation)
- `44_career_xp.py` → Career XP milestones → xp_modifier
- `45_promote_to_prod.py` → Promote Tier 1 to production. Flags: `--dry-run`, `--list`, `--player`, `--force`

### 50-56: Kaggle + external bulk
- `50_kaggle_download.py` → Download Kaggle datasets. Flags: `--dataset 1-5`, `--force`
- `51_kaggle_euro_leagues.py` → European Top Leagues stats
- `52_kaggle_transfer_values.py` → Transfer value intelligence
- `53_kaggle_fifa_historical.py` → FIFA matches 1930-2022
- `54_kaggle_pl_stats.py` → PL 2024-2025 data
- `55_kaggle_injuries.py` → Injuries 2020-2025 → fitness tags + durability traits
- `56_eafc_reimport.py` → EA FC 25 ratings → attribute_grades

### 65-66: API-Football
- `65_api_football_ingest.py` → Fetch player stats from API-Football Pro. Flags: `--league`, `--season`, `--all-leagues`, `--dry-run`, `--force`, `--match-only`
- `66_api_football_grades.py` → API-Football stats → attribute_grades (14 attrs, position-group percentiles). Flags: `--season`, `--min-minutes`, `--dry-run`

### 60-62: Output & delivery
- `60_fingerprints.py` → Role-specific percentile radar fingerprints. Flags: `--pool role|position|global`, `--force`
- `61_fixture_ingest.py` → Fixtures from football-data.org
- `62_populate_free_agents.py` → Contract expiry + free agent tags

### 70-79: One-off fixes (archive)
- `70_wikipedia_style.py` → Style of play tag extraction
- `71_dof_profiles.py` → DoF deep profiling
- `72_gemini_profiles.py` → Gemini-powered profiling
- `73_fix_levels.py` → Level correction heuristics
- `74_manual_profiles.py` → Manual DoF profile application
- `75_data_cleanup.py` → Duplicate merging + mapping fixes
- `76_seed_shortlists.py` → Editorial shortlist seeding
- `77_verify_clubs.py` → Club verification via Wikidata
- `78_club_cleanup.py` → Club dedup + enrichment fix
- `79_data_sanitize.py` → Data sanitation + gap reporting

## External Data Tables (migration 003 — applied)
| Table | Source | Purpose |
|---|---|---|
| `sb_competitions/matches/events/lineups` | StatsBomb open data | Event-level match data |
| `understat_matches` + `understat_player_match_stats` | Understat | xG/xA/npxG per match |
| `news_stories` + `news_player_tags` | RSS + Gemini Flash | News ingestion + player tagging (migration 003 + 005) |
| `fbref_players` + `fbref_player_season_stats` | FBRef | Season stats (35+ cols: xG, passing, defense, possession, GK) (migration 004) |
| `player_id_links` | Script 10 | Maps people.id ↔ external source IDs (understat, statsbomb, fbref, api_football) |
| `player_nationalities` | Wikidata P27 | Dual/multiple citizenships per player (migration 014) |
| `player_career_history` | Wikidata P54 | Full club career with dates, loan flags, jersey numbers (migration 014) |
| `fc_users/questions/options/votes` | Gaffer | Manager decision game + user footballing identity (migration 015) |
| `career_metrics` | Script 23 | Per-player career trajectory: loyalty/mobility scores, tenure stats, trajectory label (migration 016) |
| `news_sentiment_agg` | Script 24 | Per-player news sentiment: buzz/sentiment scores, story types, trend windows (migration 016) |
| `tactical_roles` | Script 13 | Named roles per position with archetype affinity (Regista, Inside Forward, etc.) (migration 018) |
| `kaggle_euro_league_stats` | Kaggle (kaanyorgun) | European top leagues player stats 25-26 season (migration 033) |
| `kaggle_transfer_values` | Kaggle (kanchana1990) | Transfer value intelligence with market values, fees, contracts (migration 033) |
| `kaggle_fifa_matches` + `kaggle_fifa_rankings` | Kaggle (zkskhurram) | FIFA international match results 1930-2022 + rankings (migration 033) |
| `kaggle_pl_stats` | Kaggle (furkanark) | Premier League 2024-2025 player + match stats (migration 033) |
| `kaggle_injuries` | Kaggle (sananmuzaffarov) | European football injuries 2020-2025, feeds fitness tags + durability traits (migration 033) |
| `api_football_players` + `api_football_player_stats` | API-Football Pro | Per-season stats: goals, assists, shots, passes, tackles, duels, dribbles, cards, ratings (migration 034) |

## Custom Skills (Slash Commands)
Available via `/command` in Claude Code sessions. Defined in `.claude/commands/`.

| Command | Role | Use for |
|---|---|---|
| `/ceo` | CEO | Business strategy, commercial decisions, product-market fit |
| `/dof` | Director of Football | Transfer strategy, squad building, player valuation, market timing |
| `/football-historian` | Football Historian | Tactical evolution, formation philosophy, role lineage, player-system fit, historical analysis |
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
Single-page dashboard at `apps/web/src/app/admin/page.tsx`.

- **News Pipeline**: Manual refresh button (triggers `/api/cron/news`)
- **Quick Stats**: Total players, Tier 1 profiles (scout-assessed with archetype), tracked, news counts
- **Data Coverage**: Progress bars for profiles, personality, market, status, wikidata enrichment
- **External Data**: Understat match/player stats
- **Club Coverage**: Nation, league, wikidata, stadium coverage bars

News cron runs daily at 6am UTC via Vercel (`vercel.json`). Requires `GEMINI_API_KEY` in Vercel env vars for Gemini Flash processing phase.

## Gaffer (`/choices`)
Manager decision game at `apps/web/src/app/choices/page.tsx`.

- Users make managerial decisions — bench calls, transfers, pub debates, scouting dilemmas
- Builds a manager identity profile from vote patterns (e.g., "You manage like Wenger — who backs youth")
- Categories: The Dugout, Transfer Window, The Pub, Academy vs Chequebook, Scouting Report, Dressing Room, Press Conference, Dream XI
- Anonymous users via localStorage UUID → `fc_users`
- API routes: `GET /api/choices` (next question), `POST /api/choices/vote`, `GET /api/choices/categories`, `GET /api/choices/user`
- Cross-sells Chief Scout features (free agent list, player profiles, shortlists)
- PWA: `manifest.json` + `sw.js` for add-to-home-screen, offline caching
- Seed questions: `python 20_seed_choices.py`

## Free Agents (`/free-agents`)
Definitive free agent list — players with expiring contracts or available on a free.

- Position-grouped layout (GK → CF) using `PlayerCard` component
- Data sources: `people.contract_expiry_date`, `player_status.contract_tag`
- Cross-sells Gaffer game
- API route: `GET /api/free-agents`

CSV import generates deterministic `fbref_id` as `csv_{comp_id}_{season}_{team_slug}_{name_slug}`. Player matching uses normalized exact name matching (no fuzzy).

## App Pages
| Route | Purpose |
|---|---|
| `/` | Dashboard home |
| `/players` | Player list with search/filters |
| `/players/[id]` | Player detail — profile, attributes, career, news |
| `/editor` | Player search for editing |
| `/editor/[id]` | Full player editor (attributes, profile, tags) |
| `/clubs` | Flat A-Z club list with search + league/country filters. Accepts `?league=` param |
| `/clubs/[id]` | Club detail — squad, position depth, archetypes |
| `/leagues` | League list (top 5 pinned, all A-Z). Links to `/clubs?league=X` |
| `/formations` | Formation browser — pitch visualization, tactical roles, player mapping |
| `/news` | News stories feed |
| `/choices` | Gaffer — manager decision game (PWA) |
| `/free-agents` | Free agent list with full scouting intelligence |
| `/squad` | Squad builder |
| `/scout-pad` | Scout pad |
| `/api/players/[id]/assessment` | Four-pillar assessment scores (Technical, Tactical, Mental, Physical) |
| `/admin` | Pipeline & data health dashboard |

## CSS Variables
Use `--color-accent-*` prefix for accent colors (not `--accent-*`):
- `--color-accent-technical` (gold), `--color-accent-tactical` (purple)
- `--color-accent-mental` (green), `--color-accent-physical` (blue)
- `--color-accent-personality` (yellow)

## Conventions
- Player IDs = `people.id` (same as old `players.id`)
- All feature tables use `person_id` as FK to `people(id)`
- Position enum: GK, WD, CD, DM, CM, WM, AM, WF, CF
- Pursuit status: Pass, Watch, Interested, Scout Further, Monitor, Priority
- Archetype confidence: high, medium, low
- Profile tiers: 1 = scout-assessed with archetype, 2 = data-derived, 3 = skeleton

## Roadmap: Sibling Products

Two separate products are planned, each in their own repo, using Chief Scout as a data source:

| Product | Repo | Description | Status |
|---------|------|-------------|--------|
| **Kickoff Clash** | `kickoff-clash` | Loot bin (gacha packs) + Balatro-style roguelike card battler with comedic fictional players. Builds from CS archetypes (Tiki-Taka, Gegenpressing, Catenaccio, etc.) | Planned |
| **Punter's Pad** | `punters-pad` | Virtual sportsbook — betting on real fixtures with virtual currency | Planned |

**Data flow**: Chief Scout → (pipeline export) → Kickoff Clash + Punter's Pad. Game repos never write back to CS.

**Key design doc**: See `/root/.claude/plans/hidden-giggling-yao.md` for full architecture (schemas, APIs, game mechanics, build order).

**Chief Scout touchpoints**:
- `pipeline/80_export_character_templates.py` — Export player templates for Kickoff Clash character generation
- Fixture data from pipeline 61 feeds Punter's Pad markets
- Shared auth (optional) via Supabase

## Persistent Context System
Three-layer context retention across sessions:
- **Layer 0** (Identity): `CLAUDE.md`, `docs/systems/SACROSANCT.md` — read-only reference
- **Layer 1** (Working): `.claude/context/WORKING.md` — active sprint, blockers, recent activity
- **Layer 2** (Archive): `.claude/context/archive/` — session logs, insights, tools, growth notes

Key commands:
- `/context start` — begin session (load context, set goal)
- `/context save` — end session (archive learnings, update working context)
- `/context status` — review all context layers
- `/context insight {text}` — log a debugging lesson or pattern
- `/context tool {text}` — log a useful query or script discovery
- `/context growth {text}` — log a meta-learning observation
- `/context metrics` — refresh DB row counts in working context

Session hooks auto-load Layer 1 at startup via `.claude/settings.json`. All role commands include guardrails for task segmentation with exit criteria.
