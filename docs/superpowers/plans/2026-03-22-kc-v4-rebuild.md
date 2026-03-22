# KC v4: Full Match Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild KC match phase for v4: 11-card XI, 7 bench, 5 scoring increments, subs, 3 tactic slots with contradictions, pack opening, collectible formations, training cards.

**Architecture:** Update existing lib modules (hand.ts, run.ts) and components (HandPhase, ScoreReveal → merged into MatchPhase, SetupPhase, ShopPhase, GameShell). Create new modules for tactics, formations, packs. The match is now a single interactive screen (MatchPhase) that progresses through 5 increments with intervention windows between each.

**Tech Stack:** Next.js 16 + React 19 + Tailwind 4 + TypeScript

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/tactics.ts` | 12 tactic card definitions, contradiction pairs, slot validation |
| `src/lib/formations.ts` | 6 formation definitions with 11 slots each, position eligibility |
| `src/lib/packs.ts` | 3 pack types (Academy/Chequebook/Gaffer), pack opening logic |
| `src/components/MatchPhase.tsx` | THE core screen: XI + bench + tactics + increments + subs (replaces HandPhase + ScoreReveal) |
| `src/components/PackOpening.tsx` | Pack selection + card reveal UI |
| `src/components/TacticCard.tsx` | Tactic card display component |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/hand.ts` | 11-card XI, 7 bench, unlimited bench discards from deck, 5-increment scoring, sub mechanics |
| `src/lib/run.ts` | RunState: add ownedFormations, tactics deck, training, subs budget; new phases; 11-slot formations |
| `src/lib/jokers.ts` | Scale joker bonuses for 11-card XI |
| `src/components/GameShell.tsx` | New phase flow: pack → match (increments) → postmatch → shop |
| `src/components/SetupPhase.tsx` | Pack selection replaces formation+style picker at run start |
| `src/components/ShopPhase.tsx` | Add tactic/formation/training card purchases |

### Unchanged Files
| File | Why |
|------|-----|
| `src/components/theme.ts` | Design tokens unchanged |
| `src/components/PlayerCard.tsx` | Card component unchanged |
| `src/components/JokerCard.tsx` | Joker display unchanged |
| `src/components/PostMatch.tsx` | Post-match screen unchanged |
| `src/components/EndScreen.tsx` | End screen unchanged |
| `src/components/TitleScreen.tsx` | Title screen unchanged |
| `src/lib/chemistry.ts` | Synergy detection works with any SlottedCard[] |
| `src/lib/economy.ts` | Revenue calc mostly unchanged |
| `src/lib/transform.ts` | Character pipeline unchanged |
| `src/lib/scoring.ts` | Card/Durability types unchanged |

---

## Task 1: Tactic Cards System

**Files:**
- Create: `apps/kickoff-clash/src/lib/tactics.ts`
- Create: `apps/kickoff-clash/src/components/TacticCard.tsx`

- [ ] **Step 1: Create tactics.ts with card definitions and contradiction logic**

```typescript
// apps/kickoff-clash/src/lib/tactics.ts

export interface TacticCard {
  id: string;
  name: string;
  effect: string;           // human-readable
  flavour: string;          // comedic
  contradicts?: string;     // id of contradicting tactic
  compute: (xi: Card[], increment: number) => number;
  category: 'attacking' | 'defensive' | 'specialist';
}

export interface TacticSlots {
  slots: (TacticCard | null)[];  // 3 slots
}
```

Define 12 tactic cards per the v4 design doc:
- High Line / Low Block (contradictory pair)
- Press High / Sit Deep (contradictory pair)
- Wing Play / Narrow (contradictory pair)
- Counter Attack / Possession (contradictory pair)
- Set Piece Specialist, The Dark Arts, Youth Policy, Fortress (standalone)

Implement:
- `ALL_TACTICS: TacticCard[]`
- `createEmptySlots(): TacticSlots` — 3 null slots
- `deployTactic(slots: TacticSlots, tactic: TacticCard, slotIndex: number): TacticSlots` — place card, auto-remove contradicting card from other slots
- `canDeploy(slots: TacticSlots, tactic: TacticCard): boolean` — checks slot availability
- `removeTactic(slots: TacticSlots, slotIndex: number): TacticSlots`
- `calculateTacticBonus(slots: TacticSlots, xi: Card[], increment: number): number` — sum all active tactic effects
- `getTacticById(id: string): TacticCard | undefined`
- `rehydrateTactics(ids: (string|null)[]): TacticSlots` — for localStorage

