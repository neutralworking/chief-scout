import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

interface ClubRow {
  id: number;
  name: string;
  nation: string | null;
  league_name: string | null;
  player_count: number;
  avg_overall: number | null;
}

const TOP_5_LEAGUES = [
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
];

function leagueSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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

  // Get player counts + avg overall per club
  const clubCounts = new Map<number, number>();
  const clubOveralls = new Map<number, number[]>();
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("people")
        .select("club_id, player_profiles(overall)")
        .not("club_id", "is", null)
        .range(from, from + PAGE - 1);
      for (const p of page ?? []) {
        const clubId = p.club_id as number;
        clubCounts.set(clubId, (clubCounts.get(clubId) ?? 0) + 1);
        const profile = p.player_profiles as any;
        const overall = Array.isArray(profile) ? profile[0]?.overall : profile?.overall;
        if (overall != null) {
          if (!clubOveralls.has(clubId)) clubOveralls.set(clubId, []);
          clubOveralls.get(clubId)!.push(overall);
        }
      }
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  const clubRows: ClubRow[] = (clubs ?? []).map((c: any) => {
    const overalls = clubOveralls.get(c.id);
    const avg = overalls && overalls.length > 0
      ? Math.round((overalls.reduce((a: number, b: number) => a + b, 0) / overalls.length) * 10) / 10
      : null;
    return {
      id: c.id,
      name: c.clubname,
      nation: c.nations?.name ?? null,
      league_name: c.league_name ?? null,
      player_count: clubCounts.get(c.id) ?? 0,
      avg_overall: avg,
    };
  });

  // Group clubs by league_name, falling back to nation name
  const leagueMap = new Map<string, ClubRow[]>();
  for (const club of clubRows) {
    const key = club.league_name ?? club.nation ?? "Unknown";
    if (!leagueMap.has(key)) leagueMap.set(key, []);
    leagueMap.get(key)!.push(club);
  }

  // Sort clubs alphabetically within each league
  for (const clubs of leagueMap.values()) {
    clubs.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Sort leagues: Top 5 first (in order), then remaining alphabetically
  const sortedLeagues = Array.from(leagueMap.keys()).sort((a, b) => {
    const aIdx = TOP_5_LEAGUES.findIndex((l) => a.toLowerCase().includes(l.toLowerCase()));
    const bIdx = TOP_5_LEAGUES.findIndex((l) => b.toLowerCase().includes(l.toLowerCase()));
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  // Separate top 5 and rest for nav
  const top5Names = sortedLeagues.filter(
    (l) => TOP_5_LEAGUES.some((t) => l.toLowerCase().includes(t.toLowerCase()))
  );
  const otherNames = sortedLeagues.filter(
    (l) => !TOP_5_LEAGUES.some((t) => l.toLowerCase().includes(t.toLowerCase()))
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Clubs</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-4">{clubRows.length} clubs across {sortedLeagues.length} leagues</p>

      {/* League Navigation */}
      <nav className="glass rounded-xl p-4 mb-6 sticky top-0 z-10">
        {/* Top 5 */}
        <div className="flex flex-wrap gap-2 mb-2">
          {top5Names.map((league) => (
            <a
              key={league}
              href={`#${leagueSlug(league)}`}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-personality)]/20 transition-colors"
            >
              {league}
              <span className="text-xs font-mono text-[var(--text-muted)] ml-1.5">{leagueMap.get(league)!.length}</span>
            </a>
          ))}
        </div>
        {/* Other leagues */}
        <div className="flex flex-wrap gap-1.5">
          {otherNames.map((league) => (
            <a
              key={league}
              href={`#${leagueSlug(league)}`}
              className="px-2 py-0.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              {league}
            </a>
          ))}
        </div>
      </nav>

      {/* League Sections */}
      <div className="space-y-8">
        {sortedLeagues.map((league) => {
          const leagueClubs = leagueMap.get(league)!;
          const totalPlayers = leagueClubs.reduce((sum, c) => sum + c.player_count, 0);
          const isTop5 = TOP_5_LEAGUES.some((t) => league.toLowerCase().includes(t.toLowerCase()));
          return (
            <section key={league} id={leagueSlug(league)} className="scroll-mt-24">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className={`font-semibold text-[var(--text-primary)] ${isTop5 ? "text-lg" : "text-base"}`}>{league}</h2>
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
                      {club.nation && !club.league_name && (
                        <span className="text-xs text-[var(--text-secondary)]">{club.nation}</span>
                      )}
                      {club.player_count > 0 && (
                        <span className="text-xs font-mono text-[var(--text-muted)]">{club.player_count} players</span>
                      )}
                      {club.avg_overall != null && (
                        <span className="text-xs font-mono text-[var(--color-accent-tactical)]">{club.avg_overall} avg</span>
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
