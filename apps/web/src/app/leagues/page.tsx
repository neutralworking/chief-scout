import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

const TOP_5 = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];
const SECOND_DIVISIONS = ["Championship", "Serie B", "2. Bundesliga", "Segunda División", "Ligue 2"];

const LEAGUE_COUNTRY: Record<string, string> = {
  "Premier League": "England", "La Liga": "Spain", "Serie A": "Italy",
  "Bundesliga": "Germany", "Ligue 1": "France",
  "Championship": "England", "Serie B": "Italy", "2. Bundesliga": "Germany",
  "Segunda División": "Spain", "Ligue 2": "France",
  "Liga Portugal": "Portugal", "Primeira Liga": "Portugal",
  "Eredivisie": "Netherlands", "Scottish Premiership": "Scotland",
  "Süper Lig": "Turkey", "Super Lig": "Turkey",
  "Belgian Pro League": "Belgium", "Jupiler Pro League": "Belgium",
  "Austrian Bundesliga": "Austria", "Swiss Super League": "Switzerland",
  "Danish Superliga": "Denmark", "Greek Super League": "Greece",
  "Croatian HNL": "Croatia", "Serbian Super Liga": "Serbia",
  "Romanian Liga I": "Romania", "Czech Liga": "Czech Republic",
  "Ekstraklasa": "Poland", "Allsvenskan": "Sweden",
  "Eliteserien": "Norway", "Bulgarian First League": "Bulgaria",
  "Major League Soccer": "USA", "MLS": "USA",
  "Liga MX": "Mexico",
  "Campeonato Brasileiro Série A": "Brazil", "Brasileirão Série A": "Brazil",
  "Argentine Primera División": "Argentina", "Argentine Liga Profesional": "Argentina",
  "Colombian Primera A": "Colombia",
  "Saudi Pro League": "Saudi Arabia", "K League 1": "South Korea",
  "Chinese Super League": "China", "A-League": "Australia",
  "League One": "England", "League Two": "England",
  "Women's Super League": "England", "Liga F": "Spain",
  "Frauen Bundesliga": "Germany", "Division 1 Féminine": "France",
};

interface LeagueRow {
  name: string;
  country: string | null;
  clubCount: number;
  playerCount: number;
  avgLevel: number | null;
}

function levelBorderColor(level: number | null): string {
  if (level == null) return "var(--text-muted)";
  if (level >= 80) return "var(--color-accent-technical)";
  if (level >= 75) return "var(--color-accent-mental)";
  if (level >= 70) return "var(--color-accent-physical)";
  return "var(--text-muted)";
}

function levelTextClass(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 80) return "text-[var(--color-accent-technical)]";
  if (level >= 75) return "text-[var(--color-accent-mental)]";
  if (level >= 70) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

export default async function LeaguesPage() {
  if (!supabaseServer) {
    return (
      <div>
        <h1 className="text-lg font-bold mb-4">Leagues</h1>
        <p className="text-xs text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  const { data: statsData } = await supabaseServer.rpc("get_league_stats");

  const allLeagues: LeagueRow[] = ((statsData ?? []) as Record<string, unknown>[])
    .filter((s) => Number(s.player_count) > 0)
    .map((s) => ({
      name: s.league_name as string,
      country: LEAGUE_COUNTRY[s.league_name as string] ?? null,
      clubCount: Number(s.club_count),
      playerCount: Number(s.player_count),
      avgLevel: s.avg_level != null ? Number(s.avg_level) : null,
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
  const maxPlayers = Math.max(...allLeagues.map(l => l.playerCount), 1);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold tracking-tight">Leagues</h1>
        <Link href="/clubs" className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          All clubs &rarr;
        </Link>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mb-4 font-data">
        {allLeagues.length} leagues &middot; {totalPlayers.toLocaleString()} players
      </p>

      {/* Top 5 */}
      {top5.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 bg-[var(--color-accent-technical)] shadow-[0_0_6px_var(--color-accent-technical)]" />
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-[var(--color-accent-technical)]">Top 5</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 sm:gap-1">
            {top5.map((league) => (
              <LeagueCard key={league.name} league={league} maxPlayers={maxPlayers} featured />
            ))}
          </div>
        </section>
      )}

      {/* Second Divisions */}
      {secondDiv.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1 h-1 bg-[var(--text-muted)]" />
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-[var(--text-muted)]">Second Divisions</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 sm:gap-1">
            {secondDiv.map((league) => (
              <LeagueCard key={league.name} league={league} maxPlayers={maxPlayers} />
            ))}
          </div>
        </section>
      )}

      {/* Other */}
      {otherLeagues.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1 h-1 bg-[var(--text-muted)]" />
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-[var(--text-muted)]">Other Leagues</span>
            <span className="text-[8px] font-data text-[var(--text-muted)]">({otherLeagues.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 sm:gap-1">
            {otherLeagues.map((league) => (
              <LeagueCard key={league.name} league={league} maxPlayers={maxPlayers} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LeagueCard({ league, maxPlayers, featured = false }: { league: LeagueRow; maxPlayers: number; featured?: boolean }) {
  const barWidth = maxPlayers > 0 ? (league.playerCount / maxPlayers) * 100 : 0;
  const borderColor = featured ? levelBorderColor(league.avgLevel) : "var(--border-subtle)";

  return (
    <Link
      href={`/clubs?league=${encodeURIComponent(league.name)}`}
      className="bg-[var(--bg-surface)] p-3 hover:bg-[rgba(111,195,223,0.04)] transition-colors group block"
      style={{
        borderLeft: `2px solid ${borderColor}`,
        borderBottom: "1px solid var(--border-subtle)",
        borderRight: "1px solid var(--border-subtle)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--border-bright)] truncate transition-colors">
            {league.name}
          </p>
          {league.country && (
            <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{league.country}</p>
          )}
        </div>
        {league.avgLevel != null && (
          <span className={`text-sm font-data font-bold shrink-0 ml-2 ${levelTextClass(league.avgLevel)}`}>
            {league.avgLevel.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-1.5 text-[9px] text-[var(--text-muted)]">
        <span className="font-data">{league.clubCount}</span> clubs
        <span>&middot;</span>
        <span className="font-data">{league.playerCount}</span> players
      </div>

      {/* Player count bar */}
      <div className="h-[2px] bg-[var(--bg-elevated)] mt-2 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${barWidth}%`,
            background: borderColor,
            opacity: 0.5,
          }}
        />
      </div>
    </Link>
  );
}
