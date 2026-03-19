/**
 * Kickoff Clash — Run State Manager (v2)
 *
 * Manages the entire roguelike run state, client-side only.
 * v2: Deck shuffle with weighted random, durability system, action cards, academy.
 */

import {
  Card, SlottedCard, Durability, PlayingStyle,
  PLAYING_STYLES, DURABILITY_WEIGHTS, SHATTER_CHANCE, INJURY_CHANCE,
  MatchState, RoundResult,
  calculateXIStrength, resolveRound, createMatchState, advanceMatchState,
  seededRandom,
} from './scoring';
import { ActionCard, ALL_ACTION_CARDS, getActionCardsByType } from './actions';
import {
  calculateAttendance, getStadiumTier, getStadium, getTransferFee,
  SHOP_ITEMS, ShopItem, ACADEMY_TIERS, ACADEMY_UPGRADE_COST,
  generateAcademyDurability, getAcademyTier,
} from './economy';
import { findConnections } from './chemistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunState {
  formation: string;
  playingStyle: string;
  deck: Card[];
  lineup: SlottedCard[];
  bench: Card[];
  actionDeck: ActionCard[];
  hand: ActionCard[];
  cash: number;
  stadiumTier: number;
  ticketPriceBonus: number;
  academyTier: number;
  round: number;       // match number (1-5)
  wins: number;
  losses: number;
  status: 'setup' | 'prematch' | 'playing' | 'postmatch' | 'shop' | 'won' | 'lost';
  matchState: MatchState | null;
  matchHistory: MatchResult[];
  modifiers: unknown[];
  seed: number;
}

export interface MatchResult {
  round: number;
  opponentName: string;
  yourGoals: number;
  opponentGoals: number;
  attendance: number;
  revenue: number;
  result: 'win' | 'draw' | 'loss';
  synergiesTriggered: string[];
  shattered: string[];
  injured: string[];
  promoted: string[];
}

export interface Opponent {
  name: string;
  baseStrength: number;
  actionsPerRound: number;
  style: string;
}

export interface OpponentPlayer {
  name: string;
  position: string;
  archetype: string;
  power: number;
  personalityTheme: string;
}

export interface OpponentBuild {
  name: string;
  formation: string;
  style: string;
  baseStrength: number;
  actionsPerRound: number;
  xi: OpponentPlayer[];
  synergies: string[];
  weakness: string;
  weaknessArchetype: string;
  starPlayer: OpponentPlayer;
  starAbility: string;
}

export interface DeckAnalysis {
  archetypeCounts: Record<string, number>;
  durabilityCounts: Record<string, number>;
  positionCounts: Record<string, number>;
  activeSynergies: string[];
  nearSynergies: { name: string; missing: string }[];
  warnings: string[];
  opponentMatch: { weakness: string; weaknessArchetype: string; count: number };
}

export interface DurabilityResult {
  shattered: Card[];
  injured: Card[];
  promoted: Card[];
  commentary: string[];
}

// ---------------------------------------------------------------------------
// Formation Slots (5-slot prototype)
// ---------------------------------------------------------------------------

const FORMATION_SLOTS: Record<string, string[]> = {
  '4-3-3': ['CD', 'WD', 'CM', 'WF', 'CF'],
  '4-4-2': ['CD', 'WM', 'CM', 'CM2', 'CF'],
  '3-5-2': ['CD', 'DM', 'CM', 'WM', 'CF'],
};

export function getFormationSlots(formation: string): string[] {
  return FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3'];
}

const SLOT_DISPLAY: Record<string, string> = {
  CD: 'Centre-Back',
  WD: 'Full-Back',
  DM: 'Def. Mid',
  CM: 'Central Mid',
  CM2: 'Central Mid',
  WM: 'Wide Mid',
  WF: 'Winger',
  CF: 'Striker',
};

export function getSlotDisplayName(slot: string): string {
  return SLOT_DISPLAY[slot] ?? slot;
}

const SLOT_POSITIONS: Record<string, Record<string, { x: number; y: number }>> = {
  '4-3-3': {
    CD: { x: 50, y: 78 },
    WD: { x: 15, y: 65 },
    CM: { x: 50, y: 50 },
    WF: { x: 15, y: 28 },
    CF: { x: 50, y: 15 },
  },
  '4-4-2': {
    CD: { x: 50, y: 78 },
    WM: { x: 15, y: 55 },
    CM: { x: 40, y: 50 },
    CM2: { x: 60, y: 50 },
    CF: { x: 50, y: 18 },
  },
  '3-5-2': {
    CD: { x: 50, y: 78 },
    DM: { x: 35, y: 60 },
    CM: { x: 65, y: 50 },
    WM: { x: 15, y: 40 },
    CF: { x: 50, y: 18 },
  },
};

export function getSlotPosition(formation: string, slot: string): { x: number; y: number } {
  return SLOT_POSITIONS[formation]?.[slot] ?? { x: 50, y: 50 };
}

// ---------------------------------------------------------------------------
// Position Group Mapping (which positions are eligible for each slot)
// ---------------------------------------------------------------------------

const SLOT_ELIGIBLE_POSITIONS: Record<string, string[]> = {
  GK:  ['GK'],
  CD:  ['CD', 'DM'],
  WD:  ['WD', 'WM'],
  DM:  ['DM', 'CM', 'CD'],
  CM:  ['CM', 'DM', 'AM'],
  CM2: ['CM', 'DM', 'AM'],
  WM:  ['WM', 'WD', 'WF'],
  AM:  ['AM', 'CM', 'WF'],
  WF:  ['WF', 'WM', 'AM'],
  CF:  ['CF', 'AM', 'WF'],
};

// ---------------------------------------------------------------------------
// Opponents (v2 — base strength instead of target score)
// ---------------------------------------------------------------------------

const OPPONENTS: Opponent[] = [
  { name: 'FC Warm-Up',       baseStrength: 40,  actionsPerRound: 0, style: 'Passive' },
  { name: 'Dynamo Midtable',  baseStrength: 55,  actionsPerRound: 1, style: 'Balanced' },
  { name: 'Real Ambition',    baseStrength: 70,  actionsPerRound: 1, style: 'Attacking' },
  { name: 'AC Nightmare',     baseStrength: 80,  actionsPerRound: 2, style: 'Counter-attacking' },
  { name: 'The Invincibles',  baseStrength: 95,  actionsPerRound: 2, style: 'Adaptive' },
];

export function getOpponent(round: number): Opponent {
  return OPPONENTS[Math.min(round - 1, OPPONENTS.length - 1)];
}

// ---------------------------------------------------------------------------
// Opponent Builds (full XI with weaknesses & synergies)
// ---------------------------------------------------------------------------

