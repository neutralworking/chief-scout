# Unified Similarity Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three separate player comparison algorithms with a unified 10-factor scoring engine supporting two lenses: Closest Match and Potential Replacement.

**Architecture:** A `lib/similarity/` module contains the scoring engine (10 factor functions + 2 weight sets), consumed by a single API endpoint that replaces the existing `similar/route.ts`. The legend backfill pipeline enriches legends with pillar scores and traits so they score on par with active players.

**Tech Stack:** TypeScript (Next.js), Vitest, Supabase (player_intelligence_card view, attribute_grades, player_trait_scores tables), Python (pipeline script)

**Spec:** `docs/superpowers/specs/2026-03-28-unified-similarity-engine-design.md`

---

### Task 1: Types and constants (`lib/similarity/types.ts`)

**Files:**
- Create: `apps/web/src/lib/similarity/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// apps/web/src/lib/similarity/types.ts

export type Lens = "match" | "replacement";

export interface SimilarityFactors {
  role_match: number;
  role_score_proximity: number;
  archetype_alignment: number;
  pillar_shape: number;
  trait_overlap: number;
  physical_profile: number;
  personality_match: number;
  grade_profile: number;
  quality_band: number;
  club_diversity: number;
}

export type FactorName = keyof SimilarityFactors;

export const FACTOR_NAMES: FactorName[] = [
  "role_match",
  "role_score_proximity",
  "archetype_alignment",
  "pillar_shape",
  "trait_overlap",
  "physical_profile",
  "personality_match",
  "grade_profile",
  "quality_band",
  "club_diversity",
];

export interface SimilarityResult {
  player: PlayerCandidate;
  similarity: number;
  confidence: "strong" | "partial" | "indicative";
  populated_factors: number;
  factors: SimilarityFactors;
  match_reasons: string[];
}

export interface PlayerCandidate {
  person_id: number;
  name: string;
  position: string | null;
  level: number | null;
  peak: number | null;
  archetype: string | null;
  earned_archetype: string | null;
  best_role: string | null;
  best_role_score: number | null;
  technical_score: number | null;
  tactical_score: number | null;
  mental_score: number | null;
  physical_score: number | null;
  personality_type: string | null;
  preferred_foot: string | null;
  side: string | null;
  height_cm: number | null;
  club: string | null;
  club_id: number | null;
  nation: string | null;
  image_url: string | null;
  overall: number | null;
  active: boolean;
}

export const MATCH_WEIGHTS: Record<FactorName, number> = {
  role_match: 10,
  role_score_proximity: 5,
  archetype_alignment: 20,
  pillar_shape: 15,
  trait_overlap: 15,
  physical_profile: 10,
  personality_match: 10,
  grade_profile: 10,
  quality_band: 0,
  club_diversity: 5,
};

export const REPLACEMENT_WEIGHTS: Record<FactorName, number> = {
  role_match: 25,
  role_score_proximity: 15,
  archetype_alignment: 10,
  pillar_shape: 10,
  trait_overlap: 5,
  physical_profile: 15,
  personality_match: 0,
  grade_profile: 10,
  quality_band: 5,
  club_diversity: 5,
};

export const ADJACENT_POSITIONS: Record<string, string[]> = {
  GK: ["GK"],
  WD: ["WD", "WM"],
  CD: ["CD", "DM"],
  DM: ["DM", "CM", "CD"],
  CM: ["CM", "DM", "AM"],
  WM: ["WM", "WD", "WF"],
  AM: ["AM", "CM", "WF", "CF"],
  WF: ["WF", "WM", "AM", "CF"],
  CF: ["CF", "AM", "WF"],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/similarity/types.ts
git commit -m "feat(similarity): types, weights, and constants"
```

---

### Task 2: Factor scoring functions (`lib/similarity/factors.ts`)

**Files:**
- Create: `apps/web/src/lib/similarity/factors.ts`
- Create: `apps/web/tests/similarity-factors.test.ts`

- [ ] **Step 1: Write tests for all 10 factor functions**

