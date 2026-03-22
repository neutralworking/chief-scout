# Kickoff Clash v3: Balatro-Style Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild KC's match phase as a Balatro-style hand evaluation game — roll XI, discard/redraw, lock in, evaluate via chemistry — with the felt table visual identity.

**Architecture:** Single-page Next.js app. Decompose the 2530-line page.tsx monolith into focused components. New `hand.ts` module handles the roll/discard/evaluate loop. Existing chemistry.ts becomes the scoring backbone. Existing economy/durability/transform modules stay mostly unchanged. Tactical cards become persistent "jokers" (always-active modifiers) instead of per-round plays.

**Tech Stack:** Next.js 16 + React 19 + Tailwind 4 + TypeScript

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/hand.ts` | Roll XI from deck, discard/redraw mechanics, hand evaluation scoring, lock-in |
| `src/lib/jokers.ts` | Joker (manager) card definitions, persistent modifier effects |
| `src/components/GameShell.tsx` | Phase routing + run state management (extracted from page.tsx) |
| `src/components/TitleScreen.tsx` | New Season / Continue / History |
| `src/components/SetupPhase.tsx` | Formation + style picker |
| `src/components/HandPhase.tsx` | THE core screen: rolled XI + discard + chemistry cascade + lock in |
| `src/components/ScoreReveal.tsx` | Match result animation (strength comparison → goals) |
| `src/components/PostMatch.tsx` | Revenue + durability checks |
| `src/components/ShopPhase.tsx` | Transfer window (buy/sell/academy/jokers) |
| `src/components/EndScreen.tsx` | Champions / Relegated |
| `src/components/PlayerCard.tsx` | Reusable player card component (replaces CardDisplay) |
| `src/components/JokerCard.tsx` | Joker card display |
| `src/components/theme.ts` | Felt table design tokens + rarity colors + theme gradients |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/page.tsx` | Gutted to thin shell importing GameShell |
| `src/app/globals.css` | Felt table palette replacing cold dark theme |
| `src/lib/chemistry.ts` | Add `evaluateHand()` that returns chips × mult style scoring |
| `src/lib/run.ts` | Adapt RunState for new flow (remove matchState/actionDeck/hand, add jokers, discards) |
| `src/lib/scoring.ts` | Simplify — remove 5-round match engine, keep Card/SlottedCard/Durability types |
| `src/lib/economy.ts` | Minor — adjust attendance to use hand evaluation score instead of action fan accumulator |

### Unchanged Files
| File | Why |
|------|-----|
| `src/lib/transform.ts` | Character→Card pipeline works as-is |
| `src/lib/supabase.ts` | Not used yet |
| `public/data/kc_characters.json` | 500 characters unchanged |

---

## Task 1: Felt Table Theme

**Files:**
- Modify: `apps/kickoff-clash/src/app/globals.css`
- Create: `apps/kickoff-clash/src/components/theme.ts`

- [ ] **Step 1: Create theme.ts with design tokens**

```typescript
// apps/kickoff-clash/src/components/theme.ts

// Rarity colors + glows
export const RARITY_COLORS: Record<string, string> = {
  Common: '#71717a',
  Rare: '#4a9eff',
  Epic: '#a855f7',
  Legendary: '#f59e0b',
};

export const RARITY_GLOW: Record<string, string> = {
  Common: '0 0 6px rgba(113,113,122,0.3)',
  Rare: '0 0 10px rgba(74,158,255,0.4)',
  Epic: '0 0 14px rgba(168,85,247,0.5)',
  Legendary: '0 0 18px rgba(245,158,11,0.6), 0 0 36px rgba(245,158,11,0.2)',
};

// Personality theme card backgrounds
export const THEME_GRADIENTS: Record<string, string> = {
  General: 'linear-gradient(160deg, #1a1a2e, #101020)',
  Catalyst: 'linear-gradient(160deg, #2d1b35, #1a0f1f)',
  Maestro: 'linear-gradient(160deg, #2a2517, #1a180f)',
  Captain: 'linear-gradient(160deg, #2d1520, #1a0c12)',
  Professor: 'linear-gradient(160deg, #151f2e, #0c1420)',
};

export const THEME_ICONS: Record<string, string> = {
  General: '\u2694',
  Catalyst: '\u26a1',
  Maestro: '\u266b',
  Captain: '\u2764',
  Professor: '\ud83d\udcda',
};
```

