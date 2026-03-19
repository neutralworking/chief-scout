# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-19

## Current Sprint
1. **Data Density** — 25 leagues ingested (12,372 AF rows), coefficient-scaled grades. Next: finish remaining ~18 leagues, re-run grades+ratings+fingerprints — IN PROGRESS
2. **News Automation** — GitHub Actions cron (6x/day) deployed, CRON_SECRET set. Vercel crons reduced to 1 (within Hobby limit) — DONE
3. **Players Page** — Flags fixed, league filter added, CS value editable, peak/xG removed, text bigger — DONE

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

## Blockers
- FBRef CSV data only has basic columns (goals/assists) — advanced stats need manual paste
- Script 04 (`refine_players.py`) crashes on news sentiment `story_types` field (string not dict) — may already be fixed
- Valuation engine (40) and StatsBomb grades (31) timeout in orchestrator

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

## New This Session (#12)
- `70_coefficients_ingest.py` — UEFA country/club + FIFA rankings → league_coefficients table + clubs + nations
- `037_coefficients.sql` — league_coefficients table, uefa columns on clubs, fifa columns on nations
- `player_intelligence_card` view updated with `nation_code` + `league_name`
- News cron: `.github/workflows/news-cron.yml` (6x/day via GitHub Actions)
- `scout` bash command added to `~/.bashrc`
- Settings hook format fixed (matcher + hooks array)
- Settings.local.json cleaned (164 → 43 permissions)

## Session #12 Notes
> Expanded AF from 10 to 25 leagues (remaining 18 still fetching when session ended). Built UEFA/FIFA coefficient system for league-strength grade scaling. Moved news cron to GitHub Actions. Overhauled /players page (flags, league filter, CS value edit, text size, removed peak+xG columns). Fixed SessionStart hook format. Created `scout` CLI launcher.
