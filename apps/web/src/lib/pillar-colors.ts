/**
 * Four-pillar color utilities
 *
 * Centralizes pillar color definitions and helper functions
 * for the pillar-driven player card UI.
 */

export type PillarKey = "technical" | "tactical" | "mental" | "physical";

export const PILLAR_COLORS: Record<PillarKey, string> = {
  technical: "var(--color-accent-technical)",
  tactical: "var(--color-accent-tactical)",
  mental: "var(--color-accent-mental)",
  physical: "var(--color-accent-physical)",
};

export const PILLAR_HEX: Record<PillarKey, string> = {
  technical: "#d4a035",
  tactical: "#9b59b6",
  mental: "#3dba6f",
  physical: "#4a90d9",
};

export const PILLAR_LABELS: Record<PillarKey, string> = {
  technical: "TEC",
  tactical: "TAC",
  mental: "MEN",
  physical: "PHY",
};

export const PILLAR_KEYS: PillarKey[] = ["technical", "tactical", "mental", "physical"];

export interface PillarScoreSet {
  technical: number | null;
  tactical: number | null;
  mental: number | null;
  physical: number | null;
}

/** Returns the pillar with the highest score, or null if all are null */
export function getDominantPillar(scores: PillarScoreSet): PillarKey | null {
  let best: PillarKey | null = null;
  let bestVal = -1;
  for (const key of PILLAR_KEYS) {
    const v = scores[key];
    if (v != null && v > bestVal) {
      bestVal = v;
      best = key;
    }
  }
  return best;
}

/** Returns true if at least one pillar score is available */
export function hasAnyPillarScore(scores: PillarScoreSet): boolean {
  return PILLAR_KEYS.some((k) => scores[k] != null);
}

/** Get condition label from physical score + age curve context */
export function getConditionLabel(
  physScore: number | null,
  age: number | null,
  position: string | null,
  ageCurveFn: (pos: string | null, age: number | null) => number,
): string | null {
  if (physScore == null) return null;
  const curve = ageCurveFn(position, age);
  if (physScore >= 85) return "Peak Condition";
  if (physScore >= 70 && curve >= 80) return "Prime";
  if (physScore >= 70) return "Available";
  if (physScore >= 55 && curve < 60) return "Winding Down";
  if (physScore >= 55) return "Moderate";
  if (curve < 40) return "Veteran";
  if (physScore < 40) return "Fragile";
  return "Moderate";
}
