import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/choices/squad?user_id=xxx — get user's squad + pick stats
export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const templateSlug = searchParams.get("template") ?? "classic-433";

    const sb = createClient(supabaseUrl, supabaseKey);

    // Get template
    const { data: template, error: templateErr } = await sb
      .from("fc_squad_templates")
      .select("*")
      .eq("slug", templateSlug)
      .single();

    if (templateErr || !template) {
      return NextResponse.json({ template: null, squad: null, picks: [], stats: [] });
    }

    // Get user's squad if exists
    let squad = null;
    let picks: Record<string, unknown>[] = [];

    if (userId) {
      const { data: squadData } = await sb
        .from("fc_squads")
        .select("*")
        .eq("user_id", userId)
        .eq("template_id", template.id)
        .single();

      squad = squadData;

      if (squad) {
        const { data: picksData } = await sb
          .from("fc_squad_picks")
          .select("*")
          .eq("squad_id", squad.id)
          .order("slot");
        picks = picksData ?? [];
      }
    }

    // Get pick stats for this template
    const { data: stats } = await sb
      .from("fc_pick_stats")
      .select("*")
      .eq("template_id", template.id)
      .order("pick_count", { ascending: false });

    return NextResponse.json({
      template,
      squad,
      picks,
      stats: stats ?? [],
    });
  } catch (err) {
    console.error("Squad API error:", err);
    return NextResponse.json({ template: null, squad: null, picks: [], stats: [] });
  }
}

// POST /api/choices/squad — create or get squad, and make a pick
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
  const body = await request.json();
  const { user_id, template_slug, slot, player_name, person_id, time_ms } = body;

  if (!user_id || !slot || !player_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Ensure user exists
  await sb
    .from("fc_users")
    .upsert({ id: user_id, updated_at: new Date().toISOString() }, { onConflict: "id" });

  // Get template
  const { data: template } = await sb
    .from("fc_squad_templates")
    .select("id")
    .eq("slug", template_slug ?? "classic-433")
    .single();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Get or create squad
  let { data: squad } = await sb
    .from("fc_squads")
    .select("id")
    .eq("user_id", user_id)
    .eq("template_id", template.id)
    .single();

  if (!squad) {
    const { data: newSquad } = await sb
      .from("fc_squads")
      .insert({ user_id, template_id: template.id })
      .select("id")
      .single();
    squad = newSquad;
  }

  if (!squad) {
    return NextResponse.json({ error: "Failed to create squad" }, { status: 500 });
  }

  // Insert or update pick
  const { error: pickError } = await sb
    .from("fc_squad_picks")
    .upsert({
      squad_id: squad.id,
      slot,
      player_name,
      person_id: person_id ?? null,
      time_ms: time_ms ?? null,
    }, { onConflict: "squad_id,slot" });

  if (pickError) {
    return NextResponse.json({ error: pickError.message }, { status: 500 });
  }

  // Update pick stats
  const { data: existingStat } = await sb
    .from("fc_pick_stats")
    .select("pick_count")
    .eq("player_name", player_name)
    .eq("slot", slot)
    .eq("template_id", template.id)
    .single();

  if (existingStat) {
    await sb
      .from("fc_pick_stats")
      .update({
        pick_count: existingStat.pick_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("player_name", player_name)
      .eq("slot", slot)
      .eq("template_id", template.id);
  } else {
    await sb
      .from("fc_pick_stats")
      .insert({
        player_name,
        slot,
        template_id: template.id,
        pick_count: 1,
      });
  }

  // Check if squad is complete (all 11 slots filled)
  const { count } = await sb
    .from("fc_squad_picks")
    .select("id", { count: "exact", head: true })
    .eq("squad_id", squad.id);

  if ((count ?? 0) >= 11) {
    await sb
      .from("fc_squads")
      .update({ completed: true, updated_at: new Date().toISOString() })
      .eq("id", squad.id);
  }

  // Return current pick stats for this slot
  const { data: slotStats } = await sb
    .from("fc_pick_stats")
    .select("player_name, pick_count")
    .eq("slot", slot)
    .eq("template_id", template.id)
    .order("pick_count", { ascending: false })
    .limit(10);

  return NextResponse.json({
    success: true,
    slot_stats: slotStats ?? [],
    completed: (count ?? 0) >= 11,
  });
  } catch (err) {
    console.error("Squad POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
