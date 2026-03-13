# CEO Decision: Football Choices as Lead Product
**Date**: 13 March 2026
**Decision**: Conditional YES — but not in its current form

---

## The Question

Should Football Choices be the feature we push to production first, ahead of the scouting interface?

## The Case For (Why the March 13 Assessment Said "Ship Now")

Football Choices sidesteps every weakness the scouting product has:

| Problem | Scouting Interface | Football Choices |
|---------|-------------------|-----------------|
| Only 50 full profiles (0.26%) | Fatal — users hit empty pages | Irrelevant — questions are self-contained |
| No production deployment | Needs prod Supabase + data promotion | Just needs Vercel prod + existing staging DB |
| Content quality barrier | Needs 200+ curated profiles | Needs 60-80 good questions (writable in a day) |
| Signup friction | Needs email/auth to be useful | Anonymous-first — localStorage UUID |
| Shareable moment | Player profile links (boring) | "I'm a Romantic Pragmatist" identity card (viral) |

**Football Choices can ship this week. The scouting interface cannot.** That alone makes it the right first move.

## The Case Against (Why the DOF Assessment Said "Pub Quiz")

The current 24 questions are opinion polls. "Greatest player of all time?" tells you what someone already thinks, not how they think about football. If we ship this as-is, we get:

- A BuzzFeed quiz that people play once and never return to
- Zero connection to the scouting product
- No identity data worth analyzing
- No reason for anyone to remember what Chief Scout is

**Shipping Football Choices in its current form would be worse than not shipping at all.** It would set the brand position as "casual football quiz" rather than "football intelligence platform."

## The Decision: Ship It — But Ship It Right

Football Choices is the right lead product **if and only if** it delivers the identity payoff. The database already has the columns (`flair_vs_function`, `youth_vs_experience`, `attack_vs_defense`, `loyalty_vs_ambition`, `domestic_vs_global`, `stats_vs_eye_test`, `era_bias`) — nothing writes to them. That's the gap.

### What "Ship It Right" Means

**The minimum viable Football Choices has three layers:**

#### Layer 1: The Hook (exists today, needs polish)
- Quick Fire trivia questions — fun, fast, shareable percentages
- All-Time XI builder — visual, interactive, community stats
- This gets someone to play for 2 minutes

#### Layer 2: The Depth (MISSING — the DOF's contribution)
- 40+ philosophy/scenario questions that map to identity dimensions
- "You're 1-0 up with 10 minutes left" → maps to `attack_vs_defense`
- "Which signing is better value: a 19yo for £30m or a free agent at 24?" → maps to `youth_vs_experience`
- Each answer shifts a dimension score. Simple weighted scoring, nothing complex.

#### Layer 3: The Payoff (MISSING — the product differentiator)
- After 15+ questions: "Your Footballing Identity" reveal
- A named archetype: "The Romantic Pragmatist", "The Data-Driven Traditionalist", "The Youth Academy Purist"
- A radar chart showing your 6 dimensions
- A shareable card — this is the viral moment
- A bridge to the scouting product: "Players who match your footballing philosophy →"

**Without Layer 2 and Layer 3, don't ship. With them, ship immediately.**

---

## Strategic Logic: The Trojan Horse

```
Football Choices (free, anonymous, viral)
    ↓ identity reveal after 15 questions
    ↓ "See players who match your style →"
Scouting Interface (free tier, email capture)
    ↓ archetype details, personality deep-dives behind paywall
Scout Tier (£9/mo)
    ↓ API access, CSV export, priority support
Pro Tier (£29/mo)
```

Football Choices is not the product. **It's the top of the funnel.** It converts anonymous traffic into identity profiles. Identity profiles create emotional investment. Emotional investment drives exploration of the scouting tool. The scouting tool converts to paid.

This is the same playbook as:
- **Spotify Wrapped** → You don't go to Spotify FOR Wrapped, but Wrapped makes you feel understood, and you share it, and that drives signups
- **16Personalities (MBTI test)** → Free test, shareable result, premium content behind paywall
- **Fantasy Premier League** → Free game, massive engagement, drives Sky/Premier League viewership

