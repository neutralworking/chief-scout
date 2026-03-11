import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

interface LeagueGroup {
  nation: string;
  clubs: { id: number; clubname: string; playerCount: number }[];
  totalPlayers: number;
}

export default async function LeaguesPage() {
  if (!supabaseServer) {
    return <div><h1 className="text-2xl font-bold mb-4">Leagues</h1><p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p></div>;
  }

  // Get all people with club_id
  const { data: people } = await supabaseServer
    .from("people")
    .select("club_id")
    .not("club_id", "is", null);

  const clubCounts = new Map<number, number>();
  for (const p of people ?? []) {
    clubCounts.set(p.club_id, (clubCounts.get(p.club_id) ?? 0) + 1);
  }

  // Get clubs with nation info
  const clubIds = [...clubCounts.keys()];
  const { data: clubs } = await supabaseServer
    .from("clubs")
    .select("id, clubname, Nation")
    .in("id", clubIds.slice(0, 1000));

  // Group by nation
  const nationMap = new Map<string, { id: number; clubname: string; playerCount: number }[]>();
  for (const club of clubs ?? []) {
    const nation = club.Nation || "Unknown";
    if (!nationMap.has(nation)) nationMap.set(nation, []);
    nationMap.get(nation)!.push({
      id: club.id,
      clubname: club.clubname,
      playerCount: clubCounts.get(club.id) ?? 0,
    });
  }

  const leagues: LeagueGroup[] = [...nationMap.entries()]
    .map(([nation, clubs]) => ({
      nation,
      clubs: clubs.sort((a, b) => b.playerCount - a.playerCount),
      totalPlayers: clubs.reduce((sum, c) => sum + c.playerCount, 0),
    }))
    .sort((a, b) => b.totalPlayers - a.totalPlayers);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Leagues</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">
        {leagues.length} nations · {(people ?? []).length.toLocaleString()} players across {(clubs ?? []).length} clubs
      </p>

      <div className="space-y-6">
        {leagues.map((league) => (
          <div key={league.nation} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{league.nation}</h2>
              <span className="text-xs font-mono text-[var(--text-muted)]">{league.totalPlayers} players · {league.clubs.length} clubs</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {league.clubs.slice(0, 20).map((club) => (
                <Link
                  key={club.id}
                  href={`/clubs/${club.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <span className="text-xs text-[var(--text-secondary)] truncate">{club.clubname}</span>
                  <span className="text-xs font-mono text-[var(--text-muted)] ml-2 shrink-0">{club.playerCount}</span>
                </Link>
              ))}
              {league.clubs.length > 20 && (
                <span className="text-xs text-[var(--text-muted)] px-3 py-2">+{league.clubs.length - 20} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
