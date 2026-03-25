import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

/**
 * GET /api/cron/refresh-cards
 *
 * Refreshes the player_intelligence_card materialized view concurrently.
 * CONCURRENTLY allows reads to continue during refresh (requires unique index).
 *
 * Triggered by:
 *   - Vercel Cron (every 30 min)
 *   - Admin panel button
 *   - After pipeline runs
 */
export async function GET(request: NextRequest) {
  // Auth: require CRON_SECRET or admin header
  const authHeader = request.headers.get("authorization");
  const isAdmin = request.headers.get("x-admin") === "1";
  const cronSecret = process.env.CRON_SECRET;

  if (!isAdmin && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const start = Date.now();

  try {
    const { error } = await sb.rpc("refresh_intelligence_card");
    if (error) throw error;

    const ms = Date.now() - start;
    return NextResponse.json({ ok: true, ms, message: `Refreshed in ${ms}ms` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