- [ ] **Step 2: Create TacticCard.tsx display component**

Props: `{ tactic: TacticCard; onClick?: () => void; deployed?: boolean; contradicted?: boolean; compact?: boolean }`

Visual: horizontal card (similar to JokerCard), category-colored border (attacking=red, defensive=blue, specialist=gold). Show name, effect, flavour. Contradicted state shows red X overlay.

- [ ] **Step 3: Verify compiles and commit**

```bash
cd apps/kickoff-clash && npx tsc --noEmit 2>&1 | grep -v page.tsx | head -20
git add src/lib/tactics.ts src/components/TacticCard.tsx
git commit -m "feat(kc): tactic card system — 12 cards, contradictions, 3 slots"
```

---

## Task 2: Formations System

**Files:**
- Create: `apps/kickoff-clash/src/lib/formations.ts`

- [ ] **Step 1: Create formations.ts with 6 formation definitions**

```typescript
export interface FormationSlot {
  type: string;     // 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'WM' | 'AM' | 'WF' | 'CF'
  accepts: string[];  // which card positions fit this slot
  x: number;        // pitch position 0-100 for display
  y: number;        // pitch position 0-100 for display
}

export interface Formation {
  id: string;        // '4-3-3', '4-4-2', etc.
  name: string;
  slots: FormationSlot[];  // always 11 (including GK)
  description: string;
}
```

Define 6 formations per v4 design:
- 4-3-3: GK, CB, FB, DM, CM, WM, AM, WF, WF, CF (wide attacking)
- 4-4-2: GK, CB, CB, FB, FB, CM, CM, WM, WM, CF, CF (classic)
- 3-5-2: GK, CB, CB, CB, WM, CM, CM, WM, AM, CF, CF (midfield)
- 4-2-3-1: GK, CB, CB, FB, FB, DM, DM, AM, WF, WF, CF (modern)
- 3-4-3: GK, CB, CB, CB, WM, CM, CM, WM, WF, WF, CF (attack)
- 5-3-2: GK, CB, CB, CB, FB, FB, CM, CM, AM, CF, CF (defensive)

Each slot has x/y coordinates for pitch display and an `accepts` array mapping which Card positions can fill it.

Implement:
- `ALL_FORMATIONS: Formation[]`
- `getFormation(id: string): Formation`
- `positionFitsSlot(position: string, slot: FormationSlot): boolean`

- [ ] **Step 2: Verify compiles and commit**

```bash
git add src/lib/formations.ts
git commit -m "feat(kc): 6 collectible formations with 11-slot definitions"
```

---

## Task 3: Pack Opening System

**Files:**
- Create: `apps/kickoff-clash/src/lib/packs.ts`
- Create: `apps/kickoff-clash/src/components/PackOpening.tsx`

- [ ] **Step 1: Create packs.ts**

```typescript
export interface PackType {
  id: 'academy' | 'chequebook' | 'gaffer';
  name: string;
  description: string;
  playerCount: number;
  tacticCount: number;
  formationCount: number;
  managerCount: number;
  guaranteedRarity?: string;   // 'Epic' for chequebook
  guaranteedEpicCount?: number; // 2 for chequebook
}

export interface PackContents {
  players: Card[];
  tactics: TacticCard[];
  formations: Formation[];
  managers: JokerCard[];
}
```

Define 3 packs per v4 design:
- Academy: 12 players (Common/Rare), 2 tactics, 1 formation
- Chequebook: 8 players (2 guaranteed Epic+), 3 tactics, 1 formation, 1 manager
- Gaffer: 10 players, 4 tactics, 2 formations, 1 manager

Implement:
- `PACK_TYPES: PackType[]`
- `openPack(packType: PackType, seed: number): PackContents` — generates cards from ALL_CARDS pool, seeded random

- [ ] **Step 2: Create PackOpening.tsx**

Props: `{ onSelect: (pack: PackType) => void }`

Display 3 pack cards side by side. Each shows pack name, description, and contents summary. Tap to select. Felt table styling — packs look like sealed card packs on the table.

- [ ] **Step 3: Verify compiles and commit**

```bash
git add src/lib/packs.ts src/components/PackOpening.tsx
git commit -m "feat(kc): pack opening — 3 pack types with seeded card generation"
```

