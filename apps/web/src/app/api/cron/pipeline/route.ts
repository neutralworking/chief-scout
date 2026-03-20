/**
 * GET /api/cron/pipeline
 *
 * Unified pipeline cron — runs all compute engines in sequence:
 *   1. Ratings (attribute grades → overall rating)
 *   2. Squad Roles (level/trajectory → squad role)
 *   3. Valuations (profile → market value)
 *
 * Triggered by:
 *   - Vercel Cron (daily at 7am UTC, after news cron at 6am)
 *   - Admin panel button (x-admin: 1 header)
 *
 * Query params:
 *   steps  — comma-separated list: ratings,roles,valuations (default: all)
 *   force  — overwrite existing data (default: false)
 *   limit  — max players per step (default: all)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isProduction } from "@/lib/env";
import { runRatings } from "@/lib/valuation/ratings";
import { runSquadRoles } from "@/lib/valuation/squad-roles";
import { runLevels } from "@/lib/valuation/levels";
import {
  buildPlayerProfile,
  runValuation,
  type SupabasePlayerData,
} from "@/lib/valuation/engine";
import type { ValuationMode, ValuationResult } from "@/lib/valuation/types";

export const maxDuration = 120;

type StepResult = {
  step: string;
  status: "success" | "error" | "skipped";
  ms: number;
  detail: Record<string, unknown>;
};

export async function GET(req: NextRequest) {
  // Skip cron on production — pipeline runs on staging only
  if (isProduction()) {
    return NextResponse.json({ ok: true, skipped: "production" });
  }

  // Auth
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isAdmin = req.headers.get("x-admin") === "1";
  if (cronSecret && !isAdmin && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const stepsParam = searchParams.get("steps");
  const force = searchParams.get("force") === "true";
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

  const allSteps = ["levels", "ratings", "roles", "valuations"];
  const steps = stepsParam ? stepsParam.split(",").filter((s) => allSteps.includes(s)) : allSteps;

  const results: StepResult[] = [];

  // ── Step 0: Levels ──────────────────────────────────────────────────────────

  if (steps.includes("levels")) {
    const start = Date.now();
    try {
      const r = await runLevels(supabaseServer, { limit, force });
      results.push({
        step: "levels",
        status: r.errors.length > 0 ? "error" : "success",
        ms: Date.now() - start,
        detail: {
          evaluated: r.evaluated,
          inferred: r.inferred,
          ageDecayed: r.ageDecayed,
          written: r.written,
          skipped: r.skipped,
          errors: r.errors.slice(0, 3),
        },
      });
    } catch (e) {
      results.push({
        step: "levels",
        status: "error",
        ms: Date.now() - start,
        detail: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  // ── Step 1: Ratings ───────────────────────────────────────────────────────

  if (steps.includes("ratings")) {
    const start = Date.now();
    try {
      const r = await runRatings(supabaseServer, { limit, force });
      results.push({
        step: "ratings",
        status: r.errors.length > 0 ? "error" : "success",
        ms: Date.now() - start,
        detail: {
          computed: r.computed,
          written: r.written,
          skippedFlat: r.skippedFlat,
          skippedNoPosition: r.skippedNoPosition,
          errors: r.errors.slice(0, 3),
        },
      });
    } catch (e) {
      results.push({
        step: "ratings",
        status: "error",
        ms: Date.now() - start,
        detail: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  // ── Step 2: Squad Roles ───────────────────────────────────────────────────

  if (steps.includes("roles")) {
    const start = Date.now();
    try {
      const r = await runSquadRoles(supabaseServer);
      results.push({
        step: "roles",
        status: r.errors.length > 0 ? "error" : "success",
        ms: Date.now() - start,
        detail: {
          evaluated: r.evaluated,
          changed: r.changed,
          written: r.written,
          breakdown: r.breakdown,
          errors: r.errors.slice(0, 3),
        },
      });
    } catch (e) {
      results.push({
        step: "roles",
        status: "error",
        ms: Date.now() - start,
        detail: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  // ── Step 3: Valuations ────────────────────────────────────────────────────

  if (steps.includes("valuations")) {
    const start = Date.now();
    try {
      const valResult = await runValuationsStep(supabaseServer, {
        mode: "scout_dominant",
        limit,
        force,
      });
      results.push({
        step: "valuations",
        status: valResult.errors.length > 0 ? "error" : "success",
        ms: Date.now() - start,
        detail: {
          valued: valResult.valued,
          written: valResult.written,
          errors: valResult.errors.slice(0, 3),
        },
      });
    } catch (e) {
      results.push({
        step: "valuations",
        status: "error",
        ms: Date.now() - start,
        detail: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  // ── Log to cron_log ────────────────────────────────────────────────────────

  const totalMs = results.reduce((s, r) => s + r.ms, 0);
  const allOk = results.every((r) => r.status === "success");

  await supabaseServer.from("cron_log").insert({
    job: "pipeline",
    status: allOk ? "success" : "partial",
    stats: { steps: results, total_ms: totalMs },
  }).then(() => {});

  return NextResponse.json({
    ok: allOk,
    steps: results,
    total_ms: totalMs,
  });
}

// ── Valuations helper (reuses engine.ts logic) ──────────────────────────────

async function runValuationsStep(
  sb: NonNullable<typeof supabaseServer>,
  options: { mode: ValuationMode; limit?: number; force?: boolean },
): Promise<{ valued: number; written: number; errors: string[] }> {
  const errors: string[] = [];

  // Find players
  let query = sb
    .from("player_profiles")
    .select("person_id")
    .not("position", "is", null)
    .order("level", { ascending: false, nullsFirst: false });
  if (options.limit) query = query.limit(options.limit);

  const { data: profiles } = await query;
  if (!profiles || profiles.length === 0) return { valued: 0, written: 0, errors: [] };

  // Skip already valued (unless force)
  let toValue = profiles.map((p: { person_id: number }) => p.person_id);
  if (!options.force) {
    const { data: existing } = await sb
      .from("player_valuations")
      .select("person_id")
      .eq("mode", options.mode);
    const existingIds = new Set((existing ?? []).map((e: { person_id: number }) => e.person_id));
    toValue = toValue.filter((id: number) => !existingIds.has(id));
  }

  if (toValue.length === 0) return { valued: 0, written: 0, errors: [] };

  // Load and value
  const results: ValuationResult[] = [];
  for (const pid of toValue) {
    try {
      const data = await loadPlayerDataForValuation(sb, pid);
      if (!data) continue;
      const profile = buildPlayerProfile(data);
      results.push(runValuation(profile, options.mode));
    } catch (e) {
      errors.push(`${pid}: ${e instanceof Error ? e.message : String(e)}`);
      if (errors.length >= 10) break;
    }
  }

  // Write
  let written = 0;
  for (const r of results) {
    if (options.force) {
      await sb.from("player_valuations").delete().eq("person_id", r.person_id).eq("mode", options.mode);
    }
    const { error } = await sb.from("player_valuations").insert({
      person_id: r.person_id,
      market_value_p10: r.market_value.p10,
      market_value_p25: r.market_value.p25,
      market_value_p50: r.market_value.central,
      market_value_p75: r.market_value.p75,
      market_value_p90: r.market_value.p90,
      scout_profile_pct: r.decomposition.scout_profile_pct,
      performance_data_pct: r.decomposition.performance_data_pct,
      contract_age_pct: r.decomposition.contract_age_pct,
      market_context_pct: r.decomposition.market_context_pct,
      personality_adj_pct: r.decomposition.personality_adj_pct,
      profile_confidence: r.confidence.profile_confidence,
      data_coverage: r.confidence.data_coverage,
      overall_confidence: r.confidence.overall_confidence,
      band_width_ratio: r.confidence.band_width_ratio,
      personality_risk_flags: r.personality_risk_flags,
      mode: r.mode,
      target_position: r.position,
      model_version: "v1.0-ts",
      narrative: r.narrative,
      evaluated_at: new Date().toISOString(),
    });
    if (error) errors.push(`write ${r.person_id}: ${error.message}`);
    else written++;
  }

  return { valued: results.length, written, errors };
}

async function loadPlayerDataForValuation(
  sb: NonNullable<typeof supabaseServer>,
  personId: number,
): Promise<SupabasePlayerData | null> {
  const [personRes, profileRes, persRes, marketRes, statusRes, gradesRes, careerRes, tagsRes] =
    await Promise.all([
      sb.from("people").select("id, name, date_of_birth, height_cm, preferred_foot, club_id, clubs(name, league_name)").eq("id", personId).single(),
      sb.from("player_profiles").select("position, level, profile_tier").eq("person_id", personId).single(),
      sb.from("player_personality").select("ei, sn, tf, jp").eq("person_id", personId).maybeSingle(),
      sb.from("player_market").select("transfer_fee_eur").eq("person_id", personId).maybeSingle(),
      sb.from("player_status").select("contract_tag").eq("person_id", personId).maybeSingle(),
      sb.from("attribute_grades").select("attribute, scout_grade, stat_score, source, is_inferred").eq("player_id", personId),
      sb.from("career_metrics").select("trajectory").eq("person_id", personId).maybeSingle(),
      sb.from("player_tags").select("tags(name)").eq("player_id", personId),
    ]);

  if (!personRes.data) return null;
  const person = personRes.data as Record<string, unknown>;
  const club = person.clubs as { name: string; league_name: string } | null;

  return {
    person: {
      id: person.id as number,
      name: person.name as string,
      date_of_birth: person.date_of_birth as string | null,
      height_cm: person.height_cm as number | null,
      preferred_foot: person.preferred_foot as string | null,
      club_id: person.club_id as number | null,
      club_name: club?.name ?? null,
      league: club?.league_name ?? null,
    },
    profile: profileRes.data,
    personality: persRes.data,
    market: marketRes.data,
    status: statusRes.data,
    grades: (gradesRes.data ?? []) as SupabasePlayerData["grades"],
    trajectory: (careerRes.data as { trajectory: string | null } | null)?.trajectory ?? null,
    tags: ((tagsRes.data ?? []) as unknown as { tags: { name: string } | null }[])
      .map((t) => t.tags?.name)
      .filter((n): n is string => n != null),
  };
}
