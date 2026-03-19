# Kickoff Clash — Core Mechanics Design (v2)

> Card battler / roguelike built on Chief Scout data. Balatro meets football.
> **v2** — redesigned match loop: 5 rounds per match, action card hands, durability system, academy.

---

## Target Player
Someone who plays Balatro on their phone, watches football on weekends, and has opinions about whether Pirlo or Kanté was more important. 10-minute sessions.

## Tone
Comedic fictional players with absurd bios. Not a serious sim. Every card tells a story.

---

## 1. The Core Loop — "The Season"

A run is a **season** of 5 matches. Each match is harder.

```
START RUN
  → Pick formation (determines XI slots)
  → Pick playing style (determines synergy bonuses)
  → Get starter deck (player cards + action cards)

EACH MATCH:
  1. DECK SHUFFLE: XI auto-populates via weighted random
  2. PLAY 5 ROUNDS (15'/30'/45'/60'/75')
     → XI generates passive score
     → Draw action cards, play from hand
     → Round resolves with goal probabilities
  3. POST-MATCH: Durability checks (shatter/injury/Phoenix promotion)
  4. TRANSFER WINDOW: Shop / academy / sell

WIN CONDITION: Beat 5 opponents
LOSS: Lose 3 matches total
```

---

## 2. The XI — "Your Joker Row"

### Deck Shuffle & Team Selection

Pre-match, the deck shuffles and the XI auto-populates. This is NOT best-fit — it's **weighted random**.

For each formation slot:
1. Gather all eligible cards (matching position group)
2. Each card's **selection weight** = `base_durability_weight`
3. Titanium cards skip RNG — locked starters
4. Weighted random pick from eligible pool

If you have 4 GKs in your deck, each has roughly a 25% chance (modified by durability) of being selected. **Deck composition is a strategic decision** — stacking positions increases your odds of landing the right player.

### What the XI Does

The XI generates **base strength** each round. This comes from:
1. **Sum of player power** in the XI
2. **Chemistry bonuses** — archetype pairs, role combos, personality resonance
3. **Style alignment** — how many XI players match your playing style
4. **Role abilities** — passive effects from tactical roles (Regista boosts connections, Sentinelle protects weak link, etc.)

The XI recalculates when subs are made — a sub can trigger or break synergies.

### Bench

Remaining deck cards sit on the bench. Available as sub cards in your hand.

---

## 3. Durability — "The Body"

Every player card has a durability tier. It determines **how reliably a card makes the XI** and **how long it survives the run**.

| Tier | Selection Weight | Risk | Fantasy |
|------|-----------------|------|---------|
| **Glass** | ×0.4 | 20% chance of **shattering** after each match played (lost forever) | R9 — transcendent but knees made of biscuits |
| **Fragile** | ×0.7 | 10% chance of **injury** after each match (misses next match, returns) | Neymar — out for 6 weeks, back for the big game |
| **Standard** | ×1.0 | No risk | The professional. Shows up, does the job |
| **Iron** | ×1.5 | No risk | Kanté. Never misses a session |
| **Titanium** | Auto-start | No risk | Messi at Barcelona. The team is built around him |
| **Phoenix** | ×0.6 | 30% chance of shattering BUT if they survive 3 matches, promoted to **Iron** permanently | The comeback kid — fragile talent who hardens if you protect them |

### Why This Is The Decision

**Glass Legendary vs Iron Common**: Your Glass Creator has 85 power and triggers "Silk" with the other Maestros. But 1-in-5 chance every match they shatter forever. Do you keep running them or sell for £50k while you can?

**Phoenix is the gamble card**: Might shatter on match 1. But survive 3 matches and they become Iron — the best value card in the game. You're nursing a talent through a difficult period. That IS football management.

**Titanium is the anchor**: You build around Titanium cards because they always start. Rare and expensive. Two Titaniums feels completely different from zero.

### Durability × Economy

| Durability | Shop Price Modifier | Gate Pull Bonus |
|---|---|---|
| Glass | ×0.5 | +15 fans (fans love a fragile genius) |
| Fragile | ×0.7 | +5 fans |
| Standard | ×1.0 | +0 |
| Iron | ×1.5 | +0 |
| Titanium | ×3.0 | +0 |
| Phoenix | ×0.8 | +15 fans |

### Post-Match Resolution

After match, during result screen:

**Shatter** (Glass/Phoenix):
```
"75' — D. Nutmeg takes a knock..."
[Card flickers, shatters with glass-breaking visual]
"D. Nutmeg has been REMOVED from your deck."
```

**Phoenix Promotion** (after 3 matches survived):
```
"Match 3 survived! R. Comeback is finding his feet..."
[Card glows, border upgrades from Phoenix orange to Iron silver]
"R. Comeback is now IRON. He's here to stay."
```

### Rarity × Durability Distribution

Independent axes — any combination possible:

| | Glass | Fragile | Standard | Iron | Titanium | Phoenix |
|---|---|---|---|---|---|---|
| **Common** | Common | Common | Most common | Uncommon | Never | Rare |
| **Rare** | Uncommon | Common | Common | Common | Very rare | Uncommon |
| **Epic** | Uncommon | Uncommon | Common | Uncommon | Rare | Uncommon |
| **Legendary** | Rare | Rare | Rare | Very rare | Very rare | Very rare |

---

## 4. Match Flow — "90 Minutes"

### The 5 Rounds

```
PRE-MATCH:
  → Deck shuffles, XI auto-populates (weighted random)
  → Draw opening hand of 5 action cards

15' → Play up to 2 cards from hand, round resolves
30' → Draw 2 new cards, play up to 2, round resolves
45' → HALF TIME: Draw 3 cards (team talk bonus), play up to 2
60' → Draw 2, play up to 2, round resolves
75' → Final push: draw 2, play remaining cards (no limit), match resolves

POST-MATCH:
  → Durability checks
  → Revenue calculated
  → Transfer window (shop)
```

### Round Resolution — Goal Probabilities

Each round generates goals from probabilities, not abstract points:

```
your_round_strength = XI_passive_score + action_card_bonuses
opponent_round_strength = opponent_base + opponent_actions
difference = your_round_strength - opponent_round_strength

your_goal_chance = base_15% + (difference / 200)     // clamped 5%-50%
opponent_goal_chance = base_15% - (difference / 200)  // clamped 5%-50%
```

Seeded random determines if goals happen. Final score is actual goals (0-0, 2-1, 4-3).

**Why goals not points**: "You won 3-1" hits different from "You scored 1,847 points."

### Hand Management