- [ ] **Step 2: Replace globals.css with felt table palette**

Replace the entire `@theme inline` block and body styles with the felt table palette from the v2 prototype. Key vars:
- `--felt: #0b1a10`, `--leather: #1a1510`
- `--amber: #e8621a`, `--gold: #d4a035`
- `--pitch-green: #2d8a4e`, `--cream: #f5f0e0`
- `--dust: #9a8b73`, `--ink: #5c5040`
- Font: Archivo Black (display), DM Sans (body), Playfair Display (flavour text)
- Add Google Fonts import to `layout.tsx`

- [ ] **Step 3: Verify app still loads**

Run: `cd apps/kickoff-clash && npm run dev`
Expected: App loads on port 3001 with new color palette. Existing components will look rough (wrong var names) — that's expected, they're about to be replaced.

- [ ] **Step 4: Commit**

```bash
git add apps/kickoff-clash/src/app/globals.css apps/kickoff-clash/src/components/theme.ts apps/kickoff-clash/src/app/layout.tsx
git commit -m "feat(kc): felt table theme + design tokens"
```

---

## Task 2: Hand Evaluation Engine

**Files:**
- Create: `apps/kickoff-clash/src/lib/hand.ts`
- Modify: `apps/kickoff-clash/src/lib/chemistry.ts`

This is the core gameplay engine. A match is: roll → discard → evaluate.

- [ ] **Step 1: Define hand types and interfaces in hand.ts**

```typescript
// apps/kickoff-clash/src/lib/hand.ts

import type { Card, SlottedCard, Durability } from './scoring';
import { seededRandom, DURABILITY_WEIGHTS } from './scoring';
import { findConnections, type Connection } from './chemistry';

export interface HandState {
  xi: Card[];              // current XI (5 cards dealt)
  bench: Card[];           // remaining deck cards not in XI
  discardsRemaining: number; // starts at 3
  locked: boolean;
}

export interface HandScore {
  basePower: number;       // sum of card power values
  chemistryBonus: number;  // from synergy connections
  styleBonus: number;      // from playing style match
  jokerBonus: number;      // from active jokers
  totalStrength: number;   // final score
  connections: Connection[]; // active synergies
  multiplier: number;      // chemistry multiplier (1.0 = no synergies)
}

export interface MatchOutcome {
  yourStrength: number;
  opponentStrength: number;
  yourGoals: number;
  opponentGoals: number;
  result: 'win' | 'draw' | 'loss';
  events: MatchEvent[];    // dramatic moments for display
}

export interface MatchEvent {
  minute: number;
  text: string;
  type: 'goal-yours' | 'goal-opponent' | 'chance' | 'save' | 'card-played';
}
```

- [ ] **Step 2: Implement rollXI — deal a random hand from deck**

```typescript
export function rollXI(deck: Card[], formation: string, seed: number): HandState {
  const slots = getFormationSlots(formation); // from run.ts
  const shuffled = [...deck].sort((a, b) => seededRandom(seed + a.id) - seededRandom(seed + b.id));

  const xi: Card[] = [];
  const used = new Set<number>();

  // For each slot, find first eligible card
  // Titanium cards auto-select first
  for (const slot of slots) {
    const eligible = shuffled.filter(c => !used.has(c.id) && positionFitsSlot(c.position, slot));

    // Titanium first
    const titanium = eligible.find(c => c.durability === 'titanium');
    if (titanium) {
      xi.push(titanium);
      used.add(titanium.id);
      continue;
    }

    // Weighted random by durability
    const card = weightedPick(eligible, seed + xi.length, used);
    if (card) {
      xi.push(card);
      used.add(card.id);
    }
  }

  const bench = deck.filter(c => !used.has(c.id));

  return {
    xi,
    bench,
    discardsRemaining: 3,
    locked: false,
  };
}
```

Include `positionFitsSlot()` helper and `weightedPick()` using durability weights.

- [ ] **Step 3: Implement discard — swap a card for a random bench draw**

