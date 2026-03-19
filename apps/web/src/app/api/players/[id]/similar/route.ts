import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = parseInt(id, 10);

  if (!supabaseServer || isNaN(playerId)) {
    return NextResponse.json({ players: [] });
  }

  // Get the source player's profile
  const { data: source } = await supabaseServer
    .from("player_intelligence_card")
    .select("person_id, position, archetype, overall, club, nation, name")
    .eq("person_id", playerId)
    .single();

  if (!source?.position) {
    return NextResponse.json({ players: [] });
  }

  // Find similar players: same position, prefer same archetype, closest overall
  const { data: candidates } = await supabaseServer
    .from("player_intelligence_card")
    .select("person_id, name, position, archetype, overall, club, nation, image_url, best_role, best_role_score, personality_type, pursuit_status")
    .eq("position", source.position)
    .neq("person_id", playerId)
    .not("overall", "is", null)
    .order("overall", { ascending: false })
    .limit(50);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ players: [] });
  }

  // Score similarity: archetype match + overall proximity + same archetype bonus
  const sourceOverall = source.overall ?? 50;
  const scored = candidates.map((p) => {
    let score = 0;
    // Same archetype = big bonus
    if (source.archetype && p.archetype === source.archetype) score += 100;
    // Close overall score = bonus (max 50 for exact match)
    const overallDiff = Math.abs((p.overall ?? 50) - sourceOverall);
    score += Math.max(0, 50 - overallDiff * 2);
    // Different club = small bonus (more useful comparison)
    if (p.club !== source.club) score += 10;
    return { ...p, similarity: score };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({ players: scored.slice(0, 5) });
}
