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
import { computeTraitProfileScore } from "@/lib/assessment/trait-role-impact";

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
  athleticism: number;
  availability: number;
  durability: number;
  ageCurve: number;
  dominance: number;
  age: number | null;
}

export interface PhysicalInput {
  position: string | null;
  age: number | null;
  availabilityScore: number | null;
  /** Sprinter model score (0-100) from attrBest */
  sprinterScore: number | null;
  /** Powerhouse model score (0-100) from attrBest */
  powerhouseScore: number | null;
  /** player_status.fitness_tag */
  fitnessTag: string | null;
  /** player_trait_scores durability severity (1-10) */
  durabilitySeverity: number | null;
  /** AF duels_won / duels_total ratio */
  duelWinRate: number | null;
  /** people.height_cm */
  heightCm: number | null;
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

  // When no model data at all, fall back to level as the score
  if (totalWeight === 0 && level != null) {
    positionScore = Math.min(level, 100);
  }

  const score = Math.round(Math.max(0, Math.min(100, positionScore)));

  return { score, modelScores, positionScore: score, dataWeight, sources };
}

// ── Pillar 2: TACTICAL ───────────────────────────────────────────────────────

/** Convert keyAttribute display names to DB attribute column names */
function normalizeKeyAttr(name: string): string {
  return name.toLowerCase().replace(/[\s-]+/g, "_");
}

/** Fixed ceiling for scorePlayerForRole: level(100) + archetype(120) + personality(60) + position(30) */
const MAX_REALISTIC_ROLE_SCORE = 280;

