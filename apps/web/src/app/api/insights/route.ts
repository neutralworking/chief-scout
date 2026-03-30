import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { prodFilter } from "@/lib/env";
import { fetchSeasonStats } from "@/lib/stats";

const PIC_SELECT =
  "person_id, name, dob, position, club, club_id, level, overall, archetype, best_role, best_role_score, fingerprint, nation, nation_code, hg, league_name, market_value_eur, pursuit_status";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const league = searchParams.get("league");
  const minScore = Number(searchParams.get("min_score") ?? "0");
  const limit = Math.min(Number(searchParams.get("limit") ?? "25"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");

  // Query scout_insights ordered by gem_score
  let insightQuery = supabase
    .from("scout_insights")
    .select("person_id, insight_type, gem_score, headline, prose, evidence, season", { count: "exact" })
    .eq("insight_type", "hidden_gem")
    .gte("gem_score", minScore)
    .order("gem_score", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: rawInsights, error: insightError, count } = await insightQuery;

  if (insightError) {
    return NextResponse.json({ error: insightError.message }, { status: 500 });
  }

  const insights = rawInsights ?? [];
  if (insights.length === 0) {
    return NextResponse.json({ insights: [], total: 0 });
  }

  // Fetch player intelligence cards for matched person_ids
  const personIds = insights.map((i: Record<string, unknown>) => i.person_id as number);

  let picQuery = prodFilter(
    supabase
      .from("player_intelligence_card")
      .select(PIC_SELECT)
      .in("person_id", personIds)
  );
  if (position) picQuery = picQuery.eq("position", position);
  if (league) picQuery = picQuery.eq("league_name", league);

  const { data: picData } = await picQuery;
  const picMap = new Map<number, Record<string, unknown>>();
  for (const row of (picData ?? []) as Record<string, unknown>[]) {
    picMap.set(row.person_id as number, row);
  }

  // Enrich with season stats + tactical roles (from system_slots + slot_roles)
  const validPids = personIds.filter((id: number) => picMap.has(id));
  const [statsMap, slotsResult, slotRolesResult] = await Promise.all([
    validPids.length > 0 ? fetchSeasonStats(supabase, validPids) : Promise.resolve(new Map()),
    supabase.from("system_slots").select("id, position"),
    supabase.from("slot_roles").select("slot_id, role_name"),
  ]);

  // Build position → unique role names
  const slotPosMap = new Map<number, string>();
  for (const s of (slotsResult.data ?? []) as { id: number; position: string }[]) {
    slotPosMap.set(s.id, s.position);
  }
  const rolesByPosition = new Map<string, { name: string; formations: string[] }[]>();
  const seenRoles = new Set<string>();
  for (const sr of (slotRolesResult.data ?? []) as { slot_id: number; role_name: string }[]) {
    const pos = slotPosMap.get(sr.slot_id);
    if (!pos) continue;
    const key = `${sr.role_name}|${pos}`;
    if (seenRoles.has(key)) continue;
    seenRoles.add(key);
    const list = rolesByPosition.get(pos) ?? [];
    list.push({ name: sr.role_name, formations: [] });
    rolesByPosition.set(pos, list);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = insights
    .filter((i: Record<string, unknown>) => picMap.has(i.person_id as number))
    .map((i: Record<string, unknown>) => {
      const pid = i.person_id as number;
      const pic = picMap.get(pid) ?? {};
      const stats = statsMap.get(pid);
      const pos = pic.position as string | null;
      const posRoles = pos ? (rolesByPosition.get(pos) ?? []).slice(0, 3) : [];
      return {
        ...i,
        player: {
          ...pic,
          goals: stats?.goals ?? null,
          assists: stats?.assists ?? null,
          apps: stats?.apps ?? null,
          rating: stats?.rating ? Math.round(stats.rating * 100) / 100 : null,
          tactical_roles: posRoles,
        },
      };
    });

  // Apply position/league filter post-join (since we filter on PIC)
  const filtered = enriched.filter((i: Record<string, unknown>) => {
    const player = i.player as Record<string, unknown>;
    if (position && player.position !== position) return false;
    if (league && player.league_name !== league) return false;
    return true;
  });

  return NextResponse.json({ insights: filtered, total: count ?? filtered.length });
}
