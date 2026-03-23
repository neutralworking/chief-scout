# Working Context — Chief Scout
> Last updated: 2026-03-23 (session 21+)

## Continue Today
1. **Wave 1 UI QA** — merged to main last night. Dashboard, player list, player detail all redesigned. Needs testing pass.
2. **Kickoff Clash v4** — game loop complete (pack opening → match → shop). Not wired to DB yet. Migration 036 pending.
3. **Legends polish** — 195 seeded, trait pills, similar players, editable archetypes. Scoring weight tuning in progress (f131f19).

## Current Sprint
1. **Data Density** — DONE. 9,227 Tier 1.
2. **Four-Pillar QA** — DONE. Precomputed scores now run daily via cron (b9b94d2).
3. **Scale to 200+ Tier 1** — DONE. Long surpassed.

## What's New Since Last Tracked (sessions 17-21)

### Shipped & On Main
- **Wave 1 UI**: design tokens, sharp edges, Topbar/SectionHeader/GradeBadge, bottom tab bar, dashboard news-first, PlayerCard four-pillar redesign
- **Kickoff Clash v4**: hand engine, jokers, pack opening, tactic cards (12), formations (6), match phase (11-card XI), shop, 500 fake characters
- **Legends**: 195 seeded, trait pills (12 editorial traits), editable archetypes, similar player scoring, "Plays Like" comparison
- **On The Plane**: World Cup squad picker game (migration 042)
- **Freemium**: PlayerTeaser, UpgradeCTA, tier system
- **Billing**: Stripe wiring, tier gating (migration)
- **Precomputed four-pillar**: cron endpoint + daily automation
- **Per-player SEO**: dynamic OG images, meta tags, JSON-LD
- **Tactics screen**: 10 philosophies + role browser
- **Role icons**: greatest player per tactical role
- **Blueprint module**: extracted (role × personality → identity)
- **Design system**: Stitch prototyping setup, 16+ mockups

## App Structure (current)
| Route | Purpose | Env |
|-------|---------|-----|
| `/` | Dashboard — news-first, FeaturedPlayer 2-col | All |
| `/players` | Player list — sticky search, age groups, Wave 1 styling | All |
| `/players/[id]` | Player detail — best roles, sharp panels, four-pillar, SEO | All |
| `/compare` | 2-3 player comparison | All |
| `/network` | Scout Insights: hidden gems, batch triage | Staging |
| `/clubs` | Club list + `/clubs/[id]` with power ratings | All |
| `/leagues` | League list (top 5 pinned) | All |
| `/formations` | Formation browser + tactical roles | All |
| `/news` | News feed | All |
| `/free-agents` | Free Agency (compact PlayerCard) | All |
| `/shortlists` | User + editorial shortlists | All |
| `/choices` | Gaffer (PWA) — mobile cards + stat quiz | All |
| `/kickoff-clash` | KC game hosted on CS Vercel | All |
| `/legends` | Legend profiles with trait pills + similar players | All |
| `/on-the-plane` | World Cup squad picker | All |
| `/admin` | 5-tab: Dashboard, Scout Pad, Editor, Personality, KC Cards | Staging |

## Sidebar Nav
- **Scouting**: Dashboard, Players, Network*, Stats, Free Agency, Compare, Legends
- **Browse**: Clubs, Leagues, Fixtures, News
- **Games**: Gaffer, Kickoff Clash, On The Plane
- **Admin**: Admin*, Tactics*
(*staging only)

## Active Decisions
- KC v4: apply migration 036 + wire DB, or keep client-side prototype?
- Wave 1 UI: QA pass needed — are there regressions from the merge?
- Freemium/Stripe: test the billing flow end-to-end before going live

## Blockers
- Migration 036 (KC tables) not applied
- Script 04 crashes on `story_types` (string not dict)
- Valuation engine (40) and StatsBomb grades (31) timeout in orchestrator
- 20 stale remote branches need cleanup (see BRANCHES.md)

## Key Metrics (as of 2026-03-23)
| Metric | Value |
|--------|-------|
| people | 21,683+ |
| attribute_grades | 500k+ |
| Tier 1 profiles | 9,227 |
| Tests | 370 (Python + TS) |
| Clubs with power ratings | 961 |
| Legends seeded | 195 |
| KC characters | 500 |
| Pipeline scripts | 01-86 |
| Migrations | through 042 |

## Infrastructure
- News cron: GitHub Actions 6x/day + Vercel 1x/day
- Four-pillar cron: daily precompute via `/api/cron/assessments`
- Billing: Stripe wired, tier gating in place (needs testing)
- Design system: Stitch prototyping setup
