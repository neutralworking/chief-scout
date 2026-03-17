import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { prodFilter } from "@/lib/env";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, club_id, position, level, overall, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt, market_value_eur, director_valuation_meur, best_role, best_role_score, fingerprint";

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
  const wantStats = searchParams.get("stats") === "1";

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
    query = query.not("archetype", "is", null).not("personality_type", "is", null).not("overall", "is", null);
  }
  if (q) query = query.ilike("name", `%${q}%`);

  // "Needs Review" sort: fetch wider set, sort by |level - overall| divergence
  const isReviewSort = sort === "review";

  // Sort
  if (!isReviewSort) {
    switch (sort) {
      case "level":
        query = query.order("overall", { ascending: false, nullsFirst: false });
        break;
      case "level_raw":
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
  } else {
    // For review sort: need both level and overall non-null, fetch more rows to sort
    query = query.not("level", "is", null).not("overall", "is", null);
    query = query.order("level", { ascending: false, nullsFirst: false });
    query = query.range(0, 499); // fetch up to 500 to sort by divergence
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let players = (data ?? []) as Record<string, unknown>[];

  // Sort by divergence for review mode
  if (isReviewSort) {
    players.sort((a, b) => {
      const divA = Math.abs((a.level as number) - (a.overall as number));
      const divB = Math.abs((b.level as number) - (b.overall as number));
      return divB - divA;
    });
    players = players.slice(offset, offset + limit);
  }

  // Enrich with season stats (apps, goals, assists) from Kaggle tables
  if (wantStats && players.length > 0) {
    const ids = players.map((p) => p.person_id as number).filter(Boolean);

    // Try euro league stats first (broader coverage), then PL stats as fallback
    const { data: euroStats } = await supabase
      .from("kaggle_euro_league_stats")
      .select("person_id, matches_played, goals, assists")
      .in("person_id", ids);

    const { data: plStats } = await supabase
      .from("kaggle_pl_stats")
      .select("person_id, matches_played, goals, assists")
      .in("person_id", ids);

    // Aggregate per player (sum across rows — player may have multiple entries)
    const statsMap: Record<number, { apps: number; goals: number; assists: number }> = {};
    for (const row of [...(euroStats ?? []), ...(plStats ?? [])]) {
      const pid = row.person_id as number;
      if (!pid) continue;
      const existing = statsMap[pid] ?? { apps: 0, goals: 0, assists: 0 };
      existing.apps += (row.matches_played as number) || 0;
      existing.goals += (row.goals as number) || 0;
      existing.assists += (row.assists as number) || 0;
      statsMap[pid] = existing;
    }

    players = players.map((p) => {
      const s = statsMap[p.person_id as number];
      return {
        ...p,
        apps: s?.apps || null,
        goals: s?.goals || null,
        assists: s?.assists || null,
      };
    });
  }

  // Fingerprints now come precomputed from the view (pipeline 51)
  // Return hasMore flag instead of total count (avoids expensive count query on view)
  return NextResponse.json({ players, hasMore: players.length === limit });
}