```typescript
export function discardAndDraw(hand: HandState, cardToDiscard: Card, seed: number): HandState {
  if (hand.discardsRemaining <= 0 || hand.locked) return hand;

  const eligibleBench = hand.bench.filter(c => !c.injured);
  if (eligibleBench.length === 0) return hand;

  // Pick random from bench
  const idx = Math.floor(seededRandom(seed) * eligibleBench.length);
  const drawn = eligibleBench[idx];

  return {
    xi: hand.xi.map(c => c.id === cardToDiscard.id ? drawn : c),
    bench: [...hand.bench.filter(c => c.id !== drawn.id), cardToDiscard],
    discardsRemaining: hand.discardsRemaining - 1,
    locked: false,
  };
}
```

- [ ] **Step 4: Implement evaluateHand — the Balatro moment**

This is where chemistry tiers determine the score. Connection tiers work like poker hand types — higher tiers multiply more.

```typescript
export function evaluateHand(
  xi: Card[],
  playingStyle: string,
  jokers: JokerCard[],
): HandScore {
  // Convert to SlottedCard format for chemistry.ts compatibility
  const slotted: SlottedCard[] = xi.map((card, i) => ({ card, slot: `slot_${i}` }));

  const connections = findConnections(slotted);

  // Base power
  const basePower = xi.reduce((sum, c) => sum + c.power, 0);

  // Chemistry bonus (flat points from connections)
  const chemistryBonus = connections.reduce((sum, c) => sum + c.bonus, 0);

  // Chemistry multiplier based on highest tier achieved
  const highestTier = connections.length > 0
    ? Math.max(...connections.map(c => c.tier))
    : 0;
  const multiplier = tierToMultiplier(highestTier, connections.length);

  // Style bonus
  const style = PLAYING_STYLES[playingStyle];
  let styleBonus = 0;
  if (style) {
    const matchCount = xi.filter(c =>
      style.bonusArchetypes.length === 0 || style.bonusArchetypes.includes(c.archetype)
    ).length;
    styleBonus = Math.round(basePower * style.multiplier * matchCount / xi.length);
  }

  // Joker bonus
  const jokerBonus = jokers.reduce((sum, j) => sum + applyJoker(j, xi, connections), 0);

  const totalStrength = Math.round((basePower + chemistryBonus + styleBonus + jokerBonus) * multiplier);

  return { basePower, chemistryBonus, styleBonus, jokerBonus, totalStrength, connections, multiplier };
}

function tierToMultiplier(highestTier: number, connectionCount: number): number {
  // Like poker: better hands = bigger multiplier
  const tierMult: Record<number, number> = { 0: 1.0, 1: 1.2, 2: 1.5, 3: 2.0, 4: 3.0 };
  const base = tierMult[highestTier] ?? 1.0;
  // Bonus for multiple connections
  const countBonus = Math.min(connectionCount - 1, 3) * 0.1;
  return base + countBonus;
}
```

- [ ] **Step 5: Implement resolveMatch — strength comparison → goals**

```typescript
export function resolveMatch(
  handScore: HandScore,
  opponentStrength: number,
  seed: number,
): MatchOutcome {
  const diff = handScore.totalStrength - opponentStrength;
  const ratio = handScore.totalStrength / Math.max(opponentStrength, 1);

  // Generate dramatic events and goals based on strength ratio
  const events: MatchEvent[] = [];
  let yourGoals = 0;
  let opponentGoals = 0;

  // Deterministic but dramatic: higher ratio = more goals for you
  const minutes = [12, 27, 38, 55, 67, 78, 88];
  for (let i = 0; i < minutes.length; i++) {
    const roll = seededRandom(seed + i * 31);
    const yourChance = Math.min(0.6, Math.max(0.05, 0.15 + diff / 400));
    const oppChance = Math.min(0.4, Math.max(0.05, 0.15 - diff / 400));

    if (roll < yourChance) {
      yourGoals++;
      events.push({ minute: minutes[i], text: generateGoalText(handScore, seed + i), type: 'goal-yours' });
    } else if (roll < yourChance + oppChance) {
      opponentGoals++;
      events.push({ minute: minutes[i], text: 'Opponent scores.', type: 'goal-opponent' });
    } else {
      events.push({ minute: minutes[i], text: generateChanceText(seed + i), type: 'chance' });
    }
  }

  const result = yourGoals > opponentGoals ? 'win' : yourGoals < opponentGoals ? 'loss' : 'draw';

  return {
    yourStrength: handScore.totalStrength,
    opponentStrength,
    yourGoals,
    opponentGoals,
    result,
    events,
  };
}
```

Include `generateGoalText()` and `generateChanceText()` helpers that produce comedic commentary.

