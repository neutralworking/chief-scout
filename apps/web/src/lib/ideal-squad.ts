/**
 * Ideal Squad Computation — World Cup "On The Plane" game.
 *
 * Given a national player pool, computes the best 26-man squad and starting XI
 * by trying multiple formations and scoring players via formation-intelligence.ts.
 */

import {
  FORMATION_BLUEPRINTS,
  scorePlayerForSlot,
  type FormationBlueprint,
} from "@/lib/formation-intelligence";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PoolPlayer {
  person_id: number;
  name: string;
  position: string | null;
  level: number | null;
  overall_pillar_score: number | null;
  archetype: string | null;
  personality_type: string | null;
  age: number | null;
  club: string | null;
  best_role: string | null;
  best_role_score: number | null;
  international_caps: number | null;
  has_national_team_history: boolean;
  pool_category?: PoolCategory;
}

export type PoolCategory =
  | "established"
  | "rising_star"
  | "form_pick"
  | "uncapped"
  | "recall";

export interface IdealSquadResult {
  formation: string;
  starting_xi: SquadSlot[];
  bench: SquadBenchPlayer[];
  strength: number;
}

export interface SquadSlot {
  person_id: number;
  name: string;
  position: string;
  role: string;
  role_score: number;
  pool_category: PoolCategory;
}

export interface SquadBenchPlayer {
  person_id: number;
  name: string;
  position: string;
  pool_category: PoolCategory;
  overall: number;
}

// ── Pool Category Logic ──────────────────────────────────────────────────────

export function categorizePlayer(
  player: PoolPlayer,
  positionTopOveralls: Map<string, number[]>
): PoolCategory {
  const age = player.age ?? 30;
  const caps = player.international_caps ?? 0;
  const hasHistory = player.has_national_team_history;
  const overall = player.overall_pillar_score ?? player.level ?? 0;

  // Established: 10+ caps or confirmed national team career history
  if (caps >= 10 || hasHistory) {
    // Recall: over 28, had international history, but low caps suggests inactive
    if (age > 30 && caps > 0 && caps < 50) {
      return "recall";
    }
    return "established";
  }

  // Rising Star: 23 or under with decent level
  if (age <= 23 && (player.level ?? 0) >= 10) {
    return "rising_star";
  }

  // Form Pick: top 20% overall for their position group
  const pos = player.position ?? "CM";
  const topOveralls = positionTopOveralls.get(pos);
  if (topOveralls && topOveralls.length > 0) {
    const threshold = topOveralls[Math.floor(topOveralls.length * 0.2)] ?? 0;
    if (overall >= threshold) {
      return "form_pick";
    }
  }

  return "uncapped";
}

export function categorizePool(players: PoolPlayer[]): PoolPlayer[] {
  // Compute position-wise sorted overalls for form pick threshold
  const positionOveralls = new Map<string, number[]>();
  for (const p of players) {
    const pos = p.position ?? "CM";
    const arr = positionOveralls.get(pos) ?? [];
    arr.push(p.overall_pillar_score ?? p.level ?? 0);
    positionOveralls.set(pos, arr);
  }
  // Sort descending
  for (const [, arr] of positionOveralls) {
    arr.sort((a, b) => b - a);
  }

  return players.map((p) => ({
    ...p,
    pool_category: categorizePlayer(p, positionOveralls),
  }));
}

// ── Position Groups ──────────────────────────────────────────────────────────

