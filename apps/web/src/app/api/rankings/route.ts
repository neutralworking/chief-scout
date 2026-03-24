import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  if (!supabaseServer) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const supabase = supabaseServer;
  // Get award contention tags
  const { data: tagData, error: tagErr } = await supabase
    .from("player_tags")
    .select("player_id, tag_id, tags(tag_name, category)")
    .eq("tags.category", "award_contention");

  if (tagErr) return NextResponse.json({ error: tagErr.message }, { status: 500 });

  const filtered = (tagData ?? []).filter((r: Record<string, unknown>) => r.tags !== null);
  if (filtered.length === 0) return NextResponse.json([]);

  const playerIds = filtered.map((r: Record<string, unknown>) => r.player_id as number);

  // Fetch player data from the compatibility view
  const { data: playerData, error: playerErr } = await supabase
    .from("players")
    .select("id, name, club, position, level, overall, peak")
    .in("id", playerIds);

  if (playerErr) return NextResponse.json({ error: playerErr.message }, { status: 500 });

  const playerMap = new Map((playerData ?? []).map((p: Record<string, unknown>) => [p.id, p]));

  const rows = filtered
    .map((r: Record<string, unknown>) => {
      const tag = r.tags as { tag_name: string; category: string };
      const player = playerMap.get(r.player_id) as Record<string, unknown> | undefined;
      return {
        id: r.player_id,
        name: player?.name ?? null,
        club: player?.club ?? null,
        position: player?.position ?? null,
        level: player?.level as number | null ?? null,
        overall: player?.overall as number | null ?? null,
        peak: player?.peak ?? null,
        tag_name: tag.tag_name,
      };
    })
    .sort((a, b) => (b.overall ?? b.level ?? 0) - (a.overall ?? a.level ?? 0));

  return NextResponse.json(rows);
}
