import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

/**
 * POST /api/admin/bulk-update
 *
 * Apply the same update to multiple players at once.
 * Body: { person_ids: number[], table: string, updates: Record<string, unknown> }
 */
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const body = await request.json();
  const { person_ids, table, updates } = body as {
    person_ids: number[];
    table: "player_status" | "player_profiles" | "player_market" | "people" | "player_personality";
    updates: Record<string, unknown>;
  };

  if (!person_ids?.length || !table || !updates || Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Missing person_ids, table, or updates" }, { status: 400 });
  }

  if (person_ids.length > 200) {
    return NextResponse.json({ error: "Max 200 players per batch" }, { status: 400 });
  }

  const ALLOWED_TABLES = ["player_status", "player_profiles", "player_market", "people", "player_personality"];
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: `Table ${table} not allowed` }, { status: 400 });
  }

  const keyCol = table === "people" ? "id" : "person_id";

  const { error, count } = await sb
    .from(table)
    .update(updates)
    .in(keyCol, person_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: count ?? person_ids.length, table, fields: Object.keys(updates) });
}
