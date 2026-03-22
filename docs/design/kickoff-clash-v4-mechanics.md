# Kickoff Clash v4 — Complete Mechanics Design

> Card battler / roguelike built on Chief Scout data. Balatro meets football.
> **v4** — Full XI, 5 scoring increments, subs, tactic slots, pack opening, training cards.

---

## Target Player
Plays Balatro on their phone, watches football on weekends, has 10 minutes. Wants to feel clever, not busy.

## Core Concept
Your XI is your "hand." Chemistry tiers are your "hand types." Discards let you fish for combos from your deck. Subs are mid-game interventions. Tactics are deployable slot modifiers. The score resolves at 5 increments with visible cascading math.

---

## 1. Run Structure — "The Season"

5 matches per run. Each harder. Shop between matches.

```
PACK OPENING (run start)
  → Choose 1 of 3 pack types
  → Get starting cards (players + tactics + formation + maybe manager)

EACH MATCH (×5):
  DRAW: 18 cards from deck → 11 XI + 7 bench
  FIRST HALF:
    15' → Score increment + interventions
    30' → Score increment + interventions
    (Bench discards OK, injury subs only, tactic deployment)
  HALF TIME:
    Free subs, change formation, swap tactics
  SECOND HALF:
    60' → Score increment + interventions
    75' → Score increment + interventions
    90' → Score increment (last-minute drama)
    (Free subs, tactic deployment, fatigue/shatter risk)
  FULL TIME → Revenue + durability checks

SHOP (Transfer Window)
  → Buy/sell players, tactics, training, packs, managers
```

---

## 2. Pack Opening — "Choose Your Build"

Run start: choose 1 of 3 packs.

| Pack | Contents | Build Identity |
|------|----------|---------------|
| The Academy | 12 players (Common/Rare, high synergy), 2 tactics, 1 formation | Youth. Cheap, strong chemistry. |
| The Chequebook | 8 players (2 guaranteed Epic+), 3 tactics, 1 formation, 1 manager | Star power. Fewer but better. |
| The Gaffer | 10 players, 4 tactics, 2 formations, 1 manager | Tactical flexibility. More tools. |

---

## 3. The Draw — "Dealing Your Hand"

Before each match, 18 cards drawn from deck.

### Draw Weights (by durability):
- Titanium: auto-select into XI
- Iron: 1.5× weight
- Standard: 1.0×
- Phoenix: 0.6×
- Fragile: 0.7×
- Glass: 0.4×

11 cards fill XI formation slots by position eligibility. 7 go to bench. Rest stay in deck.

### Position Eligibility by Slot:
| Slot | Accepts |
|------|---------|
| GK | GK |
| CB | CD |
| FB | WD, CD |
| DM | DM, CM |
| CM | CM, DM, AM |
| WM | WM, WF, WD |
| AM | AM, CM, WF |
| WF | WF, WM, AM |
| CF | CF, AM, WF |

---

## 4. First Half

2 scoring increments: 15' and 30'.

### Allowed:
- **Bench discards** (unlimited): dump bench card → draw from deck. Fishing for better synergies.
- **Injury subs** (forced): injured Fragile player must be subbed. Costs 1 of 5 subs.
- **Tactic deployment**: place tactic cards in slots at 15' or 30' (before each increment resolves).

### Not allowed:
- Free subs (half time only)
- Formation change (half time only)
- Removing a deployed tactic (committed for the half)

---

## 5. Tactic Cards — 3 Slots

Deployed into 3 slots. Contradiction pairs can't coexist.

| Card | Effect | Contradicts |
|------|--------|-------------|
| High Line | +15% attack, +10% opp attack | Low Block |
| Low Block | -20% opp attack, -10% your attack | High Line |
| Press High | +20% if Engine/Destroyer in XI, else +5% | Sit Deep |
| Sit Deep | -15% opp, but -5% per increment | Press High |
| Wing Play | +10% per Dribbler/Sprinter on wing | Narrow |
| Narrow | +10% per Controller/Passer central | Wing Play |
| Counter Attack | +25% after opponent scores | Possession |
| Possession | +5% cumulative per increment | Counter Attack |
| Set Piece Specialist | +flat per Target/Commander | — |
| The Dark Arts | -10% opp, 15% red card risk/increment | — |
| Youth Policy | +20 per Common in XI | — |
| Fortress | -25% opp first 30', fades to 0 by 90' | — |

---

## 6. Half Time

Everything unlocks:
- Free subs (bench ↔ XI, from 5-sub budget)
- Change formation (if you own the formation card)
- Swap/replace tactic cards
- Review synergies

---

## 7. Second Half

3 scoring increments: 60', 75', 90'.

Same as first half PLUS:
- **Free subs allowed** (not just injury)
- **Fatigue**: Glass/Phoenix shatter risk increases each increment (10% → 15% → 20%)
- **90' last-minute drama**: goal chances ×1.3

---

## 8. Scoring — "The Cascade"

Each of 5 increments (15/30/60/75/90) resolves:

