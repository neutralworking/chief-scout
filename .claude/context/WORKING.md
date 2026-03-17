# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-17

## Current Sprint
1. **Data Density** — Run `22_fbref_grades.py`, scale to 200+ full profiles by end of March — IN PROGRESS
2. **External Data Replacement** — Build API-Football + Fotmob ingest (FBRef scraper dead) — TODO
3. **Radar Fingerprints Expansion** — Role-specific radar axes, MiniRadar on more pages, comparison overlay — IN PROGRESS

## Active Decisions
- External data strategy: API-Football vs Fotmob vs both — needs evaluation
- XP system v2: move to real XP scale (Ballon d'Or=1000) vs keep interim system
- Women's players: decide long-term approach (separate pipeline? same tables?)
- Pipeline script renumbering: scripts 31-37 have duplicate numbers

## Blockers
- FBRef scraper dead — CSV import workaround in place, but need API-Football/Fotmob for automation
- Manual personality review needed for top 50 players (LLM pass done, needs human QA at `/admin/personality`)
- ~2,600 clubs without wikidata_ids — bulk SPARQL matcher needed

## Recent Git Activity
```
c9b9f15 Merge pull request #88 from neutralworking/claude/player-profile-design-updates-bWf8F
1b88b89 Player profile design updates: role name prominence, news headlines, HC theme
272b01e Calibrate role scoring: Kaggle data, alias system, level floors, understat compression
9654c05 Redesign editor: scout-first layout with compound archetype selector
0a6ecbd Update tasks.md: mark session completions, add role-specific radar to backlog
8dfe096 Switch to percentile-based radar fingerprints (pipeline 51)
3691d7d Contrast-boost radar fingerprints for distinctive shapes
d2763ae Rename Blade→Mamba, Warrior→Catalyst; centralise personality definitions
e3ed516 Filter inactive/retired players from Network page
2bde64c Add analytics, SEO, and redesign pricing page
```

## Key Metrics
| Table | Count | Last Updated |
|-------|-------|-------------|
| people | ~4,600 | 2026-03-17 |
| player_profiles | ~4,600 | 2026-03-17 |
| Tier 1 profiles | ~276 | 2026-03-16 |
| attribute_grades | needs check | — |
| clubs | needs check | — |
| news_stories | needs check | — |

## Session #8 Notes
> Context system being built this session. Previous sessions tracked in tasks.md, now migrated to SESSIONS.md.
