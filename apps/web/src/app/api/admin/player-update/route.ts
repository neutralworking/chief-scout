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

  // Fetch old values for audit log
  const { data: oldRow } = await sb
    .from(table)
    .select(Object.keys(updates).join(", "))
    .eq(keyCol, person_id)
    .maybeSingle();

  // Perform the update
  const { error } = await sb
    .from(table)
    .update(updates)
    .eq(keyCol, person_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log changes to network_edits (best-effort, don't fail the request)
  try {
    const edits = Object.entries(updates).map(([field, newValue]) => ({
      person_id,
      field,
      old_value: oldRow ? String((oldRow as unknown as Record<string, unknown>)[field] ?? "") : null,
      new_value: newValue != null ? String(newValue) : null,
      table_name: table,
      user_id: "admin",
    }));

    if (edits.length > 0) {
      await sb.from("network_edits").insert(edits);
    }
  } catch {
    // Audit logging is best-effort
  }

  return NextResponse.json({ ok: true, person_id, table, updated: Object.keys(updates) });
}
