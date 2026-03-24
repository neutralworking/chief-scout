/**
 * Kickoff Clash — Run State Manager Tests
 *
 * Covers: formations, opponents, deck generation, run lifecycle,
 * shop, economy, deck analysis, durability, and state invariants.
 */
import { describe, it, expect } from "vitest";
import {
  getFormationSlots,
  getSlotDisplayName,
  getSlotPosition,
  getOpponent,
  getOpponentBuild,
  generateStarterDeck,
  generateStarterActionDeck,
  createRun,
  startMatch,
  getShopCards,
  addCardToDeck,
  sellCard,
  analyzeDeck,
  postMatchDurabilityCheck,
  applyDurabilityResults,
  buyShopItem,
  upgradeAcademy,
  buyAcademyPlayer,
  shuffleAndSelectXI,
  advanceToNextMatch,
  placeCard,
  removeCard,
  canBlowWhistle,
  ALL_CARDS,
  SHOP_ITEMS,
  type RunState,
  type Card,
  type SlottedCard,
} from "@/lib/kickoff-clash/run";
import type { Durability } from "@/lib/kickoff-clash/scoring";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEED = 42;

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 9999,
    name: "Test Player",
    position: "CM",
    archetype: "Engine",
    power: 60,
    rarity: "Common",
    gatePull: 10,
    durability: "standard",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. getFormationSlots
// ---------------------------------------------------------------------------

describe("getFormationSlots", () => {
  it("returns 11 slots for 4-3-3", () => {
    const slots = getFormationSlots("4-3-3");
    expect(slots).toHaveLength(11);
    expect(slots[0]).toBe("GK");
  });

  it("returns 11 slots for 4-4-2", () => {
    const slots = getFormationSlots("4-4-2");
    expect(slots).toHaveLength(11);
    expect(slots[0]).toBe("GK");
  });

  it("returns 11 slots for 3-5-2", () => {
    const slots = getFormationSlots("3-5-2");
    expect(slots).toHaveLength(11);
    expect(slots[0]).toBe("GK");
  });

  it("falls back to 4-3-3 for unknown formation", () => {
    expect(getFormationSlots("1-1-1")).toEqual(getFormationSlots("4-3-3"));
  });
});

// ---------------------------------------------------------------------------
// 2. getSlotDisplayName
// ---------------------------------------------------------------------------

describe("getSlotDisplayName", () => {
  it("returns human-readable names for known slots", () => {
    expect(getSlotDisplayName("CD")).toBe("Centre-Back");
    expect(getSlotDisplayName("WD")).toBe("Full-Back");
    expect(getSlotDisplayName("CF")).toBe("Striker");
    expect(getSlotDisplayName("CM")).toBe("Central Mid");
    expect(getSlotDisplayName("WF")).toBe("Winger");
    expect(getSlotDisplayName("DM")).toBe("Def. Mid");
  });

  it("returns the raw slot string for unknown slots", () => {
    expect(getSlotDisplayName("XYZ")).toBe("XYZ");
  });
});

// ---------------------------------------------------------------------------
// 3. getOpponent
// ---------------------------------------------------------------------------

describe("getOpponent", () => {
  it("round 1 is the weakest opponent", () => {
    const opp = getOpponent(1);
    expect(opp.name).toBe("FC Warm-Up");
    expect(opp.baseStrength).toBe(40);
  });

  it("opponent strength increases with round", () => {
    const strengths = [1, 2, 3, 4, 5].map((r) => getOpponent(r).baseStrength);
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i]).toBeGreaterThan(strengths[i - 1]);
    }
  });

  it("round 5 is The Invincibles", () => {
    const opp = getOpponent(5);
    expect(opp.name).toBe("The Invincibles");
    expect(opp.baseStrength).toBe(95);
  });

  it("clamps to last opponent for rounds beyond 5", () => {
    expect(getOpponent(10)).toEqual(getOpponent(5));
  });
});

// ---------------------------------------------------------------------------
// 4. generateStarterDeck
// ---------------------------------------------------------------------------

