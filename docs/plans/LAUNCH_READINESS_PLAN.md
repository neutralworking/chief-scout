# Launch Readiness Plan — Chief Scout
## Target: May 1, 2026 | 5 sprints × 1 week

---

## Context

The product is feature-rich but not revenue-ready. The CEO assessment identified that the building blocks (Stripe, PaywallGate, useTier, feature flags, Plausible analytics, Gaffer identity logic) **all exist** but aren't wired together. The user correctly flagged that shipping with obvious data errors (7 unplayable OTP nations, missing personality output in Gaffer) would damage first impressions.

This plan sequences 5 weekly sprints to go from "built" to "launchable" by May 1.

---

## Sprint 1 — Revenue Gate (Mar 27 – Apr 2)
**Theme**: Make the paywall real. No paying features accessible for free.

| # | Task | Size | Owner | Files |
|---|------|------|-------|-------|
| 1.1 | **Middleware tier enforcement** — extend `middleware.ts` to check tier for Scout/Pro routes. Redirect free users to `/pricing` | M | Frontend | `apps/web/src/middleware.ts` |
| 1.2 | **Wrap Scout pages with PaywallGate** — `/players/[id]` (full profile), `/compare`, `/clubs/[id]` (squad depth), `/formations`, `/stats` | M | Frontend | Each page + `PaywallGate.tsx` |
| 1.3 | **Wrap Pro pages with PaywallGate** — `/shortlists`, `/squad`, `/scout-pad`, `/network` | S | Frontend | Each page |
| 1.4 | **Player profile teaser** — free tier sees name/club/nation/level. Radar blurred, personality locked, attributes hidden. Use `useTier` + conditional rendering on player detail page | L | Frontend | `apps/web/src/app/players/[id]/page.tsx` |
| 1.5 | **Free agent teaser** — show level badge but blur radar + attributes on free-agents page | M | Frontend | `apps/web/src/app/free-agents/page.tsx` |
| 1.6 | **Conversion CTAs** — add `UpgradeCTA` on every gated component fallback. "Unlock full profile" on player page, "Upgrade to compare" on compare, etc. | S | Frontend | Multiple pages |
| 1.7 | **Stripe env documentation** — document all 6 required Stripe env vars in `.env.example`. Create Stripe products/prices in dashboard | S | DevOps | `.env.example`, Stripe dashboard |

**Exit criteria**:
- [ ] Free user at `/players/123` sees teaser, not full profile
- [ ] Direct URL to `/squad` redirects to `/pricing` for free users
- [ ] Scout user sees full profiles but not shortlists
- [ ] Pro user sees everything
- [ ] Stripe checkout → webhook → tier upgrade works end-to-end

**Risk**: Player detail teaser (1.4) is the largest task — needs careful conditional rendering without breaking the existing page for paid users.

---

## Sprint 2 — Fix the Games (Apr 3 – Apr 7)
**Theme**: Games are the front door. They must deliver on their promise.

> **OTP HARD DEADLINE: April 7** — WC 2026 playoffs complete by this date, World Cup buzz already building. OTP must be live with all 48 nations playable.

| # | Task | Size | Owner | Files |
|---|------|------|-------|-------|
| 2.1 | **Gaffer manager identity reveal** — call `computeIdentity()` on profile page, display archetype card (name + tagline + summary) | S | Frontend | `apps/web/src/app/profile/page.tsx`, `football-identity.ts` |
| 2.2 | **Gaffer in-game reveal** — after 10+ votes, show "Your manager type is emerging..." banner in ChoicesGame. After 20+, show full archetype | M | Frontend | `apps/web/src/components/ChoicesGame.tsx` |
| 2.3 | **Gaffer conversion hook** — on reveal screen: "You manage like Guardiola — see which players fit your style" → link to `/players` filtered by archetype alignment | M | Frontend | `ChoicesGame.tsx`, player list filter |
| 2.4 | **Era bias computation** — rules-based from dimension patterns, compute in vote route, store in `fc_users.era_bias` | S | Backend | `apps/web/src/app/api/choices/vote/route.ts` |
| 2.5 | **OTP roster expansion via Wikipedia** — run `pipeline/92_wikipedia_national_squads.py` for all 48 nations. Fetches current squads from Wikipedia, matches to DB, inserts missing players. Targets all thin-pool nations. Supplement with manual feed from news sources | M | Pipeline | `pipeline/92_wikipedia_national_squads.py` |
| 2.6 | **OTP pre-compute ideal squads** — batch compute `otp_ideal_squads` for all 48 nations via `/api/cron/otp-squads?force=true` | S | Pipeline | `apps/web/src/app/api/cron/otp-squads/route.ts` |
| 2.7 | **OTP conversion hook** — after squad submission, show CS rating: "Our scouts rated this squad 7.2/10 — upgrade to see full player intelligence" | S | Frontend | `apps/web/src/app/on-the-plane/[nationSlug]/page.tsx` |
| 2.8 | **Gaffer onboarding** — first-time tooltip on empty pitch explaining the game | S | Frontend | `ChoicesGame.tsx` |

