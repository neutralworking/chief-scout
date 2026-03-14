/**
 * POST /api/admin/valuation
 *
 * Runs the transfer valuation engine on players with profiles.
 *
 * Query params:
 *   mode     — scout_dominant | balanced | data_dominant (default: scout_dominant)
 *   limit    — max players to value (default: all)
 *   player   — single person_id
 *   force    — overwrite existing valuations (default: false)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import {
  buildPlayerProfile,
  runValuation,
  type SupabasePlayerData,
} from "@/lib/valuation/engine";
import type { ValuationMode, ValuationResult } from "@/lib/valuation/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "scout_dominant") as ValuationMode;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : null;
  const playerFilter = searchParams.get("player");
  const force = searchParams.get("force") === "true";

  // 1. Find players to value
  let query = supabaseServer
    .from("player_profiles")
    .select("person_id, position, level, profile_tier")
    .not("position", "is", null);

  if (playerFilter) {
    query = query.eq("person_id", parseInt(playerFilter));
  }

  query = query.order("level", { ascending: false, nullsFirst: false });
  if (limit) query = query.limit(limit);

  const { data: profiles, error: profilesErr } = await query;
  if (profilesErr) {
    return NextResponse.json({ ok: false, error: profilesErr.message }, { status: 500 });
  }
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, valued: 0, errors: 0, message: "No players to value" });
  }

  // 2. Check existing valuations (skip unless force)
  let existingIds = new Set<number>();
  if (!force) {
    const { data: existing } = await supabaseServer
      .from("player_valuations")
      .select("person_id")
      .eq("mode", mode);
    if (existing) {
      existingIds = new Set(existing.map((e: { person_id: number }) => e.person_id));
    }
  }

  const toValue = profiles.filter((p: { person_id: number }) => force || !existingIds.has(p.person_id));
  if (toValue.length === 0) {
    return NextResponse.json({ ok: true, valued: 0, errors: 0, message: "All players already valued" });
  }

  // 3. Load and value each player
  const results: ValuationResult[] = [];
  const errors: string[] = [];

  for (const prof of toValue) {
    try {
      const playerData = await loadPlayerData(prof.person_id);
      if (!playerData) continue;

      const profile = buildPlayerProfile(playerData);
      const result = runValuation(profile, mode);
      results.push(result);
    } catch (e) {
      errors.push(`${prof.person_id}: ${e instanceof Error ? e.message : String(e)}`);
      if (errors.length >= 10) break;
    }
  }

  // 4. Write results
  let written = 0;
  for (const r of results) {
    const row = {
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
    };

    // Upsert (delete old + insert) when force
    if (force) {
      await supabaseServer
        .from("player_valuations")
        .delete()
        .eq("person_id", r.person_id)
        .eq("mode", mode);
    }

    const { error: insertErr } = await supabaseServer
      .from("player_valuations")
      .insert(row);

    if (insertErr) {
      errors.push(`Write ${r.person_id}: ${insertErr.message}`);
    } else {
      written++;
    }
  }

  // 5. Return summary + top results
  const top = results
    .sort((a, b) => b.market_value.central - a.market_value.central)
    .slice(0, 20)
    .map((r) => ({
      name: r.name,
      position: r.position,
      age: r.age,
      p10: r.market_value.p10,
      p50: r.market_value.central,
      p90: r.market_value.p90,
      confidence: r.confidence.overall_confidence,
    }));

  return NextResponse.json({
    ok: true,
    valued: results.length,
    written,
    errors: errors.length,
    errorDetails: errors.slice(0, 5),
    top,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function loadPlayerData(personId: number): Promise<SupabasePlayerData | null> {
  if (!supabaseServer) return null;

  // Run all queries in parallel
  const [personRes, profileRes, persRes, marketRes, statusRes, gradesRes, careerRes, tagsRes] =
    await Promise.all([
      supabaseServer
        .from("people")
        .select("id, name, date_of_birth, height_cm, preferred_foot, club_id, clubs(name, league_name)")
        .eq("id", personId)
        .single(),
      supabaseServer
        .from("player_profiles")
        .select("position, level, profile_tier")
        .eq("person_id", personId)
        .single(),
      supabaseServer
        .from("player_personality")
        .select("ei, sn, tf, jp")
        .eq("person_id", personId)
        .maybeSingle(),
      supabaseServer
        .from("player_market")
        .select("transfer_fee_eur")
        .eq("person_id", personId)
        .maybeSingle(),
      supabaseServer
        .from("player_status")
        .select("contract_tag")
        .eq("person_id", personId)
        .maybeSingle(),
      supabaseServer
        .from("attribute_grades")
        .select("attribute, scout_grade, stat_score, source, is_inferred")
        .eq("player_id", personId),
      supabaseServer
        .from("career_metrics")
        .select("trajectory")
        .eq("person_id", personId)
        .maybeSingle(),
      supabaseServer
        .from("player_tags")
        .select("tags(name)")
        .eq("player_id", personId),
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
