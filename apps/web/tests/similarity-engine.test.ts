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
