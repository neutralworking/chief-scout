# Kickoff Clash — Core Mechanics Design (v3)

> Card battler / roguelike built on Chief Scout data. Balatro meets football.
> **v3** — The XI IS the hand. Building it IS the game. The match is the spectacle.

---

## Target Player
Someone who plays Balatro on their phone, watches football on weekends, and has opinions about whether Pirlo or Kanté was more important. 10-minute sessions.

## Tone
Comedic fictional players with absurd bios. Not a serious sim. Every card tells a story. Pub quiz meets poker night.

## What Changed From v2
v2 had you playing action cards during a 5-round match to nudge probability percentages. The match was a passive text log. The player cards (your squad) sat in an auto-populated XI and contributed a number — you never *played* them.

v3 flips this: **selecting your XI is the core mechanic.** The match is a fast, dramatic spectacle that evaluates your lineup choices. Action cards are reduced to one tactical intervention per match. The strategic depth moves to squad building, XI selection, and chemistry discovery.

---

## 1. The Core Loop — "The Season"

A run is a **season** of 5 matches. Each match is harder.

```
START RUN
  → Pick formation (determines slot types)
  → Pick playing style (determines synergy bonuses)
  → Get starter deck (8 player cards)

EACH MATCH:
  1. SCOUT REPORT: See opponent strength, weakness, style
  2. BUILD YOUR XI: Drag 5 cards from deck into formation slots
     → Synergies light up in real-time as you place cards
     → Chemistry bonuses cascade visually
     → "Lock In" when ready
  3. THE MATCH: 3 key moments play out (30-45 seconds)
     → Your XI strength vs opponent, with dramatic resolution
     → ONE tactical card intervention at a moment of your choosing
     → Goals resolve based on XI composition + chemistry
  4. POST-MATCH: Revenue, durability checks
  5. TRANSFER WINDOW: Shop / academy / sell

WIN CONDITION: Beat all 5 opponents (W/D counts as progress, 3 losses = relegated)
```

---

## 2. The XI Builder — "Your Hand"

This is the flagship screen. 60% of gameplay time is spent here.

### How It Works

1. **Formation view** at the top: 5 empty slots arranged in your chosen formation
2. **Your deck** below: all player cards in a scrollable row, grouped by position
3. **Drag a card into a slot** (or tap card → tap slot on mobile)
4. As each card lands:
   - Slot fills with the card (animated snap)
   - **Chemistry scan fires** — if the new card creates a synergy, it lights up immediately
   - Running **XI Strength** total updates with cascade animation
   - **Near-miss hints**: "One more Creator unlocks Creative Spark"

### Chemistry as Scoring

Chemistry is no longer background math — it's the visible scoring system, like poker hand types.

| Tier | Trigger | Visual | Equivalent |
|------|---------|--------|------------|
| T1 — Archetype Pair | 2+ same archetype in XI | Cards glow with shared color, connection line | Pair / Three of a Kind |
| T2 — Role Combo | Named role pair (Regista + Mezzala, etc.) | Golden link between the two cards | Two Pair |
| T3 — Personality Resonance | 3+ same personality theme | Theme aura radiates from cards | Flush |
| T4 — Perfect Dressing Room | All 5 personality themes represented | Entire XI pulses, 2x multiplier | Royal Flush |

When a synergy fires during XI building, the bonus cascades visually:
```
[Place Hurst (Regista) next to N'Dongo (Mezzala)]
  → "THE PIRLO-BARELLA" banner flashes
  → +38 bonus animates upward from the connection
  → XI Strength counter ticks up: 247 → 285
  → Sound: satisfying "cha-ching" (like Balatro chips)
```

This IS the Balatro moment. The hand evaluation happens during building, not during the match.

### Slot Constraints

Each formation slot accepts specific position groups:

| Slot | Accepts |
|------|---------|
| GK | GK only |
| DEF | CD, WD |
| MID | DM, CM, WM, AM |
| WIDE | WM, WF, WD |
| FWD | CF, WF, AM |

**6 slots, not 5.** GK is now included (see section 7 below). This means formations are:
- **4-3-3**: GK, DEF, DEF, MID, WIDE, FWD
- **4-4-2**: GK, DEF, MID, MID, WIDE, FWD
- **3-5-2**: GK, DEF, MID, MID, MID, FWD

### Playing Style Bonus

Your chosen playing style gives bonus multiplier to matching archetypes in the XI:

