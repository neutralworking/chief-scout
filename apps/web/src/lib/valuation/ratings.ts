/**
 * Player Ratings Engine — TypeScript port of 27_player_ratings.py
 *
 * Computes composite overall ratings from attribute grades:
 *   attribute_grades → 13 model scores → 4 compound scores → position-weighted overall
 *
 * Writes: player_profiles.overall, attribute_grades (source='computed')
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { MODEL_ATTRIBUTES, SOURCE_PRIORITY } from "@/lib/models";

// ── Constants ─────────────────────────────────────────────────────────────

const COMPOUND_MODELS: Record<string, string[]> = {
  Technical: ["Dribbler", "Passer", "Striker", "GK"],
  Tactical: ["Cover", "Destroyer", "Engine"],
  Physical: ["Sprinter", "Powerhouse", "Target"],
  Mental: ["Controller", "Commander", "Creator"],
};

const POSITION_COMPOUND_WEIGHTS: Record<string, Record<string, number>> = {
  GK: { Technical: 0.5, Tactical: 0.2, Physical: 0.1, Mental: 0.2 },
  CD: { Technical: 0.1, Tactical: 0.4, Physical: 0.3, Mental: 0.2 },
  WD: { Technical: 0.2, Tactical: 0.3, Physical: 0.3, Mental: 0.2 },
  DM: { Technical: 0.2, Tactical: 0.4, Physical: 0.2, Mental: 0.2 },
  CM: { Technical: 0.3, Tactical: 0.2, Physical: 0.2, Mental: 0.3 },
  WM: { Technical: 0.3, Tactical: 0.2, Physical: 0.3, Mental: 0.2 },
  AM: { Technical: 0.4, Tactical: 0.1, Physical: 0.2, Mental: 0.3 },
  WF: { Technical: 0.3, Tactical: 0.1, Physical: 0.3, Mental: 0.3 },
  CF: { Technical: 0.3, Tactical: 0.1, Physical: 0.3, Mental: 0.3 },
};

// 40-role taxonomy validated against real tactical systems (2026-03-30)
const TACTICAL_ROLES: Record<string, [string, string, string][]> = {
  GK: [["GK", "Commander", "Comandante"], ["GK", "Cover", "Sweeper Keeper"], ["GK", "Passer", "Distributor"], ["GK", "Powerhouse", "Shotstopper"]],
  CD: [["Commander", "Destroyer", "Centrale"], ["Passer", "Cover", "Distributor"], ["Powerhouse", "Destroyer", "Stopper"], ["Cover", "Controller", "Sweeper"]],
  WD: [["Engine", "Passer", "Fullback"], ["Engine", "Dribbler", "Wing-back"], ["Cover", "Destroyer", "Corner Back"], ["Controller", "Passer", "Invertido"]],
  DM: [["Passer", "Controller", "Regista"], ["Controller", "Cover", "Pivote"], ["Cover", "Engine", "Anchor"], ["Destroyer", "Engine", "Ballwinner"], ["Powerhouse", "Engine", "Segundo Volante"]],
  CM: [["Creator", "Passer", "Playmaker"], ["Controller", "Passer", "Metodista"], ["Engine", "Creator", "Mezzala"], ["Engine", "Cover", "Tuttocampista"], ["Engine", "Destroyer", "Ballwinner"]],
  WM: [["Sprinter", "Dribbler", "Winger"], ["Engine", "Cover", "Tornante"], ["Controller", "Creator", "False Winger"], ["Creator", "Passer", "Wide Playmaker"]],
  AM: [["Dribbler", "Creator", "Trequartista"], ["Creator", "Controller", "Enganche"], ["Engine", "Striker", "Incursore"], ["Controller", "Creator", "Mediapunta"]],
  WF: [["Dribbler", "Striker", "Inside Forward"], ["Sprinter", "Dribbler", "Winger"], ["Creator", "Passer", "Wide Playmaker"], ["Target", "Powerhouse", "Wide Target Forward"]],
  CF: [["Striker", "Target", "Prima Punta"], ["Creator", "Controller", "Falso Nove"], ["Engine", "Destroyer", "Spearhead"], ["Target", "Powerhouse", "Target Forward"], ["Creator", "Striker", "Seconda Punta"], ["Sprinter", "Striker", "Shadow Striker"]],
};


// ── Core logic ──────────────────────────────────────────────────────────────

interface GradeRow {
  player_id: number;
  attribute: string;
  scout_grade: number | null;
  stat_score: number | null;
  source: string | null;
}

function computeModelScores(grades: GradeRow[]): Record<string, number> {
  const best: Record<string, { score: number; priority: number; source: string }> = {};
  for (const g of grades) {
    const attr = g.attribute.toLowerCase().replace(/ /g, "_");
    const score = g.scout_grade ?? g.stat_score;
    if (score == null || score <= 0) continue;
    const source = g.source ?? "eafc_inferred";
    const priority = SOURCE_PRIORITY[source] ?? 0;
    if (!best[attr] || priority > best[attr].priority) {
      best[attr] = { score, priority, source };
    }
  }

  const sourcesUsed = new Set(Object.values(best).map((b) => b.source));

  const modelScores: Record<string, number> = {};
  for (const [model, attrs] of Object.entries(MODEL_ATTRIBUTES)) {
    const values = attrs.filter((a) => a in best).map((a) => best[a].score);
    if (values.length >= 2) {
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      modelScores[model] = Math.round(Math.min(avg * 5, 100));
    }
  }

  // Source quality discount: eafc-only data is not real scouting intelligence
  const isEafcOnly = sourcesUsed.size === 1 && sourcesUsed.has("eafc_inferred");
  const isLowQuality = [...sourcesUsed].every((s) => s === "eafc_inferred" || s === "understat");
  const discount = isEafcOnly ? 0.7 : isLowQuality ? 0.85 : 1.0;
  if (discount < 1.0) {
    for (const model of Object.keys(modelScores)) {
      modelScores[model] = Math.round(modelScores[model] * discount);
    }
  }

  return modelScores;
}

function computeCompoundScores(modelScores: Record<string, number>): Record<string, number> {
  const compounds: Record<string, number> = {};
  for (const [compound, models] of Object.entries(COMPOUND_MODELS)) {
    const values = models.filter((m) => m in modelScores).map((m) => modelScores[m]);
    if (values.length > 0) {
      compounds[compound] = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    }
  }
  return compounds;
}

function computeOverall(
  compoundScores: Record<string, number>,
  position: string,
  level: number | null,
): number | null {
  const weights = POSITION_COMPOUND_WEIGHTS[position] ?? {
    Technical: 0.25, Tactical: 0.25, Physical: 0.25, Mental: 0.25,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [compound, weight] of Object.entries(weights)) {
    if (compound in compoundScores) {
      weightedSum += compoundScores[compound] * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight <= 0) return null;
  const technicalOverall = weightedSum / totalWeight;
  // Blend: coverage-scaled tech weight + level anchor (no peak)
  const overall = level != null ? technicalOverall * 0.50 + level * 0.50 : technicalOverall;
  return Math.round(Math.min(Math.max(overall, 1), 99));
}

function computeBestRole(
  modelScores: Record<string, number>,
  position: string,
  level: number | null = null,
): { role: string | null; score: number } {
  const roles = TACTICAL_ROLES[position];
  if (!roles) return { role: null, score: 0 };

  let bestRole: string | null = null;
  let bestRaw = -1;

  // First pass: require both primary and secondary models
  for (const [primary, secondary, name] of roles) {
    if (!(primary in modelScores) || !(secondary in modelScores)) continue;
    const score = modelScores[primary] * 0.6 + modelScores[secondary] * 0.4;
    if (score > bestRaw) {
      bestRaw = score;
      bestRole = name;
    }
  }

  // Fallback: allow roles where at least primary exists
  if (bestRole == null) {
    for (const [primary, secondary, name] of roles) {
      const pScore = modelScores[primary] ?? 0;
      const sScore = modelScores[secondary] ?? 0;
      if (pScore === 0 && sScore === 0) continue;
      const score = pScore * 0.6 + sScore * 0.4;
      if (score > bestRaw) {
        bestRaw = score;
        bestRole = name;
      }
    }
  }

  if (bestRole == null || bestRaw <= 0) return { role: null, score: 0 };

  // Level as quality anchor with cap — role score within ±8 of level, can't exceed it
  const roleScore = level != null
    ? Math.max(Math.max(level - 8, 1), Math.min(bestRaw, level))
    : bestRaw * 0.5;

  return { role: bestRole, score: Math.round(Math.min(Math.max(roleScore, 1), 99)) };
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface RatingsResult {
  computed: number;
  written: number;
  skippedFlat: number;
  skippedNoPosition: number;
  errors: string[];
}

export async function runRatings(
  sb: SupabaseClient,
  options: { limit?: number; force?: boolean } = {},
): Promise<RatingsResult> {
  const result: RatingsResult = { computed: 0, written: 0, skippedFlat: 0, skippedNoPosition: 0, errors: [] };

  // 1. Load all attribute grades
  const { data: gradeRows, error: gradeErr } = await sb
    .from("attribute_grades")
    .select("player_id, attribute, scout_grade, stat_score, source");
  if (gradeErr || !gradeRows) {
    result.errors.push(gradeErr?.message ?? "No grade data");
    return result;
  }

  // Group by player
  const playerGrades: Record<number, GradeRow[]> = {};
  for (const g of gradeRows as GradeRow[]) {
    (playerGrades[g.player_id] ??= []).push(g);
  }

  // 2. Load profiles
  const { data: profiles } = await sb
    .from("player_profiles")
    .select("person_id, position, level")
    .not("position", "is", null);
  const profileMap: Record<number, { position: string; level: number | null }> = {};
  for (const p of (profiles ?? []) as { person_id: number; position: string; level: number | null }[]) {
    profileMap[p.person_id] = { position: p.position, level: p.level };
  }

  // 3. Compute
  let playerIds = Object.keys(playerGrades).map(Number);
  if (options.limit) playerIds = playerIds.slice(0, options.limit);

  const updates: { person_id: number; overall: number; best_role?: string; best_role_score?: number }[] = [];
  const compoundRows: {
    player_id: number; attribute: string;
    stat_score: number; source: string; is_inferred: boolean; updated_at: string;
  }[] = [];
  const now = new Date().toISOString();

  for (const pid of playerIds) {
    const grades = playerGrades[pid];
    const profile = profileMap[pid];
    if (!profile) { result.skippedNoPosition++; continue; }

    const modelScores = computeModelScores(grades);
    if (new Set(Object.values(modelScores)).size <= 2) { result.skippedFlat++; continue; }

    const compoundScores = computeCompoundScores(modelScores);
    const overall = computeOverall(compoundScores, profile.position, profile.level);
    if (overall == null) continue;

    result.computed++;
    const { role: bestRole, score: bestRoleScore } = computeBestRole(modelScores, profile.position, profile.level);
    updates.push({
      person_id: pid,
      overall,
      ...(bestRole ? { best_role: bestRole, best_role_score: bestRoleScore } : {}),
    });

    for (const [compound, score] of Object.entries(compoundScores)) {
      compoundRows.push({
        player_id: pid,
        attribute: compound.toLowerCase(),
        stat_score: Math.max(1, Math.min(10, Math.round(score / 10))),
        source: "computed",
        is_inferred: true,
        updated_at: now,
      });
    }
  }

  // 4. Write
  const CHUNK = 200;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const { error } = await sb.from("player_profiles").upsert(chunk, { onConflict: "person_id" });
    if (error) result.errors.push(`profiles: ${error.message}`);
    else result.written += chunk.length;
  }

  for (let i = 0; i < compoundRows.length; i += CHUNK) {
    const chunk = compoundRows.slice(i, i + CHUNK);
    const { error } = await sb.from("attribute_grades").upsert(chunk, { onConflict: "player_id,attribute,source" });
    if (error) result.errors.push(`compounds: ${error.message}`);
  }

  return result;
}
