import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, position, level, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_eur, director_valuation_meur";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const sort = searchParams.get("sort") ?? "level";
  const tab = searchParams.get("tab") ?? "free"; // free | 2026 | 2027

  // Determine date ranges based on tab
  const now = new Date();
  const currentYear = now.getFullYear();

  // Collect player IDs and contract dates
  const playerIds = new Set<number>();
  const contractDates: Record<number, string> = {};
  const contractTags: Record<number, string> = {};

  if (tab === "free") {
    // Players whose contract already expired or tagged as free agent
    const [{ data: expired }, { data: freeStatus }] = await Promise.all([
      supabase
        .from("people")
        .select("id, contract_expiry_date")
        .not("contract_expiry_date", "is", null)
        .lt("contract_expiry_date", now.toISOString().split("T")[0]),
      supabase
        .from("player_status")
        .select("person_id, contract_tag")
        .or("contract_tag.ilike.%free%,contract_tag.ilike.%end of contract%,contract_tag.ilike.%unattached%"),
    ]);

    for (const row of expired ?? []) {
      playerIds.add(row.id);
      contractDates[row.id] = row.contract_expiry_date;
    }
    for (const row of freeStatus ?? []) {
      playerIds.add(row.person_id);
      contractTags[row.person_id] = row.contract_tag;
    }
  } else {
    // Expiring in a specific year
    const year = tab === "2027" ? currentYear + 1 : currentYear;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: expiring } = await supabase
      .from("people")
      .select("id, contract_expiry_date")
      .not("contract_expiry_date", "is", null)
      .gte("contract_expiry_date", startDate)
      .lte("contract_expiry_date", endDate);

    for (const row of expiring ?? []) {
      playerIds.add(row.id);
      contractDates[row.id] = row.contract_expiry_date;
    }
  }

  if (playerIds.size === 0) {
    return NextResponse.json({ players: [], total: 0 });
  }

  // Fetch player cards — Supabase .in() has a limit, batch if needed
  const idArray = Array.from(playerIds);
  let query = supabase
    .from("player_intelligence_card")
    .select(SELECT)
    .in("person_id", idArray);

  // Only show active players (filter out retired)
  query = query.eq("active", true);
  if (position) query = query.eq("position", position);

  switch (sort) {
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "age":
      query = query.order("dob", { ascending: true, nullsFirst: false });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players = (data ?? []).map((p: any) => ({
    ...p,
    contract_expiry_date: contractDates[p.person_id as number] ?? null,
    contract_tag: contractTags[p.person_id as number] ?? null,
  }));

  return NextResponse.json({ players, total: players.length });
}
