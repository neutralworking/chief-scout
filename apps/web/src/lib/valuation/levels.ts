/**
 * Player Level Inference Engine — TypeScript port of 38_infer_levels + 39_current_level
 *
 * Two-phase approach:
 *   1. Infer base level from compound scores (Technical, Tactical, Physical, Mental)
 *   2. Apply age-decay curve to get realistic current level
 *
 * Writes: player_profiles.level
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Position-group calibration (from 38_infer_levels.py seed data) ──────────

const POSITION_GROUPS: Record<string, string> = {
  GK: "GK", CD: "DEF", WD: "DEF", DM: "MID", CM: "MID",
  WM: "MID", AM: "MID", WF: "FWD", CF: "FWD",
};

// Regression coefficients per position group: [intercept, tech, tac, phy, men]
// Derived from hand-graded seed players (model_id NOT NULL)
const REGRESSION_COEFFICIENTS: Record<string, number[]> = {
  GK:  [30, 5.0, 3.0, 2.0, 3.5],
  DEF: [28, 2.5, 5.5, 4.0, 3.0],
  MID: [25, 4.5, 4.0, 2.5, 4.5],
  FWD: [27, 5.0, 2.0, 3.5, 3.5],
};

// ── Age curve constants (from 39_current_level.py) ──────────────────────────

const PEAK_WINDOWS: Record<string, [number, number]> = {
  GK:  [28, 34],
  DEF: [26, 31],
  MID: [25, 30],
  FWD: [25, 29],
};

const DECAY_RATES: Record<string, number> = {
  GK: -1.5, DEF: -2.0, MID: -2.0, FWD: -2.5,
};

const GROWTH_START_AGE = 16;
const GROWTH_START_PCT = 0.60;
const CLIFF_AGE = 35;
const CLIFF_EXTRA = -0.5;

// ── Core logic ──────────────────────────────────────────────────────────────

function inferLevelFromCompounds(
  compounds: Record<string, number>,
  posGroup: string,
): number | null {
  const tech = compounds["technical"];
  const tac = compounds["tactical"];
  const phy = compounds["physical"];
  const men = compounds["mental"];

  // Need at least 3 of 4 compound scores
  const scores = [tech, tac, phy, men].filter((s) => s != null && s > 0);
  if (scores.length < 3) return null;

  const coeffs = REGRESSION_COEFFICIENTS[posGroup] ?? REGRESSION_COEFFICIENTS["MID"];
  const level =
    coeffs[0] +
    (tech ?? 0) * coeffs[1] / 10 +
    (tac ?? 0) * coeffs[2] / 10 +
    (phy ?? 0) * coeffs[3] / 10 +
    (men ?? 0) * coeffs[4] / 10;

  return Math.round(Math.min(Math.max(level, 40), 99));
}

function applyAgeCurve(
  peak: number,
  age: number,
  posGroup: string,
): number {
  const [peakStart, peakEnd] = PEAK_WINDOWS[posGroup] ?? [26, 30];
  const decayRate = DECAY_RATES[posGroup] ?? -2.0;

  let factor: number;

  if (age < peakStart) {
    // Growth phase: linear from 60% at 16 to 100% at peak_start
    const growthSpan = peakStart - GROWTH_START_AGE;
    const progress = Math.min(Math.max((age - GROWTH_START_AGE) / growthSpan, 0), 1);
    factor = GROWTH_START_PCT + progress * (1 - GROWTH_START_PCT);
  } else if (age <= peakEnd) {
    // Peak window
    factor = 1.0;
  } else {
    // Decay phase
    const yearsDecay = age - peakEnd;
    let totalDecay = yearsDecay * decayRate;
    if (age > CLIFF_AGE) {
      totalDecay += (age - CLIFF_AGE) * CLIFF_EXTRA;
    }
    factor = Math.max(0.4, 1 + totalDecay / 100);
  }

  return Math.round(Math.min(Math.max(peak * factor, 40), 99));
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface LevelsResult {
  evaluated: number;
  inferred: number;
  ageDecayed: number;
  written: number;
  skipped: number;
  errors: string[];
}

export async function runLevels(
  sb: SupabaseClient,
  options: { limit?: number; force?: boolean } = {},
): Promise<LevelsResult> {
  const result: LevelsResult = {
    evaluated: 0, inferred: 0, ageDecayed: 0,
    written: 0, skipped: 0, errors: [],
  };

  // 1. Load profiles
  const { data: profiles, error: profileErr } = await sb
    .from("player_profiles")
    .select("person_id, position, level, peak, model_id")
    .not("position", "is", null);

  if (profileErr || !profiles) {
    result.errors.push(profileErr?.message ?? "No profiles");
    return result;
  }

  // 2. Load compound scores (source='computed')
  const { data: compounds, error: compErr } = await sb
    .from("attribute_grades")
    .select("player_id, attribute, stat_score")
    .eq("source", "computed")
    .in("attribute", ["technical", "tactical", "physical", "mental"]);

  if (compErr) {
    result.errors.push(compErr.message);
    return result;
  }

  // Group compounds by player
  const compoundMap: Record<number, Record<string, number>> = {};
  for (const c of (compounds ?? []) as { player_id: number; attribute: string; stat_score: number }[]) {
    (compoundMap[c.player_id] ??= {})[c.attribute] = c.stat_score;
  }

  // 3. Load DOBs for age curve
  const personIds = (profiles as { person_id: number }[]).map((p) => p.person_id);
  const { data: people } = await sb
    .from("people")
    .select("id, date_of_birth")
    .in("id", personIds);

  const dobMap: Record<number, string | null> = {};
  for (const p of (people ?? []) as { id: number; date_of_birth: string | null }[]) {
    dobMap[p.id] = p.date_of_birth;
  }

  // 4. Load hand-edited levels to protect them
  const { data: edits } = await sb
    .from("network_edits")
    .select("person_id")
    .eq("field", "level")
    .eq("table_name", "player_profiles");
  const editedIds = new Set((edits ?? []).map((e: { person_id: number }) => e.person_id));

  // 5. Process
  let toProcess = profiles as {
    person_id: number; position: string;
    level: number | null; peak: number | null; model_id: number | null;
  }[];
  if (options.limit) toProcess = toProcess.slice(0, options.limit);

  const updates: { person_id: number; level: number }[] = [];

  for (const p of toProcess) {
    result.evaluated++;
    const posGroup = POSITION_GROUPS[p.position] ?? "MID";

    // Skip hand-edited unless forced
    if (!options.force && editedIds.has(p.person_id)) {
      result.skipped++;
      continue;
    }

    // Phase 1: Infer base level from compounds if missing or not hand-graded
    let baseLevel = p.level;
    const isHandGraded = p.model_id != null;

    if (baseLevel == null || (!isHandGraded && options.force)) {
      const playerCompounds = compoundMap[p.person_id];
      if (playerCompounds) {
        const inferred = inferLevelFromCompounds(playerCompounds, posGroup);
        if (inferred != null) {
          baseLevel = inferred;
          result.inferred++;
        }
      }
    }

    if (baseLevel == null) {
      result.skipped++;
      continue;
    }

    // Phase 2: Age decay
    const dob = dobMap[p.person_id];
    let finalLevel = baseLevel;
    if (dob) {
      const age = Math.floor(
        (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      );
      const peak = p.peak ?? baseLevel;
      const ageDecayed = applyAgeCurve(peak, age, posGroup);
      // Blend: for hand-graded, trust existing level more
      if (isHandGraded) {
        finalLevel = Math.round(baseLevel * 0.6 + ageDecayed * 0.4);
      } else {
        finalLevel = ageDecayed;
      }
      result.ageDecayed++;
    }

    if (finalLevel !== p.level) {
      updates.push({ person_id: p.person_id, level: finalLevel });
    }
  }

  // 6. Write
  const CHUNK = 200;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const { error } = await sb.from("player_profiles").upsert(chunk, { onConflict: "person_id" });
    if (error) result.errors.push(error.message);
    else result.written += chunk.length;
  }

  return result;
}