- [ ] **Step 6: Commit**

```bash
git add apps/kickoff-clash/src/lib/hand.ts
git commit -m "feat(kc): hand evaluation engine — roll, discard, evaluate, resolve"
```

---

## Task 3: Joker System

**Files:**
- Create: `apps/kickoff-clash/src/lib/jokers.ts`

- [ ] **Step 1: Define joker types and 8 starter jokers**

```typescript
// apps/kickoff-clash/src/lib/jokers.ts

import type { Card, SlottedCard } from './scoring';
import type { Connection } from './chemistry';

export interface JokerCard {
  id: string;
  name: string;
  effect: string;          // human-readable
  flavour: string;         // comedic text
  rarity: 'common' | 'uncommon' | 'rare';
  compute: (xi: Card[], connections: Connection[]) => number; // bonus points
}

export const ALL_JOKERS: JokerCard[] = [
  {
    id: 'the_dinosaur',
    name: 'The Dinosaur',
    effect: '+30 per Target or Powerhouse in XI',
    flavour: 'Route one. Every time.',
    rarity: 'common',
    compute: (xi) => xi.filter(c => c.archetype === 'Target' || c.archetype === 'Powerhouse').length * 30,
  },
  {
    id: 'the_professor',
    name: 'The Professor',
    effect: '+25 per Controller or Passer',
    flavour: 'The game is simple.',
    rarity: 'common',
    compute: (xi) => xi.filter(c => c.archetype === 'Controller' || c.archetype === 'Passer').length * 25,
  },
  {
    id: 'the_gambler',
    name: 'The Gambler',
    effect: 'Glass and Phoenix cards get +40 power',
    flavour: 'Fortune favours the brave.',
    rarity: 'uncommon',
    compute: (xi) => xi.filter(c => c.durability === 'glass' || c.durability === 'phoenix').length * 40,
  },
  {
    id: 'youth_developer',
    name: 'Youth Developer',
    effect: '+20 per Common card in XI',
    flavour: 'Give the kids a chance.',
    rarity: 'common',
    compute: (xi) => xi.filter(c => c.rarity === 'Common').length * 20,
  },
  {
    id: 'the_mourinho',
    name: 'The Mourinho',
    effect: '+50 per Destroyer or Cover',
    flavour: 'Park the bus. Win the league.',
    rarity: 'uncommon',
    compute: (xi) => xi.filter(c => c.archetype === 'Destroyer' || c.archetype === 'Cover').length * 50,
  },
  {
    id: 'hairdryer',
    name: 'The Hairdryer',
    effect: '+80 if a Captain personality is in XI',
    flavour: "Nobody's sitting down.",
    rarity: 'rare',
    compute: (xi) => xi.some(c => c.personalityTheme === 'Captain') ? 80 : 0,
  },
  {
    id: 'chemistry_set',
    name: 'Chemistry Set',
    effect: 'Each synergy connection gives +15 extra',
    flavour: 'The whole is greater than the sum.',
    rarity: 'uncommon',
    compute: (_, connections) => connections.length * 15,
  },
  {
    id: 'scouts_eye',
    name: "Scout's Eye",
    effect: '+1 discard per match',
    flavour: 'I know a player...',
    rarity: 'rare',
    compute: () => 0, // handled separately in hand logic
  },
];

export function applyJoker(joker: JokerCard, xi: Card[], connections: Connection[]): number {
  return joker.compute(xi, connections);
}

export function getExtraDiscards(jokers: JokerCard[]): number {
  return jokers.filter(j => j.id === 'scouts_eye').length;
}

export function getShopJokers(seed: number, count: number = 3): JokerCard[] {
  const available = [...ALL_JOKERS];
  const result: JokerCard[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(seededRandom(seed + i * 17) * available.length);
    result.push(available.splice(idx, 1)[0]);
  }
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/kickoff-clash/src/lib/jokers.ts
git commit -m "feat(kc): joker system — 8 manager cards with persistent effects"
```

---

## Task 4: Adapt RunState

**Files:**
- Modify: `apps/kickoff-clash/src/lib/run.ts`

- [ ] **Step 1: Update RunState interface**

Add to RunState:
```typescript
jokers: JokerCard[];           // active jokers (max 3)
handState: HandState | null;   // current match hand
```

