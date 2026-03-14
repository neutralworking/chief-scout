import { supabaseServer } from "@/lib/supabase-server";
import { AdminActions } from "@/components/AdminActions";

async function getAdminData() {
  if (!supabaseServer) return null;

  const [
    totalPeopleResult,
    tier1Result,
    fullProfilesResult,
    trackedResult,
    profilesResult,
    personalityResult,
    marketResult,
    statusResult,
    attributesResult,
    wikidataResult,
    newsStoriesResult,
    newsTagsResult,
    usMatchResult,
    usStatsResult,
    clubsTotalResult,
    clubsWithNationResult,
    clubsWithLeagueResult,
    clubsWithWikidataResult,
    clubsWithStadiumResult,
    valuationsResult,
  ] = await Promise.all([
    supabaseServer.from("people").select("id", { count: "exact", head: true }),
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).eq("profile_tier", 1),
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).not("archetype", "is", null).eq("profile_tier", 1),
    supabaseServer.from("player_intelligence_card").select("person_id", { count: "exact", head: true })
      .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"]),
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_personality").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_market").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_status").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("attribute_grades").select("player_id", { count: "exact", head: true }),
    supabaseServer.from("people").select("id", { count: "exact", head: true }).not("wikidata_id", "is", null),
    supabaseServer.from("news_stories").select("id", { count: "exact", head: true }),
    supabaseServer.from("news_player_tags").select("id", { count: "exact", head: true }),
    supabaseServer.from("understat_matches").select("id", { count: "exact", head: true }),
    supabaseServer.from("understat_player_match_stats").select("id", { count: "exact", head: true }),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("nation_id", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("league_name", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("wikidata_id", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("stadium", "is", null),
    supabaseServer.from("player_valuations").select("id", { count: "exact", head: true }),
  ]);

  const totalPlayers = totalPeopleResult.count ?? 0;

  return {
    stats: {
      totalPlayers,
      tier1Profiles: tier1Result.count ?? 0,
      fullProfiles: fullProfilesResult.count ?? 0,
      tracked: trackedResult.count ?? 0,
    },
    coverage: {
      total: totalPlayers,
      profiles: profilesResult.count ?? 0,
      personality: personalityResult.count ?? 0,
      market: marketResult.count ?? 0,
      status: statusResult.count ?? 0,
      attributes: attributesResult.count ?? 0,
      wikidata: wikidataResult.count ?? 0,
      newsStories: newsStoriesResult.count ?? 0,
      newsTags: newsTagsResult.count ?? 0,
    },
    external: {
      understat: { matches: usMatchResult.count ?? 0, playerStats: usStatsResult.count ?? 0 },
    },
    valuations: valuationsResult.count ?? 0,
    clubs: {
      total: clubsTotalResult.count ?? 0,
      withNation: clubsWithNationResult.count ?? 0,
      withLeague: clubsWithLeagueResult.count ?? 0,
      withWikidata: clubsWithWikidataResult.count ?? 0,
      withStadium: clubsWithStadiumResult.count ?? 0,
    },
  };
}

function fmt(n: number): string {
  return n === 0 ? "\u2013" : n.toLocaleString();
}

function CoverageBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          backgroundColor: pct >= 80 ? "var(--color-accent-tactical)" : pct >= 40 ? "var(--color-accent-physical)" : "var(--color-sentiment-negative)",
        }} />
    </div>
  );
}

export default async function AdminPage() {
  const data = await getAdminData();

  if (!data) {
    return (
      <div>
        <h1 className="text-lg font-bold tracking-tight mb-1">Admin</h1>
        <p className="text-[11px] text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  const { stats, coverage, external, clubs, valuations } = data;

  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight mb-0.5">Admin</h1>
      <p className="text-[11px] text-[var(--text-secondary)] mb-4">Pipeline, data health & operations</p>

      {/* Admin Actions — login-gated tools */}
      <div className="mb-6">
        <AdminActions />
      </div>

      {/* Quick Stats */}
      <div className="glass rounded-xl p-4 mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Quick Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: "Total Players", value: stats.totalPlayers },
            { label: "Tier 1 Profiles", value: stats.tier1Profiles, tooltip: "Scout-assessed with archetype (tier 1)" },
            { label: "Full Profiles", value: stats.fullProfiles },
            { label: "Tracked", value: stats.tracked },
            { label: "News Stories", value: coverage.newsStories },
            { label: "News Tags", value: coverage.newsTags },
            { label: "Valuations", value: valuations },
          ].map(({ label, value, tooltip }) => (
            <div key={label}>
              <p className="text-[10px] text-[var(--text-secondary)] mb-0.5" title={tooltip}>{label}</p>
              <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Coverage */}
      <div className="glass rounded-xl p-4 mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Data Coverage</h2>
        <div className="space-y-2.5">
          {[
            { label: "Profiles", value: coverage.profiles },
            { label: "Personality", value: coverage.personality },
            { label: "Market Data", value: coverage.market },
            { label: "Status", value: coverage.status },
            { label: "Wikidata", value: coverage.wikidata },
          ].map(({ label, value }) => {
            const pct = coverage.total > 0 ? Math.round((value / coverage.total) * 100) : 0;
            return (
              <div key={label}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <span className="font-mono text-[var(--text-primary)]">{value.toLocaleString()} / {coverage.total.toLocaleString()} ({pct}%)</span>
                </div>
                <CoverageBar value={value} total={coverage.total} />
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">Attribute Grades (rows)</p>
            <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{coverage.attributes.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">News Stories</p>
            <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{coverage.newsStories.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* External Data + Clubs — side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* External Data */}
        <div className="glass rounded-xl p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">External Data</h2>
          <div className="space-y-2">
            {[
              { label: "Understat Matches", value: external.understat.matches },
              { label: "Understat Player Stats", value: external.understat.playerStats },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
                <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{fmt(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Club Coverage */}
        <div className="glass rounded-xl p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Club Coverage</h2>
          <div className="space-y-2">
            {[
              { label: "Nation Linked", value: clubs.withNation, total: clubs.total },
              { label: "League Assigned", value: clubs.withLeague, total: clubs.total },
              { label: "Wikidata", value: clubs.withWikidata, total: clubs.total },
              { label: "Stadium", value: clubs.withStadium, total: clubs.total },
            ].map(({ label, value, total }) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-[var(--text-secondary)]">{label}</span>
                    <span className="font-mono text-[var(--text-primary)]">{pct}%</span>
                  </div>
                  <CoverageBar value={value} total={total} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
