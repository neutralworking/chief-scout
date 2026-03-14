import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { player_id, attribute, scout_grade } = await request.json();

  if (!player_id || !attribute) {
    return NextResponse.json({ error: "Missing player_id or attribute" }, { status: 400 });
  }

  // Upsert the grade
  const { error } = await supabaseServer
    .from("attribute_grades")
    .upsert(
      { player_id, attribute, scout_grade, source: "network", updated_at: new Date().toISOString() },
      { onConflict: "player_id,attribute,source" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, player_id, attribute, scout_grade });
}
