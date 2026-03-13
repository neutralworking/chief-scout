import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

const TOP_5 = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];

interface LeagueRow {
  name: string;
  clubCount: number;
  playerCount: number;
}

export default async function LeaguesPage() {
  if (!supabaseServer) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Leagues</h1>
        <p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  // Fetch all clubs with league_name set
  const clubs: any[] = [];
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("clubs")
        .select("id, league_name")
        .not("league_name", "is", null)
        .order("league_name")
        .range(from, from + PAGE - 1);
      clubs.push(...(page ?? []));
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  // Get player counts per club
  const clubCounts = new Map<number, number>();
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("people")
        .select("club_id")
        .not("club_id", "is", null)
        .range(from, from + PAGE - 1);
      for (const p of page ?? []) {
        clubCounts.set(p.club_id, (clubCounts.get(p.club_id) ?? 0) + 1);
      }
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  // Group by league_name
  const leagueMap = new Map<string, { clubCount: number; playerCount: number }>();
  for (const club of clubs) {
    const name = club.league_name as string;
    const existing = leagueMap.get(name) ?? { clubCount: 0, playerCount: 0 };
    existing.clubCount++;
    existing.playerCount += clubCounts.get(club.id) ?? 0;
    leagueMap.set(name, existing);
  }

  const allLeagues: LeagueRow[] = Array.from(leagueMap.entries()).map(([name, data]) => ({
    name,
    ...data,
  }));

  // Separate top 5 and rest
  const top5Leagues = TOP_5
    .map((name) => allLeagues.find((l) => l.name === name))
    .filter(Boolean) as LeagueRow[];

  const otherLeagues = allLeagues
    .filter((l) => !TOP_5.includes(l.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalPlayers = allLeagues.reduce((sum, l) => sum + l.playerCount, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Leagues</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">
        {allLeagues.length} leagues &middot; {totalPlayers.toLocaleString()} players tracked
      </p>

      {/* Top 5 */}
      {top5Leagues.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--color-accent-personality)] mb-3">
            Top 5 Leagues
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {top5Leagues.map((league) => (
              <Link
                key={league.name}
                href={`/clubs?league=${encodeURIComponent(league.name)}`}
                className="glass rounded-xl p-5 hover:border-[var(--color-accent-personality)]/40 transition-colors group"
              >
                <p className="text-base font-semibold text-[var(--text-primary)] group-hover:text-white">
                  {league.name}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {league.clubCount} clubs &middot; {league.playerCount} players
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All leagues A-Z */}
      <div>
        <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
          All Leagues
        </h2>
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-2.5 px-4 font-medium">League</th>
                <th className="text-right py-2.5 px-4 font-medium w-20">Clubs</th>
                <th className="text-right py-2.5 px-4 font-medium w-20">Players</th>
              </tr>
            </thead>
            <tbody>
              {otherLeagues.map((league) => (
                <tr
                  key={league.name}
                  className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors"
                >
                  <td className="py-2 px-4">
                    <Link
                      href={`/clubs?league=${encodeURIComponent(league.name)}`}
                      className="text-[var(--text-primary)] hover:text-white transition-colors"
                    >
                      {league.name}
                    </Link>
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-[var(--text-muted)]">
                    {league.clubCount}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-[var(--text-muted)]">
                    {league.playerCount || "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
