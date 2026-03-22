import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import type { PlayerCard as PlayerCardType } from "@/lib/types";
import { prodFilter, isProduction } from "@/lib/env";
import { LandingPage } from "@/components/LandingPage";
import { FeaturedPlayer } from "@/components/FeaturedPlayer";
import { TrendingPlayers } from "@/components/TrendingPlayers";
import { Topbar } from "@/components/Topbar";
import { SectionHeader } from "@/components/SectionHeader";

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

interface MarketMover {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  market_premium: number;
}

// Deterministic rotation — changes every 2 hours (12x daily)
function dailySeed(): number {
  const d = new Date();
  const slot = Math.floor(d.getHours() / 2); // 0-11
  return d.getFullYear() * 100000 + (d.getMonth() + 1) * 1000 + d.getDate() * 100 + slot;
}

type FeaturedReason = "dof_pick" | "news_trending" | "discovery";

const FEATURED_COLS = "person_id, name, position, club, nation, nation_code, level, overall, archetype, earned_archetype, best_role, best_role_score, personality_type, market_value_tier, dob, blueprint, scouting_notes, technical_score, tactical_score, mental_score, physical_score, overall_pillar_score, market_value_eur, director_valuation_meur" as const;

async function getDashboardData() {
  if (!supabaseServer) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: PromiseLike<any>[] = [
    // 0: Featured: DOF picks (active players only)
    prodFilter(supabaseServer
      .from("player_intelligence_card")
      .select(FEATURED_COLS + ", pursuit_status")
      .in("pursuit_status", ["Priority", "Interested", "Scout Further", "Watch"])
      .eq("active", true)
      .not("archetype", "is", null)
      .not("scouting_notes", "is", null))
      .order("level", { ascending: false })
      .limit(200),
    // 1: Sentiment data for swing-based selection + trending derivation
    supabaseServer
      .from("news_player_tags")
      .select("player_id, sentiment, story_id, people!inner(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    // 2: Recent news
    supabaseServer
      .from("news_stories")
      .select("id, headline, url, published_at, summary, story_type")
      .order("published_at", { ascending: false })
      .limit(8),
    // 3: Upcoming fixtures (next 14 days, enough to fill the panel)
    supabaseServer
      .from("fixtures")
      .select("id, competition, competition_code, matchday, utc_date, home_team, away_team, venue")
      .in("status", ["SCHEDULED", "TIMED"])
      .gte("utc_date", new Date().toISOString())
      .lte("utc_date", new Date(Date.now() + 14 * 86400000).toISOString())
      .order("utc_date", { ascending: true })
      .limit(15),
    // 4: Market movers — biggest premium/discount
    supabaseServer
      .from("player_market")
      .select("person_id, market_premium, people!inner(name, club_id, clubs(clubname)), player_profiles!inner(position)")
      .not("market_premium", "is", null)
      .order("market_premium", { ascending: false })
      .limit(6),
  ];

  const results = await Promise.all(queries);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dofPicksResult, sentimentResult, newsResult, fixturesResult, marketResult] = results as any[];

  // --- Featured player: tiered selection ---
  type FeaturedProfile = {
    person_id: number; name: string; position: string | null; club: string | null;
    nation: string | null; nation_code: string | null; level: number | null; overall: number | null;
    archetype: string | null; earned_archetype: string | null;
    best_role: string | null; best_role_score: number | null;
    personality_type: string | null;
    market_value_tier: string | null; dob: string | null; blueprint: string | null;
    scouting_notes: string | null;
    technical_score: number | null; tactical_score: number | null;
    mental_score: number | null; physical_score: number | null;
    overall_pillar_score: number | null;
    market_value_eur: number | null; director_valuation_meur: number | null;
  };

  let featured: FeaturedProfile | null = null;
  let featuredReason: FeaturedReason = "discovery";
  let featuredPool: FeaturedProfile[] = [];

  // Build a large pool: DOF picks up front (weighted), then broad Tier 1 discovery
  // Filter for LLM-quality bios (80+ chars, contains a period = real sentences)
  const hasQualityBio = (p: FeaturedProfile) =>
    p.scouting_notes && p.scouting_notes.length >= 80 && p.scouting_notes.includes(".");

  const dofCandidates = ((dofPicksResult.data ?? []) as Array<FeaturedProfile & { pursuit_status: string }>)
    .filter(hasQualityBio);
  const dofIds = new Set(dofCandidates.map((p) => p.person_id));

  // Always fetch broad discovery pool (active players with quality bios)
  const { data: discoveryData } = await supabaseServer
    .from("player_intelligence_card")
    .select(FEATURED_COLS)
    .eq("profile_tier", 1)
    .eq("active", true)
    .not("archetype", "is", null)
    .not("scouting_notes", "is", null)
    .order("level", { ascending: false })
    .limit(500);
  const discoveryPlayers = ((discoveryData ?? []) as FeaturedProfile[])
    .filter((p) => !dofIds.has(p.person_id) && hasQualityBio(p));

  // DOF picks appear 3x in the pool for weighting, then discovery fills the rest
  const weightedPool: FeaturedProfile[] = [
    ...dofCandidates, ...dofCandidates, ...dofCandidates,  // 3x weight
    ...discoveryPlayers,
  ];

  if (weightedPool.length > 0) {
    const picked = weightedPool[dailySeed() % weightedPool.length];
    featured = picked;
    featuredReason = dofIds.has(picked.person_id) ? "dof_pick" : "discovery";
  }

  // Deduplicated pool for cycling (no repeats)
  const seenIds = new Set<number>();
  const uniquePool: FeaturedProfile[] = [];
  for (const p of [...dofCandidates, ...discoveryPlayers]) {
    if (!seenIds.has(p.person_id)) {
      seenIds.add(p.person_id);
      uniquePool.push(p);
    }
  }
  featuredPool = uniquePool;

  // Fetch API-Football stats for featured player
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

  // Fixtures
  const fixtures = (fixturesResult.data ?? []) as FixtureRow[];

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
  const marketMovers = [...overpriced, ...undervalued].sort((a, b) => Math.abs(b.market_premium) - Math.abs(a.market_premium)).slice(0, 3);

  // Trending players — derived from sentiment data (distinct story counts per player)
  type TrendingPlayer = {
    person_id: number; name: string; position: string | null; club: string | null;
    personality_type: string | null; archetype: string | null; level: number | null;
    fingerprint: number[] | null; best_role: string | null; story_count: number;
  };
  let trendingPlayers: TrendingPlayer[] = [];
  const allSentimentRows = (sentimentResult.data ?? []) as Array<{ player_id: number; story_id: string; people: { name: string } }>;
  const storyCountMap = new Map<number, Set<string>>();
  for (const row of allSentimentRows) {
    const set = storyCountMap.get(row.player_id) ?? new Set();
    set.add(row.story_id);
    storyCountMap.set(row.player_id, set);
  }
  const trendingIds = [...storyCountMap.entries()]
    .map(([pid, stories]) => ({ pid, count: stories.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  if (trendingIds.length > 0) {
    const { data: trendingCards } = await supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, position, club, personality_type, archetype, level, fingerprint, best_role")
      .in("person_id", trendingIds.map((t) => t.pid));
    const cardMap = new Map((trendingCards ?? []).map((c: Record<string, unknown>) => [c.person_id as number, c]));
    trendingPlayers = trendingIds
      .map((t) => {
        const card = cardMap.get(t.pid) as Record<string, unknown> | undefined;
        if (!card) return null;
        return {
          person_id: t.pid,
          name: card.name as string,
          position: (card.position as string | null) ?? null,
          club: (card.club as string | null) ?? null,
          personality_type: (card.personality_type as string | null) ?? null,
          archetype: (card.archetype as string | null) ?? null,
          level: (card.level as number | null) ?? null,
          fingerprint: (card.fingerprint as number[] | null) ?? null,
          best_role: (card.best_role as string | null) ?? null,
          story_count: t.count,
        };
      })
      .filter((p): p is TrendingPlayer => p !== null);
  }

  return { featured, featuredReason, featuredPool, news: newsWithTags, fixtures, marketMovers, trendingPlayers };
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

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-[var(--color-sentiment-positive)]",
  negative: "bg-[var(--color-sentiment-negative)]",
  neutral: "bg-[var(--color-sentiment-neutral)]",
};

const COMP_SHORT: Record<string, string> = {
  "Premier League": "PL", "La Liga": "LL", "Serie A": "SA",
  "Bundesliga": "BL", "Ligue 1": "L1",
};

const NEWS_TYPE_STYLES: Record<string, string> = {
  transfer: "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/20",
  injury: "bg-[var(--color-sentiment-negative)]/10 text-[var(--color-sentiment-negative)] border border-[var(--color-sentiment-negative)]/20",
  contract: "bg-[var(--color-accent-mental)]/10 text-[var(--color-accent-mental)] border border-[var(--color-accent-mental)]/20",
  tactical: "bg-[var(--color-accent-physical)]/10 text-[var(--color-accent-physical)] border border-[var(--color-accent-physical)]/20",
  scouting: "bg-[var(--color-accent-personality)]/10 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/20",
  analysis: "bg-[var(--border-bright)]/10 text-[var(--border-bright)] border border-[var(--border-bright)]/15",
};

const COMP_DISPLAY: Record<string, string> = {
  "Premier League": "Prem",
  "La Liga": "La Liga",
  "Serie A": "Serie A",
  "Bundesliga": "Bundes.",
  "Ligue 1": "Ligue 1",
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

  const data = await getDashboardData();

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-4">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  const { featured, featuredReason, featuredPool, news, fixtures, marketMovers, trendingPlayers } = data;

  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100vh-2rem)] lg:overflow-hidden">
      <Topbar />

      {/* Row 1: News (3col) + Fixtures (2col) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 shrink-0">
        {/* News — 3 cols, scrollable within */}
        <div className="lg:col-span-3 glass panel-accent-cyan p-2.5 flex flex-col min-h-0">
          <SectionHeader
            label="Latest Intelligence"
            color="cyan"
            action={
              <Link href="/news" className="text-[10px] text-[var(--border-bright)] hover:underline">
                All stories &rarr;
              </Link>
            }
          />
          <div className="space-y-1.5 overflow-y-auto flex-1 -mr-1 pr-1 mt-1.5">
            {news.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No stories yet. Run the news pipeline to ingest stories.</p>
            )}
            {news.map((story, i) => (
              <div key={story.id} className={`flex gap-2 ${i === 0 ? "pb-1.5 border-b border-[var(--border-subtle)]" : ""}`}>
                <span className="text-[9px] text-[var(--text-muted)] w-7 shrink-0 pt-0.5 font-mono">
                  {timeAgo(story.published_at)}
                </span>
                <div className="min-w-0 flex-1">
                  {story.story_type && (
                    <span className={`text-[8px] font-bold tracking-wider uppercase px-1 py-0.5 mr-1 ${NEWS_TYPE_STYLES[story.story_type?.toLowerCase() ?? ""] ?? "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)]"}`}>
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
                      {story.tags.slice(0, 3).map((tag) => {
                        const dotClass = SENTIMENT_DOT[tag.sentiment ?? "neutral"] ?? SENTIMENT_DOT.neutral;
                        return (
                          <Link
                            key={tag.player_id}
                            href={`/players/${tag.player_id}`}
                            className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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

        {/* Fixtures — 2 cols */}
        <div className="lg:col-span-2 glass panel-accent-tactical p-2.5 flex flex-col min-h-0">
          <SectionHeader
            label="Upcoming Fixtures"
            color="tactical"
            action={
              <Link href="/fixtures" className="text-[10px] text-[var(--color-accent-tactical)] hover:underline">
                All &rarr;
              </Link>
            }
          />
          {fixtures.length === 0 ? (
            <p className="text-[10px] text-[var(--text-muted)] py-1 text-center mt-1.5">No upcoming fixtures.</p>
          ) : (
            <div className="space-y-0.5 overflow-y-auto flex-1 -mr-1 pr-1 mt-1.5">
              {fixtures.map((f) => (
                <Link key={f.id} href={`/fixtures/${f.id}`} className="flex items-center gap-2 py-0.5 hover:bg-[var(--bg-elevated)]/50 transition-colors px-1 -mx-1">
                  <span className="text-[8px] font-bold tracking-wider text-[var(--text-muted)] w-12 shrink-0">
                    {COMP_DISPLAY[f.competition] ?? f.competition_code ?? ""}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="font-medium text-[var(--text-primary)] truncate">{f.home_team}</span>
                      <span className="text-[var(--text-muted)] text-[9px]">v</span>
                      <span className="font-medium text-[var(--text-primary)] truncate">{f.away_team}</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">{formatFixtureDate(f.utc_date)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Featured Player (2col) + Market Movers / Trending / Gaffer (3col) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 flex-1 min-h-0">
        {/* Featured Player — 2 cols */}
        <div className="lg:col-span-2">
          {featured ? (
            <FeaturedPlayer player={featured} reason={featuredReason} pool={featuredPool} />
          ) : (
            <div className="glass p-4">
              <p className="text-sm text-[var(--text-muted)]">No featured players yet.</p>
            </div>
          )}
        </div>

        {/* Right column — Market Movers + Trending + Game CTAs */}
        <div className="lg:col-span-3 flex flex-col gap-2 min-h-0">
          {/* Market Movers */}
          {marketMovers.length > 0 && (
            <div className="glass panel-accent-physical p-2.5">
              <SectionHeader label="Market Movers" color="physical" />
              <div className="space-y-0.5 mt-1.5">
                {marketMovers.map((p) => {
                  const isOver = p.market_premium > 0;
                  return (
                    <Link key={p.person_id} href={`/players/${p.person_id}`} className="flex items-center gap-1.5 py-0.5 hover:bg-[var(--bg-elevated)]/50 transition-colors px-1 -mx-1">
                      <span className="text-[11px] font-medium text-[var(--text-primary)] truncate flex-1">{p.name}</span>
                      <span className={`text-[10px] font-mono font-bold shrink-0 ${isOver ? "text-[var(--color-sentiment-negative)]" : "text-[var(--color-sentiment-positive)]"}`}>
                        {isOver ? "+" : ""}{p.market_premium}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trending Players */}
          {trendingPlayers.length > 0 && (
            <TrendingPlayers players={trendingPlayers} />
          )}

          {/* Game CTAs — slim row */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href="/choices" className="glass px-3 py-2 flex-1 min-w-[140px] flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-personality)]">Gaffer</span>
                <span className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--color-accent-personality)] transition-colors hidden sm:inline">
                  Make the calls.
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[var(--color-accent-personality)] group-hover:translate-x-0.5 transition-transform">
                Play &rarr;
              </span>
            </Link>
            <Link href="/kickoff-clash" className="glass px-3 py-2 flex-1 min-w-[140px] flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#e74c3c]">Kickoff Clash</span>
                <span className="text-[11px] text-[var(--text-secondary)] group-hover:text-[#e74c3c] transition-colors hidden sm:inline">
                  Card battler.
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[#e74c3c] group-hover:translate-x-0.5 transition-transform">
                Play &rarr;
              </span>
            </Link>
            <Link href="/on-the-plane" className="glass px-3 py-2 flex-1 min-w-[140px] flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-physical)]">On The Plane</span>
                <span className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--color-accent-physical)] transition-colors hidden sm:inline">
                  Pick your 26.
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[var(--color-accent-physical)] group-hover:translate-x-0.5 transition-transform">
                Play &rarr;
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
