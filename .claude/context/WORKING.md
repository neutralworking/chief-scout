# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-18

## Current Sprint
1. **Data Density** — API-Football live (13,211 grades), FBRef grades still TODO, scale to 200+ profiles by end of March — IN PROGRESS
2. **External Data Replacement** — API-Football DONE, Fotmob SKIPPED. Remaining: extend to secondary leagues, improve matching — IN PROGRESS
3. **Radar Fingerprints Expansion** — Role-specific radar axes done, MiniRadar on 3 more pages remaining — IN PROGRESS

## Active Decisions
- XP system v2: move to real XP scale (Ballon d'Or=1000) vs keep interim system
- Women's players: decide long-term approach (separate pipeline? same tables?)

## Blockers
- FBRef scraper dead — CSV import + API-Football workarounds in place
- Manual personality review needed for top 50 players (LLM pass done, needs human QA at `/admin/personality`)
- ~2,600 clubs without wikidata_ids — bulk SPARQL matcher needed
- Valuation engine (40) and StatsBomb grades (31) timeout in orchestrator — need perf optimization or out-of-band execution

## Next Session
- Plan API-Football data integration into frontend (how grades affect ratings, display, etc.)
- Consider extending API-Football to secondary leagues (Eredivisie, Championship, etc.)

## Key Metrics
| Table | Count | Last Updated |
|-------|-------|-------------|
| people | ~4,600 | 2026-03-17 |
| player_profiles | ~4,600 | 2026-03-17 |
| Tier 1 profiles | ~276 | 2026-03-16 |
| attribute_grades (api_football) | 13,211 | 2026-03-18 |
| api_football_player_stats | 2,642 | 2026-03-18 |
| clubs | needs check | — |

## Session #9 Notes
> API-Football pipeline built end-to-end. Full pipeline run successful (16/18 passed, 2 pre-existing timeouts).
> 4 pipeline bugs fixed (infer_levels, career_xp, dof_valuation, orchestrator .env loading).
> `/next-up` skill created for session-start task prioritisation.
