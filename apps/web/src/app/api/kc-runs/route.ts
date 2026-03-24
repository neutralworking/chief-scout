import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * POST /api/kc-runs — Create a new run
 * Body: { user_id, formation, playing_style, seed }
 *
 * GET /api/kc-runs?user_id=X — Get run history for a user
 */

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { user_id, formation, playing_style } = body;

  if (!formation || !playing_style) {
    return NextResponse.json({ error: "Missing formation or playing_style" }, { status: 400 });
  }

  // Ensure user exists (same pattern as Gaffer)
  if (user_id) {
    await supabaseServer
      .from("fc_users")
      .upsert({ id: user_id, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }

  const { data, error } = await supabaseServer
    .from("kc_runs")
    .insert({
      user_id: user_id || null,
      formation,
      playing_style,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ run_id: data.id });
}

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const userId = req.nextUrl.searchParams.get("user_id");
  const cols = "id, formation, playing_style, wins, losses, status, score, started_at, ended_at";

  const { data, error } = userId
    ? await supabaseServer
        .from("kc_runs")
        .select(cols)
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(20)
    : await supabaseServer
        .from("kc_runs")
        .select(cols)
        .in("status", ["won", "lost"])
        .order("score", { ascending: false })
        .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
