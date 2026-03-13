import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/shortlists/[slug] — get shortlist detail with players
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { slug } = await params;
  const sb = createClient(supabaseUrl, supabaseKey);

  // Fetch shortlist
  const { data: shortlist, error: slError } = await sb
    .from("shortlists")
    .select("*")
    .eq("slug", slug)
    .eq("visibility", "public")
    .single();

  if (slError || !shortlist) {
    return NextResponse.json({ error: "Shortlist not found" }, { status: 404 });
  }

  // Fetch players with their profiles
  const { data: entries, error: spError } = await sb
    .from("shortlist_players")
    .select("person_id, sort_order, scout_note, added_at")
    .eq("shortlist_id", shortlist.id)
    .order("sort_order", { ascending: true });

  if (spError) {
    return NextResponse.json({ error: spError.message }, { status: 500 });
  }

  // Enrich with player data from the intelligence card view
  const personIds = (entries ?? []).map((e: { person_id: number }) => e.person_id);

  if (personIds.length === 0) {
    return NextResponse.json({ shortlist, players: [] });
  }

  const { data: cards } = await sb
    .from("player_intelligence_card")
    .select("person_id, name, dob, nation, club, position, level, archetype, model_id, pursuit_status, market_value_tier, true_mvt, personality_type")
    .in("person_id", personIds);

  const cardMap = new Map(
    (cards ?? []).map((c: { person_id: number }) => [c.person_id, c])
  );

  const players = (entries ?? []).map((e: { person_id: number; sort_order: number; scout_note: string | null }) => ({
    ...e,
    player: cardMap.get(e.person_id) ?? null,
  }));

  return NextResponse.json({ shortlist, players });
}
