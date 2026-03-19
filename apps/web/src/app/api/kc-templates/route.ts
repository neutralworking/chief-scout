import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || "",
);

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rarity = searchParams.get("rarity");
  const position = searchParams.get("position");
  const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);

  // Fetch KC-flagged players from intelligence card view
  let query = supabase
    .from("player_intelligence_card")
    .select("*")
    .eq("kc", true)
    .not("archetype", "is", null)
    .not("overall", "is", null)
    .order("overall", { ascending: false })
    .limit(limit);

  if (position) query = query.eq("position", position);

  const { data: players, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players?.length) return NextResponse.json([]);

  const personIds = players.map((p: Record<string, unknown>) => p.person_id);

  // Fetch top attributes per player
  const { data: attrs } = await supabase
    .from("attribute_grades")
    .select("player_id, attribute, scout_grade, stat_score, source")
    .in("player_id", personIds);

  // Group and pick top 6 per player
  const attrMap: Record<number, { attribute: string; score: number; source: string }[]> = {};
  for (const a of attrs || []) {
    const score = a.scout_grade || a.stat_score || 0;
    if (score <= 0) continue;
    const pid = a.player_id;
    if (!attrMap[pid]) attrMap[pid] = [];
    attrMap[pid].push({ attribute: a.attribute, score, source: a.source });
  }
  for (const pid in attrMap) {
    attrMap[pid].sort((a, b) => b.score - a.score);
    attrMap[pid] = attrMap[pid].slice(0, 10);
  }

  // Build card data
  const cards = players.map((p: Record<string, unknown>) => {
    const ovr = (p.overall as number) || 50;
    let suggested_rarity: string;
    if (ovr >= 83) suggested_rarity = "legendary";
    else if (ovr >= 76) suggested_rarity = "epic";
    else if (ovr >= 68) suggested_rarity = "rare";
    else if (ovr >= 58) suggested_rarity = "uncommon";
    else suggested_rarity = "common";

    return {
      person_id: p.person_id,
      name: p.name,
      position: p.position,
      archetype: p.archetype,
      blueprint: p.blueprint,
      personality_code: p.personality_type,
      level: p.level,
      peak: (p as Record<string, unknown>).peak || null,
      overall: p.overall,
      scouting_notes: p.scouting_notes,
      nation: p.nation,
      club: p.club,
      active: p.active,
      suggested_rarity,
      top_attributes: attrMap[p.person_id as number] || [],
      fingerprint: p.fingerprint,
      best_role: p.best_role,
      ei: p.ei,
      sn: p.sn,
      tf: p.tf,
      jp: p.jp,
      competitiveness: p.competitiveness,
      coachability: p.coachability,
    };
  });

  // Filter by rarity if requested
  const filtered = rarity ? cards.filter((c: { suggested_rarity: string }) => c.suggested_rarity === rarity) : cards;

  return NextResponse.json(filtered, {
    headers: { "Cache-Control": "no-store" },
  });
}
