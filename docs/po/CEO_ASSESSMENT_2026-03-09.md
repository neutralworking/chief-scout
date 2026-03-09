# CEO Assessment — Chief Scout

**Date:** 2026-03-09

---

## Situation

Chief Scout is a football scouting intelligence platform with a **mature data foundation and zero user-facing product**. After significant investment in research (1,800+ player profiles), data pipeline engineering (13 scripts ingesting from 4 external sources), and specification writing (dashboard, game design, scouting templates), the project sits at an inflection point: the backend is solid, the design is approved, but nothing is deployed and no revenue exists.

**What's built:**
- Full 13-script data pipeline (Obsidian vault, CSV, StatsBomb, Understat, FBRef, RSS news)
- Normalized Supabase schema with 15+ tables
- 524 players with structured attributes, 1,800+ research profiles
- Approved UI design for a scouting dashboard (player viewer v1)
- Comprehensive game design documentation (Director of Football)

**What's not built:**
- The Next.js app (`apps/player-editor/` is empty)
- Authentication, billing, deployment
- Any user-facing interface whatsoever

---

## Opportunity

The core opportunity is clear: **ship the scouting dashboard as a standalone product before attempting game integration.**

**Why this matters now:**
1. **The data moat is real.** Multi-source player intelligence (scouting grades + StatsBomb events + Understat xG + news sentiment) in a single interface doesn't exist at the consumer/prosumer level. FBRef gives raw stats. FM gives game data. Nobody combines real scouting assessment with statistical evidence in a clean UI.

2. **Time-to-revenue is short.** The design is approved, the schema exists, the data is populated. A functional MVP is days of implementation, not months. Supabase handles auth. Vercel handles deployment. Stripe handles billing.

3. **The game is a distraction — for now.** The Director of Football game (Godot, match simulation, AI opponents, save/load) is a multi-year undertaking with massive scope risk (R1 in the risk register). The scouting dashboard is a product that can ship and generate revenue independently.

---

## Recommendation

**Ship the scouting dashboard. Kill the game integration timeline. Sequence the P0 backlog ruthlessly.**

### Execution order:

| # | Action | Size | Why |
|---|--------|------|-----|
| 1 | **Build Player Viewer MVP** | 2-3 days | The approved design covers players list, player detail, club squad view, and news feed. All data exists. This is the product. |
| 2 | **Deploy to Vercel** | Hours | Get it live. Even without auth, a private deployment proves the product works end-to-end. |
| 3 | **Add Supabase Auth** | 1 day | Gate access. Single user for now — you are the first customer. |
| 4 | **Validate with 5 users** | 1 week | Share with football-adjacent people. Get feedback on whether the compound metrics model (Mental/Physical/Tactical/Technical) resonates. |
| 5 | **Add Stripe paywall** | 1 day | Only after validation. Start with a simple tier: free (limited players) / paid (full access). |

### What to defer:
- **Game integration (Phase 3)** — park entirely. No revenue path, massive scope.
- **Formation analysis tool** — nice-to-have, not core to the scouting workflow.
- **FBRef scraper completion** — existing data sources (StatsBomb + Understat) are sufficient for MVP.
- **Canonical schema cleanup (Backlog #7)** — the schema works. Perfectionism here blocks shipping.

### What to kill:
- The backlog already killed the right items (Director audit, Hall of Fame JSON, Playing Styles implementation). Good instinct. Stay disciplined.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Over-engineering the MVP** | High | The v1 design is already ambitious (4 pages, compound metrics, gap analysis). Ruthlessly cut to players list + player detail first. Add club view and news feed in v1.1. |
| **No users beyond founder** | High | This is the existential risk. The product is useful to you — but is it useful to anyone else? Validate before building billing. |
| **Data freshness** | Medium | Pipeline runs manually via `make pipeline`. For a paid product, you need scheduled runs. Cron job or Vercel cron is sufficient for now. |
| **Scope creep into game features** | Medium | The GDD is seductive — 7+ interconnected systems, all well-specced. Resist. The scouting dashboard is the business. The game is the hobby. |
| **Security debt (R11)** | Low | Old credentials are already flagged. The new Supabase project is clean. Just don't repeat the mistake. |

---

## KPIs for the Next 30 Days

| Metric | Target | Why it matters |
|--------|--------|----------------|
| **Dashboard deployed** | Yes/No | Binary. Ship or don't. |
| **Pages functional** | 2+ (Players list, Player detail) | Core scouting workflow complete |
| **External users with access** | 5+ | Validation signal |
| **Time from search to insight** | < 10 seconds | UX quality — can you find and evaluate a player quickly? |
| **Paying users** | 0 (not the goal yet) | Don't optimize for revenue before product-market fit |

---

## Bottom Line

You have a differentiated data asset, a clear design, and a proven pipeline. The only thing missing is a shipped product. Every day spent on specs, game design docs, or schema perfection instead of building the Next.js app is a day wasted. **The next commit should be `npx create-next-app`.**
