import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const search = searchParams.get("q")?.trim();
  const position = searchParams.get("position");
  const pursuit = searchParams.get("pursuit");

  let query = supabaseServer
    .from("player_intelligence_card")
    .select("person_id, name, club, position, best_role, best_role_score, level, overall, archetype, pursuit_status");

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }
  if (position) {
    query = query.eq("position", position);
  }
  if (pursuit && pursuit !== "All") {
    query = query.eq("pursuit_status", pursuit);
  }

  // Sort by level desc, nulls last
  query = query.order("level", { ascending: false, nullsFirst: false });
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [] });
}
