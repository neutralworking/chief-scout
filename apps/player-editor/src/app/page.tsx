import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { POSITION_COLORS, PURSUIT_COLORS, POSITIONS } from "@/lib/types";
import type { PlayerCard as PlayerCardType } from "@/lib/types";

const PIPELINE_STATUSES = ["Priority", "Interested", "Watch"] as const;

async function getDashboardData() {
  if (!supabaseServer) return null;

  const [playersResult, newsResult] = await Promise.all([
    supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, position, club, level, archetype, pursuit_status, profile_tier, personality_type")
      .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"])
      .order("level", { ascending: false }),
    supabaseServer
      .from("news_stories")
      .select("id, title, url, published_at, summary")
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  const players = (playersResult.data ?? []) as PlayerCardType[];
  const news = (newsResult.data ?? []) as { id: number; title: string; url: string | null; published_at: string | null; summary: string | null }[];

  // Group by pursuit status
  const pipeline: Record<string, PlayerCardType[]> = {};
  for (const status of PIPELINE_STATUSES) {
    pipeline[status] = players.filter((p) => p.pursuit_status === status);
  }

  // Position depth
  const positionCounts: Record<string, number> = {};
  for (const pos of POSITIONS) {
    positionCounts[pos] = players.filter((p) => p.position === pos).length;
  }

  // Quick stats
  const totalResult = await supabaseServer
    .from("people")
    .select("id", { count: "exact", head: true });
  const tier1Result = await supabaseServer
    .from("player_profiles")
    .select("person_id", { count: "exact", head: true })
    .eq("profile_tier", 1);
  const fbrefResult = await supabaseServer
    .from("player_id_links")
    .select("person_id", { count: "exact", head: true })
    .eq("source", "fbref");

  return {
    pipeline,
    positionCounts,
    news,
    stats: {
      total: totalResult.count ?? 0,
      tier1: tier1Result.count ?? 0,
      fbref: fbrefResult.count ?? 0,
      priority: pipeline["Priority"]?.length ?? 0,
      tracked: players.length,
    },
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  const { pipeline, positionCounts, news, stats } = data;
  const maxDepth = Math.max(...Object.values(positionCounts), 1);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>

      {/* W1: Pursuit Pipeline */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
        <h2 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
          Pursuit Pipeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PIPELINE_STATUSES.map((status) => {
            const players = pipeline[status] ?? [];
            const pursuitColor = PURSUIT_COLORS[status] ?? "";
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded ${pursuitColor}`}>
                    {status}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{players.length}</span>
                </div>
                <div className="space-y-1.5">
                  {players.slice(0, 5).map((p) => {
                    const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
                    return (
                      <Link
                        key={p.person_id}
                        href={`/players/${p.person_id}`}
                        className="flex items-center gap-2 p-2 rounded hover:bg-[var(--bg-elevated)]/50 transition-colors group"
                      >
                        <span className={`text-[9px] font-bold tracking-wider px-1 py-0.5 rounded ${posColor} text-white`}>
                          {p.position ?? "–"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-white">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate">
                            {p.club}{p.archetype ? ` · ${p.archetype}` : ""}
                          </div>
                        </div>
                        {p.level != null && (
                          <span className="text-xs font-mono text-[var(--text-secondary)]">{p.level}</span>
                        )}
                      </Link>
                    );
                  })}
                  {players.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] py-2">No players</p>
                  )}
                  {players.length > 5 && (
                    <Link
                      href={`/players?pursuit=${encodeURIComponent(status)}`}
                      className="text-[10px] text-[var(--accent-personality)] hover:underline block pt-1"
                    >
                      View all {players.length} &rarr;
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 2: Position Depth + Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* W2: Position Depth */}
        <div className="md:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <h2 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
            Position Depth
          </h2>
          <div className="space-y-2">
            {POSITIONS.map((pos) => {
              const count = positionCounts[pos] ?? 0;
              const pct = (count / maxDepth) * 100;
              const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
              const isWeak = count < 2;
              return (
                <Link
                  key={pos}
                  href={`/players?position=${pos}`}
                  className="flex items-center gap-3 group hover:bg-[var(--bg-elevated)]/30 -mx-2 px-2 py-0.5 rounded transition-colors"
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
                  <span className={`text-xs font-mono w-8 text-right ${isWeak ? "text-[var(--sentiment-negative)]" : "text-[var(--text-secondary)]"}`}>
                    {count}
                  </span>
                  {isWeak && (
                    <span className="text-[9px] text-[var(--sentiment-negative)]">gap</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* W3: Quick Stats */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <h2 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
            Quick Stats
          </h2>
          <div className="space-y-3">
            {[
              { label: "Total Players", value: stats.total },
              { label: "Tracked", value: stats.tracked },
              { label: "Priority", value: stats.priority },
              { label: "Tier 1 Profiles", value: stats.tier1 },
              { label: "FBRef Linked", value: stats.fbref },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* W4: Recent News */}
      {news.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
              Recent News
            </h2>
            <Link href="/news" className="text-[10px] text-[var(--accent-personality)] hover:underline">
              All news &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {news.map((story) => (
              <div key={story.id} className="flex items-start gap-3">
                <span className="text-[10px] text-[var(--text-muted)] w-12 shrink-0 pt-0.5">
                  {formatDate(story.published_at)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text-primary)] truncate">{story.title}</p>
                  {story.summary && (
                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{story.summary}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
