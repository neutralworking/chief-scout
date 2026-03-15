import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/personality-queue
 *
 * Returns top players needing personality reassessment, ordered by level desc.
 * Includes contextual data for informed assessment: scouting notes, tags,
 * career metrics, key attribute grades.
 *
 * Query params:
 *   limit (default 50)
 *   offset (default 0)
 *   filter: "all" | "inferred" | "reviewed" (default "inferred")
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const offset = Number(searchParams.get("offset") || 0);
  const filter = searchParams.get("filter") ?? "inferred";

  // Fetch players with personality data, ordered by level
  let query = supabase
    .from("player_intelligence_card")
    .select("person_id, name, level, position, archetype, blueprint, personality_type, ei, sn, tf, jp, competitiveness, coachability, club, nation, dob, scouting_notes, pursuit_status, squad_role")
    .not("personality_type", "is", null)
    .order("level", { ascending: false, nullsFirst: false });

  // Filter by assessment status
  // We need to join with player_personality for is_inferred, but the view
  // doesn't expose it. So we fetch personality rows separately.
  query = query.range(offset, offset + limit - 1);

  const { data: players, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pids = (players ?? []).map((p: Record<string, unknown>) => p.person_id as number);
  if (pids.length === 0) return NextResponse.json({ players: [], total: 0 });

  // Fetch personality metadata (is_inferred, confidence) and contextual data in parallel
  const [personalityRes, metricsRes, tagsRes, topGradesRes] = await Promise.all([
    supabase
      .from("player_personality")
      .select("person_id, is_inferred, confidence, inference_notes")
      .in("person_id", pids),
    supabase
      .from("career_metrics")
      .select("person_id, trajectory, loyalty_score, mobility_score, clubs_count, career_years")
      .in("person_id", pids),
    supabase
      .from("player_tags")
      .select("player_id, tags(tag_name, category)")
      .in("player_id", pids),
    supabase
      .from("attribute_grades")
      .select("player_id, attribute, scout_grade, stat_score, source")
      .in("player_id", pids)
      .in("source", ["scout_assessment", "statsbomb", "fbref"])
      .order("player_id"),
  ]);

  // Index supplementary data by person_id
  const personalityMap = new Map<number, { is_inferred: boolean; confidence: string | null; inference_notes: string | null }>();
  for (const p of (personalityRes.data ?? []) as Array<Record<string, unknown>>) {
    personalityMap.set(p.person_id as number, {
      is_inferred: p.is_inferred as boolean,
      confidence: p.confidence as string | null,
      inference_notes: p.inference_notes as string | null,
    });
  }

  const metricsMap = new Map<number, Record<string, unknown>>();
  for (const m of (metricsRes.data ?? []) as Array<Record<string, unknown>>) {
    metricsMap.set(m.person_id as number, m);
  }

  const tagsMap = new Map<number, string[]>();
  for (const t of (tagsRes.data ?? []) as Array<Record<string, unknown>>) {
    const pid = t.player_id as number;
    const tag = t.tags as { tag_name: string; category: string } | null;
    if (tag) {
      if (!tagsMap.has(pid)) tagsMap.set(pid, []);
      tagsMap.get(pid)!.push(tag.tag_name);
    }
  }

  // Top attributes per player (for context)
  const gradesMap = new Map<number, Array<{ attribute: string; score: number; source: string }>>();
  for (const g of (topGradesRes.data ?? []) as Array<Record<string, unknown>>) {
    const pid = g.player_id as number;
    if (!gradesMap.has(pid)) gradesMap.set(pid, []);
    const score = (g.scout_grade ?? g.stat_score ?? 0) as number;
    if (score > 0) {
      gradesMap.get(pid)!.push({
        attribute: g.attribute as string,
        score,
        source: g.source as string,
      });
    }
  }

  // Merge everything
  const enriched = (players ?? []).map((p: Record<string, unknown>) => {
    const pid = p.person_id as number;
    const meta = personalityMap.get(pid);
    const metrics = metricsMap.get(pid);
    const tags = tagsMap.get(pid) ?? [];
    const grades = (gradesMap.get(pid) ?? [])
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // top 8 attributes

    return {
      ...p,
      is_inferred: meta?.is_inferred ?? true,
      personality_confidence: meta?.confidence ?? "Low",
      inference_notes: meta?.inference_notes ?? null,
      trajectory: metrics?.trajectory ?? null,
      loyalty_score: metrics?.loyalty_score ?? null,
      mobility_score: metrics?.mobility_score ?? null,
      clubs_count: metrics?.clubs_count ?? null,
      career_years: metrics?.career_years ?? null,
      tags,
      top_attributes: grades,
    };
  });

  // Apply filter
  let filtered = enriched;
  if (filter === "inferred") {
    filtered = enriched.filter(p => p.is_inferred);
  } else if (filter === "reviewed") {
    filtered = enriched.filter(p => !p.is_inferred);
  }

  return NextResponse.json({ players: filtered });
}
