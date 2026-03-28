import type {
  Lens, SimilarityFactors, SimilarityResult,
  PlayerCandidate, FactorName,
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
    club_diversity: true,
  };

  const factorNames: FactorName[] = [
    "role_match", "role_score_proximity", "archetype_alignment",
    "pillar_shape", "trait_overlap", "physical_profile",
    "personality_match", "grade_profile", "quality_band", "club_diversity",
  ];

  let weightedSum = 0;
  let totalWeight = 0;

  for (const name of factorNames) {
    const score = factors[name];
    const w = weights[name];
    if (populatedFlags[name]) {
      weightedSum += score * w;
      totalWeight += w;
      populated++;
    }
    // Always accumulate unpopulated factors at neutral 0.5 for the raw total
    total += (populatedFlags[name] ? score : 0.5) * w;
  }

  // Use weight-normalized score when we have populated data, otherwise fall back to raw total
  const normalizedScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : total;
  const similarity = Math.round(normalizedScore);
  const confidence = getConfidence(populated);
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
