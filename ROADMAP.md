# Chief Scout — Roadmap

## What it is
A football scouting and management platform. The `transfer_availability` submodule models player decision-making. The `docs/research/rsg.db` is the knowledge base (1500+ player profiles, club data, formations). The `inbox/` is the game data layer.

## Architecture
```
chief-scout/
├── transfer_availability/   ← submodule: player archetype + transfer model (CLI)
├── docs/
│   ├── research/rsg.db/     ← Obsidian vault: player/club/nation database
│   ├── formations/          ← formation analysis (100+ formations)
│   ├── scouting/            ← match reports, player scouting, Kicker rankings
│   ├── transfers/           ← transfer market research, valuation models
│   └── Imports/             ← CSV data for real players/clubs
└── inbox/                   ← game inbox events
```

## Phase 1 — Data Pipeline (Now)
- [ ] Connect `supabase-fbref-scraper` output → chief-scout data format
- [ ] Merge `rsg.db` player profiles with `transfer_availability` archetypes
- [ ] Define canonical player data schema shared by all projects

## Phase 2 — Scouting Interface
- [ ] Build web dashboard from Dashboard.md spec
- [ ] Scouting radar: statistical alert system (see Scripts.md)
- [ ] Free agent grader: Transfermarkt scraper → ranked shortlists
- [ ] Formation analysis tool: match formations in `docs/formations/` to squad

## Phase 3 — Game Integration
- [ ] Export availability scores → Director of Football game
- [ ] Inbox event generator: scouting reports as game messages
- [ ] Chief Scout role as NPC in DoF game

## Connects to
- `director/` — chief scout provides player data + scouting reports to the game
- `supabase-fbref-scraper/` — data source
- `transfer_availability/` — player decision model
