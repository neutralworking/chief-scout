import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { prodFilter } from "@/lib/env";
import { fetchSeasonStats } from "@/lib/stats";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, club_id, position, level, overall, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_eur, director_valuation_meur, best_role, best_role_score, fingerprint";

// Fingerprints are precomputed by pipeline/51_fingerprints.py (percentile ranks within position group).

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const sort = searchParams.get("sort") ?? "overall";
  const tab = searchParams.get("tab") ?? "2026"; // 2026 | free | 2027

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
        .or("contract_tag.eq.Expired,contract_tag.ilike.%free%,contract_tag.ilike.%unattached%"),
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
  let query = prodFilter(supabase
    .from("player_intelligence_card")
    .select(SELECT)
    .in("person_id", idArray));

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
    case "rating":
      // Sort by rating after stats enrichment
      query = query.order("overall", { ascending: false, nullsFirst: false });
      break;
    case "overall":
    case "level":
    default:
      query = query.order("overall", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawPlayers = data ?? [];

  // Enrich with season stats
  const pids = rawPlayers.map((p: Record<string, unknown>) => p.person_id as number).filter(Boolean);
  const statsMap = pids.length > 0 ? await fetchSeasonStats(supabase, pids) : new Map();

  // Fingerprints come precomputed from the view (pipeline 51)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let players = rawPlayers.map((p: any) => {
    const s = statsMap.get(p.person_id as number);
    return {
      ...p,
      contract_expiry_date: contractDates[p.person_id as number] ?? null,
      contract_tag: contractTags[p.person_id as number] ?? null,
      goals: s?.goals || null,
      assists: s?.assists || null,
      rating: s?.rating ? Math.round(s.rating * 100) / 100 : null,
    };
  });

  // Sort by rating if requested (needs stats enrichment first)
  if (sort === "rating") {
    players.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const ra = (a.rating as number) ?? 0;
      const rb = (b.rating as number) ?? 0;
      return rb - ra;
    });
  }

  return NextResponse.json({ players, total: players.length });
}
