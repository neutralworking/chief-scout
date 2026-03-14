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
import { PlayerShortlists } from "@/components/PlayerShortlists";
import { PlayerQuickEdit } from "@/components/PlayerQuickEdit";
import { ValuationPanel } from "@/components/ValuationPanel";
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
  position: string | null;
  level: number | null;
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

const PERSONALITY_NAMES: Record<string, string> = {
  ANLC: "The General", IXSP: "The Genius", ANSC: "The Machine", INLC: "The Captain",
  AXLC: "The Warrior", INSP: "The Maestro", ANLP: "The Conductor", IXSC: "The Maverick",
  AXSC: "The Enforcer", AXSP: "The Technician", AXLP: "The Orchestrator", INLP: "The Guardian",
  INSC: "The Blade", IXLC: "The Livewire", IXLP: "The Playmaker", ANSP: "The Professor",
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

  const [playerResult, momentsResult, newsResult, fbrefLinkResult, careerResult, metricsResult, playerTagsResult, valuationResult] = await Promise.all([
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

  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const personalityName = player.personality_type ? PERSONALITY_NAMES[player.personality_type] : null;
  const hasStatus = !!(player.squad_role || player.loan_status || playerTags.length > 0);
  const fbrefId = fbrefLink?.external_id;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Link
          href="/players"
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors inline-block"
        >
          &larr; Players
        </Link>
        <PlayerQuickEdit player={{
          person_id: player.person_id,
          level: player.level,
          position: player.position,
          archetype: player.archetype,
          blueprint: player.blueprint,
          pursuit_status: player.pursuit_status,
          squad_role: player.squad_role,
          scouting_notes: player.scouting_notes,
        }} />
      </div>

      {/* Identity Bar — name, bio, ratings */}
      <div className="glass rounded-xl p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {player.image_url ? (
              <img src={player.image_url} alt={player.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-xs sm:text-sm font-bold text-[var(--text-muted)] shrink-0">
                {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">{player.name}</h1>
                <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
                  {player.position ?? "–"}
                </span>
                {!player.active && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] shrink-0">Inactive</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-secondary)] flex-wrap">
                {player.club && <span>{player.club}</span>}
                {player.nation && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.nation}</span></>}
                {age !== null && <><span className="text-[var(--text-muted)]">&middot;</span><span title="Age">{age}y</span></>}
                {player.height_cm && <><span className="text-[var(--text-muted)]">&middot;</span><span title="Height">{player.height_cm}cm</span></>}
                {player.preferred_foot && (
                  <><span className="text-[var(--text-muted)]">&middot;</span><span title="Preferred foot">👟 {player.preferred_foot}</span></>
                )}
              </div>
            </div>
          </div>

          {/* Level — headline number */}
          {player.level != null && (
            <div className="text-center shrink-0">
              <div className="text-xl sm:text-2xl font-mono font-bold text-[var(--text-primary)]">{player.level}</div>
              <div className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Level</div>
            </div>
          )}
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

          {/* Engine Valuation (priority) */}
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
              <span className="text-[9px] text-[var(--text-muted)] ml-1">
                ({valuation.market_value_p10 != null && valuation.market_value_p90 != null
                  ? `${valuation.market_value_p10 >= 1_000_000
                      ? `€${(valuation.market_value_p10 / 1_000_000).toFixed(1)}m`
                      : valuation.market_value_p10 >= 1_000
                      ? `€${(valuation.market_value_p10 / 1_000).toFixed(0)}k`
                      : `€${valuation.market_value_p10}`
                    }–${valuation.market_value_p90 >= 1_000_000
                      ? `€${(valuation.market_value_p90 / 1_000_000).toFixed(1)}m`
                      : `€${(valuation.market_value_p90 / 1_000).toFixed(0)}k`
                    }`
                  : "–"})
              </span>
            </div>
          )}

          {/* Market Value (Transfermarkt) — always shown as reference */}
          {player.market_value_eur != null && (
            <div>
              <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Market Value <span className="normal-case opacity-60">(TM)</span></span>
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

        </div>
      </div>

      {/* Scouting Notes — prominent callout */}
      {player.scouting_notes && (
        <div className="glass rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 border-l-2 border-l-[var(--accent-personality)]">
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{player.scouting_notes}</p>
        </div>
      )}

      {/* Status, Tags & External Links */}
      {(hasStatus || player.transfermarkt_id || fbrefId) && (
        <div className="glass rounded-xl px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            {player.squad_role && (
              <span className="text-[10px] text-[var(--text-secondary)]">
                <span className="text-[var(--text-muted)]">Role:</span> {player.squad_role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            )}
            {player.loan_status && (
              <span className="text-[10px] text-[var(--text-secondary)]">
                <span className="text-[var(--text-muted)]">Loan:</span> {player.loan_status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            )}
            {playerTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {playerTags.map((t: { tag_name: string; category: string }, i: number) => (
                  <span
                    key={i}
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${
                      t.category === "scouting" ? "bg-[var(--accent-tactical)]/15 text-[var(--accent-tactical)] border-[var(--accent-tactical)]/25" :
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
            {/* External links */}
            <div className="flex items-center gap-2 ml-auto">
              {player.transfermarkt_id && (
                <a href={`https://www.transfermarkt.com/spieler/profil/spieler/${player.transfermarkt_id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">TM</a>
              )}
              {fbrefId && (
                <a href={`https://fbref.com/en/players/${fbrefId}/`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">FBRef</a>
              )}
              {player.wikidata_id && (
                <a href={`https://www.wikidata.org/wiki/${player.wikidata_id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Wiki</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Left: Valuation + Stats + Radar + Personality */}
        <div className="space-y-2">
          {/* Valuation Panel */}
          {valuation && <ValuationPanel valuation={valuation} />}

          {/* FBRef Stats */}
          {fbrefStats.length > 0 && <PlayerStats stats={fbrefStats} />}

          <PlayerRadar playerId={player.person_id} position={player.position} compact />

          {/* Personality dimensions — compact */}
          {(player.ei != null || player.personality_type) && (
            <div className="glass rounded-xl p-3 sm:p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-personality)] mb-2">Personality</h3>
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
        <div className="space-y-2">
          <CareerAndMoments entries={careerEntries} metrics={careerMetrics} moments={moments} />

          {news.length > 0 && (
            <ScoutPad
              news={news}
            />
          )}

          <PlayerShortlists personId={player.person_id} />
        </div>
      </div>
    </div>
  );
}
