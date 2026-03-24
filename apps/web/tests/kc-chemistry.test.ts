import { describe, it, expect, beforeEach } from "vitest";
import { findConnections, ARCHETYPE_PAIR_NAMES, ROLE_COMBOS } from "../src/lib/kickoff-clash/chemistry";
import type { Card, SlottedCard } from "../src/lib/kickoff-clash/scoring";

// ---------------------------------------------------------------------------
// Helper factory
// ---------------------------------------------------------------------------

let idCounter = 1;

function makeSlottedCard(slot: string, overrides: Partial<Card> = {}): SlottedCard {
  return {
    card: {
      id: idCounter++,
      name: `Player ${idCounter}`,
      position: "CM",
      archetype: "Engine",
      power: 50,
      rarity: "Common",
      gatePull: 10,
      durability: "standard",
      ...overrides,
    },
    slot,
  };
}

function resetIds() {
  idCounter = 1;
}

// ---------------------------------------------------------------------------
// Empty lineup
// ---------------------------------------------------------------------------

describe("findConnections", () => {
  beforeEach(() => resetIds());

  it("returns empty array for empty lineup", () => {
    expect(findConnections([])).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Tier 1 — Archetype pairs
  // -----------------------------------------------------------------------

  it("returns a tier 1 connection for an archetype pair", () => {
    const lineup = [
      makeSlottedCard("CM_L", { archetype: "Creator", power: 60 }),
      makeSlottedCard("CM_R", { archetype: "Creator", power: 40 }),
    ];
    const conns = findConnections(lineup);
    const t1 = conns.filter((c) => c.tier === 1);
    expect(t1).toHaveLength(1);
    expect(t1[0].name).toBe(ARCHETYPE_PAIR_NAMES["Creator"]);
    expect(t1[0].bonus).toBe(Math.round((60 + 40) * 0.15));
  });

  it("returns a higher bonus for an archetype trio than a duo", () => {
    const duo = [
      makeSlottedCard("CM_L", { archetype: "Engine", power: 50 }),
      makeSlottedCard("CM_R", { archetype: "Engine", power: 50 }),
    ];
    resetIds();
    const trio = [
      makeSlottedCard("CM_L", { archetype: "Engine", power: 50 }),
      makeSlottedCard("CM_R", { archetype: "Engine", power: 50 }),
      makeSlottedCard("DM", { archetype: "Engine", power: 50 }),
    ];

    const duoConns = findConnections(duo).filter((c) => c.tier === 1);
    const trioConns = findConnections(trio).filter((c) => c.tier === 1);

    expect(duoConns).toHaveLength(1);
    expect(trioConns).toHaveLength(1);
    expect(trioConns[0].bonus).toBeGreaterThan(duoConns[0].bonus);
    expect(trioConns[0].name).toContain("Room"); // "The Engine Room"
  });

  // -----------------------------------------------------------------------
  // Tier 2 — Role combos
  // -----------------------------------------------------------------------

  it("returns a tier 2 connection for a role combo", () => {
    const combo = ROLE_COMBOS[0]; // Pirlo-Barella: Regista + Mezzala
    const lineup = [
      makeSlottedCard("CM_L", { tacticalRole: combo.role1, power: 60 }),
      makeSlottedCard("CM_R", { tacticalRole: combo.role2, power: 40 }),
    ];
    const conns = findConnections(lineup);
    const t2 = conns.filter((c) => c.tier === 2);
    expect(t2).toHaveLength(1);
    expect(t2[0].name).toBe(combo.name);
    expect(t2[0].bonus).toBe(Math.round((60 + 40) * (combo.multiplier - 1)));
  });

  // -----------------------------------------------------------------------
  // Tier 3 — Personality resonance (requires 3+ of same theme)
  // -----------------------------------------------------------------------

  it("returns a tier 3 connection for personality theme majority", () => {
    const lineup = [
      makeSlottedCard("CM_L", { personalityTheme: "General", power: 50 }),
      makeSlottedCard("CM_R", { personalityTheme: "General", power: 50 }),
      makeSlottedCard("DM", { personalityTheme: "General", power: 50 }),
    ];
    const conns = findConnections(lineup);
    const t3 = conns.filter((c) => c.tier === 3);
    expect(t3).toHaveLength(1);
    expect(t3[0].name).toBe("Chain of Command");
    expect(t3[0].key).toBe("t3_general");
  });

  it("does not return tier 3 with fewer than 3 of the same theme", () => {
    const lineup = [
      makeSlottedCard("CM_L", { personalityTheme: "General", power: 50 }),
      makeSlottedCard("CM_R", { personalityTheme: "General", power: 50 }),
    ];
    const conns = findConnections(lineup);
    const t3 = conns.filter((c) => c.tier === 3);
    expect(t3).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Tier 4 — Perfect Dressing Room (all 5 themes)
  // -----------------------------------------------------------------------

  it("returns tier 4 'Perfect Dressing Room' when all 5 themes present", () => {
    const themes = ["General", "Catalyst", "Maestro", "Captain", "Professor"];
    const lineup = themes.map((theme, i) =>
      makeSlottedCard(`slot_${i}`, { personalityTheme: theme, power: 40 }),
    );
    const conns = findConnections(lineup);
    const t4 = conns.filter((c) => c.tier === 4);
    expect(t4).toHaveLength(1);
    expect(t4[0].name).toBe("The Perfect Dressing Room");
    expect(t4[0].key).toBe("t4_perfect_dressing_room");
    // bonus equals total lineup power
    const totalPower = lineup.reduce((sum, sc) => sum + sc.card.power, 0);
    expect(t4[0].bonus).toBe(totalPower);
  });

  it("does not return tier 4 when a theme is missing", () => {
    const themes = ["General", "Catalyst", "Maestro", "Captain"]; // no Professor
    const lineup = themes.map((theme, i) =>
      makeSlottedCard(`slot_${i}`, { personalityTheme: theme, power: 40 }),
    );
    const conns = findConnections(lineup);
    const t4 = conns.filter((c) => c.tier === 4);
    expect(t4).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------

  it("results are sorted by tier ascending", () => {
    // Build a lineup that triggers tier 1 + tier 4
    const themes = ["General", "Catalyst", "Maestro", "Captain", "Professor"];
    const lineup = [
      // Two Creators for tier 1
      makeSlottedCard("CM_L", { archetype: "Creator", personalityTheme: "General", power: 50 }),
      makeSlottedCard("CM_R", { archetype: "Creator", personalityTheme: "Catalyst", power: 50 }),
      // Remaining themes for tier 4
      makeSlottedCard("DM", { personalityTheme: "Maestro", power: 50 }),
      makeSlottedCard("AM", { personalityTheme: "Captain", power: 50 }),
      makeSlottedCard("CF", { personalityTheme: "Professor", power: 50 }),
    ];
    const conns = findConnections(lineup);
    expect(conns.length).toBeGreaterThan(1);

    for (let i = 1; i < conns.length; i++) {
      expect(conns[i].tier).toBeGreaterThanOrEqual(conns[i - 1].tier);
    }
  });
});
