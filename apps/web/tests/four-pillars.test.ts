/**
 * Four-Pillar Assessment System — Comprehensive Tests
 *
 * Validates: computeTechnical, computeTactical, computeMental, computePhysical,
 * computeAvailability, ageCurveScore, computeCommercialModifier, computeOverall.
 */
import { describe, it, expect } from "vitest";
import {
  computeTechnical,
  computeTactical,
  computeMental,
  computePhysical,
  computeAvailability,
  ageCurveScore,
  computeCommercialModifier,
  computeOverall,
  POSITION_WEIGHTS,
  type PhysicalInput,
} from "@/lib/assessment/four-pillars";

// ── PILLAR 1: TECHNICAL ─────────────────────────────────────────────────────

describe("computeTechnical", () => {
  // Happy path
  it("returns weighted average of model scores for CF", () => {
    // CF weights: Striker 1.0, Target 0.7, Sprinter 0.6, Powerhouse 0.5, Dribbler 0.4, Creator 0.3
    const models = { Striker: 90, Target: 70, Sprinter: 80, Powerhouse: 60, Dribbler: 50, Creator: 40 };
    const result = computeTechnical(models, "CF", 85, 0.8, ["fbref"]);
    // Weighted: (90*1 + 70*0.7 + 80*0.6 + 60*0.5 + 50*0.4 + 40*0.3) / (1+0.7+0.6+0.5+0.4+0.3)
    // = (90 + 49 + 48 + 30 + 20 + 12) / 3.5 = 249/3.5 = 71.14
    expect(result.score).toBe(71);
    expect(result.sources).toEqual(["fbref"]);
  });

  it("returns weighted average for GK position", () => {
    const models = { GK: 85, Cover: 60, Commander: 50, Controller: 40 };
    const result = computeTechnical(models, "GK", 80, 0.8, ["fbref"]);
    // (85*1 + 60*0.6 + 50*0.5 + 40*0.3) / (1+0.6+0.5+0.3) = (85+36+25+12)/2.4 = 158/2.4 = 65.8
    expect(result.score).toBe(66);
  });

  it("only uses models relevant to the position", () => {
    // Give high Striker score but test CD position — Striker not in CD weights
    const models = { Striker: 100, Destroyer: 40, Cover: 30 };
    const result = computeTechnical(models, "CD", 80, 0.5, []);
    // CD: Destroyer 1.0, Cover 0.9 — only these two contribute
    // (40*1 + 30*0.9) / (1+0.9) = 67/1.9 = 35.3
    expect(result.score).toBe(35);
  });

  // Edge cases
  it("falls back to level when no model data available", () => {
    const result = computeTechnical({}, "CF", 82, 0.3, []);
    expect(result.score).toBe(82);
  });

  it("falls back to CM weights for unknown position", () => {
    const models = { Controller: 80, Passer: 70 };
    const result = computeTechnical(models, "XX" as string, null, 0.3, []);
    // Uses CM: Controller 1.0, Passer 0.9
    expect(result.score).toBeGreaterThan(0);
  });

  it("clamps score to 0-100 range", () => {
    const models = { Striker: 150 }; // artificially high
    const result = computeTechnical(models, "CF", null, 1, []);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 when no models and no level", () => {
    const result = computeTechnical({}, "CF", null, 0.3, []);
    expect(result.score).toBe(0);
  });
});

// ── PILLAR 2: TACTICAL ──────────────────────────────────────────────────────