export function computeTactical(
  player: {
    level: number | null;
    archetype: string | null;
    personality_type: string | null;
    position: string | null;
  },
  traitScore?: number,
  attrBest?: Map<string, { normalized: number }>,
): TacticalBreakdown {
  // Score player against all 26 tactical roles
  const roleResults: { name: string; score: number }[] = [];
  for (const roleName of Object.keys(ROLE_INTELLIGENCE)) {
    const score = scorePlayerForRole(player, roleName);
    roleResults.push({ name: roleName, score });
  }
  roleResults.sort((a, b) => b.score - a.score);

  const bestRole = roleResults[0] ?? null;

  // Normalize with fixed ceiling instead of player-dependent max
  const normalizedBestScore = Math.round(
    (bestRole?.score ?? 0) / MAX_REALISTIC_ROLE_SCORE * 100,
  );

  // Role fit base: archetype/personality fit normalized to 0-100
  let roleFit = Math.max(0, Math.min(100, normalizedBestScore));

  // Blend with keyAttribute data when available
  if (attrBest && bestRole) {
    const intel = ROLE_INTELLIGENCE[bestRole.name];
    if (intel?.keyAttributes) {
      const attrScores: number[] = [];
      for (const ka of intel.keyAttributes) {
        const dbName = normalizeKeyAttr(ka);
        const val = attrBest.get(dbName);
        if (val) attrScores.push(val.normalized);
      }
      if (attrScores.length > 0) {
        const attrRoleFit = attrScores.reduce((a, b) => a + b, 0) / attrScores.length;
        roleFit = Math.round(attrRoleFit * 0.5 + roleFit * 0.5);
      }
    }
  }

  // Flexibility: count viable roles (score > 55% of fixed ceiling)
  // Raised from 40% to 55% to prevent everyone scoring 80 flexibility
  const viableThreshold = MAX_REALISTIC_ROLE_SCORE * 0.55;
  const viableRoles = roleResults.filter(r => r.score > viableThreshold);
  const viableRoleCount = viableRoles.length;
  let flexibility: number;
  if (viableRoleCount >= 6) flexibility = 85;
  else if (viableRoleCount >= 4) flexibility = 70;
  else if (viableRoleCount >= 3) flexibility = 55;
  else if (viableRoleCount >= 2) flexibility = 40;
  else if (viableRoleCount >= 1) flexibility = 25;
  else flexibility = 15;

  // Trait profile score from trait-role-impact
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
  mbtiScores?: { tf: number; jp: number } | null,
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

  // Mental Strength (30%): comp/coach are 0-10 in DB → multiply by 10 for 0-100
  let mentalStrength = 50;
  if (competitiveness != null && coachability != null) {
    mentalStrength = Math.round((competitiveness * 10 + coachability * 10) / 2);
  } else if (competitiveness != null) {
    mentalStrength = competitiveness * 10;
  } else if (coachability != null) {
    mentalStrength = coachability * 10;
  } else if (mbtiScores && mbtiScores.tf != null && mbtiScores.jp != null) {
    // Fallback: use MBTI TF+JP dimensions as proxy (0-100 scale already)
    mentalStrength = Math.round((mbtiScores.tf + mbtiScores.jp) / 2);
  }
  mentalStrength = Math.max(0, Math.min(100, mentalStrength));

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

// ── Fitness tag → durability score ────────────────────────────────────────

const FITNESS_TAG_SCORES: Record<string, number> = {
  "iron man": 95, "iron_man": 95, "fully fit": 75,
  normal: 60, "moderate risk": 35, "moderate_risk": 35,
  "injury prone": 15, "injury_prone": 15,
};

// ── Ideal height ranges by position (cm) ─────────────────────────────────

const IDEAL_HEIGHT: Record<string, [number, number]> = {
  GK: [188, 196], CD: [183, 193], CF: [178, 190], DM: [177, 188],
  CM: [173, 185], AM: [170, 183], WD: [172, 182], WM: [170, 182],
  WF: [170, 183],
};

function heightFitScore(position: string | null, heightCm: number | null): number {
  if (heightCm == null) return 50;
  const pos = position ?? "CM";
  const [lo, hi] = IDEAL_HEIGHT[pos] ?? [173, 185];
  if (heightCm >= lo && heightCm <= hi) return 80;
  const dist = heightCm < lo ? lo - heightCm : heightCm - hi;
  return Math.max(20, 80 - dist * 4);
}

export function computePhysical(input: PhysicalInput): PhysicalBreakdown {
  const {
    position, age, availabilityScore,
    sprinterScore, powerhouseScore,
    fitnessTag, durabilitySeverity,
    duelWinRate, heightCm,
  } = input;

  // 1. Athleticism (30%): Sprinter + Powerhouse model averages
  let athleticism = 50;
  const athParts: number[] = [];
  if (sprinterScore != null) athParts.push(sprinterScore);
  if (powerhouseScore != null) athParts.push(powerhouseScore);
  if (athParts.length > 0) {
    athleticism = Math.round(athParts.reduce((a, b) => a + b, 0) / athParts.length);
  }

  // 2. Availability (25%): minutes-based (existing)
  const availability = availabilityScore ?? 50;

  // 3. Durability (20%): fitness tag + durability trait
  let durability = 50;
  const tagScore = FITNESS_TAG_SCORES[(fitnessTag ?? "").toLowerCase()] ?? null;
  const traitScore = durabilitySeverity != null ? durabilitySeverity * 10 : null;
  if (tagScore != null && traitScore != null) {
    durability = Math.round(tagScore * 0.5 + traitScore * 0.5);
  } else if (tagScore != null) {
    durability = tagScore;
  } else if (traitScore != null) {
    durability = traitScore;
  }

  // 4. Age Curve (15%): position-specific peak window
  const ageCurve = ageCurveScore(position, age);

  // 5. Physical Dominance (10%): duel win rate + height fit
  let dominance = 50;
  const domParts: number[] = [];
  if (duelWinRate != null) domParts.push(Math.min(100, duelWinRate * 100));
  const hFit = heightFitScore(position, heightCm);
  if (heightCm != null) domParts.push(hFit);
  if (domParts.length > 0) {
    dominance = Math.round(domParts.reduce((a, b) => a + b, 0) / domParts.length);
  }

  const score = Math.round(
    athleticism * 0.30 +
    availability * 0.25 +
    durability * 0.20 +
    ageCurve * 0.15 +
    dominance * 0.10
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    athleticism,
    availability,
    durability,
    ageCurve,
    dominance,
    age,
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
  maxSeasonMinutes: number = 3420,
): number {
  if (seasons.length === 0) return 50;

  const MAX_SEASON_MINUTES = maxSeasonMinutes;
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
