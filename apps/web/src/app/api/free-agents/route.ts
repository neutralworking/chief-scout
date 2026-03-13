import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, position, level, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt, market_value_eur, director_valuation_meur";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const sort = searchParams.get("sort") ?? "level";

  // Get players with expiring contracts or free agent status
  // Step 1: Get people with contract_expiry_date <= end of next summer
  const { data: expiring } = await supabase
    .from("people")
    .select("id, contract_expiry_date")
    .not("contract_expiry_date", "is", null)
    .lte("contract_expiry_date", "2026-09-01");

  // Step 2: Get player_status rows with free-agent-like contract tags
  const { data: freeStatus } = await supabase
    .from("player_status")
    .select("person_id, contract_tag")
    .or("contract_tag.ilike.%free%,contract_tag.ilike.%expir%,contract_tag.ilike.%end of contract%");

  // Combine IDs
  const playerIds = new Set<number>();
  const contractDates: Record<number, string> = {};

  for (const row of expiring ?? []) {
    playerIds.add(row.id);
    contractDates[row.id] = row.contract_expiry_date;
  }
  for (const row of freeStatus ?? []) {
    playerIds.add(row.person_id);
  }

  if (playerIds.size === 0) {
    // Fall back: return players with contract_tag containing common expiry indicators
    // or just return all players sorted by level as a baseline
    const { data: fallback } = await supabase
      .from("player_intelligence_card")
      .select(SELECT)
      .not("level", "is", null)
      .order("level", { ascending: false })
      .limit(50);

    return NextResponse.json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      players: (fallback ?? []).map((p: any) => ({ ...p, contract_expiry_date: null })),
      total: fallback?.length ?? 0,
      fallback: true,
    });
  }

  // Step 3: Get full player cards for those IDs
  let query = supabase
    .from("player_intelligence_card")
    .select(SELECT)
    .in("person_id", Array.from(playerIds));

  if (position) query = query.eq("position", position);

  switch (sort) {
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "value":
      query = query.order("market_value_eur", { ascending: false, nullsFirst: false });
      break;
    case "level":
    default:
      query = query.order("level", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with contract_expiry_date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players = (data ?? []).map((p: any) => ({
    ...p,
    contract_expiry_date: contractDates[p.person_id as number] ?? null,
  }));

  return NextResponse.json({ players, total: players.length });
}
