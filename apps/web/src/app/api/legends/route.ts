import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/legends — Retired players (legends), sorted by peak level.
 *
 * Query params:
 *   position — filter by position
 *   q — name search
 *   sort — peak (default), level, overall, name
 *   limit, offset — pagination
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") ?? "peak";
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const offset = Number(searchParams.get("offset") || 0);

  // Peak is now in the view directly
  let query = supabase
    .from("player_intelligence_card")
    .select("person_id, name, dob, nation, position, level, peak, overall, archetype, personality_type, best_role, best_role_score, fingerprint")
    .eq("active", false);

  if (position) query = query.eq("position", position);
  if (q) query = query.ilike("name", `%${q}%`);

  switch (sort) {
    case "role_score":
      query = query.order("best_role_score", { ascending: false, nullsFirst: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "peak":
    default:
      query = query.order("peak", { ascending: false, nullsFirst: false });
      break;
  }

  query = query.order("person_id", { ascending: true }); // tiebreaker
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Batch-fetch traits for returned legends
  const playerIds = (data ?? []).map((p: { person_id: number }) => p.person_id);
  const traitMap: Record<number, { trait: string; category: string; severity: number }[]> = {};

  if (playerIds.length > 0) {
    const { data: traitData } = await supabase
      .from("player_trait_scores")
      .select("player_id, trait, category, severity, source")
      .in("player_id", playerIds);

    // Deduplicate: prefer editor over scout/inferred for same trait
    for (const t of traitData ?? []) {
      const arr = (traitMap[t.player_id] ??= []);
      const existing = arr.find((e: { trait: string }) => e.trait === t.trait);
      if (!existing) {
        arr.push({ trait: t.trait, category: t.category, severity: t.severity });
      } else if (t.source === "editor") {
        existing.severity = t.severity;
      }
    }
  }

  const players = (data ?? []).map((p: { person_id: number }) => ({
    ...p,
    traits: traitMap[p.person_id] ?? [],
  }));

  return NextResponse.json({
    players,
    hasMore: (data ?? []).length === limit,
  });
}
