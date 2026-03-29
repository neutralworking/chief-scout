# Chief Scout — Project Instructions

## Stack
- **App**: Next.js (Turbopack) in `apps/web/`
- **DB**: Supabase (project ref: `fnvlemkbhohyouhjebwf`, region: EU Frankfurt)
- **Pipeline**: Python scripts in `pipeline/` (run via `make pipeline` or individually)
- **Skills**: `.claude/commands/` (slash commands) + `.claude/skills/` (SKILL.md)
- **UI Components**: shadcn/ui (selective) in `apps/web/src/components/ui/`
- **Design System**: Stitch MCP + `.stitch/DESIGN.md`

## Database Schema
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
- Profile → `player_profiles` (key: `person_id`)
- Status/tags → `player_status` (key: `person_id`)
- Market → `player_market` (key: `person_id`)
- Identity → `people` (key: `id`)

## Environments

| | Staging | Production |
|---|---|---|
| **Supabase** | `fnvlemkbhohyouhjebwf` | Separate prod project |
| **NEXT_PUBLIC_APP_ENV** | `staging` (default) | `production` |
| **Routes** | All | No `/admin`, `/editor`, `/scout-pad`, `/squad` |
| **Data** | All players | **Tier 1 only** — complete profiles |

### Data promotion
Only players with complete people + profiles + personality + market + status + 20+ grades go to prod.
Use `python pipeline/45_promote_to_prod.py --dry-run` to preview.

### Environment variables
- Root `.env.local`: pipeline credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, POSTGRES_DSN, GEMINI_API_KEY, PROD_*)
- `apps/web/.env.local`: Next.js credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, NEXT_PUBLIC_*)

## Security
- Old project (`njulrlyfiamklxptvlun`) has compromised keys in git history — do NOT use
- Never commit `.env.local` files or hardcode credentials
- Service role keys go through backend only, never exposed to client

## Pipeline Scripts
Scripts in `pipeline/` numbered by phase. Each script has `--dry-run` and `--force` flags. Read script headers for details.

| Range | Phase |
|---|---|
| 01-07 | Core data (parse RSG → push to Supabase) |
| 08-12 | External ingest (StatsBomb, Understat, FBRef CSV, news) |
| 13-21 | Enrichment & seeding (stat metrics, Wikidata, clubs, Gaffer) |
| 22-31 | Grade computation (FBRef/Understat/StatsBomb grades, ratings, Transfermarkt) |
| 32-39 | Profiling & inference (tags, personality, blueprints, levels, archetypes) |
| 40-45 | Valuation & production (valuations, CS Value, career XP, prod promote) |
| 50-56 | Kaggle + external bulk (datasets, EAFC reimport) |
| 60-62 | Output (fingerprints, fixtures, free agents) |
| 65-66 | API-Football (ingest + grades) |
| 70-79 | One-off fixes (archive) |
| 90-92 | Scouting notes (LLM), Wikipedia national squads |

## CSS Variables
Use `--color-accent-*` prefix (not `--accent-*`):
- `--color-accent-technical` (gold), `--color-accent-tactical` (purple)
- `--color-accent-mental` (green), `--color-accent-physical` (blue)
- `--color-accent-personality` (yellow)

## Conventions
- Player IDs = `people.id` (same as old `players.id`)
- All feature tables use `person_id` as FK to `people(id)`
- Position enum: GK, WD, CD, DM, CM, WM, AM, WF, CF
- Pursuit status: Pass, Watch, Interested, Scout Further, Monitor, Priority
- Profile tiers: 1 = scout-assessed with archetype, 2 = data-derived, 3 = skeleton
- Key reference: `docs/systems/SACROSANCT.md` — single source of truth for classification systems
- News cron: daily 6am UTC via Vercel. Requires `GEMINI_API_KEY`.

## Multi-Window Workflow
See `docs/MULTI_WINDOW_WORKFLOW.md`. Commit with `[zone]` prefix, never force push.

## Sibling Products
| Product | Repo | Description |
|---|---|---|
| **Kickoff Clash** | `kickoff-clash` | Gacha + Balatro-style card battler |
| **Punter's Pad** | `punters-pad` | Virtual sportsbook |

Data flow: Chief Scout → pipeline export → game repos. Game repos never write back.
