import { describe, it, expect } from "vitest";
import {
  seededRandom,
  DURABILITY_WEIGHTS,
  SHATTER_CHANCE,
  INJURY_CHANCE,
  PLAYING_STYLES,
  calculateXIStrength,
  resolveRound,
  advanceMatchState,
  createMatchState,
  previewRound,
  evaluateLineup,
  type Card,
  type SlottedCard,
  type Durability,
  type MatchState,
  type PlayingStyle,
} from "@/lib/kickoff-clash/scoring";
import type { ActionCard } from "@/lib/kickoff-clash/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 1,
    name: "Test Player",
    position: "CM",
    archetype: "Engine",
    power: 70,
    rarity: "common",
    gatePull: 10,
    durability: "standard",
    ...overrides,
  };
}

function makeSlottedCard(
  slot: string,
  overrides: Partial<Card> = {}
): SlottedCard {
  return { card: makeCard(overrides), slot };
}

function makeActionCard(overrides: Partial<ActionCard> = {}): ActionCard {
  return {
    id: "test_action",
    name: "Test Action",
    type: "tactical",
    subtype: "attacking",
    effect: {},
    duration: "round",
    flavour: "Test flavour",
    fanImpact: 0,
    ...overrides,
  };
}

function makeXI(count: number = 11): SlottedCard[] {
  const slots = [
    "GK",
    "CD_L",
    "CD_R",
    "WD_L",
    "WD_R",
    "DM",
    "CM_L",
    "CM_R",
    "AM",
    "WF_L",
    "CF",
  ];
  return slots.slice(0, count).map((slot, i) =>
    makeSlottedCard(slot, { id: i + 1, name: `Player ${i + 1}`, power: 60 + i })
  );
}

function makeMatchState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    xi: makeXI(),
    bench: [],
    hand: [],
    actionDeck: [],
    round: 1,
    yourGoals: 0,
    opponentGoals: 0,
    yourActions: [],
    opponentStrength: 700,
    fanAccumulator: 0,
    persistentYourMod: 0,
    persistentOpponentMod: 0,
    nextRoundYourMod: 0,
    opponentScoredLastRound: false,
    redCardPenalty: 0,
    offsideTrapActive: false,
    matchSeed: 42,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. seededRandom
// ---------------------------------------------------------------------------