---

## Task 4: Update Hand Engine for v4

**Files:**
- Modify: `apps/kickoff-clash/src/lib/hand.ts`

Major rewrite of the hand engine for 11-card XI, 7 bench, 5 increments.

- [ ] **Step 1: Update HandState for 11+7**

```typescript
export interface HandState {
  xi: Card[];                    // 11 cards in formation
  bench: Card[];                 // 7 bench cards
  remainingDeck: Card[];         // cards not drawn (for bench discards)
  subsRemaining: number;         // starts at 5
  subsUsed: { out: Card; in: Card; minute: number }[];
  tacticSlots: TacticSlots;      // 3 tactic slots
  currentIncrement: number;      // 0-4 (maps to 15/30/60/75/90)
  isFirstHalf: boolean;
  scores: IncrementScore[];      // results per increment
  yourGoals: number;
  opponentGoals: number;
  locked: boolean;
}

export interface IncrementScore {
  minute: number;
  yourScore: number;
  opponentScore: number;
  yourScored: boolean;
  opponentScored: boolean;
  events: MatchEvent[];
  cascade: ScoreCascade;
}

export interface ScoreCascade {
  basePower: number;
  chemistryBonus: number;
  styleBonus: number;
  tacticBonus: number;
  managerBonus: number;
  multiplier: number;
  total: number;
}
```

- [ ] **Step 2: Update rollXI for 11-card draw**

`rollXI(deck: Card[], formation: Formation, seed: number): HandState`

Draw 18 cards from deck. Fill 11 formation slots by position eligibility with durability weighting. 7 to bench. Rest to remainingDeck.

- [ ] **Step 3: Implement bench discard (draw from remaining deck)**

`discardFromBench(hand: HandState, benchCard: Card, seed: number): HandState`

Remove benchCard from bench, add to discard pile. Draw 1 from remainingDeck to bench. If remainingDeck is empty, return unchanged.

- [ ] **Step 4: Implement substitution**

`makeSub(hand: HandState, xiCard: Card, benchCard: Card, minute: number): HandState`

Swap xiCard out for benchCard. Decrement subsRemaining. Record in subsUsed. Validate: first half = injury subs only (xiCard.injured must be true). Second half = free subs.

- [ ] **Step 5: Update evaluateHand for 11 cards + tactic bonus**

`evaluateIncrement(hand: HandState, playingStyle: string, jokers: JokerCard[], opponentStrength: number, seed: number): IncrementScore`

Calculate score cascade at current increment. Apply tactic bonuses (some compound over increments like Possession). Return IncrementScore with goal resolution.

- [ ] **Step 6: Implement advanceIncrement**

`advanceIncrement(hand: HandState): HandState`

Move to next increment. At increment 2→3 (halftime transition): set isFirstHalf=false. Apply fatigue at increments 3+ (Glass/Phoenix shatter risk increases).

- [ ] **Step 7: Scale goal commentary for variety**

Update generateGoalText/generateChanceText to reference synergies, tactic effects, and substitutions. Add 90' last-minute drama text pool.

- [ ] **Step 8: Verify compiles and commit**

```bash
git add src/lib/hand.ts
git commit -m "feat(kc): v4 hand engine — 11-card XI, 5 increments, subs, bench discards"
```

---

## Task 5: Update RunState and Run Logic

**Files:**
- Modify: `apps/kickoff-clash/src/lib/run.ts`
- Modify: `apps/kickoff-clash/src/lib/jokers.ts`

- [ ] **Step 1: Update RunState interface**

Add fields:
```typescript
ownedFormations: string[];     // formation IDs player owns
tacticsDeck: TacticCard[];     // tactic cards in player's collection
activeFormation: string;       // currently selected formation
playingStyle: string;          // currently selected style
trainingApplied: Record<number, number>;  // cardId → total power added (max +20)
```

Update status: `'title' | 'packSelect' | 'setup' | 'match' | 'postmatch' | 'shop' | 'won' | 'lost'`

- [ ] **Step 2: Update createRun to accept PackContents**

`createRun(packContents: PackContents, seed?: number): RunState`

Initialize deck from pack players, tacticsDeck from pack tactics, ownedFormations from pack formations, jokers from pack managers.

- [ ] **Step 3: Update opponents for 11-card strength scale**

Scale opponent base strengths: 500, 650, 800, 950, 1100 (was 40-95 for 5-card XI).

