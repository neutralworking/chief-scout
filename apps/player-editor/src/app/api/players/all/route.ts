import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, position, level, peak, overall, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt, market_value_eur";

export async function GET() {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Server-side: service key bypasses RLS and row limits
  // Paginate to handle any PostgREST limits
  const PAGE_SIZE = 5000;
  const all: Record<string, unknown>[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("player_intelligence_card")
      .select(SELECT)
      .order("level", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data && data.length > 0) {
      all.push(...data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return NextResponse.json(all);
}
