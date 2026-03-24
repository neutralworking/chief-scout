import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export async function POST() {
  if (!supabaseServer) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const supabase = supabaseServer;
  try {
    // Load all people
    const { data: people, error: peopleErr } = await supabase
      .from("people")
      .select("id, name");
    if (peopleErr) {
      return NextResponse.json({ error: peopleErr.message }, { status: 500 });
    }

    // Build normalized name → id map
    const nameMap = new Map<string, number>();
    for (const p of people ?? []) {
      if (p.name) {
        nameMap.set(normalize(p.name), p.id);
      }
    }

    // Get unmatched fbref_players
    const { data: unmatched, error: unmatchedErr } = await supabase
      .from("fbref_players")
      .select("fbref_id, name")
      .is("person_id", null);
    if (unmatchedErr) {
      return NextResponse.json({ error: unmatchedErr.message }, { status: 500 });
    }

    let matched = 0;
    const total = unmatched?.length ?? 0;

    for (const fp of unmatched ?? []) {
      const norm = normalize(fp.name);
      const personId = nameMap.get(norm);
      if (!personId) continue;

      // Update fbref_players
      const { error: updateErr } = await supabase
        .from("fbref_players")
        .update({ person_id: personId })
        .eq("fbref_id", fp.fbref_id);
      if (updateErr) continue;

      // Insert player_id_links
      await supabase.from("player_id_links").upsert(
        {
          person_id: personId,
          source: "fbref",
          source_id: fp.fbref_id,
        },
        { onConflict: "person_id,source" }
      );

      matched++;
    }

    return NextResponse.json({
      matched,
      unmatched: total - matched,
      total,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
