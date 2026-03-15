/**
 * Four-Pillar Player Assessment Methodology
 *
 * Technical (Purple)  — How good are they? Position-weighted model scores.
 * Tactical  (Green)   — How do they fit systems? Role fit + flexibility + traits.
 * Mental    (Blue)    — Who are they psychologically? Personality-role alignment + strength.
 * Physical  (Gold)    — Available, durable, right career stage? Age curve + availability.
 *
 * Each pillar scores 0-100. Overall = equal 25% weight per pillar.
 * Commercial/Career modifier (0.7x–1.5x) applies to valuation, not pillar scores.
 */

import { ROLE_INTELLIGENCE, scorePlayerForRole } from "@/lib/formation-intelligence";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PillarScores {
  technical: number;
  tactical: number;
  mental: number;
  physical: number;
  overall: number;
  confidence: "high" | "medium" | "low";
}

export interface TechnicalBreakdown {
  score: number;
  modelScores: Record<string, number>;
  positionScore: number;
  dataWeight: number;
  sources: string[];
}

export interface TacticalBreakdown {
  score: number;
  roleFit: number;
  bestRole: string | null;
  bestRoleScore: number;
  flexibility: number;
  viableRoleCount: number;
  traitProfile: number;
}

export interface MentalBreakdown {
  score: number;
  personalityRoleAlignment: number;
  mentalStrength: number;
  mentalStability: number;
  personalityType: string | null;
  mentalTag: string | null;
}

export interface PhysicalBreakdown {
  score: number;
  availability: number;
  ageCurve: number;
  trajectory: number;
  age: number | null;
  trajectoryLabel: string | null;
}

export interface CommercialModifier {
  multiplier: number;
  buzz: number;
  sentiment: number;
  contractMonths: number | null;
  trajectoryBonus: number;
}

export interface FullAssessment {
  pillars: PillarScores;
  technical: TechnicalBreakdown;
  tactical: TacticalBreakdown;
  mental: MentalBreakdown;
  physical: PhysicalBreakdown;
  commercial: CommercialModifier;
}

// ── Position weights (reused from radar route) ───────────────────────────────

export const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  GK: { GK: 1.0, Cover: 0.6, Commander: 0.5, Controller: 0.3 },
  CD: { Destroyer: 1.0, Cover: 0.9, Commander: 0.7, Target: 0.5, Powerhouse: 0.4, Passer: 0.3 },
  WD: { Engine: 0.9, Dribbler: 0.7, Passer: 0.7, Sprinter: 0.6, Cover: 0.6, Destroyer: 0.3 },
  DM: { Cover: 1.0, Destroyer: 0.9, Controller: 0.8, Passer: 0.5, Commander: 0.4, Powerhouse: 0.3 },
  CM: { Controller: 1.0, Passer: 0.9, Engine: 0.8, Cover: 0.5, Creator: 0.4 },
  WM: { Dribbler: 0.9, Passer: 0.8, Engine: 0.7, Sprinter: 0.6, Creator: 0.5 },
  AM: { Creator: 1.0, Dribbler: 0.8, Passer: 0.7, Controller: 0.5, Striker: 0.4, Sprinter: 0.3 },
  WF: { Dribbler: 1.0, Sprinter: 0.9, Striker: 0.7, Creator: 0.5, Engine: 0.5 },
  CF: { Striker: 1.0, Target: 0.7, Sprinter: 0.6, Powerhouse: 0.5, Dribbler: 0.4, Creator: 0.3 },
};

// ── Age curve peak windows ───────────────────────────────────────────────────

const PEAK_WINDOWS: Record<string, [number, number]> = {
  GK: [27, 34], CD: [26, 32], WD: [25, 30], DM: [26, 32],
  CM: [25, 31], WM: [24, 29], AM: [24, 30], WF: [24, 29], CF: [25, 31],
};

// ── Mental tag scores ────────────────────────────────────────────────────────

const MENTAL_TAG_SCORES: Record<string, number> = {
  sharp: 100, confident: 75, focused: 70, steady: 60,
  low: 40, fragile: 15, unknown: 50,
};

// ── Pillar 1: TECHNICAL ──────────────────────────────────────────────────────

export function computeTechnical(
  modelScores: Record<string, number>,
  position: string | null,
  level: number | null,
  dataWeight: number,
  sources: string[],
): TechnicalBreakdown {
  const pos = position ?? "CM";
  const weights = POSITION_WEIGHTS[pos] ?? POSITION_WEIGHTS.CM;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [model, weight] of Object.entries(weights)) {
    if (modelScores[model] !== undefined) {
      weightedSum += modelScores[model] * weight;
      totalWeight += weight;
    }
  }

  let positionScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Level anchor
  const levelAnchor = level != null ? Math.min(level, 100) : null;
  if (levelAnchor !== null && positionScore > 0) {
    positionScore = positionScore * dataWeight + levelAnchor * (1 - dataWeight);
  }

  const score = Math.round(Math.max(0, Math.min(100, positionScore)));

  return { score, modelScores, positionScore: score, dataWeight, sources };
}

