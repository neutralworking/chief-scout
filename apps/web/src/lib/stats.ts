import type { SupabaseClient } from "@supabase/supabase-js";

export interface SeasonStats {
  apps: number;
  goals: number;
  assists: number;
  xg: number;
  rating: number | null;
}

/**
 * Fetch season stats for a set of players using cascade:
 * API-Football (primary) → FBRef → Kaggle (fallback)
 *
 * API-Football provides apps/goals/assists/rating for 10 leagues.
 * xG comes from FBRef/Kaggle overlay (API-Football doesn't have xG).
 */
export async function fetchSeasonStats(
  supabase: SupabaseClient,
  personIds: number[],
): Promise<Map<number, SeasonStats>> {
  if (personIds.length === 0) return new Map();

  const statsMap = new Map<number, SeasonStats>();

  // 1. API-Football (primary for apps/goals/assists/rating)
  const { data: afStats } = await supabase
    .from("api_football_player_stats")
    .select("person_id, appearances, goals, assists, rating")
    .in("person_id", personIds)
    .eq("season", "2025");

  for (const row of (afStats ?? []) as Array<Record<string, unknown>>) {
    const pid = row.person_id as number;
    if (!pid) continue;
    const existing = statsMap.get(pid) ?? { apps: 0, goals: 0, assists: 0, xg: 0, rating: null };
    existing.apps += (row.appearances as number) || 0;
    existing.goals += (row.goals as number) || 0;
    existing.assists += (row.assists as number) || 0;
    // Take the best (most recent or highest) rating across leagues
    const rowRating = row.rating as number | null;
    if (rowRating != null && (existing.rating == null || rowRating > existing.rating)) {
      existing.rating = rowRating;
    }
    statsMap.set(pid, existing);
  }

  // 2. FBRef fallback — for players missing from API-Football + xG overlay
  const missingIds = personIds.filter((id) => !statsMap.has(id));
  const needXgIds = personIds; // all players can benefit from xG

  const { data: fbrefLinks } = await supabase
    .from("player_id_links")
    .select("person_id, external_id")
    .eq("source", "fbref")
    .in("person_id", needXgIds);

  const fbrefIds = (fbrefLinks ?? []).map((l) => l.external_id as string).filter(Boolean);
  const pidByFbref = new Map((fbrefLinks ?? []).map((l) => [l.external_id as string, l.person_id as number]));

  if (fbrefIds.length > 0) {
    const { data: fbrefStats } = await supabase
      .from("fbref_player_season_stats")
      .select("fbref_id, matches_played, goals, assists, xg, minutes")
      .in("fbref_id", fbrefIds);

    for (const row of (fbrefStats ?? []) as Array<Record<string, unknown>>) {
      const fbrefId = row.fbref_id as string;
      const pid = pidByFbref.get(fbrefId);
      if (!pid) continue;

      const existing = statsMap.get(pid);
      if (existing) {
        // Player already has API-Football data — just overlay xG
        existing.xg += (row.xg as number) || 0;
      } else {
        // No API-Football data — use FBRef as primary
        const entry: SeasonStats = {
          apps: (row.matches_played as number) || 0,
          goals: (row.goals as number) || 0,
          assists: (row.assists as number) || 0,
          xg: (row.xg as number) || 0,
          rating: null,
        };
        statsMap.set(pid, entry);
      }
    }
  }

  // 3. Kaggle fallback — for remaining gaps
  const stillMissing = personIds.filter((id) => !statsMap.has(id));
  if (stillMissing.length > 0) {
    const [{ data: euroStats }, { data: plStats }] = await Promise.all([
      supabase
        .from("kaggle_euro_league_stats")
        .select("person_id, matches_played, goals, assists, xg, xa")
        .in("person_id", stillMissing),
      supabase
        .from("kaggle_pl_stats")
        .select("person_id, matches_played, goals, assists, xg, xa")
        .in("person_id", stillMissing),
    ]);

    for (const row of [...(euroStats ?? []), ...(plStats ?? [])] as Array<Record<string, unknown>>) {
      const pid = row.person_id as number;
      if (!pid || statsMap.has(pid)) continue;
      const goals = (row.goals as number) || 0;
      const assists = (row.assists as number) || 0;
      if (goals === 0 && assists === 0) continue;
      statsMap.set(pid, {
        apps: (row.matches_played as number) || 0,
        goals,
        assists,
        xg: (row.xg as number) || 0,
        rating: null,
      });
    }
  }

  // Also overlay Kaggle xG for players that have API-Football but no FBRef xG
  const needKaggleXg = personIds.filter((id) => {
    const s = statsMap.get(id);
    return s && s.xg === 0;
  });
  if (needKaggleXg.length > 0) {
    const [{ data: euroXg }, { data: plXg }] = await Promise.all([
      supabase
        .from("kaggle_euro_league_stats")
        .select("person_id, xg")
        .in("person_id", needKaggleXg),
      supabase
        .from("kaggle_pl_stats")
        .select("person_id, xg")
        .in("person_id", needKaggleXg),
    ]);

    for (const row of [...(euroXg ?? []), ...(plXg ?? [])] as Array<Record<string, unknown>>) {
      const pid = row.person_id as number;
      const s = statsMap.get(pid);
      if (s && s.xg === 0 && (row.xg as number)) {
        s.xg = (row.xg as number) || 0;
      }
    }
  }

  return statsMap;
}
