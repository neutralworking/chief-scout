# Chief Scout — Freemium Strategy

## Commercial Architecture v2

**Date**: 2026-03-22
**Status**: Approved strategy — implementation in progress

---

## The Thesis

Games are the front door. Data is the product. Tools are the business.

```
┌─────────────────────────────────────────────────────────────┐
│                    CHIEF SCOUT ECOSYSTEM                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   FREE TIER  │  │  SCOUT TIER  │  │     PRO TIER      │  │
│  │              │  │              │  │                   │  │
│  │  Games &     │→→│  Player      │→→│  Scouting         │  │
│  │  Discovery   │  │  Intelligence│  │  Operations       │  │
│  │              │  │              │  │                   │  │
│  │  Gaffer      │  │  Full DB     │  │  Shortlists       │  │
│  │  On The Plane│  │  Profiles    │  │  Squad Builder    │  │
│  │  Free Agents │  │  Archetypes  │  │  Scout Pad        │  │
│  │  Kickoff     │  │  Comparisons │  │  CSV Export        │  │
│  │  Clash       │  │  News Intel  │  │  API Access       │  │
│  │  News Feed   │  │  Formations  │  │  Priority Support │  │
│  │  Legends     │  │              │  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  DIRECTOR OF FOOTBALL — Separate product (own repo)      ││
│  │  FM-style management sim. Not part of freemium ladder.   ││
│  │  Chief Scout feeds data → DoF reads, never writes back.  ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Tier Breakdown

### FREE — "The Casual Fan" (£0)

**Purpose**: Build audience. Maximize reach. Create habit loops.

**What's included**:
| Feature | Access | Notes |
|---------|--------|-------|
| Gaffer (Choices) | Full | Manager identity game, unlimited votes |
| On The Plane | Full | World Cup squad picker |
| Kickoff Clash | Full | Card battler (when launched from separate repo) |
| Free Agents | Full | Definitive list, position-grouped |
| News Feed | Full | Stories + sentiment, no player-level drill-down |
| Legends | Full | Historical database, hall of fame |
| Fixtures | Full | Upcoming matches |
| Dashboard | Limited | Featured player, trending, fixtures — no deep links |
| Player Profiles | Teaser | Name, position, club, nation, level badge only |
| Player Count | 50 featured | Rotating editorial selection, not the full DB |
| Clubs/Leagues | Browse only | Club list, league list — no squad depth |

**What's gated**:
- Full player profiles (radar, personality, attributes, career, scouting notes)
- Player search & filters
- Archetype system
- Comparison tool
- Formation player mapping
- Club squad depth analysis

**Conversion hooks**:
- "Unlock full profile" CTA on every teaser card
- Gaffer results reference player archetypes: "You manage like Guardiola — see which players fit your style"
- On The Plane shows CS ratings after squad submission: "Our scouts rated this squad 7.2/10 — upgrade to see why"
- Free Agents show level badge but blur radar + attributes
- News stories mention player archetypes with "Scout tier to see full assessment"

---

### SCOUT — "The Serious Fan" (£7/mo or £59/yr)

**Purpose**: Core product. Where the value lives. The "Netflix of football intelligence."

**What's included** (everything in Free, plus):
| Feature | Access | Notes |
|---------|--------|-------|
| Full Player Database | Unlimited | All 19k+ players, search, filters |
| Player Profiles | Full | Radar, personality, attributes, career timeline |
| Archetypes | Full | Classification system, archetype search |
| Personality System | Full | MBTI-style profiling, coachability, competitiveness |
| Comparison Tool | Full | Side-by-side radar, up to 3 players |
| Formations | Full | Player mapping, tactical role analysis |
| Club Detail | Full | Squad depth, position analysis, archetype mix |
| News Intelligence | Full | Player-tagged stories, sentiment tracking, trend windows |
| Stats Dashboard | Full | League stats, position metrics |
| Market Intelligence | Read-only | Value tiers, scarcity scores, market premium |

**What's gated**:
- Shortlists (create, manage, share)
- Squad Builder (needs assessment, gap analysis)
- Scout Pad (working notepad for scouting operations)
- CSV/data export
- API access
- Priority support

**Why £7 not £9**: Lower price point = higher conversion from free games. Football fans are price-sensitive. £59/yr = less than £5/mo effective — easy impulse buy. Competes with The Athletic (£7.99/mo) on perceived value.

---

### PRO — "The Scout" (£19/mo or £149/yr)

**Purpose**: Revenue engine. For people doing actual scouting work — analysts, agents, content creators, FM enthusiasts who want real data.

**What's included** (everything in Scout, plus):
| Feature | Access | Notes |
|---------|--------|-------|
| Shortlists | Full | Create, manage, share curated player lists |
| Squad Builder | Full | Club needs assessment, position gap analysis, recruitment priorities |
| Scout Pad | Full | Working notepad for active scouting operations |
| CSV Export | Full | Download player data, filtered results, shortlists |
| API Access | Full | RESTful API for integrations (rate-limited) |
| Priority Support | Full | Direct channel for issues and feature requests |
| Network (Gems) | Full | Hidden gem discovery, insight cards |
| Advanced Filters | Full | Multi-criteria search, compound scoring filters |

**Why £19 not £29**: £29/mo is enterprise pricing territory. The audience for CS Pro is content creators, FM addicts, semi-pro analysts, and small agencies — not Premier League clubs. £149/yr is the sweet spot: serious enough to filter tourists, accessible enough for passionate users.

---

## Pricing Comparison

| | Monthly | Annual | Annual effective |
|---|---|---|---|
| **Free** | £0 | £0 | £0 |
| **Scout** | £7 | £59 | £4.92/mo |
| **Pro** | £19 | £149 | £12.42/mo |

**Annual discount**: ~30% — strong enough to drive annual commitments.

---

## Funnel Architecture

```
AWARENESS          ENGAGEMENT           CONVERSION          RETENTION
─────────          ──────────           ──────────          ─────────
Social/SEO    →    Gaffer/OTP      →    Scout tier     →    Pro tier
│                  │                    │                    │
│ "Best free       │ Build identity,    │ Full profiles,     │ Shortlists,
│  agents 2026"    │ play games,        │ the "aha" of       │ squad builder,
│                  │ browse legends     │ seeing full         │ export — the
│ "Pick your       │                    │ intelligence on     │ workflow tools
│  World Cup       │ Soft gate:         │ a player you        │ that create
│  squad"          │ "Sign up to        │ already care        │ stickiness
│                  │  save progress"    │ about               │
│ "Who's your      │                    │                    │ API for
│  manager alter   │ Conversion hooks   │ Annual upsell      │ power users
│  ego?"           │ everywhere         │ at month 2         │
```

### Key Conversion Points

1. **Anonymous → Signed Up**: Gaffer saves your identity. On The Plane saves your squad. "Sign up to keep your progress." Zero friction — Google OAuth.

2. **Free → Scout**: The profile teaser is the trigger. User clicks a player they care about → sees name/club/level but the radar is blurred, personality is locked, attributes say "Scout tier". One-click upgrade from the player page itself.

3. **Scout → Pro**: After 30 days of Scout, prompt with "You've viewed 200 players this month. Create a shortlist to track the ones that matter." Shortlists are the gateway drug to Pro.

---

## Content Strategy by Tier

### Free Tier Content (SEO + Social)
- **Free agent lists** — seasonal, shareable, definitive
- **Legends database** — evergreen, high search volume
- **Gaffer questions** — shareable results ("I'm a Wenger-type manager")
- **On The Plane squads** — shareable during international windows
- **News feed** — current, drives repeat visits
- **Fixtures** — utility, drives daily visits

### Scout Tier Content (Depth + Intelligence)
- **Player profiles** — the core product, 19k+ players with full intelligence
- **Archetype analysis** — "Best Registas in world football" editorial
- **Formation breakdowns** — tactical content with player mapping
- **Comparison articles** — "Saka vs Foden: the data says..."
- **Market intelligence** — value tiers, scarcity, premium indicators

### Pro Tier Content (Workflow + Operations)
- **Shortlist templates** — curated starting points (e.g., "Best U-21 CBs under £20m")
- **Squad gap analysis** — "What Arsenal need this summer"
- **API documentation** — for content creators building their own tools
- **Export templates** — pre-built CSV formats for common analyses

---

## Director of Football — Separation

Director of Football is a **separate product** in its own repo. It is NOT part of the freemium ladder.

| Aspect | Chief Scout | Director of Football |
|--------|-------------|---------------------|
| **Product type** | Intelligence platform | Management simulation |
| **Revenue model** | Subscription (freemium) | Premium game (one-time or season pass) |
| **Audience** | Fans, analysts, scouts | FM-style gamers |
| **Data flow** | Source of truth | Consumer (read-only) |
| **Repo** | `chief-scout` | `director` (separate) |
| **Pricing** | £0/£7/£19 per month | TBD (likely £9.99 one-time or £4.99/season) |

**Cross-sell**: Chief Scout Pro users get a "DoF Data Pack" — their shortlists and assessments import into DoF as scouting reports. This is the bridge, not a bundled tier.

---

## Feature Gate Matrix

| Feature | Free | Scout | Pro |
|---------|------|-------|-----|
| Gaffer (Choices) | Y | Y | Y |
| On The Plane | Y | Y | Y |
| Kickoff Clash | Y | Y | Y |
| Free Agents (list) | Y | Y | Y |
| News Feed (headlines) | Y | Y | Y |
| Legends | Y | Y | Y |
| Fixtures | Y | Y | Y |
| Dashboard (limited) | Y | Y | Y |
| Player Teasers (50 featured) | Y | Y | Y |
| Sign up / Profile | Y | Y | Y |
| Full Player Database (19k+) | - | Y | Y |
| Player Profiles (full) | - | Y | Y |
| Player Search & Filters | - | Y | Y |
| Archetype System | - | Y | Y |
| Personality Profiles | - | Y | Y |
| Comparison Tool | - | Y | Y |
| Formations (player mapping) | - | Y | Y |
| Club Detail (squad depth) | - | Y | Y |
| Stats Dashboard | - | Y | Y |
| News Intelligence (deep) | - | Y | Y |
| Market Intelligence | - | Y | Y |
| Shortlists | - | - | Y |
| Squad Builder | - | - | Y |
| Scout Pad | - | - | Y |
| Network (Gems) | - | - | Y |
| CSV Export | - | - | Y |
| API Access | - | - | Y |
| Priority Support | - | - | Y |

---

## Revenue Projections (Conservative)

Assumes games drive top-of-funnel:

| Metric | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Free users | 5,000 | 15,000 | 50,000 |
| Scout subscribers | 50 | 200 | 800 |
| Pro subscribers | 5 | 25 | 100 |
| Scout MRR | £350 | £1,400 | £5,600 |
| Pro MRR | £95 | £475 | £1,900 |
| **Total MRR** | **£445** | **£1,875** | **£7,500** |
| **Total ARR** | **£5,340** | **£22,500** | **£90,000** |

**Key assumptions**:
- 1% free → Scout conversion
- 10% Scout → Pro conversion
- Games account for 70%+ of free user acquisition
- Annual plans represent 40% of paid users by month 6

---

## Implementation Priority

### Phase 1 — Gate the product (this sprint)
1. Update tier definitions in `stripe.ts` (new prices, new feature flags)
2. Update `features.ts` with full gate matrix
3. Build player teaser component (locked profile preview)
4. Add conversion CTAs to game result screens
5. Update pricing page with new tiers and positioning

### Phase 2 — Optimize the funnel (next sprint)
1. "Sign up to save" prompts in Gaffer and On The Plane
2. Player profile blur/lock UI for free tier
3. In-app upgrade prompts (contextual, not annoying)
4. Annual plan upsell flow at day 30

### Phase 3 — Pro features (month 2)
1. Shortlist creation and management UI
2. CSV export from any filtered view
3. API key generation and docs
4. Scout Pad polish pass

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Games don't drive enough traffic | Medium | High | SEO-first content strategy for free agents + legends |
| Scout price too low to sustain | Low | Medium | Annual plans drive LTV; Pro tier is the revenue engine |
| Pro features not differentiated enough | Medium | Medium | Shortlists are the killer feature — make them exceptional |
| Free tier too generous | Low | Low | Games are engagement, not intelligence — the paywall is clear |
| Free tier too restrictive | Medium | High | Featured 50 players rotate, giving taste without the full DB |
| Director of Football cannibalizes Scout | Low | Medium | Different audiences — FM gamers vs data nerds |

---

## Success Metrics

| Metric | Target (Month 6) |
|--------|-------------------|
| Free users (registered) | 15,000 |
| Gaffer games played | 50,000 |
| Free → Scout conversion | 1.5% |
| Scout → Pro conversion | 12% |
| Scout churn (monthly) | < 8% |
| Pro churn (monthly) | < 5% |
| Annual plan adoption | 40% |
| MRR | £1,875 |

---

*This document is the commercial source of truth for Chief Scout monetization. All feature gating decisions reference this matrix.*
