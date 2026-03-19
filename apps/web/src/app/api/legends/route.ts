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
    .select("person_id, name, dob, nation, club, position, level, peak, overall, archetype, personality_type, best_role, best_role_score, fingerprint")
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

  return NextResponse.json({
    players: data ?? [],
    hasMore: (data ?? []).length === limit,
  });
}