Remove from RunState (no longer needed):
```typescript
// matchState: MatchState | null;  — replaced by handState
// actionDeck: ActionCard[];       — replaced by jokers
// hand: ActionCard[];             — replaced by jokers
```

Keep `status` but update phases: `'setup' | 'hand' | 'scoring' | 'postmatch' | 'shop' | 'won' | 'lost'`

- [ ] **Step 2: Update createRun to initialize with jokers and no action deck**

- [ ] **Step 3: Update startMatch to call rollXI instead of shuffleAndSelectXI**

- [ ] **Step 4: Commit**

```bash
git add apps/kickoff-clash/src/lib/run.ts
git commit -m "refactor(kc): adapt RunState for hand-based gameplay + jokers"
```

---

## Task 5: PlayerCard Component

**Files:**
- Create: `apps/kickoff-clash/src/components/PlayerCard.tsx`

- [ ] **Step 1: Build PlayerCard — the game's most important visual element**

Extracts and improves CardDisplay from page.tsx. Three sizes: `full` (in hand/XI), `mini` (bench/deck), `detail` (popup).

Uses felt table theme: warm backgrounds, rarity glow borders, personality theme gradients from `theme.ts`. Durability shown as emoji badge. Power number prominent in Archivo Black. Name and archetype visible without tapping.

- [ ] **Step 2: Verify renders in isolation**

Temporarily render a test card on page.tsx to verify styling.

- [ ] **Step 3: Commit**

```bash
git add apps/kickoff-clash/src/components/PlayerCard.tsx
git commit -m "feat(kc): PlayerCard component with felt table styling"
```

---

## Task 6: HandPhase — The Core Screen

**Files:**
- Create: `apps/kickoff-clash/src/components/HandPhase.tsx`

This is the Balatro moment. The most important screen in the game.

- [ ] **Step 1: Build HandPhase layout — three zones**

```
TOP:    Opponent info (name, strength, weakness) + Hand Score counter
MIDDLE: Your XI — 5 cards displayed as a "hand"
        Cards fan out with slight rotation + overlap (like holding cards)
        Synergies shown as glowing badges between connected cards
        Tapping a card in XI = DISCARD (swap for bench draw)
BOTTOM: Discards remaining counter + "Lock In" button
```

- [ ] **Step 2: Wire up roll → display**

On mount, call `rollXI()` with current deck + seed. Display the dealt hand. Show the `HandScore` counter updating in real-time as chemistry is calculated.

- [ ] **Step 3: Wire up discard interaction**

Tapping a card in the XI calls `discardAndDraw()`. The discarded card animates out, new card animates in. Chemistry re-evaluates. Score counter cascades (the Balatro moment — watch the number tick up or down).

- [ ] **Step 4: Wire up lock in**

"Lock In" button calls parent callback with final `HandScore`. Transitions to scoring phase.

- [ ] **Step 5: Add synergy cascade animation**

When a synergy fires (new connection found after discard), show a banner: "CREATIVE SPARK +42" with the gold treatment from the v2 prototype. Score counter ticks up with each bonus.

- [ ] **Step 6: Commit**

```bash
git add apps/kickoff-clash/src/components/HandPhase.tsx
git commit -m "feat(kc): HandPhase — roll, discard, evaluate, lock in"
```

---

## Task 7: ScoreReveal — Match Resolution

**Files:**
- Create: `apps/kickoff-clash/src/components/ScoreReveal.tsx`

- [ ] **Step 1: Build ScoreReveal**

Fast, dramatic match resolution. Takes `HandScore` + opponent strength, calls `resolveMatch()`.

Display:
- Your strength vs opponent strength as two competing bars
- 3-5 key events revealed sequentially with dramatic timing
- Goals shown BIG in amber with celebration animation
- Final score revealed with WIN/DRAW/LOSS treatment
- Total time: ~15-20 seconds of animation, not interactive

- [ ] **Step 2: Add staggered event reveals**

Each match event fades in with 2-3 second intervals. Goal events get extra drama (larger text, glow, brief pause).

- [ ] **Step 3: Commit**

```bash
git add apps/kickoff-clash/src/components/ScoreReveal.tsx
git commit -m "feat(kc): ScoreReveal — dramatic match resolution"
```

---

## Task 8: Supporting Screens