```
XI_BASE = sum of 11 player power values
CHEMISTRY = sum of synergy bonuses (T1-T4)
STYLE_BONUS = playing style × matching archetypes
TACTIC_BONUS = active tactic card effects
MANAGER_BONUS = active manager joker effects

YOUR_SCORE = (XI_BASE + CHEMISTRY + STYLE_BONUS + TACTIC_BONUS + MANAGER_BONUS) × chemistry_multiplier

OPPONENT_SCORE = opponent_base × (1 + opponent_tactics)
```

### Chemistry Multiplier:
| Tier | Trigger | Mult | Poker |
|------|---------|------|-------|
| 0 | None | ×1.0 | High card |
| 1 | Archetype pair (2+) | ×1.15 | Pair |
| 2 | Role combo (named pair) | ×1.3 | Two pair |
| 3 | Personality resonance (3+ theme) | ×1.6 | Flush |
| 4 | Perfect Dressing Room (all 5 themes) | ×2.5 | Royal flush |

+0.05 per additional connection.

### Goal Resolution:
```
diff = YOUR_SCORE - OPPONENT_SCORE
your_chance = clamp(0.12 + diff/500, 0.03, 0.45)
opp_chance = clamp(0.12 - diff/500, 0.03, 0.35)
// At 90': both × 1.3

roll = seededRandom(seed + increment)
if roll < your_chance → YOU SCORE
else if roll < your_chance + opp_chance → THEY SCORE
```

### The Cascade Display:
```
XI Base: 487
+ Chemistry: +82 (Creative Spark +42, Pirlo-Barella +40)
+ Style: +38 (Tiki-Taka × 3)
+ Tactics: +25 (Possession compound)
+ Manager: +30 (The Professor × 2 Controllers)
= 662 × 1.35
= 894 vs 720
→ 27' GOAL! ⚽
```

---

## 9. Manager Cards (Jokers)

Persistent run modifiers. Max 3 held. Bought in shop. Always visible.

| Card | Effect |
|------|--------|
| The Dinosaur | +30 per Target/Powerhouse |
| The Professor | +25 per Controller/Passer |
| The Gambler | Glass/Phoenix +40 power |
| Youth Developer | +20 per Common |
| The Mourinho | +50 per Destroyer/Cover |
| The Hairdryer | +80 if Captain in XI |
| Chemistry Set | +15 per synergy connection |
| Scout's Eye | +1 bench discard effect (draws 2 instead of 1) |

---

## 10. Shop — "Transfer Window"

| Item | Cost |
|------|------|
| Player Pack (3) | £15,000 |
| Rare+ Pack (3) | £35,000 |
| Tactic Pack (2) | £10,000 |
| Formation Card | £20,000 |
| Manager Card | £25,000 |
| Training Card (+5 power, permanent) | £8,000 |
| Academy Player | Free-£5,000 |
| Sell any card | Rarity-based price |

### Training Cards:
+5 power to any player, permanent, stacks. Max +20 per player (4 trainings).

---

## 11. Card Types

| Type | In Deck? | Deployed | Persistence |
|------|----------|----------|-------------|
| Player | Yes | XI / Bench | Per-match draw |
| Tactic | Yes | 3 slots | Per-half |
| Formation | Collection | Selector | Always available |
| Manager | Collection | Joker row (3) | Entire run |
| Training | Consumed | Applied to player | Permanent boost |

---

## 12. Formations (Collectible)

Start with 1, buy more in shop.

| Formation | Slots |
|-----------|-------|
| 4-3-3 | GK, CB, FB, DM, CM, WM, AM, WF, WF, CF |
| 4-4-2 | GK, CB, CB, FB, FB, CM, CM, WM, WM, CF, CF |
| 3-5-2 | GK, CB, CB, CB, WM, CM, CM, WM, AM, CF, CF |
| 4-2-3-1 | GK, CB, CB, FB, FB, DM, DM, AM, WF, WF, CF |
| 3-4-3 | GK, CB, CB, CB, WM, CM, CM, WM, WF, WF, CF |
| 5-3-2 | GK, CB, CB, CB, FB, FB, CM, CM, AM, CF, CF |

---

## 13. Durability (unchanged)

| Tier | Weight | Risk |
|------|--------|------|
| Glass | 0.4 | 20% shatter (increases with fatigue in 2nd half) |
| Fragile | 0.7 | 10% injury → forced sub |
| Standard | 1.0 | None |
| Iron | 1.5 | None |
| Titanium | auto | None |
| Phoenix | 0.6 | 30% shatter, survive 3 → Iron |

---

## 14. Opponents

| Match | Name | Strength | Style |
|-------|------|----------|-------|
| 1 | FC Warm-Up | 500 | Passive |
| 2 | Dynamo Midtable | 650 | Balanced |
| 3 | Real Ambition | 800 | Attacking |
| 4 | AC Nightmare | 950 | Counter |
| 5 | The Invincibles | 1100 | Adaptive |

(Strengths scaled up for 11-card XI base power ~500-900 range)
