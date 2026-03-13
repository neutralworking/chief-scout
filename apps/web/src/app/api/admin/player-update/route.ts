import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const body = await request.json();
  const { person_id, table, updates } = body as {
    person_id: number;
    table: "player_status" | "player_profiles" | "player_market" | "people";
    updates: Record<string, unknown>;
  };

  if (!person_id || !table || !updates || Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Missing person_id, table, or updates" }, { status: 400 });
  }

  const ALLOWED_TABLES = ["player_status", "player_profiles", "player_market", "people"];
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: `Table ${table} not allowed` }, { status: 400 });
  }

  const keyCol = table === "people" ? "id" : "person_id";

  const { error } = await sb
    .from(table)
    .update(updates)
    .eq(keyCol, person_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, person_id, table, updated: Object.keys(updates) });
}
