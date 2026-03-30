import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { categorizePool, type PoolPlayer } from "@/lib/ideal-squad";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

/**
 * GET /api/on-the-plane/nations/[id]/players
 * Returns the full national pool for a WC nation with pool categories.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { id } = await params;
  const nationId = parseInt(id, 10);
  if (isNaN(nationId)) {
    return NextResponse.json({ error: "Invalid nation ID" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Verify this is a WC nation
  const { data: wcNation } = await sb
    .from("wc_nations")
    .select("nation_id, slug")
    .eq("nation_id", nationId)
    .single();

  if (!wcNation) {
    return NextResponse.json({ error: "Nation not in World Cup 2026" }, { status: 404 });
  }

  // Cap-tied aware: only include dual nationals who are either cap-tied
  // to this nation or uncapped (no is_cap_tied=true row anywhere)
  const { data: dualNationals } = await sb.rpc("get_eligible_dual_nationals", {
    p_nation_id: nationId,
  });

  const dualIds = (dualNationals ?? []).map((d: { person_id: number }) => d.person_id);

  // Step 1: Get person IDs from people table (primary nation)
  // Use range queries to bypass Supabase 1000-row default limit
  const primaryIds: number[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await sb
      .from("people")
      .select("id")
      .eq("nation_id", nationId)
      .eq("active", true)
      .neq("is_female", true)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    primaryIds.push(...data.map((p) => p.id));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Combine primary + dual national IDs
  const allIds = [...new Set([...primaryIds, ...dualIds])];

  if (allIds.length === 0) {
    return NextResponse.json({ nation_id: nationId, slug: wcNation.slug, total: 0, players: [] });
  }

  // Step 2: Get full player details from player_intelligence_card view
  // Query in batches if needed (Supabase IN has limits)
  const BATCH = 500;
  type PICRow = {
    person_id: number; name: string; position: string | null;
    level: number | null; archetype: string | null; personality_type: string | null;
    club: string | null; best_role: string | null; best_role_score: number | null;
    overall_pillar_score: number | null;
    technical_score: number | null; tactical_score: number | null;
    mental_score: number | null; physical_score: number | null;
  };
  const picRows: PICRow[] = [];

  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const { data } = await sb
      .from("player_intelligence_card")
      .select(`
        person_id, name, position, level, archetype, personality_type,
        club, best_role, best_role_score, overall_pillar_score,
        technical_score, tactical_score, mental_score, physical_score
      `)
      .in("person_id", batch)
      .eq("active", true);
    if (data) picRows.push(...(data as PICRow[]));
  }

  // Build player pool
  const seen = new Set<number>();
  const allPlayers: PoolPlayer[] = [];

  const today = new Date();
  for (const p of picRows) {
    if (seen.has(p.person_id)) continue;
    seen.add(p.person_id);
    allPlayers.push({
      person_id: p.person_id,
      name: p.name,
      position: p.position,
      level: p.level,
      overall_pillar_score: p.overall_pillar_score,
      archetype: p.archetype,
      personality_type: p.personality_type,
      preferred_foot: null,
      age: null,
      club: p.club,
      best_role: p.best_role,
      best_role_score: p.best_role_score,
      international_caps: null,
      has_national_team_history: false,
    });
  }

  // Fetch DOBs for age computation
  const personIds = allPlayers.map((p) => p.person_id);
  if (personIds.length > 0) {
    const { data: people } = await sb
      .from("people")
      .select("id, dob, international_caps")
      .in("id", personIds);

    const dobMap = new Map<number, { dob: string | null; caps: number | null }>();
    for (const p of people ?? []) {
      dobMap.set(p.id, { dob: p.dob, caps: p.international_caps });
    }

    for (const player of allPlayers) {
      const info = dobMap.get(player.person_id);
      if (info?.dob) {
        const birth = new Date(info.dob);
        player.age = Math.floor(
          (today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
      }
      player.international_caps = info?.caps ?? null;
    }
  }

  // Check national team career history
  if (personIds.length > 0) {
    const { data: careers } = await sb
      .from("player_career_history")
      .select("person_id")
      .in("person_id", personIds)
      .eq("team_type", "national_team");

    const historySet = new Set((careers ?? []).map((c) => c.person_id));
    for (const player of allPlayers) {
      player.has_national_team_history = historySet.has(player.person_id);
    }
  }

  // Apply pool categories
  const categorized = categorizePool(allPlayers);

  return NextResponse.json({
    nation_id: nationId,
    slug: wcNation.slug,
    total: categorized.length,
    players: categorized,
  });
}
