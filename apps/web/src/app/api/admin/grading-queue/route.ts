import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/grading-queue?limit=100&filter=needs_grades|partial|all&position=CM
 *
 * Returns players sorted by best_role_score desc, with grade coverage stats.
 */
export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
  const filter = req.nextUrl.searchParams.get("filter") ?? "all";
  const position = req.nextUrl.searchParams.get("position") ?? null;

  const sb = createClient(supabaseUrl, supabaseKey);

  // Fetch players with their grade coverage
  const { data: players, error: playersErr } = await sb.rpc("grading_queue", {
    p_limit: limit,
    p_filter: filter,
    p_position: position,
  });

  if (playersErr) {
    // Fallback: direct query if RPC doesn't exist yet
    return await fallbackQuery(sb, limit, filter, position);
  }

  return NextResponse.json({ players: players ?? [] });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fallbackQuery(
  sb: any,
  limit: number,
  filter: string,
  position: string | null,
) {
  // Get players with role scores
  let query = sb
    .from("player_intelligence_card")
    .select("id, name, position, club, nation_code, best_role, best_role_score, earned_archetype, archetype, level, age")
    .not("best_role_score", "is", null)
    .eq("active", true)
    .order("best_role_score", { ascending: false })
    .limit(limit);

  if (position) {
    query = query.eq("position", position);
  }

  const { data: players, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!players || players.length === 0) {
    return NextResponse.json({ players: [] });
  }

  const playerIds = players.map((p: { id: number }) => p.id);

  // Fetch grade counts per player
  const { data: gradeCounts } = await sb
    .from("attribute_grades")
    .select("player_id, source")
    .in("player_id", playerIds);

  // Compute per-player stats
  const statsMap: Record<number, { scout: number; pipeline: number; attrs: Set<string> }> = {};
  // We need attribute info too
  const { data: gradeDetails } = await sb
    .from("attribute_grades")
    .select("player_id, attribute, scout_grade, stat_score, source")
    .in("player_id", playerIds);

  for (const row of gradeDetails ?? []) {
    if (!statsMap[row.player_id]) {
      statsMap[row.player_id] = { scout: 0, pipeline: 0, attrs: new Set() };
    }
    const s = statsMap[row.player_id];
    if (row.source === "scout_assessment" && row.scout_grade != null) {
      s.scout++;
      s.attrs.add(row.attribute);
    }
    if (row.source !== "scout_assessment" && row.stat_score != null) {
      if (!s.attrs.has(row.attribute)) {
        s.pipeline++;
      }
      s.attrs.add(row.attribute);
    }
  }

  const enriched = players.map((p: Record<string, unknown>) => ({
    ...p,
    scout_grades: statsMap[p.id as number]?.scout ?? 0,
    pipeline_grades: statsMap[p.id as number]?.pipeline ?? 0,
    total_coverage: statsMap[p.id as number]?.attrs.size ?? 0,
  }));

  // Apply filter
  const filtered = filter === "all"
    ? enriched
    : filter === "needs_grades"
      ? enriched.filter((p: { scout_grades: number }) => p.scout_grades === 0)
      : filter === "partial"
        ? enriched.filter((p: { scout_grades: number }) => p.scout_grades > 0 && p.scout_grades < 52)
        : enriched;

  return NextResponse.json({ players: filtered });
}