- **Hand size**: 5 cards max
- **Draw**: 2 per round (3 at half-time)
- **Play limit**: 2 cards per round (unlimited at 75')
- **Discard**: 1 card per round to draw 1 replacement (the Balatro discard — fish for something better)

**The tension**: You might have 5 good cards but can only play 2. Do you play the Screamer now (+25%) or save it for 75' when Last-Minute Drama stacks with it?

---

## 5. Action Cards — "The Touchline"

Two card types in the game: **Player cards** (passive, in XI) and **Action cards** (active, played from hand).

### A. Substitutions

Any benched player IS a sub card in your hand. Playing it swaps them for the weakest-fit XI player in that position group. Recalculates chemistry.

### B. Tactical Cards (~30 cards)

**Attacking:**

| Card | Effect | Duration | Flavour |
|------|--------|----------|---------|
| Press High | +15% goal chance, +10% opponent chance | 1 round | "PRESS! PRESS! PRESS!" |
| Counter Attack | +20% if opponent scored last round, else +5% | 1 round | "Let them come. Then punish." |
| Wing Play | +10% if Lateral or Winger in XI | Rest of match | "Get it wide!" |
| Overload | +20% goal chance, -15% next round | 1 round | "Everyone forward!" |
| Through Ball | +15% if Creator or Passer in XI | 1 round | "The gap! THE GAP!" |
| Long Ball | +10% if Target in XI | 1 round | "Route one." |
| Tiki-Taka | +5% per Controller/Passer in XI | 1 round | "Pass. Pass. Pass. Pass. Goal." |
| Set Piece | +12% flat, doubled if Target or Commander in XI | 1 round | "Everyone in the box" |

**Defensive:**

| Card | Effect | Duration | Flavour |
|------|--------|----------|---------|
| Park the Bus | -20% opponent chance, -10% your chance | 1 round | "Two banks of four." |
| Man Mark | Cancel opponent's highest-value action this round | 1 round | "Don't let him breathe." |
| Offside Trap | 30% chance of cancelling opponent goal this round | 1 round | "STEP UP! STEP UP!" |
| Tactical Foul | Cancel opponent action. 20% red card risk (-10% rest of match) | 1 round | "Take one for the team." |
| Time Waste | -15% opponent chance, -5% yours, -20 fans | 1 round | "The crowd is NOT happy." |
| Sweeper Keeper | +10% if GK has Passer archetype | 1 round | "He's coming out!" |

### C. Moment Cards (high impact, single use)

| Card | Effect | Flavour |
|------|--------|---------|
| Screamer | +25% goal chance | "From THIRTY YARDS!" |
| Nutmeg | +20%, +30 fans | "MEGS! The crowd goes wild" |
| Last-Minute Drama | Only at 75'. +35% goal chance | "ADDED TIME..." |
| Captain's Armband | +15%, doubled if Captain personality in XI | "He's grabbed this game" |
| Moment of Genius | +30% if Maestro in XI, else +10% | "You can't coach that." |
| Wonder Goal | +20%, +50 fans regardless | "GOLAZO!" |
| Penalty Shout | 40% → +30% (pen), 60% → +0% (waved away) | "Was it? WASN'T IT?" |

### D. Mind Games

| Card | Effect | Flavour |
|------|--------|---------|
| Wind Up | -10% opponent, 15% backfire risk (+10% opponent instead) | "Did you just say that?" |
| Crowd Surge | +15% if Catalyst in XI, +10 fans | "LISTEN to this atmosphere!" |
| The Hairdryer | +20% next round. Requires Captain in XI | "Nobody's sitting down." |
| Press Conference | -5% opponent rest of match | "I prefer not to speak." |
| Ultra Defensive | -25% opponent chance, -20% yours, -30 fans | "Anti-football. But it works." |

---

## 6. Manager Cards — "The Dugout"

Persistent modifiers (Balatro Jokers). Bought in shop, max 5 slots.

### Tactical Managers
- **The Pragmatist** — Defensive tactics 50% more effective
- **The Romantic** — Attacking tactics 50% more effective, defensive 50% less
- **The Tinker** — Draw 1 extra card per round
- **The Motivator** — The Hairdryer and Captain's Armband always available
- **The Analyst** — See opponent's next action before you play

### Stadium Effects
- **The Fortress** — Goal probability floor = 10% (you always have a chance)
- **The Cauldron** — Catalyst personality bonuses doubled
- **The Library** — Professor bonuses doubled, Catalyst bonuses zero

### Economy Managers
- **The Entertainer** — All gate pull values doubled
- **The Accountant** — Shop prices -30%
- **The Sugar Daddy** — +£20k per match, losses cost double
- **The Youth Developer** — Common cards in XI get +20% power
- **The Galactico** — Legendary cards +30%, Common cards -10%

---

## 7. Chemistry — Synergy System

Same four tiers, now running continuously across the XI:

### Tier 1: Archetype Pairs (common)
Two cards sharing primary archetype = **Duo** (+15% power each).
Three = **Trio** (+25% each).

### Tier 2: Role Combos (~20 named pairs)

| Combo | Roles | Multiplier |
|-------|-------|-----------|
| The Pirlo-Barella | Regista + Mezzala | ×1.3 |
| Shield & Sword | Sentinelle + Trequartista | ×1.3 |
| Overlap | Lateral + Inside Forward | ×1.2 |
| The Guardiola | Falso Nove + Winger | ×1.2 |
| The Double Pivot | Sentinelle + Volante | ×1.2 |
| Counter Punch | Volante + Extremo | ×1.2 |
| Total Control | Metodista + Regista | ×1.3 |
| The Wall | Vorstopper + Zagueiro | ×1.2 |
| Wing Play | Lateral + Winger | ×1.2 |
| Inside Out | Invertido + Fantasista | ×1.2 |
| The Link | Enganche + Poacher | ×1.3 |
| Space Creation | Raumdeuter + Falso Nove | ×1.2 |
| Engine Room | Tuttocampista + Relayeur | ×1.2 |
| The Provider | Libero + Complete Forward | ×1.2 |
| Last Line | Torwart + Sweeper | ×1.2 |
| Modern GK | Ball-Playing GK + Libero | ×1.2 |
| Wide Overload | Fluidificante + Tornante | ×1.2 |
| Second Wave | Mezzala + Seconda Punta | ×1.2 |
| Creative Hub | Fantasista + Trequartista | ×1.3 |
| Destroyer Duo | Volante + Vorstopper | ×1.2 |

**Chemistry Book**: Discovered synergies persist across runs (meta-progression).

### Tier 3: Personality Resonance
3+ XI cards sharing a personality theme:

| Theme | Name | Effect |
|-------|------|--------|
| General | Chain of Command | XI power +10% |
| Catalyst | Chaos Factor | Goal variance doubled (high ceiling, low floor) |
| Maestro | Silk | Opponent goal chance -15% |
| Captain | Siege Mentality | If losing in run, all cards +20% |
| Professor | System Player | Style multiplier +0.3 |

### Tier 4: The Perfect Dressing Room
All 5 personality themes in XI → ×2.0 on base strength.

---

## 8. Role Abilities — Passive XI Effects

Each tactical role contributes a passive ability to the XI:

| Role | Ability | Passive Effect |
|------|---------|---------------|
| Regista | Metronome | +5% to all connection bonuses |
| Volante | Tackle & Go | -5% opponent goal chance per round |
| Sentinelle | The Shield | Weakest XI player gets +30% power |
| Trequartista | Moment of Genius | 30% chance of doubling own power each round |
| Poacher | Box Presence | +15% goal chance when you play attacking cards |
| Tuttocampista | Box to Box | +3% per different archetype in XI |
| Lateral | Overlap | If Inside Forward/Winger also in XI, both +15% |
| Falso Nove | The Drop | Counts as both CF and AM for synergies |
| Enganche | The Hook | Highest-power teammate +25%, this card -10% |
| Libero | Surgical Pass | Each attacker in XI gets +10% |

---

## 9. Economy — Fans → Gate Revenue → Cash

### The Chain
```
XI entertainment → Fans (attendance)
Goals → Fans
Action card spectacle → Fans
Fans × ticket price → Match Day Revenue (£)
£ → spend in shop
```

### Stadium Progression

| Tier | Name | Capacity | Ticket Price | Unlocked |
|------|------|----------|-------------|----------|
| 1 | The Cage | 500 | £10 | Start |
| 2 | The Community Ground | 2,000 | £15 | Win 1 match |
| 3 | The Arena | 8,000 | £20 | Win 3 matches |
| 4 | The Theatre | 25,000 | £30 | Reach match 5 |
| 5 | The Cathedral | 60,000 | £40 | Win a run |

### Fan Sources

| Source | Fans |
|--------|------|
| Each goal scored | +50 |
| Each goal conceded | +30 (drama) |
| Dribbler in XI | +30 per card |
| Creator in XI | +25 per card |
| Striker in XI | +20 per card |
| Sprinter in XI | +15 per card |
| Engine in XI | +5 per card |
| Glass/Phoenix in XI | +15 per card |
| Catalyst personality | +40 per card |
| Captain personality | +15 per card |
| Maestro personality | +10 per card |
| General personality | +5 per card |
| Tier 1 synergy | +20 |
| Tier 2 synergy | +40 |
| Tier 3 synergy | +75 |
| Tier 4 synergy | +200 |
| Nutmeg card played | +30 |
| Wonder Goal card | +50 |
| Time Waste card | -20 |
| Ultra Defensive card | -30 |
| Total goals bonus | goals_total × 20 |

```
attendance = min(raw_fans, stadium_capacity)
revenue = attendance × (ticket_price + food_bonus)
```

### Sell-On Market

| Rarity | Base Fee |
|--------|---------|
| Common | £2,000 |
| Rare | £8,000 |
| Epic | £20,000 |
| Legendary | £50,000 |

Durability modifier: Glass ×0.5, Fragile ×0.7, Standard ×1.0, Iron ×1.5, Titanium ×3.0, Phoenix ×0.8.
Catalyst personality: +50% fee.

---

## 10. The Shop — "The Transfer Window"

### Layout

```
┌──────────────────────────────────────────┐
│ 💰 £42,000                     Match 3/5 │
├──────────────────────────────────────────┤
│ ACADEMY (Tier 2)                         │
│ [Standard Common] [Phoenix Rare]   £2,000│
├──────────────────────────────────────────┤
│ TRANSFER MARKET                          │
│ [Card Pick 1 of 3]         £15,000      │
│ [Rare+ Pick]               £35,000      │
│ [Action Card Pack]         £10,000      │
│ [Moment Pack]              £20,000      │
│ [Manager Card]             £20,000      │
├──────────────────────────────────────────┤
│ UPGRADES                                 │
│ [Academy → Tier 3]         £30,000      │
│ [Stadium Food]             £25,000      │
├──────────────────────────────────────────┤
│ SELL (tap bench cards to sell)            │
└──────────────────────────────────────────┘
```

### Academy — "The Youth System"

Every shop visit, the academy produces cheap players.

| Academy Tier | Players Offered | Max Rarity | Durability Mix | Cost |
|---|---|---|---|---|
| 1 (Grassroots) | 1 | Common | Standard (80%), Phoenix (20%) | Free |
| 2 (Development) | 2 | Rare | Standard (80%), Phoenix (20%) | £2,000 each |
| 3 (Elite) | 2 | Rare | Standard (60%), Phoenix (40%) | £3,000 each |
| 4 (World Class) | 3 | Epic | Standard (50%), Phoenix (40%), Iron (10%) | £5,000 each |

Academy upgrade: £30,000 per tier (compound investment).

### Action Card Packs

| Pack | Cost | Contents |
|------|------|----------|
| Tactical Pack | £10,000 | 3 random tactical cards |
| Moment Pack | £20,000 | 2 random moment cards |
| Mind Games Pack | £15,000 | 2 random mind game cards |
| Mixed Pack | £8,000 | 3 random from all types |

---

## 11. Opponent AI

| Match | Opponent | Base Strength | Actions/Round | Style |
|-------|----------|--------------|---------------|-------|
| 1 | FC Warm-Up | 40 | 0-1 | Passive |
| 2 | Dynamo Midtable | 55 | 1 | Balanced |
| 3 | Real Ambition | 70 | 1-2 | Attacking |
| 4 | AC Nightmare | 80 | 2 | Counter-attacking |
| 5 | The Invincibles | 95 | 2-3 | Adaptive |

Opponent actions are automated effects shown as commentary.

---

## 12. Playing Styles

Chosen at run start. Affects XI passive scoring.

| Style | Bonus Archetypes | Effect | Identity |
|-------|-----------------|--------|----------|
| Tiki-Taka | Passer, Controller, Creator | +15% XI power per aligned card | Short passing, fluid movement |
| Gegenpressing | Engine, Destroyer, Sprinter | +15% per aligned | High press, intensity |
| Counter-Attack | Cover, Sprinter, Striker | +15% per aligned | Deep defence, quick transitions |
| Direct Play | Target, Powerhouse, Passer | +15% per aligned | Long balls, physicality |
| Total Football | All models | +5% flat per card | Everything viable, nothing dominant |

---

## 13. Card Identity

### Player Card Attributes
- **Name** — fictional, comedic
- **Bio** — absurd flavour text
- **Position** — GK/CD/WD/DM/CM/WM/AM/WF/CF
- **Archetype** — primary + secondary
- **Tactical Role** — passive ability
- **Personality Type** — 4-letter code + theme
- **Power** — base strength (1-100)
- **Rarity** — Common/Rare/Epic/Legendary
- **Durability** — Glass/Fragile/Standard/Iron/Titanium/Phoenix
- **Gate Pull** — fans attracted (archetype + personality + durability)

### Card Visual Themes (from SACROSANCT)
| Theme | Types | Motif |
|-------|-------|-------|
| General | ANLC, ANSC, INSC | Clean lines, zinc palette, sharp borders |
| Catalyst | AXLC, IXSC, IXLC | Fuchsia-amber gradients, bold italic |
| Maestro | INSP, ANLP, IXSP | Muted gold borders, refined italic |
| Captain | INLC, INLP, AXSC | Bold red stripe, extrabold uppercase |
| Professor | ANSP, AXSP, IXLP, AXLP | Blue monospace, technical borders |

### Durability Visual Treatment
| Tier | Border Effect |
|------|-------------|
| Glass | Cracked/fractured border, translucent |
| Fragile | Thin border, slight flicker |
| Standard | Solid border |
| Iron | Metallic sheen, reinforced corners |
| Titanium | Heavy brushed metal, glowing edges |
| Phoenix | Flame/ember particles, orange pulse |

---

## 14. Meta-Progression (Between Runs)

What carries over:
- **Chemistry Book** — discovered synergies
- **Manager collection** — unlocked manager cards
- **Stadium skins** — cosmetic upgrades
- **Hall of Fame** — best runs, best lineups

What resets:
- Cards, cash, stadium tier, manager cards, action deck, academy tier — everything. Roguelike.