const POS_GROUP: Record<string, string> = {
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

function posGroup(pos: string): string {
  return POS_GROUP[pos] ?? "MID";
}

// ── Candidate Formations ─────────────────────────────────────────────────────
// Only use formations with blueprints (they have explicit role assignments)

const CANDIDATE_FORMATIONS = [
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "4-4-2",
  "3-4-3",
  "4-1-2-1-2",
] as const;

// ── Core Algorithm ───────────────────────────────────────────────────────────

function flattenBlueprint(bp: FormationBlueprint): { position: string; role: string }[] {
  const slots: { position: string; role: string }[] = [];
  for (const [pos, slotArr] of Object.entries(bp.slots)) {
    for (const slot of slotArr) {
      slots.push({ position: pos, role: slot.role });
    }
  }
  return slots;
}

function scoreFormation(
  formationName: string,
  players: PoolPlayer[]
): { xi: SquadSlot[]; totalScore: number } | null {
  const bp = FORMATION_BLUEPRINTS[formationName];
  if (!bp) return null;

  const slots = flattenBlueprint(bp);
  const used = new Set<number>();
  const xi: SquadSlot[] = [];
  let totalScore = 0;

  for (const slot of slots) {
    // Find best unused player for this role
    let bestPlayer: PoolPlayer | null = null;
    let bestScore = -Infinity;

    for (const p of players) {
      if (used.has(p.person_id)) continue;
      const s = scorePlayerForSlot(
        {
          level: p.level,
          position: p.position,
          best_role_score: p.best_role_score,
        },
        slot.position
      );
      if (s > bestScore) {
        bestScore = s;
        bestPlayer = p;
      }
    }

    if (!bestPlayer) return null; // not enough players

    used.add(bestPlayer.person_id);
    xi.push({
      person_id: bestPlayer.person_id,
      name: bestPlayer.name,
      position: slot.position,
      role: slot.role,
      role_score: bestScore,
      pool_category: bestPlayer.pool_category ?? "uncapped",
    });
    totalScore += bestScore;
  }

  return { xi, totalScore };
}

/**
 * Compute the ideal 26-man squad and starting XI for a national pool.
 */
export function computeIdealSquad(rawPlayers: PoolPlayer[]): IdealSquadResult | null {
  if (rawPlayers.length < 11) return null;

  const players = categorizePool(rawPlayers);

  // Try each candidate formation — pick the one with highest total XI score
  let bestFormation = "";
  let bestXI: SquadSlot[] = [];
  let bestScore = -Infinity;

  for (const fname of CANDIDATE_FORMATIONS) {
    const result = scoreFormation(fname, players);
    if (result && result.totalScore > bestScore) {
      bestScore = result.totalScore;
      bestXI = result.xi;
      bestFormation = fname;
    }
  }

  if (!bestFormation || bestXI.length === 0) return null;

  // Fill the remaining 15 bench spots (26 total - 11 starters)
  const starterIds = new Set(bestXI.map((s) => s.person_id));
  const remaining = players.filter((p) => !starterIds.has(p.person_id));

  // Sort remaining by overall score descending
  remaining.sort(
    (a, b) =>
      (b.overall_pillar_score ?? b.level ?? 0) -
      (a.overall_pillar_score ?? a.level ?? 0)
  );

  // Ensure positional balance: need 2 backup GKs + balanced DEF/MID/FWD
  const bench: SquadBenchPlayer[] = [];
  const benchGroups: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

  // Count starters per group
  const starterGroups: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const s of bestXI) {
    starterGroups[posGroup(s.position)] = (starterGroups[posGroup(s.position)] ?? 0) + 1;
  }

  // First pass: enforce minimums (2 backup GKs, then positional needs)
  const MIN_BENCH: Record<string, number> = { GK: 2, DEF: 4, MID: 4, FWD: 3 };
  const targetBenchSize = Math.min(15, remaining.length);

  // Priority fill: GKs first (need exactly 2 backup GKs for 3 total)
  for (const p of remaining) {
    if (bench.length >= targetBenchSize) break;
    const grp = posGroup(p.position ?? "CM");
    if (grp === "GK" && benchGroups.GK < 2) {
      bench.push({
        person_id: p.person_id,
        name: p.name,
        position: p.position ?? "GK",
        pool_category: p.pool_category ?? "uncapped",
        overall: p.overall_pillar_score ?? p.level ?? 0,
      });
      benchGroups.GK++;
    }
  }

  const benchedIds = new Set(bench.map((b) => b.person_id));

  // Second pass: fill remaining bench spots by best available, enforcing mins
  for (const p of remaining) {
    if (bench.length >= targetBenchSize) break;
    if (benchedIds.has(p.person_id)) continue;

    const grp = posGroup(p.position ?? "CM");

    // Skip if this group is already above minimum and another group needs filling
    const needsFilling = Object.entries(MIN_BENCH).some(
      ([g, min]) => benchGroups[g] < min && g !== "GK"
    );
    if (needsFilling && benchGroups[grp] >= (MIN_BENCH[grp] ?? 3)) continue;

    bench.push({
      person_id: p.person_id,
      name: p.name,
      position: p.position ?? "CM",
      pool_category: p.pool_category ?? "uncapped",
      overall: p.overall_pillar_score ?? p.level ?? 0,
    });
    benchGroups[grp] = (benchGroups[grp] ?? 0) + 1;
    benchedIds.add(p.person_id);
  }

  // Final pass: fill any remaining spots with best available
  for (const p of remaining) {
    if (bench.length >= targetBenchSize) break;
    if (benchedIds.has(p.person_id)) continue;

    bench.push({
      person_id: p.person_id,
      name: p.name,
      position: p.position ?? "CM",
      pool_category: p.pool_category ?? "uncapped",
      overall: p.overall_pillar_score ?? p.level ?? 0,
    });
    benchedIds.add(p.person_id);
  }

  // Strength = average role score of starting XI (already 0-99 scale from pipeline 27)
  const avgRoleScore =
    bestXI.reduce((sum, s) => sum + s.role_score, 0) / bestXI.length;
  const strength = Math.min(100, Math.round(avgRoleScore));

  return {
    formation: bestFormation,
    starting_xi: bestXI,
    bench,
    strength,
  };
}

// ── Score User Squad vs Ideal ────────────────────────────────────────────────

export interface SquadComparisonResult {
  squad_matches: number;
  xi_matches: number;
  formation_match: boolean;
  score: number; // 0-100
  tier: string;
}

const SCORE_TIERS = [
  { min: 90, label: "Chief Scout Material" },
  { min: 75, label: "International Manager" },
  { min: 60, label: "National Selector" },
  { min: 45, label: "Armchair Manager" },
  { min: 30, label: "Pub Expert" },
  { min: 0, label: "Back to FM" },
];

export function compareSquads(
  userSquadIds: number[],
  userXIIds: number[],
  userFormation: string,
  ideal: IdealSquadResult
): SquadComparisonResult {
  const idealSquadIds = new Set([
    ...ideal.starting_xi.map((s) => s.person_id),
    ...ideal.bench.map((b) => b.person_id),
  ]);
  const idealXIIds = new Set(ideal.starting_xi.map((s) => s.person_id));

  const squadMatches = userSquadIds.filter((id) => idealSquadIds.has(id)).length;
  const xiMatches = userXIIds.filter((id) => idealXIIds.has(id)).length;
  const formationMatch = userFormation === ideal.formation;

  // Score: 50% squad overlap + 35% XI overlap + 15% formation match
  const squadScore = (squadMatches / 26) * 50;
  const xiScore = (xiMatches / 11) * 35;
  const formScore = formationMatch ? 15 : 0;
  const score = Math.round(squadScore + xiScore + formScore);

  const tier = SCORE_TIERS.find((t) => score >= t.min)?.label ?? "Back to FM";

  return { squad_matches: squadMatches, xi_matches: xiMatches, formation_match: formationMatch, score, tier };
}