- [ ] **Step 4: Scale joker bonuses for 11-card XI**

Update ALL_JOKERS compute functions — bonuses should be meaningful relative to an 11-card XI base of ~500-900.

- [ ] **Step 5: Add training card support**

`applyTraining(state: RunState, cardId: number): RunState` — +5 power to card, update trainingApplied record, max +20 per card. Costs £8,000.

- [ ] **Step 6: Add formation/tactic shop purchases**

`buyFormation(state: RunState, formationId: string): RunState` — £20,000
`buyTacticPack(state: RunState, seed: number): RunState` — £10,000, get 2 random tactic cards

- [ ] **Step 7: Verify compiles and commit**

```bash
git add src/lib/run.ts src/lib/jokers.ts
git commit -m "refactor(kc): v4 RunState — formations, tactics deck, training, scaled opponents"
```

---

## Task 6: MatchPhase — The Core Screen

**Files:**
- Create: `apps/kickoff-clash/src/components/MatchPhase.tsx`
- Delete: `apps/kickoff-clash/src/components/HandPhase.tsx` (replaced)
- Delete: `apps/kickoff-clash/src/components/ScoreReveal.tsx` (merged in)

This replaces both HandPhase and ScoreReveal with a single interactive match screen.

- [ ] **Step 1: Build MatchPhase layout**

The screen is divided into zones:

```
┌─────────────────────────────────────────┐
│ JOKER ROW: manager cards               │
├─────────────────────────────────────────┤
│ MATCH BAR: Score (big) + minute + opp  │
├─────────────────────────────────────────┤
│ TACTIC SLOTS: [___] [___] [___]        │
├─────────────────────────────────────────┤
│                                         │
│ XI: 11 cards in formation layout        │
│ (scrollable pitch view on mobile)       │
│                                         │
├─────────────────────────────────────────┤
│ BENCH: 7 cards (horizontal scroll)      │
│ [Discard] [Sub] buttons                 │
├─────────────────────────────────────────┤
│ [▶ ADVANCE TO 15'] or [⏱ HALF TIME]   │
│ CASCADE DISPLAY (after advance)         │
└─────────────────────────────────────────┘
```

- [ ] **Step 2: Implement increment flow**

State machine within MatchPhase:
- `'planning'` — player can discard/sub/deploy tactics, advance button visible
- `'resolving'` — increment scores cascade animation plays (2-3 seconds)
- `'halftime'` — between increment 2→3, full intervention window
- `'finished'` — all 5 increments done, show final score, continue button

- [ ] **Step 3: Wire up bench discards**

Tap a bench card → shows "Discard?" confirm → calls `discardFromBench()` → new card appears on bench from deck. Shows remaining deck count.

- [ ] **Step 4: Wire up subs**

Tap bench card → tap XI card → confirm sub → `makeSub()` called. First half: only works if XI card is injured. Second half: any card. Show "X subs remaining".

- [ ] **Step 5: Wire up tactic deployment**

Show 3 tactic slots above the XI. Tap empty slot → shows available tactic cards from player's tacticsDeck. Select one → deployed. Contradictions auto-resolved (contradicted card removed with visual feedback). Show contradiction warning before deploying.

- [ ] **Step 6: Wire up cascade display**

After advancing an increment, show the Balatro-style cascade:
```
XI Base: 847
+ Chemistry: +124 (Creative Spark, Pirlo-Barella, Fortress)
+ Tiki-Taka: +63
+ High Line: +42
+ The Professor: +50
= 1126 × 1.35
= 1520 vs 800
→ 15' GOAL! ⚽
```

Numbers count up sequentially. Chemistry connections glow. Goal event gets big amber treatment.

- [ ] **Step 7: Wire up half time**

After increment 2 resolves, show "HALF TIME" overlay. Enable: free subs, formation change (dropdown of owned formations), tactic swap. "Second Half →" button to continue.

- [ ] **Step 8: Wire up 90' drama + finish**

