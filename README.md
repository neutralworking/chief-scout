# Chief Scout

A football scouting and management platform. Combines an Obsidian research vault (1500+ player profiles), a data pipeline to Supabase, and game design docs for a Director of Football game.

## Structure

```
chief-scout/
├── pipeline/               # Data pipeline scripts (numbered, sequential)
│   ├── config.py            # Shared env-var loader
│   ├── 01_parse_rsg.py      # Parse vault + CSV into merged player data
│   ├── 02_insert_missing.py # Insert unmatched vault players into DB
│   ├── 03_enrich_nation_pos.py
│   ├── 04_refine_players.py # Archetypes, MVT, positions
│   ├── 05_add_valuation.py  # Scarcity, market premium
│   ├── 06_add_dof_columns.py
│   ├── 07_push_to_supabase.py
│   └── sql/                 # Schema migrations
│
├── apps/
│   └── player-editor/       # Next.js player editing UI (Supabase-backed)
│
├── imports/                 # CSV data files (Real Players Active, clubs, etc.)
│   └── archive/             # One-off/legacy imports
│
├── docs/
│   ├── research/rsg.db/     # Obsidian vault (men/women/club/nation)
│   ├── design/              # Game design documents
│   ├── game-data/           # JSON/CSV game data (tactical styles, attributes)
│   ├── formations/          # 100+ formation analyses
│   └── transfers/           # Transfer market research
│
├── transfer_availability/   # Git submodule: player archetype + transfer model
└── archive/                 # Stale files kept for reference
```

## Setup

```bash
# 1. Copy env template and fill in credentials
cp .env.example .env

# 2. Install Python dependencies
make setup

# 3. Run the full pipeline (or dry-run first)
make dry-run
make pipeline
```

## Pipeline

The pipeline runs 7 scripts sequentially. Each can also be run individually:

```bash
make parse       # 01 — Parse vault + CSV
make insert      # 02 — Insert missing players
make enrich      # 03 — Fill nation/position gaps
make refine      # 04 — Archetypes + MVT
make valuation   # 05 — Scarcity + market premium
make dof         # 06 — Director of Football columns
make push        # 07 — Push to Supabase
```

All scripts support `--dry-run` for safe preview.

## Related Repos

- **transfer_availability** (submodule) — Player archetype + transfer decision model
- **supabase-fbref-scraper** — FBRef data source
