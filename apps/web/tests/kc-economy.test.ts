import { describe, it, expect } from "vitest";
import {
  STADIUMS,
  SHOP_ITEMS,
  ACADEMY_TIERS,
  calculateAttendance,
  getStadiumTier,
  getStadium,
  getTransferFee,
  generateAcademyDurability,
  canAfford,
  purchase,
} from "../src/lib/kickoff-clash/economy";
import type { Card, SlottedCard, Durability } from "../src/lib/kickoff-clash/scoring";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 1,
    name: "Test Player",
    position: "CM",
    archetype: "Engine",
    power: 50,
    rarity: "Common",
    gatePull: 10,
    durability: "standard",
    ...overrides,
  };
}

function makeSlottedCard(slot: string, overrides: Partial<Card> = {}): SlottedCard {
  return { card: makeCard(overrides), slot };
}

// ---------------------------------------------------------------------------
// STADIUMS
// ---------------------------------------------------------------------------

describe("STADIUMS", () => {
  it("has exactly 5 tiers", () => {
    expect(STADIUMS).toHaveLength(5);
  });

  it("tiers are 1-5 in order", () => {
    expect(STADIUMS.map((s) => s.tier)).toEqual([1, 2, 3, 4, 5]);
  });

  it("capacity is ascending", () => {
    for (let i = 1; i < STADIUMS.length; i++) {
      expect(STADIUMS[i].capacity).toBeGreaterThan(STADIUMS[i - 1].capacity);
    }
  });

  it("ticketPrice is ascending", () => {
    for (let i = 1; i < STADIUMS.length; i++) {
      expect(STADIUMS[i].ticketPrice).toBeGreaterThan(STADIUMS[i - 1].ticketPrice);
    }
  });
});

// ---------------------------------------------------------------------------
// SHOP_ITEMS
// ---------------------------------------------------------------------------

