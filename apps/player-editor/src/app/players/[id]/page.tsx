import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { computeAge, PURSUIT_COLORS, POSITION_COLORS } from "@/lib/types";
import { PlayerIdentityPanel } from "@/components/PlayerIdentityPanel";
import { CompoundMetrics } from "@/components/CompoundMetrics";
import { KeyMomentsList } from "@/components/KeyMomentsList";
import type { KeyMoment } from "@/components/KeyMomentsList";
import { ScoutPad } from "@/components/ScoutPad";
import type { NewsStory } from "@/components/ScoutPad";
import { PlayerStats } from "@/components/PlayerStats";

interface IntelligenceCard {
  person_id: number;
  name: string;
  dob: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  active: boolean;
  nation: string | null;
  club: string | null;
  position: string | null;
  level: number | null;
  peak: number | null;
  overall: number | null;
  archetype: string | null;
  model_id: string | null;
  profile_tier: number | null;
  personality_type: string | null;
  pursuit_status: string | null;
  market_value_tier: string | null;
  true_mvt: string | null;
  market_premium: string | null;
  scarcity_score: number | null;
  scouting_notes: string | null;
  squad_role: string | null;
  blueprint: string | null;
  loan_status: string | null;
  transfer_fee_eur: number | null;
  hg: boolean | null;
  ei: number | null;
  sn: number | null;
  tf: number | null;
  jp: number | null;
  competitiveness: number | null;
  coachability: number | null;
}

interface AttributeGrade {
  attribute: string;
  scout_grade: number | null;
  stat_score: number | null;
}

interface FBRefStat {
  comp_name: string;
  season: string;
  team: string;
  minutes: number | null;
  matches_played: number | null;
  starts: number | null;
  goals: number | null;
  assists: number | null;
  xg: number | null;
  npxg: number | null;
  xag: number | null;
  key_passes: number | null;
  progressive_passes: number | null;
  progressive_carries: number | null;
  successful_dribbles: number | null;
  tackles: number | null;
  interceptions: number | null;
  blocks: number | null;
  passes_completed: number | null;
  passes_attempted: number | null;
  pass_pct: number | null;
  shots: number | null;
  shots_on_target: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = parseInt(id, 10);

  if (!supabaseServer || isNaN(playerId)) {
    notFound();
  }

  // Fetch all data in parallel
  const [playerResult, momentsResult, gradesResult, newsResult, fbrefLinkResult] = await Promise.all([
    supabaseServer
      .from("player_intelligence_card")
      .select("*")
      .eq("person_id", playerId)
      .single(),
    supabaseServer
      .from("key_moments")
      .select("id, title, description, moment_date, moment_type, sentiment, source_url, news_stories(title, url, summary, published_at)")
      .eq("person_id", playerId)
      .order("display_order", { ascending: true })
      .order("moment_date", { ascending: false }),
    supabaseServer
      .from("attribute_grades")
      .select("attribute, scout_grade, stat_score")
      .eq("player_id", playerId),
    supabaseServer
      .from("news_player_tags")
      .select("story_type, confidence, sentiment, news_stories(id, headline, summary, source, url, published_at, story_type)")
      .eq("player_id", playerId)
      .order("news_stories(published_at)", { ascending: false })
      .limit(20),
    supabaseServer
      .from("player_id_links")
      .select("external_id")
      .eq("person_id", playerId)
      .eq("source", "fbref")
      .limit(1),
  ]);

  const player = playerResult.data as IntelligenceCard | null;
  if (!player) notFound();

  // Fetch FBRef stats if linked
  let fbrefStats: FBRefStat[] = [];
  const fbrefLink = (fbrefLinkResult.data ?? [])[0];
  if (fbrefLink) {
    const { data: statsData } = await supabaseServer
      .from("fbref_player_season_stats")
      .select("comp_name, season, team, minutes, matches_played, starts, goals, assists, xg, npxg, xag, key_passes, progressive_passes, progressive_carries, successful_dribbles, tackles, interceptions, blocks, passes_completed, passes_attempted, pass_pct, shots, shots_on_target, yellow_cards, red_cards")
      .eq("fbref_id", fbrefLink.external_id)
      .order("season", { ascending: false });
    fbrefStats = (statsData ?? []) as FBRefStat[];
  }