describe("generateStarterDeck", () => {
  it("returns 18 cards for a full squad", () => {
    const deck = generateStarterDeck(SEED);
    expect(deck).toHaveLength(18);
  });

  it("contains at least 1 GK and 2 CD for position coverage", () => {
    const deck = generateStarterDeck(SEED);
    const positions = deck.map(c => c.position);
    expect(positions.filter(p => p === "GK").length).toBeGreaterThanOrEqual(1);
    expect(positions.filter(p => p === "CD").length).toBeGreaterThanOrEqual(2);
    expect(positions.filter(p => p === "CF" || p === "WF" || p === "AM").length).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic — same seed produces same deck", () => {
    const a = generateStarterDeck(123);
    const b = generateStarterDeck(123);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("different seeds produce different decks", () => {
    const a = generateStarterDeck(1);
    const b = generateStarterDeck(2);
    const idsA = a.map((c) => c.id).sort();
    const idsB = b.map((c) => c.id).sort();
    // Extremely unlikely to be identical with different seeds
    expect(idsA).not.toEqual(idsB);
  });
});

// ---------------------------------------------------------------------------
// 5. createRun
// ---------------------------------------------------------------------------

describe("createRun", () => {
  it("initializes all fields correctly", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    expect(run.formation).toBe("4-3-3");
    expect(run.playingStyle).toBe("Tiki-Taka");
    expect(run.seed).toBe(SEED);
    expect(run.round).toBe(1);
    expect(run.wins).toBe(0);
    expect(run.losses).toBe(0);
    expect(run.cash).toBe(10000);
    expect(run.stadiumTier).toBe(1);
    expect(run.academyTier).toBe(1);
    expect(run.status).toBe("prematch");
    expect(run.matchState).toBeNull();
    expect(run.matchHistory).toEqual([]);
    expect(run.modifiers).toEqual([]);
  });

  it("deck has 18 cards", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    expect(run.deck).toHaveLength(18);
  });

  it("bench equals deck at start (no lineup yet)", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    expect(run.bench).toHaveLength(run.deck.length);
  });

  it("lineup is empty at start", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    expect(run.lineup).toEqual([]);
  });

  it("action deck is populated", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    expect(run.actionDeck.length).toBeGreaterThan(0);
  });

  it("uses random seed when none provided", () => {
    const a = createRun("4-3-3", "Tiki-Taka");
    const b = createRun("4-3-3", "Tiki-Taka");
    // Seeds should differ (probabilistic but effectively guaranteed)
    expect(a.seed).not.toBe(b.seed);
  });
});

// ---------------------------------------------------------------------------
// 6. startMatch
// ---------------------------------------------------------------------------

describe("startMatch", () => {
  it("transitions status to playing", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const started = startMatch(run);
    expect(started.status).toBe("playing");
  });

  it("creates a matchState", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const started = startMatch(run);
    expect(started.matchState).not.toBeNull();
  });

  it("populates lineup with 11 slotted cards", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const started = startMatch(run);
    expect(started.lineup.length).toBe(11);
  });

  it("bench + lineup accounts for all deck cards", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const started = startMatch(run);
    const lineupIds = started.lineup.map((sc) => sc.card.id);
    const benchIds = started.bench.map((c) => c.id);
    const allIds = [...lineupIds, ...benchIds].sort();
    const deckIds = started.deck.map((c) => c.id).sort();
    expect(allIds).toEqual(deckIds);
  });
});

// ---------------------------------------------------------------------------
// 7. getShopCards
// ---------------------------------------------------------------------------

describe("getShopCards", () => {
  it("returns exactly 3 cards", () => {
    const cards = getShopCards(SEED);
    expect(cards).toHaveLength(3);
  });

  it("is deterministic with same seed", () => {
    const a = getShopCards(777);
    const b = getShopCards(777);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("rareOnly filter excludes Common cards", () => {
    const cards = getShopCards(SEED, true);
    for (const c of cards) {
      expect(c.rarity).not.toBe("Common");
    }
  });
});

// ---------------------------------------------------------------------------
// 8. addCardToDeck / sellCard
// ---------------------------------------------------------------------------

describe("addCardToDeck", () => {
  it("increases deck size by 1", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const card = makeCard();
    const updated = addCardToDeck(run, card);
    expect(updated.deck).toHaveLength(run.deck.length + 1);
  });

  it("assigns a new unique ID to the added card", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const card = makeCard({ id: 1 });
    const updated = addCardToDeck(run, card);
    const addedCard = updated.deck[updated.deck.length - 1];
    // New ID should differ from the original card ID
    expect(addedCard.id).not.toBe(card.id);
  });

  it("does not mutate original state", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const origLen = run.deck.length;
    addCardToDeck(run, makeCard());
    expect(run.deck).toHaveLength(origLen);
  });
});