| Style | Bonus Archetypes | Effect |
|-------|------------------|--------|
| Tiki-Taka | Passer, Controller, Creator | +15% power per matching card |
| Gegenpressing | Engine, Destroyer, Sprinter | +15% per matching |
| Counter-Attack | Cover, Sprinter, Striker | +15% per matching |
| Direct Play | Target, Powerhouse, Passer | +15% per matching |
| Total Football | All archetypes | +5% flat per card |

This creates the run-level strategic frame: your style choice at the start determines which cards you hunt for in the shop.

---

## 3. The Match — "The Spectacle"

The match is **not interactive** except for one tactical intervention. It's a 30-45 second spectacle that evaluates your XI choices.

### Match Strength Calculation

```
base_xi_power = sum of all 6 cards' power values
chemistry_bonus = sum of all synergy bonuses (T1-T4)
style_bonus = playing style multiplier on matching archetypes
role_effects = passive abilities from tactical roles (Regista +5% connections, etc.)
manager_mods = persistent modifiers from manager cards

TOTAL_STRENGTH = base_xi_power + chemistry_bonus + style_bonus + role_effects + manager_mods
```

### 3 Key Moments

The match resolves in **3 dramatic beats**, not 5 rounds of card-playing.

| Moment | Time | What Happens |
|--------|------|-------------|
| **Opening** | 0'-30' | Sets the tone. Determined by midfield strength. Commentary establishes the flow. |
| **Turning Point** | 30'-60' | Where the match swings. Biggest goal probability window. Tactical card can be played here. |
| **Climax** | 60'-90' | Final resolution. Durability effects fire (tired players, Glass risk). Drama peaks. |

Each moment resolves as:
```
moment_strength_you = TOTAL_STRENGTH × moment_weight + tactical_card_bonus
moment_strength_opp = opponent_base × moment_weight + opponent_action

difference = moment_strength_you - moment_strength_opp

if difference > threshold_high → YOU SCORE (guaranteed)
if difference > threshold_mid → YOU SCORE (75% chance)
if difference near zero → EITHER team scores (50/50)
if difference < -threshold_mid → THEY SCORE (75%)
if difference < -threshold_high → THEY SCORE (guaranteed)
```

**Key change from v2:** High enough strength difference guarantees goals. Your decisions are directly causal, not just nudging a 5-50% window. Build a 350-strength XI vs a 55-strength opponent and you WILL win. It's earned.

### The Tactical Card

You get a **hand of 3 tactical cards** at the start of each match (drawn from your tactical deck). You may play **exactly one** at any moment of your choosing.

Timing matters:
- Play an attacking card at the **Opening** for early dominance
- Save a defensive card for the **Climax** to protect a lead
- Use a mind game at the **Turning Point** to swing momentum

This is a single, meaningful decision — not 5 rounds of "pick the biggest modifier."

### Match Presentation

Each moment plays as a dramatic event sequence:

```
[OPENING — 0'-30']
  → Commentary builds: "Hurst controls the midfield..."
  → If synergy fires: "The Pirlo-Barella connection is pulling them apart!"
  → Resolution: "24' — GOAL!" [big, amber, cascading]
  → Or: "Tight first half-hour. Nothing doing."

[TURNING POINT — 30'-60']
  → Prompt: "Play a tactical card?" [your 3 cards shown]
  → Player taps one (or skips)
  → Card animation plays
  → Resolution with drama

[CLIMAX — 60'-90']
  → Durability tension: "Kowalski (Glass) is tiring..."
  → Final resolution
  → FULL TIME whistle
```

Total match time: 30-45 seconds of watching + one card decision. Fast enough for 10-minute sessions.

---

## 4. Durability — Unchanged From v2

The durability system works. Keep it exactly as-is.

| Tier | XI Weight | Risk | Fantasy |
|------|-----------|------|---------|
| Glass | ×0.4 | 20% shatter post-match | R9 — transcendent but fragile |
| Fragile | ×0.7 | 10% injury (miss 1 match) | Neymar — out 6 weeks, back for the big one |
| Standard | ×1.0 | None | The professional |
| Iron | ×1.5 | None | Kanté — never misses |
| Titanium | Auto-start | None | Messi at Barcelona |
| Phoenix | ×0.6 | 30% shatter, but survive 3 → Iron | Comeback kid |

In v3, durability affects XI building decisions: do you risk your Glass legendary in a mid-season match, or save them for the final?

---

## 5. Manager Cards — "The Jokers"

