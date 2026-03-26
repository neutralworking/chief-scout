# Working Context — Chief Scout
> Last updated: 2026-03-24 (session 23)

## Continue Today
1. **Cross-session sync** — WORKING.md, FEATURES.md, tasks.md all stale. Updating now.
2. **Prod DB broken** — `PROD_POSTGRES_DSN` returns "Tenant or user not found". Blocks promotion.
3. **Stripe keys missing** — no `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in `.env.local`. Blocks billing QA.
4. **Google Cloud** — user says keys should be available but no GCP env vars or CLI found.
5. **Stale branch cleanup** — 20 unmerged remote branches (see BRANCHES.md).

## Current Sprint
1. ~~**Data Density**~~ — DONE. 27,918 people in staging.
2. ~~**Four-Pillar QA**~~ — DONE. Precomputed scores run daily via cron.
3. ~~**36-Role Taxonomy**~~ — DONE. PR #106 merged, migration 043 applied, 14,063 players recomputed.
4. ~~**Fixture Predictions**~~ — DONE. PRs #107-108 merged, migration 044, pipeline 69.

### Next Sprint (proposed)
- PL launch audit — completeness gate for production
- Stripe E2E test — needs keys first
- KC DB wiring — migration 036 + replace hardcoded cards
- Auth enforcement — currently sessionStorage hack

## What's New (sessions 22-23)

### Shipped & On Main
- **36-Role Four-Pillar Taxonomy** (PR #106): SACROSANCT System 4 rewrite, migration 043, formation slots, blueprints, ratings, role icons, editor all updated
- **Fixture Predictions** (PRs #107-108): predicted scores, international/continental support, position constraints, role mapping, tag pipelines (36b fitness, 36c disciplinary), migration 044
- **GK-Specific Ratings**: separate models, alias discounting, league strength pre-scaling
- **Nav v2**: Clash Display headings, brand gradient logo, pill nav items
- **Design System v2**: Vibrant Data — warm surfaces, brand gradient, Bricolage Grotesque + Clash Display, 12px radius, card system (58 files)
- **Blueprint Computation**: extracted module, updated for 36-role taxonomy
- **Role redesign branch**: merged to main and deleted

### Previously Shipped (sessions 17-21)
- Wave 1 UI, Kickoff Clash v4, Legends system, On The Plane
- Freemium + billing tier system, per-player SEO
- Precomputed four-pillar cron, tactics screen, role icons
- Design system + Stitch prototyping, 16+ mockups

## App Structure
| Route | Purpose | Env |
|-------|---------|-----|
| `/` | Dashboard — news-first, FeaturedPlayer 2-col | All |
| `/players` | Player list — sticky search, age groups | All |
| `/players/[id]` | Player detail — best roles, four-pillar, SEO | All |
| `/compare` | 2-3 player comparison | All |
| `/fixtures` | Fixture previews + predicted scores | All |
| `/network` | Scout Insights: hidden gems, batch triage | Staging |
| `/clubs` | Club list + `/clubs/[id]` with power ratings | All |
| `/leagues` | League list (top 5 pinned) | All |
| `/formations` | Formation browser + 36 tactical roles | All |
| `/tactics` | 10 philosophies + role browser | All |
| `/news` | News feed | All |
| `/free-agents` | Free Agency (compact PlayerCard) | All |
| `/shortlists` | User + editorial shortlists | All |
| `/choices` | Gaffer (PWA) — mobile cards + stat quiz | All |
| `/kickoff-clash` | KC game hosted on CS Vercel | All |
| `/legends` | Legend profiles with trait pills + similar players | All |
| `/on-the-plane` | World Cup squad picker | All |
| `/admin` | 5-tab: Dashboard, Scout Pad, Editor, Personality, KC Cards | Staging |

## Sidebar Nav (v2)
- **Scouting**: Dashboard, Players, Network*, Stats, Free Agency, Compare, Legends
- **Browse**: Clubs, Leagues, Fixtures, News
- **Games**: Gaffer, Kickoff Clash, On The Plane
- **Admin**: Admin*, Tactics*
(*staging only)

## Active Decisions
- KC v4: apply migration 036 + wire DB, or keep client-side prototype?
- Freemium/Stripe: need keys before E2E test
- Google Cloud: what services to integrate?

## Blockers
- **Prod DB unreachable** — "Tenant or user not found" on PROD_POSTGRES_DSN
- Stripe keys not in .env.local — billing QA blocked
- Migration 036 (KC tables) not applied
- Valuation engine (40) and StatsBomb grades (31) timeout in orchestrator
- 20 stale remote branches (see BRANCHES.md)
- Script 04 `story_types` crash — guard exists in code but needs live verification

## Key Metrics (as of 2026-03-24)
| Metric | Value |
|--------|-------|
| people | 27,918 |
| attribute_grades | 646k+ |
| Players rated | 14,063 |
| Tier 1 profiles | 9,227+ |
| Tests | 370 (Python + TS) |
| Clubs | 961 |
| Legends seeded | 195 |
| KC characters | 500 |
| Tactical roles | 36 |
| Pipeline scripts | 01-86 + 69 |
| Migrations | through 044 |

## Infrastructure
- News cron: GitHub Actions 6x/day + Vercel 1x/day
- Four-pillar cron: daily precompute via `/api/cron/assessments`
- Billing: Stripe wired, tier gating in place (needs keys + testing)
- Design system: Stitch prototyping + Figma MCP
- PM: Notion MCP connected (project board, CEO assessments, tasks DB)
- MCP servers: Notion, Figma

## Credential Status
| Service | Status |
|---------|--------|
| Supabase Staging | ✓ Connected |
| Supabase Prod | ✗ Broken (tenant not found) |
| GitHub | ✓ Connected |
| Gemini | ✓ Key present |
| Groq | ✓ Key present |
| API-Football | ✓ Key present |
| Anthropic | ✓ Key present |
| Stripe | ✗ No keys |
| Google Cloud | ✗ No keys or CLI |
| Notion MCP | ✓ Connected |
| Figma MCP | ✓ Connected |
