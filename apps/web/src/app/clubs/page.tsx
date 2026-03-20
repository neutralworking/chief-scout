import { supabaseServer } from "@/lib/supabase-server";
import { ClubsList } from "@/components/ClubsList";

interface ClubRow {
  id: number;
  name: string;
  league_name: string | null;
  player_count: number;
  avg_level: number | null;
  power_rating: number | null;
  power_confidence: number | null;
}

export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const params = await searchParams;
  const initialLeague = params.league ?? "";
  if (!supabaseServer) {
    return <div><h1 className="text-lg font-bold mb-4">Clubs</h1><p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p></div>;
  }

  // Single RPC call for club stats (replaces 20+ paginated queries)
  const [clubsResult, statsResult] = await Promise.all([
    supabaseServer.from("clubs").select("id, clubname, league_name, power_rating, power_confidence").order("clubname"),
    supabaseServer.rpc("get_club_stats"),
  ]);

  const clubs = clubsResult.data ?? [];
  const statsMap = new Map<number, { player_count: number; avg_level: number | null }>();
  for (const s of (statsResult.data ?? []) as any[]) {
    statsMap.set(s.club_id, {
      player_count: Number(s.player_count),
      avg_level: s.avg_level != null ? Number(s.avg_level) : null,
    });
  }

  const leagueSet = new Set<string>();
  const clubRows: ClubRow[] = [];
  for (const c of clubs) {
    const stats = statsMap.get(c.id);
    if (!stats || stats.player_count === 0) continue;
    const league = c.league_name ?? null;
    if (league?.includes("(duplicate)")) continue;
    if (league) leagueSet.add(league);
    clubRows.push({
      id: c.id,
      name: c.clubname,
      league_name: league,
      player_count: stats.player_count,
      avg_level: stats.avg_level,
      power_rating: c.power_rating != null ? Number(c.power_rating) : null,
      power_confidence: c.power_confidence != null ? Number(c.power_confidence) : null,
    });
  }

  const leagues = Array.from(leagueSet).sort((a, b) => a.localeCompare(b, "en"));

  return <ClubsList clubs={clubRows} leagues={leagues} initialLeague={initialLeague} />;
}
