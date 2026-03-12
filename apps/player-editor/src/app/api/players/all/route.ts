import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, position, level, overall, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt, market_value_eur, technical_score, physical_score, best_role";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const pursuit = searchParams.get("pursuit");
  const personalities = searchParams.get("personalities");
  const tier = searchParams.get("tier");
  const full = searchParams.get("full");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") ?? "value";
  const limit = Math.min(Number(searchParams.get("limit") || 200), 1000);
  const offset = Number(searchParams.get("offset") || 0);

  let query = supabase.from("player_intelligence_card").select(SELECT, { count: "exact" });

  // Server-side filters
  if (position) query = query.eq("position", position);
  if (pursuit) query = query.eq("pursuit_status", pursuit);
  if (personalities) {
    const types = personalities.split(",").map((t) => t.trim());
    query = query.in("personality_type", types);
  }
  if (tier) query = query.eq("profile_tier", parseInt(tier, 10));
  if (full === "1") {
    query = query.not("archetype", "is", null).not("personality_type", "is", null).not("level", "is", null);
  }
  if (q) query = query.ilike("name", `%${q}%`);

  // Sort
  switch (sort) {
    case "level":
      query = query.order("level", { ascending: false, nullsFirst: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "position":
      query = query.order("position", { ascending: true, nullsFirst: false });
      break;
    case "value":
    default:
      query = query.order("market_value_eur", { ascending: false, nullsFirst: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [], total: count ?? 0 });
}
