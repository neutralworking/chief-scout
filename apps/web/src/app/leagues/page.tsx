import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

const TOP_5 = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];
const SECOND_DIVISIONS = ["Championship", "Serie B", "2. Bundesliga", "Segunda División", "Ligue 2"];

const LEAGUE_COUNTRY: Record<string, string> = {
  // Top 5
  "Premier League": "England",
  "La Liga": "Spain",
  "Serie A": "Italy",
  "Bundesliga": "Germany",
  "Ligue 1": "France",
  // Second divisions
  "Championship": "England",
  "Serie B": "Italy",
  "2. Bundesliga": "Germany",
  "Segunda División": "Spain",
  "Ligue 2": "France",
  // Europe tier 2
  "Liga Portugal": "Portugal",
  "Primeira Liga": "Portugal",
  "Eredivisie": "Netherlands",
  "Scottish Premiership": "Scotland",
  "Süper Lig": "Turkey",
  "Super Lig": "Turkey",
  "Belgian Pro League": "Belgium",
  "Jupiler Pro League": "Belgium",
  "Austrian Bundesliga": "Austria",
  "Swiss Super League": "Switzerland",
  "Danish Superliga": "Denmark",
  "Greek Super League": "Greece",
  // Europe tier 3
  "Croatian HNL": "Croatia",
  "Serbian Super Liga": "Serbia",
  "Romanian Liga I": "Romania",
  "Czech Liga": "Czech Republic",
  "Ekstraklasa": "Poland",
  "Allsvenskan": "Sweden",
  "Eliteserien": "Norway",
  "Bulgarian First League": "Bulgaria",
  // Americas
  "Major League Soccer": "USA",
  "MLS": "USA",
  "Liga MX": "Mexico",
  "Campeonato Brasileiro Série A": "Brazil",
  "Brasileirão Série A": "Brazil",
  "Argentine Primera División": "Argentina",
  "Argentine Liga Profesional": "Argentina",
  "Colombian Primera A": "Colombia",
  // Asia / Middle East / Oceania
  "Saudi Pro League": "Saudi Arabia",
  "K League 1": "South Korea",
  "Chinese Super League": "China",
  "A-League": "Australia",
  // England lower
  "League One": "England",
  "League Two": "England",
  // Women's
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
  avgLevel: number | null;
}

export default async function LeaguesPage() {
  if (!supabaseServer) {
    return (
      <div>
        <h1 className="text-lg font-bold mb-4">Leagues</h1>
        <p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  // Single RPC call
  const { data: statsData } = await supabaseServer.rpc("get_league_stats");

  const allLeagues: LeagueRow[] = ((statsData ?? []) as any[])
    .filter((s: any) => s.player_count > 0)
    .map((s: any) => ({
      name: s.league_name,
      country: LEAGUE_COUNTRY[s.league_name] ?? null,
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

function levelColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 80) return "text-amber-400";
  if (level >= 75) return "text-green-400";
  if (level >= 70) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function LeagueCard({ league }: { league: LeagueRow }) {
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
      <div className="flex items-center justify-between mt-2">
        <div className="text-[10px] text-[var(--text-secondary)]">
          <span className="font-mono">{league.clubCount}</span> clubs &middot; <span className="font-mono">{league.playerCount}</span> players
        </div>
        {league.avgLevel != null && (
          <span className={`text-sm font-mono font-bold ${levelColor(league.avgLevel)}`}>
            {league.avgLevel.toFixed(1)}
          </span>
        )}
      </div>
    </Link>
  );
}