const OPPONENT_BUILDS: OpponentBuild[] = [
  {
    name: 'FC Warm-Up',
    formation: '4-4-2',
    style: 'Direct Play',
    baseStrength: 40,
    actionsPerRound: 0,
    xi: [
      { name: 'The Donkey', position: 'CF', archetype: 'Target', power: 35, personalityTheme: 'General' },
      { name: 'Boot It', position: 'CM', archetype: 'Powerhouse', power: 30, personalityTheme: 'General' },
      { name: 'Long Ball Larry', position: 'CM', archetype: 'Passer', power: 32, personalityTheme: 'Professor' },
      { name: 'The Slug', position: 'CD', archetype: 'Cover', power: 28, personalityTheme: 'General' },
      { name: 'Butterfingers', position: 'GK', archetype: 'GK', power: 25, personalityTheme: 'Professor' },
    ],
    synergies: [],
    weakness: 'Weak to pace',
    weaknessArchetype: 'Sprinter',
    starPlayer: { name: 'The Donkey', position: 'CF', archetype: 'Target', power: 35, personalityTheme: 'General' },
    starAbility: 'Scores ugly goals from set pieces',
  },
  {
    name: 'Dynamo Midtable',
    formation: '4-3-3',
    style: 'Balanced',
    baseStrength: 55,
    actionsPerRound: 1,
    xi: [
      { name: 'Mr. Consistent', position: 'CM', archetype: 'Controller', power: 55, personalityTheme: 'General' },
      { name: 'The Workhorse', position: 'CM', archetype: 'Engine', power: 50, personalityTheme: 'Captain' },
      { name: 'Target Practice', position: 'CF', archetype: 'Striker', power: 52, personalityTheme: 'General' },
      { name: 'The Organiser', position: 'CD', archetype: 'Commander', power: 48, personalityTheme: 'Captain' },
      { name: 'Safe Hands', position: 'GK', archetype: 'GK', power: 45, personalityTheme: 'General' },
    ],
    synergies: ['Engine Room'],
    weakness: 'Lacks creativity',
    weaknessArchetype: 'Creator',
    starPlayer: { name: 'Mr. Consistent', position: 'CM', archetype: 'Controller', power: 55, personalityTheme: 'General' },
    starAbility: 'Never loses the ball',
  },
  {
    name: 'Real Ambition',
    formation: '3-5-2',
    style: 'Tiki-Taka',
    baseStrength: 70,
    actionsPerRound: 1,
    xi: [
      { name: 'El Maestro', position: 'AM', archetype: 'Creator', power: 70, personalityTheme: 'Maestro' },
      { name: 'The Architect', position: 'CM', archetype: 'Controller', power: 65, personalityTheme: 'Professor' },
      { name: 'Silky', position: 'CM', archetype: 'Passer', power: 63, personalityTheme: 'Maestro' },
      { name: 'The Ghost', position: 'CF', archetype: 'Dribbler', power: 60, personalityTheme: 'Maestro' },
      { name: 'The Sweeper', position: 'CD', archetype: 'Cover', power: 58, personalityTheme: 'Professor' },
    ],
    synergies: ['Puppet Masters', 'Passing Carousel'],
    weakness: 'Overloaded midfield, open flanks',
    weaknessArchetype: 'Engine',
    starPlayer: { name: 'El Maestro', position: 'AM', archetype: 'Creator', power: 70, personalityTheme: 'Maestro' },
    starAbility: 'Creates chances from nothing',
  },
  {
    name: 'AC Nightmare',
    formation: '5-3-2',
    style: 'Counter-Attack',
    baseStrength: 80,
    actionsPerRound: 2,
    xi: [
      { name: 'The Wall', position: 'CD', archetype: 'Destroyer', power: 80, personalityTheme: 'Captain' },
      { name: 'The Sentinel', position: 'DM', archetype: 'Cover', power: 75, personalityTheme: 'General' },
      { name: 'Iron Curtain', position: 'CD', archetype: 'Destroyer', power: 72, personalityTheme: 'Captain' },
      { name: 'The Sniper', position: 'CF', archetype: 'Striker', power: 70, personalityTheme: 'General' },
      { name: 'The Anchor', position: 'DM', archetype: 'Cover', power: 68, personalityTheme: 'Captain' },
    ],
    synergies: ['Brick Wall', 'Fortress'],
    weakness: 'Compact but slow',
    weaknessArchetype: 'Dribbler',
    starPlayer: { name: 'The Wall', position: 'CD', archetype: 'Destroyer', power: 80, personalityTheme: 'Captain' },
    starAbility: 'Blocks everything',
  },
  {
    name: 'The Invincibles',
    formation: '4-3-3',
    style: 'Gegenpressing',
    baseStrength: 95,
    actionsPerRound: 2,
    xi: [
      { name: 'The Machine', position: 'CM', archetype: 'Engine', power: 90, personalityTheme: 'Captain' },
      { name: 'The Hurricane', position: 'WF', archetype: 'Sprinter', power: 88, personalityTheme: 'Catalyst' },
      { name: 'The Genius', position: 'AM', archetype: 'Creator', power: 92, personalityTheme: 'Maestro' },
      { name: 'The Rock', position: 'CD', archetype: 'Destroyer', power: 85, personalityTheme: 'General' },
      { name: 'The Cat', position: 'GK', archetype: 'GK', power: 82, personalityTheme: 'Professor' },
    ],
    synergies: ['Pressing Trap', 'Shield & Sword', 'Creative Spark'],
    weakness: 'Relentless but fragile keeper',
    weaknessArchetype: 'Striker',
    starPlayer: { name: 'The Machine', position: 'CM', archetype: 'Engine', power: 90, personalityTheme: 'Captain' },
    starAbility: 'Covers every blade of grass',
  },
];

export function getOpponentBuild(round: number): OpponentBuild {
  return OPPONENT_BUILDS[Math.min(round - 1, OPPONENT_BUILDS.length - 1)];
}

// ---------------------------------------------------------------------------
// Deck Analysis
// ---------------------------------------------------------------------------

