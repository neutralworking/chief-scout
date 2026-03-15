import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const competition = searchParams.get("competition");
  const clubId = searchParams.get("club");
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const status = searchParams.get("status") ?? "SCHEDULED";

  // Build query
  let query = supabaseServer
    .from("fixtures")
    .select("*")
    .eq("status", status)
    .gte("utc_date", new Date().toISOString())
    .lte("utc_date", new Date(Date.now() + days * 86400000).toISOString())
    .order("utc_date", { ascending: true });

  if (competition) {
    query = query.eq("competition_code", competition);
  }
  if (clubId) {
    const id = parseInt(clubId, 10);
    query = query.or(`home_club_id.eq.${id},away_club_id.eq.${id}`);
  }

  const { data: fixtures, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Collect unique club IDs for enrichment
  const clubIds = new Set<number>();
  for (const f of fixtures ?? []) {
    if (f.home_club_id) clubIds.add(f.home_club_id);
    if (f.away_club_id) clubIds.add(f.away_club_id);
  }

  // Fetch club metadata
  let clubs: Record<number, any> = {};
  if (clubIds.size > 0) {
    const { data: clubData } = await supabaseServer
      .from("clubs")
      .select("id, clubname, short_name, formation, team_tactical_style, offensive_style, defensive_style, logo_url, league_name")
      .in("id", Array.from(clubIds));

    for (const c of clubData ?? []) {
      clubs[c.id] = c;
    }
  }

  // Enrich fixtures with club data
  const enriched = (fixtures ?? []).map((f: any) => ({
    ...f,
    home_club: f.home_club_id ? clubs[f.home_club_id] ?? null : null,
    away_club: f.away_club_id ? clubs[f.away_club_id] ?? null : null,
  }));

  // Group by competition
  const grouped: Record<string, typeof enriched> = {};
  for (const f of enriched) {
    const key = f.competition ?? "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  }

  return NextResponse.json({ fixtures: enriched, byCompetition: grouped });
}
