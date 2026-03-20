# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-21

## Current Sprint
1. **Data Density** — DONE. 119k grades, 9,471 players graded, 8,723 fingerprints
2. **Four-Pillar QA** — DONE. All 5 issues fixed. Pillar scores precomputed for 15k players.
3. **Scale to 200+ Tier 1** — NOT STARTED. LLM profiling button in admin. Needs automated batch generation.

## Resume Tasks (next session)
- Valuation integration: feed four-pillar scores into valuation engine
- SEO: per-player OG images, JSON-LD structured data
- MiniRadar expansion: shortlist detail, club detail, trending players

## Active Decisions
- Women's players: decide long-term approach (separate pipeline? same tables?)

## Blockers
- Valuation engine (40) and StatsBomb grades (31) timeout in orchestrator
- FBRef CSV data only has basic columns — advanced stats need manual HTML paste

## What Shipped (session 17, 2026-03-20/21)
- Mobile bottom nav: top pills → bottom tab bar (Home/Players/Admin/More) + grouped sheet
- Precomputed four-pillar scores: cron endpoint + daily GitHub Actions (15k players, 57s)
- Migration 039 applied (tactical_score, mental_score, overall_pillar_score, pillar_updated_at)
- player_intelligence_card view updated with all pillar + earned archetype columns
- Compact PlayerCard: 7-row → 3-row with flags, inline pillar scores, value
- Free agents mobile cards switched to shared PlayerCard component
- Featured player: active-only filter + LLM-quality bio gate (80+ chars)
- FourPillarDashboard: stored best_role preferred over live-computed
- Nation flags on player detail page
- KC link fix (/kc-preview), Gaffer confirmed working
- Tasks.md fully audited (16+ stale items cleared)
- 292 tests passing (13 new for MobileBottomNav)

## Key Metrics
| Table | Count | Last Updated |
|-------|-------|-------------|
| people | 21,683+ | 2026-03-19 |
| attribute_grades | 500k+ | 2026-03-19 |
| players with pillar scores | 15,057 | 2026-03-21 |
| Tier 1 on prod | 276 | 2026-03-16 |
| Tests passing | 292 | 2026-03-21 |

## Infrastructure Notes
- `assessments-cron.yml` — daily 3:30am UTC, computes all pillar scores
- `MobileBottomNav.tsx` replaces `MobileTopNav.tsx` (bottom tab bar)
- `lib/pillar-colors.ts` — centralised pillar color definitions
- Pillar color scheme: technical=gold, tactical=purple, mental=green, physical=blue