export function analyzeDeck(deck: Card[], opponent: OpponentBuild): DeckAnalysis {
  // Count archetypes
  const archetypeCounts: Record<string, number> = {};
  const durabilityCounts: Record<string, number> = {};
  const positionCounts: Record<string, number> = {};

  for (const c of deck) {
    archetypeCounts[c.archetype] = (archetypeCounts[c.archetype] ?? 0) + 1;
    durabilityCounts[c.durability] = (durabilityCounts[c.durability] ?? 0) + 1;
    positionCounts[c.position] = (positionCounts[c.position] ?? 0) + 1;
  }

  // Active synergies: archetype duos (2+ of same archetype)
  const activeSynergies: string[] = [];
  for (const [arch, count] of Object.entries(archetypeCounts)) {
    if (count >= 2) {
      const pairName = arch === 'Engine' ? 'Pressing Trap' :
        arch === 'Destroyer' ? 'Brick Wall' :
        arch === 'Creator' ? 'Creative Spark' :
        arch === 'Cover' ? 'Fortress' :
        arch === 'Passer' ? 'Passing Carousel' :
        arch === 'Sprinter' ? 'Lightning Strike' :
        arch === 'Striker' ? 'Double Trouble' :
        arch === 'Dribbler' ? 'Skill Show' :
        arch === 'Target' ? 'Aerial Dominance' :
        arch === 'Powerhouse' ? 'Muscle Memory' :
        arch === 'Controller' ? 'Puppet Masters' :
        arch === 'Commander' ? 'Chain of Command' :
        `${arch} Duo`;
      activeSynergies.push(pairName);
    }
  }

  // Check role combos from deck
  const roleSet = new Set(deck.map(c => c.tacticalRole).filter(Boolean));
  const ROLE_COMBOS_LIST = [
    { name: 'The Pirlo-Barella', role1: 'Regista', role2: 'Mezzala' },
    { name: 'Shield & Sword', role1: 'Sentinelle', role2: 'Trequartista' },
    { name: 'Overlap', role1: 'Lateral', role2: 'Inside Forward' },
    { name: 'The Guardiola', role1: 'Falso Nove', role2: 'Winger' },
    { name: 'The Double Pivot', role1: 'Sentinelle', role2: 'Volante' },
    { name: 'Counter Punch', role1: 'Volante', role2: 'Extremo' },
    { name: 'Total Control', role1: 'Metodista', role2: 'Regista' },
    { name: 'The Wall', role1: 'Vorstopper', role2: 'Zagueiro' },
    { name: 'Engine Room', role1: 'Tuttocampista', role2: 'Relayeur' },
    { name: 'Creative Hub', role1: 'Fantasista', role2: 'Trequartista' },
  ];

  for (const combo of ROLE_COMBOS_LIST) {
    if (roleSet.has(combo.role1) && roleSet.has(combo.role2)) {
      activeSynergies.push(combo.name);
    }
  }

  // Near synergies: role combos where we have one but not the other
  const nearSynergies: { name: string; missing: string }[] = [];
  for (const combo of ROLE_COMBOS_LIST) {
    if (roleSet.has(combo.role1) && !roleSet.has(combo.role2)) {
      nearSynergies.push({ name: combo.name, missing: combo.role2 });
    } else if (roleSet.has(combo.role2) && !roleSet.has(combo.role1)) {
      nearSynergies.push({ name: combo.name, missing: combo.role1 });
    }
  }

  // Warnings
  const warnings: string[] = [];
  const glassDurability = durabilityCounts['glass'] ?? 0;
  if (glassDurability >= 3) {
    warnings.push(`${glassDurability} Glass cards — risky`);
  }
  const gkCount = positionCounts['GK'] ?? 0;
  if (gkCount <= 1) {
    warnings.push('Only 1 GK');
  }
  if (gkCount === 0) {
    warnings.push('No GK in deck');
  }
  // Check position coverage for formation slots
  const defPositions = ['CD', 'WD'];
  const midPositions = ['DM', 'CM', 'WM', 'AM'];
  const atkPositions = ['WF', 'CF'];
  if (!deck.some(c => defPositions.includes(c.position))) {
    warnings.push('No defenders in deck');
  }
  if (!deck.some(c => midPositions.includes(c.position))) {
    warnings.push('No midfielders in deck');
  }
  if (!deck.some(c => atkPositions.includes(c.position))) {
    warnings.push('No attackers in deck');
  }

  // Opponent match
  const weaknessCount = deck.filter(c => c.archetype === opponent.weaknessArchetype).length;
  const opponentMatch = {
    weakness: opponent.weakness,
    weaknessArchetype: opponent.weaknessArchetype,
    count: weaknessCount,
  };

  return {
    archetypeCounts,
    durabilityCounts,
    positionCounts,
    activeSynergies,
    nearSynergies,
    warnings,
    opponentMatch,
  };
}

// ---------------------------------------------------------------------------
// Seeded Shuffle
// ---------------------------------------------------------------------------

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Deck Shuffle & XI Selection (v2)
// ---------------------------------------------------------------------------

/**
 * Auto-populate the XI from the deck using weighted random selection.
 *
 * 1. For each formation slot, gather eligible cards by position group
 * 2. Titanium cards auto-fill their position slot first
 * 3. For remaining slots, weighted random pick (weight = DURABILITY_WEIGHTS)
 * 4. Remaining cards go to bench
 * 5. Injured cards are skipped
 */
