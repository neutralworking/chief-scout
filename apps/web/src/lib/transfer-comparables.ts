/**
 * Transfer comparables — TS port of pipeline/lib/comparables.py
 *
 * 7-dimension similarity scoring for finding comparable transfers.
 */

// ── Position grouping ────────────────────────────────────────────────────────

export const POS_GROUPS: Record<string, string> = {
  GK: "GK",
  WD: "DEF",
  CD: "DEF",
  DM: "MID",
  CM: "MID",
  WM: "MID",
  AM: "MID",
  WF: "FWD",
  CF: "FWD",
};

// ── League tiers ─────────────────────────────────────────────────────────────

const LEAGUE_TIERS: Record<string, number> = {
  "Premier League": 1,
  "La Liga": 1,
  Bundesliga: 1,
  "Serie A": 1,
  "Ligue 1": 1,
  Eredivisie: 2,
  "Liga Portugal": 2,
  Championship: 2,
  "Serie B": 2,
  "Bundesliga 2": 2,
  "2. Bundesliga": 2,
  "Belgian Pro League": 2,
  "Primeira Liga": 2,
  "Scottish Premiership": 2,
  "Super Lig": 2,
};

function getLeagueTier(league: string | null): number {
  if (!league) return 3;
  return LEAGUE_TIERS[league] ?? 3;
}

// ── Trajectory adjacency ─────────────────────────────────────────────────────

const TRAJECTORY_ADJACENT: Record<string, Set<string>> = {
  rising: new Set(["newcomer", "peak"]),
  peak: new Set(["rising", "declining", "one-club"]),
  declining: new Set(["peak", "journeyman"]),
  newcomer: new Set(["rising"]),
  journeyman: new Set(["declining"]),
  "one-club": new Set(["peak"]),
};

const TRAJECTORY_OPPOSITE: Record<string, Set<string>> = {
  rising: new Set(["declining"]),
  declining: new Set(["rising"]),
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface TargetPlayer {
  position: string;
  level: number | null;
  age: number;
  archetype: string | null;
  trajectory: string | null;
}

export interface TransferComp {
  player_name: string;
  player_id: number | null;
  position: string | null;
  age_at_transfer: number | null;
  fee_eur_m: number;
  from_club: string;
  to_club: string;
  to_league: string | null;
  transfer_date: string;
  transfer_window: string | null;
  level: number | null;
  profile_archetype: string | null;
  trajectory: string | null;
  confidence: string;
}

export interface ScoredComp {
  player_name: string;
  player_id: number | null;
  position: string;
  age_at_transfer: number;
  fee_eur_m: number;
  from_club: string;
  to_club: string;
  to_league: string | null;
  transfer_date: string;
  transfer_window: string | null;
  similarity: number;
  match_reasons: string[];
  confidence: string;
}

// ── Months since ─────────────────────────────────────────────────────────────

function monthsSince(dateStr: string | null): number {
  if (!dateStr) return 36;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

// ── Core scoring ─────────────────────────────────────────────────────────────

export function computeSimilarity(target: TargetPlayer, comp: TransferComp): number {
  let score = 0;

  // 1. Position (0.25)
  const tPos = target.position;
  const cPos = comp.position ?? "";
  if (tPos === cPos) {
    score += 0.25;
  } else if (POS_GROUPS[tPos] === POS_GROUPS[cPos] && POS_GROUPS[tPos]) {
    score += 0.125;
  }

  // 2. Level band (0.20)
  if (target.level != null && comp.level != null) {
    const diff = Math.abs(target.level - comp.level);
    if (diff <= 2) score += 0.20;
    else if (diff <= 4) score += 0.12;
    else if (diff <= 7) score += 0.06;
  } else {
    score += 0.10;
  }

  // 3. Age band (0.15)
  if (comp.age_at_transfer != null) {
    const diff = Math.abs(target.age - comp.age_at_transfer);
    if (diff <= 1) score += 0.15;
    else if (diff === 2) score += 0.105;
    else if (diff === 3) score += 0.06;
  } else {
    score += 0.075;
  }

  // 4. Archetype (0.15)
  const tArch = target.archetype?.toLowerCase();
  const cArch = (comp.profile_archetype ?? "").toLowerCase();
  if (tArch && cArch && tArch === cArch) {
    score += 0.15;
  } else if (!tArch || !cArch) {
    score += 0.075;
  }

  // 5. League tier (0.10)
  const cTier = getLeagueTier(comp.to_league);
  const tierDiff = Math.abs(1 - cTier); // target assumed tier 1
  if (tierDiff === 0) score += 0.10;
  else if (tierDiff === 1) score += 0.05;
  else score += 0.02;

  // 6. Trajectory (0.10)
  const tTraj = target.trajectory;
  const cTraj = comp.trajectory;
  if (tTraj && cTraj) {
    if (tTraj === cTraj) {
      score += 0.10;
    } else if (TRAJECTORY_ADJACENT[tTraj]?.has(cTraj)) {
      score += 0.05;
    } else if (TRAJECTORY_OPPOSITE[tTraj]?.has(cTraj)) {
      score += 0;
    } else {
      score += 0.025;
    }
  } else {
    score += 0.05;
  }

  // 7. Recency (0.05)
  const months = monthsSince(comp.transfer_date);
  if (months <= 6) score += 0.05;
  else if (months <= 12) score += 0.04;
  else if (months <= 24) score += 0.025;
  else score += 0.01;

  // Confidence multiplier
  if (comp.confidence === "low") score *= 0.6;
  else if (comp.confidence === "high") score *= 1.1;

  return Math.min(1.0, score);
}

// ── Match reasons ────────────────────────────────────────────────────────────

export function buildMatchReasons(target: TargetPlayer, comp: TransferComp): string[] {
  const reasons: string[] = [];

  if (target.position === (comp.position ?? "")) {
    reasons.push("Same position");
  } else if (POS_GROUPS[target.position] === POS_GROUPS[comp.position ?? ""]) {
    reasons.push("Same position group");
  }

  if (target.level != null && comp.level != null) {
    const diff = Math.abs(target.level - comp.level);
    if (diff <= 2) reasons.push("Similar level");
  }

  if (comp.age_at_transfer != null) {
    const diff = Math.abs(target.age - comp.age_at_transfer);
    if (diff <= 1) reasons.push(`Age ${diff === 0 ? "match" : "\u00b11"}`);
  }

  const tArch = target.archetype?.toLowerCase();
  const cArch = (comp.profile_archetype ?? "").toLowerCase();
  if (tArch && cArch && tArch === cArch) {
    reasons.push("Same archetype");
  }

  if (target.trajectory && comp.trajectory && target.trajectory === comp.trajectory) {
    reasons.push("Same trajectory");
  }

  const months = monthsSince(comp.transfer_date);
  if (months <= 12) reasons.push("Recent");

  return reasons;
}

// ── Weighted median ──────────────────────────────────────────────────────────

export function weightedMedian(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const pairs = values
    .map((v, i) => ({ value: v, weight: weights[i] }))
    .sort((a, b) => a.value - b.value);

  const totalWeight = pairs.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return pairs[Math.floor(pairs.length / 2)].value;

  const half = totalWeight / 2;
  let cumulative = 0;
  for (const { value, weight } of pairs) {
    cumulative += weight;
    if (cumulative >= half) return value;
  }

  return pairs[pairs.length - 1].value;
}
