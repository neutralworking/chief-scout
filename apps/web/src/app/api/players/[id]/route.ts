import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const SELECT = [
  "id","name","club","division","nation",
  "position","secondary_position","Side",
  "level","peak",
  "height_cm","preferred_foot","date_of_birth","hg",
  "archetype","archetype_confidence","archetype_override",
  "market_value_tier","scarcity_score","national_scarcity","market_premium",
  "scouting_notes",
  "pursuit_status","director_valuation_meur","fit_note",
  "squad_role","loan_status",
  "blueprint",
].join(", ");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseServer) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const supabase = supabaseServer;
  const { id } = await params;

  const { data, error } = await supabase
    .from("players")
    .select(SELECT)
    .eq("id", id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
