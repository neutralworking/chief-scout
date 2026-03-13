import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const params = request.nextUrl.searchParams;
  const league = params.get("league");
  const club = params.get("club");
  const limit = Math.min(parseInt(params.get("limit") ?? "50"), 200);
  const offset = parseInt(params.get("offset") ?? "0");

  // Fetch players with profiles, status, and club info
  let query = sb
    .from("people")
    .select(`
      id, name, date_of_birth, preferred_foot, height_cm,
      clubs!inner(id, clubname, league_name),
      player_profiles(position, level, peak, overall, archetype, blueprint, best_role),
      player_status(scouting_notes, pursuit_status, squad_role),
      player_market(market_value_tier, true_mvt, scarcity_score)
    `)
    .eq("active", true)
    .order("name")
    .range(offset, offset + limit - 1);

  if (league) {
    query = query.eq("clubs.league_name", league);
  }
  if (club) {
    query = query.eq("clubs.clubname", club);
  }

  const { data: players, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch attribute grades for these players
  const playerIds = (players ?? []).map((p: Record<string, unknown>) => p.id);
  let grades: Record<string, unknown>[] = [];
  if (playerIds.length > 0) {
    const { data } = await sb
      .from("attribute_grades")
      .select("player_id, attribute, scout_grade")
      .in("player_id", playerIds)
      .not("scout_grade", "is", null);
    grades = data ?? [];
  }

  // Group grades by player
  const gradesByPlayer: Record<number, Record<string, number>> = {};
  for (const g of grades) {
    const pid = g.player_id as number;
    if (!gradesByPlayer[pid]) gradesByPlayer[pid] = {};
    gradesByPlayer[pid][g.attribute as string] = g.scout_grade as number;
  }

  // Fetch available leagues and clubs for filters
  const { data: leaguesData } = await sb
    .from("clubs")
    .select("league_name")
    .not("league_name", "is", null)
    .order("league_name");

  const leagues = [...new Set((leaguesData ?? []).map((l: Record<string, unknown>) => l.league_name as string))];

  return NextResponse.json({
    players: (players ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      grades: gradesByPlayer[p.id as number] ?? {},
    })),
    leagues,
    total: (players ?? []).length,
  });
}