**Exit criteria**:
- [ ] User with 20+ Gaffer votes sees "You manage like [Archetype]" on profile page
- [ ] All 48 OTP nations are playable (no thin-pool disabling)
- [ ] Gaffer result screen includes cross-sell to player intelligence
- [ ] OTP ideal squads pre-computed (no first-visit delay)

**Risk**: Wikipedia squad tables vary in structure across nations. Manual roster augmentation may be needed for smaller federations where Wikipedia is sparse. User will supplement with news/Wikipedia research.

---

## Sprint 3 — Data Quality (Apr 10 – Apr 16)
**Theme**: Fill the gaps users will notice. Intelligence product needs actual intelligence.

| # | Task | Size | Owner | Files |
|---|------|------|-------|-------|
| 3.1 | **Scouting notes for top 250** — LLM profiling pass. Generate narrative summaries for highest-traffic players | L | Pipeline | New/existing pipeline script |
| 3.2 | **Empty state UX pass** — replace silent `null` returns with contextual messages. Radar: "Upgrade to see radar". Missing archetype: "Assessment pending". Missing personality: "Profile in progress" | M | Frontend | `PlayerRadar.tsx`, player detail, `SimilarPlayers.tsx`, `SystemFit.tsx` |
| 3.3 | **Free agents mobile fix** — cap candidates at 5 per slot on mobile, "Show more" expander | S | Frontend | Free agents page |
| 3.4 | **Extend AF coverage** — target top-5 league players without grades (priority: PL, La Liga, Serie A, Bundesliga, Ligue 1) | L | Pipeline | `pipeline/65_api_football_ingest.py`, `pipeline/66_api_football_grades.py` |
| 3.5 | **Run ratings pipeline** — recompute after new grades: `pipeline/27_player_ratings.py` + `pipeline/60_fingerprints.py` | M | Pipeline | Scripts 27, 60 |
| 3.6 | **Personality inference gap fill** — run `pipeline/36_infer_personality.py` for players missing MBTI data | M | Pipeline | `pipeline/36_infer_personality.py` |

**Exit criteria**:
- [ ] Top 250 players have non-empty scouting notes
- [ ] No silent `null` renders on player detail page — every empty section has a message
- [ ] Free agents page usable on mobile (no horizontal overflow)
- [ ] AF grade count increased by 20%+
- [ ] Personality coverage increased (measure before/after)

**Risk**: LLM profiling (3.1) needs API credits (Gemini). Rate limiting may extend the timeline.

---

## Sprint 4 — Production Deploy (Apr 17 – Apr 23)
**Theme**: Ship it to the real world. Staging → Production.

| # | Task | Size | Owner | Files |
|---|------|------|-------|-------|
| 4.1 | **Production Supabase setup** — create prod project, apply all migrations, set up RLS | L | DevOps | `pipeline/sql/` migrations |
| 4.2 | **Data promotion** — run `pipeline/45_promote_to_prod.py`. Target: 276+ Tier 1 profiles in production | M | Pipeline | `pipeline/45_promote_to_prod.py` |
| 4.3 | **Vercel production deployment** — configure prod env vars (Supabase, Stripe live keys, Plausible domain) | M | DevOps | Vercel dashboard |
| 4.4 | **Stripe live mode** — switch from test to live keys. Create live products/prices matching test IDs | S | DevOps | Stripe dashboard, env vars |
| 4.5 | **Smoke test full funnel** — anon → signup → Gaffer → OTP → player teaser → checkout → Scout access → Pro upgrade | L | QA | Manual testing |
| 4.6 | **Landing page polish** — hero copy, social proof stats update, pricing CTA, meta tags for SEO | M | Frontend | `apps/web/src/app/page.tsx` |
| 4.7 | **OG images / meta tags** — proper sharing cards for home, player pages, Gaffer, OTP | M | Frontend | Layout + page metadata |
| 4.8 | **Plausible custom events** — track: signup, checkout_start, checkout_complete, gaffer_vote, otp_submit | S | Frontend | Key action points |