describe("SHOP_ITEMS", () => {
  it("all items have a positive cost", () => {
    for (const item of SHOP_ITEMS) {
      expect(item.cost).toBeGreaterThan(0);
    }
  });

  it("all items have a non-empty id and name", () => {
    for (const item of SHOP_ITEMS) {
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// ACADEMY_TIERS
// ---------------------------------------------------------------------------

describe("ACADEMY_TIERS", () => {
  it("has exactly 4 tiers", () => {
    expect(ACADEMY_TIERS).toHaveLength(4);
  });

  it("playersOffered is ascending (non-decreasing)", () => {
    for (let i = 1; i < ACADEMY_TIERS.length; i++) {
      expect(ACADEMY_TIERS[i].playersOffered).toBeGreaterThanOrEqual(
        ACADEMY_TIERS[i - 1].playersOffered,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// calculateAttendance
// ---------------------------------------------------------------------------

describe("calculateAttendance", () => {
  it("fan sources sum to rawAttendance", () => {
    const xi = [
      makeSlottedCard("CM", { archetype: "Dribbler", personalityTheme: "Catalyst", durability: "glass" }),
      makeSlottedCard("CF", { archetype: "Striker", personalityTheme: "Captain", durability: "standard" }),
    ];
    const connections = [{ name: "test", tier: 1, bonus: 10, key: "t1" }];
    const result = calculateAttendance(xi, connections, 2, 1, 50, 1);

    const expectedRaw =
      result.archetypeFans +
      result.personalityFans +
      result.durabilityFans +
      result.goalFans +
      result.actionFans +
      result.synergyFans +
      result.totalGoalsBonus;
    expect(result.rawAttendance).toBe(expectedRaw);
  });

  it("revenue equals attendance * ticketPrice", () => {
    const xi = [makeSlottedCard("CM")];
    const result = calculateAttendance(xi, [], 0, 0, 0, 1);
    expect(result.revenue).toBe(result.attendance * result.ticketPrice);
  });

  it("goals boost attendance", () => {
    const xi = [makeSlottedCard("CM")];
    const noGoals = calculateAttendance(xi, [], 0, 0, 0, 1);
    const withGoals = calculateAttendance(xi, [], 3, 2, 0, 1);
    expect(withGoals.rawAttendance).toBeGreaterThan(noGoals.rawAttendance);
  });

  it("attendance is capped at stadium capacity", () => {
    // Tier 1 stadium has capacity 500
    const xi = Array.from({ length: 11 }, (_, i) =>
      makeSlottedCard(`slot_${i}`, {
        id: i,
        archetype: "Dribbler",
        personalityTheme: "Catalyst",
        durability: "glass",
        power: 90,
      }),
    );
    const result = calculateAttendance(xi, [], 10, 10, 500, 1);
    expect(result.attendance).toBeLessThanOrEqual(result.capacity);
  });
});

// ---------------------------------------------------------------------------
// getStadiumTier
// ---------------------------------------------------------------------------

describe("getStadiumTier", () => {
  it("returns 1 with no wins", () => {
    expect(getStadiumTier(0, false, false)).toBe(1);
  });

  it("returns 2 with 1 win", () => {
    expect(getStadiumTier(1, false, false)).toBe(2);
  });

  it("returns 3 with 3 wins", () => {
    expect(getStadiumTier(3, false, false)).toBe(3);
  });

  it("returns 4 when reachedMatch5", () => {
    expect(getStadiumTier(3, true, false)).toBe(4);
  });

  it("returns 5 when wonRun", () => {
    expect(getStadiumTier(5, true, true)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getTransferFee
// ---------------------------------------------------------------------------

describe("getTransferFee", () => {
  it("base fee scales with rarity", () => {
    const common = getTransferFee(makeCard({ rarity: "Common" }));
    const rare = getTransferFee(makeCard({ rarity: "Rare" }));
    const epic = getTransferFee(makeCard({ rarity: "Epic" }));
    expect(rare).toBeGreaterThan(common);
    expect(epic).toBeGreaterThan(rare);
  });

  it("durability modifier affects fee", () => {
    const standard = getTransferFee(makeCard({ durability: "standard" }));
    const iron = getTransferFee(makeCard({ durability: "iron" }));
    expect(iron).toBeGreaterThan(standard);
  });

  it("Catalyst personality gives +50% bonus", () => {
    const base = getTransferFee(makeCard({ personalityTheme: "Captain" }));
    const catalyst = getTransferFee(makeCard({ personalityTheme: "Catalyst" }));
    expect(catalyst).toBe(Math.floor(base * 1.5));
  });
});

// ---------------------------------------------------------------------------
// generateAcademyDurability
// ---------------------------------------------------------------------------

describe("generateAcademyDurability", () => {
  it("returns the requested count", () => {
    expect(generateAcademyDurability(1, 3, 42)).toHaveLength(3);
    expect(generateAcademyDurability(4, 5, 99)).toHaveLength(5);
  });

  it("all values are valid durability types", () => {
    const valid: Durability[] = ["glass", "fragile", "standard", "iron", "titanium", "phoenix"];
    const result = generateAcademyDurability(4, 20, 7);
    for (const d of result) {
      expect(valid).toContain(d);
    }
  });
});

// ---------------------------------------------------------------------------
// canAfford / purchase
// ---------------------------------------------------------------------------

describe("canAfford / purchase", () => {
  const item = SHOP_ITEMS[0]; // card_pick, cost 15000

  it("canAfford returns true when cash >= cost", () => {
    expect(canAfford(15000, item)).toBe(true);
    expect(canAfford(99999, item)).toBe(true);
  });

  it("canAfford returns false when cash < cost", () => {
    expect(canAfford(14999, item)).toBe(false);
    expect(canAfford(0, item)).toBe(false);
  });

  it("purchase returns remaining cash on success", () => {
    expect(purchase(20000, item)).toBe(20000 - item.cost);
  });

  it("purchase returns null when cannot afford", () => {
    expect(purchase(100, item)).toBeNull();
  });
});
