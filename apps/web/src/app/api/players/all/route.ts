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
  if (q) {
    // Accent-insensitive search: split into words, match each independently.
    // "fermin lopez" → must match BOTH a "fermin/fermín" variant AND a "lopez/lópez" variant.
    const ACCENT_EXPAND: Record<string, string> = {
      a: "á", e: "é", i: "í", o: "ó", u: "ú", n: "ñ", c: "ç", d: "đ",
    };
    const DEACCENT: Record<string, string> = {
      ø: "o", ð: "d", æ: "a", đ: "d",
      á: "a", à: "a", â: "a", ã: "a", ä: "a", å: "a",
      é: "e", è: "e", ê: "e", ë: "e",
      í: "i", ì: "i", î: "i", ï: "i",
      ó: "o", ò: "o", ô: "o", õ: "o", ö: "o",
      ú: "u", ù: "u", û: "u", ü: "u",
      ñ: "n", ç: "c", ý: "y", ÿ: "y", š: "s", ž: "z",
    };
    function wordVariants(word: string): string[] {
      const stripped = [...word].map((ch) => DEACCENT[ch] ?? DEACCENT[ch.toLowerCase()] ?? ch).join("");
      const variants = new Set<string>([word, stripped]);
      for (let i = 0; i < stripped.length; i++) {
        const acc = ACCENT_EXPAND[stripped[i].toLowerCase()];
        if (acc) variants.add(stripped.slice(0, i) + acc + stripped.slice(i + 1));
      }
      return [...variants];
    }

    const words = q.trim().split(/\s+/).filter((w) => w.length >= 2);
    if (words.length === 1) {
      const orFilter = wordVariants(words[0]).map((v) => `name.ilike.%${v}%`).join(",");
      query = query.or(orFilter);
    } else {
      // Multiple words: each word must match (AND between words, OR between variants)
      for (const word of words) {
        const orFilter = wordVariants(word).map((v) => `name.ilike.%${v}%`).join(",");
        query = query.or(orFilter);
      }
    }
  }

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
    // Tiebreaker: ensure stable ordering across pages (no duplicate players)
    query = query.order("person_id", { ascending: true });
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

  // Enrich with season stats from FBRef (primary) + Kaggle (fallback)
  if (wantStats && players.length > 0) {
    const ids = players.map((p) => p.person_id as number).filter(Boolean);

    // FBRef via player_id_links — has real goals/assists/xG data
    const { data: fbrefLinks } = await supabase
      .from("player_id_links")
      .select("person_id, external_id")
      .eq("source", "fbref")
      .in("person_id", ids);

    const fbrefIds = (fbrefLinks ?? []).map((l) => l.external_id as string).filter(Boolean);
    const pidByFbref = new Map((fbrefLinks ?? []).map((l) => [l.external_id as string, l.person_id as number]));

    let fbrefStats: Record<string, unknown>[] = [];
    if (fbrefIds.length > 0) {
      const { data } = await supabase
        .from("fbref_player_season_stats")
        .select("fbref_id, matches_played, goals, assists, xg, xag, minutes")
        .in("fbref_id", fbrefIds);
      fbrefStats = (data ?? []) as Record<string, unknown>[];
    }

    // Kaggle fallback for players without FBRef data
    const { data: euroStats } = await supabase
      .from("kaggle_euro_league_stats")
      .select("person_id, matches_played, goals, assists, xg, xa")
      .in("person_id", ids);

    const { data: plStats } = await supabase
      .from("kaggle_pl_stats")
      .select("person_id, matches_played, goals, assists, xg, xa")
      .in("person_id", ids);

    // Aggregate: FBRef first, then Kaggle fills gaps
    const statsMap: Record<number, { apps: number; goals: number; assists: number; xg: number }> = {};

    // FBRef stats (most reliable — take latest season only per player)
    for (const row of fbrefStats) {
      const fbrefId = row.fbref_id as string;
      const pid = pidByFbref.get(fbrefId);
      if (!pid) continue;
      const existing = statsMap[pid] ?? { apps: 0, goals: 0, assists: 0, xg: 0 };
      existing.apps += (row.matches_played as number) || 0;
      existing.goals += (row.goals as number) || 0;
      existing.assists += (row.assists as number) || 0;
      existing.xg += (row.xg as number) || 0;
      statsMap[pid] = existing;
    }

    // Kaggle fallback — only for players not already in statsMap
    const kaggleRows = [...(euroStats ?? []), ...(plStats ?? [])] as Array<Record<string, unknown>>;
    for (const row of kaggleRows) {
      const pid = row.person_id as number;
      if (!pid || statsMap[pid]) continue;
      const goals = (row.goals as number) || 0;
      const assists = (row.assists as number) || 0;
      if (goals === 0 && assists === 0) continue;
      const entry = { apps: 0, goals: 0, assists: 0, xg: 0 };
      entry.apps += (row.matches_played as number) || 0;
      entry.goals += goals;
      entry.assists += assists;
      entry.xg += (row.xg as number) || 0;
      statsMap[pid] = entry;
    }

    players = players.map((p) => {
      const s = statsMap[p.person_id as number];
      return {
        ...p,
        apps: s?.apps || null,
        goals: s?.goals || null,
        assists: s?.assists || null,
        xg: s?.xg ? Math.round(s.xg * 10) / 10 : null,
      };
    });
  }

  // Fingerprints now come precomputed from the view (pipeline 51)
  // Return hasMore flag instead of total count (avoids expensive count query on view)
  return NextResponse.json({ players, hasMore: players.length === limit });
}