Football Choices is our Wrapped moment. But only if the identity reveal is good enough to share.

---

## What This Means for the Scouting Product

The scouting product is still the business. Football Choices doesn't replace it — it feeds it. But this changes the sequencing:

**Old plan**: Ship scouting interface → hope people find it → add Football Choices as engagement feature

**New plan**: Ship Football Choices → build audience → bridge to scouting interface → monetize

This has a concrete advantage: **it buys time to automate profile generation.** While Football Choices is gathering users and identity data, the pipeline can be scaling full profiles from 50 to 200 to 500. By the time Choices users click through to the scouting tool, the content is there.

---

## Implementation Priority

| # | Task | Size | Blocks |
|---|------|------|--------|
| 1 | **Write 40 Tier 2 questions** with dimension mappings | 1 day | Nothing — pure content work |
| 2 | **Add dimension scoring to vote API** | Half day | Needs question→dimension mapping in schema |
| 3 | **Build identity reveal component** | 1 day | Needs scoring logic + radar chart |
| 4 | **Add 5 new categories** (Philosophy, Squad Building, Pressure, Scouting Eye, Manager Mind) | Half day | Needs migration for new categories |
| 5 | **Share card generation** | 1 day | Needs identity reveal working |
| 6 | **Deploy to production** | Hours | Vercel prod project + env vars |
| 7 | **Bridge CTA to scouting product** | Half day | "See players who match your style →" |

**Total: ~5 days of focused work to ship Football Choices properly.**

Compare: shipping the scouting interface properly needs 200+ full profiles (weeks of pipeline work + manual curation) plus production Supabase plus data promotion.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Identity algorithm feels shallow** | High | Keep dimensions to 6 (already defined). Use simple weighted scoring — sophistication comes from question quality, not math. Test with 5 people before shipping. |
| **Questions feel forced/generic** | Medium | The DOF assessment has excellent sample questions. Write them in football voice, not product-manager voice. Test: would a pundit say this on Sky Sports? |
| **No one shares their identity** | Medium | Make the share card visually distinctive. Use personality-themed colors from SACROSANCT. Include a provocative line: "You'd bench Ronaldo for team shape." |
| **Users play once and never return** | Medium | Daily question feature (Week 2). Category completion rings. "Your identity has shifted" notifications when new questions change their profile. |
| **Football Choices cannibalizes the scouting product** | Low | They serve different needs. Choices = self-expression. Scouting = information. The bridge CTA ("Players who match your style") makes them complementary. |
| **Over-investing in a feature before validating demand** | Low | 5 days is not over-investment. If it doesn't work, the questions and identity system still enrich the scouting product (user preference data for recommendations). |

---

## Success Criteria (30 Days Post-Launch)

| Metric | Target | Why |
|--------|--------|-----|
| Unique users | 200+ | Proves the concept reaches beyond founder's network |
| Questions answered | 3,000+ | ~15 per user average = identity profiles being built |
| Identity reveals seen | 100+ | Users are reaching the payoff moment |
| Share card generated | 30+ | The viral mechanic works |
| Scouting tool clicks | 20+ | The bridge CTA converts |
| Email signups (from bridge) | 10+ | The funnel works end-to-end |

If we hit these in 30 days, double down on Choices as the acquisition channel. If we don't, the identity data still improves the scouting product, and we've lost 5 days, not 5 months.

---

## Bottom Line

**Football Choices is the right first ship — but only with the identity payoff.** Without it, we're launching a forgettable quiz. With it, we're launching a personality test that happens to be about football, with a built-in funnel to a scouting intelligence product.

The schema is ready (identity columns exist on `fc_users`). The questions need writing. The scoring needs building. The reveal needs designing. Five days of work, then ship.

**Next action: Write the 40 Tier 2 questions with dimension mappings. Everything else follows from that.**
