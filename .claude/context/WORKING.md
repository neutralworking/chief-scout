# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-19

## Current Sprint
1. **Data Density** — 25/43 AF leagues ingested (12,372 rows), coefficient-scaled grades. Next: finish remaining ~18 leagues, re-run grades+ratings+fingerprints — IN PROGRESS
2. **Four-Pillar QA** — rebuilt with real data, physical pillar 5-component formula. 7 issues found, 5 fix tasks created — QA PASS NEEDED
3. **Scale to 200+ Tier 1** — currently ~50 on prod (276 total but most skeleton). LLM profiling button in admin. Needs automated batch generation — NOT STARTED

## Resume Tasks (next session)
Run these in order to finish the AF league expansion:
```bash
cd pipeline
python3 65_api_football_ingest.py --all-leagues    # skips 25 done, fetches ~18 remaining
python3 67_af_match_and_import.py                  # match new players to people
python3 66_api_football_grades.py                  # regrade with coefficient scaling
python3 27_player_ratings.py --force               # recompute ratings
python3 60_fingerprints.py --force                 # recompute fingerprints
```

## Active Decisions
- XP system v2: move to real XP scale (Ballon d'Or=1000) vs keep interim system
- Women's players: decide long-term approach (separate pipeline? same tables?)
- Four-pillar: precompute scores for player list, or keep as on-demand API?

## Blockers
- FBRef CSV data only has basic columns (goals/assists) — advanced stats need manual paste
- Script 04 (`refine_players.py`) crashes on news sentiment `story_types` field (string not dict)
- Valuation engine (40) and StatsBomb grades (31) timeout in orchestrator

## What Shipped Recently (sessions 12-13)
- CS Value recalibrated against 10 DoF anchors
- Four-pillar assessment rebuilt with real data (not level-anchored)
- Physical pillar: 5-component data-driven formula
- UEFA/FIFA coefficient system (pipeline 70, migration 037)
- API-Football expanded to 43 leagues (25 ingested so far)
- News cron moved to GitHub Actions (6x/day)
- Dual skill sets + MODEL_LABELS taxonomy
- LLM profiling with context-enriched bio mode
- Kickoff Clash: KC flagging, pipeline 80 export, KCCard component, Love2D prototype, itch.io
- /compare tool live (radar overlay, four-pillar, roles, personality, market)
- /players overhaul (flags, league filter, CS value editing)
- Radar: contrast stretch, proxy attributes, scale bug fix, quality filter
- Sidebar regrouped, Legends mobile, Inventor→Inverted Winger

## Key Metrics
| Table | Count | Last Updated |
|-------|-------|-------------|
| people | 21,683+ | 2026-03-19 |
| AF player-season rows | 12,372 | 2026-03-19 |
| AF leagues ingested | 25 / 43 | 2026-03-19 |
| league_coefficients | 53 | 2026-03-19 |
| clubs with uefa_coefficient | 68 | 2026-03-19 |
| nations with fifa_rank | 80 | 2026-03-19 |
| attribute_grades | 414k+ | 2026-03-18 |
| Tier 1 on prod | 276 | 2026-03-16 |

## Infrastructure Notes
- `70_coefficients_ingest.py` — UEFA country/club + FIFA rankings → league_coefficients
- `037_coefficients.sql` — league_coefficients table, uefa columns on clubs, fifa columns on nations
- `player_intelligence_card` view has: `nation_code`, `league_name`, `peak`, `club_id`, `best_role_score`
- News cron: `.github/workflows/news-cron.yml` (6x/day via GitHub Actions)
- `scout` bash command in `~/.bashrc`
- All migrations applied through 037 on staging