**Files:**
- Create: `apps/kickoff-clash/src/components/TitleScreen.tsx`
- Create: `apps/kickoff-clash/src/components/SetupPhase.tsx`
- Create: `apps/kickoff-clash/src/components/PostMatch.tsx`
- Create: `apps/kickoff-clash/src/components/ShopPhase.tsx`
- Create: `apps/kickoff-clash/src/components/EndScreen.tsx`
- Create: `apps/kickoff-clash/src/components/JokerCard.tsx`

- [ ] **Step 1: Extract TitleScreen from page.tsx**

Port existing TitleScreen, restyle with felt table palette. Archivo Black title, amber "New Season" button.

- [ ] **Step 2: Extract SetupPhase from page.tsx**

Port existing formation + style picker. Restyle with leather card backgrounds, amber selection highlight.

- [ ] **Step 3: Extract PostMatch from page.tsx**

Port existing post-match screen. Revenue display + durability checks. Minimal changes beyond reskin.

- [ ] **Step 4: Build ShopPhase with joker support**

Port existing shop but add a "Jokers" section where you can buy manager cards (max 3 active). Show active jokers at the top. Joker cards use the JokerCard component.

- [ ] **Step 5: Extract EndScreen from page.tsx**

Port existing end screen. "CHAMPIONS!" in gold / "RELEGATED!" in red.

- [ ] **Step 6: Build JokerCard component**

Small card showing joker name, effect text, flavour. Distinct from PlayerCard — different shape (wider, shorter), different border treatment.

- [ ] **Step 7: Commit**

```bash
git add apps/kickoff-clash/src/components/
git commit -m "feat(kc): supporting screens — title, setup, postmatch, shop, end, joker card"
```

---

## Task 9: GameShell — Wire It All Together

**Files:**
- Create: `apps/kickoff-clash/src/components/GameShell.tsx`
- Modify: `apps/kickoff-clash/src/app/page.tsx`

- [ ] **Step 1: Build GameShell with phase routing**

Extract the main `Home()` component logic into `GameShell`. Manages RunState via useState. Routes to correct phase component based on `state.status`.

Phase flow:
```
setup → hand → scoring → postmatch → shop → (repeat or end)
```

- [ ] **Step 2: Wire up the full game loop**

- Setup → creates run with `createRun()`
- Hand → rolls XI with `rollXI()`, player discards/locks in
- Scoring → evaluates with `evaluateHand()` + `resolveMatch()`
- PostMatch → shows result, runs durability checks
- Shop → buy cards/jokers, sell cards
- Loop back to Hand for next match, or End if 5 matches done

- [ ] **Step 3: Gut page.tsx**

Replace 2530-line page.tsx with:
```typescript
'use client';
import GameShell from '../components/GameShell';
export default function Home() {
  return <GameShell />;
}
```

- [ ] **Step 4: localStorage persistence**

Port `saveRunToStorage` / `loadRunFromStorage` from old page.tsx into GameShell. Joker cards need serialization (store IDs, rehydrate from ALL_JOKERS).

- [ ] **Step 5: Verify full game loop works**

Run through: New Season → pick formation → pick style → see rolled XI → discard a card → lock in → watch score reveal → post match → shop → next match.

- [ ] **Step 6: Commit**

```bash
git add apps/kickoff-clash/src/components/GameShell.tsx apps/kickoff-clash/src/app/page.tsx
git commit -m "feat(kc): GameShell — full game loop wired up"
```

---

## Task 10: Cleanup

**Files:**
- Delete or archive: old monolithic code in page.tsx (already replaced)
- Modify: `apps/kickoff-clash/src/lib/actions.ts` — keep for reference but no longer imported

- [ ] **Step 1: Remove unused imports and dead code**

The old `actions.ts` (26 action cards) is no longer used. The old match engine functions in `scoring.ts` (resolveRound, createMatchState, advanceMatchState) are no longer called. Don't delete the files — mark with `@deprecated` comments for now.

- [ ] **Step 2: Update package.json if needed**

No new dependencies required. Archivo Black + DM Sans + Playfair Display loaded via Google Fonts in layout.tsx (already done in Task 1).

- [ ] **Step 3: Full smoke test**

Run complete game loop twice:
1. Win run — verify Champions screen
2. Lose run — verify Relegated screen
3. Verify localStorage save/load works
4. Verify joker effects apply to hand scoring

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(kc): cleanup deprecated code, smoke test passing"
```
