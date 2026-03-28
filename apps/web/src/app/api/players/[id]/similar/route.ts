import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { scoreSimilarity } from "@/lib/similarity/engine";
import type { Lens, PlayerCandidate, SimilarityResult } from "@/lib/similarity/types";
import { ADJACENT_POSITIONS } from "@/lib/similarity/types";

const CARD_FIELDS =
  "person_id, name, position, level, peak, archetype, earned_archetype, overall, best_role, best_role_score, technical_score, tactical_score, mental_score, physical_score, personality_type, preferred_foot, side, height_cm, club, club_id, nation, image_url, active" as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (!supabaseServer || isNaN(playerId)) {
    return NextResponse.json({ lens: "match", source: null, results: [] });
  }

  const lens = (req.nextUrl.searchParams.get("lens") ?? "match") as Lens;
  const includeLegends = req.nextUrl.searchParams.get("include_legends") === "true";
  const realistic = req.nextUrl.searchParams.get("realistic") === "true";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "8", 10), 20);

  // Fetch source player
  const { data: source } = await supabaseServer
    .from("player_intelligence_card")
    .select(CARD_FIELDS)
    .eq("person_id", playerId)
    .single();

  if (!source?.position) {
    return NextResponse.json({ lens, source: null, results: [] });
  }

  // Fetch candidates
  const positions = ADJACENT_POSITIONS[source.position] ?? [source.position];

  let query = supabaseServer
    .from("player_intelligence_card")
    .select(CARD_FIELDS)
    .in("position", positions)
    .neq("person_id", playerId)
    .not("best_role_score", "is", null)
    .order("best_role_score", { ascending: false, nullsFirst: false })
    .limit(800);

  if (!includeLegends) {
    query = query.eq("active", true);
  }

  if (realistic && lens === "replacement") {
    const srcLevel = source.active ? source.level : source.peak;
    if (srcLevel != null) {
      query = query.gte("level", srcLevel - 8).lte("level", srcLevel + 3);
    }
  }

  const { data: candidates } = await query;
  if (!candidates?.length) {
    return NextResponse.json({ lens, source, results: [] });
  }

  // Fetch traits for all players
  const allIds = [playerId, ...candidates.map((c: PlayerCandidate) => c.person_id)];

  const { data: allTraits } = await supabaseServer
    .from("player_trait_scores")
    .select("player_id, trait")
    .in("player_id", allIds);

  const traitMap = new Map<number, string[]>();
  for (const t of allTraits ?? []) {
    const existing = traitMap.get(t.player_id) ?? [];
    existing.push(t.trait);
    traitMap.set(t.player_id, existing);
  }

  // Fetch grades for all players
  const { data: allGrades } = await supabaseServer
    .from("attribute_grades")
    .select("player_id, attribute, scout_grade, stat_score")
    .in("player_id", allIds);

  const gradeMap = new Map<number, Record<string, number>>();
  const gradeHasScout = new Map<string, boolean>();
  for (const g of allGrades ?? []) {
    const key = `${g.player_id}:${g.attribute}`;
    const existing = gradeMap.get(g.player_id) ?? {};

    if (g.scout_grade != null) {
      existing[g.attribute] = g.scout_grade;
      gradeHasScout.set(key, true);
    } else if (g.stat_score != null && !gradeHasScout.get(key)) {
      if (!existing[g.attribute] || g.stat_score > existing[g.attribute]) {
        existing[g.attribute] = g.stat_score;
      }
    }
    gradeMap.set(g.player_id, existing);
  }

  // Score all candidates
  const srcTraits = traitMap.get(playerId) ?? [];
  const srcGrades = gradeMap.get(playerId) ?? {};

  const results: SimilarityResult[] = candidates.map((tgt: PlayerCandidate) => {
    const tgtTraits = traitMap.get(tgt.person_id) ?? [];
    const tgtGrades = gradeMap.get(tgt.person_id) ?? {};
    return scoreSimilarity(source as PlayerCandidate, tgt, srcTraits, tgtTraits, srcGrades, tgtGrades, lens);
  });

  results.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({
    lens,
    source: {
      id: source.person_id,
      name: source.name,
      position: source.position,
      best_role: source.best_role,
      earned_archetype: source.earned_archetype,
    },
    results: results.slice(0, limit),
  });
}
