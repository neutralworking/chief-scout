# Football Choices — UX + DOF Assessment
**Date**: 13 March 2026

---

## UX Assessment

### First Impression (2/5)
The page opens on "All-Time XI" tab, which is the right call — it's more visually engaging than the trivia list. But the pitch visualization is empty with 11 dashed circles and no explanation of what to do. A first-time user sees a blank pitch and has to figure out they need to tap a circle. No onboarding, no prompt, no animation drawing the eye.

**The "Choices" tab label is wrong.** It says "Choices" for the trivia section and "All-Time XI" for the squad builder — but the whole page is called "Football Choices." This is confusing. The tabs should be "Build Your XI" and "Quick Fire" or similar.

### Core Loop (3/5)
**All-Time XI**: Tap empty slot → see 10 candidates → pick one → see community stats → next slot. This is solid. The 4/3 aspect ratio cards with initials look decent, the percentage reveal after picking is satisfying. But 10 candidates per slot with no filtering, sorting, or era grouping makes the grid overwhelming on mobile (5 rows of 2).

**Quick Fire Choices**: Category menu → question → tap option → see percentages → auto-advance (1.5s). The loop is fast and satisfying. The auto-advance toggle is smart. But the questions themselves are the weakness — see DOF section below.

### Information Architecture (2/5)
- "Choices" tab within "Football Choices" page — naming collision
- Category icons are emojis stored in the DB — fine for MVP, limiting long-term
- The stats bar ("Your choices: 47") is vanity — it doesn't tell you anything useful
- No progress indicator for "how many questions are left in this category"
- No "identity" or "profile" output — the system tracks votes but never tells you what they mean

### Emotional Design (2/5)
- All option cards look identical regardless of content. A "Greatest player of all time?" question should feel different from "Your preferred formation?"
- No personality theming from SACROSANCT is applied
- The results reveal (percentage overlay + bar) is the best moment — it creates "I agree with the community" or "I'm an outlier" feelings. Build on this.
- The All-Time XI pitch visualization is atmospheric (emerald gradient, pitch markings) but the player nodes are too small on mobile

### Edge Cases (3/5)
- "All caught up!" empty state exists and is decent
- Loading spinner is present
- Pass/skip is available (good)
- No offline handling for PWA — if you lose connection mid-question, silent failure
- No error states shown to user

### Conversion & Retention (1/5)
- **Nothing brings a user back.** No streak rewards, no leaderboard, no daily question, no "your identity is X% Purist, Y% Pragmatist" payoff
- The vote count is the only progression metric and it's meaningless
- No share functionality — can't share your XI or your identity profile
- No connection to the scouting product — Football Choices is a dead end that doesn't funnel users anywhere

---

## DOF Assessment: Question Quality

### Diagnosis: Pub Quiz, Not Football Intelligence

The current 24 questions read like a pub quiz night: "Greatest player of all time?", "Best PL striker ever?", "More iconic celebration?" These are fine for volume 1 of a casual game, but they don't reveal anything about how the user thinks about football. They're **opinion polls**, not **footballing philosophy questions**.

Chief Scout's differentiator is the personality/archetype system. Football Choices should be the consumer-facing expression of that system. Every question should map to a dimension of footballing philosophy that builds toward a "Footballing Identity" profile.

### What's Missing: Question Depth Tiers

**Current state**: All questions are Tier 1 (surface-level preference polls).

**Needed**:

#### Tier 1 — Gateway Questions (current level, keep ~10)
Surface-level, accessible, high engagement. Everyone has an opinion.
- "Greatest player of all time?" — fine
- "Best PL striker ever?" — fine
- These exist to onboard users and generate initial data

#### Tier 2 — Philosophy Questions (MISSING — need 30+)
These reveal HOW you think about football. They map to the SACROSANCT personality dimensions.

**Game Reading (Analytical vs Instinctive):**
- "You're 1-0 up with 10 minutes left. What do you do?" → (A) Slow the game, keep possession, manage the clock / (B) Press higher, try to score a second / (C) Bring on a defensive mid, protect the lead / (D) Change nothing — trust the players on the pitch
- "Which type of goal gives you more satisfaction?" → (A) A 30-pass team move / (B) A moment of individual brilliance / (C) A set-piece routine executed perfectly / (D) A last-minute winner from nowhere
- "Your star striker hasn't scored in 5 games. What's the problem?" → (A) Tactical — he's being marked out of the game / (B) Mental — confidence is shot / (C) Physical — fatigue / (D) Statistical noise — his xG is fine, goals will come

**Motivation (Extrinsic vs Intrinsic):**
- "Which player attitude do you value most?" → (A) The one who trains hardest every day regardless of form / (B) The one who raises their game in big matches / (C) The one the other players follow into battle / (D) The one who makes everyone else better
- "Your team wins the league. Which moment matters most to you?" → (A) The final whistle / (B) The open-top bus parade / (C) Watching the stats back — dominating every metric / (D) The dressing room celebration, players you built together

**Social Orientation (Soloist vs Leader):**
- "You can sign one player to transform a struggling team. Who are you looking for?" → (A) A dominant centre-back who organizes the defence / (B) A world-class striker who finishes chances / (C) A midfield controller who dictates tempo / (D) A captain-figure who lifts the dressing room
- "Best type of assist?" → (A) A perfectly weighted through ball / (B) A cross delivered into the danger zone / (C) A dummy run that creates space for someone else / (D) A driving run and cutback

**Pressure Response (Competitor vs Composer):**
- "Champions League semi-final, away leg, 2-0 down at half-time. Your team talk is:" → (A) Calm tactical adjustments — we stick to the plan / (B) Fire and brimstone — show them who we are / (C) Individual challenges — "You vs. your man, win that battle" / (D) Reminders of the big picture — we've been here before

