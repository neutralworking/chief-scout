import { supabaseServer } from "@/lib/supabase-server";
import { ClubsList } from "@/components/ClubsList";

interface ClubRow {
  id: number;
  name: string;
  nation: string | null;
  league_name: string | null;
  player_count: number;
}

export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ league?: string; country?: string }> }) {
  const params = await searchParams;
  const initialLeague = params.league ?? "";
  const initialCountry = params.country ?? "";
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

  // Collect unique leagues and countries for filters
  const leagueSet = new Set<string>();
  const countrySet = new Set<string>();

  const clubRows: ClubRow[] = (clubs ?? []).map((c: any) => {
    const league = c.league_name ?? null;
    const nation = c.nations?.name ?? null;
    if (league) leagueSet.add(league);
    if (nation) countrySet.add(nation);
    return {
      id: c.id,
      name: c.clubname,
      nation,
      league_name: league,
      player_count: clubCounts.get(c.id) ?? 0,
    };
  });

  const leagues = Array.from(leagueSet).sort((a, b) => a.localeCompare(b));
  const countries = Array.from(countrySet).sort((a, b) => a.localeCompare(b));

  return <ClubsList clubs={clubRows} leagues={leagues} countries={countries} initialLeague={initialLeague} initialCountry={initialCountry} />;
}
