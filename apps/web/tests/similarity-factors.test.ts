import { describe, it, expect } from "vitest";
import {
  roleMatch, roleScoreProximity, archetypeAlignment, pillarShape,
  traitOverlap, physicalProfile, personalityMatch, gradeProfile,
  qualityBand, clubDiversity,
} from "@/lib/similarity/factors";

describe("roleMatch", () => {
  it("returns 1.0 for exact role match", () => {
    expect(roleMatch("Inside Forward", "WF", "Inside Forward", "WF")).toBe(1.0);
  });
  it("returns 0.5 for same position different role", () => {
    expect(roleMatch("Inside Forward", "WF", "Winger", "WF")).toBe(0.5);
  });
  it("returns 0.25 for adjacent position role", () => {
    expect(roleMatch("Inside Forward", "WF", "Mezzala", "AM")).toBe(0.25);
  });
  it("returns 0.0 for no match", () => {
    expect(roleMatch("Inside Forward", "WF", "Anchor", "DM")).toBe(0.0);
  });
  it("returns 0.0 when either role is null", () => {
    expect(roleMatch(null, "WF", "Inside Forward", "WF")).toBe(0.0);
  });
});

describe("roleScoreProximity", () => {
  it("returns 1.0 for identical scores", () => {
    expect(roleScoreProximity(85, 85)).toBe(1.0);
  });
  it("returns 0.5 for 15-point gap", () => {
    expect(roleScoreProximity(85, 70)).toBeCloseTo(0.5, 1);
  });
  it("returns 0 for 30+ gap", () => {
    expect(roleScoreProximity(90, 50)).toBe(0);
  });
  it("returns 0.5 when either is null", () => {
    expect(roleScoreProximity(null, 85)).toBe(0.5);
  });
});

describe("archetypeAlignment", () => {
  it("returns 1.0 for exact earned archetype match", () => {
    expect(archetypeAlignment("Marksman", "Striker-Sprinter", "Marksman", "Striker-Sprinter")).toBe(1.0);
  });
  it("returns 0.7 for primary model match, no earned match", () => {
    expect(archetypeAlignment(null, "Striker-Sprinter", null, "Striker-Creator")).toBe(0.7);
  });
  it("returns 0.4 for cross-match (src primary = target secondary)", () => {
    expect(archetypeAlignment(null, "Striker-Creator", null, "Dribbler-Striker")).toBe(0.4);
  });
  it("returns 0.3 for secondary model match only", () => {
    expect(archetypeAlignment(null, "Dribbler-Creator", null, "Passer-Creator")).toBe(0.3);
  });
  it("returns 0.0 for no overlap", () => {
    expect(archetypeAlignment(null, "Striker-Sprinter", null, "Cover-Commander")).toBe(0.0);
  });
  it("returns 0.0 when archetype is null", () => {
    expect(archetypeAlignment(null, null, null, "Striker-Sprinter")).toBe(0.0);
  });
});

describe("pillarShape", () => {
  it("returns 1.0 for identical proportions", () => {
    expect(pillarShape([80, 60, 70, 50], [40, 30, 35, 25])).toBeCloseTo(1.0, 2);
  });
  it("returns < 1.0 for different shapes", () => {
    const score = pillarShape([80, 40, 40, 80], [40, 80, 80, 40]);
    expect(score).toBeLessThan(0.9);
  });
  it("returns 0.5 when < 2 pillars available", () => {
    expect(pillarShape([80, null, null, null], [40, 30, 35, 25])).toBe(0.5);
  });
});

describe("traitOverlap", () => {
  it("returns 1.0 for identical traits", () => {
    expect(traitOverlap(["Ball Progressor", "Clinical Finisher"], ["Ball Progressor", "Clinical Finisher"])).toBe(1.0);
  });
  it("returns 1/3 for Jaccard of 1 shared out of 3 unique", () => {
    // Jaccard: intersection=1, union=3 → 0.333
    expect(traitOverlap(["Ball Progressor", "Clinical Finisher"], ["Ball Progressor", "Set Piece Threat"])).toBeCloseTo(0.333, 1);
  });
  it("returns 0.0 when either has no traits", () => {
    expect(traitOverlap([], ["Ball Progressor"])).toBe(0.0);
  });
});

describe("physicalProfile", () => {
  it("returns 1.0 for identical physical profile", () => {
    expect(physicalProfile(183, "Right", "R", 183, "Right", "R")).toBe(1.0);
  });
  it("returns ~0.57 for different height band and side", () => {
    const score = physicalProfile(183, "Right", "R", 175, "Right", "L");
    expect(score).toBeCloseTo(0.57, 1);
  });
  it("returns 0.5 when all null", () => {
    expect(physicalProfile(null, null, null, null, null, null)).toBe(0.5);
  });
});

describe("personalityMatch", () => {
  it("returns 1.0 for exact match", () => {
    expect(personalityMatch("ESTJ", "ESTJ")).toBe(1.0);
  });
  it("returns 0.7 for 3/4 match", () => {
    expect(personalityMatch("ESTJ", "ESTP")).toBe(0.7);
  });
  it("returns 0.3 for 2/4 match", () => {
    expect(personalityMatch("ESTJ", "ENFJ")).toBe(0.3);
  });
  it("returns 0.1 for 1/4 match", () => {
    // E matches, S≠N, T≠F, J≠P → 1/4
    expect(personalityMatch("ESTJ", "ENFP")).toBe(0.1);
  });
  it("returns 0.0 for 0/4 match", () => {
    expect(personalityMatch("ESTJ", "INFP")).toBe(0.0);
  });
  it("returns 0.0 when either is null", () => {
    expect(personalityMatch(null, "ESTJ")).toBe(0.0);
  });
});

describe("gradeProfile", () => {
  it("returns high score for similar grade distributions", () => {
    const a = { finishing: 85, composure: 80, dribbling: 75, pace: 70 };
    const b = { finishing: 82, composure: 78, dribbling: 72, pace: 68 };
    expect(gradeProfile(a, b)).toBeGreaterThan(0.95);
  });
  it("returns 0.5 for < 4 shared attributes", () => {
    const a = { finishing: 85, composure: 80 };
    const b = { tackling: 70, marking: 75 };
    expect(gradeProfile(a, b)).toBe(0.5);
  });
  it("returns 0.5 when either is empty", () => {
    expect(gradeProfile({}, { finishing: 85 })).toBe(0.5);
  });
});

describe("qualityBand", () => {
  it("returns 1.0 for identical levels", () => {
    expect(qualityBand(88, 88)).toBe(1.0);
  });
  it("handles legend peak vs active level", () => {
    expect(qualityBand(92, 88)).toBeCloseTo(0.73, 1);
  });
  it("returns 0.5 when either is null", () => {
    expect(qualityBand(null, 88)).toBe(0.5);
  });
});

describe("clubDiversity", () => {
  it("returns 1.0 for different clubs", () => {
    expect(clubDiversity(1, 2)).toBe(1.0);
  });
  it("returns 0.0 for same club", () => {
    expect(clubDiversity(1, 1)).toBe(0.0);
  });
  it("returns 1.0 when either is null", () => {
    expect(clubDiversity(null, 1)).toBe(1.0);
  });
});