```typescript
// apps/web/tests/similarity-factors.test.ts
import { describe, it, expect } from "vitest";
import {
  roleMatch,
  roleScoreProximity,
  archetypeAlignment,
  pillarShape,
  traitOverlap,
  physicalProfile,
  personalityMatch,
  gradeProfile,
  qualityBand,
  clubDiversity,
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

  it("returns 0.5 for 50% overlap", () => {
    expect(traitOverlap(["Ball Progressor", "Clinical Finisher"], ["Ball Progressor", "Set Piece Threat"])).toBeCloseTo(0.5, 1);
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
    expect(personalityMatch("ESTJ", "INFP")).toBe(0.1);
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
    // Legend peak 92 vs active level 88 → diff 4/15 = 0.73
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run tests/similarity-factors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement all 10 factor functions**

```typescript
// apps/web/src/lib/similarity/factors.ts

import { ADJACENT_POSITIONS } from "./types";

/**
 * Factor 1: Role Match
 * Exact role = 1.0, same position different role = 0.5,
 * adjacent position = 0.25, else 0.0
 */
export function roleMatch(
  srcRole: string | null, srcPos: string | null,
  tgtRole: string | null, tgtPos: string | null,
): number {
  if (!srcRole || !tgtRole || !srcPos || !tgtPos) return 0.0;
  if (srcRole === tgtRole) return 1.0;
  if (srcPos === tgtPos) return 0.5;
  const adj = ADJACENT_POSITIONS[srcPos] ?? [];
  if (adj.includes(tgtPos)) return 0.25;
  return 0.0;
}

/**
 * Factor 2: Role Score Proximity
 * 1.0 - |diff|/30, floored at 0. Null → 0.5.
 */
export function roleScoreProximity(
  srcScore: number | null, tgtScore: number | null,
): number {
  if (srcScore == null || tgtScore == null) return 0.5;
  return Math.max(0, 1.0 - Math.abs(srcScore - tgtScore) / 30);
}

/**
 * Factor 3: Archetype Alignment
 * Derives primary/secondary from compound archetype string (e.g. "Engine-Destroyer").
 * Earned archetype exact = 1.0, primary = 0.7, cross = 0.4, secondary = 0.3.
 */
export function archetypeAlignment(
  srcEarned: string | null, srcArchetype: string | null,
  tgtEarned: string | null, tgtArchetype: string | null,
): number {
  // Earned archetype exact match is the strongest signal
  if (srcEarned && tgtEarned && srcEarned === tgtEarned) return 1.0;

  // Parse compound archetypes
  const srcParts = srcArchetype?.split("-") ?? [];
  const tgtParts = tgtArchetype?.split("-") ?? [];
  const srcPrimary = srcParts[0] ?? "";
  const srcSecondary = srcParts[1] ?? "";
  const tgtPrimary = tgtParts[0] ?? "";
  const tgtSecondary = tgtParts[1] ?? "";

  if (!srcPrimary && !tgtPrimary) return 0.0;

  // Primary model match
  if (srcPrimary && tgtPrimary && srcPrimary === tgtPrimary) return 0.7;

  // Cross-match: source primary = target secondary (or vice versa)
  if (srcPrimary && tgtSecondary && srcPrimary === tgtSecondary) return 0.4;
  if (srcSecondary && tgtPrimary && srcSecondary === tgtPrimary) return 0.4;

  // Secondary model match
  if (srcSecondary && tgtSecondary && srcSecondary === tgtSecondary) return 0.3;

  return 0.0;
}

/**
 * Factor 4: Pillar Shape
 * Proportion-normalized cosine similarity of [tech, tac, men, phy].
 * Normalizes each vector to sum to 1 first, so it captures relative strengths.
 */
