import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const TABLES = [
  { name: "people", label: "People" },
  { name: "player_profiles", label: "Profiles" },
  { name: "player_personality", label: "Personality" },
  { name: "player_market", label: "Market" },
  { name: "player_status", label: "Status" },
  { name: "attribute_grades", label: "Attribute Grades" },
  { name: "player_id_links", label: "ID Links" },
  { name: "fbref_players", label: "FBRef Players" },
  { name: "fbref_player_season_stats", label: "FBRef Season Stats" },
  { name: "news_stories", label: "News Stories" },
  { name: "news_player_tags", label: "News Tags" },
  { name: "sb_events", label: "StatsBomb Events" },
  { name: "sb_lineups", label: "StatsBomb Lineups" },
  { name: "understat_player_match_stats", label: "Understat Stats" },
];

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const counts: Record<string, { label: string; count: number | null }> = {};

  for (const table of TABLES) {
    const { count, error } = await supabaseServer
      .from(table.name)
      .select("*", { count: "exact", head: true });
    counts[table.name] = {
      label: table.label,
      count: error ? null : count,
    };
  }

  // Source breakdown for player_id_links
  const { data: linkSources } = await supabaseServer
    .from("player_id_links")
    .select("source");

  const sourceCounts: Record<string, number> = {};
  if (linkSources) {
    for (const row of linkSources) {
      sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
    }
  }

  return NextResponse.json({ counts, sourceCounts });
}
