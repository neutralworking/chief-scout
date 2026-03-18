# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-18

## Current Sprint
1. **Data Density** — 21,683 people, 8,591 with overall, 414k grades. Next: extend to level 75-77 Wikidata enrichment, fix script 04 for archetype scaling — IN PROGRESS
2. **External Data Replacement** — API-Football fully operational (36,799 grades, 4,666 matched). Secondary leagues being imported in parallel — IN PROGRESS
3. **Radar Fingerprints Expansion** — Position-specific axes fixed. MiniRadar on 3 more pages remaining — TODO

## Active Decisions
- XP system v2: move to real XP scale (Ballon d'Or=1000) vs keep interim system
- Women's players: decide long-term approach (separate pipeline? same tables?)
- News cron: needs external scheduler (Vercel hobby = 1/day). GitHub Actions? Railway?

## Blockers
- FBRef CSV data only has basic columns (goals/assists) — advanced stats need manual paste from detailed pages
- Script 04 (`refine_players.py`) crashes on news sentiment `story_types` field (string not dict)
- Manual personality review needed for top 50 players at `/admin/personality`
- Valuation engine (40) and StatsBomb grades (31) timeout in orchestrator

## Key Metrics
| Table | Count | Last Updated |
|-------|-------|-------------|
| people | 21,683 | 2026-03-18 |
| player_profiles | 21,683 | 2026-03-18 |
| With position | 11,563 | 2026-03-18 |
| With overall | 8,591 | 2026-03-18 |
| With fingerprint | 8,683 | 2026-03-18 |
| With level | 10,568 | 2026-03-18 |
| With DOB | 15,969 | 2026-03-18 |
| With club_id | 13,140 | 2026-03-18 |
| attribute_grades | 414,243 | 2026-03-18 |
| personality | 18,938 | 2026-03-18 |
| Tier 1 profiles | ~276 | 2026-03-16 |
| clubs | 3,640 | 2026-03-18 |
| news_stories | 1,138 | 2026-03-18 |

## New Pipeline Scripts (session 10)
- `67_af_match_and_import.py` — sync + match + import AF players
- `68_af_infer_positions.py` — position inference from AF stats
- `69_wikidata_quick_enrich.py` — targeted DOB/height/nation/foot from Wikidata

## Session #10 Notes
> Major data density push. Radar axes fixed (position-specific). Club assignments overhauled (multi-source priority). 1,507 new players imported from AF. 201 top players enriched via Wikidata. Contract tags cleaned (211 stale tags removed). User building secondary league AF import in parallel window.
