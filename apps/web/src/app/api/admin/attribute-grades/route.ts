import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/admin/attribute-grades?player_id=123
export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const playerId = req.nextUrl.searchParams.get("player_id");
  if (!playerId) {
    return NextResponse.json({ error: "Missing player_id" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await sb
    .from("attribute_grades")
    .select("attribute, scout_grade, stat_score, source")
    .eq("player_id", parseInt(playerId, 10));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ grades: data ?? [] });
}
