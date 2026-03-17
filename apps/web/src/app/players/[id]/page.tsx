import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { getPersonalityFullName } from "@/lib/personality";
import { PersonalityBadge } from "@/components/PersonalityBadge";
import { CareerAndMoments } from "@/components/CareerAndMoments";
import type { KeyMoment, XpMilestone } from "@/components/CareerAndMoments";
import { PlayerNews } from "@/components/PlayerNews";
import type { NewsStory } from "@/components/PlayerNews";
import { NewsHeadlines } from "@/components/NewsHeadlines";
import { PlayerStats } from "@/components/PlayerStats";
import { PlayerRadar } from "@/components/PlayerRadar";
import { PlayerShortlists } from "@/components/PlayerShortlists";
import { PlayerQuickEdit } from "@/components/PlayerQuickEdit";
import { ValuationPanel } from "@/components/ValuationPanel";
import { FourPillarDashboard } from "@/components/FourPillarDashboard";
import type { PlayerValuation } from "@/lib/types";

interface IntelligenceCard {
  person_id: number;
  name: string;
  dob: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  active: boolean;
  image_url: string | null;
  wikidata_id: string | null;
  transfermarkt_id: string | null;
  nation: string | null;
  club: string | null;
  club_id: number | null;
  position: string | null;
  level: number | null;
  archetype: string | null;
  model_id: string | null;
  profile_tier: number | null;
  best_role: string | null;
  best_role_score: number | null;
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
  director_valuation_meur: number | null;
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