describe("computeTactical", () => {
  // Happy path
  it("returns reasonable score for a well-profiled player", () => {
    const player = { level: 90, archetype: "Striker", personality_type: "ANSC", position: "CF" };
    const result = computeTactical(player);
    expect(result.score).toBeGreaterThan(20);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.bestRole).not.toBeNull();
    expect(result.viableRoleCount).toBeGreaterThan(0);
  });

  it("includes trait score in calculation when provided", () => {
    const player = { level: 85, archetype: "Creator", personality_type: "INSP", position: "AM" };
    const withoutTraits = computeTactical(player, undefined);
    const withHighTraits = computeTactical(player, 90);
    const withLowTraits = computeTactical(player, 10);
    // Traits are 30% weight, so high traits should push score up
    expect(withHighTraits.score).toBeGreaterThan(withLowTraits.score);
    // Without traits defaults to 50
    expect(withoutTraits.traitProfile).toBe(50);
  });

  it("flexibility differentiates between versatile and specialist", () => {
    const versatile = { level: 90, archetype: "Engine", personality_type: "ANSC", position: "CM" };
    const specialist = { level: 70, archetype: "GK", personality_type: "ANSC", position: "GK" };
    const vResult = computeTactical(versatile);
    const sResult = computeTactical(specialist);
    expect(vResult.flexibility).toBeGreaterThanOrEqual(sResult.flexibility);
    // With 55% threshold, a GK should have very few viable roles
    expect(sResult.viableRoleCount).toBeLessThan(vResult.viableRoleCount);
  });

  // Edge cases
  it("handles null archetype gracefully", () => {
    const player = { level: 75, archetype: null, personality_type: null, position: "CM" };
    const result = computeTactical(player);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles null level gracefully", () => {
    const player = { level: null, archetype: "Striker", personality_type: "ANSC", position: "CF" };
    const result = computeTactical(player);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ── PILLAR 3: MENTAL ────────────────────────────────────────────────────────

describe("computeMental", () => {
  // Happy path
  it("gives high score for matching personality-role alignment", () => {
    // Need to find a role that lists ANSC as personality[0]
    // Let's test the general structure
    const result = computeMental("ANSC", 8, 7, "sharp", "Box-to-Box");
    expect(result.score).toBeGreaterThan(50);
    expect(result.mentalStrength).toBe(75); // (80 + 70) / 2
    expect(result.mentalStability).toBe(100); // "sharp"
  });

  it("computes mental strength from competitiveness and coachability", () => {
    const result = computeMental("ANSC", 10, 10, "steady", null);
    expect(result.mentalStrength).toBe(100); // (100 + 100) / 2
  });

  it("uses single comp or coach when one is null", () => {
    const compOnly = computeMental("ANSC", 8, null, null, null);
    expect(compOnly.mentalStrength).toBe(80); // 8 * 10

    const coachOnly = computeMental("ANSC", null, 6, null, null);
    expect(coachOnly.mentalStrength).toBe(60); // 6 * 10
  });

  it("falls back to MBTI scores when comp/coach missing", () => {
    const result = computeMental("ANSC", null, null, "focused", null, { tf: 70, jp: 80 });
    expect(result.mentalStrength).toBe(75); // (70 + 80) / 2
    expect(result.mentalStability).toBe(70); // "focused"
  });

  // Edge cases
  it("returns 50 defaults for completely unknown player", () => {
    const result = computeMental(null, null, null, null, null);
    expect(result.personalityRoleAlignment).toBe(50);
    expect(result.mentalStrength).toBe(50);
    expect(result.mentalStability).toBe(50);
    expect(result.score).toBe(50);
  });

  it("handles unknown mental_tag", () => {
    const result = computeMental("ANSC", 5, 5, "something_weird", null);
    expect(result.mentalStability).toBe(50); // fallback
  });

  // Error states
  it("clamps extreme competitiveness/coachability", () => {
    const result = computeMental(null, 15, 15, null, null);
    expect(result.mentalStrength).toBeLessThanOrEqual(100);
  });
});

// ── PILLAR 4: PHYSICAL ──────────────────────────────────────────────────────

describe("computePhysical", () => {
  const baseInput: PhysicalInput = {
    position: "CF",
    age: 27,
    availabilityScore: 70,
    sprinterScore: 75,
    powerhouseScore: 65,
    fitnessTag: "fully fit",
    durabilitySeverity: 7,
    duelWinRate: 0.55,
    heightCm: 185,
  };

  // Happy path
  it("computes all 5 components with full data", () => {
    const result = computePhysical(baseInput);

    // Athleticism: (75 + 65) / 2 = 70
    expect(result.athleticism).toBe(70);

    // Availability: 70 (passed directly)
    expect(result.availability).toBe(70);

    // Durability: fitness="fully fit"=75, trait=7*10=70 → (75*0.5 + 70*0.5) = 72.5 → 73
    expect(result.durability).toBe(73);

    // Age curve: CF peak [25,31], age=27 → 100 (in peak)
    expect(result.ageCurve).toBe(100);

    // Dominance: duelWin=0.55*100=55, height CF ideal [178,190] → 80 → avg = (55+80)/2 = 67.5 → 68
    expect(result.dominance).toBe(68);

    // Overall: 70*0.30 + 70*0.25 + 73*0.20 + 100*0.15 + 68*0.10
    // = 21 + 17.5 + 14.6 + 15 + 6.8 = 74.9 → 75
    expect(result.score).toBe(75);
    expect(result.age).toBe(27);
  });

  it("handles young player with pre-peak age curve", () => {
    const result = computePhysical({ ...baseInput, age: 20, position: "CF" });
    // CF peak starts at 25, so 5 years before: 100 - 5*8 = 60
    expect(result.ageCurve).toBe(60);
  });

  it("handles veteran past peak", () => {
    const result = computePhysical({ ...baseInput, age: 35, position: "CF" });
    // CF peak ends at 31, so 4 years past: 100 - 4*10 = 60
    expect(result.ageCurve).toBe(60);
  });

  it("gives higher age score to GK at 32 (within peak)", () => {
    const result = computePhysical({ ...baseInput, age: 32, position: "GK" });
    // GK peak: [27, 34], age 32 → 100
    expect(result.ageCurve).toBe(100);
  });

  // Edge cases: all nulls
  it("returns defaults (50) for completely unknown player", () => {
    const result = computePhysical({
      position: null, age: null, availabilityScore: null,
      sprinterScore: null, powerhouseScore: null,
      fitnessTag: null, durabilitySeverity: null,
      duelWinRate: null, heightCm: null,
    });
    expect(result.athleticism).toBe(50);
    expect(result.availability).toBe(50);
    expect(result.durability).toBe(50);
    expect(result.ageCurve).toBe(50); // null age
    expect(result.dominance).toBe(50);
    expect(result.score).toBe(50);
  });

  it("uses only sprinter when powerhouse is null", () => {
    const result = computePhysical({ ...baseInput, powerhouseScore: null });
    expect(result.athleticism).toBe(75); // just sprinterScore
  });

  it("iron man fitness tag gives near-max durability", () => {
    const result = computePhysical({ ...baseInput, fitnessTag: "iron man", durabilitySeverity: null });
    expect(result.durability).toBe(95);
  });

  it("injury prone fitness tag gives low durability", () => {
    const result = computePhysical({ ...baseInput, fitnessTag: "injury prone", durabilitySeverity: null });
    expect(result.durability).toBe(15);
  });

  // Height edge cases
  it("penalizes very tall winger", () => {
    const result = computePhysical({ ...baseInput, position: "WF", heightCm: 198 });
    // WF ideal: [170, 183], 198 is 15cm over → 80 - 15*4 = 20
    expect(result.dominance).toBeLessThan(50);
  });

  it("penalizes very short GK", () => {
    const result = computePhysical({ ...baseInput, position: "GK", heightCm: 170 });
    // GK ideal: [188, 196], 170 is 18cm under → 80 - 18*4 = 8 → clamped to 20
    // Dominance = avg of duel + height
    expect(result.dominance).toBeLessThan(50);
  });
});

// ── ageCurveScore ───────────────────────────────────────────────────────────

describe("ageCurveScore", () => {
  it("returns 100 at peak for all positions", () => {
    const cases: [string, number][] = [
      ["GK", 30], ["CD", 29], ["WD", 27], ["DM", 29],
      ["CM", 28], ["WM", 26], ["AM", 27], ["WF", 26], ["CF", 28],
    ];
    for (const [pos, age] of cases) {
      expect(ageCurveScore(pos, age)).toBe(100);
    }
  });

  it("returns 50 for null age", () => {
    expect(ageCurveScore("CF", null)).toBe(50);
  });

  it("never goes below 20", () => {
    expect(ageCurveScore("WF", 40)).toBe(20); // way past peak
    expect(ageCurveScore("WF", 14)).toBe(20); // way before peak
  });
});

// ── computeAvailability ─────────────────────────────────────────────────────

describe("computeAvailability", () => {
  it("returns 50 for empty seasons", () => {
    expect(computeAvailability([])).toBe(50);
  });

  it("returns ~100 for full season minutes", () => {
    const seasons = [{ minutes: 3420, matches_played: 38 }];
    expect(computeAvailability(seasons)).toBe(100);
  });

  it("weights recent seasons more", () => {
    // Recent season bad, older seasons good
    const badRecent = [
      { minutes: 100, matches_played: 3 },
      { minutes: 3400, matches_played: 38 },
      { minutes: 3400, matches_played: 38 },
    ];
    // Recent season good, older seasons bad
    const goodRecent = [
      { minutes: 3400, matches_played: 38 },
      { minutes: 100, matches_played: 3 },
      { minutes: 100, matches_played: 3 },
    ];
    // goodRecent: 99.4*0.5 + 2.9*0.3 + 2.9*0.2 ≈ 51.1
    // badRecent:  2.9*0.5 + 99.4*0.3 + 99.4*0.2 ≈ 51.2 — still similar!
    // The weighting works directionally but the total minutes dominate.
    // Use 2 seasons instead (50%/30% only) to see the effect.
    const good2 = [
      { minutes: 3400, matches_played: 38 },
      { minutes: 100, matches_played: 3 },
    ];
    const bad2 = [
      { minutes: 100, matches_played: 3 },
      { minutes: 3400, matches_played: 38 },
    ];
    // good2: 99.4*0.5 + 2.9*0.3 = 50.6 → weighted/0.8 = 63.2
    // bad2: 2.9*0.5 + 99.4*0.3 = 31.3 → weighted/0.8 = 39.1
    expect(computeAvailability(good2)).toBeGreaterThan(computeAvailability(bad2));
  });

  it("handles null minutes gracefully", () => {
    const seasons = [{ minutes: null, matches_played: null }];
    const result = computeAvailability(seasons);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

// ── computeCommercialModifier ───────────────────────────────────────────────

describe("computeCommercialModifier", () => {
  it("returns 1.0 baseline with no modifiers", () => {
    const result = computeCommercialModifier(null, null, null, null);
    expect(result.multiplier).toBe(1.0);
  });

  it("boosts for expiring contract", () => {
    const result = computeCommercialModifier(null, null, 3, null);
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it("boosts for rising trajectory", () => {
    const result = computeCommercialModifier(null, null, null, "rising");
    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.trajectoryBonus).toBe(0.15);
  });

  it("penalizes declining trajectory", () => {
    const result = computeCommercialModifier(null, null, null, "declining");
    expect(result.multiplier).toBeLessThan(1.0);
    expect(result.trajectoryBonus).toBe(-0.15);
  });

  it("clamps between 0.7 and 1.5", () => {
    // Everything maximally positive
    const max = computeCommercialModifier(20, 20, 3, "rising");
    expect(max.multiplier).toBeLessThanOrEqual(1.5);

    // Everything maximally negative
    const min = computeCommercialModifier(0, 0, 48, "declining");
    expect(min.multiplier).toBeGreaterThanOrEqual(0.7);
  });
});

// ── computeOverall ──────────────────────────────────────────────────────────

describe("computeOverall", () => {
  it("averages all four pillars equally", () => {
    const result = computeOverall({ technical: 80, tactical: 60, mental: 70, physical: 90 });
    expect(result.overall).toBe(75);
  });

  it("sets confidence high when all pillars have data", () => {
    const result = computeOverall({ technical: 50, tactical: 50, mental: 50, physical: 50 });
    expect(result.confidence).toBe("high");
  });

  it("sets confidence low when most pillars are 0", () => {
    const result = computeOverall({ technical: 0, tactical: 0, mental: 0, physical: 50 });
    expect(result.confidence).toBe("low");
  });

  it("sets confidence medium when 3 pillars have data", () => {
    const result = computeOverall({ technical: 60, tactical: 70, mental: 50, physical: 0 });
    expect(result.confidence).toBe("medium");
  });
});

// ── POSITION_WEIGHTS sanity ─────────────────────────────────────────────────

describe("POSITION_WEIGHTS", () => {
  it("has weights for all 9 positions", () => {
    const expected = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];
    for (const pos of expected) {
      expect(POSITION_WEIGHTS[pos]).toBeDefined();
      expect(Object.keys(POSITION_WEIGHTS[pos]).length).toBeGreaterThan(0);
    }
  });

  it("GK position has GK model as highest weight", () => {
    const gkWeights = POSITION_WEIGHTS.GK;
    const maxModel = Object.entries(gkWeights).sort(([,a], [,b]) => b - a)[0];
    expect(maxModel[0]).toBe("GK");
  });

  it("CF position has Striker model as highest weight", () => {
    const cfWeights = POSITION_WEIGHTS.CF;
    const maxModel = Object.entries(cfWeights).sort(([,a], [,b]) => b - a)[0];
    expect(maxModel[0]).toBe("Striker");
  });
});
