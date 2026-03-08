# Availability System — Chief Scout Centrepiece

## Overview

**Availability** is the core signal that drives every scouting decision in Chief Scout. It answers a single question:

> *"How realistic is it that we can sign this player, right now, with our current resources and reputation?"*

It is a **composite score (0–100)** built from five weighted pillars, displayed as a colour-coded tier on the Radar Screen, Shortlists, and player profiles.

---

## The Five Pillars

| # | Pillar | Weight | Core Question |
|---|--------|--------|---------------|
| 1 | **Transfer Status** | 35% | Is the player actually moveable? |
| 2 | **Contract Situation** | 25% | How soon could they walk away? |
| 3 | **Player Interest** | 20% | Do they want to leave and/or come to us? |
| 4 | **Squad Status** | 10% | How dispensable are they at their current club? |
| 5 | **Reputation Gap** | 10% | Can our club realistically attract them? |

**Formula:**

```
availability_score = (transfer_score × 0.35)
                   + (contract_score × 0.25)
                   + (interest_score × 0.20)
                   + (squad_score    × 0.10)
                   + (rep_score      × 0.10)
```

---

## Availability Tiers

| Score | Tier | Colour | Meaning |
|-------|------|--------|---------|
| 80–100 | **HOT** | Red | Available now — low friction, act fast |
| 60–79 | **WARM** | Orange | Acquirable with the right offer and timing |
| 40–59 | **POSSIBLE** | Yellow | Will take patience or a trigger event |
| 20–39 | **DIFFICULT** | Grey | Needs a catalyst: form drop, injury, manager exit |
| 0–19 | **LOCKED** | Dark | Not realistic at your current standing |

---

## Pillar Scoring Detail

### Pillar 1 — Transfer Status (35%)

The player's current transfer situation is the single most important factor.

| Status | Score | Notes |
|--------|-------|-------|
| `free_agent` | 100 | No fee, only wages to agree |
| `listed` | 85 | Club actively wants to sell |
| `loan_available` | 70 | Available but club retains ownership |
| `available` | 55 | Club willing to discuss — not advertised |
| `approached` | 40 | Contact made but no clear green light |
| `not_for_sale` | 10 | Club refusing all enquiries |

**Events that change transfer status:**
- New manager arrival → may list inherited players
- Promotion / relegation → financial pressure forces sales
- Player publicly requests transfer → status escalates to `listed`
- Winter window deadline → clubs become more flexible
- Agent pushes for move → status shifts from `not_for_sale` to `available`

**Hidden information:** Transfer status is hidden for un-scouted players. Your **Nomad** director attribute (Network Development) unlocks transfer status information for more players before formal scouting.

---

### Pillar 2 — Contract Situation (25%)

A player approaching the end of their contract is far easier to prize away — both financially (lower or no fee) and psychologically (their future is uncertain).

| Contract Remaining | Score | Notes |
|-------------------|-------|-------|
| 0 months (expired) | 100 | Bosman — free, no fee required |
| ≤ 6 months | 85 | Bosman window open, pre-contract legal |
| ≤ 12 months | 65 | Clubs begin to consider selling vs. losing for free |
| ≤ 18 months | 45 | Still committed but tension beginning |
| ≤ 24 months | 30 | Long runway — selling unlikely without pressure |
| ≤ 36 months | 20 | Firmly tied down |
| > 36 months | 10 | Very locked in |

**Hidden information:** Contract expiry dates are hidden until scouted. Your **Statto** director attribute (Tech Ability) unlocks contract data from public databases for more players.

---

### Pillar 3 — Player Interest (20%)

Even if a player is transferable, they must *want* to come. This is a hidden attribute (0–100) that evolves dynamically.

| Interest Score | Meaning |
|---------------|---------|
| 90–100 | Desperate to leave — will push for a move |
| 70–89 | Open to the right opportunity |
| 50–69 | Neutral — would consider a serious offer |
| 30–49 | Prefers to stay — needs convincing |
| 10–29 | Very settled — unlikely to move |
| 0–9 | Committed to club — will not move |

