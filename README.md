# Chief Scout

Football scouting intelligence platform. 21,000+ player profiles with archetypes, personality models, tactical blueprints, and multi-source statistical grades — powered by a 90-script data pipeline, Supabase, and a Next.js frontend.

## What It Does

- **Scouting profiles** — Position, archetype, blueprint, four-pillar scores (Technical, Tactical, Mental, Physical), personality (MBTI-based), and scouting notes for every player
- **Multi-source grading** — Attribute grades computed from StatsBomb, Understat, FBRef, API-Football, EA FC, and Kaggle datasets
- **Club intelligence** — 960+ clubs with squad depth, power ratings, and league structure
- **Transfer & valuation** — Market value tiers, scarcity scores, Chief Scout Value, DoF-calibrated valuations
- **News pipeline** — RSS ingestion with Gemini Flash for entity tagging and sentiment analysis
- **Free agents** — Contract expiry tracking with full scouting context
- **Legends** — 195 all-time greats with editorial traits and "Plays Like" comparisons
- **Gaffer** — Manager decision game that builds your footballing identity from vote patterns
- **Kickoff Clash** — Card battler with Balatro-style mechanics using generated characters from real archetypes

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js (Turbopack), TypeScript, Tailwind, shadcn/ui |
| Database | Supabase (Postgres), 55 migrations, normalized schema |
| Pipeline | Python, 90+ numbered scripts |
| External data | StatsBomb, Understat, FBRef, API-Football, Wikidata, Kaggle, Transfermarkt |
| AI | Gemini Flash (news tagging, personality inference, profiling) |
| Design | Stitch MCP prototyping, custom design tokens |

## Project Structure

```
chief-scout/
├── apps/web/                # Next.js frontend
│   └── src/
│       ├── app/             # Pages and API routes
│       ├── components/      # UI components
│       └── lib/             # Supabase client, utilities
│
├── pipeline/                # Data pipeline (01-86, numbered scripts)
│   ├── sql/                 # 55 schema migrations
│   ├── config.py            # Shared env-var loader
│   ├── run_all.py           # Orchestrator (--dry-run, --from, --incremental)
│   └── validation.py        # Data quality checks
│
├── docs/
│   ├── research/rsg.db/     # Obsidian vault (1500+ player notes)
│   ├── design/              # Game design documents
│   ├── formations/          # 100+ formation analyses
│   └── systems/             # Classification systems (SACROSANCT.md)
│
├── imports/                 # CSV data files
├── .claude/                 # Claude Code skills, commands, context
└── .stitch/                 # Design system tokens
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — featured player, news, quick stats |
| `/players` | Searchable player list with filters |
| `/players/[id]` | Full profile — attributes, career, news, radar |
| `/clubs` | A-Z club list with league/country filters |
| `/clubs/[id]` | Club detail — squad depth, archetypes |
| `/leagues` | League browser (top 5 pinned) |
| `/compare` | Head-to-head player comparison |
| `/formations` | Formation pitch visualizer with tactical roles |
| `/tactics` | 10 tactical philosophies + role browser |
| `/legends` | All-time greats with trait pills |
| `/news` | News feed with player tagging |
| `/free-agents` | Contract expiry tracker |
| `/fixtures` | Upcoming matches |
| `/stats` | Statistical breakdowns |
| `/choices` | Gaffer — manager identity game (PWA) |
| `/kickoff-clash` | Card battler |
| `/on-the-plane` | World Cup squad picker |
| `/shortlists` | User shortlists (CRUD) |
| `/squad` | Squad builder |
| `/scout-pad` | Scouting notepad |
| `/editor/[id]` | Player data editor |
| `/admin` | Pipeline dashboard, data health, coverage metrics |
| `/pricing` | Freemium tier plans |

## Database Schema

The old monolithic `players` table has been normalized. A read-only `players` view exists for backward compatibility.

| Table | Purpose |
|-------|---------|
| `people` | Core identity — name, DOB, height, foot, nation, club |
| `player_profiles` | Scouting — position, archetype, blueprint, level, overall |
| `player_status` | Mutable state — fitness, tags, squad role, scouting notes |
| `player_market` | Valuation — market value tier, scarcity, transfer fee |
| `player_personality` | MBTI scores, competitiveness, coachability |
| `attribute_grades` | Per-attribute scores from multiple sources |
| `player_trait_scores` | Behavioral/tactical traits (1-10 severity) |
| `player_career_history` | Full club career with dates and loan flags |
| `career_metrics` | Loyalty/mobility scores, trajectory labels |
| `player_id_links` | Cross-references to external source IDs |
| `news_stories` | Ingested news with Gemini-tagged entities |
| `news_sentiment_agg` | Per-player buzz/sentiment scores |

Plus external data tables for StatsBomb, Understat, FBRef, API-Football, and Kaggle.

## Pipeline

90+ Python scripts run sequentially via `make pipeline` or the orchestrator:

```bash
# Full pipeline
make pipeline

# Orchestrator (smarter: dependency-aware, skip-on-fresh)
make run-all          # Full run
make run-all-dry      # Dry run
make run-grades       # Just grading + ratings + fingerprints
make run-from         # Resume from a specific step
make run-incremental  # Only stale data, skip optional
```

### Script Groups

| Range | Purpose | Examples |
|-------|---------|---------|
| 01-07 | Core data (parse vault → push to Supabase) | `make parse`, `make push` |
| 08-12 | External ingest (StatsBomb, Understat, FBRef, news) | `make statsbomb`, `make news` |
| 13-21 | Enrichment (metrics, Wikidata, clubs, game seeds) | `make wikidata`, `make clubs` |
| 22-31 | Grade computation (FBRef, career, sentiment, ratings) | per-source grading |
| 32-39 | Profiling (tags, squad roles, personality, blueprints) | personality inference |
| 40-45 | Valuation & production (CS Value, XP, prod promotion) | `45_promote_to_prod.py` |
| 50-56 | Kaggle + bulk import | `make kaggle-all` |
| 60-66 | Fingerprints, fixtures, free agents, API-Football | `make transfermarkt` |
| 70-79 | One-off fixes and data cleanup | archive scripts |
| 80-86 | Advanced: KC characters, philosophies, scout insights | late-stage enrichment |

All scripts support `--dry-run`. Most external scripts also accept `--force`.

## Setup

```bash
# 1. Install Python dependencies
make setup

# 2. Copy env templates and fill in credentials
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local

# 3. Run the Next.js dev server
cd apps/web && npm run dev

# 4. Run pipeline (dry-run first)
make run-all-dry
make run-all
```

### Environment Variables

| File | Variables |
|------|-----------|
| `.env.local` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `POSTGRES_DSN`, `GEMINI_API_KEY`, `API_FOOTBALL_KEY` |
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_APP_ENV` |

## Environments

| | Staging | Production |
|---|---------|------------|
| Data | All players (WIP + finished) | Tier 1 only — complete profiles |
| Routes | All routes | No `/admin`, `/editor`, `/scout-pad`, `/squad` |
| Promotion | — | `python pipeline/45_promote_to_prod.py` |

## Sibling Products

| Product | Description |
|---------|-------------|
| **Kickoff Clash** | Gacha packs + Balatro-style card battler with comedic fictional players |
| **Punter's Pad** | Virtual sportsbook — betting on real fixtures with virtual currency |

Both consume Chief Scout data via pipeline exports. Game repos never write back.
