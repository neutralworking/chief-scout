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

  // Get dual nationals for this nation
  const { data: dualNationals } = await sb
    .from("player_nationalities")
    .select("person_id")
    .eq("nation_id", nationId);

  const dualIds = (dualNationals ?? []).map((d) => d.person_id);

  // Query all eligible players (primary nation + dual nationals)
  // Using the players view for backward-compat reads
  const { data: primaryPlayers } = await sb
    .from("players")
    .select(`
      person_id, name, position, level, archetype, personality_type,
      club, best_role, best_role_score, overall_pillar_score,
      technical_score, tactical_score, mental_score, physical_score
    `)
    .eq("nation_id", nationId)
    .eq("active", true)
    .order("level", { ascending: false, nullsFirst: false });

  let dualPlayers: typeof primaryPlayers = [];
  if (dualIds.length > 0) {
    const { data } = await sb
      .from("players")
      .select(`
        person_id, name, position, level, archetype, personality_type,
        club, best_role, best_role_score, overall_pillar_score,
        technical_score, tactical_score, mental_score, physical_score
      `)
      .in("person_id", dualIds)
      .eq("active", true);
    dualPlayers = data;
  }

  // Merge and deduplicate
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
      age: null, // computed below if DOB available
      club: p.club,
      best_role: p.best_role,
      best_role_score: p.best_role_score,
      international_caps: null,
      has_national_team_history: false,
    });
  };

  for (const p of primaryPlayers ?? []) addPlayer(p);
  for (const p of dualPlayers ?? []) addPlayer(p);

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
