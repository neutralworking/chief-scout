import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeIdealSquad, categorizePool, type PoolPlayer } from "@/lib/ideal-squad";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

/**
 * GET /api/on-the-plane/nations/[id]/ideal
 * Returns the pre-computed ideal squad, or computes on-the-fly.
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

  // Check for pre-computed result first
  const { data: cached } = await sb
    .from("otp_ideal_squads")
    .select("*")
    .eq("nation_id", nationId)
    .single();

  if (cached) {
    return NextResponse.json({
      nation_id: nationId,
      formation: cached.formation,
      squad: cached.squad_json,
      strength: cached.strength,
      computed_at: cached.computed_at,
      cached: true,
    });
  }

  // Compute on-the-fly — fetch players directly
  const { data: primaryPlayers } = await sb
    .from("players")
    .select(`
      person_id, name, position, level, archetype, personality_type,
      club, best_role, best_role_score, overall_pillar_score
    `)
    .eq("nation_id", nationId)
    .eq("active", true);

  // Cap-tied aware: only include dual nationals who are either cap-tied
  // to this nation or uncapped (no is_cap_tied=true row anywhere)
  const { data: dualNationals } = await sb.rpc("get_eligible_dual_nationals", {
    p_nation_id: nationId,
  });

  const dualIds = (dualNationals ?? []).map((d: { person_id: number }) => d.person_id);
  let dualPlayers: typeof primaryPlayers = [];
  if (dualIds.length > 0) {
    const { data } = await sb
      .from("players")
      .select(`
        person_id, name, position, level, archetype, personality_type,
        club, best_role, best_role_score, overall_pillar_score
      `)
      .in("person_id", dualIds)
      .eq("active", true);
    dualPlayers = data;
  }

  const seen = new Set<number>();
  const allPlayers: PoolPlayer[] = [];
  const today = new Date();

  const addPlayer = (p: NonNullable<typeof primaryPlayers>[0]) => {
    if (seen.has(p.person_id)) return;
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
  };

  for (const p of primaryPlayers ?? []) addPlayer(p);
  for (const p of dualPlayers ?? []) addPlayer(p);

  // Fetch DOBs + caps
  const personIds = allPlayers.map((p) => p.person_id);
  if (personIds.length > 0) {
    const { data: people } = await sb
      .from("people")
      .select("id, dob, international_caps, preferred_foot")
      .in("id", personIds);

    for (const player of allPlayers) {
      const info = (people ?? []).find((pp) => pp.id === player.person_id);
      if (info?.dob) {
        const birth = new Date(info.dob);
        player.age = Math.floor(
          (today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
      }
      player.international_caps = info?.international_caps ?? null;
      player.preferred_foot = info?.preferred_foot ?? null;
    }

    // Check national team history
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

  // Fetch coach's preferred formation
  const { data: wcNation } = await sb
    .from("wc_nations")
    .select("preferred_formation")
    .eq("nation_id", nationId)
    .single();

  const ideal = computeIdealSquad(allPlayers);

  if (!ideal) {
    return NextResponse.json(
      { error: "Not enough players to compute squad", player_count: allPlayers.length },
      { status: 422 }
    );
  }

  // Cache the result
  await sb.from("otp_ideal_squads").upsert({
    nation_id: nationId,
    formation: ideal.formation,
    squad_json: [...ideal.starting_xi, ...ideal.bench],
    strength: ideal.strength,
    computed_at: new Date().toISOString(),
  });

  return NextResponse.json({
    nation_id: nationId,
    formation: ideal.formation,
    starting_xi: ideal.starting_xi,
    bench: ideal.bench,
    strength: ideal.strength,
    cached: false,
  });
}