#### Tier 3 — Tactical Scenarios (MISSING — need 20+)
These test football knowledge and tactical understanding. They map to archetype preferences.

- "You inherit a squad with no natural left-back. What do you do?" → (A) Buy one — it's a non-negotiable position / (B) Convert a left-sided centre-back / (C) Use an inverted right-back / (D) Play 3-at-the-back and avoid the problem
- "Your 35-year-old striker still scores 20 a season but can't press. Do you:" → (A) Build the team around him — goals are goals / (B) Move him on — the system matters more than the individual / (C) Rotate him — 60 minutes then replace / (D) Change the system — drop the press when he plays
- "Which signing is better value?" → (A) A 19-year-old with 5 goals in Ligue 1 for £30m / (B) A 27-year-old with 15 goals in the Bundesliga for £50m / (C) A 24-year-old free agent from Serie A / (D) A 31-year-old relegated star available for £8m
- "You're building from scratch. First hire?" → (A) An elite goalkeeping coach / (B) A data analytics team / (C) A world-class physio department / (D) The best academy director available

#### Tier 4 — Transfer Intelligence (MISSING — need 15+)
These connect to Chief Scout's scouting product and player database.

- "Which player profile fills this gap best? [Shows squad radar with weak left-side creativity]" → Options are 4 real players from the database with their archetype/personality badges
- "This player's contract expires in 6 months. Sign now for £30m or wait for free?" → Context about age, injury history, competition
- "Scout report says: 'Technically brilliant, inconsistent in big games, needs an arm around him.' What personality type is this?" → Links to SACROSANCT personality types

### What's Missing: Identity Payoff

The entire point of Football Choices should be building toward a **"Footballing Identity"** — a personality profile based on the user's choices. Currently the system collects votes but never synthesizes them.

**Proposed Identity Dimensions** (derived from vote patterns):

| Dimension | Low End | High End | Derived From |
|-----------|---------|----------|-------------|
| **Philosophy** | Pragmatist | Purist | Tactical choices, formation preferences |
| **Temperament** | Controlled | Passionate | Pressure response questions |
| **Eye for Talent** | Proven Quality | Raw Potential | Transfer pick age preferences |
| **Style** | Structured | Expressive | Style, era, and aesthetic preferences |
| **Era Affinity** | Traditionalist | Modernist | Era and GOAT questions |

After 10+ questions, show: "Your Footballing Identity: **The Romantic Pragmatist** — You believe in beautiful football but won't sacrifice results for aesthetics. You'd sign prime Zidane and tell him to track back."

After 25+ questions, show a fuller profile with radar chart.

### Missing Categories

The current 8 categories are fine but need expansion:

| Current | Status | Notes |
|---------|--------|-------|
| GOAT Debates | Keep (4 Qs) | Gateway content, drives engagement |
| Best in Position | Keep (5 Qs) | Needs non-PL variants (La Liga, Serie A, Bundesliga, all-time) |
| Era Wars | Keep (3 Qs) | Good concept, need more team vs team matchups |
| Transfer Picks | Expand (3 Qs) | Core DOF content — needs 15+ questions |
| Tactical | **Major expansion** (2 Qs) | Only 2 questions for the core differentiator — needs 20+ |
| Clutch | Keep (2 Qs) | Good variety content |
| Style | Keep (3 Qs) | Expand with "which goal is better" video-linked questions later |
| Hypothetical | Keep (2 Qs) | Fun variety content |

**New categories needed:**

| Category | Why | Sample Count |
|----------|-----|-------------|
| **Philosophy** | Maps directly to identity profiling. "How do you play?" | 15 |
| **Squad Building** | DOF-level: age profiles, depth, wages, academy | 10 |
| **Pressure Moments** | Scenario-based. Maps to Competitor/Composer axis | 10 |
| **Scouting Eye** | "Spot the talent" — connects to Chief Scout product | 10 |
| **Manager Mind** | Team talks, substitutions, formation changes | 10 |

---

## Priority Recommendations

### Critical (Before Production Launch)

1. **Add 30 Tier 2 philosophy questions** — These are the product. Without them, Football Choices is a pub quiz, not a footballing identity builder. Seed via an expanded `20_seed_choices.py`.

2. **Build the Identity Payoff** — After 10+ questions, synthesize votes into a "Footballing Identity" summary. Store on `fc_users`. This is the shareable moment that drives virality.

3. **Fix naming** — Rename tabs to "Build Your XI" and "Quick Fire." Remove "Choices" label from trivia tab since the whole page is called Football Choices.

### Major (Month 1)

4. **Add progress/completion signals** — "12/24 questions answered in Tactical" progress bar per category. Creates completion drive.

5. **Share card** — Generate a shareable image of your All-Time XI or your Footballing Identity. This is the viral mechanic.

6. **Daily question** — One new question per day, highlighted in the UI. Creates return habit. Can be generated from templates without manual curation.

### Minor (Polish)

7. **Era grouping in All-Time XI** — Group 10 candidates into Legend/Classic/Modern tabs instead of one flat grid.

8. **Category progress on menu** — Show completion rings around category icons on the menu screen.

9. **Sound/haptics** — Subtle tap feedback on vote. Satisfying "ding" on streak milestones (5, 10, 25).

---

## Implementation Path

```
Week 1: Write 30 Tier 2 questions (Philosophy, Pressure, Squad Building)
         Update 20_seed_choices.py with new categories + questions
         Add identity dimension tracking to fc_users table

Week 2: Build identity calculation logic (API route)
         Show identity summary after 10+ questions
         Fix tab naming + add category progress

Week 3: Share card generation (All-Time XI + Identity)
         Daily question feature
         Connect to scouting product ("See players who match your style →")
```
