import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { prodFilter } from "@/lib/env";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, club_id, position, level, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt, market_value_eur, director_valuation_meur, best_role, best_role_score, fingerprint";

// Fingerprints are precomputed by pipeline/51_fingerprints.py
// and stored in player_profiles.fingerprint (percentile ranks within position group).
// The view includes them directly — no computation needed here.

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const pursuit = searchParams.get("pursuit");
  const personalities = searchParams.get("personalities");
  const tier = searchParams.get("tier");
  const full = searchParams.get("full");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") ?? "value";
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const offset = Number(searchParams.get("offset") || 0);

  let query = prodFilter(supabase.from("player_intelligence_card").select(SELECT));

  // Exclude retired/inactive players by default
  query = query.eq("active", true);

  // Server-side filters
  if (position) query = query.eq("position", position);
  if (pursuit) query = query.eq("pursuit_status", pursuit);
  if (personalities) {
    const types = personalities.split(",").map((t) => t.trim());
    query = query.in("personality_type", types);
  }
  if (tier) query = query.eq("profile_tier", parseInt(tier, 10));
  if (full === "1") {
    query = query.not("archetype", "is", null).not("personality_type", "is", null).not("level", "is", null);
  }
  if (q) query = query.ilike("name", `%${q}%`);

  // Sort
  switch (sort) {
    case "level":
      query = query.order("level", { ascending: false, nullsFirst: false });
      break;
    case "role_score":
      query = query.order("best_role_score", { ascending: false, nullsFirst: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "position":
      query = query.order("position", { ascending: true, nullsFirst: false });
      break;
    case "cs_value":
      query = query.order("director_valuation_meur", { ascending: false, nullsFirst: false });
      break;
    case "tm_value":
      query = query.order("market_value_eur", { ascending: false, nullsFirst: false });
      break;
    case "value":
      query = query.order("director_valuation_meur", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("best_role_score", { ascending: false, nullsFirst: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const players = data ?? [];

  // Fingerprints now come precomputed from the view (pipeline 51)
  // Return hasMore flag instead of total count (avoids expensive count query on view)
  return NextResponse.json({ players, hasMore: players.length === limit });
}
