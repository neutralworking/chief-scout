import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * POST /api/kc-runs/[id]/matches — Record a match result
 * Body: { round, opponent_name, opponent_style, player_score, opponent_score,
 *         attendance, revenue, result, synergies_triggered }
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { id } = await params;
  const body = await req.json();

  const { error } = await supabaseServer.from("kc_matches").insert({
    run_id: id,
    round: body.round,
    opponent_name: body.opponent_name,
    opponent_style: body.opponent_style ?? null,
    player_score: body.player_score,
    opponent_score: body.opponent_score,
    attendance: body.attendance ?? null,
    revenue: body.revenue ?? null,
    result: body.result,
    synergies_triggered: body.synergies_triggered ?? [],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
