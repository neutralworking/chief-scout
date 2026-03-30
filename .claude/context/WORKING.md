# Working Context — Chief Scout
> Last updated: 2026-03-30 (session 32)

## Current Sprint: Launch Prep
Target: **May 1, 2026** (from CEO assessment PR #113)
OTP Deadline: **April 7, 2026** — WC 2026 playoffs buzz

### Launch Gates
1. **PL data completeness** — all 20 PL clubs with full squads, grades, scouting notes
2. **Prod DB fix** — PROD_POSTGRES_DSN broken ("Tenant or user not found")
3. **Stripe E2E** — keys missing, billing flow untested
4. ~~**OTP 48 nations**~~ — DONE: 48/48 playable, squads precomputed, women filtered
5. **OTP conversion hook** — post-submit CS rating + upgrade CTA (not yet verified)
6. **Stale branch cleanup** — only 1 unmerged remote remains

### Done (from previous sprint)
1. ~~**Data Density**~~ — 28,633 people in staging
2. ~~**Four-Pillar QA**~~ — precomputed daily via cron
3. ~~**41-Role Taxonomy**~~ — migration 049, pipeline 83+27, 41 system-validated roles
4. ~~**Fixture Predictions**~~ — PRs #107-108, migration 044, pipeline 69
5. ~~**Systems & Roles**~~ — 28 systems, 308 slots, AF calibration, GK weight fix

### Session 32 (2026-03-30)
- **Migration 050 applied**: dropped `tactical_roles`, `philosophy_formations`, `philosophy_roles` + `formation_slots.role_id`
- **6 files migrated** to derive old data shapes from `tactical_systems` → `system_slots` → `slot_roles`
- All migrations through 050 on staging. (045 on prod)

### Session 30 (2026-03-29/30)
- **Systems & Roles LIVE**: philosophy→system→slot→role hierarchy. 41 roles, 28 systems.
- **Calibration**: AF ×1.5 cap 15, garbage override, GK weights fixed, DM/WF weights fixed
- **Poacher → Prima Punta** (Striker+Target) — not a system role
- **Archetypes**: Distributor→Conductor (961), Colossus→Titan (318) — role name collisions
- **Position fixes**: Dembélé→CF, Bellingham→AM, Ronaldo→CF. Enzo dupe merged.
- **68 scout grades** across 9 data-limited top players

## What's New (sessions 24-26)

### Session 28 (current)
- **Pipeline 92 parser fix**: 4 bugs fixed (sort-key positions, table class regex, federation club links, redlink names)
- **Pipeline 92 data fixes**: column name, manual ID gen, South Africa redirect, NZ disambiguation
- **720 new players**: 15 thin/low nations enriched from Wikipedia, 48/48 now playable
- **OTP squads precomputed**: 48/48 nations computed, zero errors
- **Women filtered from OTP**: `is_female` column on `people`, 90 flagged, 3 API endpoints filtered
- **Mat view refreshed**: 28,636 rows (up from 27,918)

### Session 27
- Fixture predictions fix, paywall bypass, role score decompression, POSTGRES_DSN fix

### Session 26
- Revenue Gating, Gaffer Sprint 2, CEO Assessment (PR #113)

### Session 25
- **Gaffer quality pass**: dated refs fixed, ACL dilemma rewritten, GOAT dupes rethemed
- **Crowd intelligence**: migration 046, pipeline 46, dynamic vote storage, admin widget
- **Materialized view**: migration 047, 7 indexes, 27,918 rows, pg_trgm, RPC refresh
- **Two new Gaffer categories**: Contract Talks + International Duty (135 total questions)

### Session 24
- **Role score overhaul**: EAFC excluded, GK rescale removed, level floors inverted
- **League strength**: integrated into pipeline 27 via `lib/calibration.py`
- **Position deflators**: median-based (CD 0.896, WD 0.920, DM 0.958), later removed
- **Proxy models**: `lib/proxy_models.py` for Sprinter/Engine/Controller/Target
- **Archetype renames**: Fox→Assassin, Sentinelle→Anchor, Vorstopper→Stopper
- **CF roles expanded**: Assassin, Complete Forward, Spearhead fixed

### Sessions 22-23 (previously shipped)
- Transfer Comparables: migration 045, pipelines 87-89, /transfers page, CS Value recalibration
- Scouting Notes v2: pipeline 90, migration 048, multi-perspective intelligence, admin panel
- Player detail: no-scroll redesign with tab groups
- Wave 2 UI: Clubs, Leagues, News, Free Agents redesigned
- Wave 3 UI: Compare, Tactics, Squad redesigned
- KC DB wiring: 201 tests, pack opening, card art, rarity rebalance
- OTP fixes: GK filter, positions-first layout, UK nation mapping
- KC mobile: full XI formations, starter packs, manager cards
- Legends: trait pills, similar player scoring, archetype inference

## App Structure
| Route | Purpose | Env |
|-------|---------|-----|
| `/` | Dashboard — FeaturedPlayer, TrendingPlayers | All |
| `/players` | Player list — search, filters, age groups | All |
| `/players/[id]` | Player detail — no-scroll tabs, four-pillar, SEO | All |
| `/compare` | 2-3 player comparison with radar overlay | All |
| `/fixtures` | Fixture previews + predicted scores | All |
| `/transfers` | Recent transfers + comparables | All |
| `/network` | Scout Insights: hidden gems, batch triage | Staging |
| `/clubs` | Club list + power ratings | All |
| `/leagues` | League list (top 5 pinned) | All |
| `/formations` | Formation browser + 36 tactical roles | All |
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
- Stripe: get keys from user to unblock billing E2E
- FBRef advanced stats: scrape HTML tables or find better CSV source?

## Blockers
> All P0 launch blockers cleared (session 26):
> - ~~Prod DB~~ — region migrated eu-central-1→eu-west-1, pooler endpoint updated
> - ~~Stripe keys~~ — test keys set locally + Vercel
> - ~~Scouting notes~~ — 250/250 top players now have notes
> - ~~NEXT_PUBLIC_SITE_URL~~ — set in Vercel
> - ~~Build~~ — passing
> - Codespace secrets (13 keys) + Vercel env vars (16 keys) all configured

## Key Metrics (as of 2026-03-26)
| Metric | Value |
|--------|-------|
| people | 28,636 |
| attribute_grades | 646k+ |
| Players rated | 14,063 |
| Tier 1 profiles | 9,227+ |
| Tests | 370+ (Python + TS + KC 201) |
| Clubs | 961 |
| Legends seeded | 195 |
| KC characters | 500 (DB-wired) |
| Tactical roles | 36 |
| Gaffer questions | 135 (10 categories) |
| Pipeline scripts | 01-90 |
| Migrations | through 048 |
| App pages | 20+ routes |
| UI waves completed | 3/3 |

## Infrastructure
- News cron: GitHub Actions 6x/day + Vercel 1x/day
- Four-pillar cron: daily precompute via `/api/cron/assessments`
- Materialized view: auto-refresh in pipeline cron + admin button
- Billing: Stripe wired, tier gating in place (needs keys + testing)
- Revenue gates: PaywallGate + TierGatedSection on restricted pages
- Design system: Stitch prototyping + Figma MCP
- PM: Notion MCP connected (project board, CEO assessments, tasks DB)

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
