import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS, POSITION_COLORS } from "@/lib/types";
import type { PlayerCard as PlayerCardType } from "@/lib/types";
import { getFeatureFlags } from "@/lib/features";
import { FeaturedPlayer } from "@/components/FeaturedPlayer";
import { TrendingPlayers } from "@/components/TrendingPlayers";
import { PursuitPanel } from "@/components/PursuitPanel";

const PIPELINE_STATUSES = ["Priority", "Interested", "Watch"] as const;

async function getUserPreferences(): Promise<Record<string, unknown> | null> {
  if (!supabaseServer) return null;
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.getAll().find((c) => c.name.includes("auth-token"));
    if (!authCookie) return null;
    return null;
  } catch {
    return null;
  }
}

interface NewsStoryWithTags {
  id: string;
  headline: string;
  url: string | null;
  published_at: string | null;
  summary: string | null;
  story_type: string | null;
  tags: Array<{ player_id: number; name: string; sentiment: string | null }>;
}

// Deterministic daily rotation
function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

type FeaturedReason = "dof_pick" | "news_trending" | "discovery";

const FEATURED_COLS = "person_id, name, position, club, nation, level, overall, archetype, personality_type, market_value_tier, dob, blueprint" as const;

async function getDashboardData(shortlistsEnabled: boolean) {
  if (!supabaseServer) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: PromiseLike<any>[] = [
    // Featured: DOF picks — pursuit targets with profiles
    supabaseServer
      .from("player_intelligence_card")
      .select(FEATURED_COLS + ", pursuit_status")
      .in("pursuit_status", ["Priority", "Interested"])
      .not("archetype", "is", null)
      .order("level", { ascending: false })
      .limit(20),
    // Featured player: sentiment data for swing-based selection
    supabaseServer
      .from("news_player_tags")
      .select("player_id, sentiment, people!inner(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    // Personality type counts
    supabaseServer
      .from("player_intelligence_card")
      .select("personality_type")
      .not("personality_type", "is", null),
    // Position counts
    supabaseServer
      .from("player_intelligence_card")
      .select("position")
      .not("position", "is", null),
    // Recent news with tags
    supabaseServer
      .from("news_stories")
      .select("id, headline, url, published_at, summary, story_type")
      .order("published_at", { ascending: false })
      .limit(15),
    // Trending players
    supabaseServer
      .from("news_player_tags")
      .select("player_id, people!inner(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ];

  if (shortlistsEnabled) {
    queries.push(
      supabaseServer
        .from("player_intelligence_card")
        .select("person_id, name, position, club, level, archetype, pursuit_status, profile_tier, personality_type")
        .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"])
        .order("level", { ascending: false }),
      supabaseServer.from("people").select("id", { count: "exact", head: true }),
      supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).not("archetype", "is", null).eq("profile_tier", 1),
    );
  }

  const results = await Promise.all(queries);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dofPicksResult, sentimentResult, personalityResult, positionResult, newsResult, trendingResult] = results as any[];

  // --- Featured player: tiered selection ---
  type FeaturedProfile = {
    person_id: number; name: string; position: string | null; club: string | null;
    nation: string | null; level: number | null; overall: number | null;
    archetype: string | null; personality_type: string | null;
    market_value_tier: string | null; dob: string | null; blueprint: string | null;
  };

  let featured: FeaturedProfile | null = null;
  let featuredReason: FeaturedReason = "discovery";
  let featuredPool: FeaturedProfile[] = [];

  // Tier 1: DOF picks — Priority/Interested pursuit targets, daily rotation
  const dofCandidates = (dofPicksResult.data ?? []) as Array<FeaturedProfile & { pursuit_status: string }>;
  const priorityPicks = dofCandidates.filter((p) => p.pursuit_status === "Priority");
  const interestedPicks = dofCandidates.filter((p) => p.pursuit_status === "Interested");
  const dofPool = priorityPicks.length > 0 ? priorityPicks : interestedPicks;
  if (dofPool.length > 0) {
    featured = dofPool[dailySeed() % dofPool.length];
    featuredReason = "dof_pick";
    featuredPool = dofPool;
  }

  // Tier 2: News trending — sentiment swing (controversial/talked-about)
  if (!featured) {
    const sentimentRows = (sentimentResult.data ?? []) as Array<{ player_id: number; sentiment: string | null; people: { name: string } }>;
    const playerSentiments = new Map<number, { positive: number; negative: number; total: number }>();
    for (const row of sentimentRows) {
      const existing = playerSentiments.get(row.player_id) ?? { positive: 0, negative: 0, total: 0 };
      existing.total++;
      if (row.sentiment === "positive") existing.positive++;
      if (row.sentiment === "negative") existing.negative++;
      playerSentiments.set(row.player_id, existing);
    }

    let bestPid: number | null = null;
    let maxSwing = 0;
    for (const [pid, s] of playerSentiments) {
      const swing = Math.min(s.positive, s.negative) * 2 + s.total;
      if (swing > maxSwing && s.total >= 2) { maxSwing = swing; bestPid = pid; }
    }
    if (!bestPid) {
      let maxTotal = 0;
      for (const [pid, s] of playerSentiments) {
        if (s.total > maxTotal) { maxTotal = s.total; bestPid = pid; }
      }
    }

    if (bestPid) {
      const { data: fp } = await supabaseServer
        .from("player_intelligence_card")
        .select(FEATURED_COLS)
        .eq("person_id", bestPid)
        .single();
      if (fp) { featured = fp as FeaturedProfile; featuredReason = "news_trending"; }
    }
  }

  // Tier 3: Discovery — random well-profiled player
  if (!featured) {
    const { data: fallbacks } = await supabaseServer
      .from("player_intelligence_card")
      .select(FEATURED_COLS)
      .eq("profile_tier", 1)
      .not("archetype", "is", null)
      .limit(20);
    const candidates = (fallbacks ?? []) as FeaturedProfile[];
    if (candidates.length > 0) {
      featured = candidates[dailySeed() % candidates.length];
      featuredReason = "discovery";
      featuredPool = candidates;
    }
  }

  // Personality type counts
  const personalityRows = (personalityResult.data ?? []) as { personality_type: string }[];
  const typeCountMap = new Map<string, number>();
  for (const row of personalityRows) {
    typeCountMap.set(row.personality_type, (typeCountMap.get(row.personality_type) ?? 0) + 1);
  }
  const typeCounts = Array.from(typeCountMap.entries()).map(([type, count]) => ({ type, count }));

  // Position counts
  const positionRows = (positionResult.data ?? []) as { position: string }[];
  const positionCounts: Record<string, number> = {};
  for (const pos of POSITIONS) {
    positionCounts[pos] = positionRows.filter((r) => r.position === pos).length;
  }

  // News stories
  const rawNews = (newsResult.data ?? []) as Array<{ id: string; headline: string; url: string | null; published_at: string | null; summary: string | null; story_type: string | null }>;

  // Get tags for news stories
  const storyIds = rawNews.map((s) => s.id);
  let newsWithTags: NewsStoryWithTags[] = rawNews.map((s) => ({ ...s, tags: [] }));

  if (storyIds.length > 0) {
    const { data: tagData } = await supabaseServer
      .from("news_player_tags")
      .select("story_id, player_id, sentiment, people!inner(name)")
      .in("story_id", storyIds);

    if (tagData) {
      const tagMap = new Map<string, Array<{ player_id: number; name: string; sentiment: string | null }>>();
      for (const t of tagData as Array<Record<string, unknown>>) {
        const storyId = t.story_id as string;
        const playerId = t.player_id as number;
        const sentiment = t.sentiment as string | null;
        const people = t.people as { name: string } | { name: string }[] | null;
        const name = Array.isArray(people) ? people[0]?.name : people?.name;
        const list = tagMap.get(storyId) ?? [];
        list.push({ player_id: playerId, name: name ?? "Unknown", sentiment });
        tagMap.set(storyId, list);
      }
      newsWithTags = rawNews.map((s) => ({ ...s, tags: tagMap.get(s.id) ?? [] }));
    }
  }

  // Trending players
  const trendingRaw = (trendingResult.data ?? []) as Array<{ player_id: number; people: { name: string } }>;
  const trendingMap = new Map<number, { person_id: number; name: string; count: number }>();
  for (const row of trendingRaw) {
    const existing = trendingMap.get(row.player_id);
    if (existing) { existing.count++; } else {
      trendingMap.set(row.player_id, { person_id: row.player_id, name: row.people?.name ?? "Unknown", count: 1 });
    }
  }
  const trendingPlayerIds = Array.from(trendingMap.values()).sort((a, b) => b.count - a.count).slice(0, 8);

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
          person_id: t.person_id, name: (e?.name as string) ?? t.name,
          position: (e?.position as string | null) ?? null, club: (e?.club as string | null) ?? null,
          personality_type: (e?.personality_type as string | null) ?? null, archetype: (e?.archetype as string | null) ?? null,
          level: (e?.level as number | null) ?? null, story_count: t.count,
        };
      })
      .filter((t) => t.name !== "Unknown");
  }

  // Pro data
  let proData = null;
  if (shortlistsEnabled) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pipelineResult, totalResult, fullProfilesResult] = results.slice(6) as any[];
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
      pipeline, positionCounts: pipelinePositionCounts,
      stats: { total: totalResult.count ?? 0, fullProfiles: fullProfilesResult.count ?? 0, priority: pipeline["Priority"]?.length ?? 0, tracked: pipelinePlayers.length },
    };
  }

  return { featured, featuredReason, featuredPool, typeCounts, positionCounts, news: newsWithTags, trendingPlayers, proData };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-[var(--sentiment-positive)]",
  negative: "bg-[var(--sentiment-negative)]",
  neutral: "bg-[var(--sentiment-neutral)]",
};

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

  const { featured, featuredReason, featuredPool, typeCounts, positionCounts, news, trendingPlayers, proData } = data;

  return (
    <div className="space-y-4">
      {/* Row 1: Featured Player + Choices CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Featured Player — 3 cols */}
        <div className="lg:col-span-3">
          {featured ? (
            <FeaturedPlayer player={featured} reason={featuredReason} pool={featuredPool} />
          ) : (
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-[var(--text-muted)]">No featured players yet.</p>
            </div>
          )}
        </div>

        {/* Choices CTA — 2 cols, full height */}
        <div className="lg:col-span-2">
          <Link href="/choices" className="glass rounded-xl p-6 block h-full hover:bg-[var(--bg-elevated)] transition-colors group relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-personality)]">Gaffer</span>
              <h2 className="text-xl font-bold tracking-tight mt-1 group-hover:text-[var(--accent-personality)] transition-colors">
                Make the Calls. Build Your Identity.
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                Transfer decisions, bench calls, pub debates — make the choices a manager would and discover your footballing identity.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--accent-personality)]/20 text-[var(--accent-personality)]">
                  Play Now &rarr;
                </span>
              </div>
            </div>
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-personality)]/5 to-transparent pointer-events-none" />
          </Link>
        </div>
      </div>

      {/* Row 2: News Feed (scrollable, fills space) + Browse */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* News — 3 cols, scrollable */}
        <div className="lg:col-span-3 glass rounded-xl p-4 sm:p-5 flex flex-col" style={{ maxHeight: "520px" }}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Latest News
            </h2>
            <Link href="/news" className="text-xs text-[var(--accent-personality)] hover:underline">
              All stories &rarr;
            </Link>
          </div>
          <div className="space-y-2.5 overflow-y-auto flex-1 -mr-2 pr-2">
            {news.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No stories yet. Run the news pipeline to ingest stories.</p>
            )}
            {news.map((story, i) => (
              <div key={story.id} className={`flex gap-3 ${i === 0 ? "pb-3 border-b border-[var(--border-subtle)]" : ""}`}>
                <span className="text-[10px] text-[var(--text-muted)] w-8 shrink-0 pt-0.5 font-mono">
                  {timeAgo(story.published_at)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {story.story_type && (
                      <span className="text-[8px] font-bold tracking-wider uppercase px-1 py-0.5 rounded bg-[var(--accent-tactical)]/15 text-[var(--accent-tactical)]">
                        {story.story_type}
                      </span>
                    )}
                  </div>
                  {story.url ? (
                    <a href={story.url} target="_blank" rel="noopener noreferrer" className={`text-[var(--text-primary)] hover:text-[var(--accent-personality)] block transition-colors ${i === 0 ? "text-sm font-semibold" : "text-xs"}`}>
                      {story.headline}
                    </a>
                  ) : (
                    <p className={`text-[var(--text-primary)] ${i === 0 ? "text-sm font-semibold" : "text-xs"}`}>
                      {story.headline}
                    </p>
                  )}
                  {i === 0 && story.summary && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{story.summary}</p>
                  )}
                  {story.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {story.tags.slice(0, 3).map((tag) => {
                        const dotClass = SENTIMENT_DOT[tag.sentiment ?? "neutral"] ?? SENTIMENT_DOT.neutral;
                        return (
                          <Link
                            key={tag.player_id}
                            href={`/players/${tag.player_id}`}
                            className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                            {tag.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Browse — 2 cols */}
        <div className="lg:col-span-2 space-y-3">
          {/* By Position */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-tactical)] mb-2">Position</h3>
            <div className="grid grid-cols-3 gap-1">
              {(["GK","CD","WD","DM","CM","WM","AM","WF","CF"] as const).map((pos) => (
                <Link
                  key={pos}
                  href={`/players?position=${pos}`}
                  className="text-center py-1.5 rounded text-[10px] font-bold bg-[var(--bg-elevated)] hover:bg-[var(--accent-tactical)]/20 hover:text-[var(--accent-tactical)] text-[var(--text-secondary)] transition-colors"
                >
                  {pos}
                  <span className="block text-[8px] font-normal text-[var(--text-muted)]">{positionCounts[pos] ?? 0}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* By Personality */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-personality)] mb-2">Personality</h3>
            <div className="space-y-1 max-h-[140px] overflow-y-auto">
              {typeCounts.sort((a, b) => b.count - a.count).slice(0, 8).map((t) => (
                <Link
                  key={t.type}
                  href={`/players?personalities=${t.type}`}
                  className="flex items-center justify-between px-2 py-1 rounded text-[10px] hover:bg-[var(--accent-personality)]/10 transition-colors"
                >
                  <span className="font-mono font-bold text-[var(--text-secondary)]">{t.type}</span>
                  <span className="text-[var(--text-muted)]">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* By League */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-2">League</h3>
            <div className="space-y-1 max-h-[140px] overflow-y-auto">
              {["Premier League","La Liga","Serie A","Bundesliga","Ligue 1","Eredivisie","Primeira Liga","Super Lig"].map((league) => (
                <Link
                  key={league}
                  href={`/leagues`}
                  className="flex items-center px-2 py-1 rounded text-[10px] hover:bg-green-500/10 transition-colors"
                >
                  <span className="text-[var(--text-secondary)]">{league}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trending Players */}
      {trendingPlayers.length > 0 && <TrendingPlayers players={trendingPlayers} />}

      {/* Pro: Pursuit Pipeline */}
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
