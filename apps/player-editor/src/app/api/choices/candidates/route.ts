import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/choices/candidates?template=classic-433&slot=1 — get candidates for a slot
export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const templateSlug = searchParams.get("template") ?? "classic-433";
  const slot = parseInt(searchParams.get("slot") ?? "0", 10);

  if (!slot) {
    return NextResponse.json({ error: "Missing slot" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Get template
  const { data: template } = await sb
    .from("fc_squad_templates")
    .select("id")
    .eq("slug", templateSlug)
    .single();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Get candidates
  const { data: candidates } = await sb
    .from("fc_position_candidates")
    .select("id, player_name, person_id, subtitle, image_url, era, sort_order")
    .eq("template_id", template.id)
    .eq("slot", slot)
    .order("sort_order");

  // Get pick stats for context
  const { data: stats } = await sb
    .from("fc_pick_stats")
    .select("player_name, pick_count, pick_pct")
    .eq("template_id", template.id)
    .eq("slot", slot)
    .order("pick_count", { ascending: false });

  return NextResponse.json({
    candidates: candidates ?? [],
    stats: stats ?? [],
  });
}
