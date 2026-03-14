import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

const VALID_POSITIONS = new Set(["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"]);

export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const position = searchParams.get("position") ?? "";
  const missingData = searchParams.get("missing") === "1";
  const idParam = searchParams.get("id");

  const sb = createClient(supabaseUrl, supabaseKey);

  const SELECT = "person_id, name, club, nation, position, level, pursuit_status, profile_tier, archetype, scouting_notes, personality_type, market_value_tier";

  // Single-player lookup by ID (for editor detail completeness)
  if (idParam) {
    const pid = Number(idParam);
    const [cardRes, statusRes] = await Promise.all([
      sb.from("player_intelligence_card").select(SELECT).eq("person_id", pid).maybeSingle(),
      sb.from("player_status").select("contract_tag").eq("person_id", pid).maybeSingle(),
    ]);

    if (cardRes.error) {
      return NextResponse.json({ error: cardRes.error.message }, { status: 500 });
    }

    const player = cardRes.data
      ? { ...cardRes.data, contract_tag: statusRes.data?.contract_tag ?? null }
      : null;
    return NextResponse.json({ players: player ? [player] : [] });
  }

  // Require either a search query or a filter
  if (q.length < 2 && !position && !missingData) {
    return NextResponse.json({ players: [] });
  }

  let query = sb
    .from("player_intelligence_card")
    .select(SELECT)
    .order("level", { ascending: false, nullsFirst: false })
    .limit(40);

  if (q.length >= 2) {
    query = query.ilike("name", `%${q}%`);
  }

  if (position && VALID_POSITIONS.has(position)) {
    query = query.eq("position", position);
  }

  if (missingData) {
    query = query.gte("level", 70).or("position.is.null,archetype.is.null,scouting_notes.is.null");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [] });
}
