/**
 * Kickoff Clash — Hand Evaluation Engine
 *
 * Balatro-style hand mechanics: roll XI → discard/redraw → evaluate → resolve.
 * A "hand" is 5 cards dealt from a deck into formation slots. Chemistry tiers
 * act like poker hand types — higher tier = bigger multiplier.
 */

import {
  type Card,
  type SlottedCard,
  type Durability,
  DURABILITY_WEIGHTS,
  PLAYING_STYLES,
  seededRandom,
} from './scoring';
import { findConnections, type Connection } from './chemistry';
import { getFormationSlots } from './run';
import type { JokerCard } from './jokers';

// Re-export JokerCard from the canonical jokers module
export type { JokerCard } from './jokers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HandState {
  xi: Card[];                // current XI (5 cards dealt from deck)
  bench: Card[];             // remaining deck cards not in XI
  discardsRemaining: number; // starts at 3
  locked: boolean;
}

export interface HandScore {
  basePower: number;         // sum of card power values
  chemistryBonus: number;    // flat points from synergy connections
  styleBonus: number;        // from playing style match
  jokerBonus: number;        // from active jokers
  totalStrength: number;     // final score after multiplier
  connections: Connection[]; // active synergies
  multiplier: number;        // chemistry multiplier (1.0 = no synergies)
}

export interface MatchOutcome {
  yourStrength: number;
  opponentStrength: number;
  yourGoals: number;
  opponentGoals: number;
  result: 'win' | 'draw' | 'loss';
  events: MatchEvent[];
}

export interface MatchEvent {
  minute: number;
  text: string;
  type: 'goal-yours' | 'goal-opponent' | 'chance' | 'save';
}

// ---------------------------------------------------------------------------
// Position / Slot Mapping
// ---------------------------------------------------------------------------

const SLOT_ACCEPTS: Record<string, string[]> = {
  GK:  ['GK'],
  CD:  ['CD', 'WD'],
  WD:  ['WD', 'CD'],
  DM:  ['DM', 'CM'],
  CM:  ['CM', 'DM', 'AM'],
  CM2: ['CM', 'DM', 'AM'],
  WM:  ['WM', 'WD', 'WF'],
  AM:  ['AM', 'CM', 'WF'],
  WF:  ['WF', 'WM', 'AM'],
  CF:  ['CF', 'WF', 'AM'],
};

/**
 * Check if a card's position can fill a formation slot.
 */
export function positionFitsSlot(position: string, slot: string): boolean {
  // Strip any trailing suffix (e.g. "CM2" → "CM" for lookup, but keep CM2 as key)
  const accepted = SLOT_ACCEPTS[slot];
  if (accepted) return accepted.includes(position);
  // Fallback: exact match
  return position === slot.replace(/\d+$/, '');
}

// ---------------------------------------------------------------------------
// Weighted Pick
// ---------------------------------------------------------------------------

/**
 * Pick a card weighted by durability. Titanium cards have overwhelming weight
 * (auto-select). Returns undefined if cards is empty.
 */
export function weightedPick(cards: Card[], seed: number): Card | undefined {
  if (cards.length === 0) return undefined;
  if (cards.length === 1) return cards[0];

  const weights = cards.map(c => DURABILITY_WEIGHTS[c.durability as Durability] ?? 1.0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const roll = seededRandom(seed) * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < cards.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return cards[i];
  }
  return cards[cards.length - 1];
}

// ---------------------------------------------------------------------------
// Roll XI
// ---------------------------------------------------------------------------

/**
 * Deal 5 cards from the deck into formation slots.
 * Titanium cards auto-select first. Others chosen by weighted random.
 */
export function rollXI(deck: Card[], formation: string, seed: number): HandState {
  const slots = getFormationSlots(formation);
  const available = [...deck];
  const xi: Card[] = [];
  let currentSeed = seed;

  for (const slot of slots) {
    // Find eligible cards for this slot
    const eligible = available.filter(c => positionFitsSlot(c.position, slot));

    if (eligible.length === 0) {
      // No positional match — pick any remaining card
      const fallback = weightedPick(available, currentSeed);
      currentSeed = currentSeed * 31 + 7;
      if (fallback) {
        xi.push(fallback);
        available.splice(available.indexOf(fallback), 1);
      }
      continue;
    }

    const picked = weightedPick(eligible, currentSeed);
    currentSeed = currentSeed * 31 + 7;
    if (picked) {
      xi.push(picked);
      available.splice(available.indexOf(picked), 1);
    }
  }

  return {
    xi,
    bench: available,
    discardsRemaining: 3,
    locked: false,
  };
}

// ---------------------------------------------------------------------------
// Discard & Draw
// ---------------------------------------------------------------------------

/**
 * Swap a card from XI for a random bench draw.
 * Returns unchanged hand if no discards left or hand is locked.
 */