**Exit criteria**:
- [ ] Production URL live and serving Tier 1 data
- [ ] Full signup → payment → access flow works with real Stripe
- [ ] Sharing a link to the site shows proper OG image/description
- [ ] Plausible dashboard shows real page views and custom events
- [ ] Smoke test passes all funnel steps

**Risk**: Production Supabase setup (4.1) is the longest task. Start early in the sprint. Migration order matters — apply sequentially.

---

## Sprint 5 — Launch Week (Apr 24 – May 1)
**Theme**: Soft launch, monitor, fix, go live.

| # | Task | Size | Owner | Files |
|---|------|------|-------|-------|
| 5.1 | **Soft launch (Apr 24-27)** — share with 20-50 trusted users. Collect feedback on Gaffer, OTP, profiles, checkout | M | All | Manual |
| 5.2 | **Bug fixes from soft launch** — reserve 3 days for issues found | L | All | Various |
| 5.3 | **SEO content** — publish free agent list, "Pick your World Cup squad" page titles, Gaffer meta descriptions | S | Frontend | Meta tags, content |
| 5.4 | **Sign up to save prompts** — Gaffer: "Sign up to keep your manager identity". OTP: "Sign up to save your squad" | S | Frontend | `ChoicesGame.tsx`, OTP pages |
| 5.5 | **News pipeline verify** — ensure GitHub Actions cron runs 6x/day on production | S | DevOps | `.github/workflows/` |
| 5.6 | **Public launch (May 1)** — flip the switch | S | All | — |

**Exit criteria**:
- [ ] 20+ soft launch users tested, critical bugs fixed
- [ ] Sign-up prompts in both games
- [ ] News pipeline running on production
- [ ] **GO LIVE**

---

## Post-Launch (May 2+, not blocking)

These are important but should NOT delay May 1:
- Wave 2/3 UI polish (clubs, leagues, compare redesign)
- Social share cards for Gaffer results
- Annual plan upsell flow at day 30
- Shortlist templates (Pro feature enhancement)
- API key generation (Pro)
- CSV export (Pro)
- Scale to 500 Tier 1 profiles
- Director of Football cross-sell

---

## Sprint Summary

| Sprint | Theme | Critical Path |
|--------|-------|---------------|
| **S1** (Mar 27–Apr 2) | Revenue Gate | PaywallGate + teasers + Stripe e2e |
| **S2** (Apr 3–9) | Fix the Games | Gaffer identity + OTP 48 nations |
| **S3** (Apr 10–16) | Data Quality | Scouting notes + AF coverage + empty states |
| **S4** (Apr 17–23) | Production Deploy | Prod Supabase + Vercel + smoke test |
| **S5** (Apr 24–May 1) | Launch Week | Soft launch + fixes + GO LIVE |

---

## Key Files Reference

| Component | Path |
|-----------|------|
| Middleware | `apps/web/src/middleware.ts` |
| PaywallGate | `apps/web/src/components/PaywallGate.tsx` |
| UpgradeCTA | `apps/web/src/components/UpgradeCTA.tsx` |
| useTier | `apps/web/src/hooks/useTier.ts` |
| TIER_LIMITS | `apps/web/src/lib/stripe.ts` |
| Feature flags | `apps/web/src/lib/features.ts` |
| Gaffer identity | `apps/web/src/lib/football-identity.ts` |
| Profile page | `apps/web/src/app/profile/page.tsx` |
| ChoicesGame | `apps/web/src/components/ChoicesGame.tsx` |
| Player detail | `apps/web/src/app/players/[id]/page.tsx` |
| OTP nations API | `apps/web/src/app/api/on-the-plane/nations/route.ts` |
| Stripe checkout | `apps/web/src/app/api/stripe/checkout/route.ts` |
| Stripe webhook | `apps/web/src/app/api/stripe/webhook/route.ts` |
| Vote route | `apps/web/src/app/api/choices/vote/route.ts` |
| Promote to prod | `pipeline/45_promote_to_prod.py` |

## Verification

After each sprint, run:
1. `cd apps/web && npm run build` — build passes clean
2. Manual funnel test on staging (or prod from Sprint 4)
3. Check Plausible dashboard for event tracking (Sprint 4+)
4. `/db` slash command to verify data counts after pipeline work
