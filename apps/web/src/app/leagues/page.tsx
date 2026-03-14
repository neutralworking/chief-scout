import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

const TOP_5 = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];
const SECOND_DIVISIONS = ["Championship", "Serie B", "2. Bundesliga", "Segunda División", "Ligue 2"];

const LEAGUE_COUNTRY: Record<string, string> = {
  "Premier League": "England",
  "La Liga": "Spain",
  "Serie A": "Italy",
  "Bundesliga": "Germany",
  "Ligue 1": "France",
  "Championship": "England",
  "Serie B": "Italy",
  "2. Bundesliga": "Germany",
  "Segunda División": "Spain",
  "Ligue 2": "France",
  "Liga Portugal": "Portugal",
  "Eredivisie": "Netherlands",
  "Scottish Premiership": "Scotland",
  "Süper Lig": "Turkey",
  "Belgian Pro League": "Belgium",
  "Austrian Bundesliga": "Austria",
  "Swiss Super League": "Switzerland",
  "Danish Superliga": "Denmark",
  "Ekstraklasa": "Poland",
  "Major League Soccer": "USA",
  "Saudi Pro League": "Saudi Arabia",
  "Liga MX": "Mexico",
  "Campeonato Brasileiro Série A": "Brazil",
  "Argentine Primera División": "Argentina",
  "League One": "England",
  "League Two": "England",
  "Women's Super League": "England",
  "Liga F": "Spain",
  "Frauen Bundesliga": "Germany",
  "Division 1 Féminine": "France",
};

interface LeagueRow {
  name: string;
  country: string | null;
  clubCount: number;
  playerCount: number;
  withLevel: number;
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

  // Fetch clubs with league_name
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

  // Player counts per club (from people table)
  const clubPlayerCount = new Map<number, number>();
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("people")
        .select("club_id")
        .eq("active", true)
        .not("club_id", "is", null)
        .range(from, from + PAGE - 1);
      for (const p of page ?? []) {
        clubPlayerCount.set(p.club_id, (clubPlayerCount.get(p.club_id) ?? 0) + 1);
      }
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  // Level counts per club (from people → player_profiles)
  const clubLevelCount = new Map<number, number>();
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
        const profile = (p as any).player_profiles;
        if (profile?.level != null) {
          clubLevelCount.set(p.club_id, (clubLevelCount.get(p.club_id) ?? 0) + 1);
        }
      }
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  // Group by league
  const leagueMap = new Map<string, { clubCount: number; playerCount: number; withLevel: number }>();
  for (const club of clubs) {
    const name = club.league_name as string;
    // Skip junk leagues
    if (name.includes("(duplicate)")) continue;
    const existing = leagueMap.get(name) ?? { clubCount: 0, playerCount: 0, withLevel: 0 };
    existing.clubCount++;
    existing.playerCount += clubPlayerCount.get(club.id) ?? 0;
    existing.withLevel += clubLevelCount.get(club.id) ?? 0;
    leagueMap.set(name, existing);
  }

  // Build rows, filter to leagues with ≥1 player
  const allLeagues: LeagueRow[] = Array.from(leagueMap.entries())
    .filter(([, data]) => data.playerCount > 0)
    .map(([name, data]) => ({
      name,
      country: LEAGUE_COUNTRY[name] ?? null,
      ...data,
    }));

  const top5 = TOP_5
    .map((n) => allLeagues.find((l) => l.name === n))
    .filter(Boolean) as LeagueRow[];

  const secondDiv = SECOND_DIVISIONS
    .map((n) => allLeagues.find((l) => l.name === n))
    .filter(Boolean) as LeagueRow[];

  const otherLeagues = allLeagues
    .filter((l) => !TOP_5.includes(l.name) && !SECOND_DIVISIONS.includes(l.name))
    .sort((a, b) => b.playerCount - a.playerCount);

  const totalPlayers = allLeagues.reduce((sum, l) => sum + l.playerCount, 0);

  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight mb-0.5">Leagues</h1>
      <p className="text-[11px] text-[var(--text-secondary)] mb-5">
        {allLeagues.length} leagues &middot; {totalPlayers.toLocaleString()} players
      </p>

      {/* Top 5 */}
      {top5.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-personality)] mb-2">
            Top 5 Leagues
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {top5.map((league) => (
              <LeagueCard key={league.name} league={league} />
            ))}
          </div>
        </div>
      )}

      {/* Second Divisions */}
      {secondDiv.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Second Divisions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {secondDiv.map((league) => (
              <LeagueCard key={league.name} league={league} />
            ))}
          </div>
        </div>
      )}

      {/* Other */}
      {otherLeagues.length > 0 && (
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Other Leagues
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {otherLeagues.map((league) => (
              <LeagueCard key={league.name} league={league} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeagueCard({ league }: { league: LeagueRow }) {
  const coveragePct = league.playerCount > 0 ? Math.round((league.withLevel / league.playerCount) * 100) : 0;
  return (
    <Link
      href={`/clubs?league=${encodeURIComponent(league.name)}`}
      className="glass rounded-xl p-3 hover:border-[var(--color-accent-personality)]/40 transition-colors group"
    >
      <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-white truncate">
        {league.name}
      </p>
      {league.country && (
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{league.country}</p>
      )}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-secondary)]">
        <span><span className="font-mono">{league.clubCount}</span> clubs</span>
        <span><span className="font-mono">{league.playerCount}</span> players</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent-tactical)]"
          style={{ width: `${coveragePct}%` }}
        />
      </div>
      <p className="text-[9px] text-[var(--text-muted)] mt-0.5">
        {coveragePct}% with level data
      </p>
    </Link>
  );
}
