import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS, POSITION_COLORS } from "@/lib/types";
import type { PlayerCard as PlayerCardType } from "@/lib/types";
import { getFeatureFlags } from "@/lib/features";
import { prodFilter, isProduction } from "@/lib/env";
import { TrendingPlayers } from "@/components/TrendingPlayers";
import { PursuitPanel } from "@/components/PursuitPanel";
import { LandingPage } from "@/components/LandingPage";
import { FeaturedPlayer } from "@/components/FeaturedPlayer";

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

interface FixtureRow {
  id: number;
  competition: string;
  competition_code: string | null;
  matchday: number | null;
  utc_date: string;
  home_team: string;
  away_team: string;
  venue: string | null;
}

interface ContractPlayer {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  contract_expiry_date: string;
}

interface RisingStar {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  trajectory: string;
}

interface MarketMover {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  market_premium: number;
}

interface KeyMoment {
  id: number;
  person_id: number;
  name: string;
  moment_type: string;
  title: string | null;
  description: string | null;
  moment_date: string;
}

// Deterministic daily rotation
function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

type FeaturedReason = "dof_pick" | "news_trending" | "discovery";

const FEATURED_COLS = "person_id, name, position, club, nation, level, overall, archetype, personality_type, market_value_tier, dob, blueprint, scouting_notes" as const;

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  dof_pick: { label: "DOF Pick", color: "var(--accent-tactical)" },
  news_trending: { label: "Trending", color: "var(--accent-physical)" },
  discovery: { label: "Discovery", color: "var(--accent-personality)" },
};