**Events that raise interest (+):**
- Few first-team starts this season (+5 to +15)
- Manager publicly criticises player (+10 to +20)
- Club relegated or in financial crisis (+15)
- Player's national team manager is at a rival club (+5)
- Long-term injury followed by loss of place (+15)

**Events that lower interest (−):**
- Club wins league title this season (−20)
- Player signs contract extension (−25)
- Player awarded club captaincy (−15)
- Strong personal relationship with manager (−10)

**Unlocked by:** Your **Savant** director attribute (Player Knowledge) reveals more accurate interest scores. Without it, you see only broad ranges (Low / Medium / High).

---

### Pillar 4 — Squad Status (10%)

How important is this player to their current club?

| Status | Score | Notes |
|--------|-------|-------|
| `youth` | 80 | Not in senior plans — easy to negotiate for |
| `backup` | 70 | Seldom plays — club may be willing to sell |
| `loanee` | 60 | Not their player to keep — loan recalls possible |
| `rotation` | 50 | Regular but not indispensable |
| `important_player` | 25 | Key contributor — selling hurts |
| `key_player` | 10 | Club-defining — near impossible to buy |

---

### Pillar 5 — Reputation Gap (10%)

Your club's reputation relative to the player's current club affects whether they'd consider a move. A step down in league level requires extra player interest or financial incentive to overcome.

| Gap (Your Rep − Player Club Rep) | Score | Situation |
|----------------------------------|-------|-----------|
| ≥ +20 | 90 | You're a significantly bigger club |
| ≥ +10 | 75 | Clear step up in prestige for the player |
| ≥ 0 | 60 | Same level — mutual benefit |
| ≥ −10 | 40 | Slight project/downward move for player |
| ≥ −20 | 20 | Significant step down — needs special motivation |
| < −20 | 5 | Unrealistic without a trigger event |

**Modifiers:**
- Player has personal connection to your region or city (+10 rep gap bonus)
- Your manager is someone the player has expressed admiration for (+10)
- Your club is in an upward trajectory (promoted, strong form) (+5)
- Financial offer far exceeds player's current wage (overrides rep gap partially)

---

## Secondary Score: Style Fit

Alongside availability, each player has a **style_fit_score** measuring how naturally they'll slot into your tactical system.

### Player Model → Tactical Style Affinities

| Your Tactical Style | Best-Fit Player Models |
|--------------------|----------------------|
| Tika-Taka / Total | Controller, Passer, Creator, Dribbler |
| Gegenpress / POMO | Engine, Destroyer, Cover |
| Counter / Pragmatic | Sprinter, Striker, Cover |
| Direct / Catennacio | Target, Powerhouse, Destroyer |
| Garra Charrua / Fluid | Engine, Commander, Powerhouse |
| Joga Bonito | Creator, Dribbler, Sprinter |

### Transition Penalties

If a player's current club plays a different style to yours, they may underperform during an adaptation period.

| From Style → Your Style | Compatibility | Adapt Weeks | Perf Modifier |
|------------------------|---------------|-------------|---------------|
| Counter → Direct | Easy | 2 | +5% |
| Counter → Gegenpressing | Moderate | 4 | 0% |
| Counter → Possession | Difficult | 8 | −10% |
| Counter → Tiki-Taka | Very Difficult | 16 | −20% |
| Possession → Gegenpressing | Easy | 2 | +5% |
| Possession → Tiki-Taka | Easy | 2 | +5% |
| Possession → Counter | Difficult | 8 | −10% |
| Possession → Direct | Moderate | 4 | 0% |
| Gegenpressing → Possession | Easy | 2 | +5% |
| Gegenpressing → Counter | Moderate | 4 | 0% |
| Gegenpressing → Direct | Difficult | 8 | −10% |
| Gegenpressing → Tiki-Taka | Moderate | 4 | 0% |
| Direct → Counter | Easy | 2 | +5% |
| Direct → Possession | Moderate | 4 | 0% |
| Direct → Gegenpressing | Difficult | 8 | −10% |
| Direct → Tiki-Taka | Very Difficult | 16 | −20% |
| Tiki-Taka → Possession | Easy | 2 | +5% |
| Tiki-Taka → Gegenpressing | Moderate | 4 | 0% |
| Tiki-Taka → Counter | Very Difficult | 16 | −20% |
| Tiki-Taka → Direct | Very Difficult | 16 | −20% |

