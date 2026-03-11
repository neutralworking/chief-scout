import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS, POSITION_COLORS } from "@/lib/types";
import type { PlayerCard as PlayerCardType } from "@/lib/types";
import { AdminActions } from "@/components/AdminActions";

async function getAdminData() {
  if (!supabaseServer) return null;

  const [
    totalPeopleResult,
    tier1Result,
    fullProfilesResult,
    fbrefLinkedResult,
    trackedResult,
    // Coverage
    profilesResult,
    personalityResult,
    marketResult,
    statusResult,
    attributesResult,
    wikidataResult,
    newsStoriesResult,
    newsTagsResult,
    // External Data Sources
    sbCompResult,
    sbMatchResult,
    sbEventResult,
    usMatchResult,
    usStatsResult,
    fbrefPlayersResult,
    fbrefStatsResult,
    fbrefLinksResult,
    // Club coverage
    clubsTotalResult,
    clubsWithNationResult,
    clubsWithLeagueResult,
    clubsWithWikidataResult,
    clubsWithStadiumResult,
  ] = await Promise.all([
    // Quick Stats
    supabaseServer.from("people").select("id", { count: "exact", head: true }),
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).eq("profile_tier", 1),
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).not("archetype", "is", null).eq("profile_tier", 1),
    supabaseServer.from("player_id_links").select("id", { count: "exact", head: true }).eq("source", "fbref"),
    supabaseServer
      .from("player_intelligence_card")
      .select("person_id, position")
      .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"]),
    // Coverage — how many people have each table populated
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_personality").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_market").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_status").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("attribute_grades").select("player_id", { count: "exact", head: true }),
    supabaseServer.from("people").select("id", { count: "exact", head: true }).not("wikidata_id", "is", null),
    supabaseServer.from("news_stories").select("id", { count: "exact", head: true }),
    supabaseServer.from("news_player_tags").select("id", { count: "exact", head: true }),
    // External Data Sources — StatsBomb
    supabaseServer.from("sb_competitions").select("id", { count: "exact", head: true }),
    supabaseServer.from("sb_matches").select("id", { count: "exact", head: true }),
    supabaseServer.from("sb_events").select("id", { count: "exact", head: true }),
    // External Data Sources — Understat
    supabaseServer.from("understat_matches").select("id", { count: "exact", head: true }),
    supabaseServer.from("understat_player_match_stats").select("id", { count: "exact", head: true }),
    // External Data Sources — FBRef
    supabaseServer.from("fbref_players").select("id", { count: "exact", head: true }),
    supabaseServer.from("fbref_player_season_stats").select("id", { count: "exact", head: true }),
    supabaseServer.from("player_id_links").select("id", { count: "exact", head: true }).eq("source", "fbref"),
    // Club coverage
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("nation_id", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("league_name", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("wikidata_id", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("stadium", "is", null),
  ]);

  const trackedPlayers = (trackedResult.data ?? []) as Pick<PlayerCardType, "person_id" | "position">[];

  // Position depth from tracked players
  const positionCounts: Record<string, number> = {};
  for (const pos of POSITIONS) {
    positionCounts[pos] = trackedPlayers.filter((p) => p.position === pos).length;
  }

  const totalPlayers = totalPeopleResult.count ?? 0;

  return {
    stats: {
      totalPlayers,
      tier1Profiles: tier1Result.count ?? 0,
      fullProfiles: fullProfilesResult.count ?? 0,
      fbrefLinked: fbrefLinkedResult.count ?? 0,
      tracked: trackedPlayers.length,
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
      statsbomb: {
        competitions: sbCompResult.count ?? 0,
        matches: sbMatchResult.count ?? 0,
        events: sbEventResult.count ?? 0,
      },
      understat: {
        matches: usMatchResult.count ?? 0,
        playerStats: usStatsResult.count ?? 0,
      },
      fbref: {
        players: fbrefPlayersResult.count ?? 0,
        seasonStats: fbrefStatsResult.count ?? 0,
        links: fbrefLinksResult.count ?? 0,
      },
    },
    positionCounts,
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

export default async function AdminPage() {
  const data = await getAdminData();

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Admin</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Pipeline & Data Health</p>
        <p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  const { stats, coverage, external, positionCounts, clubs } = data;
  const maxDepth = Math.max(...Object.values(positionCounts), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Admin</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Pipeline & Data Health</p>

      {/* Admin Actions — Client Component */}
      <div className="mb-6">
        <AdminActions />
      </div>

      {/* Quick Stats */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
          Quick Stats
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {[
            { label: "Total Players", value: stats.totalPlayers },
            { label: "Tier 1 Profiles", value: stats.tier1Profiles },
            { label: "Full Profiles", value: stats.fullProfiles },
            { label: "FBRef Linked", value: stats.fbrefLinked },
            { label: "Tracked", value: stats.tracked },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
              <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Coverage */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
          Data Coverage
        </h2>
        <div className="space-y-3">
          {[
            { label: "Profiles", value: coverage.profiles },
            { label: "Personality", value: coverage.personality },
            { label: "Market Data", value: coverage.market },
            { label: "Status", value: coverage.status },
            { label: "Wikidata Enriched", value: coverage.wikidata },
          ].map(({ label, value }) => {
            const pct = coverage.total > 0 ? Math.round((value / coverage.total) * 100) : 0;
            return (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <span className="font-mono text-[var(--text-primary)]">{value.toLocaleString()} / {coverage.total.toLocaleString()} ({pct}%)</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 80 ? "var(--accent-tactical)" : pct >= 40 ? "var(--accent-physical, #f59e0b)" : "var(--sentiment-negative, #ef4444)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-1">Attribute Grades (rows)</p>
            <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{coverage.attributes.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-1">News Stories</p>
            <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{coverage.newsStories.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* External Data Sources */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
          External Data Sources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* StatsBomb */}
          <div className="border-l-4 border-blue-500 pl-4">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">StatsBomb</p>
            <div className="space-y-2">
              {[
                { label: "Competitions", value: external.statsbomb.competitions },
                { label: "Matches", value: external.statsbomb.matches },
                { label: "Events", value: external.statsbomb.events },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{fmt(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Understat */}
          <div className="border-l-4 border-green-500 pl-4">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Understat</p>
            <div className="space-y-2">
              {[
                { label: "Matches", value: external.understat.matches },
                { label: "Player Match Stats", value: external.understat.playerStats },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{fmt(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FBRef */}
          <div className="border-l-4 border-amber-500 pl-4">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">FBRef</p>
            <div className="space-y-2">
              {[
                { label: "Players", value: external.fbref.players },
                { label: "Season Stats", value: external.fbref.seasonStats },
                { label: "Linked to People", value: external.fbref.links },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{fmt(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Club Coverage */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
          Club Coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-5">
          {[
            { label: "Total Clubs", value: clubs.total },
            { label: "With Nation", value: clubs.withNation },
            { label: "With League", value: clubs.withLeague },
            { label: "Wikidata Enriched", value: clubs.withWikidata },
            { label: "With Stadium", value: clubs.withStadium },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
              <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[
            { label: "Nation Linked", value: clubs.withNation, total: clubs.total },
            { label: "League Assigned", value: clubs.withLeague, total: clubs.total },
            { label: "Wikidata Enriched", value: clubs.withWikidata, total: clubs.total },
            { label: "Stadium Data", value: clubs.withStadium, total: clubs.total },
          ].map(({ label, value, total }) => {
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <span className="font-mono text-[var(--text-primary)]">{value.toLocaleString()} / {total.toLocaleString()} ({pct}%)</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 80 ? "var(--accent-tactical)" : pct >= 40 ? "var(--accent-physical, #f59e0b)" : "var(--sentiment-negative, #ef4444)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Position Depth */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
          Position Depth
        </h2>
        <div className="space-y-2.5">
          {POSITIONS.map((pos) => {
            const count = positionCounts[pos] ?? 0;
            const pct = (count / maxDepth) * 100;
            const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
            const isWeak = count < 2;
            return (
              <div
                key={pos}
                className="flex items-center gap-3 -mx-2 px-2 py-0.5 rounded"
              >
                <span className={`text-[10px] font-bold tracking-wider w-7 text-center px-1 py-0.5 rounded ${posColor} text-white`}>
                  {pos}
                </span>
                <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isWeak ? "bg-[var(--sentiment-negative)]/70" : "bg-[var(--text-primary)]/40"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-sm font-mono w-8 text-right ${isWeak ? "text-[var(--sentiment-negative)]" : "text-[var(--text-secondary)]"}`}>
                  {count}
                </span>
                {isWeak && (
                  <span className="text-[10px] font-medium text-[var(--sentiment-negative)]">gap</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