async function getDashboardData(shortlistsEnabled: boolean) {
  if (!supabaseServer) return null;

  const sixMonthsOut = new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: PromiseLike<any>[] = [
    // 0: Featured: DOF picks
    prodFilter(supabaseServer
      .from("player_intelligence_card")
      .select(FEATURED_COLS + ", pursuit_status")
      .in("pursuit_status", ["Priority", "Interested"])
      .not("archetype", "is", null)
      .not("scouting_notes", "is", null))
      .order("level", { ascending: false })
      .limit(20),
    // 1: Sentiment data for swing-based selection
    supabaseServer
      .from("news_player_tags")
      .select("player_id, sentiment, people!inner(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    // 2: Recent news with tags
    supabaseServer
      .from("news_stories")
      .select("id, headline, url, published_at, summary, story_type")
      .order("published_at", { ascending: false })
      .limit(10),
    // 3: Trending players
    supabaseServer
      .from("news_player_tags")
      .select("player_id, people!inner(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    // 4: Upcoming fixtures (next 14 days)
    supabaseServer
      .from("fixtures")
      .select("id, competition, competition_code, matchday, utc_date, home_team, away_team, venue")
      .in("status", ["SCHEDULED", "TIMED"])
      .gte("utc_date", new Date().toISOString())
      .lte("utc_date", new Date(Date.now() + 14 * 86400000).toISOString())
      .order("utc_date", { ascending: true })
      .limit(8),
    // 5: Sample Gaffer question
    supabaseServer
      .from("fc_questions")
      .select("id, question_text, subtitle, tags")
      .order("total_votes", { ascending: false })
      .limit(5),
    // 6: Contract watch — expiring within 6 months
    supabaseServer
      .from("people")
      .select("id, name, contract_expiry_date, clubs(clubname), player_profiles(position)")
      .not("contract_expiry_date", "is", null)
      .lte("contract_expiry_date", sixMonthsOut)
      .gte("contract_expiry_date", new Date().toISOString().split("T")[0])
      .order("contract_expiry_date", { ascending: true })
      .limit(5),
    // 7: Rising stars — career trajectory
    supabaseServer
      .from("career_metrics")
      .select("person_id, trajectory, people!inner(name, club_id, clubs(clubname)), player_profiles!inner(position)")
      .eq("trajectory", "rising")
      .order("loyalty_score", { ascending: false })
      .limit(5),
    // 8: Market movers — biggest premium/discount
    supabaseServer
      .from("player_market")
      .select("person_id, market_premium, people!inner(name, club_id, clubs(clubname)), player_profiles!inner(position)")
      .not("market_premium", "is", null)
      .order("market_premium", { ascending: false })
      .limit(10),
    // 9: Key moments — last 7 days
    supabaseServer
      .from("key_moments")
      .select("id, person_id, moment_type, title, description, moment_date, people!inner(name)")
      .gte("moment_date", sevenDaysAgo)
      .order("moment_date", { ascending: false })
      .limit(5),
  ];

  if (shortlistsEnabled) {
    queries.push(
      // 10: Pipeline players
      prodFilter(supabaseServer
        .from("player_intelligence_card")
        .select("person_id, name, position, club, level, archetype, pursuit_status, profile_tier, personality_type")
        .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"]))
        .order("level", { ascending: false }),
      // 11: Total people count
      supabaseServer.from("people").select("id", { count: "exact", head: true }),
      // 12: Full profiles count
      supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).not("archetype", "is", null).eq("profile_tier", 1),
    );
  }

  const results = await Promise.all(queries);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dofPicksResult, sentimentResult, newsResult, trendingResult, fixturesResult, gafferResult, contractResult, risingResult, marketResult, momentsResult] = results as any[];

  // --- Featured player: tiered selection ---
  type FeaturedProfile = {
    person_id: number; name: string; position: string | null; club: string | null;
    nation: string | null; level: number | null; overall: number | null;
    archetype: string | null; personality_type: string | null;
    market_value_tier: string | null; dob: string | null; blueprint: string | null;
    scouting_notes: string | null;
  };

  let featured: FeaturedProfile | null = null;
  let featuredReason: FeaturedReason = "discovery";
  let featuredPool: FeaturedProfile[] = [];

  const dofCandidates = (dofPicksResult.data ?? []) as Array<FeaturedProfile & { pursuit_status: string }>;
  const priorityPicks = dofCandidates.filter((p) => p.pursuit_status === "Priority");
  const interestedPicks = dofCandidates.filter((p) => p.pursuit_status === "Interested");
  const dofPool = priorityPicks.length > 0 ? priorityPicks : interestedPicks;
  if (dofPool.length > 0) {
    featured = dofPool[dailySeed() % dofPool.length];
    featuredReason = "dof_pick";
    featuredPool = dofPool;
  }

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
      if (fp && (fp as FeaturedProfile).scouting_notes) { featured = fp as FeaturedProfile; featuredReason = "news_trending"; }
    }
  }

  // Fetch API-Football stats for featured player (will be enriched after selection)
  async function enrichFeatured(fp: FeaturedProfile): Promise<FeaturedProfile & { af_appearances?: number; af_goals?: number; af_assists?: number; af_rating?: number | null }> {
    const { data: afRows } = await supabaseServer!
      .from("api_football_player_stats")
      .select("appearances, goals, assists, rating")
      .eq("person_id", fp.person_id)
      .eq("season", "2025");
    if (!afRows || afRows.length === 0) return fp;
    let apps = 0, goals = 0, assists = 0;
    let bestRating: number | null = null;
    for (const r of afRows as Array<Record<string, unknown>>) {
      apps += (r.appearances as number) || 0;
      goals += (r.goals as number) || 0;
      assists += (r.assists as number) || 0;
      const rtg = r.rating as number | null;
      if (rtg != null && (bestRating == null || rtg > bestRating)) bestRating = rtg;
    }
    return { ...fp, af_appearances: apps, af_goals: goals, af_assists: assists, af_rating: bestRating };
  }

  if (!featured) {
    const { data: fallbacks } = await supabaseServer
      .from("player_intelligence_card")
      .select(FEATURED_COLS)
      .eq("profile_tier", 1)
      .not("archetype", "is", null)
      .not("scouting_notes", "is", null)
      .limit(20);
    const candidates = (fallbacks ?? []) as FeaturedProfile[];
    if (candidates.length > 0) {
      featured = candidates[dailySeed() % candidates.length];
      featuredReason = "discovery";
      featuredPool = candidates;
    }
  }

  // Enrich featured player with API-Football stats
  if (featured) {
    featured = await enrichFeatured(featured);
  }

  // News stories with tags
  const rawNews = (newsResult.data ?? []) as Array<{ id: string; headline: string; url: string | null; published_at: string | null; summary: string | null; story_type: string | null }>;
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

  // Fixtures
  const fixtures = (fixturesResult.data ?? []) as FixtureRow[];

  // Gaffer sample question
  const gafferQuestions = (gafferResult.data ?? []) as Array<{ id: number; question_text: string; subtitle: string | null; tags: string[] | null }>;
  const sampleQuestion = gafferQuestions.length > 0
    ? gafferQuestions[dailySeed() % gafferQuestions.length]
    : null;

  // Contract watch
  const contractPlayers = ((contractResult.data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const clubs = r.clubs as Record<string, unknown> | null;
    const profiles = r.player_profiles as Record<string, unknown> | null;
    return {
      person_id: r.id as number,
      name: r.name as string,
      position: (profiles?.position as string | null) ?? null,
      club: (clubs?.clubname as string | null) ?? null,
      contract_expiry_date: r.contract_expiry_date as string,
    };
  }) as ContractPlayer[];

  // Rising stars
  const risingStars = ((risingResult.data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const people = r.people as Record<string, unknown> | null;
    const clubs = people?.clubs as Record<string, unknown> | null;
    const profiles = r.player_profiles as Record<string, unknown> | null;
    return {
      person_id: r.person_id as number,
      name: (people?.name as string) ?? "Unknown",
      position: (profiles?.position as string | null) ?? null,
      club: (clubs?.clubname as string | null) ?? null,
      trajectory: r.trajectory as string,
    };
  }) as RisingStar[];

  // Market movers — take top 3 overpriced + top 3 undervalued
  const marketRaw = ((marketResult.data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const people = r.people as Record<string, unknown> | null;
    const clubs = people?.clubs as Record<string, unknown> | null;
    const profiles = r.player_profiles as Record<string, unknown> | null;
    return {
      person_id: r.person_id as number,
      name: (people?.name as string) ?? "Unknown",
      position: (profiles?.position as string | null) ?? null,
      club: (clubs?.clubname as string | null) ?? null,
      market_premium: r.market_premium as number,
    };
  }) as MarketMover[];
  // Mix: top overpriced and most undervalued for interesting spread
  const overpriced = marketRaw.filter((m) => m.market_premium > 0).slice(0, 3);
  const undervalued = marketRaw.filter((m) => m.market_premium < 0).sort((a, b) => a.market_premium - b.market_premium).slice(0, 3);
  const marketMovers = [...overpriced, ...undervalued].sort((a, b) => Math.abs(b.market_premium) - Math.abs(a.market_premium)).slice(0, 5);

  // Key moments
  const keyMoments = ((momentsResult.data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const people = r.people as Record<string, unknown> | null;
    return {
      id: r.id as number,
      person_id: r.person_id as number,
      name: (people?.name as string) ?? "Unknown",
      moment_type: r.moment_type as string,
      title: r.title as string | null,
      description: r.description as string | null,
      moment_date: r.moment_date as string,
    };
  }) as KeyMoment[];

  // Pro data
  let proData = null;
  if (shortlistsEnabled) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pipelineResult, totalResult, fullProfilesResult] = results.slice(10) as any[];
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

  return { featured, featuredReason, featuredPool, news: newsWithTags, trendingPlayers, fixtures, sampleQuestion, contractPlayers, risingStars, marketMovers, keyMoments, proData };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatFixtureDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatFixtureTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatExpiryDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-[var(--color-sentiment-positive)]",
  negative: "bg-[var(--color-sentiment-negative)]",
  neutral: "bg-[var(--color-sentiment-neutral)]",
};

