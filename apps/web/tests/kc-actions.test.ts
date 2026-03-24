import { describe, it, expect } from "vitest";
import {
  ALL_ACTION_CARDS,
  getActionCard,
  getActionCardsByType,
  canPlayAction,
} from "../src/lib/kickoff-clash/actions";
import type { ActionCard } from "../src/lib/kickoff-clash/actions";

// ---------------------------------------------------------------------------
// ALL_ACTION_CARDS
// ---------------------------------------------------------------------------

describe("ALL_ACTION_CARDS", () => {
  it("contains all four card types", () => {
    const types = new Set(ALL_ACTION_CARDS.map((c) => c.type));
    expect(types).toContain("tactical");
    expect(types).toContain("moment");
    expect(types).toContain("mind_game");
  });

  it("has attacking and defensive tactical subtypes", () => {
    const subtypes = new Set(
      ALL_ACTION_CARDS.filter((c) => c.type === "tactical").map((c) => c.subtype),
    );
    expect(subtypes).toContain("attacking");
    expect(subtypes).toContain("defensive");
  });

  it("every card has a unique id", () => {
    const ids = ALL_ACTION_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every card has a non-empty flavour text", () => {
    for (const card of ALL_ACTION_CARDS) {
      expect(card.flavour.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getActionCard
// ---------------------------------------------------------------------------

describe("getActionCard", () => {
  it("returns the correct card by id", () => {
    const card = getActionCard("press_high");
    expect(card).toBeDefined();
    expect(card!.name).toBe("Press High");
  });

  it("returns undefined for a missing id", () => {
    expect(getActionCard("nonexistent_card")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getActionCardsByType
// ---------------------------------------------------------------------------

describe("getActionCardsByType", () => {
  it("filters tactical cards correctly", () => {
    const tactical = getActionCardsByType("tactical");
    expect(tactical.length).toBeGreaterThan(0);
    for (const card of tactical) {
      expect(card.type).toBe("tactical");
    }
  });

  it("filters moment cards correctly", () => {
    const moments = getActionCardsByType("moment");
    expect(moments.length).toBeGreaterThan(0);
    for (const card of moments) {
      expect(card.type).toBe("moment");
    }
  });

  it("filters mind_game cards correctly", () => {
    const mindGames = getActionCardsByType("mind_game");
    expect(mindGames.length).toBeGreaterThan(0);
    for (const card of mindGames) {
      expect(card.type).toBe("mind_game");
    }
  });
});

// ---------------------------------------------------------------------------
// canPlayAction
// ---------------------------------------------------------------------------

describe("canPlayAction", () => {
  it("round-restricted card cannot be played in wrong round", () => {
    const lastMinute = getActionCard("last_minute_drama")!;
    expect(lastMinute.effect.onlyAtRound).toBe(5);
    expect(canPlayAction(lastMinute, 1)).toBe(false);
    expect(canPlayAction(lastMinute, 3)).toBe(false);
  });

  it("round-restricted card can be played in the correct round", () => {
    const lastMinute = getActionCard("last_minute_drama")!;
    expect(canPlayAction(lastMinute, 5)).toBe(true);
  });

  it("cards without round restriction are always playable", () => {
    const pressHigh = getActionCard("press_high")!;
    for (let round = 1; round <= 5; round++) {
      expect(canPlayAction(pressHigh, round)).toBe(true);
    }
  });
});
