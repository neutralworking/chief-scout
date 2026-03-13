import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await sb
    .from("player_intelligence_card")
    .select("person_id, name, club, nation, position, level, pursuit_status, profile_tier, archetype")
    .ilike("name", `%${q}%`)
    .order("level", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [] });
}
