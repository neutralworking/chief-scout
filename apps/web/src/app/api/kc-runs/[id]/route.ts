import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * PATCH /api/kc-runs/[id] — Update run state
 * Body: { cash, stadium_tier, round, wins, losses, status, score, deck_card_ids }
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { id } = await params;
  const body = await req.json();

  // Update run summary fields
  const runUpdate: Record<string, unknown> = {};
  if (body.cash != null) runUpdate.cash = body.cash;
  if (body.stadium_tier != null) runUpdate.stadium_tier = body.stadium_tier;
  if (body.round != null) runUpdate.round = body.round;
  if (body.wins != null) runUpdate.wins = body.wins;
  if (body.losses != null) runUpdate.losses = body.losses;
  if (body.score != null) runUpdate.score = body.score;
  if (body.status) {
    runUpdate.status = body.status;
    if (body.status === "won" || body.status === "lost" || body.status === "abandoned") {
      runUpdate.ended_at = new Date().toISOString();
    }
  }

  if (Object.keys(runUpdate).length > 0) {
    const { error } = await supabaseServer
      .from("kc_runs")
      .update(runUpdate)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Sync deck cards if provided
  if (body.deck_card_ids && Array.isArray(body.deck_card_ids)) {
    // Clear existing and re-insert
    await supabaseServer.from("kc_run_cards").delete().eq("run_id", id);

    const rows = body.deck_card_ids.map(
      (entry: { card_id: number; slot: string | null; injured: boolean }) => ({
        run_id: id,
        card_id: entry.card_id,
        slot: entry.slot || null,
        injured: entry.injured || false,
      })
    );

    if (rows.length > 0) {
      const { error } = await supabaseServer.from("kc_run_cards").insert(rows);
      if (error) {
        console.error("kc_run_cards insert error:", error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
