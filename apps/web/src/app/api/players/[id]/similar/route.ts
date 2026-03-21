import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const SOURCE_FIELDS =
  "person_id, name, position, archetype, earned_archetype, overall, best_role, best_role_score, technical_score, physical_score, personality_type, preferred_foot, side, club, nation, image_url, pursuit_status, active, peak" as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = parseInt(id, 10);

  if (!supabaseServer || isNaN(playerId)) {
    return NextResponse.json({ players: [] });
  }

  const { data: source } = await supabaseServer
    .from("player_intelligence_card")
    .select(SOURCE_FIELDS)
    .eq("person_id", playerId)
    .single();

  if (!source?.position) {
    return NextResponse.json({ players: [] });
  }

  // Pull active candidates and legend candidates in parallel
  const [activeRes, legendRes] = await Promise.all([
    supabaseServer
      .from("player_intelligence_card")
      .select(SOURCE_FIELDS)
      .eq("position", source.position)
      .eq("active", true)
      .neq("person_id", playerId)
      .not("best_role_score", "is", null)
      .limit(500),
    supabaseServer
      .from("player_intelligence_card")
      .select(SOURCE_FIELDS)
      .eq("position", source.position)
      .eq("active", false)
      .not("best_role_score", "is", null)
      .not("archetype", "is", null)
      .gte("peak", 88)
      .limit(200),
  ]);

  const candidates = activeRes.data ?? [];
  if (!candidates.length && !legendRes.data?.length) {
    return NextResponse.json({ players: [], legendComps: [] });
  }

  const srcRS = source.best_role_score ?? 0;
  const srcTech = source.technical_score ?? null;
  const srcPhys = source.physical_score ?? null;

  const scored = candidates.map((p) => {
    let score = 0;

    // 1. Same best_role = strongest signal (40pts)
    if (source.best_role && p.best_role === source.best_role) score += 40;

    // 2. Role score proximity (max 30pts — 1pt per point of difference)
    const rsDiff = Math.abs((p.best_role_score ?? 0) - srcRS);
    score += Math.max(0, 30 - rsDiff);

    // 3. Archetype match (20pts exact, 10pts if earned matches)
    if (source.archetype && p.archetype === source.archetype) {
      score += 20;
    } else if (
      source.earned_archetype &&
      p.earned_archetype === source.earned_archetype
    ) {
      score += 10;
    }

    // 4. Four-pillar proximity — technical + physical (max 20pts)
    if (srcTech != null && p.technical_score != null) {
      score += Math.max(0, 10 - Math.abs(p.technical_score - srcTech) / 3);
    }
    if (srcPhys != null && p.physical_score != null) {
      score += Math.max(0, 10 - Math.abs(p.physical_score - srcPhys) / 3);
    }

    // 5. Personality match (5pts)
    if (
      source.personality_type &&
      p.personality_type === source.personality_type
    )
      score += 5;

    // 6. Same side (10pts for wide players — a RW and another RW is a real comparison)
    if (source.side && source.side !== "C" && p.side === source.side)
      score += 10;

    // 7. Same preferred foot (5pts)
    if (source.preferred_foot && p.preferred_foot === source.preferred_foot)
      score += 5;

    // 8. Different club bonus (5pts — cross-club comparisons are more useful)
    if (p.club !== source.club) score += 5;

    return { ...p, similarity: Math.round(score) };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  // ── Legend comparison: match by skillset (Primary model), role, and quality tier ──
  const legends = legendRes.data ?? [];
  const srcPrimary = source.archetype?.split("-")[0] ?? "";
  const srcSecondary = source.archetype?.split("-")[1] ?? "";

  const legendScored = legends.map((leg) => {
    let score = 0;
    const legPrimary = leg.archetype?.split("-")[0] ?? "";
    const legSecondary = leg.archetype?.split("-")[1] ?? "";

    // Primary model match (40pts)
    if (srcPrimary && legPrimary === srcPrimary) score += 40;
    // Secondary model match (20pts)
    if (srcSecondary && legSecondary === srcSecondary) score += 20;
    // Cross-match: player secondary = legend primary (15pts)
    else if (srcSecondary && legPrimary === srcSecondary) score += 15;
    // Same best_role (30pts)
    if (source.best_role && leg.best_role === source.best_role) score += 30;
    // Personality match (10pts)
    if (source.personality_type && leg.personality_type === source.personality_type) score += 10;

    return { ...leg, similarity: Math.round(score) };
  });

  legendScored.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({
    players: scored.slice(0, 5),
    legendComps: legendScored.slice(0, 2).filter((l) => l.similarity >= 40),
  });
}
