import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/players/[id]/shortlists — get shortlists a player appears in
export async function GET(
  _request: Request,
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

  const sb = createClient(supabaseUrl, supabaseKey);

  // Get all shortlist entries for this player, joined with shortlist metadata
  const { data: entries, error } = await sb
    .from("shortlist_players")
    .select("shortlist_id, scout_note, shortlist:shortlists(slug, title, icon, visibility)")
    .eq("person_id", personId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter to public shortlists only and flatten
  // Supabase returns joined relations as arrays even for singular FK joins
  const shortlists = (entries ?? [])
    .filter((e: Record<string, unknown>) => {
      const sl = Array.isArray(e.shortlist) ? e.shortlist[0] : e.shortlist;
      return sl && (sl as Record<string, unknown>).visibility === "public";
    })
    .map((e: Record<string, unknown>) => {
      const sl = (Array.isArray(e.shortlist) ? e.shortlist[0] : e.shortlist) as Record<string, unknown>;
      return {
        shortlist_id: e.shortlist_id as number,
        slug: sl.slug as string,
        title: sl.title as string,
        icon: (sl.icon as string | null) ?? null,
        scout_note: (e.scout_note as string | null) ?? null,
      };
    });

  return NextResponse.json({ shortlists });
}
