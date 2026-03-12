import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

interface ClubRow {
  id: number;
  name: string;
  nation: string | null;
  league_name: string | null;
  player_count: number;
}

export default async function ClubsPage() {
  if (!supabaseServer) {
    return <div><h1 className="text-2xl font-bold mb-4">Clubs</h1><p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p></div>;
  }

  // Fetch ALL clubs (paginate past PostgREST 1000-row cap)
  const clubs: any[] = [];
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("clubs")
        .select("id, clubname, league_name, nations(name)")
        .order("clubname")
        .range(from, from + PAGE - 1);
      clubs.push(...(page ?? []));
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  // Get player counts per club (paginate past PostgREST 1000-row cap)
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

  const clubRows: ClubRow[] = (clubs ?? []).map((c: any) => ({
    id: c.id,
    name: c.clubname,
    nation: c.nations?.name ?? null,
    league_name: c.league_name ?? null,
    player_count: clubCounts.get(c.id) ?? 0,
  }));

  // Top 5 league patterns — matched via case-insensitive substring includes
  const TOP_5_PATTERNS = [
    "Premier League",
    "La Liga",
    "Bundesliga",
    "Serie A",
    "Ligue 1",
  ];

  function isTop5League(leagueName: string): number {
    const lower = leagueName.toLowerCase();
    return TOP_5_PATTERNS.findIndex((pattern) => lower.includes(pattern.toLowerCase()));
  }

  // Group clubs by league_name
  const leagueMap = new Map<string, ClubRow[]>();
  for (const club of clubRows) {
    const key = club.league_name ?? "Unknown League";
    if (!leagueMap.has(key)) leagueMap.set(key, []);
    leagueMap.get(key)!.push(club);
  }

  // Sort clubs alphabetically within each league
  for (const clubs of leagueMap.values()) {
    clubs.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Sort leagues: Top 5 first (in order), then remaining alphabetically
  const sortedLeagues = Array.from(leagueMap.keys()).sort((a, b) => {
    const aIdx = isTop5League(a);
    const bIdx = isTop5League(b);
    const aIsTop5 = aIdx !== -1;
    const bIsTop5 = bIdx !== -1;
    if (aIsTop5 && bIsTop5) return aIdx - bIdx;
    if (aIsTop5) return -1;
    if (bIsTop5) return 1;
    return a.localeCompare(b);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Clubs</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">{clubRows.length} clubs in database</p>

      <div className="space-y-8">
        {sortedLeagues.map((league) => {
          const leagueClubs = leagueMap.get(league)!;
          const totalPlayers = leagueClubs.reduce((sum, c) => sum + c.player_count, 0);
          return (
            <section key={league}>
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{league}</h2>
                <span className="text-xs text-[var(--text-muted)]">
                  {leagueClubs.length} club{leagueClubs.length !== 1 ? "s" : ""}
                  {totalPlayers > 0 && <> &middot; {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}</>}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {leagueClubs.map((club) => (
                  <Link
                    key={club.id}
                    href={`/clubs/${club.id}`}
                    className="glass rounded-xl p-4 hover:border-[var(--accent-personality)]/40 transition-colors group"
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-white truncate">
                      {club.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {club.nation && (
                        <span className="text-xs text-[var(--text-secondary)]">{club.nation}</span>
                      )}
                      {club.player_count > 0 && (
                        <span className="text-xs font-mono text-[var(--text-muted)]">{club.player_count} players</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
