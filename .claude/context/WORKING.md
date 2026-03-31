# Working Context — Chief Scout
> Last updated: 2026-03-31 (session 38)

## Current Sprint: Launch Prep
Target: **May 1, 2026** (from CEO assessment PR #113)
OTP Deadline: **April 7, 2026** — WC 2026 playoffs buzz

### Launch Gates
1. ~~**PL data completeness**~~ — needs audit (all 20 PL clubs with full squads, grades, scouting notes)
2. **Prod DB fix** — PROD_POSTGRES_DSN broken ("Tenant or user not found") — needs user decision: fix existing or provision new
3. **Stripe E2E** — test keys in .env.local, but no real products created, billing flow untested
4. ~~**OTP 48 nations**~~ — DONE: 48/48 playable, squads precomputed, women filtered, design overhaul shipped
5. ~~**OTP conversion hook**~~ — DONE: UpgradeCTA on reveal, verified session 32
6. **Stale branch cleanup** — 6 unmerged remote branches remain

### Done (from previous sprint)
1. ~~**Data Density**~~ — 28,636 people in staging
2. ~~**Four-Pillar QA**~~ — precomputed daily via cron
3. ~~**42-Role Taxonomy**~~ — migration 049, pipeline 83+27, 42 system-validated roles (Carrilero added, Inside Forward→Inverted Winger)
4. ~~**Fixture Predictions**~~ — PRs #107-108, migration 044, pipeline 69
5. ~~**Systems & Roles**~~ — 28 systems, 308 slots, AF calibration, GK weight fix
6. ~~**Players filter redesign**~~ — role/archetype/league dropdowns, position-aware (42ea370)
7. ~~**OTP design overhaul**~~ — branded hero, animated reveal, mobile-first (75483be)
8. ~~**Rating calibration**~~ — unified compression, soft blending, Yamal fix (session 36)
9. ~~**EAFC PlayStyles**~~ — 11,024 traits imported, 5,489 inferred, foot/side enrichment (session 35)
10. ~~**AllSportsAPI pipeline**~~ — scripts 67/68, migrations 052-053, cap-tied tracking (session 37)

### Session 38 (2026-03-31 — current)
- **OTP smart XI**: preferred side + role score sort, best role in player list, contextual score column
- **OTP UX**: sticky info bar, role score default, Pogba nationality fix
- **42-role taxonomy**: Carrilero CM added, Inside Forward → Inverted Winger, Complete Forward → earned archetype
- **Raumdeuter** moved from role to archetype

### Session 37 (2026-03-31)
- **AllSportsAPI pipeline**: scripts 67 (squad/stats) + 68 (grade conversion)
- **Migration 052**: `allsportsapi_stats` table
- **Migration 053**: `cap_tied` nationality tracking for dual nationals

### Session 36 (2026-03-31)
- **Rating calibration overhaul**: unified stat compression, soft level blend, normalized role selection
- **AF tackling purge**: 6,733 bad grades removed
- **Trait→grade bridge**: 47,155 grades for 12,521 players
- **96 scout grades** for 11 elite attackers

### Session 35 (2026-03-31)
- **SportMonks API assessed**: free tier = 4 leagues, not worth integrating
- **EAFC PlayStyle pipeline**: 4 new scripts (56b/c/d/e)
- **6,532 preferred_foot** backfills (44%→59% coverage)
- **13,132 ratings** recomputed with enriched data

### Session 34 (2026-03-31)
- **SportsAPIPro integration**: migration 051, pipelines 67/68, 12-player PoC
- **Daily cron**: `sportsapi_refresh.sh` at noon, 30 players/batch

### Session 33 (2026-03-30)
- **Stale data cleanup**: recency decay, 3 dupe fixes, 7 retired marked inactive
- **Archetype tuning**: aspiring 67%→15%, max archetype 2,874→461
- **Mobile nav polish**: swipe-to-dismiss, haptic, backdrop blur

## App Structure
| Route | Purpose | Env |
|-------|---------|-----|
| `/` | Dashboard — FeaturedPlayer, TrendingPlayers | All |
| `/players` | Player list — search, role/archetype/league filters | All |
| `/players/[id]` | Player detail — no-scroll tabs, four-pillar, SEO | All |
| `/compare` | 2-3 player comparison with radar overlay | All |
| `/fixtures` | Fixture previews + predicted scores | All |
| `/transfers` | Recent transfers + comparables | All |
| `/network` | Scout Insights: hidden gems, batch triage | Staging |
| `/clubs` | Club list + power ratings | All |
| `/leagues` | League list (top 5 pinned) | All |
| `/formations` | Formation browser + 42 tactical roles | All |
| `/tactics` | 10 philosophies + role browser | All |
| `/news` | News feed | All |
| `/free-agents` | Free Agency (expiry windows, position tabs) | All |
| `/shortlists` | User + editorial shortlists | All |
| `/choices` | Gaffer (PWA) — 135 questions, 10 categories | All |
| `/kickoff-clash` | KC roguelike card battler (DB-wired) | All |
| `/legends` | 195 legend profiles + trait pills + similar players | All |
| `/on-the-plane` | World Cup squad picker (48 nations) | All |
| `/pricing` | Tier pricing page | All |
| `/admin` | Dashboard, Scout Pad, Editor, Personality, KC Cards, Scout Notes | Staging |

## Active Decisions
- Prod DB: fix existing project or provision new?
- Stripe: create real products + price IDs to unblock billing E2E
- FBRef advanced stats: scrape HTML tables or find better CSV source?

## Blockers
- **Prod DB**: "Tenant or user not found" — needs user action
- **Stripe**: no real products created, can't test billing flow end-to-end
- **6 unmerged remote branches** — need cleanup (`/git-clean`)

## Key Metrics (as of 2026-03-31)
| Metric | Value |
|--------|-------|
| people | 28,636 |
| attribute_grades | 693k+ |
| Players rated | 14,063 |
| Tier 1 profiles | 9,227+ |
| Tests | 16 vitest files |
| Clubs | 961 |
| Legends seeded | 195 |
| KC characters | 500 (DB-wired) |
| Tactical roles | 42 |
| Gaffer questions | 135 (10 categories) |
| Pipeline scripts | 01-93 |
| Migrations | through 053 |
| App pages | 20+ routes |
| UI waves completed | 3/3 |
| Open GH issues | 20 |

## Infrastructure
- News cron: GitHub Actions 6x/day + Vercel 1x/day
- Four-pillar cron: daily precompute via `/api/cron/assessments`
- Materialized view: auto-refresh in pipeline cron + admin button
- Billing: Stripe wired, tier gating in place (needs products + testing)
- Revenue gates: PaywallGate + TierGatedSection on restricted pages
- Design system: Stitch prototyping + Figma MCP
- PM: Notion MCP connected (project board, CEO assessments, tasks DB)
- AF daily cron: `af_refresh.sh` at 6am+6pm UTC (macOS, expires 2026-04-18)
- AllSportsAPI: `sportsapi_refresh.sh` daily at noon

## Credential Status
| Service | Status |
|---------|--------|
| Supabase Staging | ✓ Connected |
| Supabase Prod | ✗ Broken (tenant not found) |
| GitHub | ✓ Connected |
| Gemini | ✓ Key present |
| Groq | ✓ Key present |
| API-Football | ✓ Key present |
| AllSportsAPI | ✓ Key present |
| Anthropic | ✓ Key present |
| SportsAPIPro | ✓ Key present |
| Stripe | ✗ Test keys only, no real products |
| Google Cloud | ✗ No keys or CLI |
| Notion MCP | ✓ Connected |
| Figma MCP | ✓ Connected |