export function shuffleAndSelectXI(
  deck: Card[],
  formation: string,
  seed: number,
): { xi: SlottedCard[]; bench: Card[] } {
  const slots = getFormationSlots(formation);
  const xi: SlottedCard[] = [];
  const used = new Set<number>(); // card IDs that have been placed

  // Available (non-injured) cards
  const available = deck.filter(c => !c.injured);

  // Phase 1: Titanium cards auto-fill their matching slot
  for (const slot of slots) {
    const eligiblePositions = SLOT_ELIGIBLE_POSITIONS[slot] ?? [slot];
    const titanium = available.find(c =>
      !used.has(c.id) &&
      c.durability === 'titanium' &&
      eligiblePositions.includes(c.position)
    );
    if (titanium) {
      xi.push({ card: titanium, slot });
      used.add(titanium.id);
    }
  }

  // Phase 2: Weighted random for remaining slots
  const filledSlots = new Set(xi.map(sc => sc.slot));
  for (let si = 0; si < slots.length; si++) {
    const slot = slots[si];
    if (filledSlots.has(slot)) continue;

    const eligiblePositions = SLOT_ELIGIBLE_POSITIONS[slot] ?? [slot];
    const eligible = available.filter(c =>
      !used.has(c.id) && eligiblePositions.includes(c.position)
    );

    if (eligible.length === 0) {
      // No eligible card — pick any unused card
      const fallback = available.find(c => !used.has(c.id));
      if (fallback) {
        xi.push({ card: fallback, slot });
        used.add(fallback.id);
      }
      continue;
    }

    // Weighted random selection
    const weights = eligible.map(c => DURABILITY_WEIGHTS[c.durability] ?? 1.0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const roll = seededRandom(seed + si * 37) * totalWeight;

    let cumulative = 0;
    let picked = eligible[0];
    for (let i = 0; i < eligible.length; i++) {
      cumulative += weights[i];
      if (roll < cumulative) {
        picked = eligible[i];
        break;
      }
    }

    xi.push({ card: picked, slot });
    used.add(picked.id);
  }

  // Bench = remaining cards (including injured)
  const bench = deck.filter(c => !used.has(c.id));

  return { xi, bench };
}

// ---------------------------------------------------------------------------
// Post-Match Durability Checks (v2)
// ---------------------------------------------------------------------------

/**
 * Run post-match durability checks on the XI.
 * - Glass/Phoenix: chance of shattering (removed from deck forever)
 * - Fragile: chance of injury (misses next match)
 * - Phoenix: after 3 matches survived, promoted to Iron
 */
export function postMatchDurabilityCheck(
  xi: SlottedCard[],
  seed: number,
): DurabilityResult {
  const shattered: Card[] = [];
  const injured: Card[] = [];
  const promoted: Card[] = [];
  const commentary: string[] = [];

  for (let i = 0; i < xi.length; i++) {
    const card = xi[i].card;
    const cardSeed = seed + card.id * 17 + i;

    // Shatter check (Glass / Phoenix)
    const shatterChance = SHATTER_CHANCE[card.durability] ?? 0;
    if (shatterChance > 0 && seededRandom(cardSeed) < shatterChance) {
      shattered.push(card);
      commentary.push(`${card.name} takes a knock... SHATTERED! Removed from your deck.`);
      continue; // No further checks if shattered
    }

    // Phoenix survival tracking
    if (card.durability === 'phoenix') {
      const survived = (card.phoenixMatchesSurvived ?? 0) + 1;
      if (survived >= 3) {
        // Promote to Iron
        promoted.push(card);
        commentary.push(`Match ${survived} survived! ${card.name} is now IRON. He's here to stay.`);
      } else {
        commentary.push(`${card.name} survives match ${survived}/3. Keep protecting them.`);
      }
    }

    // Injury check (Fragile)
    const injuryChance = INJURY_CHANCE[card.durability] ?? 0;
    if (injuryChance > 0 && seededRandom(cardSeed + 100) < injuryChance) {
      injured.push(card);
      commentary.push(`${card.name} picks up an injury — misses next match.`);
    }
  }

  return { shattered, injured, promoted, commentary };
}

/**
 * Apply durability results to the deck.
 * - Removes shattered cards
 * - Marks injured cards
 * - Promotes Phoenix → Iron
 * - Clears previous injuries
 */
export function applyDurabilityResults(deck: Card[], result: DurabilityResult): Card[] {
  const shatteredIds = new Set(result.shattered.map(c => c.id));
  const injuredIds = new Set(result.injured.map(c => c.id));
  const promotedIds = new Set(result.promoted.map(c => c.id));

  return deck
    .filter(c => !shatteredIds.has(c.id)) // Remove shattered
    .map(c => {
      let updated = { ...c };

      // Clear previous injuries
      if (updated.injured) {
        updated = { ...updated, injured: false };
      }

      // Apply new injuries
      if (injuredIds.has(c.id)) {
        updated = { ...updated, injured: true };
      }

      // Promote Phoenix → Iron
      if (promotedIds.has(c.id)) {
        updated = {
          ...updated,
          durability: 'iron' as Durability,
          phoenixMatchesSurvived: undefined,
        };
      } else if (c.durability === 'phoenix' && !shatteredIds.has(c.id)) {
        // Increment phoenix survival counter
        updated = {
          ...updated,
          phoenixMatchesSurvived: (c.phoenixMatchesSurvived ?? 0) + 1,
        };
      }

      return updated;
    });
}

// ---------------------------------------------------------------------------
// Sample Cards (38 cards with durability)
// ---------------------------------------------------------------------------

function gatePullForArchetype(archetype: string): number {
  const map: Record<string, number> = {
    Dribbler: 30, Creator: 25, Striker: 20, Sprinter: 15,
    Engine: 5, Target: 10, Powerhouse: 10, Passer: 5,
    Cover: 0, Destroyer: 0, Controller: 0, Commander: 0, GK: 0,
  };
  return map[archetype] ?? 0;
}

export const SAMPLE_CARDS: Card[] = [
  // --- Strikers / CF ---
  // ~5 Glass
  { id: 1, name: 'T. Thunderboot', position: 'CF', archetype: 'Striker', tacticalRole: 'Poacher', personalityTheme: 'Catalyst', personalityType: 'AXLC', power: 72, rarity: 'Rare', gatePull: 60, durability: 'standard', abilityName: 'Box Presence', abilityText: '+15% goal chance with attacking cards' },
  { id: 2, name: 'G. Tapinski', position: 'CF', archetype: 'Striker', tacticalRole: 'Seconda Punta', personalityTheme: 'Professor', personalityType: 'ANSP', power: 64, rarity: 'Common', gatePull: 20, durability: 'standard', abilityName: 'Between Lines', abilityText: '+10% in AM/CF slot' },
  { id: 3, name: 'B. Hattrick', position: 'CF', archetype: 'Target', tacticalRole: 'Prima Punta', personalityTheme: 'Captain', personalityType: 'INLC', power: 78, rarity: 'Epic', gatePull: 25, durability: 'iron', abilityName: 'Target Man', abilityText: '+20% if Target archetype' },
  { id: 4, name: 'R. Volley', position: 'CF', archetype: 'Striker', tacticalRole: 'Complete Forward', personalityTheme: 'Maestro', personalityType: 'INSP', power: 85, rarity: 'Legendary', gatePull: 30, durability: 'glass', abilityName: 'Total', abilityText: '+5% per compound category' },
  { id: 5, name: 'N. Offside', position: 'CF', archetype: 'Sprinter', tacticalRole: 'Poacher', personalityTheme: 'Catalyst', personalityType: 'IXSC', power: 58, rarity: 'Common', gatePull: 55, durability: 'fragile', abilityName: 'Box Presence', abilityText: '+15% goal chance with attacking cards' },

  // --- Wingers / WF ---
  { id: 6, name: 'D. Nutmeg', position: 'WF', archetype: 'Dribbler', tacticalRole: 'Inside Forward', personalityTheme: 'Maestro', personalityType: 'ANLP', power: 70, rarity: 'Rare', gatePull: 40, durability: 'phoenix', abilityName: 'Cut Inside', abilityText: '+15% if Dribbler/Striker' },
  { id: 7, name: 'F. Stepover', position: 'WF', archetype: 'Dribbler', tacticalRole: 'Winger', personalityTheme: 'Catalyst', personalityType: 'AXLC', power: 66, rarity: 'Rare', gatePull: 70, durability: 'standard', abilityName: 'Touchline', abilityText: '+20% in WM/WF slot' },
  { id: 8, name: 'J. Jetpace', position: 'WF', archetype: 'Sprinter', tacticalRole: 'Extremo', personalityTheme: 'General', personalityType: 'ANLC', power: 62, rarity: 'Common', gatePull: 20, durability: 'standard', abilityName: 'Jet Heels', abilityText: '+20% if Sprinter archetype' },
  { id: 9, name: 'K. Invisible', position: 'WF', archetype: 'Creator', tacticalRole: 'Raumdeuter', personalityTheme: 'Professor', personalityType: 'AXSP', power: 74, rarity: 'Epic', gatePull: 25, durability: 'glass', abilityName: 'Space', abilityText: '+20% self, -5% adjacent' },
  { id: 10, name: 'Z. Elastico', position: 'WF', archetype: 'Dribbler', tacticalRole: 'Invertido', personalityTheme: 'Maestro', personalityType: 'IXSP', power: 68, rarity: 'Rare', gatePull: 40, durability: 'standard', abilityName: 'Tuck Inside', abilityText: '+15% if Controller/Passer' },

  // --- Central Midfielders / CM ---
  { id: 11, name: 'P. Sideways', position: 'CM', archetype: 'Controller', tacticalRole: 'Metodista', personalityTheme: 'Professor', personalityType: 'ANSP', power: 58, rarity: 'Common', gatePull: 0, durability: 'standard', abilityName: 'Tempo', abilityText: 'Controller cards get +10%' },
  { id: 12, name: 'M. Metronome', position: 'CM', archetype: 'Passer', tacticalRole: 'Regista', personalityTheme: 'Maestro', personalityType: 'INSP', power: 80, rarity: 'Epic', gatePull: 15, durability: 'iron', abilityName: 'Metronome', abilityText: '+5% to all connection bonuses' },
  { id: 13, name: 'E. Lungs', position: 'CM', archetype: 'Engine', tacticalRole: 'Tuttocampista', personalityTheme: 'Captain', personalityType: 'INLC', power: 60, rarity: 'Common', gatePull: 20, durability: 'iron', abilityName: 'Box to Box', abilityText: '+3% per different archetype' },
  { id: 14, name: 'C. Cruyff Jr.', position: 'CM', archetype: 'Creator', tacticalRole: 'Fantasista', personalityTheme: 'Maestro', personalityType: 'ANLP', power: 76, rarity: 'Epic', gatePull: 35, durability: 'fragile', abilityName: 'Half-Space Magic', abilityText: '+15% if Creator archetype' },
  { id: 15, name: 'W. Workrate', position: 'CM', archetype: 'Engine', tacticalRole: 'Relayeur', personalityTheme: 'General', personalityType: 'ANSC', power: 55, rarity: 'Common', gatePull: 10, durability: 'iron', abilityName: 'Relay', abilityText: '+5% to every Engine' },
  { id: 16, name: 'H. Hollywood', position: 'CM', archetype: 'Passer', tacticalRole: 'Enganche', personalityTheme: 'Catalyst', personalityType: 'IXLC', power: 71, rarity: 'Rare', gatePull: 45, durability: 'glass', abilityName: 'The Hook', abilityText: 'Best card +25%, self -10%' },
  { id: 17, name: 'S. Shimmy', position: 'CM', archetype: 'Creator', tacticalRole: 'Trequartista', personalityTheme: 'Catalyst', personalityType: 'AXLC', power: 73, rarity: 'Rare', gatePull: 65, durability: 'phoenix', abilityName: 'Moment of Genius', abilityText: '30% chance to double own power' },
  { id: 18, name: 'R. Runner', position: 'CM', archetype: 'Engine', tacticalRole: 'Mezzala', personalityTheme: 'Captain', personalityType: 'INLP', power: 63, rarity: 'Common', gatePull: 20, durability: 'standard', abilityName: 'Half-Space Run', abilityText: '+15% in CM slot' },

  // --- Defensive Midfielders / DM ---
  { id: 19, name: 'A. Anchor', position: 'DM', archetype: 'Destroyer', tacticalRole: 'Sentinelle', personalityTheme: 'General', personalityType: 'INSC', power: 61, rarity: 'Common', gatePull: 5, durability: 'iron', abilityName: 'The Shield', abilityText: 'Weakest XI player gets +30%' },
  { id: 20, name: 'V. Violence', position: 'DM', archetype: 'Destroyer', tacticalRole: 'Volante', personalityTheme: 'Captain', personalityType: 'INLC', power: 67, rarity: 'Rare', gatePull: 15, durability: 'standard', abilityName: 'Tackle & Go', abilityText: '-5% opponent goal chance per round' },
  { id: 21, name: 'Q. Quiet', position: 'DM', archetype: 'Controller', tacticalRole: 'Regista', personalityTheme: 'Professor', personalityType: 'AXLP', power: 69, rarity: 'Rare', gatePull: 0, durability: 'standard', abilityName: 'Metronome', abilityText: '+5% to all connection bonuses' },

  // --- Centre-Backs / CD ---
  { id: 22, name: 'L. McSlide', position: 'CD', archetype: 'Destroyer', tacticalRole: 'Vorstopper', personalityTheme: 'Captain', personalityType: 'INLC', power: 65, rarity: 'Rare', gatePull: 0, durability: 'iron', abilityName: 'Front Foot', abilityText: '+15% if Destroyer archetype' },
  { id: 23, name: 'I. Immovable', position: 'CD', archetype: 'Cover', tacticalRole: 'Zagueiro', personalityTheme: 'General', personalityType: 'ANLC', power: 59, rarity: 'Common', gatePull: 0, durability: 'standard', abilityName: 'Commander', abilityText: 'Commander cards get +10%' },
  { id: 24, name: 'B. Beckenboss', position: 'CD', archetype: 'Commander', tacticalRole: 'Libero', personalityTheme: 'General', personalityType: 'ANSC', power: 82, rarity: 'Epic', gatePull: 5, durability: 'titanium', abilityName: 'Surgical Pass', abilityText: 'Each attacker gets +10%' },
  { id: 25, name: 'X. No-Nonsense', position: 'CD', archetype: 'Cover', tacticalRole: 'Sweeper', personalityTheme: 'General', personalityType: 'INSC', power: 56, rarity: 'Common', gatePull: 0, durability: 'standard', abilityName: 'Read Ahead', abilityText: 'Cover cards get +10%' },
  { id: 26, name: 'U. Unbeatable', position: 'CD', archetype: 'Powerhouse', tacticalRole: 'Vorstopper', personalityTheme: 'Captain', personalityType: 'AXSC', power: 70, rarity: 'Rare', gatePull: 10, durability: 'fragile', abilityName: 'Front Foot', abilityText: '+15% if Destroyer archetype' },

  // --- Full-Backs / WD ---
  { id: 27, name: 'O. Overlap', position: 'WD', archetype: 'Engine', tacticalRole: 'Lateral', personalityTheme: 'General', personalityType: 'ANLC', power: 57, rarity: 'Common', gatePull: 10, durability: 'standard', abilityName: 'Overlap', abilityText: 'If paired with IF/Winger, both +15%' },
  { id: 28, name: 'T. Turbo', position: 'WD', archetype: 'Sprinter', tacticalRole: 'Fluidificante', personalityTheme: 'Catalyst', personalityType: 'IXSC', power: 63, rarity: 'Common', gatePull: 55, durability: 'phoenix', abilityName: 'Surge', abilityText: '+10% self, +10% nearest attacker' },
  { id: 29, name: 'C. Crossbar', position: 'WD', archetype: 'Passer', tacticalRole: 'Tornante', personalityTheme: 'Professor', personalityType: 'AXSP', power: 60, rarity: 'Common', gatePull: 5, durability: 'standard', abilityName: 'Full Flank', abilityText: '+10% if Engine archetype' },

  // --- Wide Midfielders / WM ---
  { id: 30, name: 'W. Whip', position: 'WM', archetype: 'Passer', tacticalRole: 'Winger', personalityTheme: 'General', personalityType: 'ANSC', power: 61, rarity: 'Common', gatePull: 10, durability: 'standard', abilityName: 'Touchline', abilityText: '+20% in WM/WF slot' },
  { id: 31, name: 'F. Flashmob', position: 'WM', archetype: 'Dribbler', tacticalRole: 'Inside Forward', personalityTheme: 'Catalyst', personalityType: 'IXLC', power: 69, rarity: 'Rare', gatePull: 70, durability: 'glass', abilityName: 'Cut Inside', abilityText: '+15% if Dribbler/Striker' },
  { id: 32, name: 'Y. Yoyo', position: 'WM', archetype: 'Engine', tacticalRole: 'Tornante', personalityTheme: 'Captain', personalityType: 'INLP', power: 54, rarity: 'Common', gatePull: 20, durability: 'standard', abilityName: 'Full Flank', abilityText: '+10% if Engine archetype' },

  // --- Attacking Midfielders / AM ---
  { id: 33, name: 'A. Assist King', position: 'AM', archetype: 'Creator', tacticalRole: 'Fantasista', personalityTheme: 'Maestro', personalityType: 'INSP', power: 77, rarity: 'Epic', gatePull: 35, durability: 'fragile', abilityName: 'Half-Space Magic', abilityText: '+15% if Creator archetype' },
  { id: 34, name: 'J. Juggler', position: 'AM', archetype: 'Dribbler', tacticalRole: 'Trequartista', personalityTheme: 'Maestro', personalityType: 'ANLP', power: 75, rarity: 'Epic', gatePull: 40, durability: 'iron', abilityName: 'Moment of Genius', abilityText: '30% chance to double own power' },
  { id: 35, name: 'D. Dictator', position: 'AM', archetype: 'Controller', tacticalRole: 'Inventor', personalityTheme: 'Professor', personalityType: 'AXLP', power: 72, rarity: 'Rare', gatePull: 0, durability: 'standard', abilityName: 'From Nothing', abilityText: '+20% if Creator archetype' },

  // --- Extra variety ---
  { id: 36, name: 'G. Ghost', position: 'CF', archetype: 'Striker', tacticalRole: 'Falso Nove', personalityTheme: 'Professor', personalityType: 'ANSP', power: 74, rarity: 'Epic', gatePull: 20, durability: 'glass', abilityName: 'The Drop', abilityText: 'Counts as CF and AM for synergies' },
  { id: 37, name: 'K. Karate', position: 'CD', archetype: 'Destroyer', tacticalRole: 'Sentinelle', personalityTheme: 'Captain', personalityType: 'AXSC', power: 62, rarity: 'Common', gatePull: 15, durability: 'iron', abilityName: 'The Shield', abilityText: 'Weakest XI player +30%' },
  { id: 38, name: 'M. Magnet', position: 'CM', archetype: 'Passer', tacticalRole: 'Metodista', personalityTheme: 'Professor', personalityType: 'AXSP', power: 64, rarity: 'Common', gatePull: 5, durability: 'fragile', abilityName: 'Tempo', abilityText: 'Controller cards get +10%' },
];

// Durability distribution in SAMPLE_CARDS:
// Glass: 4 (ids 4, 9, 16, 31, 36) = 5
// Fragile: 5 (ids 5, 14, 26, 33, 38)
// Standard: 15 (ids 1, 2, 7, 8, 10, 11, 18, 20, 21, 23, 25, 27, 29, 30, 32, 35)
// Iron: 8 (ids 3, 12, 13, 15, 19, 22, 34, 37)
// Titanium: 2 (id 24) -- B. Beckenboss + could add another
// Phoenix: 3 (ids 6, 17, 28)

// ---------------------------------------------------------------------------
// Sample Action Deck (~30 cards for prototype)
// ---------------------------------------------------------------------------

export const SAMPLE_ACTION_DECK: ActionCard[] = [
  // 3x common attacking
  ...Array.from({ length: 2 }, () => ALL_ACTION_CARDS.find(c => c.id === 'press_high')!),
  ...Array.from({ length: 2 }, () => ALL_ACTION_CARDS.find(c => c.id === 'counter_attack')!),
  ALL_ACTION_CARDS.find(c => c.id === 'wing_play')!,
  ALL_ACTION_CARDS.find(c => c.id === 'overload')!,
  ALL_ACTION_CARDS.find(c => c.id === 'through_ball')!,
  ALL_ACTION_CARDS.find(c => c.id === 'long_ball')!,
  ALL_ACTION_CARDS.find(c => c.id === 'tiki_taka')!,
  ...Array.from({ length: 2 }, () => ALL_ACTION_CARDS.find(c => c.id === 'set_piece')!),

  // Defensive
  ALL_ACTION_CARDS.find(c => c.id === 'park_the_bus')!,
  ALL_ACTION_CARDS.find(c => c.id === 'man_mark')!,
  ALL_ACTION_CARDS.find(c => c.id === 'offside_trap')!,
  ALL_ACTION_CARDS.find(c => c.id === 'tactical_foul')!,
  ALL_ACTION_CARDS.find(c => c.id === 'time_waste')!,
  ALL_ACTION_CARDS.find(c => c.id === 'sweeper_keeper')!,

  // Moments
  ALL_ACTION_CARDS.find(c => c.id === 'screamer')!,
  ALL_ACTION_CARDS.find(c => c.id === 'nutmeg')!,
  ALL_ACTION_CARDS.find(c => c.id === 'last_minute_drama')!,
  ALL_ACTION_CARDS.find(c => c.id === 'captains_armband')!,
  ALL_ACTION_CARDS.find(c => c.id === 'moment_of_genius')!,
  ALL_ACTION_CARDS.find(c => c.id === 'wonder_goal')!,
  ALL_ACTION_CARDS.find(c => c.id === 'penalty_shout')!,

  // Mind Games
  ALL_ACTION_CARDS.find(c => c.id === 'wind_up')!,
  ALL_ACTION_CARDS.find(c => c.id === 'crowd_surge')!,
  ALL_ACTION_CARDS.find(c => c.id === 'the_hairdryer')!,
  ALL_ACTION_CARDS.find(c => c.id === 'press_conference')!,
  ALL_ACTION_CARDS.find(c => c.id === 'ultra_defensive')!,
];

// ---------------------------------------------------------------------------
// Run Management Functions
// ---------------------------------------------------------------------------

/**
 * Generate a starter deck: 5 common, 2 rare, 1 epic (seeded)
 */
export function generateStarterDeck(seed: number): Card[] {
  const commons = SAMPLE_CARDS.filter(c => c.rarity === 'Common');
  const rares = SAMPLE_CARDS.filter(c => c.rarity === 'Rare');
  const epics = SAMPLE_CARDS.filter(c => c.rarity === 'Epic');

  const picked: Card[] = [
    ...seededShuffle(commons, seed).slice(0, 5),
    ...seededShuffle(rares, seed + 100).slice(0, 2),
    ...seededShuffle(epics, seed + 200).slice(0, 1),
  ];

  return seededShuffle(picked, seed + 300);
}

/**
 * Generate a starter action deck (seeded shuffle)
 */
export function generateStarterActionDeck(seed: number): ActionCard[] {
  return seededShuffle([...SAMPLE_ACTION_DECK], seed);
}

/**
 * Initialize a new run
 */
export function createRun(formation: string, style: string, seed?: number): RunState {
  const runSeed = seed ?? Math.floor(Math.random() * 1000000);
  const deck = generateStarterDeck(runSeed);
  const actionDeck = generateStarterActionDeck(runSeed + 500);

  return {
    formation,
    playingStyle: style,
    deck,
    lineup: [],
    bench: [...deck],
    actionDeck,
    hand: [],
    cash: 10000,
    stadiumTier: 1,
    ticketPriceBonus: 0,
    academyTier: 1,
    round: 1,
    wins: 0,
    losses: 0,
    status: 'prematch',
    matchState: null,
    matchHistory: [],
    modifiers: [],
    seed: runSeed,
  };
}

/**
 * Start a match: shuffle deck, select XI, create match state
 */
export function startMatch(state: RunState): RunState {
  const matchSeed = state.seed + state.round * 1000;
  const opponent = getOpponent(state.round);

  // Shuffle and select XI
  const { xi, bench } = shuffleAndSelectXI(state.deck, state.formation, matchSeed);

  // Shuffle action deck for this match
  const shuffledActions = seededShuffle([...state.actionDeck], matchSeed + 77);

  // Create match state
  const matchState = createMatchState(
    xi, bench, shuffledActions,
    opponent.baseStrength, matchSeed,
  );

  return {
    ...state,
    lineup: xi,
    bench,
    matchState,
    status: 'playing',
  };
}

/**
 * Play a round within the current match.
 */
export function playRound(
  state: RunState,
  playedCards: ActionCard[],
  weaknessArchetype?: string,
): { state: RunState; result: RoundResult } {
  if (!state.matchState) {
    throw new Error('No active match state');
  }

  const ms = state.matchState;
  const seed = ms.matchSeed * 100 + ms.round * 10 +
    playedCards.reduce((sum, c) => sum + c.id.charCodeAt(0), 0);

  const result = resolveRound(ms, playedCards, seed, weaknessArchetype);

  // Calculate action result for state update
  const actionResult = {
    nextRoundYourMod: 0,
    persistentOpponentMod: 0,
    persistentYourMod: 0,
    redCardPenalty: 0,
  };

  // Gather persistent effects from played cards
  for (const ac of playedCards) {
    if (ac.effect.yourNextRoundMod) actionResult.nextRoundYourMod += ac.effect.yourNextRoundMod;
    if (ac.effect.opponentRestOfMatchMod) actionResult.persistentOpponentMod += ac.effect.opponentRestOfMatchMod;
    if (ac.effect.yourRestOfMatchMod) actionResult.persistentYourMod += ac.effect.yourRestOfMatchMod;
    if (ac.effect.riskChance && ac.effect.riskPenalty) {
      if (seededRandom(seed + ac.id.charCodeAt(0) * 3) < ac.effect.riskChance) {
        actionResult.redCardPenalty += ac.effect.riskPenalty;
      }
    }
  }

  // Advance match state
  const newMatchState = advanceMatchState(ms, result, playedCards, actionResult);

  // Check if match is over (5 rounds played)
  const matchOver = ms.round >= 5;

  return {
    state: {
      ...state,
      matchState: matchOver ? null : newMatchState,
      status: matchOver ? 'postmatch' : 'playing',
    },
    result,
  };
}

/**
 * Finalize match: compute revenue, run durability checks, update run state
 */
export function finalizeMatch(state: RunState, matchState: MatchState): {
  state: RunState;
  matchResult: MatchResult;
  durabilityResult: DurabilityResult;
} {
  const opponent = getOpponent(state.round);

  // Determine match result
  const yourGoals = matchState.yourGoals;
  const opponentGoals = matchState.opponentGoals;
  const resultType: 'win' | 'draw' | 'loss' =
    yourGoals > opponentGoals ? 'win' :
    yourGoals === opponentGoals ? 'draw' : 'loss';

  const newWins = state.wins + (resultType === 'win' ? 1 : 0);
  const newLosses = state.losses + (resultType === 'loss' ? 1 : 0);
  const reachedMatch5 = state.round >= 5;
  const wonRun = reachedMatch5 && resultType === 'win' && newWins >= 5;
  const newStadiumTier = getStadiumTier(newWins, reachedMatch5, wonRun);

  // Calculate attendance and revenue
  const connections = findConnections(matchState.xi);
  const attendanceResult = calculateAttendance(
    matchState.xi,
    connections,
    yourGoals,
    opponentGoals,
    matchState.fanAccumulator,
    newStadiumTier,
    state.ticketPriceBonus,
  );

  // Run durability checks
  const durSeed = state.seed + state.round * 2000;
  const durabilityResult = postMatchDurabilityCheck(matchState.xi, durSeed);

  // Apply durability results to deck
  const newDeck = applyDurabilityResults(state.deck, durabilityResult);

  const matchResult: MatchResult = {
    round: state.round,
    opponentName: opponent.name,
    yourGoals,
    opponentGoals,
    attendance: attendanceResult.attendance,
    revenue: attendanceResult.revenue,
    result: resultType,
    synergiesTriggered: connections.map(c => c.name),
    shattered: durabilityResult.shattered.map(c => c.name),
    injured: durabilityResult.injured.map(c => c.name),
    promoted: durabilityResult.promoted.map(c => c.name),
  };

  // Determine new status
  let newStatus: RunState['status'] = 'shop';
  if (newLosses >= 3) newStatus = 'lost';
  else if (reachedMatch5 && wonRun) newStatus = 'won';
  else if (reachedMatch5) newStatus = 'lost';

  return {
    state: {
      ...state,
      deck: newDeck,
      wins: newWins,
      losses: newLosses,
      stadiumTier: newStadiumTier,
      cash: state.cash + attendanceResult.revenue,
      status: newStatus,
      matchHistory: [...state.matchHistory, matchResult],
      matchState: null,
    },
    matchResult,
    durabilityResult,
  };
}

/**
 * Advance to next match round
 */
export function advanceToNextMatch(state: RunState): RunState {
  return {
    ...state,
    round: state.round + 1,
    lineup: [],
    bench: [...state.deck],
    status: 'prematch',
  };
}

/**
 * Get shop cards (3 random from pool, seeded)
 */
export function getShopCards(seed: number, rareOnly: boolean = false): Card[] {
  const pool = rareOnly
    ? SAMPLE_CARDS.filter(c => c.rarity !== 'Common')
    : SAMPLE_CARDS;
  return seededShuffle(pool, seed).slice(0, 3);
}

/**
 * Add a card to the deck
 */
export function addCardToDeck(state: RunState, card: Card): RunState {
  const newCard = { ...card, id: state.seed + state.deck.length * 100 + Date.now() % 10000 };
  return {
    ...state,
    deck: [...state.deck, newCard],
  };
}

/**
 * Sell a card from deck for transfer fee
 */
export function sellCard(state: RunState, card: Card): RunState {
  const fee = getTransferFee(card);
  return {
    ...state,
    deck: state.deck.filter(c => c.id !== card.id),
    cash: state.cash + fee,
  };
}

/**
 * Buy a shop item
 */
export function buyShopItem(state: RunState, item: ShopItem): RunState | null {
  if (state.cash < item.cost) return null;
  let newState = { ...state, cash: state.cash - item.cost };

  if (item.id === 'food_upgrade') {
    newState.ticketPriceBonus += 5;
  }

  return newState;
}

/**
 * Upgrade academy tier
 */
export function upgradeAcademy(state: RunState): RunState | null {
  if (state.academyTier >= 4) return null;
  if (state.cash < ACADEMY_UPGRADE_COST) return null;

  return {
    ...state,
    cash: state.cash - ACADEMY_UPGRADE_COST,
    academyTier: state.academyTier + 1,
  };
}

/**
 * Buy an academy player
 */
export function buyAcademyPlayer(state: RunState, card: Card): RunState | null {
  const academy = getAcademyTier(state.academyTier);
  if (state.cash < academy.cost) return null;

  return {
    ...state,
    cash: state.cash - academy.cost,
    deck: [...state.deck, card],
  };
}

/**
 * Place a card from bench into a formation slot (manual override for arranging)
 */
export function placeCard(state: RunState, card: Card, slot: string): RunState {
  const bench = state.bench.filter(c => c.id !== card.id);
  const existing = state.lineup.find(sc => sc.slot === slot);
  if (existing) bench.push(existing.card);
  const lineup = [
    ...state.lineup.filter(sc => sc.slot !== slot),
    { card, slot },
  ];
  return { ...state, bench, lineup };
}

/**
 * Remove a card from a slot back to bench
 */
export function removeCard(state: RunState, slot: string): RunState {
  const existing = state.lineup.find(sc => sc.slot === slot);
  if (!existing) return state;
  return {
    ...state,
    lineup: state.lineup.filter(sc => sc.slot !== slot),
    bench: [...state.bench, existing.card],
  };
}

// ---------------------------------------------------------------------------
// Substitution Cards (Fix 1: Subs in Hand)
// ---------------------------------------------------------------------------

/**
 * Create substitution action cards from bench players.
 * Each bench player becomes a SUB card that can be played during the match.
 * When played, the bench player swaps into the XI for the weakest-fit player
 * in the same position group.
 */
export function createSubCards(bench: Card[]): ActionCard[] {
  return bench
    .filter(c => !c.injured)
    .map(c => ({
      id: `sub_${c.id}`,
      name: `SUB: ${c.name}`,
      type: 'substitution' as const,
      effect: {},
      duration: 'round' as const,
      flavour: `Bring on ${c.name} (${c.position} ${c.power})`,
      fanImpact: 5,
      // Store the bench card data for the swap
      _benchCard: c,
    }));
}

/**
 * Execute a substitution: swap bench player into XI for weakest-fit in position group.
 * Returns new XI and bench arrays.
 */
export function executeSubstitution(
  xi: SlottedCard[],
  bench: Card[],
  subCard: Card,
): { xi: SlottedCard[]; bench: Card[] } {
  const eligiblePositions = SLOT_ELIGIBLE_POSITIONS[subCard.position] ?? [subCard.position];

  // Find XI cards whose slot matches the sub's eligible positions
  const candidates = xi.filter(sc => {
    const slotPos = sc.slot.indexOf('_') === -1 ? sc.slot : sc.slot.substring(0, sc.slot.indexOf('_'));
    return eligiblePositions.includes(slotPos) || subCard.position === slotPos;
  });

  if (candidates.length === 0) {
    // No position match — swap with lowest power XI card
    const sorted = [...xi].sort((a, b) => a.card.power - b.card.power);
    const weakest = sorted[0];
    const newXI = xi.map(sc =>
      sc.card.id === weakest.card.id ? { card: subCard, slot: sc.slot } : sc
    );
    const newBench = bench.filter(c => c.id !== subCard.id);
    newBench.push(weakest.card);
    return { xi: newXI, bench: newBench };
  }

  // Find weakest candidate
  const weakest = candidates.reduce((min, sc) =>
    sc.card.power < min.card.power ? sc : min
  );

  const newXI = xi.map(sc =>
    sc.card.id === weakest.card.id ? { card: subCard, slot: sc.slot } : sc
  );
  const newBench = bench.filter(c => c.id !== subCard.id);
  newBench.push(weakest.card);

  return { xi: newXI, bench: newBench };
}

// Re-export commonly used types and constants
export { PLAYING_STYLES, SHOP_ITEMS };
export type { Card, SlottedCard, PlayingStyle, ShopItem, ActionCard, MatchState, RoundResult, Durability };

// ---------------------------------------------------------------------------
// Backward Compatibility (v1 API shims)
// ---------------------------------------------------------------------------

import { evaluateLineup, type ScoringResult } from './scoring';
export { evaluateLineup, type ScoringResult };

/**
 * @deprecated Use startMatch() + playRound() for v2.
 * Check if all 5 slots are filled.
 */
export function canBlowWhistle(state: RunState): boolean {
  const slots = getFormationSlots(state.formation);
  return slots.every(slot => state.lineup.some(sc => sc.slot === slot));
}

/**
 * @deprecated Use startMatch() + playRound() + finalizeMatch() for v2.
 * Play a match using the v1 "single Whistle" evaluation.
 */
export function playMatch(state: RunState): { state: RunState; result: MatchResult } {
  const opponent = getOpponent(state.round);
  const style = PLAYING_STYLES[state.playingStyle];

  const scoringResult = evaluateLineup(state.lineup, style, opponent.baseStrength, state.round);
  const playerScore = scoringResult.finalScore;
  const opponentScore = opponent.baseStrength * 5; // rough v1 compat

  const resultType: 'win' | 'draw' | 'loss' =
    playerScore > opponentScore ? 'win' :
    playerScore === opponentScore ? 'draw' : 'loss';

  const newWins = state.wins + (resultType === 'win' ? 1 : 0);
  const newLosses = state.losses + (resultType === 'loss' ? 1 : 0);

  const matchResult: MatchResult = {
    round: state.round,
    opponentName: opponent.name,
    yourGoals: resultType === 'win' ? 2 : resultType === 'draw' ? 1 : 0,
    opponentGoals: resultType === 'loss' ? 2 : resultType === 'draw' ? 1 : 0,
    attendance: 200,
    revenue: 2000,
    result: resultType,
    synergiesTriggered: scoringResult.connections.map(c => c.name),
    shattered: [],
    injured: [],
    promoted: [],
  };

  return {
    state: {
      ...state,
      wins: newWins,
      losses: newLosses,
      cash: state.cash + matchResult.revenue,
      matchHistory: [...state.matchHistory, matchResult],
      status: 'postmatch',
    },
    result: matchResult,
  };
}

/**
 * @deprecated Use finalizeMatch() for v2.
 */
export function advanceToShop(state: RunState): RunState {
  if (state.losses >= 3) return { ...state, status: 'lost' };
  if (state.round >= 5 && state.wins >= 5) return { ...state, status: 'won' };
  if (state.round >= 5) return { ...state, status: 'lost' };
  return { ...state, status: 'shop' };
}
