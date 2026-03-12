import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

// Top 5 leagues + key scouting leagues, ordered by priority
const LEAGUE_TIERS: { tier: string; nations: string[]; sortAlpha: boolean }[] = [
  {
    tier: "Top 5 Leagues",
    nations: ["England", "Spain", "Germany", "Italy", "France"],
    sortAlpha: false, // fixed order
  },
  {
    tier: "Key Scouting Leagues",
    nations: [
      "Austria",
      "Belgium",
      "Croatia",
      "Czech Republic",
      "Denmark",
      "Greece",
      "Netherlands",
      "Norway",
      "Portugal",
      "Scotland",
      "Serbia",
      "Sweden",
      "Switzerland",
      "Turkey",
    ],
    sortAlpha: true,
  },
];

const TIER_NATIONS = new Set(LEAGUE_TIERS.flatMap((t) => t.nations));

interface LeagueGroup {
  nation: string;
  clubs: { id: number; name: string; leagueName: string | null; playerCount: number }[];
  totalPlayers: number;
  avgOverall: number | null;
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

  // Fetch ALL clubs (paginate past PostgREST 1000-row cap)
  const clubs: any[] = [];
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("clubs")
        .select("id, clubname, league_name, nation_id, nations(name)")
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

  // Fetch player_profiles.overall joined with people.club_id (paginated)
  // We need: person_id -> overall, person_id -> club_id
  const clubOveralls = new Map<number, number[]>(); // club_id -> list of overall scores
  {
    const PAGE = 1000;
    let from = 0;
    let more = true;
    while (more) {
      const { data: page } = await supabaseServer
        .from("player_profiles")
        .select("overall, people!inner(club_id)")
        .not("overall", "is", null)
        .range(from, from + PAGE - 1);
      for (const row of page ?? []) {
        const clubId = (row as any).people?.club_id;
        if (clubId != null) {
          if (!clubOveralls.has(clubId)) clubOveralls.set(clubId, []);
          clubOveralls.get(clubId)!.push((row as any).overall);
        }
      }
      more = (page?.length ?? 0) === PAGE;
      from += PAGE;
    }
  }

  // Build a map of club_id -> nation for computing nation-level averages
  const clubNationMap = new Map<number, string>();
  for (const rawClub of clubs ?? []) {
    const club = rawClub as any;
    const nation = club.nations?.name || (club.league_name ? `League: ${club.league_name}` : "Unassigned");
    clubNationMap.set(club.id, nation);
  }

  // Compute nation-level average overall
  const nationOveralls = new Map<string, number[]>();
  for (const [clubId, scores] of clubOveralls) {
    const nation = clubNationMap.get(clubId);
    if (nation) {
      if (!nationOveralls.has(nation)) nationOveralls.set(nation, []);
      nationOveralls.get(nation)!.push(...scores);
    }
  }

  const nationAvgOverall = new Map<string, number>();
  for (const [nation, scores] of nationOveralls) {
    if (scores.length > 0) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      nationAvgOverall.set(nation, Math.round(avg));
    }
  }

  // Group by nation (or league_name as fallback, or "Unassigned")
  const nationMap = new Map<string, { id: number; name: string; leagueName: string | null; playerCount: number }[]>();
  for (const rawClub of clubs ?? []) {
    const club = rawClub as any;
    const nation = club.nations?.name || (club.league_name ? `League: ${club.league_name}` : "Unassigned");
    if (!nationMap.has(nation)) nationMap.set(nation, []);
    nationMap.get(nation)!.push({
      id: club.id,
      name: club.clubname,
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
      avgOverall: nationAvgOverall.get(nation) ?? null,
    };
  };

  // Remaining nations not in any tier — sorted alphabetically by nation name
  const otherNations = [...nationMap.keys()]
    .filter((n) => !TIER_NATIONS.has(n))
    .map((n) => buildGroup(n)!)
    .filter(Boolean)
    .sort((a, b) => a.nation.localeCompare(b.nation));

  const totalClubs = clubs.length;
  let totalPlayers = 0;
  for (const v of clubCounts.values()) totalPlayers += v;

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
        // Sort alphabetically if tier requires it
        const sorted = tier.sortAlpha
          ? [...groups].sort((a, b) => a.nation.localeCompare(b.nation))
          : groups;
        return (
          <div key={tier.tier} className="mb-8">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--accent-personality)] mb-4">
              {tier.tier}
            </h2>
            <div className="space-y-4">
              {sorted.map((league) => (
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
    <div className="glass rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{league.nation}</h3>
          {league.avgOverall != null && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-personality)]/15 text-[var(--accent-personality)]">
              Avg: {league.avgOverall}
            </span>
          )}
        </div>
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