  const [playerResult, momentsResult, newsResult, fbrefLinkResult, careerResult, metricsResult, playerTagsResult, valuationResult, xpResult] = await Promise.all([
    supabaseServer
      .from("player_intelligence_card")
      .select("*")
      .eq("person_id", playerId)
      .single(),
    supabaseServer
      .from("key_moments")
      .select("id, title, description, moment_date, moment_type, sentiment, source_url")
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
      .select("club_name, club_id, start_date, end_date, is_loan, sort_order, team_type")
      .eq("person_id", playerId)
      .order("sort_order", { ascending: true }),
    supabaseServer
      .from("career_metrics")
      .select("clubs_count, loan_count, career_years, avg_tenure_yrs, loyalty_score, mobility_score, trajectory")
      .eq("person_id", playerId)
      .single(),
    supabaseServer
      .from("player_tags")
      .select("tag_id, tags(tag_name, category)")
      .eq("player_id", playerId),
    supabaseServer
      .from("player_valuations")
      .select("*")
      .eq("person_id", playerId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer
      .from("player_xp")
      .select("milestone_key, milestone_label, xp_value, milestone_date, source, details")
      .eq("person_id", playerId)
      .order("xp_value", { ascending: false }),
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

  const moments = (momentsResult.data ?? []) as KeyMoment[];

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

  const careerEntries = (careerResult.data ?? []) as Array<{ club_name: string; club_id: number | null; start_date: string | null; end_date: string | null; is_loan: boolean; team_type: string | null }>;
  const careerMetrics = metricsResult.data as { clubs_count: number; loan_count: number; career_years: number; avg_tenure_yrs: number; loyalty_score: number; mobility_score: number; trajectory: string | null } | null;

  const playerTags = (playerTagsResult.data ?? []).map((r: Record<string, unknown>) => {
    const tag = r.tags as { tag_name: string; category: string } | null;
    return { tag_name: tag?.tag_name ?? "", category: tag?.category ?? "" };
  }).filter((t: { tag_name: string }) => t.tag_name);

  const valuation = valuationResult.data as PlayerValuation | null;
  const xpMilestones = (xpResult.data ?? []) as XpMilestone[];

  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const personalityName = getPersonalityFullName(player.personality_type);
  const hasStatus = !!(player.squad_role || player.loan_status || playerTags.length > 0);
  const fbrefId = fbrefLink?.external_id;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Link
          href="/players"
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors inline-block"
        >
          &larr; Players
        </Link>
        <PlayerQuickEdit player={{
          person_id: player.person_id,
          best_role: player.best_role,
          best_role_score: player.best_role_score,
          position: player.position,
          archetype: player.archetype,
          blueprint: player.blueprint,
          pursuit_status: player.pursuit_status,
          squad_role: player.squad_role,
          scouting_notes: player.scouting_notes,
        }} />
      </div>

      {/* Identity Bar — name, bio, role badge */}
      <div className="glass rounded-xl p-2.5 sm:p-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {player.image_url ? (
              <img src={player.image_url} alt={player.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-xs sm:text-sm font-bold text-[var(--text-muted)] shrink-0">
                {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">{player.name}</h1>
                <Link href={`/players?position=${player.position ?? ""}`} className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0 hover:brightness-110 transition-all`}>
                  {player.position ?? "–"}
                </Link>
                {!player.active && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] shrink-0">Inactive</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-secondary)] flex-wrap">
                {player.club && (
                  player.club_id
                    ? <Link href={`/clubs/${player.club_id}`} className="hover:text-[var(--text-primary)] transition-colors">{player.club}</Link>
                    : <span>{player.club}</span>
                )}
                {player.nation && (
                  <><span className="text-[var(--text-muted)]">&middot;</span><Link href={`/clubs?country=${encodeURIComponent(player.nation)}`} className="hover:text-[var(--text-primary)] transition-colors">{player.nation}</Link></>
                )}
                {age !== null && <><span className="text-[var(--text-muted)]">&middot;</span><span title="Age">{age}y</span></>}
                {player.height_cm && <><span className="text-[var(--text-muted)]">&middot;</span><span title="Height">{player.height_cm}cm</span></>}
                {player.preferred_foot && (
                  <><span className="text-[var(--text-muted)]">&middot;</span><span title="Preferred foot">{player.preferred_foot}</span></>
                )}
              </div>
            </div>
          </div>

          {/* Role badge — name prominent, score secondary */}
          {player.best_role && (
            <div className="shrink-0 flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg border border-[var(--color-accent-tactical)]/30 bg-[var(--color-accent-tactical)]/10">
                <span className="text-sm font-bold text-[var(--color-accent-tactical)]">{player.best_role}</span>
                {player.best_role_score != null && (
                  <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] ml-1.5">{player.best_role_score}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Archetype + Personality + Market + Status — inline row */}
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {player.archetype && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Style</span>
              <span className="text-sm font-semibold text-[var(--color-accent-tactical)]">{player.archetype}</span>
              {player.blueprint && (
                <span className="text-[10px] text-[var(--text-muted)] ml-1">{player.blueprint}</span>
              )}
            </div>
          )}

          {player.personality_type && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Personality</span>
              <span className="text-sm font-mono font-bold text-[var(--color-accent-personality)]">{player.personality_type}</span>
              {personalityName && (
                <span className="text-[10px] text-[var(--text-secondary)] ml-1">{personalityName}</span>
              )}
            </div>
          )}

          {valuation?.market_value_p50 != null && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">
                Valuation
                <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${
                  valuation.overall_confidence === "high" ? "bg-green-400" :
                  valuation.overall_confidence === "medium" ? "bg-amber-400" :
                  "bg-red-400"
                }`} />
              </span>
              <span className="text-sm font-mono font-bold text-[var(--color-accent-tactical)]">
                &euro;{valuation.market_value_p50 >= 1_000_000
                  ? `${(valuation.market_value_p50 / 1_000_000).toFixed(1)}m`
                  : valuation.market_value_p50 >= 1_000
                  ? `${(valuation.market_value_p50 / 1_000).toFixed(0)}k`
                  : `${valuation.market_value_p50}`}
              </span>
            </div>
          )}

          {player.market_value_eur != null && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">TM Value</span>
              <span className="text-sm font-mono font-bold text-[var(--color-accent-tactical)]">
                &euro;{player.market_value_eur >= 1_000_000
                  ? `${(player.market_value_eur / 1_000_000).toFixed(1)}m`
                  : `${(player.market_value_eur / 1_000).toFixed(0)}k`}
              </span>
            </div>
          )}

          {/* Inline status + external links when few items */}
          {player.squad_role && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Squad Role</span>
              <span className="text-[11px] text-[var(--text-secondary)]">{player.squad_role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
            </div>
          )}

          {/* External links */}
          <div className="flex items-center gap-2 ml-auto">
            {player.transfermarkt_id && (
              <a href={`https://www.transfermarkt.com/spieler/profil/spieler/${player.transfermarkt_id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-0.5">TM<svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>
            )}
            {fbrefId && (
              <a href={`https://fbref.com/en/players/${fbrefId}/`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-0.5">FBRef<svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>
            )}
            {player.wikidata_id && (
              <a href={`https://www.wikidata.org/wiki/${player.wikidata_id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-0.5">Wiki<svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>
            )}
          </div>
        </div>
      </div>

      {/* News Headlines — compact row */}
      {news.length > 0 && <NewsHeadlines news={news} />}

      {/* Scouting Notes — prominent callout */}
      {player.scouting_notes && (
        <div className="glass rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5 border-l-2 border-l-[var(--color-accent-personality)]">
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{player.scouting_notes}</p>
        </div>
      )}

      {/* Tags */}
      {playerTags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-0.5">
          {player.loan_status && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border bg-amber-500/15 text-amber-400 border-amber-500/25">
              Loan: {player.loan_status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </span>
          )}
          {playerTags.map((t: { tag_name: string; category: string }, i: number) => (
            <span
              key={i}
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${
                t.category === "scouting" ? "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)] border-[var(--color-accent-tactical)]/25" :
                t.category === "style" ? "bg-purple-500/15 text-purple-400 border-purple-500/25" :
                t.category === "fitness" ? "bg-green-500/15 text-green-400 border-green-500/25" :
                t.category === "mental" ? "bg-blue-500/15 text-blue-400 border-blue-500/25" :
                t.category === "contract" ? "bg-red-500/15 text-red-400 border-red-500/25" :
                "bg-gray-500/15 text-gray-400 border-gray-500/25"
              }`}
            >
              {t.tag_name}
            </span>
          ))}
        </div>
      )}

      {/* Assessment */}
      <FourPillarDashboard playerId={player.person_id} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
        {/* Left: Valuation + Stats + Radar + Personality */}
        <div className="space-y-1.5">
          {valuation && <ValuationPanel valuation={valuation} />}

          {fbrefStats.length > 0 && <PlayerStats stats={fbrefStats} />}

          <PlayerRadar playerId={player.person_id} position={player.position} compact />

          {/* Personality */}
          {(player.ei != null || player.personality_type) && (
            <div className="glass rounded-xl p-2.5 sm:p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-personality)] mb-2">Personality</h3>
              <PersonalityBadge
                personalityType={player.personality_type}
                ei={player.ei}
                sn={player.sn}
                tf={player.tf}
                jp={player.jp}
                competitiveness={player.competitiveness}
                coachability={player.coachability}
                size="hero"
                showDimensions={player.ei != null}
              />
            </div>
          )}
        </div>

        {/* Right: Career & Moments + News */}
        <div className="space-y-1.5">
          <CareerAndMoments entries={careerEntries} metrics={careerMetrics} moments={moments} xpMilestones={xpMilestones} />

          {news.length > 0 && <PlayerNews news={news} />}

          <PlayerShortlists personId={player.person_id} />
        </div>
      </div>
    </div>
  );
}
