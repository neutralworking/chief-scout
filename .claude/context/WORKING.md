# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-25

## Current Sprint
1. **Kickoff Clash Launch** — COMPLETE.
2. **On The Plane** — COMPLETE (41/48 nations playable, 7 thin-pool disabled gracefully).
3. **Wave 1 UI Redesign** — COMPLETE. Wave 2 in flight (parallel agent shipping clubs/leagues/news/free-agents).
4. **Recent Transfers + CS Value** — COMPLETE. 147 seed, comp-blended valuations, /transfers page.

## Resume Tasks (next session)
- Scouting notes gap — top 250 LLM profiling (wait for scout skill update first)
- Expand transfer seed data — 19 unmatched players, find dedicated fee dataset
- Transfer comps widget on player detail page
- Expand trait seeds to peak 88-91 legends (~30 more)
- Add missing tactical_roles (40 names) to increase philosophy-role link coverage
- Expand club_philosophies.csv — Garra Charrua + Cholismo need clubs
- Wave 3 UI — compare, formations, squad builder, gaffer
- Run pipeline 46 (crowd intel) once enough Gaffer votes accumulate

## Active Decisions
- KC game lives in TWO places: `apps/kickoff-clash/` (standalone) and `apps/web/src/lib/kickoff-clash/` (hosted route). Standalone has newer theme.
- Pulse (1,037) and Outlet (1,041) still the largest archetypes
- CS Value Approach B active (comp-count scaled blend). Path to Approach C (calibration curves) once 500+ real fees exist.

## Blockers
- ~8,000 players lack AF data — archetype system can't classify without stats
- Wikidata has NO transfer fee data (P1536 empty) — need Kaggle/manual sources

## What Shipped (session 25, 2026-03-25)

### Gaffer Quality + Crowd Intelligence
- Question quality pass: 6 dated player refs fixed, ACL dilemma rewritten, 2 GOAT dupes rethemed
- control_vs_chaos expanded to 130 occurrences (was ~20)
- 2 new categories (Contract Talks, International Duty) with 10 questions → 135 total
- Crowd intelligence pipeline: migration 046, pipeline 46, dynamic vote storage, admin widget
- Migration 045 (multipick) applied, questions reseeded with --force

### Materialized Intelligence Card
- Migration 047: VIEW → MATERIALIZED VIEW with 7 indexes (27,918 rows)
- pg_trgm extension enabled for name search
- Auto-refresh in pipeline cron, manual "Refresh Cards" button, standalone API endpoint
- All 25 consumers unchanged

### Vercel Deploy Fix
- Hobby plan quota hit from 9 rapid Wave 2/3 pushes — CLI deploy bypassed the issue

## What Shipped (session 24, 2026-03-25)

### Recent Transfers + CS Value Calibration
- Migration 045: transfers table with source/confidence, partial unique indexes, transfer_comparables view
- Pipeline 87 (Wikidata P1536): built but source is empty for footballers
- Pipeline 88 (seed): 147 curated transfers (Summer 2022 – Jan 2026), 128 matched
- Pipeline 89 (Kaggle): 737 career moves, latest-move-only fee estimates, low confidence
- Comparables lib: 7-dimension similarity, confidence weighting, weighted median
- CS Value recalibrated: base curve lifted (L92=€180m), buyer pool softened, comp blend (5+ high-conf, 15-35%)
- 15,980 players revalued. Yamal €268m, Gabriel €102m, Kane ~€82m, Neves €97m
- /transfers page (Wave 2), API route, sidebar link

### OTP Submit Flow — Completed
- Error boundary removed, graceful fallback for 7 thin-pool nations
- Nation stats RPC (042b), unplayable nation cards disabled
- 41/48 nations fully playable with scoring

## What Shipped (session 23, 2026-03-25)

### Tactical Philosophies — Full Feature
- Migration 031 applied: tactical_philosophies, philosophy_formations, philosophy_roles tables
- Pipeline 83 run: 10 philosophies seeded + 51 formation links + 21 role links
- Pipeline 84 created: CSV-driven club assignment, 22 clubs across 8 philosophies
- `/tactics/[slug]` detail page: header+radar, origin story, clubs, best-fit players, formations, roles, fit profile
- `SystemFit` component on player detail: club system fit + top 3 philosophy fits
- Formation badges now link to `/tactics/[slug]`
- Club detail pill links to `/tactics/[slug]`
- Pipeline 83 env fix: `.env.local` path (was bare `load_dotenv()`)
- Build passes clean

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
