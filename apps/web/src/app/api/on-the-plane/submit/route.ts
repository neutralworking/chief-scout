import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compareSquads, type IdealSquadResult } from "@/lib/ideal-squad";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

/**
 * POST /api/on-the-plane/submit
 * Save user squad + compute match score vs ideal.
 */
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { user_id, nation_id, formation, squad, starting_xi } = body as {
    user_id: string;
    nation_id: number;
    formation: string;
    squad: { person_id: number; position: string; is_starter: boolean; slot?: string }[];
    starting_xi: number[];
  };

  if (!user_id || !nation_id || !formation || !squad || !starting_xi) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (squad.length !== 26) {
    return NextResponse.json({ error: "Squad must have exactly 26 players" }, { status: 400 });
  }

  if (starting_xi.length !== 11) {
    return NextResponse.json({ error: "Starting XI must have exactly 11 players" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Get the ideal squad for comparison
  const { data: ideal } = await sb
    .from("otp_ideal_squads")
    .select("*")
    .eq("nation_id", nation_id)
    .single();

  let comparison = null;
  if (ideal) {
    const idealResult: IdealSquadResult = {
      formation: ideal.formation,
      starting_xi: (ideal.squad_json as { person_id: number; name: string; position: string; role: string; role_score: number; pool_category: string; is_starter?: boolean }[])
        .filter((p) => p.is_starter !== false && p.role) // starters have role
        .slice(0, 11)
        .map((p) => ({
          person_id: p.person_id,
          name: p.name,
          position: p.position,
          role: p.role ?? "",
          role_score: p.role_score ?? 0,
          pool_category: (p.pool_category ?? "uncapped") as "established" | "rising_star" | "form_pick" | "uncapped" | "recall",
        })),
      bench: (ideal.squad_json as { person_id: number; name: string; position: string; overall?: number; pool_category?: string }[])
        .slice(11)
        .map((p) => ({
          person_id: p.person_id,
          name: p.name,
          position: p.position,
          pool_category: (p.pool_category ?? "uncapped") as "established" | "rising_star" | "form_pick" | "uncapped" | "recall",
          overall: p.overall ?? 0,
        })),
      strength: ideal.strength ?? 0,
    };

    const userSquadIds = squad.map((s) => s.person_id);
    comparison = compareSquads(userSquadIds, starting_xi, formation, idealResult);
  }

  // Save entry (upsert — one per user per nation)
  const { error: upsertError } = await sb.from("otp_entries").upsert(
    {
      user_id,
      nation_id,
      formation,
      squad_json: squad,
      score: comparison?.score ?? null,
      score_breakdown: comparison ?? null,
    },
    { onConflict: "user_id,nation_id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Update nation stats (best-effort)
  try {
    await sb.rpc("update_otp_nation_stats", { p_nation_id: nation_id });
  } catch {
    // RPC may not exist yet — ignore
  }

  return NextResponse.json({
    success: true,
    comparison,
    ideal: ideal
      ? {
          formation: ideal.formation,
          squad: ideal.squad_json,
          strength: ideal.strength,
        }
      : null,
  });
}