describe("sellCard", () => {
  it("removes the sold card from deck", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const cardToSell = run.deck[0];
    const updated = sellCard(run, cardToSell);
    expect(updated.deck).toHaveLength(run.deck.length - 1);
    expect(updated.deck.find((c) => c.id === cardToSell.id)).toBeUndefined();
  });

  it("increases cash by transfer fee", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const cardToSell = run.deck[0];
    const updated = sellCard(run, cardToSell);
    expect(updated.cash).toBeGreaterThan(run.cash);
  });

  it("cash never goes negative after selling", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const updated = sellCard(run, run.deck[0]);
    expect(updated.cash).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 9. analyzeDeck
// ---------------------------------------------------------------------------

describe("analyzeDeck", () => {
  const opponent = getOpponentBuild(1); // FC Warm-Up

  it("counts archetypes correctly", () => {
    const deck = [
      makeCard({ archetype: "Engine" }),
      makeCard({ archetype: "Engine" }),
      makeCard({ archetype: "Creator" }),
    ];
    const analysis = analyzeDeck(deck, opponent);
    expect(analysis.archetypeCounts["Engine"]).toBe(2);
    expect(analysis.archetypeCounts["Creator"]).toBe(1);
  });

  it("detects archetype-pair synergies when 2+ of same archetype", () => {
    const deck = [
      makeCard({ archetype: "Engine" }),
      makeCard({ archetype: "Engine" }),
    ];
    const analysis = analyzeDeck(deck, opponent);
    expect(analysis.activeSynergies).toContain("Pressing Trap");
  });

  it("does not report synergy for single archetype", () => {
    const deck = [makeCard({ archetype: "Engine" })];
    const analysis = analyzeDeck(deck, opponent);
    expect(analysis.activeSynergies).not.toContain("Pressing Trap");
  });

  it("warns when 3+ glass cards in deck", () => {
    const deck = [
      makeCard({ durability: "glass" }),
      makeCard({ durability: "glass" }),
      makeCard({ durability: "glass" }),
    ];
    const analysis = analyzeDeck(deck, opponent);
    expect(analysis.warnings.some((w) => w.includes("Glass"))).toBe(true);
  });

  it("warns when no defenders in deck", () => {
    const deck = [makeCard({ position: "CM" }), makeCard({ position: "CF" })];
    const analysis = analyzeDeck(deck, opponent);
    expect(analysis.warnings.some((w) => w.includes("No defenders"))).toBe(
      true,
    );
  });

  it("reports opponent weakness match count", () => {
    // FC Warm-Up weakness is 'Sprinter'
    const deck = [
      makeCard({ archetype: "Sprinter" }),
      makeCard({ archetype: "Sprinter" }),
      makeCard({ archetype: "Engine" }),
    ];
    const analysis = analyzeDeck(deck, opponent);
    expect(analysis.opponentMatch.weaknessArchetype).toBe("Sprinter");
    expect(analysis.opponentMatch.count).toBe(2);
  });

  it("detects role combo synergies", () => {
    const deck = [
      makeCard({ tacticalRole: "Regista" }),
      makeCard({ tacticalRole: "Mezzala" }),
    ];
    const analysis = analyzeDeck(deck, opponent);
    expect(analysis.activeSynergies).toContain("The Pirlo-Barella");
  });

  it("detects near synergies (have one role, missing the other)", () => {
    const deck = [makeCard({ tacticalRole: "Regista" })];
    const analysis = analyzeDeck(deck, opponent);
    const near = analysis.nearSynergies.find(
      (ns) => ns.name === "The Pirlo-Barella",
    );
    expect(near).toBeDefined();
    expect(near!.missing).toBe("Mezzala");
  });
});

// ---------------------------------------------------------------------------
// 10. postMatchDurabilityCheck / applyDurabilityResults
// ---------------------------------------------------------------------------

describe("postMatchDurabilityCheck", () => {
  it("returns arrays for shattered, injured, promoted, commentary", () => {
    const xi: SlottedCard[] = [
      { card: makeCard({ durability: "standard" }), slot: "CM" },
    ];
    const result = postMatchDurabilityCheck(xi, SEED);
    expect(Array.isArray(result.shattered)).toBe(true);
    expect(Array.isArray(result.injured)).toBe(true);
    expect(Array.isArray(result.promoted)).toBe(true);
    expect(Array.isArray(result.commentary)).toBe(true);
  });

  it("standard/iron/titanium cards never shatter", () => {
    const xi: SlottedCard[] = [
      { card: makeCard({ id: 1, durability: "standard" }), slot: "CM" },
      { card: makeCard({ id: 2, durability: "iron" }), slot: "CD" },
      { card: makeCard({ id: 3, durability: "titanium" }), slot: "CF" },
    ];
    // Run many seeds to confirm
    for (let s = 0; s < 100; s++) {
      const result = postMatchDurabilityCheck(xi, s);
      expect(result.shattered).toHaveLength(0);
    }
  });

  it("phoenix card promoted after 3 matches survived", () => {
    const phoenix = makeCard({
      id: 10,
      durability: "phoenix",
      phoenixMatchesSurvived: 2,
    });
    const xi: SlottedCard[] = [{ card: phoenix, slot: "CM" }];
    // Use a seed that does NOT shatter the phoenix
    // Try multiple seeds until we find one that doesn't shatter
    let found = false;
    for (let s = 0; s < 200; s++) {
      const result = postMatchDurabilityCheck(xi, s);
      if (result.shattered.length === 0) {
        expect(result.promoted).toHaveLength(1);
        expect(result.promoted[0].name).toBe("Test Player");
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe("applyDurabilityResults", () => {
  it("removes shattered cards from deck", () => {
    const deck = [
      makeCard({ id: 1, name: "A" }),
      makeCard({ id: 2, name: "B" }),
    ];
    const result = {
      shattered: [deck[0]],
      injured: [],
      promoted: [],
      commentary: [],
    };
    const newDeck = applyDurabilityResults(deck, result);
    expect(newDeck).toHaveLength(1);
    expect(newDeck[0].id).toBe(2);
  });

  it("marks injured cards", () => {
    const deck = [makeCard({ id: 1 })];
    const result = {
      shattered: [],
      injured: [deck[0]],
      promoted: [],
      commentary: [],
    };
    const newDeck = applyDurabilityResults(deck, result);
    expect(newDeck[0].injured).toBe(true);
  });

  it("promotes phoenix to iron", () => {
    const deck = [makeCard({ id: 1, durability: "phoenix" as Durability })];
    const result = {
      shattered: [],
      injured: [],
      promoted: [deck[0]],
      commentary: [],
    };
    const newDeck = applyDurabilityResults(deck, result);
    expect(newDeck[0].durability).toBe("iron");
  });

  it("clears previous injuries on non-injured cards", () => {
    const deck = [makeCard({ id: 1, injured: true })];
    const result = {
      shattered: [],
      injured: [],
      promoted: [],
      commentary: [],
    };
    const newDeck = applyDurabilityResults(deck, result);
    expect(newDeck[0].injured).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 11. buyShopItem / upgradeAcademy
// ---------------------------------------------------------------------------

describe("buyShopItem", () => {
  it("deducts cost from cash", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const item = SHOP_ITEMS.find((i) => i.id === "reroll")!;
    const updated = buyShopItem(run, item);
    expect(updated).not.toBeNull();
    expect(updated!.cash).toBe(run.cash - item.cost);
  });

  it("returns null if insufficient cash", () => {
    const run = { ...createRun("4-3-3", "Tiki-Taka", SEED), cash: 0 };
    const item = SHOP_ITEMS.find((i) => i.id === "reroll")!;
    expect(buyShopItem(run, item)).toBeNull();
  });

  it("food_upgrade increases ticketPriceBonus", () => {
    const run = { ...createRun("4-3-3", "Tiki-Taka", SEED), cash: 100000 };
    const item = SHOP_ITEMS.find((i) => i.id === "food_upgrade")!;
    if (item) {
      const updated = buyShopItem(run, item);
      expect(updated).not.toBeNull();
      expect(updated!.ticketPriceBonus).toBe(run.ticketPriceBonus + 5);
    }
  });
});

describe("upgradeAcademy", () => {
  it("increments academy tier and deducts cost", () => {
    const run = { ...createRun("4-3-3", "Tiki-Taka", SEED), cash: 50000 };
    const updated = upgradeAcademy(run);
    expect(updated).not.toBeNull();
    expect(updated!.academyTier).toBe(2);
    expect(updated!.cash).toBe(50000 - 30000);
  });

  it("returns null if already at max tier (4)", () => {
    const run = {
      ...createRun("4-3-3", "Tiki-Taka", SEED),
      cash: 100000,
      academyTier: 4,
    };
    expect(upgradeAcademy(run)).toBeNull();
  });

  it("returns null if insufficient cash", () => {
    const run = { ...createRun("4-3-3", "Tiki-Taka", SEED), cash: 100 };
    expect(upgradeAcademy(run)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Additional: shuffleAndSelectXI, advanceToNextMatch, placeCard, removeCard
// ---------------------------------------------------------------------------

describe("shuffleAndSelectXI", () => {
  it("XI has 11 cards (one per slot)", () => {
    const deck = generateStarterDeck(SEED);
    const { xi } = shuffleAndSelectXI(deck, "4-3-3", SEED);
    expect(xi.length).toBe(11);
  });

  it("no card appears in both XI and bench", () => {
    const deck = generateStarterDeck(SEED);
    const { xi, bench } = shuffleAndSelectXI(deck, "4-3-3", SEED);
    const xiIds = new Set(xi.map((sc) => sc.card.id));
    for (const b of bench) {
      expect(xiIds.has(b.id)).toBe(false);
    }
  });

  it("injured cards are excluded from XI", () => {
    const deck = generateStarterDeck(SEED).map((c) => ({
      ...c,
      injured: true,
    }));
    const { xi } = shuffleAndSelectXI(deck, "4-3-3", SEED);
    // All cards injured, so XI should be empty
    expect(xi).toHaveLength(0);
  });

  it("titanium cards get priority placement", () => {
    const titanium = makeCard({
      id: 8001,
      position: "CM",
      durability: "titanium",
    });
    const others = [
      makeCard({ id: 8002, position: "CM", durability: "standard" }),
      makeCard({ id: 8003, position: "CD", durability: "standard" }),
      makeCard({ id: 8004, position: "CF", durability: "standard" }),
      makeCard({ id: 8005, position: "WF", durability: "standard" }),
      makeCard({ id: 8006, position: "WD", durability: "standard" }),
    ];
    const deck = [titanium, ...others];
    const { xi } = shuffleAndSelectXI(deck, "4-3-3", SEED);
    const titaniumInXI = xi.find((sc) => sc.card.id === 8001);
    expect(titaniumInXI).toBeDefined();
  });
});

describe("advanceToNextMatch", () => {
  it("increments round and resets lineup", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const advanced = advanceToNextMatch(run);
    expect(advanced.round).toBe(2);
    expect(advanced.lineup).toEqual([]);
    expect(advanced.status).toBe("prematch");
  });
});

describe("placeCard / removeCard", () => {
  it("placeCard moves card from bench to lineup", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const card = run.bench[0];
    const updated = placeCard(run, card, "CM");
    expect(updated.lineup.some((sc) => sc.card.id === card.id)).toBe(true);
    expect(updated.bench.find((c) => c.id === card.id)).toBeUndefined();
  });

  it("removeCard moves card back to bench", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const card = run.bench[0];
    const placed = placeCard(run, card, "CM");
    const removed = removeCard(placed, "CM");
    expect(removed.lineup.find((sc) => sc.slot === "CM")).toBeUndefined();
    expect(removed.bench.find((c) => c.id === card.id)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// State invariant: cash never negative through normal operations
// ---------------------------------------------------------------------------

describe("state invariants", () => {
  it("createRun starts with positive cash", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    expect(run.cash).toBeGreaterThan(0);
  });

  it("selling all cards keeps cash non-negative", () => {
    let run = createRun("4-3-3", "Tiki-Taka", SEED);
    for (const card of [...run.deck]) {
      run = sellCard(run, card);
    }
    expect(run.cash).toBeGreaterThanOrEqual(0);
    expect(run.deck).toHaveLength(0);
  });

  it("buying then selling maintains cash consistency", () => {
    const run = createRun("4-3-3", "Tiki-Taka", SEED);
    const shopCard = getShopCards(SEED)[0];
    const afterBuy = addCardToDeck(run, shopCard);
    // Cash unchanged from addCardToDeck (it just adds, no cost)
    expect(afterBuy.cash).toBe(run.cash);
    expect(afterBuy.deck).toHaveLength(run.deck.length + 1);
  });
});
