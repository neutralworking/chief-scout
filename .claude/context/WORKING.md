# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-25

## Current Sprint
1. **Kickoff Clash Launch** — COMPLETE. 500 characters, hosted at /kickoff-clash, persistence, card detail.
2. **On The Plane** — IN PROGRESS. 48 nations seeded, squad picker UI, needs ideal squad pipeline.
3. **Wave 1 UI Redesign** — IN PROGRESS (parallel agent). Dashboard, players, detail pages shipped.

## Resume Tasks (next session)
- Verify OTP React #310 fix is deployed and working on Vercel
- Build ideal squad computation pipeline for OTP (populates `otp_ideal_squads`)
- Remove OTP error boundary once confirmed stable
- KC standalone app has felt green/amber theme — decide whether to sync to web route
- Recent Transfers feature — plan in `docs/plans/recent-transfers.md`, branch preserved
- Scouting notes gap — top 250 LLM profiling

## Active Decisions
- KC game lives in TWO places: `apps/kickoff-clash/` (standalone) and `apps/web/src/lib/kickoff-clash/` (hosted route). Standalone has newer theme.
- OTP has error boundary wrapper — temporary for debugging, remove when stable
- `feat/wave1-ui` branch exists with design changes — some leaked to main without components (SectionHeader/GradeBadge stubs created)
- Pulse (1,037) and Outlet (1,041) still the largest archetypes

## Blockers
- OTP submit flow blocked on ideal squad computation (no pipeline yet)
- ~8,000 players lack AF data — archetype system can't classify without stats

## What Shipped (session 22, 2026-03-25)

### Kickoff Clash Launch
- Data bridge: transform.ts maps 500 kc_characters.json → Card[] (position, archetype, personality, rarity, durability)
- Card detail popup with bio, quirk, tags, strengths/weaknesses via InspectCardContext
- Title screen with Continue Run / New Run + run history (localStorage)
- Hosted at /kickoff-clash on Chief Scout Vercel with scoped layout + CSS vars
- QA: durability weights, secondary archetypes, z-index, mobile overlap, empty quirk

### On The Plane — WC Squad Picker
- Migration 042: wc_nations, otp_ideal_squads, otp_entries, otp_nation_stats
- 48 WC 2026 nations seeded via pipeline 83
- Squad picker UI: split layout (pitch diagram + additions list + player pool)
- API fixes: exact count queries, player_intelligence_card, pagination for 1473 England players
- React #310 fix: spread before .sort() on useMemo array (React 19 freezes memo values)

### Build fixes
- SectionHeader + GradeBadge stub components (missing from partial wave1-ui merge)
- CSS: --bg-base → --color-bg-base in KC globals + layout

## Key Metrics
| Table | Count | Last Updated |
|-------|-------|-------------|
| people | 21,683+ | 2026-03-19 |
| wc_nations | 48 | 2026-03-25 |
| AF grades | 110,047 | 2026-03-21 |
| earned_archetype assigned | 8,181 | 2026-03-21 |
| player_valuations | 16,813 | 2026-03-22 |
| editorial traits seeded | 152 (65 legends) | 2026-03-22 |
| KC characters (JSON) | 500 | 2026-03-25 |

## Infrastructure Notes
- `assessments-cron.yml` — daily 3:30am UTC, computes all pillar scores
- `MODEL_LABELS` in `apps/web/src/lib/models.ts` — mirrors `pipeline/lib/models.py`
- `TRAIT_DEFINITIONS` in `trait-role-impact.ts` — canonical trait registry (30 traits total)
- `POST /api/admin/trait-update` — editorial trait add/remove with ALLOWED_TRAITS validation
