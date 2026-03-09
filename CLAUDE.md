# Chief Scout — Project Instructions

## Stack
- **App**: Next.js (Turbopack) in `apps/player-editor/`
- **DB**: Supabase (project ref: `fnvlemkbhohyouhjebwf`, region: EU Frankfurt)
- **Pipeline**: Python scripts in `pipeline/`
- **Skills**: `/ceo`, `/project-manager`, `/design-manager`, `/qa-manager`, `/supabase`, `/debugger`, etc.

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
- Root `.env.local`: pipeline credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, POSTGRES_DSN)
- `apps/player-editor/.env.local`: Next.js credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, NEXT_PUBLIC_*)
- Both point to the `fnvlemkbhohyouhjebwf` project

## Security
- Old project (`njulrlyfiamklxptvlun`) has compromised keys in git history — do NOT use
- Never commit `.env.local` files or hardcode credentials
- Service role keys go through backend only, never exposed to client

## Pipeline Scripts
Run via `make pipeline` or individually (`make statsbomb`, `make understat`, etc.):
- `01–07` → core player data pipeline (parse → push to Supabase)
- `08_statsbomb_ingest.py` → StatsBomb open data → `sb_competitions/matches/events/lineups`. Flags: `--competition`, `--dry-run`, `--force`
- `09_understat_ingest.py` → Understat xG → `understat_matches/player_match_stats`. Flags: `--league`, `--season`, `--dry-run`, `--force`

**⚠️ Pending**: Run `pipeline/sql/003_news_statsbomb_understat.sql` in Supabase SQL Editor before using scripts 08/09.

## External Data Tables (migration 003 — pending)
| Table | Source | Purpose |
|---|---|---|
| `sb_competitions/matches/events/lineups` | StatsBomb open data | Event-level match data |
| `understat_matches` + `understat_player_match_stats` | Understat | xG/xA/npxG per match |
| `news_stories` + `news_player_tags` | RSS + Gemini Flash | News ingestion + player tagging |

## Conventions
- Player IDs = `people.id` (same as old `players.id`)
- All feature tables use `person_id` as FK to `people(id)`
- Position enum: GK, WD, CD, DM, CM, WM, AM, WF, CF
- Pursuit status: Pass, Watch, Interested, Priority
- Archetype confidence: high, medium, low
