import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const { player_id, attribute, scout_grade } = await request.json();

  if (!player_id || !attribute) {
    return NextResponse.json({ error: "Missing player_id or attribute" }, { status: 400 });
  }

  // Upsert the grade
  const { error } = await sb
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