  const moments = (momentsResult.data ?? []).map((m: Record<string, unknown>) => ({
    ...m,
    news_story: Array.isArray(m.news_stories) ? m.news_stories[0] ?? null : m.news_stories ?? null,
  })) as KeyMoment[];
  const grades = (gradesResult.data ?? []) as AttributeGrade[];
  const news: NewsStory[] = [];
  for (const t of (newsResult.data ?? []) as Record<string, unknown>[]) {
    const story = t.news_stories as Record<string, unknown> | null;
    if (!story) continue;
    news.push({
      id: story.id as string,
      headline: story.headline as string,
      summary: (story.summary as string | undefined) ?? null,
      source: (story.source as string | undefined) ?? null,
      url: (story.url as string | undefined) ?? null,
      published_at: (story.published_at as string | undefined) ?? null,
      story_type: (t.story_type as string | undefined) ?? (story.story_type as string | undefined) ?? null,
      sentiment: (t.sentiment as string | undefined) ?? null,
      confidence: (t.confidence as number | undefined) ?? null,
    });
  }

  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const pursuitColor = PURSUIT_COLORS[player.pursuit_status ?? ""] ?? "";

  return (
    <div>
      <Link
        href="/players"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-4 inline-block"
      >
        &larr; Back to Players
      </Link>

      {/* Zone A: Identity Bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4 sm:p-5 mb-3 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-sm sm:text-base font-bold text-[var(--text-muted)] shrink-0">
              {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{player.name}</h1>
              <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-secondary)] flex-wrap">
                {player.club && <span>{player.club}</span>}
                {player.nation && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.nation}</span></>}
                {age !== null && <><span className="text-[var(--text-muted)]">&middot;</span><span>{age}y</span></>}
                {player.height_cm && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.height_cm}cm</span></>}
                {player.preferred_foot && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.preferred_foot}</span></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${posColor} text-white`}>
              {player.position ?? "–"}
            </span>
            {player.pursuit_status && (
              <span className={`text-[10px] font-semibold tracking-wide px-2 py-1 rounded ${pursuitColor}`}>
                {player.pursuit_status}
              </span>
            )}
          </div>
        </div>
        {/* Inline ratings + market info */}
        <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-4">
            {[
              { label: "Level", value: player.level },
              { label: "Peak", value: player.peak },
              { label: "Overall", value: player.overall },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)] block">{label}</span>
                <span className="text-lg font-mono font-bold">{value ?? "–"}</span>
              </div>
            ))}
          </div>
          {/* Market info inline */}
          {(player.transfer_fee_eur != null || player.scarcity_score != null) && (
            <div className="ml-auto flex items-center gap-4 text-xs">
              {player.transfer_fee_eur != null && (
                <div>
                  <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)] block">Est. Value</span>
                  <span className="font-mono font-bold">&euro;{(player.transfer_fee_eur / 1_000_000).toFixed(1)}m</span>
                </div>
              )}
              {player.scarcity_score != null && (
                <div>
                  <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)] block">Scarcity</span>
                  <span className="font-mono font-bold">{player.scarcity_score}</span>
                </div>
              )}
              {player.hg && (
                <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--accent-tactical)] border border-[var(--accent-tactical)]/30 px-1.5 py-0.5 rounded">HG</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zone B: Personality + Archetype — compact */}
      <div className="mb-3">
        <PlayerIdentityPanel
          personality={{
            personalityType: player.personality_type,
            ei: player.ei,
            sn: player.sn,
            tf: player.tf,
            jp: player.jp,
            competitiveness: player.competitiveness,
            coachability: player.coachability,
          }}
          archetype={{
            archetype: player.archetype,
            blueprint: player.blueprint,
          }}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-3">
        {/* Left column */}
        <div className="space-y-3">
          {/* Key Moments */}
          <KeyMomentsList moments={moments} />

          {/* Attributes */}
          <CompoundMetrics attributeGrades={grades} profileTier={player.profile_tier ?? undefined} />

          {/* FBRef Stats */}
          {fbrefStats.length > 0 && <PlayerStats stats={fbrefStats} />}
        </div>

        {/* Right column */}
        <div>
          {/* Scout Pad (tabbed) */}
          <ScoutPad
            scoutingNotes={player.scouting_notes}
            squadRole={player.squad_role}
            loanStatus={player.loan_status}
            news={news}
          />
        </div>
      </div>
    </div>
  );
}
