import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { PersonalityBadge } from "@/components/PersonalityBadge";
import { CareerAndMoments } from "@/components/CareerAndMoments";
import type { KeyMoment } from "@/components/CareerAndMoments";
import { ScoutPad } from "@/components/ScoutPad";
import type { NewsStory } from "@/components/ScoutPad";
import { PlayerStats } from "@/components/PlayerStats";
import { PlayerRadar } from "@/components/PlayerRadar";

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
  market_value_eur: number | null;
  highest_market_value_eur: number | null;
  market_value_date: string | null;
  ei: number | null;
  sn: number | null;
  tf: number | null;
  jp: number | null;
  competitiveness: number | null;
  coachability: number | null;
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

const PERSONALITY_NAMES: Record<string, string> = {
  ANLC: "The General", IXSP: "The Genius", ANSC: "The Machine", INLC: "The Captain",
  AXLC: "The Showman", INSP: "The Maestro", ANLP: "The Conductor", IXSC: "The Maverick",
  AXSC: "The Enforcer", AXSP: "The Technician", AXLP: "The Orchestrator", INLP: "The Guardian",
  INSC: "The Hunter", IXLC: "The Provocateur", IXLP: "The Playmaker", ANSP: "The Professor",
};

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

  const [playerResult, momentsResult, newsResult, fbrefLinkResult, careerResult, metricsResult] = await Promise.all([
    supabaseServer
      .from("player_intelligence_card")
      .select("*")
      .eq("person_id", playerId)
      .single(),
    supabaseServer
      .from("key_moments")
      .select("id, title, description, moment_date, moment_type, sentiment, source_url, news_stories(headline, url, summary, published_at)")
      .eq("person_id", playerId)
      .order("moment_date", { ascending: true }),
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
    supabaseServer
      .from("player_career_history")
      .select("club_name, club_id, start_date, end_date, is_loan, sort_order")
      .eq("person_id", playerId)
      .order("sort_order", { ascending: true }),
    supabaseServer
      .from("career_metrics")
      .select("clubs_count, loan_count, career_years, avg_tenure_yrs, loyalty_score, mobility_score, trajectory")
      .eq("person_id", playerId)
      .single(),
  ]);

  const player = playerResult.data as IntelligenceCard | null;
  if (!player) notFound();

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

  const careerEntries = (careerResult.data ?? []) as Array<{ club_name: string; club_id: number | null; start_date: string | null; end_date: string | null; is_loan: boolean }>;
  const careerMetrics = metricsResult.data as { clubs_count: number; loan_count: number; career_years: number; avg_tenure_yrs: number; loyalty_score: number; mobility_score: number; trajectory: string | null } | null;

  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const personalityName = player.personality_type ? PERSONALITY_NAMES[player.personality_type] : null;
  const hasNotes = !!(player.scouting_notes || player.squad_role || player.loan_status);

  return (
    <div className="space-y-2">
      <Link
        href="/players"
        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors inline-block"
      >
        &larr; Players
      </Link>

      {/* Identity Bar — name, bio, archetype, personality, market */}
      <div className="glass rounded-xl p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-xs sm:text-sm font-bold text-[var(--text-muted)] shrink-0">
              {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">{player.name}</h1>
                <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
                  {player.position ?? "–"}
                </span>
                {player.pursuit_status && (
                  <span className="text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] shrink-0">
                    {player.pursuit_status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-secondary)] flex-wrap">
                {player.club && <span>{player.club}</span>}
                {player.nation && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.nation}</span></>}
                {age !== null && <><span className="text-[var(--text-muted)]">&middot;</span><span>{age}y</span></>}
                {player.height_cm && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.height_cm}cm</span></>}
                {player.preferred_foot && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.preferred_foot}</span></>}
                {player.hg && <><span className="text-[var(--text-muted)]">&middot;</span><span className="text-[var(--accent-tactical)] font-bold">HG</span></>}
              </div>
            </div>
          </div>
        </div>

        {/* Archetype + Personality + Market — inline row */}
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* Playing Style (Archetype) */}
          {player.archetype && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Playing Style</span>
              <span className="text-sm font-semibold text-[var(--accent-tactical)]">{player.archetype}</span>
              {player.blueprint && (
                <span className="text-[10px] text-[var(--text-muted)] ml-1.5">{player.blueprint}</span>
              )}
            </div>
          )}

          {/* Personality */}
          {player.personality_type && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Personality</span>
              <span className="text-sm font-mono font-bold text-[var(--accent-personality)]">{player.personality_type}</span>
              {personalityName && (
                <span className="text-[10px] text-[var(--text-secondary)] ml-1.5">{personalityName}</span>
              )}
            </div>
          )}

          {/* Market Value */}
          {player.market_value_eur != null && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Market Value</span>
              <span className="text-sm font-mono font-bold text-[var(--accent-tactical)]">
                &euro;{player.market_value_eur >= 1_000_000
                  ? `${(player.market_value_eur / 1_000_000).toFixed(1)}m`
                  : `${(player.market_value_eur / 1_000).toFixed(0)}k`}
              </span>
            </div>
          )}

          {/* Peak Value */}
          {player.highest_market_value_eur != null && player.highest_market_value_eur !== player.market_value_eur && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Peak Value</span>
              <span className="text-sm font-mono font-bold">
                &euro;{player.highest_market_value_eur >= 1_000_000
                  ? `${(player.highest_market_value_eur / 1_000_000).toFixed(1)}m`
                  : `${(player.highest_market_value_eur / 1_000).toFixed(0)}k`}
              </span>
            </div>
          )}

          {/* Transfer Fee */}
          {player.transfer_fee_eur != null && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Transfer Fee</span>
              <span className="text-sm font-mono font-bold">&euro;{(player.transfer_fee_eur / 1_000_000).toFixed(1)}m</span>
            </div>
          )}
        </div>
      </div>

      {/* Scouting Notes — only if present, compact inline */}
      {hasNotes && (
        <div className="glass rounded-xl px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-start gap-3">
            {(player.squad_role || player.loan_status) && (
              <div className="flex gap-3 text-[10px] text-[var(--text-secondary)] shrink-0">
                {player.squad_role && <span><span className="text-[var(--text-muted)]">Role:</span> {player.squad_role.replace(/_/g, " ")}</span>}
                {player.loan_status && <span><span className="text-[var(--text-muted)]">Loan:</span> {player.loan_status.replace(/_/g, " ")}</span>}
              </div>
            )}
            {player.scouting_notes && (
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2 flex-1">{player.scouting_notes}</p>
            )}
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Left: Radar + Personality */}
        <div className="space-y-2">
          <PlayerRadar playerId={player.person_id} position={player.position} compact />

          {/* Personality dimensions — compact */}
          {player.ei != null && (
            <div className="glass rounded-xl p-3 sm:p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-personality)] mb-2">Personality Dimensions</h3>
              <PersonalityBadge
                personalityType={player.personality_type}
                ei={player.ei}
                sn={player.sn}
                tf={player.tf}
                jp={player.jp}
                competitiveness={player.competitiveness}
                coachability={player.coachability}
                size="hero"
                showDescription={false}
              />
            </div>
          )}
        </div>

        {/* Right: Career & Moments + News */}
        <div className="space-y-2">
          <CareerAndMoments entries={careerEntries} metrics={careerMetrics} moments={moments} />

          {news.length > 0 && (
            <ScoutPad
              scoutingNotes={null}
              squadRole={null}
              loanStatus={null}
              news={news}
            />
          )}
        </div>
      </div>

      {/* FBRef Stats — full width below fold */}
      {fbrefStats.length > 0 && <PlayerStats stats={fbrefStats} />}
    </div>
  );
}
