import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

type RouteContext = { params: Promise<{ slug: string }> };

// GET /api/shortlists/[slug] — get shortlist detail with players
export async function GET(request: Request, { params }: RouteContext) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const sb = createClient(supabaseUrl, supabaseKey);

  // Fetch shortlist (no visibility filter — we check after)
  const { data: shortlist, error: slError } = await sb
    .from("shortlists")
    .select("*")
    .eq("slug", slug)
    .single();

  if (slError || !shortlist) {
    return NextResponse.json({ error: "Shortlist not found" }, { status: 404 });
  }

  // Visibility check: public = anyone, unlisted = anyone with URL, private = owner only
  const isOwner = userId && shortlist.author_id === userId;
  if (shortlist.visibility === "private" && !isOwner) {
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

  const personIds = (entries ?? []).map((e: { person_id: number }) => e.person_id);

  if (personIds.length === 0) {
    return NextResponse.json({ shortlist, players: [] });
  }

  const { data: cards } = await sb
    .from("player_intelligence_card")
    .select("person_id, name, dob, nation, club, position, level, archetype, model_id, pursuit_status, market_value_tier, true_mvt, personality_type, fingerprint, best_role")
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

// PATCH /api/shortlists/[slug] — update shortlist metadata (owner only)
export async function PATCH(request: Request, { params }: RouteContext) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { slug } = await params;
  const body = await request.json();
  const { user_id, title, description, icon, visibility } = body;

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Ownership check
  const { data: shortlist } = await sb
    .from("shortlists")
    .select("id, author_id, author_type")
    .eq("slug", slug)
    .single();

  if (!shortlist || shortlist.author_id !== user_id || shortlist.author_type !== "user") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined && typeof title === "string" && title.trim().length > 0) updates.title = title.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (icon !== undefined) updates.icon = icon || null;
  if (visibility !== undefined && ["public", "private", "unlisted"].includes(visibility)) {
    updates.visibility = visibility;
  }

  const { data, error } = await sb
    .from("shortlists")
    .update(updates)
    .eq("id", shortlist.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shortlist: data });
}

// DELETE /api/shortlists/[slug] — delete shortlist (owner only)
export async function DELETE(request: Request, { params }: RouteContext) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Ownership check
  const { data: shortlist } = await sb
    .from("shortlists")
    .select("id, author_id, author_type")
    .eq("slug", slug)
    .single();

  if (!shortlist || shortlist.author_id !== userId || shortlist.author_type !== "user") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // CASCADE handles shortlist_players cleanup
  const { error } = await sb
    .from("shortlists")
    .delete()
    .eq("id", shortlist.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
