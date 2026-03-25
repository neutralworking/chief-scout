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
    ["GK", "Passer", "Libero GK"],
    ["GK", "Cover", "Sweeper Keeper"],
    ["GK", "Commander", "Comandante"],
    ["GK", "Target", "Shotstopper"],
  ],
  CD: [
    ["Passer", "Cover", "Libero"],
    ["Cover", "Controller", "Sweeper"],
    ["Commander", "Destroyer", "Zagueiro"],
    ["Powerhouse", "Destroyer", "Stopper"],
  ],
  WD: [
    ["Passer", "Dribbler", "Lateral"],
    ["Engine", "Cover", "Fluidificante"],
    ["Controller", "Passer", "Invertido"],
    ["Sprinter", "Engine", "Corredor"],
  ],
  DM: [
    ["Passer", "Controller", "Regista"],
    ["Cover", "Destroyer", "Sentinelle"],
    ["Controller", "Cover", "Pivote"],
    ["Powerhouse", "Destroyer", "Volante"],
  ],
  CM: [
    ["Passer", "Creator", "Mezzala"],
    ["Engine", "Cover", "Tuttocampista"],
    ["Controller", "Passer", "Metodista"],
    ["Sprinter", "Engine", "Relayeur"],
  ],
  WM: [
    ["Dribbler", "Passer", "Winger"],
    ["Engine", "Cover", "Tornante"],
    ["Controller", "Cover", "False Winger"],
    ["Sprinter", "Engine", "Shuttler"],
  ],
  AM: [
    ["Dribbler", "Creator", "Trequartista"],
    ["Engine", "Striker", "Seconda Punta"],
    ["Controller", "Creator", "Enganche"],
    ["Sprinter", "Striker", "Boxcrasher"],
  ],
  WF: [
    ["Dribbler", "Sprinter", "Inside Forward"],
    ["Engine", "Striker", "Raumdeuter"],
    ["Creator", "Dribbler", "Inventor"],
    ["Sprinter", "Striker", "Extremo"],
  ],
  CF: [
    ["Striker", "Dribbler", "Poacher"],
    ["Engine", "Destroyer", "Spearhead"],
    ["Creator", "Controller", "Falso Nove"],
    ["Target", "Powerhouse", "Prima Punta"],
  ],
};

describe("Role Definitions — Pipeline ↔ UI Sync", () => {
  const allPositions = Object.keys(PIPELINE_TACTICAL_ROLES);

  it("covers all 9 positions", () => {
    expect(allPositions).toEqual(
      expect.arrayContaining(["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"])
    );
  });

  it("every position has exactly 4 roles", () => {
    for (const pos of allPositions) {
      expect(PIPELINE_TACTICAL_ROLES[pos].length).toBe(4);
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

  it("finds Seconda Punta in AM", () => {
    const am = getRoleDefinition("Seconda Punta", "AM");
    expect(am).not.toBeNull();
    expect(am!.position).toBe("AM");
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