export function discardAndDraw(hand: HandState, cardToDiscard: Card, seed: number): HandState {
  if (hand.discardsRemaining <= 0 || hand.locked) return hand;

  const xiIndex = hand.xi.findIndex(c => c.id === cardToDiscard.id);
  if (xiIndex === -1) return hand; // card not in XI

  if (hand.bench.length === 0) return hand; // nothing to draw

  // Pick from bench
  const drawn = weightedPick(hand.bench, seed);
  if (!drawn) return hand;

  const newXI = [...hand.xi];
  const newBench = hand.bench.filter(c => c.id !== drawn.id);

  // Discarded card goes to bench
  newBench.push(newXI[xiIndex]);
  // Drawn card replaces it in XI
  newXI[xiIndex] = drawn;

  return {
    xi: newXI,
    bench: newBench,
    discardsRemaining: hand.discardsRemaining - 1,
    locked: hand.locked,
  };
}

// ---------------------------------------------------------------------------
// Evaluate Hand
// ---------------------------------------------------------------------------

/**
 * Score a hand: base power + chemistry + style + jokers, multiplied by tier.
 */
export function evaluateHand(
  xi: Card[],
  playingStyle: string,
  jokers: JokerCard[],
): HandScore {
  // Convert to SlottedCard[] for chemistry — assign generic slot names
  const slots = getFormationSlots('4-3-3'); // default slots for chemistry eval
  const slottedCards: SlottedCard[] = xi.map((card, i) => ({
    card,
    slot: slots[i] ?? `SLOT_${i}`,
  }));

  // Find connections
  const connections = findConnections(slottedCards);

  // Base power
  const basePower = xi.reduce((sum, c) => sum + c.power, 0);

  // Chemistry bonus (sum of flat bonuses)
  const chemistryBonus = connections.reduce((sum, conn) => sum + conn.bonus, 0);

  // Multiplier from highest tier
  const highestTier = connections.length > 0
    ? Math.max(...connections.map(c => c.tier))
    : 0;

  const tierMultipliers: Record<number, number> = {
    0: 1.0,
    1: 1.2,
    2: 1.5,
    3: 2.0,
    4: 3.0,
  };

  let multiplier = tierMultipliers[highestTier] ?? 1.0;

  // +0.1 per additional connection beyond the first (max +0.3)
  if (connections.length > 1) {
    const extraConnections = Math.min(connections.length - 1, 3);
    multiplier += extraConnections * 0.1;
  }

  // Style bonus: count archetype matches, apply multiplier per match
  let styleBonus = 0;
  const style = PLAYING_STYLES[playingStyle];
  if (style) {
    if (style.bonusArchetypes.length === 0) {
      // Total Football: flat bonus per card
      styleBonus = Math.round(basePower * style.multiplier * xi.length / xi.length);
      // Simplified: basePower * multiplier (0.05 per card, applied to all)
      styleBonus = Math.round(basePower * style.multiplier);
    } else {
      const matchCount = xi.filter(c =>
        style.bonusArchetypes.includes(c.archetype),
      ).length;
      styleBonus = Math.round(basePower * style.multiplier * matchCount / xi.length);
    }
  }

  // Joker bonus
  const jokerBonus = jokers.reduce(
    (sum, j) => sum + j.compute(xi, connections),
    0,
  );

  // Total strength
  const totalStrength = Math.round(
    (basePower + chemistryBonus + styleBonus + jokerBonus) * multiplier,
  );

  return {
    basePower,
    chemistryBonus,
    styleBonus,
    jokerBonus,
    totalStrength,
    connections,
    multiplier,
  };
}

// ---------------------------------------------------------------------------
// Match Resolution
// ---------------------------------------------------------------------------

const GOAL_COMMENTARY = [
  "Thunderbolt into the top corner!",
  "Slotted home with the composure of a seasoned pro.",
  "A tap-in after a gorgeous team move.",
  "Headed in from a pinpoint cross!",
  "Curled it around the wall — what a free kick!",
  "Cool as you like from the penalty spot.",
  "A scramble in the box and it's bundled over the line!",
  "Chips the keeper from 30 yards — outrageous!",
  "Arrives late at the back post — clinical finish.",
  "One-on-one and makes no mistake.",
  "Absolute rocket from outside the box!",
  "Pokes it through the keeper's legs — nutmeg!",
  "Overhead kick! Are you kidding me?!",
  "Dinks it over the keeper with pure audacity.",
  "Smashes it in off the crossbar — what a hit!",
];