**This is where the real depth lives.** Manager cards are persistent modifiers that last the entire run, like Balatro's Jokers.

You can hold up to **3 manager cards** at once. Buy them in the shop, find them in packs.

### Example Manager Cards

| Card | Effect | Fantasy |
|------|--------|---------|
| The Tinkerman | +20% XI strength if you change 2+ players from last match | Ranieri / rotation |
| The Dinosaur | +30% to Target and Powerhouse, -20% to Creator | Big Sam / route one |
| The Professor | +25% to Controller and Passer, +10% if no Striker in XI | Wenger / total control |
| Youth Developer | Academy cards gain +10 power permanently | Youth academy obsessive |
| The Mourinho | +40% in Climax moment if you're losing | Siege mentality |
| Loyalty Bonus | +5 power per match a card has been in your deck | Rewards long-term squad |
| The Gambler | Glass and Phoenix cards get +30% power | High risk, high reward |
| Mr. Moneybags | +50% sell prices, -20% XI strength | Business over football |
| Cup Final Manager | +30% in match 5 only | Big-game specialist |
| Scout's Eye | See 1 extra card in every shop pick | Better recruitment |
| The Hairdryer | +20% in Climax moment, always | Fergie time |
| Counter-Press | +15% if opponent scored in the previous moment | Klopp energy |

Manager cards are the primary source of **run variety**. Two runs with the same formation and style will play completely differently based on which managers you collect.

---

## 6. Economy — Streamlined From v2

### Revenue Chain (unchanged)
```
XI entertainment (archetype fan pull + personality) → Base Fans
Goals scored/conceded → Bonus Fans
Synergy tier bonuses → Bonus Fans
min(Total Fans, Stadium Capacity) × Ticket Price = Revenue
```

### Stadium Progression (unchanged)
| Tier | Name | Capacity | Ticket |
|------|------|----------|--------|
| 1 | The Cage | 500 | £10 |
| 2 | The Community Ground | 2,000 | £15 |
| 3 | The Arena | 8,000 | £20 |
| 4 | The Theatre | 25,000 | £30 |
| 5 | The Cathedral | 60,000 | £40 |

### Shop — Transfer Window

Post-match shop offerings:

| Item | Cost | What You Get |
|------|------|-------------|
| Card Pick | £15,000 | Choose 1 of 3 player cards |
| Rare+ Pick | £35,000 | Choose 1 of 3 (Rare or better) |
| Tactical Pack | £8,000 | 2 random tactical cards added to your match hand pool |
| Manager Card | £25,000 | Random manager modifier (hold up to 3) |
| Academy Player | Free-£5,000 | Tier-dependent youth card |
| Academy Upgrade | £30,000 | Better academy tier |
| Stadium Food | £25,000 | +£5 ticket price permanently |
| Heal Card | £12,000 | Restore an injured player |

**Removed from v2:** Moment Pack, Mind Games Pack, Mixed Pack, Reroll, Scout Report. The action card economy is simplified because you only play 1 per match. Tactical cards come from a smaller, curated pool.

---

## 7. GK Inclusion

v2 had no GK slot in any formation. GK characters existed but never played. v3 fixes this.

- All formations have a **GK slot** (6 cards in XI, not 5)
- GK archetype has 4 sub-types: Cat (shot-stopping), Wall (commanding), Libero GK (sweeper), Shotstopper (reflexes)
- GK contributes to chemistry (e.g., "Modern GK" combo: Ball-Playing GK + Libero = T2 synergy)
- GK power affects Climax moment defensively

Starter deck includes 1 GK. Shop and academy can offer GK cards.

---

## 8. Opponent Design — Unchanged From v2

| Match | Opponent | Base Strength | Style |
|-------|----------|---------------|-------|
| 1 | FC Warm-Up | 150 | Passive |
| 2 | Dynamo Midtable | 220 | Balanced |
| 3 | Real Ambition | 300 | Attacking |
| 4 | AC Nightmare | 370 | Counter |
| 5 | The Invincibles | 450 | Adaptive |

Each opponent has:
- A visible weakness archetype (e.g., "Weak to Creator")
- A star player (named, with a special ability)
- A formation and style
- Synergies that fire against you

Opponent strengths are re-tuned for the new strength scale (higher numbers because chemistry bonuses are now the primary score driver).

---

## 9. Tactical Cards — Simplified

Instead of 26 action cards with overlapping effects, v3 has **12 tactical cards** in a focused pool.

