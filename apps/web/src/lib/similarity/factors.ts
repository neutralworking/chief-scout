import { ADJACENT_POSITIONS } from "./types";

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

export function roleScoreProximity(
  srcScore: number | null, tgtScore: number | null,
): number {
  if (srcScore == null || tgtScore == null) return 0.5;
  return Math.max(0, 1.0 - Math.abs(srcScore - tgtScore) / 30);
}

export function archetypeAlignment(
  srcEarned: string | null, srcArchetype: string | null,
  tgtEarned: string | null, tgtArchetype: string | null,
): number {
  if (srcEarned && tgtEarned && srcEarned === tgtEarned) return 1.0;
  const srcParts = srcArchetype?.split("-") ?? [];
  const tgtParts = tgtArchetype?.split("-") ?? [];
  const srcPrimary = srcParts[0] ?? "";
  const srcSecondary = srcParts[1] ?? "";
  const tgtPrimary = tgtParts[0] ?? "";
  const tgtSecondary = tgtParts[1] ?? "";
  if (!srcPrimary && !tgtPrimary) return 0.0;
  if (srcPrimary && tgtPrimary && srcPrimary === tgtPrimary) return 0.7;
  if (srcPrimary && tgtSecondary && srcPrimary === tgtSecondary) return 0.4;
  if (srcSecondary && tgtPrimary && srcSecondary === tgtPrimary) return 0.4;
  if (srcSecondary && tgtSecondary && srcSecondary === tgtSecondary) return 0.3;
  return 0.0;
}

export function pillarShape(
  src: (number | null)[], tgt: (number | null)[],
): number {
  const pairs: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    if (src[i] != null && tgt[i] != null) {
      pairs.push([src[i]!, tgt[i]!]);
    }
  }
  if (pairs.length < 2) return 0.5;
  const sumA = pairs.reduce((s, [a]) => s + a, 0);
  const sumB = pairs.reduce((s, [, b]) => s + b, 0);
  if (sumA === 0 || sumB === 0) return 0.5;
  const aNorm = pairs.map(([a]) => a / sumA);
  const bNorm = pairs.map(([, b]) => b / sumB);
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

export function physicalProfile(
  srcHeight: number | null, srcFoot: string | null, srcSide: string | null,
  tgtHeight: number | null, tgtFoot: string | null, tgtSide: string | null,
): number {
  const scores: number[] = [];
  if (srcHeight != null && tgtHeight != null) {
    const diff = Math.abs(srcHeight - tgtHeight);
    if (diff <= 3) scores.push(1.0);
    else if (diff <= 6) scores.push(0.7);
    else if (diff <= 10) scores.push(0.4);
    else scores.push(0.0);
  }
  if (srcFoot && tgtFoot) {
    scores.push(srcFoot === tgtFoot ? 1.0 : 0.0);
  }
  if (srcSide != null && tgtSide != null) {
    if (srcSide === tgtSide) scores.push(1.0);
    else if ((srcSide === "C" || !srcSide) && (tgtSide === "C" || !tgtSide)) scores.push(0.5);
    else scores.push(0.3);
  }
  if (scores.length === 0) return 0.5;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

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

export function qualityBand(
  srcLevelOrPeak: number | null,
  tgtLevelOrPeak: number | null,
): number {
  if (srcLevelOrPeak == null || tgtLevelOrPeak == null) return 0.5;
  return Math.max(0, 1.0 - Math.abs(srcLevelOrPeak - tgtLevelOrPeak) / 15);
}

export function clubDiversity(
  srcClubId: number | null, tgtClubId: number | null,
): number {
  if (srcClubId == null || tgtClubId == null) return 1.0;
  return srcClubId === tgtClubId ? 0.0 : 1.0;
}
