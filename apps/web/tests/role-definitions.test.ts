/**
 * Tests for role-definitions.ts — ensures pipeline TACTICAL_ROLES
 * and UI role definitions stay in sync.
 *
 * Priority: HIGH — the best_role position bug (2026-03-20) showed how
 * mismatched role names between pipeline and UI cause silent failures.
 */
import { describe, it, expect } from "vitest";
import { getRoleDefinition } from "@/lib/role-definitions";
import { ROLE_RADAR_AXES } from "@/lib/role-radar";

// Mirror of pipeline/27_player_ratings.py TACTICAL_ROLES
// If a role is added/renamed in the pipeline, this test will catch the drift.
const PIPELINE_TACTICAL_ROLES: Record<string, [string, string, string][]> = {
  GK: [
    ["GK", "Cover", "Torwart"],
    ["GK", "Passer", "Sweeper Keeper"],
    ["GK", "Controller", "Ball-Playing GK"],
  ],
  CD: [
    ["Cover", "Passer", "Libero"],
    ["Destroyer", "Powerhouse", "Vorstopper"],
    ["Cover", "Controller", "Sweeper"],
    ["Destroyer", "Commander", "Zagueiro"],
  ],
  WD: [
    ["Engine", "Dribbler", "Lateral"],
    ["Controller", "Passer", "Invertido"],
    ["Engine", "Sprinter", "Carrilero"],
  ],
  DM: [
    ["Cover", "Destroyer", "Sentinelle"],
    ["Controller", "Passer", "Regista"],
    ["Destroyer", "Engine", "Volante"],
  ],
  CM: [
    ["Controller", "Passer", "Metodista"],
    ["Engine", "Cover", "Tuttocampista"],
    ["Passer", "Creator", "Mezzala"],
    ["Engine", "Destroyer", "Relayeur"],
  ],
  WM: [
    ["Creator", "Passer", "Fantasista"],
    ["Sprinter", "Passer", "Winger"],
    ["Dribbler", "Striker", "Raumdeuter"],
  ],
  AM: [
    ["Creator", "Dribbler", "Trequartista"],
    ["Controller", "Creator", "Enganche"],
    ["Dribbler", "Striker", "Seconda Punta"],
  ],
  WF: [
    ["Dribbler", "Sprinter", "Inside Forward"],
    ["Sprinter", "Striker", "Extremo"],
    ["Creator", "Dribbler", "Inverted Winger"],
  ],
  CF: [
    ["Target", "Powerhouse", "Prima Punta"],
    ["Striker", "Sprinter", "Poacher"],
    ["Striker", "Creator", "Complete Forward"],
    ["Creator", "Controller", "Falso Nove"],
    ["Dribbler", "Striker", "Seconda Punta"],
  ],
};

describe("Role Definitions — Pipeline ↔ UI Sync", () => {
  const allPositions = Object.keys(PIPELINE_TACTICAL_ROLES);

  it("covers all 9 positions", () => {
    expect(allPositions).toEqual(
      expect.arrayContaining(["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"])
    );
  });

  it("every position has at least 2 roles", () => {
    for (const pos of allPositions) {
      expect(PIPELINE_TACTICAL_ROLES[pos].length).toBeGreaterThanOrEqual(2);
    }
  });

  // Test each role individually
  for (const [position, roles] of Object.entries(PIPELINE_TACTICAL_ROLES)) {
    for (const [, , roleName] of roles) {
      it(`${position}/${roleName} has a UI definition`, () => {
        const def = getRoleDefinition(roleName, position);
        expect(def).not.toBeNull();
        expect(def!.name).toBe(roleName);
        expect(def!.position).toBe(position);
      });

      it(`${position}/${roleName} has non-empty description`, () => {
        const def = getRoleDefinition(roleName, position);
        expect(def).not.toBeNull();
        expect(def!.description.length).toBeGreaterThan(20);
      });

      it(`${position}/${roleName} has example players`, () => {
        const def = getRoleDefinition(roleName, position);
        expect(def).not.toBeNull();
        expect(def!.examples.length).toBeGreaterThan(0);
      });
    }
  }
});

describe("getRoleDefinition", () => {
  it("returns null for unknown role", () => {
    expect(getRoleDefinition("Invented Role")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(getRoleDefinition(null)).toBeNull();
  });

  it("disambiguates Seconda Punta by position (AM vs CF)", () => {
    const am = getRoleDefinition("Seconda Punta", "AM");
    const cf = getRoleDefinition("Seconda Punta", "CF");
    expect(am).not.toBeNull();
    expect(cf).not.toBeNull();
    expect(am!.position).toBe("AM");
    expect(cf!.position).toBe("CF");
    // Different descriptions for different positions
    expect(am!.description).not.toBe(cf!.description);
  });

  it("falls back to name-only lookup without position", () => {
    const def = getRoleDefinition("Regista");
    expect(def).not.toBeNull();
    expect(def!.name).toBe("Regista");
  });
});

describe("Role Radar Sync", () => {
  // Every pipeline role must have a radar axis config
  for (const [position, roles] of Object.entries(PIPELINE_TACTICAL_ROLES)) {
    for (const [, , roleName] of roles) {
      it(`${position}/${roleName} has radar axes in ROLE_RADAR_AXES`, () => {
        expect(ROLE_RADAR_AXES[roleName]).toBeDefined();
        expect(ROLE_RADAR_AXES[roleName].models.length).toBeGreaterThanOrEqual(3);
      });
    }
  }
});
