import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS } from "@/lib/types";
import type { PlayerCard as PlayerCardType } from "@/lib/types";
import { getFeatureFlags } from "@/lib/features";
import { FeaturedPlayer } from "@/components/FeaturedPlayer";
import { TrendingPlayers } from "@/components/TrendingPlayers";
import { PositionExplorer } from "@/components/PositionExplorer";
import { PursuitPanel } from "@/components/PursuitPanel";

const PIPELINE_STATUSES = ["Priority", "Interested", "Watch"] as const;

async function getUserPreferences(): Promise<Record<string, unknown> | null> {
  if (!supabaseServer) return null;

  try {
    const cookieStore = await cookies();
    // Check for Supabase auth cookie to find user
    const authCookie = cookieStore.getAll().find((c) => c.name.includes("auth-token"));
    if (!authCookie) return null;

    // We can't easily decode the JWT here without the auth client,
    // so we'll rely on a simpler approach: check localStorage preference
    // passed via cookie or default to consumer mode
    return null;
  } catch {
    return null;
  }
}

async function getDashboardData(shortlistsEnabled: boolean) {
  if (!supabaseServer) return null;

  // Consumer queries: featured player, personality type counts, trending players, position counts, news
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: PromiseLike<any>[] = [
    // Featured player: random full-profile player
    supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, position, club, nation, level, overall, archetype, personality_type, market_value_tier, dob")
      .eq("profile_tier", 1)
      .not("personality_type", "is", null)
      .not("archetype", "is", null)
      .limit(20),
    // Position counts (all profiled players)
    supabaseServer
      .from("player_intelligence_card")
      .select("position")
      .not("position", "is", null),
    // Recent news
    supabaseServer
      .from("news_stories")
      .select("id, title, url, published_at, summary")
      .order("published_at", { ascending: false })
      .limit(5),
    // Trending players: most mentioned in recent news
    supabaseServer
      .from("news_player_tags")
      .select("person_id, people!inner(name), count")
      .order("created_at", { ascending: false })
      .limit(50),
  ];

  // Pro queries: only if shortlists enabled
  if (shortlistsEnabled) {
    queries.push(
      // Pipeline players
      supabaseServer
        .from("player_intelligence_card")
        .select("person_id, name, position, club, level, archetype, pursuit_status, profile_tier, personality_type")
        .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"])
        .order("level", { ascending: false }),
      // Quick stats
      supabaseServer.from("people").select("id", { count: "exact", head: true }),
      supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).not("archetype", "is", null).eq("profile_tier", 1),
    );
  }

  const results = await Promise.all(queries);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [featuredResult, positionResult, newsResult, trendingResult] = results as any[];

  // Pick a random featured player from the top-rated ones
  const featuredCandidates = (featuredResult.data ?? []) as Array<{
    person_id: number; name: string; position: string | null; club: string | null;
    nation: string | null; level: number | null; overall: number | null;
    archetype: string | null; personality_type: string | null;
    market_value_tier: string | null; dob: string | null;
  }>;
  const featured = featuredCandidates.length > 0
    ? featuredCandidates[Math.floor(Math.random() * featuredCandidates.length)]
    : null;

  // Count positions
  const positionRows = (positionResult.data ?? []) as { position: string }[];
  const positionCounts: Record<string, number> = {};
  for (const pos of POSITIONS) {
    positionCounts[pos] = positionRows.filter((r) => r.position === pos).length;
  }

  // News
  const news = (newsResult.data ?? []) as { id: number; title: string; url: string | null; published_at: string | null; summary: string | null }[];

  // Trending: aggregate person mentions from news tags
  const trendingRaw = (trendingResult.data ?? []) as Array<{ person_id: number; people: { name: string } }>;
  const trendingMap = new Map<number, { person_id: number; name: string; count: number }>();
  for (const row of trendingRaw) {
    const existing = trendingMap.get(row.person_id);
    if (existing) {
      existing.count++;
    } else {
      trendingMap.set(row.person_id, {
        person_id: row.person_id,
        name: row.people?.name ?? "Unknown",
        count: 1,
      });
    }
  }
  const trendingPlayerIds = Array.from(trendingMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Enrich trending with profile data
  let trendingPlayers: Array<{
    person_id: number; name: string; position: string | null;
    club: string | null; personality_type: string | null;
    archetype: string | null; level: number | null; story_count: number;
  }> = [];

  if (trendingPlayerIds.length > 0) {
    const { data: enriched } = await supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, position, club, personality_type, archetype, level")
      .in("person_id", trendingPlayerIds.map((t) => t.person_id));

    const enrichedMap = new Map((enriched ?? []).map((e: Record<string, unknown>) => [e.person_id as number, e]));
    trendingPlayers = trendingPlayerIds
      .map((t) => {
        const e = enrichedMap.get(t.person_id) as Record<string, unknown> | undefined;
        return {
          person_id: t.person_id,
          name: (e?.name as string) ?? t.name,
          position: (e?.position as string | null) ?? null,
          club: (e?.club as string | null) ?? null,
          personality_type: (e?.personality_type as string | null) ?? null,
          archetype: (e?.archetype as string | null) ?? null,
          level: (e?.level as number | null) ?? null,
          story_count: t.count,
        };
      })
      .filter((t) => t.name !== "Unknown");
  }

  // Pro data
  let proData = null;
  if (shortlistsEnabled) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pipelineResult, totalResult, fullProfilesResult] = results.slice(4) as any[];
    const pipelinePlayers = (pipelineResult.data ?? []) as PlayerCardType[];

    const pipeline: Record<string, PlayerCardType[]> = {};
    for (const status of PIPELINE_STATUSES) {
      pipeline[status] = pipelinePlayers.filter((p) => p.pursuit_status === status);
    }

    const pipelinePositionCounts: Record<string, number> = {};
    for (const pos of POSITIONS) {
      pipelinePositionCounts[pos] = pipelinePlayers.filter((p) => p.position === pos).length;
    }

    proData = {
      pipeline,
      positionCounts: pipelinePositionCounts,
      stats: {
        total: totalResult.count ?? 0,
        fullProfiles: fullProfilesResult.count ?? 0,
        priority: pipeline["Priority"]?.length ?? 0,
        tracked: pipelinePlayers.length,
      },
    };
  }

  return {
    featured,
    positionCounts,
    news,
    trendingPlayers,
    proData,
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const preferences = await getUserPreferences();
  const flags = getFeatureFlags(preferences);
  const data = await getDashboardData(flags.shortlists);

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-4">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  const { featured, positionCounts, news, trendingPlayers, proData } = data;

  return (
    <div>
      {/* Hero: Featured Player + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Featured Player — 2 cols */}
        <div className="lg:col-span-2">
          {featured ? (
            <FeaturedPlayer player={{ ...featured, blueprint: null }} />
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
              <p className="text-sm text-[var(--text-muted)]">No featured players yet.</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <Link
            href="/choices"
            className="block bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-5 hover:bg-[var(--bg-elevated)]/50 transition-colors group"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent-personality)] mb-1">
              Football Choices
            </p>
            <p className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              Build your footballing identity by picking between legends and stars
            </p>
          </Link>
          <Link
            href="/players"
            className="block bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-5 hover:bg-[var(--bg-elevated)]/50 transition-colors group"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent-tactical)] mb-1">
              Player Database
            </p>
            <p className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              Search and filter {positionCounts ? Object.values(positionCounts).reduce((a, b) => a + b, 0).toLocaleString() : "all"} profiled players
            </p>
          </Link>
          <Link
            href="/formations"
            className="block bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-5 hover:bg-[var(--bg-elevated)]/50 transition-colors group"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent-mental)] mb-1">
              Formations
            </p>
            <p className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              Explore 33+ tactical formations and their player requirements
            </p>
          </Link>
        </div>
      </div>

      {/* Row 2: Recent News */}
      {news.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Recent News
            </h2>
            <Link href="/news" className="text-xs text-[var(--accent-personality)] hover:underline">
              All news &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {news.map((story) => (
              <div key={story.id} className="flex items-start gap-3">
                <span className="text-xs text-[var(--text-muted)] w-14 shrink-0 pt-0.5">
                  {formatDate(story.published_at)}
                </span>
                <div className="min-w-0">
                  {story.url ? (
                    <a
                      href={story.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--text-primary)] hover:text-[var(--accent-personality)] transition-colors truncate block"
                    >
                      {story.title}
                    </a>
                  ) : (
                    <p className="text-sm text-[var(--text-primary)] truncate">{story.title}</p>
                  )}
                  {story.summary && (
                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{story.summary}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: Trending Players + Position Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <TrendingPlayers players={trendingPlayers} />
        </div>
        <div>
          <PositionExplorer positionCounts={positionCounts} />
        </div>
      </div>

      {/* Pro: Pursuit Pipeline — only when shortlists enabled */}
      {proData && (
        <PursuitPanel
          pipeline={proData.pipeline}
          positionCounts={proData.positionCounts}
          stats={proData.stats}
        />
      )}
    </div>
  );
}
