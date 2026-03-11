# Chief Scout

A football scouting and player data platform. Combines an Obsidian research vault (1500+ player profiles), a 15-script data pipeline to Supabase, external data integrations (StatsBomb, Understat, FBRef, Wikidata, news RSS), and a Next.js player editor with admin panel.

## Structure

```
chief-scout/
├── pipeline/                  # Data pipeline scripts (numbered, sequential)
│   ├── config.py               # Shared env-var loader (POSTGRES_DSN, API keys)
│   ├── 01_parse_rsg.py         # Parse vault + CSV into merged player data
│   ├── 02_insert_missing.py    # Insert unmatched vault players into DB
│   ├── 03_enrich_nation_pos.py # Fill nation/position gaps
│   ├── 04_refine_players.py    # Archetypes, MVT, positions
│   ├── 05_add_valuation.py     # Scarcity, market premium
│   ├── 06_add_dof_columns.py   # Director of Football columns
│   ├── 07_push_to_supabase.py  # Push core data to Supabase
│   ├── 08_statsbomb_ingest.py  # StatsBomb open data → events/lineups
│   ├── 09_understat_ingest.py  # Understat xG → match stats
│   ├── 10_player_matching.py   # Link external player IDs to people.id
│   ├── 11_fbref_ingest.py      # FBRef season stats (35+ cols)
│   ├── 12_news_ingest.py       # RSS feeds + Gemini Flash → news tagging
│   ├── 13_stat_metrics.py      # Computed stat metrics
│   ├── 15_wikidata_enrich.py   # Wikidata SPARQL → backfill + cross-link IDs
│   └── sql/                    # Schema migrations
│
├── apps/
│   └── player-editor/          # Next.js player editing UI (Supabase-backed)
│       └── app/admin/          # Admin panel: import, pipeline status, data health
│
├── imports/                    # CSV data files (Real Players Active, clubs, etc.)
│   └── archive/                # One-off/legacy imports
│
├── docs/
│   ├── research/rsg.db/        # Obsidian vault (men/women/club/nation)
│   ├── design/                 # Game design documents
│   ├── game-data/              # JSON/CSV game data (tactical styles, attributes)
│   ├── formations/             # 100+ formation analyses
│   └── transfers/              # Transfer market research
│
├── transfer_availability/      # Git submodule: player archetype + transfer model
└── archive/                    # Stale files kept for reference
```

## Setup

```bash
# 1. Copy env template and fill in credentials
cp .env.example .env.local

# 2. Install Python dependencies
make setup

# 3. Run the full pipeline (or dry-run first)
make dry-run
make pipeline
```

### Environment variables

- **Root `.env.local`**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `POSTGRES_DSN`, `GEMINI_API_KEY`
- **`apps/player-editor/.env.local`**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus backend keys

## Pipeline

The full pipeline runs 15 scripts sequentially via `make pipeline`. Each can also be run individually:

```bash
# Core player data (01-07)
make parse         # 01 — Parse vault + CSV
make insert        # 02 — Insert missing players
make enrich        # 03 — Fill nation/position gaps
make refine        # 04 — Archetypes + MVT
make valuation     # 05 — Scarcity + market premium
make dof           # 06 — Director of Football columns
make push          # 07 — Push to Supabase

# External data (08-15)
make statsbomb     # 08 — StatsBomb open data ingest
make understat     # 09 — Understat xG ingest
make match         # 10 — Cross-link external player IDs
make fbref         # 11 — FBRef season stats ingest
make news          # 12 — RSS + Gemini Flash news tagging
make metrics       # 13 — Stat metrics computation
make wikidata      # 15 — Wikidata enrichment + ID cross-linking
```

All scripts support `--dry-run` for safe preview. Most external data scripts also support `--force` to re-process existing data.

### Key flags by script

| Script | Extra flags |
|--------|-------------|
| `08_statsbomb_ingest` | `--competition`, `--force` |
| `09_understat_ingest` | `--league`, `--season`, `--force` |
| `10_player_matching` | `--source understat\|statsbomb\|fbref\|all`, `--auto-add` |
| `11_fbref_ingest` | `--comp`, `--season`, `--seasons-back`, `--force` |
| `12_news_ingest` | `--source`, `--fetch-only`, `--process-only`, `--limit`, `--force` |
| `15_wikidata_enrich` | `--phase 1\|2\|3`, `--player ID`, `--force`, `--batch-size` |

## Database

Supabase (Postgres). The old monolithic `players` table has been split into normalized tables:

| Table | Purpose |
|-------|---------|
| `people` | Core identity (name, DOB, height, foot, nation, club, wikidata_id) |
| `player_profiles` | Scouting assessment (position, level, archetype, blueprint) |
| `player_status` | Mutable state (fitness, pursuit status, squad role) |
| `player_market` | Valuation (market value tier, transfer fee, scarcity) |
| `player_personality` | MBTI + traits |
| `attribute_grades` | Per-attribute scout grades |
| `player_id_links` | Maps people.id ↔ external IDs (understat, statsbomb, fbref, transfermarkt, soccerway) |

External data lives in separate tables: `sb_competitions`, `sb_matches`, `sb_events`, `sb_lineups`, `understat_matches`, `understat_player_match_stats`, `fbref_players`, `fbref_player_season_stats`, `news_stories`, `news_player_tags`.

## Admin Panel

Available at `/admin` in the Next.js app:

- **Import** — Upload FBRef CSV exports, parsed client-side, upserted to Supabase
- **Pipeline** — Table row counts, sync timestamps, freshness indicators
- **Data Health** — Coverage metrics + trigger player matching

## Related Repos

- **transfer_availability** (submodule) — Player archetype + transfer decision model
- **supabase-fbref-scraper** — FBRef data source
