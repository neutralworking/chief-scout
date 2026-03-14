import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Try network_edits first (dedicated audit table)
  const { data: edits, error: editsError } = await supabaseServer
    .from("network_edits")
    .select("id, person_id, field, old_value, new_value, table_name, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (editsError) {
    // Table might not exist yet — return empty
    return NextResponse.json({ changes: [], source: "none" });
  }

  // Enrich with player names
  const personIds = [...new Set((edits ?? []).map((e) => e.person_id).filter(Boolean))];
  let nameMap: Record<number, string> = {};

  if (personIds.length > 0) {
    const { data: people } = await supabaseServer
      .from("people")
      .select("id, name")
      .in("id", personIds);
    if (people) {
      for (const p of people) nameMap[p.id] = p.name;
    }
  }

  const changes = (edits ?? []).map((e) => ({
    ...e,
    player_name: nameMap[e.person_id] ?? null,
  }));

  return NextResponse.json({ changes, source: "network_edits" });
}
