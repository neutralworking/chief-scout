import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { prodFilter } from "@/lib/env";
import { fetchSeasonStats } from "@/lib/stats";

// Never cache — admin edits must reflect immediately on refresh
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, nation_code, club, club_id, league_name, position, level, peak, overall, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt, market_value_eur, director_valuation_meur, best_role, best_role_score, fingerprint, earned_archetype, archetype_tier, legacy_tag, behavioral_tag, technical_score, tactical_score, mental_score, physical_score, overall_pillar_score";

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

  // Exclude retired/inactive players and women's teams by default
  query = query.eq("active", true)
    .not("club", "ilike", "%women%")
    .not("club", "ilike", "%wfc%");

  // Server-side filters
  if (position) query = query.eq("position", position);
  if (pursuit) query = query.eq("pursuit_status", pursuit);
  if (personalities) {
    const types = personalities.split(",").map((t) => t.trim());
    query = query.in("personality_type", types);
  }
  if (tier) query = query.eq("profile_tier", parseInt(tier, 10));
  const league = searchParams.get("league");
  if (league) query = query.eq("league_name", league);
  const role = searchParams.get("role");
  if (role) query = query.eq("best_role", role);
  const archetype = searchParams.get("archetype");
  if (archetype) query = query.eq("earned_archetype", archetype);
  const maxAge = searchParams.get("max_age");
  if (maxAge) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - parseInt(maxAge, 10));
    query = query.gte("dob", cutoff.toISOString().split("T")[0]);
  }
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
      case "pillar":
        query = query.order("overall_pillar_score", { ascending: false, nullsFirst: false });
        break;
      case "rating":
        // Rating sort uses client-side re-sort after stats enrichment
        query = query.order("best_role_score", { ascending: false, nullsFirst: false });
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

  // Enrich with season stats: API-Football → FBRef → Kaggle cascade
  if (wantStats && players.length > 0) {
    const ids = players.map((p) => p.person_id as number).filter(Boolean);
    const statsMap = await fetchSeasonStats(supabase, ids);

    players = players.map((p) => {
      const s = statsMap.get(p.person_id as number);
      return {
        ...p,
        apps: s?.apps || null,
        goals: s?.goals || null,
        assists: s?.assists || null,
        xg: s?.xg ? Math.round(s.xg * 10) / 10 : null,
        rating: s?.rating ? Math.round(s.rating * 100) / 100 : null,
      };
    });
  }

  // Client-side rating sort (needs stats enrichment first)
  if (sort === "rating" && wantStats) {
    players.sort((a, b) => {
      const ra = (a.rating as number) ?? 0;
      const rb = (b.rating as number) ?? 0;
      return rb - ra;
    });
  }

  // Fingerprints now come precomputed from the view (pipeline 51)
  // Return hasMore flag instead of total count (avoids expensive count query on view)
  return NextResponse.json(
    { players, hasMore: players.length === limit },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } },
  );
}