**Players with the Engine model are the most versatile** — their Stamina, Pressing, Intensity, and Versatility attributes make them adaptable across most styles with minimal penalty.

---

## Integration with Game Systems

### Radar Screen

The radar screen plots players on two axes:
- **X-axis:** `style_fit_score` (how well they fit your system)
- **Y-axis (proximity to centre):** `availability_score` (how acquirable they are)

Players in the **bullseye** are both highly available AND a strong style fit — these are your primary targets.

### Shortlists

Auto-alert triggers when a player crosses an availability tier:
- `DIFFICULT → POSSIBLE`: "Your target X may now be approachable"
- `POSSIBLE → WARM`: "X has been listed by their club — move quickly"
- `WARM → HOT`: "X is available immediately — free agent window open"

### News Feed

News items are generated by availability state changes:
- Transfer listing → `HOT` flag + news item
- Contract signing → interest drops + news item
- Manager sacked at player's club → interest rises + news item
- Injury to player → squad_status may shift to `backup`

### Scouting Pipeline

| Stage | Availability Integration |
|-------|------------------------|
| `identification` | Surface all players with `score ≥ 40` (POSSIBLE+) |
| `filtration` | Remove `score < 20` (LOCKED) unless special trigger |
| `comparison` | Rank shortlist by `availability_score × style_fit_score` |
| `selection` | Alert when top target's score changes |
| `negotiation` | Availability score informs opening offer strategy |

### Director Attribute Effects on Availability

| Director Attribute | Effect on Availability System |
|-------------------|------------------------------|
| **Savant** (Player Knowledge) | Reveals accurate `player_interest` scores (vs. broad bands) |
| **Nomad** (Network Development) | Reveals `transfer_status` for un-scouted players |
| **Statto** (Tech Ability) | Reveals contract expiry dates from public data |
| **Dealmaker** (Negotiation) | Hidden +10 bonus to effective availability during active negotiation |
| **Figurehead** (Charisma) | Reduces reputation gap penalty by up to 10 points |

---

## Director Scoring — Hit Rate

The Director is ultimately judged on three KPIs (from scratchpad.md):

| KPI | Definition | Availability Link |
|-----|------------|------------------|
| **Roster Value** | Total squad market value | Signing high-value available players |
| **Roster Value Increase** | Season-on-season improvement | Timing signings at peak availability moments |
| **Hit Rate** | % of signed players who perform above expectation | Style fit × availability alignment |

A high **Hit Rate** comes from signing players who are:
1. Available at the right moment (availability ≥ WARM)
2. Matched to your tactical system (style_fit ≥ 65)
3. At the right career stage (not past their potential ceiling)

---

## Balancing Notes

### Availability vs. Quality Trade-off

The game should create genuine tension between:
- **HOT but lower quality** — available now but won't transform the squad
- **LOCKED but exceptional** — right player, wrong moment; build toward them

Directors should sometimes sign a WARM player as a bridge while building reputation and funds to unlock a LOCKED elite target.

### Dynamic Availability Events (randomised triggers)

One availability-shifting event should fire per in-game week:
- 30% chance: Contract news (signing or expiry rumour)
- 25% chance: Transfer listing (club puts player up)
- 20% chance: Player form event (raises/lowers interest)
- 15% chance: Managerial change (shifts squad status of multiple players)
- 10% chance: Financial crisis at a club (multiple players suddenly listed)

### Reputation Progression

As the user's club reputation grows (60 → 70 → 80 → 90 → 100):
- The pool of POSSIBLE/WARM players expands dramatically
- Previously LOCKED players become DIFFICULT → POSSIBLE
- This creates a clear sense of progression and expanding reach

### Starting Conditions (League Two, Rep 60–70)

At game start, most targets in League Two/One will be POSSIBLE or WARM. Championship players will be DIFFICULT. Premier League players will be LOCKED except for aging veterans, free agents, or players with personal club connections.
