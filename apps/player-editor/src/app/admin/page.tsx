import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS, POSITION_COLORS } from "@/lib/types";
import type { PlayerCard as PlayerCardType } from "@/lib/types";

async function getAdminData() {
  if (!supabaseServer) return null;

  const [
    totalPeopleResult,
    tier1Result,
    fullProfilesResult,
    fbrefLinkedResult,
    trackedResult,
    sbCompResult,
    sbMatchResult,
    sbEventResult,
    usMatchResult,
    usStatsResult,
    fbrefPlayersResult,
    fbrefStatsResult,
    fbrefLinksResult,
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
  ]);

  const trackedPlayers = (trackedResult.data ?? []) as Pick<PlayerCardType, "person_id" | "position">[];

  // Position depth from tracked players
  const positionCounts: Record<string, number> = {};
  for (const pos of POSITIONS) {
    positionCounts[pos] = trackedPlayers.filter((p) => p.position === pos).length;
  }

  return {
    stats: {
      totalPlayers: totalPeopleResult.count ?? 0,
      tier1Profiles: tier1Result.count ?? 0,
      fullProfiles: fullProfilesResult.count ?? 0,
      fbrefLinked: fbrefLinkedResult.count ?? 0,
      tracked: trackedPlayers.length,
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

  const { stats, external, positionCounts } = data;
  const maxDepth = Math.max(...Object.values(positionCounts), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Admin</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Pipeline & Data Health</p>

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
