import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

const MAX_PLAYERS_PER_SHORTLIST = 50;

type RouteContext = { params: Promise<{ slug: string }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOwnedShortlist(sb: any, slug: string, userId: string) {
  const { data } = await sb
    .from("shortlists")
    .select("id, author_id, player_count")
    .eq("slug", slug)
    .single() as { data: { id: number; author_id: string; player_count: number } | null };

  if (!data || data.author_id !== userId) return null;
  return data;
}

// POST /api/shortlists/[slug]/players — add a player
export async function POST(request: Request, { params }: RouteContext) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { slug } = await params;
  const body = await request.json();
  const { user_id, person_id, scout_note } = body;

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }
  if (!person_id) {
    return NextResponse.json({ error: "Missing person_id" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const shortlist = await getOwnedShortlist(sb, slug, user_id);
  if (!shortlist) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if ((shortlist.player_count ?? 0) >= MAX_PLAYERS_PER_SHORTLIST) {
    return NextResponse.json({ error: `Maximum ${MAX_PLAYERS_PER_SHORTLIST} players per shortlist` }, { status: 400 });
  }

  // Insert player (upsert to handle re-adds gracefully)
  const nextOrder = (shortlist.player_count ?? 0) + 1;
  const { error: insertError } = await sb
    .from("shortlist_players")
    .upsert(
      {
        shortlist_id: shortlist.id,
        person_id,
        sort_order: nextOrder,
        scout_note: scout_note?.trim() || null,
      },
      { onConflict: "shortlist_id,person_id" }
    );

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update player_count
  const { count } = await sb
    .from("shortlist_players")
    .select("id", { count: "exact", head: true })
    .eq("shortlist_id", shortlist.id);

  await sb
    .from("shortlists")
    .update({ player_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq("id", shortlist.id);

  return NextResponse.json({ success: true, player_count: count ?? 0 }, { status: 201 });
}

// DELETE /api/shortlists/[slug]/players — remove a player
export async function DELETE(request: Request, { params }: RouteContext) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const personId = searchParams.get("person_id");

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }
  if (!personId) {
    return NextResponse.json({ error: "Missing person_id" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const shortlist = await getOwnedShortlist(sb, slug, userId);
  if (!shortlist) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await sb
    .from("shortlist_players")
    .delete()
    .eq("shortlist_id", shortlist.id)
    .eq("person_id", parseInt(personId, 10));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update player_count
  const { count } = await sb
    .from("shortlist_players")
    .select("id", { count: "exact", head: true })
    .eq("shortlist_id", shortlist.id);

  await sb
    .from("shortlists")
    .update({ player_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq("id", shortlist.id);

  return NextResponse.json({ success: true, player_count: count ?? 0 });
}
