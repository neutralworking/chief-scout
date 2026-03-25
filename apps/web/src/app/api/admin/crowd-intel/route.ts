import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const direction = searchParams.get("direction");
  const minSampleSize = parseInt(searchParams.get("min_sample_size") ?? "5", 10);

  let query = supabaseServer
    .from("fc_crowd_mismatches")
    .select(`
      person_id,
      crowd_win_pct,
      db_level,
      db_overall,
      mismatch_score,
      direction,
      sample_size,
      computed_at,
      people!inner(id, name),
      player_profiles!inner(position)
    `)
    .gte("sample_size", minSampleSize)
    .order("mismatch_score", { ascending: false })
    .limit(20);

  if (direction === "crowd_higher" || direction === "crowd_lower") {
    query = query.eq("direction", direction);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mismatches = (data ?? []).map((row: Record<string, unknown>) => {
    const people = row.people as { id: number; name: string } | null;
    const profiles = row.player_profiles as { position: string } | null;
    return {
      person_id: row.person_id,
      name: people?.name ?? "Unknown",
      position: profiles?.position ?? "—",
      crowd_win_pct: row.crowd_win_pct,
      db_level: row.db_level,
      db_overall: row.db_overall,
      mismatch_score: row.mismatch_score,
      direction: row.direction,
      sample_size: row.sample_size,
      computed_at: row.computed_at,
    };
  });

  return NextResponse.json({ mismatches });
}