export function pillarShape(
  src: (number | null)[], tgt: (number | null)[],
): number {
  // Collect paired non-null values
  const pairs: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    if (src[i] != null && tgt[i] != null) {
      pairs.push([src[i]!, tgt[i]!]);
    }
  }
  if (pairs.length < 2) return 0.5;

  // Normalize to proportions
  const sumA = pairs.reduce((s, [a]) => s + a, 0);
  const sumB = pairs.reduce((s, [, b]) => s + b, 0);
  if (sumA === 0 || sumB === 0) return 0.5;

  const aNorm = pairs.map(([a]) => a / sumA);
  const bNorm = pairs.map(([, b]) => b / sumB);

  // Cosine similarity
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < aNorm.length; i++) {
    dot += aNorm[i] * bNorm[i];
    magA += aNorm[i] * aNorm[i];
    magB += bNorm[i] * bNorm[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0.5;

  return dot / (magA * magB);
}

/**
 * Factor 5: Trait Overlap
 * Jaccard index of trait sets. Empty → 0.0.
 */
export function traitOverlap(srcTraits: string[], tgtTraits: string[]): number {
  if (srcTraits.length === 0 || tgtTraits.length === 0) return 0.0;
  const srcSet = new Set(srcTraits);
  const tgtSet = new Set(tgtTraits);
  let intersection = 0;
  for (const t of srcSet) {
    if (tgtSet.has(t)) intersection++;
  }
  const union = new Set([...srcSet, ...tgtSet]).size;
  return union === 0 ? 0.0 : intersection / union;
}

/**
 * Factor 6: Physical Profile
 * Average of height band, foot, and side sub-scores.
 * Only scores populated sub-components.
 */
export function physicalProfile(
  srcHeight: number | null, srcFoot: string | null, srcSide: string | null,
  tgtHeight: number | null, tgtFoot: string | null, tgtSide: string | null,
): number {
  const scores: number[] = [];

  // Height band
  if (srcHeight != null && tgtHeight != null) {
    const diff = Math.abs(srcHeight - tgtHeight);
    if (diff <= 3) scores.push(1.0);
    else if (diff <= 6) scores.push(0.7);
    else if (diff <= 10) scores.push(0.4);
    else scores.push(0.0);
  }

  // Foot match
  if (srcFoot && tgtFoot) {
    scores.push(srcFoot === tgtFoot ? 1.0 : 0.0);
  }

  // Side match
  if (srcSide != null && tgtSide != null) {
    if (srcSide === tgtSide) scores.push(1.0);
    else if ((srcSide === "C" || !srcSide) && (tgtSide === "C" || !tgtSide)) scores.push(0.5);
    else scores.push(0.0);
  }

  if (scores.length === 0) return 0.5;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

/**
 * Factor 7: Personality Match
 * Graduated: 4/4=1.0, 3/4=0.7, 2/4=0.3, 1/4=0.1, 0/4=0.0.
 */
export function personalityMatch(
  src: string | null, tgt: string | null,
): number {
  if (!src || !tgt || src.length !== 4 || tgt.length !== 4) return 0.0;
  let matches = 0;
  for (let i = 0; i < 4; i++) {
    if (src[i] === tgt[i]) matches++;
  }
  return [0.0, 0.1, 0.3, 0.7, 1.0][matches];
}

/**
 * Factor 8: Grade Profile
 * Cosine similarity of grade vectors aligned by shared attribute names.
 * If < 4 shared attributes, returns 0.5.
 */
export function gradeProfile(
  srcGrades: Record<string, number>,
  tgtGrades: Record<string, number>,
): number {
  const shared = Object.keys(srcGrades).filter((k) => k in tgtGrades);
  if (shared.length < 4) return 0.5;

  const a = shared.map((k) => srcGrades[k]);
  const b = shared.map((k) => tgtGrades[k]);

  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0.5;

  return dot / (magA * magB);
}

/**
 * Factor 9: Quality Band
 * Uses level for active, peak for legends.
 * 1.0 - |diff|/15, floored at 0.
 */
export function qualityBand(
  srcLevelOrPeak: number | null,
  tgtLevelOrPeak: number | null,
): number {
  // Callers pass level for active players, peak for legends
  if (srcLevelOrPeak == null || tgtLevelOrPeak == null) return 0.5;
  return Math.max(0, 1.0 - Math.abs(srcLevelOrPeak - tgtLevelOrPeak) / 15);
}

/**
 * Factor 10: Club Diversity
 * Different club = 1.0, same = 0.0.
 */
export function clubDiversity(
  srcClubId: number | null, tgtClubId: number | null,
): number {
  if (srcClubId == null || tgtClubId == null) return 1.0;
  return srcClubId === tgtClubId ? 0.0 : 1.0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run tests/similarity-factors.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/similarity/factors.ts apps/web/tests/similarity-factors.test.ts
git commit -m "feat(similarity): 10 factor scoring functions with tests"
```

---

### Task 3: Scoring engine and match reasons (`lib/similarity/engine.ts`)

**Files:**
- Create: `apps/web/src/lib/similarity/engine.ts`
- Create: `apps/web/tests/similarity-engine.test.ts`

- [ ] **Step 1: Write tests for the engine**

```typescript
// apps/web/tests/similarity-engine.test.ts
import { describe, it, expect } from "vitest";
import { scoreSimilarity, generateMatchReasons, getConfidence } from "@/lib/similarity/engine";
import type { PlayerCandidate } from "@/lib/similarity/types";

const makePlayers = (overrides: Partial<PlayerCandidate>[] = []): [PlayerCandidate, PlayerCandidate] => {
  const base: PlayerCandidate = {
    person_id: 1, name: "Player A", position: "WF", level: 85, peak: null,
    archetype: "Striker-Sprinter", earned_archetype: "Marksman",
    best_role: "Inside Forward", best_role_score: 85,
    technical_score: 75, tactical_score: 60, mental_score: 65, physical_score: 80,
    personality_type: "ESTJ", preferred_foot: "Right", side: "R",
    height_cm: 180, club: "Arsenal", club_id: 1, nation: "England",
    image_url: null, overall: 84, active: true,
  };
  return [
    { ...base, ...(overrides[0] ?? {}) },
    { ...base, person_id: 2, name: "Player B", club: "Chelsea", club_id: 2, ...(overrides[1] ?? {}) },
  ];
};

describe("scoreSimilarity", () => {
  it("returns high score for near-identical players with match lens", () => {
    const [src, tgt] = makePlayers();
    const result = scoreSimilarity(src, tgt, [], [], {}, {}, "match");
    expect(result.similarity).toBeGreaterThan(85);
  });

  it("returns different scores for different lenses", () => {
    const [src, tgt] = makePlayers([{}, { best_role: "Winger", archetype: "Dribbler-Sprinter" }]);
    const matchResult = scoreSimilarity(src, tgt, [], [], {}, {}, "match");
    const replResult = scoreSimilarity(src, tgt, [], [], {}, {}, "replacement");
    expect(matchResult.similarity).not.toBe(replResult.similarity);
  });

  it("factors are all between 0 and 1", () => {
    const [src, tgt] = makePlayers();
    const result = scoreSimilarity(src, tgt, ["Clinical Finisher"], ["Ball Progressor"], { finishing: 85 }, { finishing: 82 }, "match");
    for (const val of Object.values(result.factors)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

describe("getConfidence", () => {
  it("returns 'strong' for 8+ populated", () => {
    expect(getConfidence(9)).toBe("strong");
  });
  it("returns 'partial' for 5-7", () => {
    expect(getConfidence(6)).toBe("partial");
  });
  it("returns 'indicative' for < 5", () => {
    expect(getConfidence(3)).toBe("indicative");
  });
});

describe("generateMatchReasons", () => {
  it("generates reasons for high-scoring factors", () => {
    const factors = {
      role_match: 1.0, role_score_proximity: 0.9, archetype_alignment: 1.0,
      pillar_shape: 0.92, trait_overlap: 0.6, physical_profile: 0.7,
      personality_match: 1.0, grade_profile: 0.85, quality_band: 0.93,
      club_diversity: 1.0,
    };
    const [src, tgt] = makePlayers();
    const reasons = generateMatchReasons(factors, src, tgt, 2);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run tests/similarity-engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the engine**

```typescript
// apps/web/src/lib/similarity/engine.ts

import type {
  Lens, SimilarityFactors, SimilarityResult,
  PlayerCandidate, FactorName, FACTOR_NAMES,
} from "./types";
import { MATCH_WEIGHTS, REPLACEMENT_WEIGHTS } from "./types";
import {
  roleMatch, roleScoreProximity, archetypeAlignment,
  pillarShape, traitOverlap, physicalProfile,
  personalityMatch, gradeProfile, qualityBand, clubDiversity,
} from "./factors";

/** Score a source player against a candidate across all 10 factors. */
export function scoreSimilarity(
  src: PlayerCandidate,
  tgt: PlayerCandidate,
  srcTraits: string[],
  tgtTraits: string[],
  srcGrades: Record<string, number>,
  tgtGrades: Record<string, number>,
  lens: Lens,
): SimilarityResult {
  const srcQuality = src.active ? src.level : src.peak;
  const tgtQuality = tgt.active ? tgt.level : tgt.peak;

  const factors: SimilarityFactors = {
    role_match: roleMatch(src.best_role, src.position, tgt.best_role, tgt.position),
    role_score_proximity: roleScoreProximity(src.best_role_score, tgt.best_role_score),
    archetype_alignment: archetypeAlignment(src.earned_archetype, src.archetype, tgt.earned_archetype, tgt.archetype),
    pillar_shape: pillarShape(
      [src.technical_score, src.tactical_score, src.mental_score, src.physical_score],
      [tgt.technical_score, tgt.tactical_score, tgt.mental_score, tgt.physical_score],
    ),
    trait_overlap: traitOverlap(srcTraits, tgtTraits),
    physical_profile: physicalProfile(
      src.height_cm, src.preferred_foot, src.side,
      tgt.height_cm, tgt.preferred_foot, tgt.side,
    ),
    personality_match: personalityMatch(src.personality_type, tgt.personality_type),
    grade_profile: gradeProfile(srcGrades, tgtGrades),
    quality_band: qualityBand(srcQuality, tgtQuality),
    club_diversity: clubDiversity(src.club_id, tgt.club_id),
  };

  const weights = lens === "match" ? MATCH_WEIGHTS : REPLACEMENT_WEIGHTS;
  let total = 0;
  let populated = 0;

  // Determine which factors are actually populated (have real data, not null fallbacks)
  const populatedFlags: Record<FactorName, boolean> = {
    role_match: !!(src.best_role && tgt.best_role),
    role_score_proximity: src.best_role_score != null && tgt.best_role_score != null,
    archetype_alignment: !!(src.archetype || src.earned_archetype) && !!(tgt.archetype || tgt.earned_archetype),
    pillar_shape: [src.technical_score, src.tactical_score, src.mental_score, src.physical_score].filter(v => v != null).length >= 2
      && [tgt.technical_score, tgt.tactical_score, tgt.mental_score, tgt.physical_score].filter(v => v != null).length >= 2,
    trait_overlap: srcTraits.length > 0 && tgtTraits.length > 0,
    physical_profile: !!(src.height_cm || src.preferred_foot || src.side) && !!(tgt.height_cm || tgt.preferred_foot || tgt.side),
    personality_match: !!(src.personality_type && tgt.personality_type),
    grade_profile: Object.keys(srcGrades).length >= 4 && Object.keys(tgtGrades).length >= 4,
    quality_band: (src.active ? src.level : src.peak) != null && (tgt.active ? tgt.level : tgt.peak) != null,
    club_diversity: true, // always populated
  };

  const factorNames: FactorName[] = [
    "role_match", "role_score_proximity", "archetype_alignment",
    "pillar_shape", "trait_overlap", "physical_profile",
    "personality_match", "grade_profile", "quality_band", "club_diversity",
  ];

  for (const name of factorNames) {
    const score = factors[name];
    total += score * weights[name];
    if (populatedFlags[name]) populated++;
  }

  const similarity = Math.round(total);
  const confidence = getConfidence(populated);
  // Compute actual shared trait count for match reasons
  const srcSet = new Set(srcTraits);
  const sharedTraitCount = tgtTraits.filter(t => srcSet.has(t)).length;
  const match_reasons = generateMatchReasons(factors, src, tgt, sharedTraitCount);

  return {
    player: tgt,
    similarity,
    confidence,
    populated_factors: populated,
    factors,
    match_reasons,
  };
}

export function getConfidence(populated: number): "strong" | "partial" | "indicative" {
  if (populated >= 8) return "strong";
  if (populated >= 5) return "partial";
  return "indicative";
}

/** Generate top 3 human-readable match reasons sorted by factor score. */
export function generateMatchReasons(
  factors: SimilarityFactors,
  src: PlayerCandidate,
  tgt: PlayerCandidate,
  traitCount: number,
): string[] {
  const candidates: { reason: string; score: number }[] = [];

  if (factors.role_match >= 1.0 && tgt.best_role)
    candidates.push({ reason: `Same role (${tgt.best_role})`, score: factors.role_match });
  else if (factors.role_match >= 0.5)
    candidates.push({ reason: "Same position", score: factors.role_match });

  if (factors.archetype_alignment >= 1.0 && (tgt.earned_archetype || tgt.archetype))
    candidates.push({ reason: `Same archetype (${tgt.earned_archetype || tgt.archetype})`, score: factors.archetype_alignment });
  else if (factors.archetype_alignment >= 0.7)
    candidates.push({ reason: "Similar archetype", score: factors.archetype_alignment });

  if (factors.pillar_shape >= 0.85)
    candidates.push({ reason: "Similar pillar profile", score: factors.pillar_shape });

  if (factors.trait_overlap >= 0.5 && traitCount > 0)
    candidates.push({ reason: `${traitCount} shared traits`, score: factors.trait_overlap });

  if (factors.grade_profile >= 0.8)
    candidates.push({ reason: "Similar grade profile", score: factors.grade_profile });

  if (factors.physical_profile >= 1.0)
    candidates.push({ reason: "Same build and side", score: factors.physical_profile });

  if (factors.personality_match >= 1.0)
    candidates.push({ reason: "Same personality type", score: factors.personality_match });

  if (factors.quality_band >= 0.9)
    candidates.push({ reason: "Similar quality level", score: factors.quality_band });

  if (factors.role_score_proximity >= 0.9)
    candidates.push({ reason: "Similar output level", score: factors.role_score_proximity });

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3).map((c) => c.reason);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run tests/similarity-engine.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/similarity/engine.ts apps/web/tests/similarity-engine.test.ts
git commit -m "feat(similarity): unified scoring engine with match reasons"
```

---

### Task 4: API endpoint (`similar/route.ts` replacement)

**Files:**
- Modify: `apps/web/src/app/api/players/[id]/similar/route.ts`

- [ ] **Step 1: Replace the existing route with the unified engine**

Overwrite `apps/web/src/app/api/players/[id]/similar/route.ts` with:

```typescript
import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { scoreSimilarity } from "@/lib/similarity/engine";
import type { Lens, PlayerCandidate, SimilarityResult } from "@/lib/similarity/types";
import { ADJACENT_POSITIONS } from "@/lib/similarity/types";

const CARD_FIELDS =
  "person_id, name, position, level, peak, archetype, earned_archetype, overall, best_role, best_role_score, technical_score, tactical_score, mental_score, physical_score, personality_type, preferred_foot, side, height_cm, club, club_id, nation, image_url, active" as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (!supabaseServer || isNaN(playerId)) {
    return NextResponse.json({ lens: "match", source: null, results: [] });
  }

  const lens = (req.nextUrl.searchParams.get("lens") ?? "match") as Lens;
  const includeLegends = req.nextUrl.searchParams.get("include_legends") === "true";
  const realistic = req.nextUrl.searchParams.get("realistic") === "true";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "8", 10), 20);

  // ── Fetch source player ───────────────────────────────────────────────────
  const { data: source } = await supabaseServer
    .from("player_intelligence_card")
    .select(CARD_FIELDS)
    .eq("person_id", playerId)
    .single();

  if (!source?.position) {
    return NextResponse.json({ lens, source: null, results: [] });
  }

  // ── Fetch candidates ──────────────────────────────────────────────────────
  const positions = ADJACENT_POSITIONS[source.position] ?? [source.position];

  let query = supabaseServer
    .from("player_intelligence_card")
    .select(CARD_FIELDS)
    .in("position", positions)
    .neq("person_id", playerId)
    .not("best_role_score", "is", null)
    .order("best_role_score", { ascending: false, nullsFirst: false })
    .limit(800);

  if (includeLegends) {
    // Include both active and legends — no active filter
  } else {
    query = query.eq("active", true);
  }

  // Realistic filter for replacement lens
  if (realistic && lens === "replacement") {
    const srcLevel = source.active ? source.level : source.peak;
    if (srcLevel != null) {
      query = query.gte("level", srcLevel - 8).lte("level", srcLevel + 3);
    }
    // Age filter would require DOB — skip for now, quality band handles it
  }

  const { data: candidates } = await query;
  if (!candidates?.length) {
    return NextResponse.json({ lens, source, results: [] });
  }

  // ── Fetch traits for source + candidates ──────────────────────────────────
  const allIds = [playerId, ...candidates.map((c: PlayerCandidate) => c.person_id)];

  const { data: allTraits } = await supabaseServer
    .from("player_trait_scores")
    .select("player_id, trait")
    .in("player_id", allIds);

  const traitMap = new Map<number, string[]>();
  for (const t of allTraits ?? []) {
    const existing = traitMap.get(t.player_id) ?? [];
    existing.push(t.trait);
    traitMap.set(t.player_id, existing);
  }

  // ── Fetch grades for source + candidates ──────────────────────────────────
  const { data: allGrades } = await supabaseServer
    .from("attribute_grades")
    .select("player_id, attribute, scout_grade, stat_score")
    .in("player_id", allIds);

  // Build grade map: one score per player+attribute, preferring scout_grade over stat_score
  const gradeMap = new Map<number, Record<string, number>>();
  const gradeHasScout = new Map<string, boolean>(); // track if we've seen a scout_grade for pid:attr
  for (const g of allGrades ?? []) {
    const key = `${g.player_id}:${g.attribute}`;
    const existing = gradeMap.get(g.player_id) ?? {};

    // Prefer scout_grade over stat_score (scout assessment is highest priority)
    if (g.scout_grade != null) {
      existing[g.attribute] = g.scout_grade;
      gradeHasScout.set(key, true);
    } else if (g.stat_score != null && !gradeHasScout.get(key)) {
      // Only use stat_score if no scout_grade exists for this player+attribute
      if (!existing[g.attribute] || g.stat_score > existing[g.attribute]) {
        existing[g.attribute] = g.stat_score;
      }
    }
    gradeMap.set(g.player_id, existing);
  }

  // ── Score all candidates ──────────────────────────────────────────────────
  const srcTraits = traitMap.get(playerId) ?? [];
  const srcGrades = gradeMap.get(playerId) ?? {};

  const results: SimilarityResult[] = candidates.map((tgt: PlayerCandidate) => {
    const tgtTraits = traitMap.get(tgt.person_id) ?? [];
    const tgtGrades = gradeMap.get(tgt.person_id) ?? {};
    return scoreSimilarity(source as PlayerCandidate, tgt, srcTraits, tgtTraits, srcGrades, tgtGrades, lens);
  });

  results.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({
    lens,
    source: {
      id: source.person_id,
      name: source.name,
      position: source.position,
      best_role: source.best_role,
      earned_archetype: source.earned_archetype,
    },
    results: results.slice(0, limit),
  });
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/players/\[id\]/similar/route.ts
git commit -m "feat(similarity): unified API endpoint replaces 3 scoring paths"
```

---

### Task 5: Update SimilarPlayers component

**Files:**
- Modify: `apps/web/src/components/SimilarPlayers.tsx`

- [ ] **Step 1: Update component to consume new API response shape**

The component currently reads `data.players` and `data.legendComps`. Update to read `data.results` from the new unified API. Add lens tabs (Closest Match / Replacements) and match reason pills.

Key changes:
- Replace `SimilarPlayer` and `LegendComp` interfaces with types from the new API response
- Fetch with `?lens=match&include_legends=true` to get both active + legend results
- Legend matches (from the same results array) are `active === false`
- Add match_reasons pill display
- Add confidence badge for partial/indicative matches

Read the existing component at `apps/web/src/components/SimilarPlayers.tsx` before editing. Preserve the existing visual style (card, link rows, position badges) but add:
- Lens toggle tabs at top: "Closest Match" | "Replacements"
- Match reason pills under each player row (text-[9px] coloured pills)
- Confidence badge (amber/grey) next to similarity %
- Split results into active matches and legend matches (filter by `active` field)

- [ ] **Step 2: Verify build passes**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SimilarPlayers.tsx
git commit -m "feat(similarity): update SimilarPlayers for unified API + lens tabs"
```

---

### Task 6: Update legends page SimilarActivePlayer

**Files:**
- Modify: `apps/web/src/app/legends/page.tsx` (lines 153-195 — the `SimilarActivePlayer` function)

- [ ] **Step 1: Update the response field access**

The `SimilarActivePlayer` component (defined inline in the legends page) fetches `/api/players/${personId}/similar` and reads `data.players[0]`. Update to read `data.results[0]`:

Find in `apps/web/src/app/legends/page.tsx`:
```typescript
.then((data) => {
  if (data.players?.[0]) {
    setSimilar(data.players[0]);
```

Replace with:
```typescript
.then((data) => {
  if (data.results?.[0]) {
    setSimilar({
      name: data.results[0].player.name,
      person_id: data.results[0].player.person_id,
      similarity: data.results[0].similarity,
      club: data.results[0].player.club,
    });
```

- [ ] **Step 2: Verify build passes**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/legends/page.tsx
git commit -m "fix(legends): update SimilarActivePlayer for new API response shape"
```

---

### Task 7: Legend backfill pipeline

**Files:**
- Create: `pipeline/91_legend_backfill.py`
- Reference: `apps/web/src/lib/assessment/four-pillars.ts` for pillar formula

- [ ] **Step 1: Build the legend backfill script**

Create `pipeline/91_legend_backfill.py` that:

1. Fetches all legends (active=false) from `people` + `player_profiles`
2. For each legend with attribute_grades but no pillar scores:
   - Compute technical/tactical/mental/physical scores using the same formula as the four-pillar assessment (read `four-pillars.ts` for the attribute→pillar mapping)
   - Write to `player_profiles.technical_score`, etc.
3. For each legend with archetype + grades but no traits:
   - Infer 2-4 traits based on archetype + top grades (e.g., Striker + finishing ≥ 85 → "Clinical Finisher")
   - Write to `player_trait_scores`
4. Extend side inference to legends (from EAFC positions or foot fallback)

Use `--dry-run` flag. Read existing pipeline scripts (e.g., `pipeline/36c_infer_traits.py`) for pattern reference (psycopg2, config.py, POSTGRES_DSN).

- [ ] **Step 2: Test with dry-run**

Run: `cd pipeline && python 91_legend_backfill.py --dry-run`
Expected: Shows counts of legends that would be updated

- [ ] **Step 3: Run for real**

Run: `cd pipeline && python 91_legend_backfill.py`
Expected: ~195 legends updated with pillar scores and/or traits

- [ ] **Step 4: Commit**

```bash
git add pipeline/91_legend_backfill.py
git commit -m "feat(pipeline): legend backfill — pillars, traits, side for ~195 legends"
```

---

### Task 8: Full integration test and cleanup

**Files:**
- No new files — verification and cleanup

- [ ] **Step 1: Run all tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass (existing + new similarity tests)

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -10`
Expected: Clean build, no errors

- [ ] **Step 3: Spot-check API response**

Run dev server and test:
```bash
cd apps/web && npx next dev &
sleep 5
curl -s http://localhost:3000/api/players/1/similar?lens=match | jq '.results[0] | {name: .player.name, similarity, confidence, match_reasons}'
curl -s http://localhost:3000/api/players/1/similar?lens=replacement | jq '.results[0] | {name: .player.name, similarity, confidence, match_reasons}'
```
Expected: Both return results with similarity scores, confidence labels, and match reasons

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: unified similarity engine — 10-factor scoring, two lenses, match reasons"
```