// ── Pillar 2: TACTICAL ───────────────────────────────────────────────────────

export function computeTactical(
  player: {
    level: number | null;
    archetype: string | null;
    personality_type: string | null;
    position: string | null;
  },
  traitScore?: number,
): TacticalBreakdown {
  // Score player against all 26 tactical roles
  const roleResults: { name: string; score: number }[] = [];
  for (const roleName of Object.keys(ROLE_INTELLIGENCE)) {
    const score = scorePlayerForRole(player, roleName);
    roleResults.push({ name: roleName, score });
  }
  roleResults.sort((a, b) => b.score - a.score);

  const bestRole = roleResults[0] ?? null;
  const maxPossible = (player.level ?? 0) + 120 + 60 + 30; // level + archetype + personality + position
  const normalizedBestScore = maxPossible > 0
    ? Math.round((bestRole?.score ?? 0) / maxPossible * 100)
    : 0;

  // Role fit: how well the best role fits (normalized to 0-100)
  const roleFit = Math.max(0, Math.min(100, normalizedBestScore));

  // Flexibility: count viable roles (score > 60% of max)
  const viableThreshold = maxPossible * 0.4;
  const viableRoles = roleResults.filter(r => r.score > viableThreshold);
  const viableRoleCount = viableRoles.length;
  let flexibility: number;
  if (viableRoleCount >= 6) flexibility = 80;
  else if (viableRoleCount >= 4) flexibility = 60;
  else if (viableRoleCount >= 3) flexibility = 50;
  else if (viableRoleCount >= 2) flexibility = 35;
  else flexibility = 20;

  // Trait profile (placeholder until trait table exists)
  const traitProfile = traitScore ?? 50;

  // Weighted: Role Fit 40% + Flexibility 30% + Traits 30%
  const score = Math.round(roleFit * 0.4 + flexibility * 0.3 + traitProfile * 0.3);

  return {
    score: Math.max(0, Math.min(100, score)),
    roleFit,
    bestRole: bestRole?.name ?? null,
    bestRoleScore: bestRole?.score ?? 0,
    flexibility,
    viableRoleCount,
    traitProfile,
  };
}

// ── Pillar 3: MENTAL ─────────────────────────────────────────────────────────

export function computeMental(
  personalityType: string | null,
  competitiveness: number | null,
  coachability: number | null,
  mentalTag: string | null,
  bestRoleName: string | null,
): MentalBreakdown {
  // Personality-Role Alignment (50%)
  let personalityRoleAlignment = 50; // default
  if (personalityType && bestRoleName) {
    const intel = ROLE_INTELLIGENCE[bestRoleName];
    if (intel) {
      const idx = intel.personalities.indexOf(personalityType);
      if (idx === 0) personalityRoleAlignment = 100;
      else if (idx === 1) personalityRoleAlignment = 80;
      else if (idx === 2) personalityRoleAlignment = 60;
      else personalityRoleAlignment = 35;
    }
  } else if (!personalityType) {
    personalityRoleAlignment = 50; // unknown
  }

  // Mental Strength (30%): (competitiveness + coachability) / 2, scaled to 0-100
  let mentalStrength = 50;
  if (competitiveness != null && coachability != null) {
    // Both are 0-100 already in the DB
    mentalStrength = Math.round((competitiveness + coachability) / 2);
  } else if (competitiveness != null) {
    mentalStrength = competitiveness;
  } else if (coachability != null) {
    mentalStrength = coachability;
  }

  // Mental Stability (20%): from mental_tag
  const tagKey = (mentalTag ?? "unknown").toLowerCase();
  const mentalStability = MENTAL_TAG_SCORES[tagKey] ?? 50;

  const score = Math.round(
    personalityRoleAlignment * 0.5 + mentalStrength * 0.3 + mentalStability * 0.2
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    personalityRoleAlignment,
    mentalStrength,
    mentalStability,
    personalityType,
    mentalTag,
  };
}

// ── Pillar 4: PHYSICAL ───────────────────────────────────────────────────────

export function ageCurveScore(position: string | null, age: number | null): number {
  if (age == null) return 50; // unknown
  const pos = position ?? "CM";
  const [peakStart, peakEnd] = PEAK_WINDOWS[pos] ?? [25, 31];

  if (age >= peakStart && age <= peakEnd) return 100;
  if (age < peakStart) {
    const yearsBelow = peakStart - age;
    return Math.max(20, 100 - yearsBelow * 8);
  }
  // Past peak
  const yearsAbove = age - peakEnd;
  return Math.max(20, 100 - yearsAbove * 10);
}