const COMP_SHORT: Record<string, string> = {
  "Premier League": "PL", "La Liga": "LL", "Serie A": "SA",
  "Bundesliga": "BL", "Ligue 1": "L1",
};

const MOMENT_ICON: Record<string, string> = {
  goal: "\u26A1",
  assist: "\uD83C\uDFAF",
  performance: "\uD83D\uDD25",
  controversy: "\u26A0\uFE0F",
  milestone: "\uD83C\uDFC6",
};

async function getShowcasePlayers(): Promise<PlayerCardType[]> {
  if (!supabaseServer) return [];
  const { data } = await supabaseServer
    .from("player_intelligence_card")
    .select("person_id, name, dob, club, club_id, nation, position, level, archetype, personality_type, best_role, best_role_score, market_value_eur, director_valuation_meur, model_id, profile_tier, pursuit_status, height_cm, preferred_foot, active, market_value_tier, true_mvt")
    .eq("profile_tier", 1)
    .not("archetype", "is", null)
    .not("personality_type", "is", null)
    .not("best_role_score", "is", null)
    .order("best_role_score", { ascending: false })
    .limit(4);
  return (data ?? []) as unknown as PlayerCardType[];
}

export default async function DashboardPage() {
  if (isProduction()) {
    const cookieStore = await cookies();
    const hasAuth = cookieStore.getAll().some((c) => c.name.includes("auth-token"));
    if (!hasAuth) {
      const showcasePlayers = await getShowcasePlayers();
      return <LandingPage showcasePlayers={showcasePlayers} />;
    }
  }

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

  const { featured, featuredReason, featuredPool, news, trendingPlayers, fixtures, sampleQuestion, contractPlayers, risingStars, marketMovers, keyMoments, proData } = data;

  return (
    <div className="space-y-3">
      {/* Row 1: Featured (compact) + Gaffer (compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Featured Player — with radar, scouting notes, prev/next */}
        <div className="lg:col-span-3">
          {featured ? (
            <FeaturedPlayer player={featured} reason={featuredReason} pool={featuredPool} />
          ) : (
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-[var(--text-muted)]">No featured players yet.</p>
            </div>
          )}
        </div>

        {/* Gaffer CTA — compact with sample question, 2 cols */}
        <div className="lg:col-span-2">
          <Link href="/choices" className="glass rounded-xl p-4 block h-full hover:bg-[var(--bg-elevated)] transition-colors group relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent-personality)]">Gaffer</span>
                <span className="text-[10px] font-semibold text-[var(--color-accent-personality)] group-hover:translate-x-0.5 transition-transform">
                  Play &rarr;
                </span>
              </div>
              {sampleQuestion ? (
                <>
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug line-clamp-3 group-hover:text-[var(--color-accent-personality)] transition-colors">
                    &ldquo;{sampleQuestion.question_text}&rdquo;
                  </p>
                  {sampleQuestion.subtitle && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-1">{sampleQuestion.subtitle}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug group-hover:text-[var(--color-accent-personality)] transition-colors">
                    Make the Calls. Build Your Identity.
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Transfer decisions, bench calls, pub debates.
                  </p>
                </>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent-personality)]/5 to-transparent pointer-events-none" />
          </Link>
        </div>
      </div>

      {/* Row 2: News + Fixtures / Contract Watch / League */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* News — 3 cols */}
        <div className="lg:col-span-3 glass rounded-xl p-3 flex flex-col" style={{ maxHeight: "400px" }}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Latest News
            </h2>
            <Link href="/news" className="text-[10px] text-[var(--color-accent-personality)] hover:underline">
              All stories &rarr;
            </Link>
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 -mr-1 pr-1">
            {news.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No stories yet. Run the news pipeline to ingest stories.</p>
            )}
            {news.map((story, i) => (
              <div key={story.id} className={`flex gap-2 ${i === 0 ? "pb-2 border-b border-[var(--border-subtle)]" : ""}`}>
                <span className="text-[9px] text-[var(--text-muted)] w-7 shrink-0 pt-0.5 font-mono">
                  {timeAgo(story.published_at)}
                </span>
                <div className="min-w-0 flex-1">
                  {story.story_type && (
                    <span className="text-[8px] font-bold tracking-wider uppercase px-1 py-0.5 rounded bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)] mr-1">
                      {story.story_type}
                    </span>
                  )}
                  {story.url ? (
                    <a href={story.url} target="_blank" rel="noopener noreferrer" className={`text-[var(--text-primary)] hover:text-[var(--color-accent-personality)] transition-colors ${i === 0 ? "text-xs font-semibold" : "text-[11px]"}`}>
                      {story.headline}
                    </a>
                  ) : (
                    <p className={`text-[var(--text-primary)] ${i === 0 ? "text-xs font-semibold" : "text-[11px]"}`}>
                      {story.headline}
                    </p>
                  )}
                  {i === 0 && story.summary && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{story.summary}</p>
                  )}
                  {story.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {story.tags.slice(0, 4).map((tag) => {
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

        {/* Right column — Fixtures + Contract Watch + League */}
        <div className="lg:col-span-2 space-y-3">
          {/* Upcoming Fixtures */}
          <div className="glass rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-tactical)]">Upcoming Fixtures</h3>
              <Link href="/fixtures" className="text-[10px] text-[var(--color-accent-tactical)] hover:underline">
                All &rarr;
              </Link>
            </div>
            {fixtures.length === 0 ? (
              <p className="text-[10px] text-[var(--text-muted)] py-2 text-center">No upcoming fixtures.</p>
            ) : (
              <div className="space-y-1.5">
                {fixtures.map((f) => (
                  <Link key={f.id} href={`/fixtures/${f.id}`} className="flex items-center gap-2 py-1 rounded hover:bg-[var(--bg-elevated)]/50 transition-colors px-1 -mx-1">
                    <span className="text-[8px] font-bold tracking-wider text-[var(--text-muted)] w-5 shrink-0">
                      {COMP_SHORT[f.competition] ?? f.competition_code ?? ""}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="font-medium text-[var(--text-primary)] truncate">{f.home_team}</span>
                        <span className="text-[var(--text-muted)] text-[9px]">v</span>
                        <span className="font-medium text-[var(--text-primary)] truncate">{f.away_team}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[9px] text-[var(--text-muted)] font-mono">{formatFixtureDate(f.utc_date)}</span>
                      <span className="text-[8px] text-[var(--text-muted)] font-mono ml-1">{formatFixtureTime(f.utc_date)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Contract Watch */}
          {contractPlayers.length > 0 && (
            <div className="glass rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-physical)]">Contract Watch</h3>
                <Link href="/free-agents" className="text-[10px] text-[var(--color-accent-physical)] hover:underline">
                  Free agents &rarr;
                </Link>
              </div>
              <div className="space-y-1.5">
                {contractPlayers.map((p) => {
                  const days = daysUntil(p.contract_expiry_date);
                  const urgent = days <= 60;
                  return (
                    <Link key={p.person_id} href={`/players/${p.person_id}`} className="flex items-center gap-2 py-1 rounded hover:bg-[var(--bg-elevated)]/50 transition-colors px-1 -mx-1">
                      {p.position && (
                        <span className={`text-[8px] font-bold tracking-wider px-1 py-0.5 rounded ${POSITION_COLORS[p.position] ?? "bg-zinc-700/60"} text-white`}>
                          {p.position}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-[var(--text-primary)] truncate block">{p.name}</span>
                        {p.club && <span className="text-[9px] text-[var(--text-muted)]">{p.club}</span>}
                      </div>
                      <span className={`text-[9px] font-mono shrink-0 ${urgent ? "text-[var(--color-sentiment-negative)] font-bold" : "text-[var(--text-muted)]"}`}>
                        {formatExpiryDate(p.contract_expiry_date)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* By League */}
          <div className="glass rounded-xl p-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1.5">League</h3>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {["Premier League","La Liga","Serie A","Bundesliga","Ligue 1","Eredivisie","Primeira Liga","Super Lig"].map((league) => (
                <Link
                  key={league}
                  href={`/clubs?league=${encodeURIComponent(league)}`}
                  className="px-1.5 py-0.5 rounded text-[10px] hover:bg-green-500/10 text-[var(--text-secondary)] transition-colors truncate"
                >
                  {league}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Intelligence cards — only render cards that have data */}
      {(risingStars.length > 0 || marketMovers.length > 0 || keyMoments.length > 0) && (
        <div className={`grid grid-cols-1 gap-3 ${
          (() => {
            const count = [risingStars.length > 0, marketMovers.length > 0, keyMoments.length > 0].filter(Boolean).length;
            if (count >= 3) return "md:grid-cols-3";
            if (count === 2) return "md:grid-cols-2";
            return "";
          })()
        }`}>
          {/* Rising Stars */}
          {risingStars.length > 0 && (
            <div className="glass rounded-xl p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-tactical)] mb-2">
                Rising Stars
              </h3>
              <div className="space-y-1.5">
                {risingStars.map((p) => (
                  <Link key={p.person_id} href={`/players/${p.person_id}`} className="flex items-center gap-2 py-1 rounded hover:bg-[var(--bg-elevated)]/50 transition-colors px-1 -mx-1">
                    <span className="text-[var(--color-accent-tactical)] text-[10px] shrink-0">{"\u25B2"}</span>
                    {p.position && (
                      <span className={`text-[8px] font-bold tracking-wider px-1 py-0.5 rounded ${POSITION_COLORS[p.position] ?? "bg-zinc-700/60"} text-white`}>
                        {p.position}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium text-[var(--text-primary)] truncate block">{p.name}</span>
                      {p.club && <span className="text-[9px] text-[var(--text-muted)]">{p.club}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Market Movers */}
          {marketMovers.length > 0 && (
            <div className="glass rounded-xl p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-physical)] mb-2">
                Market Movers
              </h3>
              <div className="space-y-1.5">
                {marketMovers.map((p) => {
                  const isOver = p.market_premium > 0;
                  return (
                    <Link key={p.person_id} href={`/players/${p.person_id}`} className="flex items-center gap-2 py-1 rounded hover:bg-[var(--bg-elevated)]/50 transition-colors px-1 -mx-1">
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-[var(--text-primary)] truncate block">{p.name}</span>
                        {p.club && <span className="text-[9px] text-[var(--text-muted)]">{p.club}</span>}
                      </div>
                      <span className={`text-[10px] font-mono font-bold shrink-0 ${isOver ? "text-[var(--color-sentiment-negative)]" : "text-[var(--color-sentiment-positive)]"}`}>
                        {isOver ? "+" : ""}{p.market_premium}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key Moments */}
          {keyMoments.length > 0 && (
            <div className="glass rounded-xl p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-mental)] mb-2">
                Key Moments <span className="text-[var(--text-muted)] font-normal">7d</span>
              </h3>
              <div className="space-y-1.5">
                {keyMoments.map((m) => (
                  <Link key={m.id} href={`/players/${m.person_id}`} className="flex items-start gap-2 py-1 rounded hover:bg-[var(--bg-elevated)]/50 transition-colors px-1 -mx-1">
                    <span className="text-[11px] shrink-0 mt-0.5">{MOMENT_ICON[m.moment_type] ?? "\u2022"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium text-[var(--text-primary)] block truncate">
                        {m.title ?? m.description ?? m.moment_type}
                      </span>
                      <span className="text-[9px] text-[var(--text-muted)]">{m.name}</span>
                    </div>
                    <span className="text-[8px] text-[var(--text-muted)] font-mono shrink-0">
                      {new Date(m.moment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
