import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/players/[id]/shortlists — get shortlists a player appears in
// Pass ?user_id=X to also include the user's own private/unlisted shortlists
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) {
    return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  const sb = createClient(supabaseUrl, supabaseKey);

  // Get all shortlist entries for this player, joined with shortlist metadata
  const { data: entries, error } = await sb
    .from("shortlist_players")
    .select("shortlist_id, scout_note, shortlist:shortlists(slug, title, icon, visibility, author_id)")
    .eq("person_id", personId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter: public shortlists + user's own (any visibility)
  const shortlists = (entries ?? [])
    .filter((e: Record<string, unknown>) => {
      const sl = Array.isArray(e.shortlist) ? e.shortlist[0] : e.shortlist;
      if (!sl) return false;
      const s = sl as Record<string, unknown>;
      return s.visibility === "public" || (userId && s.author_id === userId);
    })
    .map((e: Record<string, unknown>) => {
      const sl = (Array.isArray(e.shortlist) ? e.shortlist[0] : e.shortlist) as Record<string, unknown>;
      return {
        shortlist_id: e.shortlist_id as number,
        slug: sl.slug as string,
        title: sl.title as string,
        icon: (sl.icon as string | null) ?? null,
        scout_note: (e.scout_note as string | null) ?? null,
        author_id: (sl.author_id as string | null) ?? null,
      };
    });

  return NextResponse.json({ shortlists });
}