describe("seededRandom", () => {
  it("is deterministic — same seed gives same result", () => {
    expect(seededRandom(42)).toBe(seededRandom(42));
    expect(seededRandom(0)).toBe(seededRandom(0));
    expect(seededRandom(999999)).toBe(seededRandom(999999));
  });

  it("returns values in [0, 1)", () => {
    for (const seed of [0, 1, 42, 100, 9999, 123456789, -7]) {
      const val = seededRandom(seed);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("different seeds produce different values", () => {
    const results = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(seededRandom));
    // Extremely unlikely all 10 collide
    expect(results.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Durability constants
// ---------------------------------------------------------------------------

describe("durability constants", () => {
  const ALL_DURABILITIES: Durability[] = [
    "glass",
    "fragile",
    "standard",
    "iron",
    "titanium",
    "phoenix",
  ];

  it("DURABILITY_WEIGHTS has entries for all durability types", () => {
    for (const d of ALL_DURABILITIES) {
      expect(DURABILITY_WEIGHTS[d]).toBeDefined();
      expect(typeof DURABILITY_WEIGHTS[d]).toBe("number");
    }
  });

  it("SHATTER_CHANCE has entries for all durability types", () => {
    for (const d of ALL_DURABILITIES) {
      expect(SHATTER_CHANCE[d]).toBeDefined();
    }
  });

  it("INJURY_CHANCE has entries for all durability types", () => {
    for (const d of ALL_DURABILITIES) {
      expect(INJURY_CHANCE[d]).toBeDefined();
    }
  });

  it("titanium weight is 999 (effectively indestructible)", () => {
    expect(DURABILITY_WEIGHTS.titanium).toBe(999);
  });

  it("standard weight is 1.0 (baseline)", () => {
    expect(DURABILITY_WEIGHTS.standard).toBe(1.0);
  });

  it("glass has highest shatter chance", () => {
    expect(SHATTER_CHANCE.glass).toBe(0.2);
    expect(SHATTER_CHANCE.standard).toBe(0);
    expect(SHATTER_CHANCE.iron).toBe(0);
    expect(SHATTER_CHANCE.titanium).toBe(0);
  });

  it("only fragile has non-zero injury chance", () => {
    expect(INJURY_CHANCE.fragile).toBe(0.1);
    expect(INJURY_CHANCE.glass).toBe(0);
    expect(INJURY_CHANCE.standard).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. PLAYING_STYLES
// ---------------------------------------------------------------------------

describe("PLAYING_STYLES", () => {
  const EXPECTED_STYLES = [
    "tiki-taka",
    "gegenpressing",
    "counter-attack",
    "direct-play",
    "total-football",
  ];

  it("contains all 5 defined styles", () => {
    for (const key of EXPECTED_STYLES) {
      expect(PLAYING_STYLES[key]).toBeDefined();
    }
  });

  it("every style has bonusArchetypes array and multiplier", () => {
    for (const key of EXPECTED_STYLES) {
      const style = PLAYING_STYLES[key];
      expect(Array.isArray(style.bonusArchetypes)).toBe(true);
      expect(typeof style.multiplier).toBe("number");
      expect(style.multiplier).toBeGreaterThan(0);
    }
  });

  it("total-football has empty bonusArchetypes and lower multiplier", () => {
    const tf = PLAYING_STYLES["total-football"];
    expect(tf.bonusArchetypes).toEqual([]);
    expect(tf.multiplier).toBe(0.05);
  });

  it("standard styles have 0.15 multiplier", () => {
    for (const key of ["tiki-taka", "gegenpressing", "counter-attack", "direct-play"]) {
      expect(PLAYING_STYLES[key].multiplier).toBe(0.15);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. calculateXIStrength
// ---------------------------------------------------------------------------

describe("calculateXIStrength", () => {
  const style = PLAYING_STYLES["tiki-taka"];

  it("returns 0 for empty XI", () => {
    expect(calculateXIStrength([], style)).toBe(0);
  });

  it("returns positive value for non-empty XI", () => {
    const xi = makeXI(3);
    expect(calculateXIStrength(xi, style)).toBeGreaterThan(0);
  });

  it("strength scales with card power", () => {
    const weakXI = [makeSlottedCard("CM", { power: 30 })];
    const strongXI = [makeSlottedCard("CM", { power: 90 })];
    expect(calculateXIStrength(strongXI, style)).toBeGreaterThan(
      calculateXIStrength(weakXI, style)
    );
  });

  it("style bonus increases strength for aligned archetypes", () => {
    // tiki-taka bonuses: Passer, Controller, Creator
    const aligned = [
      makeSlottedCard("CM", { archetype: "Passer", power: 80 }),
    ];
    const unaligned = [
      makeSlottedCard("CM", { archetype: "Destroyer", power: 80 }),
    ];
    expect(calculateXIStrength(aligned, style)).toBeGreaterThan(
      calculateXIStrength(unaligned, style)
    );
  });

  it("total-football gives flat bonus to all archetypes", () => {
    const tf = PLAYING_STYLES["total-football"];
    const xi = [makeSlottedCard("CM", { archetype: "Destroyer", power: 80 })];
    const baseStrength = calculateXIStrength(xi, { name: "None", bonusArchetypes: [], multiplier: 0 });
    const tfStrength = calculateXIStrength(xi, tf);
    expect(tfStrength).toBeGreaterThan(baseStrength);
  });

  it("secondaryArchetype also triggers style bonus", () => {
    const card = makeSlottedCard("CM", {
      archetype: "Destroyer",
      secondaryArchetype: "Passer",
      power: 80,
    });
    const withSecondary = calculateXIStrength([card], style);
    const plain = calculateXIStrength(
      [makeSlottedCard("CM", { archetype: "Destroyer", power: 80 })],
      style
    );
    expect(withSecondary).toBeGreaterThan(plain);
  });
});

// ---------------------------------------------------------------------------
// 5. resolveRound
// ---------------------------------------------------------------------------

describe("resolveRound", () => {
  it("returns a RoundResult with expected fields", () => {
    const state = makeMatchState();
    const result = resolveRound(state, [], 100);
    expect(result).toHaveProperty("minute");
    expect(result).toHaveProperty("yourStrength");
    expect(result).toHaveProperty("opponentStrength");
    expect(result).toHaveProperty("yourGoalChance");
    expect(result).toHaveProperty("opponentGoalChance");
    expect(result).toHaveProperty("yourScored");
    expect(result).toHaveProperty("opponentScored");
    expect(result).toHaveProperty("commentary");
    expect(result).toHaveProperty("fansEarned");
  });

  it("minute maps from round number (round 1 = 15')", () => {
    const state = makeMatchState({ round: 1 });
    const result = resolveRound(state, [], 100);
    expect(result.minute).toBe(15);
  });

  it("round 5 maps to 75'", () => {
    const state = makeMatchState({ round: 5 });
    const result = resolveRound(state, [], 100);
    expect(result.minute).toBe(75);
  });

  it("goal chances are clamped between 0.05 and 0.50", () => {
    // Huge strength advantage
    const state = makeMatchState({ opponentStrength: 0 });
    const result = resolveRound(state, [], 42);
    expect(result.yourGoalChance).toBeLessThanOrEqual(0.50);
    expect(result.yourGoalChance).toBeGreaterThanOrEqual(0.05);
    expect(result.opponentGoalChance).toBeGreaterThanOrEqual(0.05);
    expect(result.opponentGoalChance).toBeLessThanOrEqual(0.50);
  });

  it("is deterministic with same seed", () => {
    const state = makeMatchState();
    const r1 = resolveRound(state, [], 42);
    const r2 = resolveRound(state, [], 42);
    expect(r1.yourScored).toBe(r2.yourScored);
    expect(r1.opponentScored).toBe(r2.opponentScored);
  });

  it("fans earned includes 50 for your goal", () => {
    // Find a seed where yourScored is true
    const state = makeMatchState({ opponentStrength: 0 });
    // With huge advantage, try many seeds
    let foundGoalSeed: number | null = null;
    for (let s = 0; s < 100; s++) {
      const r = resolveRound(state, [], s);
      if (r.yourScored) {
        foundGoalSeed = s;
        break;
      }
    }
    if (foundGoalSeed !== null) {
      const result = resolveRound(state, [], foundGoalSeed);
      expect(result.fansEarned).toBeGreaterThanOrEqual(50);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. createMatchState
// ---------------------------------------------------------------------------

describe("createMatchState", () => {
  it("initializes with correct defaults", () => {
    const xi = makeXI();
    const bench = [makeCard({ id: 99, name: "Bench Player" })];
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeActionCard({ id: `action_${i}`, name: `Action ${i}` })
    );
    const state = createMatchState(xi, bench, deck, 650, 12345);

    expect(state.round).toBe(1);
    expect(state.yourGoals).toBe(0);
    expect(state.opponentGoals).toBe(0);
    expect(state.opponentStrength).toBe(650);
    expect(state.matchSeed).toBe(12345);
    expect(state.fanAccumulator).toBe(0);
    expect(state.persistentYourMod).toBe(0);
    expect(state.persistentOpponentMod).toBe(0);
    expect(state.nextRoundYourMod).toBe(0);
    expect(state.opponentScoredLastRound).toBe(false);
    expect(state.redCardPenalty).toBe(0);
    expect(state.offsideTrapActive).toBe(false);
  });

  it("draws opening hand of 5 from action deck", () => {
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeActionCard({ id: `action_${i}` })
    );
    const state = createMatchState(makeXI(), [], deck, 500, 1);

    expect(state.hand).toHaveLength(5);
    expect(state.actionDeck).toHaveLength(5);
  });

  it("handles deck smaller than 5", () => {
    const deck = [makeActionCard({ id: "only_one" })];
    const state = createMatchState(makeXI(), [], deck, 500, 1);

    expect(state.hand).toHaveLength(1);
    expect(state.actionDeck).toHaveLength(0);
  });

  it("handles empty deck", () => {
    const state = createMatchState(makeXI(), [], [], 500, 1);
    expect(state.hand).toHaveLength(0);
    expect(state.actionDeck).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. advanceMatchState
// ---------------------------------------------------------------------------

describe("advanceMatchState", () => {
  it("increments round number", () => {
    const state = makeMatchState({ round: 1 });
    const result = resolveRound(state, [], 42);
    const next = advanceMatchState(state, result, [], {
      nextRoundYourMod: 0,
      persistentOpponentMod: 0,
      persistentYourMod: 0,
      redCardPenalty: 0,
    });
    expect(next.round).toBe(2);
  });

  it("accumulates goals when yourScored is true", () => {
    const state = makeMatchState({ yourGoals: 1 });
    const result = {
      minute: 30,
      yourStrength: 700,
      opponentStrength: 600,
      yourGoalChance: 0.3,
      opponentGoalChance: 0.1,
      yourScored: true,
      opponentScored: false,
      commentary: [],
      fansEarned: 50,
    };
    const next = advanceMatchState(state, result, [], {
      nextRoundYourMod: 0,
      persistentOpponentMod: 0,
      persistentYourMod: 0,
      redCardPenalty: 0,
    });
    expect(next.yourGoals).toBe(2);
    expect(next.opponentGoals).toBe(0);
  });

  it("accumulates fans from round result", () => {
    const state = makeMatchState({ fanAccumulator: 100 });
    const result = {
      minute: 15,
      yourStrength: 700,
      opponentStrength: 600,
      yourGoalChance: 0.2,
      opponentGoalChance: 0.1,
      yourScored: false,
      opponentScored: false,
      commentary: [],
      fansEarned: 25,
    };
    const next = advanceMatchState(state, result, [], {
      nextRoundYourMod: 0,
      persistentOpponentMod: 0,
      persistentYourMod: 0,
      redCardPenalty: 0,
    });
    expect(next.fanAccumulator).toBe(125);
  });

  it("draws 3 cards at half-time (round advancing to 3)", () => {
    const hand = [makeActionCard({ id: "h1" }), makeActionCard({ id: "h2" })];
    const deck = Array.from({ length: 10 }, (_, i) =>
      makeActionCard({ id: `d_${i}` })
    );
    const state = makeMatchState({ round: 2, hand, actionDeck: deck });
    const result = {
      minute: 30,
      yourStrength: 700,
      opponentStrength: 600,
      yourGoalChance: 0.2,
      opponentGoalChance: 0.1,
      yourScored: false,
      opponentScored: false,
      commentary: [],
      fansEarned: 0,
    };
    const next = advanceMatchState(state, result, [], {
      nextRoundYourMod: 0,
      persistentOpponentMod: 0,
      persistentYourMod: 0,
      redCardPenalty: 0,
    });
    // Hand had 2 cards, can draw min(3, 5-2, 10) = 3
    expect(next.hand).toHaveLength(5);
  });

  it("tracks opponentScoredLastRound", () => {
    const state = makeMatchState();
    const scoredResult = {
      minute: 15,
      yourStrength: 700,
      opponentStrength: 700,
      yourGoalChance: 0.15,
      opponentGoalChance: 0.15,
      yourScored: false,
      opponentScored: true,
      commentary: [],
      fansEarned: 30,
    };
    const next = advanceMatchState(state, scoredResult, [], {
      nextRoundYourMod: 0,
      persistentOpponentMod: 0,
      persistentYourMod: 0,
      redCardPenalty: 0,
    });
    expect(next.opponentScoredLastRound).toBe(true);
  });

  it("accumulates persistent modifiers", () => {
    const state = makeMatchState({
      persistentOpponentMod: -0.05,
      redCardPenalty: -0.10,
    });
    const result = {
      minute: 15,
      yourStrength: 700,
      opponentStrength: 700,
      yourGoalChance: 0.15,
      opponentGoalChance: 0.15,
      yourScored: false,
      opponentScored: false,
      commentary: [],
      fansEarned: 0,
    };
    const next = advanceMatchState(state, result, [], {
      nextRoundYourMod: 0.10,
      persistentOpponentMod: -0.03,
      persistentYourMod: 0,
      redCardPenalty: -0.05,
    });
    expect(next.persistentOpponentMod).toBeCloseTo(-0.08);
    expect(next.redCardPenalty).toBeCloseTo(-0.15);
    expect(next.nextRoundYourMod).toBe(0.10);
  });

  it("resets offsideTrapActive to false", () => {
    const state = makeMatchState({ offsideTrapActive: true });
    const result = {
      minute: 15,
      yourStrength: 700,
      opponentStrength: 700,
      yourGoalChance: 0.15,
      opponentGoalChance: 0.15,
      yourScored: false,
      opponentScored: false,
      commentary: [],
      fansEarned: 0,
    };
    const next = advanceMatchState(state, result, [], {
      nextRoundYourMod: 0,
      persistentOpponentMod: 0,
      persistentYourMod: 0,
      redCardPenalty: 0,
    });
    expect(next.offsideTrapActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. previewRound
// ---------------------------------------------------------------------------

describe("previewRound", () => {
  it("returns preview without mutating state", () => {
    const state = makeMatchState();
    const originalRound = state.round;
    const originalGoals = state.yourGoals;

    const preview = previewRound(state, []);

    expect(state.round).toBe(originalRound);
    expect(state.yourGoals).toBe(originalGoals);
    expect(preview).toHaveProperty("yourStrength");
    expect(preview).toHaveProperty("opponentStrength");
    expect(preview).toHaveProperty("yourGoalChance");
    expect(preview).toHaveProperty("opponentGoalChance");
    expect(preview).toHaveProperty("strengthDelta");
  });

  it("goal chances are clamped", () => {
    const state = makeMatchState({ opponentStrength: 0 });
    const preview = previewRound(state, []);
    expect(preview.yourGoalChance).toBeLessThanOrEqual(0.50);
    expect(preview.opponentGoalChance).toBeGreaterThanOrEqual(0.05);
  });

  it("action cards with yourGoalMod affect preview", () => {
    const state = makeMatchState();
    const noCards = previewRound(state, []);
    const withCards = previewRound(state, [
      makeActionCard({ effect: { yourGoalMod: 0.15 } }),
    ]);
    expect(withCards.yourGoalChance).toBeGreaterThanOrEqual(
      noCards.yourGoalChance
    );
  });

  it("strengthDelta reflects action card impact when not clamped", () => {
    // Use balanced strength so base chance is ~0.15 (not clamped at floor)
    const xi = makeXI();
    const style = PLAYING_STYLES["tiki-taka"];
    const xiStrength = calculateXIStrength(xi, style);
    // Match opponent to XI strength so base is exactly 0.15
    const state = makeMatchState({ xi, opponentStrength: xiStrength });
    const preview = previewRound(state, [
      makeActionCard({ effect: { yourGoalMod: 0.20 } }),
    ]);
    // yourGoalChance = clamp(0.15 + 0.20, 0.05, 0.50) = 0.35
    // baselineYourChance = clamp(0.15, 0.05, 0.50) = 0.15
    // strengthDelta = round((0.35 - 0.15) * 100) = 20
    expect(preview.strengthDelta).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 9. evaluateLineup
// ---------------------------------------------------------------------------

describe("evaluateLineup", () => {
  const style = PLAYING_STYLES["tiki-taka"];

  it("returns ScoringResult with all expected fields", () => {
    const xi = makeXI(3);
    const result = evaluateLineup(xi, style);

    expect(result).toHaveProperty("basePower");
    expect(result).toHaveProperty("connections");
    expect(result).toHaveProperty("connectionBonus");
    expect(result).toHaveProperty("styleMultiplier");
    expect(result).toHaveProperty("roleAbilityEffects");
    expect(result).toHaveProperty("finalScore");
    expect(result).toHaveProperty("breakdown");
  });

  it("basePower reflects sum of card powers (no role abilities)", () => {
    const xi = [
      makeSlottedCard("CM", { power: 50, archetype: "Destroyer" }),
      makeSlottedCard("CF", { power: 80, archetype: "Destroyer" }),
    ];
    // No role abilities on these cards, so basePower ~ 130
    const result = evaluateLineup(xi, {
      name: "None",
      bonusArchetypes: [],
      multiplier: 0,
    });
    expect(result.basePower).toBe(130);
  });

  it("finalScore >= basePower (style and connections only add)", () => {
    const xi = makeXI(5);
    const result = evaluateLineup(xi, style);
    expect(result.finalScore).toBeGreaterThanOrEqual(result.basePower);
  });

  it("breakdown contains a summary string", () => {
    const xi = makeXI(3);
    const result = evaluateLineup(xi, style);
    expect(result.breakdown.length).toBeGreaterThan(0);
    expect(result.breakdown[0]).toContain("Base:");
    expect(result.breakdown[0]).toContain("Final:");
  });
});
