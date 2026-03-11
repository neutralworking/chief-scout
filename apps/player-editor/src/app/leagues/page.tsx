import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

// Top 5 leagues + key scouting leagues, ordered by priority
const LEAGUE_TIERS: { tier: string; nations: string[] }[] = [
  {
    tier: "Top 5 Leagues",
    nations: ["England", "Spain", "Germany", "Italy", "France"],
  },
  {
    tier: "Key Scouting Leagues",
    nations: [
      "Netherlands",
      "Portugal",
      "Belgium",
      "Turkey",
      "Scotland",
      "Austria",
      "Switzerland",
      "Denmark",
      "Norway",
      "Sweden",
      "Croatia",
      "Serbia",
      "Greece",
      "Czech Republic",
    ],
  },
];

const TIER_NATIONS = new Set(LEAGUE_TIERS.flatMap((t) => t.nations));

interface LeagueGroup {
  nation: string;
  clubs: { id: number; name: string; leagueName: string | null; playerCount: number }[];
  totalPlayers: number;
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

  // Fetch ALL clubs with their nations — don't limit to clubs with players
  const { data: clubs } = await supabaseServer
    .from("clubs")
    .select("id, name, league_name, nation_id, nations(name)")
    .not("nation_id", "is", null)
    .order("name");

  // Also get player counts per club for display
  const { data: people } = await supabaseServer
    .from("people")
    .select("club_id")
    .not("club_id", "is", null);

  const clubCounts = new Map<number, number>();
  for (const p of people ?? []) {
    clubCounts.set(p.club_id, (clubCounts.get(p.club_id) ?? 0) + 1);
  }

  // Group by nation
  const nationMap = new Map<string, { id: number; name: string; leagueName: string | null; playerCount: number }[]>();
  for (const rawClub of clubs ?? []) {
    const club = rawClub as any;
    const nation = club.nations?.name || "Unknown";
    if (!nationMap.has(nation)) nationMap.set(nation, []);
    nationMap.get(nation)!.push({
      id: club.id,
      name: club.name,
      leagueName: club.league_name ?? null,
      playerCount: clubCounts.get(club.id) ?? 0,
    });
  }

  const buildGroup = (nation: string): LeagueGroup | null => {
    const clubs = nationMap.get(nation);
    if (!clubs) return null;
    return {
      nation,
      clubs: clubs.sort((a, b) => b.playerCount - a.playerCount || a.name.localeCompare(b.name)),
      totalPlayers: clubs.reduce((sum, c) => sum + c.playerCount, 0),
    };
  };

  // Remaining nations not in any tier
  const otherNations = [...nationMap.keys()]
    .filter((n) => !TIER_NATIONS.has(n))
    .map((n) => buildGroup(n)!)
    .filter(Boolean)
    .sort((a, b) => b.clubs.length - a.clubs.length || b.totalPlayers - a.totalPlayers);

  const totalClubs = (clubs ?? []).length;
  const totalPlayers = (people ?? []).length;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Leagues</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">
        {nationMap.size} nations · {totalClubs.toLocaleString()} clubs · {totalPlayers.toLocaleString()} players tracked
      </p>

      {/* Tiered leagues */}
      {LEAGUE_TIERS.map((tier) => {
        const groups = tier.nations.map(buildGroup).filter(Boolean) as LeagueGroup[];
        if (groups.length === 0) return null;
        return (
          <div key={tier.tier} className="mb-8">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--accent-personality)] mb-4">
              {tier.tier}
            </h2>
            <div className="space-y-4">
              {groups.map((league) => (
                <LeagueCard key={league.nation} league={league} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Other leagues */}
      {otherNations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
            Other Leagues
          </h2>
          <div className="space-y-4">
            {otherNations.map((league) => (
              <LeagueCard key={league.nation} league={league} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeagueCard({ league }: { league: LeagueGroup }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{league.nation}</h3>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {league.clubs.length} clubs{league.totalPlayers > 0 ? ` · ${league.totalPlayers} players` : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
        {league.clubs.map((club) => (
          <Link
            key={club.id}
            href={`/clubs/${club.id}`}
            className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <span className="text-xs text-[var(--text-secondary)] truncate">{club.name}</span>
            {club.playerCount > 0 && (
              <span className="text-xs font-mono text-[var(--text-muted)] ml-2 shrink-0">
                {club.playerCount}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
