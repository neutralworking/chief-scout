import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const revalidate = 3600; // cache for 1 hour

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { data, error } = await supabaseServer
    .from("kc_cards")
    .select(
      "id, name, bio, position, archetype, secondary_archetype, tactical_role, personality_type, personality_theme, power, rarity, art_seed, gate_pull, durability"
    )
    .order("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