At increment 5 (90'): apply ×1.3 goal chance multiplier. After resolution: show "FULL TIME" with final score. "Continue" button calls onMatchComplete.

- [ ] **Step 9: Props interface**

```typescript
interface MatchPhaseProps {
  runState: RunState;
  onMatchComplete: (result: {
    yourGoals: number;
    opponentGoals: number;
    result: 'win' | 'draw' | 'loss';
    attendance: number;
    revenue: number;
    handState: HandState;  // for durability check
  }) => void;
}
```

- [ ] **Step 10: Verify compiles and commit**

```bash
git add src/components/MatchPhase.tsx
git rm src/components/HandPhase.tsx src/components/ScoreReveal.tsx
git commit -m "feat(kc): MatchPhase — 11-card XI, 5 increments, subs, tactics, cascade"
```

---

## Task 7: Update SetupPhase for Pack Selection

**Files:**
- Modify: `apps/kickoff-clash/src/components/SetupPhase.tsx`

- [ ] **Step 1: Replace formation+style picker with pack selection + style**

The run now starts with:
1. Pack selection (Academy / Chequebook / Gaffer) — tap one of 3 cards
2. Style selection (kept from current — Tiki-Taka etc.)
3. "Open Pack" button

Formation is NOT selected at run start — you get one from your pack and can buy more later.

Props update:
```typescript
interface SetupPhaseProps {
  onStart: (packType: PackType, style: string) => void;
}
```

- [ ] **Step 2: Verify compiles and commit**

```bash
git add src/components/SetupPhase.tsx
git commit -m "feat(kc): SetupPhase — pack selection + style picker"
```

---

## Task 8: Update ShopPhase

**Files:**
- Modify: `apps/kickoff-clash/src/components/ShopPhase.tsx`

- [ ] **Step 1: Add new shop sections**

Add to existing shop:
- **Tactic Pack** (£10,000): buy 2 random tactic cards
- **Formation Card** (£20,000): buy a random formation you don't own
- **Training Card** (£8,000): select a player card to apply +5 power (show current training level, max +20)

Props update — add handlers:
```typescript
onBuyTacticPack: () => void;
onBuyFormation: () => void;
onTrainPlayer: (cardId: number) => void;
```

- [ ] **Step 2: Show owned formations and tactic deck counts**

Display current collection: "Formations: 4-3-3, 3-5-2" and "Tactics: 6 cards".

- [ ] **Step 3: Verify compiles and commit**

```bash
git add src/components/ShopPhase.tsx
git commit -m "feat(kc): ShopPhase — tactic/formation/training purchases"
```

---

## Task 9: Update GameShell

**Files:**
- Modify: `apps/kickoff-clash/src/components/GameShell.tsx`

- [ ] **Step 1: Update phase flow**

New phases: `'title' | 'setup' | 'match' | 'postmatch' | 'shop' | 'end'`

Remove `'hand'` and `'scoring'` — they're now internal to MatchPhase.

Flow:
```
title → setup (pack+style) → match → postmatch → shop → match → ... → end
```

- [ ] **Step 2: Wire up pack opening in handleStart**

```typescript
handleStart(packType: PackType, style: string) {
  const contents = openPack(packType, seed);
  const run = createRun(contents, seed);
  run.playingStyle = style;
  setRunState(run);
  setPhase('match');
}
```

- [ ] **Step 3: Wire up MatchPhase integration**

Replace HandPhase+ScoreReveal with single MatchPhase component:
```typescript
case 'match':
  return <MatchPhase runState={runState} onMatchComplete={handleMatchComplete} />;
```

`handleMatchComplete` processes result (attendance, durability, update wins/losses/cash), transitions to postmatch.

- [ ] **Step 4: Wire up new shop handlers**

Add handlers for tactic pack, formation, and training purchases. Update runState accordingly.

- [ ] **Step 5: Update serialization for new fields**

Serialize: ownedFormations, tacticsDeck (as IDs), trainingApplied, activeFormation.
Deserialize: rehydrate tactic cards via getTacticById.

- [ ] **Step 6: Verify compiles and commit**

```bash
git add src/components/GameShell.tsx
git commit -m "feat(kc): GameShell v4 — pack opening, match phase, new shop handlers"
```

---

## Task 10: Integration Test + Cleanup

**Files:**
- Various cleanup across all modified files

- [ ] **Step 1: Remove deleted component imports**

Clean up any remaining references to HandPhase or ScoreReveal.

- [ ] **Step 2: Build test**

```bash
cd apps/kickoff-clash && npx next build 2>&1 | tail -20
```

Fix any build errors.

- [ ] **Step 3: Dev server smoke test**

Start dev server, verify: title → pack selection → match loads with 11-card XI → can advance through increments → post-match → shop → next match.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(kc): v4 integration — build passing, full game loop"
```