const CHANCE_COMMENTARY = [
  "Hits the post and bounces away! So close.",
  "The keeper pulls off a world-class save!",
  "Blazes it over from six yards — how?!",
  "Cleared off the line at the last second.",
  "The crossbar rattles but it stays out!",
  "Scuffs the shot wide — should've done better.",
  "Great save! Tips it around the corner.",
  "Header flashes just past the post.",
  "One-on-one but the keeper stands tall!",
  "Somehow hits both posts and comes back out.",
  "VAR check — nope, offside by a toenail.",
  "Skies it into row Z. The crowd groans.",
  "Slips at the crucial moment — chance gone.",
  "Curler heading in but the wind takes it wide.",
  "Blocked on the line by a last-ditch tackle!",
];

const OPPONENT_GOAL_COMMENTARY = [
  "They break and finish clinically.",
  "A set piece goal — poor marking in the box.",
  "A deflection wrong-foots the keeper. Cruel.",
  "Long-range effort and it nestles in the corner.",
  "Counter-attack at pace — nothing you could do.",
  "Penalty given. Converted coolly.",
  "A mistake at the back is ruthlessly punished.",
  "They score against the run of play. Typical.",
];

/**
 * Generate goal commentary, referencing synergies when possible.
 */
export function generateGoalText(score: HandScore, seed: number): string {
  if (score.connections.length > 0) {
    const connIdx = Math.floor(seededRandom(seed * 17 + 3) * score.connections.length);
    const conn = score.connections[connIdx];
    const prefixes = [
      `The ${conn.name} synergy pays off!`,
      `${conn.cards[0]} and ${conn.cards[1] ?? 'the lads'} combine brilliantly!`,
      `Chemistry unlocked — ${conn.name}!`,
    ];
    const prefixIdx = Math.floor(seededRandom(seed * 23 + 11) * prefixes.length);
    const goalIdx = Math.floor(seededRandom(seed * 37 + 7) * GOAL_COMMENTARY.length);
    return `${prefixes[prefixIdx]} ${GOAL_COMMENTARY[goalIdx]}`;
  }
  const idx = Math.floor(seededRandom(seed * 41 + 13) * GOAL_COMMENTARY.length);
  return GOAL_COMMENTARY[idx];
}

/**
 * Generate near-miss commentary.
 */
export function generateChanceText(seed: number): string {
  const idx = Math.floor(seededRandom(seed * 53 + 19) * CHANCE_COMMENTARY.length);
  return CHANCE_COMMENTARY[idx];
}

function generateOpponentGoalText(seed: number): string {
  const idx = Math.floor(seededRandom(seed * 59 + 23) * OPPONENT_GOAL_COMMENTARY.length);
  return OPPONENT_GOAL_COMMENTARY[idx];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Resolve a match: compare strength, generate events, determine result.
 */
export function resolveMatch(
  handScore: HandScore,
  opponentStrength: number,
  seed: number,
): MatchOutcome {
  const diff = handScore.totalStrength - opponentStrength;
  const yourChance = clamp(0.15 + diff / 400, 0.05, 0.60);
  const oppChance = clamp(0.15 - diff / 400, 0.05, 0.60);

  // Generate 5-7 events at various minutes
  let eventSeed = seed;
  const numEvents = 5 + Math.floor(seededRandom(eventSeed) * 3);
  eventSeed = eventSeed * 31 + 1;

  // Generate sorted random minutes (1-90)
  const minutes: number[] = [];
  for (let i = 0; i < numEvents; i++) {
    const minute = 1 + Math.floor(seededRandom(eventSeed) * 90);
    minutes.push(minute);
    eventSeed = eventSeed * 31 + 1;
  }
  minutes.sort((a, b) => a - b);

  const events: MatchEvent[] = [];
  let yourGoals = 0;
  let opponentGoals = 0;

  for (const minute of minutes) {
    const roll = seededRandom(eventSeed);
    eventSeed = eventSeed * 31 + 1;

    if (roll < yourChance) {
      // Your goal
      yourGoals++;
      events.push({
        minute,
        text: generateGoalText(handScore, eventSeed),
        type: 'goal-yours',
      });
    } else if (roll < yourChance + oppChance) {
      // Opponent goal
      opponentGoals++;
      events.push({
        minute,
        text: generateOpponentGoalText(eventSeed),
        type: 'goal-opponent',
      });
    } else if (roll < yourChance + oppChance + 0.15) {
      // Near miss / save
      const isSave = seededRandom(eventSeed * 7) > 0.5;
      events.push({
        minute,
        text: generateChanceText(eventSeed),
        type: isSave ? 'save' : 'chance',
      });
    } else {
      // Chance event (less dramatic)
      events.push({
        minute,
        text: generateChanceText(eventSeed),
        type: 'chance',
      });
    }
    eventSeed = eventSeed * 31 + 1;
  }

  const result: 'win' | 'draw' | 'loss' =
    yourGoals > opponentGoals ? 'win' :
    yourGoals < opponentGoals ? 'loss' :
    'draw';

  return {
    yourStrength: handScore.totalStrength,
    opponentStrength,
    yourGoals,
    opponentGoals,
    result,
    events,
  };
}
