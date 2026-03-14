import { supabaseServer } from "@/lib/supabase-server";
import { ClubsList } from "@/components/ClubsList";

interface ClubRow {
  id: number;
  name: string;
  league_name: string | null;
  player_count: number;
  avg_level: number | null;
}

export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const params = await searchParams;
  const initialLeague = params.league ?? "";
  if (!supabaseServer) {
    return <div><h1 className="text-lg font-bold mb-4">Clubs</h1><p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p></div>;
  }

  // Fetch all clubs
  const clubs: any[] = [];
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("clubs")
        .select("id, clubname, league_name")
        .order("clubname")
        .range(from, from + PAGE - 1);
      clubs.push(...(page ?? []));
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  // Player counts + level sums per club (from people + player_profiles)
  const clubStats = new Map<number, { count: number; levelSum: number; levelCount: number }>();
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("people")
        .select("club_id, player_profiles(level)")
        .eq("active", true)
        .not("club_id", "is", null)
        .range(from, from + PAGE - 1);
      for (const p of page ?? []) {
        const s = clubStats.get(p.club_id) ?? { count: 0, levelSum: 0, levelCount: 0 };
        s.count++;
        const profile = (p as any).player_profiles;
        if (profile?.level != null) {
          s.levelSum += profile.level;
          s.levelCount++;
        }
        clubStats.set(p.club_id, s);
      }
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  // Collect unique leagues
  const leagueSet = new Set<string>();

  // Build rows — only clubs with ≥1 player
  const clubRows: ClubRow[] = [];
  for (const c of clubs) {
    const stats = clubStats.get(c.id);
    if (!stats || stats.count === 0) continue;
    const league = c.league_name ?? null;
    if (league && !league.includes("(duplicate)")) leagueSet.add(league);
    if (league?.includes("(duplicate)")) continue;
    clubRows.push({
      id: c.id,
      name: c.clubname,
      league_name: league,
      player_count: stats.count,
      avg_level: stats.levelCount > 0 ? Math.round((stats.levelSum / stats.levelCount) * 10) / 10 : null,
    });
  }

  const leagues = Array.from(leagueSet).sort((a, b) => a.localeCompare(b));

  return <ClubsList clubs={clubRows} leagues={leagues} initialLeague={initialLeague} />;
}