### Attacking (4)
| Card | Effect | Flavour |
|------|--------|---------|
| Press High | +20% your moment strength | PRESS! PRESS! PRESS! |
| Through Ball | +25% if Creator or Passer in XI, else +10% | THE GAP! |
| Overload | +30% this moment, -15% next moment | Everyone forward! |
| Set Piece | +20%, doubled if Target or Commander in XI | Everyone in the box |

### Defensive (4)
| Card | Effect | Flavour |
|------|--------|---------|
| Park The Bus | -25% opponent moment strength, -10% yours | Two banks of four. |
| Man Mark | Cancel opponent's star player ability this moment | Don't let him breathe. |
| Tactical Foul | Cancel opponent action, 20% red card risk | Take one for the team. |
| Time Waste | -20% opponent, -30 fans | The crowd is NOT happy. |

### Wild (4)
| Card | Effect | Flavour |
|------|--------|---------|
| Last-Minute Drama | +40%, only playable in Climax | ADDED TIME... |
| The Hairdryer | +25% next moment | Nobody's sitting down. |
| Wind Up | -15% opponent, 15% backfire | Did you just say that? |
| Crowd Surge | +20% if Catalyst in XI, else +5% | LISTEN to this atmosphere! |

You draw 3 of these at match start. Play exactly 1 during the match, at any moment.

---

## 10. Meta-Progression

### Chemistry Book
Discovered synergies are logged permanently across runs. Collecting all T2 combos, finding the Perfect Dressing Room — these are achievements that persist.

### Hall of Fame
Best runs recorded: highest revenue, most goals, fewest losses, best XI strength.

### Manager Collection
All manager cards you've ever found. Viewing them between runs.

---

## 11. Screen Flow

```
TITLE → SETUP (formation + style) → PRE-MATCH LOOP:
  ┌─────────────────────────────────────────────────┐
  │  SCOUT REPORT → XI BUILDER → MATCH → POST-MATCH │
  │       ↓                                          │
  │  TRANSFER WINDOW ────────────────────────────────┘
  │       (repeat for 5 matches)
  └──→ END SCREEN (Champions! / Relegated!)
```

### Key Screens
1. **Title** — New Season / Continue / History
2. **Setup** — Formation + Style picker
3. **Scout Report** — Opponent preview (strength, weakness, star player)
4. **XI Builder** — THE flagship screen. Formation slots + deck + chemistry cascade
5. **Match** — 3-moment spectacle with 1 tactical card intervention
6. **Post-Match** — Score, revenue, durability checks
7. **Transfer Window** — Shop, academy, sell, manager cards
8. **End** — Run summary, Hall of Fame

---

## 12. What's Cut From v2

| Cut | Reason |
|-----|--------|
| 5-round match structure | Replaced by 3 key moments |
| Large action card hand (5+) | Replaced by draw 3, play 1 |
| Auto-populated XI | Replaced by player-built XI (the core mechanic) |
| 26 action cards | Reduced to 12 focused tactical cards |
| Round-by-round commentary log | Replaced by 3 dramatic event sequences |
| Strength preview percentages | Replaced by visual XI strength cascade |
| Discard mechanic | Unnecessary with 3-card hand |
| Substitution cards | Unnecessary — you pick your own XI |
| 5 formation slots (no GK) | Expanded to 6 slots with GK |

---

## 13. File Structure (implementation)

```
apps/kickoff-clash/src/
  app/
    page.tsx          → Game shell + phase routing
  components/
    TitleScreen.tsx
    SetupPhase.tsx
    ScoutReport.tsx
    XIBuilder.tsx      → THE flagship component
    MatchSpectacle.tsx → 3-moment match presentation
    PostMatch.tsx
    ShopPhase.tsx
    EndScreen.tsx
    CardDisplay.tsx    → Player card component
    TacticalCard.tsx   → Tactical card component
    ManagerCard.tsx    → Manager card component
  lib/
    scoring.ts         → XI strength calculation, chemistry cascade
    chemistry.ts       → Synergy detection (keep, enhance visuals)
    run.ts             → Run state management
    actions.ts         → 12 tactical cards (simplified)
    economy.ts         → Revenue, shop, academy (mostly unchanged)
    managers.ts        → NEW: manager card definitions + effects
    transform.ts       → Character → Card pipeline (unchanged)
    opponents.ts       → Opponent definitions + match resolution
```

The 2530-line `page.tsx` monolith is decomposed into focused components.
