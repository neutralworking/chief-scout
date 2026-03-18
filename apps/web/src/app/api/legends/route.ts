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

  // Query retired players with profile data + peak from player_profiles
  let query = supabase
    .from("player_intelligence_card")
    .select("person_id, name, dob, height_cm, preferred_foot, nation, club, club_id, position, level, overall, archetype, model_id, profile_tier, personality_type, best_role, best_role_score, fingerprint")
    .eq("active", false);

  if (position) query = query.eq("position", position);
  if (q) query = query.ilike("name", `%${q}%`);

  switch (sort) {
    case "level":
      query = query.order("level", { ascending: false, nullsFirst: false });
      break;
    case "overall":
      query = query.order("overall", { ascending: false, nullsFirst: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "peak":
    default:
      // Peak not in view — use level as proxy (peak ≈ level for retired players)
      query = query.order("level", { ascending: false, nullsFirst: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const players = data ?? [];

  // Enrich with peak from player_profiles
  if (players.length > 0) {
    const ids = players.map((p: { person_id: number }) => p.person_id);
    const { data: peaks } = await supabase
      .from("player_profiles")
      .select("person_id, peak")
      .in("person_id", ids);

    const peakMap = new Map<number, number | null>();
    for (const row of peaks ?? []) {
      peakMap.set(row.person_id, row.peak);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of players as any[]) {
      p.peak = peakMap.get(p.person_id) ?? p.level ?? null;
    }

    // Re-sort by peak if that's the sort order (since we couldn't sort in the view query)
    if (sort === "peak") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (players as any[]).sort((a: any, b: any) => (b.peak ?? 0) - (a.peak ?? 0));
    }
  }

  return NextResponse.json({
    players,
    hasMore: players.length === limit,
  });
}
