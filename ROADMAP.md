# Chief Scout — Roadmap

## What it is
A football scouting and management platform. The `transfer_availability` submodule models player decision-making. The `docs/research/rsg.db` vault is the knowledge base (1500+ player profiles, club data, formations). The `docs/design/` and `docs/game-data/` folders hold game design docs and data.

## Architecture
```
chief-scout/
├── pipeline/                ← data pipeline (7 numbered scripts)
├── apps/player-editor/      ← Next.js player intelligence UI
├── prototypes/              ← prototype log + tracking (INDEX.md)
├── imports/                 ← CSV data (Real Players Active, clubs)
├── transfer_availability/   ← submodule: player archetype + transfer model
├── docs/
│   ├── research/rsg.db/     ← Obsidian vault: player/club/nation database
│   ├── design/              ← game design documents
│   ├── game-data/           ← tactical styles, attributes, hall of fame
│   ├── formations/          ← formation analysis (100+ formations)
│   └── transfers/           ← transfer market research
└── archive/                 ← stale files kept for reference
```

## Phase 1 — Data Pipeline [DONE]
- [x] Parse rsg.db + Real Players CSV into merged player dataset
- [x] Push to Supabase (players + formations)
- [x] Enrich nation/position from people table + attributes
- [x] Compute archetypes, MVT, scarcity scores
- [x] Add DoF decision columns
- [x] Centralise credentials via `.env` + `config.py`
- [x] Number pipeline scripts, add Makefile automation
- [ ] Connect `supabase-fbref-scraper` output as additional data source

## Phase 2 — Scouting Interface [IN PROGRESS]
- [x] **B1: App shell** — Next.js scaffold, player list with filters, detail page (`prototypes/INDEX.md`)
- [ ] B2: Design token refinement (Inter/JetBrains Mono fonts, spacing)
- [ ] B3: Wire `player_intelligence_card` view end-to-end
- [ ] C1: `<PersonalityBadge>` + `<ArchetypeShape>` hero components
- [ ] E1: Attribute detail drill-down with progressive disclosure
- [ ] Build web dashboard from Dashboard.md spec
- [ ] Scouting radar: statistical alert system (see Scripts.md)
- [ ] Free agent grader: Transfermarkt scraper → ranked shortlists
- [ ] Formation analysis tool: match formations in `docs/formations/` to squad

## Phase 3 — Game Integration
- [ ] Export availability scores to Director of Football game
- [ ] Inbox event generator: scouting reports as game messages
- [ ] Chief Scout role as NPC in DoF game

## Phase 4 — News Layer
- [ ] Create `news_stories` + `news_player_tags` Supabase tables (schema in `docs/design/news-layer.md`)
- [ ] `08_news_ingest.py` — RSS fetch (BBC Sport, Sky Sports, Guardian) → deduplicate → insert
- [ ] Gemini Flash tagging — extract player names + story type from headlines
- [ ] Player name matching — fuzzy match against `players` table
- [ ] Scout Pad integration — News tab on player card
- [ ] Director integration — transfer rumours as inbox events

## Connects to
- `director/` — chief scout provides player data + scouting reports to the game
- `supabase-fbref-scraper/` — data source
- `transfer_availability/` — player decision model
- News Layer — real-world stories feed availability signals + game inbox events