const TRAJECTORY_SCORES: Record<string, number> = {
  rising: 90, peak: 80, stable: 65, newcomer: 70,
  "one-club": 75, journeyman: 50, declining: 35, unknown: 50,
};

export function computePhysical(
  position: string | null,
  age: number | null,
  trajectory: string | null,
  availabilityScore: number | null,
): PhysicalBreakdown {
  const ageCurve = ageCurveScore(position, age);
  const trajectoryScore = TRAJECTORY_SCORES[(trajectory ?? "unknown").toLowerCase()] ?? 50;
  const availability = availabilityScore ?? 50; // default when unknown

  // Weighted: Availability 40% + Age Curve 35% + Trajectory 25%
  const score = Math.round(
    availability * 0.4 + ageCurve * 0.35 + trajectoryScore * 0.25
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    availability,
    ageCurve,
    trajectory: trajectoryScore,
    age,
    trajectoryLabel: trajectory,
  };
}

// ── Commercial/Career Modifier ───────────────────────────────────────────────

export function computeCommercialModifier(
  buzzScore: number | null,
  sentimentScore: number | null,
  contractMonthsRemaining: number | null,
  trajectory: string | null,
): CommercialModifier {
  // Buzz: 0-20 scale → normalize
  const buzz = buzzScore != null ? Math.min(100, (buzzScore / 20) * 100) : 50;
  const sentiment = sentimentScore != null ? Math.min(100, (sentimentScore / 20) * 100) : 50;

  // Contract urgency: fewer months = higher modifier (for buying)
  let contractBonus = 0;
  if (contractMonthsRemaining != null) {
    if (contractMonthsRemaining <= 6) contractBonus = 0.3;
    else if (contractMonthsRemaining <= 12) contractBonus = 0.15;
    else if (contractMonthsRemaining <= 18) contractBonus = 0.05;
  }

  // Trajectory bonus
  const trajKey = (trajectory ?? "").toLowerCase();
  let trajectoryBonus = 0;
  if (trajKey === "rising") trajectoryBonus = 0.15;
  else if (trajKey === "peak") trajectoryBonus = 0.05;
  else if (trajKey === "declining") trajectoryBonus = -0.15;

  // Multiplier: base 1.0 + buzz/sentiment modifier + contract + trajectory
  const buzzMod = ((buzz - 50) / 50) * 0.15; // -0.15 to +0.15
  const sentMod = ((sentiment - 50) / 50) * 0.1; // -0.1 to +0.1
  const rawMultiplier = 1.0 + buzzMod + sentMod + contractBonus + trajectoryBonus;
  const multiplier = Math.max(0.7, Math.min(1.5, rawMultiplier));

  return {
    multiplier: Math.round(multiplier * 100) / 100,
    buzz: Math.round(buzz),
    sentiment: Math.round(sentiment),
    contractMonths: contractMonthsRemaining,
    trajectoryBonus,
  };
}

// ── Full Assessment ──────────────────────────────────────────────────────────

export function computeOverall(pillars: Omit<PillarScores, "overall" | "confidence">): PillarScores {
  const overall = Math.round(
    (pillars.technical + pillars.tactical + pillars.mental + pillars.physical) / 4
  );

  // Confidence based on how many pillars have real data
  const hasReal = [
    pillars.technical > 0,
    pillars.tactical > 0,
    pillars.mental > 0,
    pillars.physical > 0,
  ].filter(Boolean).length;

  let confidence: "high" | "medium" | "low" = "low";
  if (hasReal >= 4) confidence = "high";
  else if (hasReal >= 3) confidence = "medium";

  return { ...pillars, overall, confidence };
}

// ── Availability from FBRef minutes ──────────────────────────────────────────

export function computeAvailability(
  seasons: Array<{ minutes: number | null; matches_played: number | null }>,
): number {
  if (seasons.length === 0) return 50;

  // Max possible minutes ≈ 38 matches × 90 min = 3420 (league season)
  const MAX_SEASON_MINUTES = 3420;
  const recentSeasons = seasons.slice(0, 3); // last 3 seasons

  const scores = recentSeasons.map(s => {
    const mins = s.minutes ?? 0;
    return Math.min(100, (mins / MAX_SEASON_MINUTES) * 100);
  });

  // Weight recent seasons more: 50%, 30%, 20%
  const weights = [0.5, 0.3, 0.2];
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < scores.length; i++) {
    weightedSum += scores[i] * (weights[i] ?? 0.1);
    totalWeight += weights[i] ?? 0.1;
  }

  return Math.round(totalWeight > 0 ? weightedSum / totalWeight : 50);
}
