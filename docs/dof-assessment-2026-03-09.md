# Director of Football Assessment — 2026-03-09

## Context

I have reviewed the CEO strategic assessment, the PM task breakdown, the player viewer design spec, the 21 scouted profiles in the player database, the CSV data layer (523 players), the Obsidian vault (1,590 men's profiles), the pipeline architecture, and the normalized schema. This assessment is my operational response: what do I actually need from this tool to make transfer decisions, and where does the current plan get it right or wrong?

---

## 1. The 21 Profiles — Assessment

### Roster

| # | Name | Position | Archetype | Verdict | Profile Completeness |
|---|---|---|---|---|---|
| 1 | Kevin De Bruyne | CM | Controller-Creator | Benchmark | Full |
| 2 | Alisson Becker | GK | GK-Controller | Benchmark | Full |
| 3 | Lamine Yamal | RW | Dribbler-Creator | Benchmark | Full |
| 4 | Casemiro | DM | Destroyer-Cover | Pass | Full |
| 5 | Rodri | DM | Controller-Destroyer | Benchmark | Full |
| 6 | Achraf Hakimi | RB/RWB | Sprinter-Engine | Benchmark | Full |
| 7 | Jordan Pickford | GK | GK-Controller | Monitor | Full |
| 8 | Victor Osimhen | ST | Striker-Sprinter | Scout Further | Full |
| 9 | Jorgen Strand Larsen | CF | Striker-Target | Scout Further | Full |
| 10 | Ousmane Dembele | RW | Dribbler-Sprinter | Benchmark | Full |
| 11 | Maghnes Akliouche | RW/AM | Creator-Dribbler | Scout Further / Sign | Full |
| 12 | Nico Paz | AM | Creator-Controller | Monitor | Full |
| 13 | Randal Kolo Muani | ST | Sprinter-Engine | Scout Further | Full |
| 14 | Jaidon Anthony | LW | Sprinter-Dribbler | Scout Further | Full |
| 15 | Zion Suzuki | GK | GK-Controller | Scout Further / Sign | Full |
| 16 | Pau Cubarsi | CB | (pending) | Benchmark | Partial — no formal grade |
| 17 | Joao Neves | CM | Controller-Engine | Benchmark | Full |
| 18 | Declan Rice | CM/DM | Engine-Cover | Benchmark | Full |
| 19 | Carlos Baleba | DM | Engine-Destroyer | Scout Further / Sign | Full |
| 20 | Davis Keillor-Dunn | CF | Striker-Creator | Monitor | Full |
| 21 | Kenan Yildiz | LW/AM | Creator-Dribbler | Benchmark | Full — personality partial (INSP) |

### Position Coverage

| Position | Players | Names |
|---|---|---|
| GK | 3 | Alisson, Pickford, Suzuki |
| CB | 1 | Cubarsi (pending grade) |
| RB/RWB | 1 | Hakimi |
| LB/LWB | 0 | — |
| DM | 3 | Casemiro, Rodri, Baleba |
| CM | 3 | De Bruyne, Joao Neves, Rice |
| AM | 2 | Akliouche (also RW), Nico Paz |
| LW | 2 | Jaidon Anthony, Yildiz (also AM) |
| RW | 2 | Yamal, Dembele |
| ST/CF | 4 | Osimhen, Strand Larsen, Kolo Muani, Keillor-Dunn |

### Coverage Gaps — Operational Concern

**Critical gaps:**
- **Left-back:** Zero coverage. This is a position where the market is thin for quality and we have no profiled options. Unacceptable for a scouting tool.
- **Centre-back:** One profile, and it is pending a formal grade. Cubarsi is a benchmark-level talent we cannot acquire. We have no CB targets.

**Moderate gaps:**
- **Right-back:** One profile (Hakimi — benchmark, not acquirable). No alternative targets.
- **Central midfield:** Three profiles but they are all benchmarks or established stars. No "Scout Further" or emerging mid targets.

**Adequate:**
- GK (3 profiles including two actionable targets), DM (3 with one acquirable), ST/CF (4 with two actionable), Wide forwards (4 across LW/RW).

### Profile Completeness

- **20 of 21** have full archetype pairs and verdicts
- **1** (Cubarsi) is pending formal grade — research complete, format not applied
- **1** (Yildiz) has partial personality data (INSP, medium confidence on I and P poles only)
- **Personality data** exists for Yildiz; the remaining 20 profiles do not yet have structured personality scores in the database (ei/sn/tf/jp dimensions). The personality system is defined in the schema but not yet populated for most profiles.
- **Key moments** exist in narrative form for Yildiz (5 moments documented). Other profiles have scouting notes but key moments are not yet structured in the `key_moments` table (migration 007 creates it but data population is Phase A2 in the PM plan).

### Verdict Distribution

| Verdict | Count | Players |
|---|---|---|
| Benchmark | 9 | De Bruyne, Alisson, Yamal, Rodri, Hakimi, Dembele, Cubarsi, Joao Neves, Yildiz |
| Scout Further / Sign | 3 | Akliouche, Suzuki, Baleba |
| Scout Further | 3 | Osimhen, Strand Larsen, Kolo Muani |
| Monitor | 3 | Pickford, Nico Paz, Keillor-Dunn |
| Pass | 1 | Casemiro |

**Observation:** 9 of 21 are Benchmarks — players we study to understand what elite looks like at that position, not players we are trying to sign. This is intellectually correct but operationally unbalanced. A DoF needs the ratio inverted: more Scout Further and Monitor targets than Benchmarks. The benchmarks are reference points; the actionable profiles are the ones that close deals.

---

## 2. What I Want to See in 10 Seconds — Player Profile

The CEO says personality leads. I partially disagree. Here is my actual decision-making hierarchy when I open a player profile:

### Tier 1 — The Gate (0-3 seconds)

These determine whether I keep reading or close the tab:

1. **Position and age.** Does this player fill a need? Is the age profile right for our squad plan?
2. **Level and peak.** Is the quality sufficient? Is the ceiling above where they are now?
3. **Verdict / pursuit status.** Has our scout already made a recommendation? What is it?

If the player is 31, plays a position we do not need, and the verdict is Pass — I am done. Personality is irrelevant.

### Tier 2 — The Assessment (3-10 seconds)

If the gate is passed, these shape my evaluation:

4. **Archetype pair.** What type of player is this? Does the archetype fit our system? A Controller-Destroyer at DM is a fundamentally different proposition from an Engine-Cover at DM. This is where the product earns its differentiation.
5. **Personality type and traits.** NOW personality matters. Not as a lead, but as a filter on the archetype. Two Creator-Dribblers with identical attributes but different personalities are different signings. The INSP who is ice cold under pressure versus the ENTP who is combustible in contract disputes — that distinction changes my willingness to invest.
6. **Key moments / evidence.** I need proof that the personality assessment is grounded. "Ice Cold" means nothing without the Derby d'Italia brace off the bench. The evidence base converts opinion into intelligence.
7. **Contract situation and acquirability.** Is this player actually gettable? Contract length, release clause, club situation. A benchmark player under contract to 2029 is information, not opportunity.

### Tier 3 — The Detail (10-30 seconds, only if seriously considering)

8. **Market position.** True MVT versus market premium. Is the market overvaluing or undervaluing? Scarcity score — how many alternatives exist at this archetype-position combination?
9. **Attribute breakdown.** The compound metrics, the drill-down. I only go here if I am comparing two or three shortlisted players or verifying a specific concern (e.g., clinical finishing weakness flagged for Yildiz).
10. **Deployment notes and flags.** Specific tactical considerations, injury flags, age trajectory warnings.

### My Disagreement with the CEO

The CEO wants personality as the hero element — the first thing you see, the product differentiator, the headline feature. I understand the commercial logic: personality is unique, personality generates content, personality is what nobody else has.

But a DoF does not lead with personality. A DoF leads with need, quality, and availability. Personality is the tiebreaker, the risk filter, the conviction builder. It comes after I know the player fills a gap, is good enough, and is gettable.

**My recommendation:** The player card in list view should lead with position, level, and archetype. The personality badge should be visible but not dominant. When I open the full profile, the header should show the gate information (position, age, level/peak, verdict) and the archetype prominently. Personality gets a featured section immediately below the header — visible without scrolling, but not the first thing. The "WHO + HOW" pairing the PM designed is correct in concept but the visual weight should favor HOW (archetype) over WHO (personality) by roughly 60/40.

For the *public product* aimed at content creators and fans — the CEO may be right that personality should lead. Content creators want the sexy, novel angle. But the internal scouting tool should be built for decision-makers first and content consumers second. Build it right for the DoF; the content creator experience can be a presentation layer on top.

---

## 3. What I Want to See in 10 Seconds — App Level

### When I open the app, I need:

**A. The Pipeline — Where are we?**
- How many profiles exist at each tier (Tier 1 / Tier 2 / Tier 3)?
- How many have personality data populated?
- How many have key moments linked?
- When was the last data refresh (pipeline run, news ingest)?

This is internal tooling. A DoF managing a scouting operation needs to know the state of the intelligence, not just the intelligence itself.

**B. The Pursuit Board — What am I working on?**

This is the single most important view. Sort by pursuit status:

| Priority | Interested | Scout Further | Watch | Monitor |
|---|---|---|---|---|
| (urgent — active negotiations or imminent windows) | (have made internal decision to pursue) | (need more data before deciding) | (tracking for future windows) | (observing, no action planned) |

For each column, show: player name, position, club, age, archetype badge, days since last update. Click to open profile.

This is a Kanban board for transfer targets. It does not exist in the current design. The player list page has pursuit status as a *filter* — that is necessary but not sufficient. The pursuit board should be the default landing page, not the player list.

**C. Position Coverage Map**

A visual grid showing which positions have profiled targets and which are gaps. Not a fancy formation diagram — a simple matrix:

```
GK:  3 profiles (Alisson, Pickford, Suzuki)
CB:  1 profile  (Cubarsi — pending) ← RED: gap
RB:  1 profile  (Hakimi) ← AMBER: thin
LB:  0 profiles ← RED: critical gap
DM:  3 profiles
CM:  3 profiles
AM:  2 profiles
LW:  2 profiles
RW:  2 profiles
CF:  4 profiles
```

Clicking a position opens the filtered player list. Red/amber/green indicators based on number of actionable (non-Benchmark, non-Pass) profiles at that position.

**D. Recent Activity**

- Last 5 news stories tagged to profiled players
- Last 5 profile updates
- Upcoming contract expirations for monitored players

### Default sort for the player list

Not alphabetical. Not by level. Default sort should be **pursuit status (Priority first) > then by position > then by level descending.** This surfaces the actionable players first, grouped by where they play, with the best quality at the top of each group.

### Filters that matter

In order of how often I would use them:

1. **Position** — always the first filter
2. **Pursuit status** — always the second filter
3. **Level range** — quality floor
4. **Archetype** — system fit
5. **Age range** — squad planning
6. **Personality type** — tiebreaker (used rarely but high value when used)
7. **Profile tier** — sometimes I want to see only fully assessed profiles
8. **Club / League** — contextual

---

## 4. Feature Priority — DoF Ranking

Ranked by operational impact on transfer decision-making:

### 1. Search and Filter (HIGHEST PRIORITY)

Without search and filter, the app is a slideshow. I need to find players by position, archetype, level range, pursuit status, and age in under 5 seconds. URL-shareable filter states so I can send a shortlist link to my scout. This is table stakes — without it, the tool is unusable regardless of how good the profiles are.

The current design has this in Phase E4. It should be built alongside the player list from day one, not after the personality badge and playing style components.

### 2. Pursuit Pipeline View (NEW — NOT IN CURRENT PLAN)

A Kanban-style board showing players grouped by pursuit status. This is the DoF's operational dashboard. The CEO did not mention it. The PM did not plan it. It needs to exist. This is the view I open every morning.

### 3. Archetype Scoring

The 13-model scoring system is the analytical backbone. It answers "what type of player is this?" which is the second question after "what position?" The archetype pair (e.g., Creator-Dribbler) tells me more about a player's tactical identity than any stat line. The confidence level (high/medium/low) tells me how much to trust it.

This is correctly positioned in the CEO's hierarchy at #2 and the PM's plan at Phase C. It should stay there.

### 4. Progressive Disclosure

The "Sophistication Simplified" principle is operationally correct. I do not want to see 48 attributes when I open a profile. I want to see the compound category scores (Mental / Physical / Tactical / Technical), and drill into models and attributes only when investigating a specific question. The drill-down architecture in the design spec is well thought out.

However: do not over-engineer this for v1. A collapsible section is progressive disclosure. An animated transition is polish. Ship the collapsible section first.

### 5. Key Moments + News Links

This is the CEO's highest-leverage feature and I agree it is high value — but not highest priority. Key moments convert a subjective assessment into an evidence-backed assessment. When I present a signing recommendation to the board (or, in the product context, when a content creator uses our assessment in their content), the evidence base is what makes it credible.

The schema for this (migration 007) is ready. The data population (Phase A2) is manual and time-consuming. Prioritize populating key moments for the 3 "Scout Further / Sign" targets (Akliouche, Suzuki, Baleba) first, then the Scout Further group, then Benchmarks. The Benchmarks do not need key moments urgently — we are not trying to sign them.

### 6. Market Position

True MVT versus market premium, scarcity scoring. This matters when I am deciding whether a target is overpriced or a bargain. Yildiz at Transfermarkt's EUR 75m versus our assessment of EUR 120-150m is a meaningful data point — it means the market has not caught up yet, which changes timing strategy.

But this is a refinement, not a foundation. The core product works without it. Add it after the profile and search are solid.

### 7. Personality Display

Here is where I break from the CEO. Personality is the *differentiator* for the commercial product but it is not the *highest-priority feature* for the operational tool. I rank it 7th because:

- Only 1 of 21 profiles currently has structured personality data (Yildiz, partial)
- The personality system requires qualitative research per player — it cannot be computed from stats
- The display component (badge, dimension bars, traits) is straightforward to build but useless without data
- The data population bottleneck means personality will be sparse for months

Build the display component (Phase C1 in PM plan — 2 hours). Do not prioritize it over search, filters, or archetype display. Populate personality data progressively as profiles are assessed. When there are 10+ profiles with personality, it starts to become a filterable dimension. At 50+, it becomes a product feature. At 21 profiles with 1 having data, it is a placeholder.

### 8. Attribute Detail

The drill-down into individual attributes with multi-source comparison (EAFC, StatsBomb, Understat, scout grade). This is deep analytical functionality. I use it when comparing two finalists for a position or when investigating a specific weakness flagged in the profile. Important but low-frequency. Build it, but it is last in the core feature set.

### 9. Tier System

The Tier 1/2/3 labeling (migration 007 adds `profile_tier` to `player_profiles`). Conceptually correct — users need to know which profiles are scout-assessed versus data-derived. Operationally, this is a badge on a card, not a feature. The migration is written. Apply it. Put a small label on the card. Move on.

---

## 5. What Is Missing From the Plan

### A. Acquirability Signal

None of the current features directly address whether a player is *gettable*. Contract length, release clause, club financial situation, recent transfer request, loan status — these are the signals that turn a "Scout Further" into an "Interested" or a "Priority." The `player_status` table has contract tags and loan status, but these are not surfaced prominently in the design.

**Recommendation:** Add contract expiry date and release clause to the player profile header, right next to age and club. These are gate information, not detail.

### B. Comparison Mode

I frequently need to compare 2-3 players side by side. "We need a DM — is Baleba or Kolo Muani the better fit for our system?" The current design mentions comparison as a v2 feature. For an operational tool, it should be v1. Even a simple table comparing two players' archetype scores and key attributes would be valuable.

### C. Shortlist Management

The pursuit status system is a start, but I need shortlists — named groups of players for specific roles. "DM shortlist — January window" with Baleba, Kolo Muani, and two Tier 2 names. The current system has one flat pursuit status per player. A player could be on multiple shortlists (DM shortlist and "versatile midfielders" shortlist).

This is a v2 feature but should be designed for in the data model now.

### D. Update Freshness

Every profile should show "Last updated: 14 days ago" or similar. Scouting intelligence decays. A profile last updated 6 months ago needs re-assessment. The `updated_at` timestamps exist in every table — surface them.

---

## 6. Summary — What I Would Build First

If I had 4 weeks and one developer, here is my sequence:

1. **Week 1:** App shell + player list with search/filter (position, pursuit status, level, archetype, age). Player cards showing position, level/peak, archetype badge, pursuit status, club, age. No personality, no drill-down, no charts.

2. **Week 2:** Player detail page with header (gate info + archetype) and compound metric gauges. Pursuit pipeline board as default landing page. Position coverage map on dashboard.

3. **Week 3:** Key moments display (data population for the 3 "Sign" targets). Personality display component (ready for when data is populated). Progressive disclosure on attribute detail.

4. **Week 4:** Market position section. Comparison mode (basic). News feed integration. Apply tier badges.

The CEO's sequence puts personality display and key moments in weeks 1-2. I would push personality display to week 3 and key moments data population to week 3, while pulling search/filter and the pursuit board forward to week 1-2.

---

## 7. Final Word

This tool has genuine potential. The archetype system is strong — 13 models with scoring and confidence is more analytically rigorous than anything on the public market. The personality layer, once populated, will be genuinely unique. The key moments + evidence linking is the proof mechanism that converts subjective scouting into defensible intelligence.

But right now, we have 21 profiles, 9 of which are benchmarks we cannot sign, 1 with partial personality data, and a viewer that does not exist yet. The priority is not making the profiles beautiful — it is making them findable, comparable, and actionable.

Build the operational tool first. The content product comes second.

The 21 profiles are good. The coverage gaps (LB, CB) need addressing immediately — not because the app needs more data, but because any DoF looking at this list would ask "where are my defensive targets?" and finding none would question the tool's completeness. Next batch of profiles should be: 3-4 centre-backs, 2-3 left-backs, 2-3 central midfield targets at the "Scout Further" level. That gives us positional coverage across the spine and both flanks.

One more thing: Cubarsi needs his formal grade applied. A pending grade on a Benchmark player looks unfinished. Either grade him or note explicitly why the grade is deferred.

---

*Prepared by: Director of Football, Chief Scout*
*Date: 2026-03-09*
