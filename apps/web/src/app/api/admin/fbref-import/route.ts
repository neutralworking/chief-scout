import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

interface FBRefRow {
  fbref_id: string;
  name: string;
  nation: string | null;
  position: string | null;
  team: string | null;
  comp_id: string | null;
  season: string | null;
  age: number | null;
  born: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  xg: number | null;
  xag: number | null;
  npxg: number | null;
  progressive_carries: number | null;
  progressive_passes: number | null;
  progressive_passes_received: number | null;
}

export async function POST(request: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  let body: { players: FBRefRow[]; season: string; comp_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { players, season, comp_id } = body;
  if (!players || !Array.isArray(players) || players.length === 0) {
    return NextResponse.json({ error: "No player data provided" }, { status: 400 });
  }

  // Upsert into fbref_players
  const playerRows = players.map((p) => ({
    fbref_id: p.fbref_id,
    name: p.name,
    nation: p.nation || null,
    position: p.position || null,
  }));

  const { error: playerError } = await supabaseServer
    .from("fbref_players")
    .upsert(playerRows, { onConflict: "fbref_id" });

  if (playerError) {
    return NextResponse.json(
      { error: `fbref_players upsert failed: ${playerError.message}` },
      { status: 500 }
    );
  }

  // Upsert into fbref_player_season_stats
  const statRows = players.map((p) => ({
    fbref_id: p.fbref_id,
    season: season,
    comp_id: comp_id,
    team: p.team || null,
    age: p.age || null,
    born: p.born || null,
    minutes: p.minutes || null,
    goals: p.goals || null,
    assists: p.assists || null,
    xg: p.xg || null,
    xag: p.xag || null,
    npxg: p.npxg || null,
    progressive_carries: p.progressive_carries || null,
    progressive_passes: p.progressive_passes || null,
    progressive_passes_received: p.progressive_passes_received || null,
  }));

  const { error: statError } = await supabaseServer
    .from("fbref_player_season_stats")
    .upsert(statRows, { onConflict: "fbref_id,season,comp_id" });

  if (statError) {
    return NextResponse.json(
      { error: `fbref_player_season_stats upsert failed: ${statError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    imported: players.length,
    season,
    comp_id,
  });
}
