import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const leagueId = searchParams.get("league_id") ?? "39"; // default PL
  const season = searchParams.get("season") ?? "2025";

  const { data, error } = await supabase
    .from("api_football_player_stats")
    .select(`
      person_id,
      api_football_id,
      league_name,
      team_name,
      appearances,
      minutes,
      goals,
      assists,
      rating,
      shots_total,
      shots_on,
      passes_accuracy,
      tackles_total,
      interceptions,
      blocks,
      duels_total,
      duels_won,
      dribbles_attempted,
      dribbles_success,
      cards_yellow,
      cards_red
    `)
    .eq("league_id", parseInt(leagueId, 10))
    .eq("season", season)
    .gt("appearances", 0)
    .order("rating", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // Enrich with player names from api_football_players (faster than joining people)
  const afIds = [...new Set(rows.map((r) => r.api_football_id as number))];
  const personIds = rows.map((r) => r.person_id as number).filter(Boolean);

  const [{ data: afPlayers }, { data: profiles }] = await Promise.all([
    supabase
      .from("api_football_players")
      .select("api_football_id, name, person_id")
      .in("api_football_id", afIds),
    personIds.length > 0
      ? supabase
          .from("player_profiles")
          .select("person_id, position")
          .in("person_id", personIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameMap = new Map(
    (afPlayers ?? []).map((p) => [p.api_football_id as number, p.name as string]),
  );
  const posMap = new Map(
    (profiles ?? []).map((p) => [p.person_id as number, p.position as string]),
  );

  const enriched = rows.map((r) => ({
    ...r,
    name: nameMap.get(r.api_football_id as number) ?? "Unknown",
    position: posMap.get(r.person_id as number) ?? null,
  }));

  return NextResponse.json({ players: enriched, total: enriched.length });
}
