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
import { AddToShortlist } from "@/components/AddToShortlist";
import { PlayerQuickEdit } from "@/components/PlayerQuickEdit";
import { BackLink } from "@/components/BackLink";
import { ScoutingNotes } from "@/components/ScoutingNotes";
import { RoleScoreEditor } from "@/components/RoleScoreEditor";
import { ValuationPanel } from "@/components/ValuationPanel";
import { FourPillarDashboard } from "@/components/FourPillarDashboard";
import { SimilarPlayers } from "@/components/SimilarPlayers";
import type { PlayerValuation } from "@/lib/types";

function nationFlag(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.toUpperCase();
  const GB: Record<string, string> = {
    "GB-ENG": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
    "GB-SCT": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
    "GB-WLS": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F",
  };
  if (GB[c]) return GB[c];
  if (c.length === 2) return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  return "";
}

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
  nation_code: string | null;
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
  xp_level: number | null;
  legacy_score: number | null;
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

interface ApiFootballStat {
  season: string;
  league_name: string | null;
  team_name: string | null;
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
  shots_total: number | null;
  shots_on: number | null;
  passes_accuracy: number | null;
  tackles_total: number | null;
  interceptions: number | null;
  blocks: number | null;
  duels_total: number | null;
  duels_won: number | null;
  dribbles_attempted: number | null;
  dribbles_success: number | null;
  fouls_drawn: number | null;
  fouls_committed: number | null;
  cards_yellow: number | null;
  cards_red: number | null;
}

function formatVal(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v}`;
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

  const [playerResult, momentsResult, newsResult, fbrefLinkResult, careerResult, metricsResult, playerTagsResult, valuationResult, xpResult, afStatsResult] = await Promise.all([
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
      .select("milestone_key, milestone_label, xp_value, milestone_date, source, details, category, rarity, season")
      .eq("person_id", playerId)
      .order("xp_value", { ascending: false }),
    supabaseServer
      .from("api_football_player_stats")
      .select("season, league_name, team_name, appearances, minutes, goals, assists, rating, shots_total, shots_on, passes_accuracy, tackles_total, interceptions, blocks, duels_total, duels_won, dribbles_attempted, dribbles_success, fouls_drawn, fouls_committed, cards_yellow, cards_red")
      .eq("person_id", playerId)
      .order("season", { ascending: false }),
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
  const afStats = (afStatsResult.data ?? []) as ApiFootballStat[];

  // Build season summary from API-Football (latest season)
  const latestAfSeason = afStats.length > 0 ? afStats.reduce((best, row) => {
    const apps = (row.appearances ?? 0) + (best.appearances ?? 0);
    const goals = (row.goals ?? 0) + (best.goals ?? 0);
    const assists = (row.assists ?? 0) + (best.assists ?? 0);
    const rating = row.rating ?? best.rating;
    return { season: best.season, appearances: apps, goals, assists, rating };
  }, { season: afStats[0].season, appearances: 0, goals: 0, assists: 0, rating: afStats[0].rating }) : null;

  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const personalityName = getPersonalityFullName(player.personality_type);
  const fbrefId = fbrefLink?.external_id;

  return (
    <div className="flex flex-col lg:h-[calc(100vh-4rem)]">
      {/* ── Header: Identity + Bio + Assessment ─────────────────────────── */}
      <div className="shrink-0 space-y-1 mb-1">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <BackLink fallback="/players" label="Players" />
          <div className="flex items-center gap-2">
            <AddToShortlist personId={player.person_id} />
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
        </div>

        {/* Identity bar — everything in one panel */}
        <div className="glass rounded-xl p-2.5">
          {/* Row 1: Avatar + Name + Bio details + Role badge */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            {player.image_url ? (
              <img src={player.image_url} alt={player.name} className="w-11 h-11 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-sm font-bold text-[var(--text-muted)] shrink-0">
                {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
            )}

            {/* Name + bio line + scouting notes */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold tracking-tight truncate">{player.name}</h1>
                <Link href={`/players?position=${player.position ?? ""}`} className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0 hover:brightness-110 transition-all`}>
                  {player.position ?? "–"}
                </Link>
                {!player.active && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] shrink-0">Inactive</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] flex-wrap">
                {player.club && (
                  player.club_id
                    ? <Link href={`/clubs/${player.club_id}`} className="hover:text-[var(--text-primary)] transition-colors">{player.club}</Link>
                    : <span>{player.club}</span>
                )}
                {player.nation && (
                  <><span className="text-[var(--text-muted)]">&middot;</span><Link href={`/clubs?country=${encodeURIComponent(player.nation)}`} className="hover:text-[var(--text-primary)] transition-colors">{nationFlag(player.nation_code)} {player.nation}</Link></>
                )}
                {age !== null && <><span className="text-[var(--text-muted)]">&middot;</span><span>{age}y</span></>}
                {player.height_cm && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.height_cm}cm</span></>}
                {player.preferred_foot && (
                  <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.preferred_foot}</span></>
                )}
              </div>
              {/* Season stats summary */}
              {latestAfSeason && (latestAfSeason.appearances ?? 0) > 0 && (
                <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                  <span className="text-[var(--text-secondary)]">{latestAfSeason.season.slice(2)}/{(parseInt(latestAfSeason.season) + 1).toString().slice(2)}:</span>
                  {" "}{latestAfSeason.appearances} apps
                  {(latestAfSeason.goals ?? 0) > 0 && <span className="text-green-400"> · {latestAfSeason.goals}G</span>}
                  {(latestAfSeason.assists ?? 0) > 0 && <span className="text-blue-400"> {latestAfSeason.assists}A</span>}
                  {latestAfSeason.rating != null && <span className="text-amber-400"> · {latestAfSeason.rating.toFixed(1)}★ avg</span>}
                </p>
              )}
              {/* Scouting notes inline — tap to expand */}
              {player.scouting_notes && (
                <ScoutingNotes text={player.scouting_notes} clamp={2} />
              )}
            </div>

            {/* Role badge — right side (editable for admins) */}
            <div className="shrink-0">
              <RoleScoreEditor
                personId={player.person_id}
                bestRole={player.best_role}
                bestRoleScore={player.best_role_score}
                position={player.position}
              />
            </div>
          </div>

          {/* Row 2: Meta chips — archetype, personality, valuation, tags, links */}
          <div className="mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-3 gap-y-1">
            {player.archetype && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Style</span>
                <span className="text-[11px] font-semibold text-[var(--color-accent-tactical)]">{player.archetype}</span>
              </div>
            )}

            {player.personality_type && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Type</span>
                <span className="text-[11px] font-mono font-bold text-[var(--color-accent-personality)]">{player.personality_type}</span>
                {personalityName && (
                  <span className="text-[10px] text-[var(--text-muted)]">{personalityName}</span>
                )}
              </div>
            )}

            {valuation?.market_value_p50 != null && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Val</span>
                <span className="text-[11px] font-mono font-bold text-[var(--color-accent-tactical)]">
                  {formatVal(valuation.market_value_p50)}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  valuation.overall_confidence === "high" ? "bg-green-400" :
                  valuation.overall_confidence === "medium" ? "bg-amber-400" :
                  "bg-red-400"
                }`} />
              </div>
            )}

            {player.market_value_eur != null && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">TM</span>
                <span className="text-[11px] font-mono font-bold text-[var(--text-secondary)]">
                  {formatVal(player.market_value_eur)}
                </span>
              </div>
            )}

            {player.legacy_score != null && player.legacy_score > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Legacy</span>
                <span className="text-[11px] font-mono font-bold" style={{
                  color: player.legacy_score >= 5000 ? "#f59e0b" : player.legacy_score >= 2500 ? "#a855f7" : player.legacy_score >= 1000 ? "#3b82f6" : "var(--text-secondary)"
                }}>
                  {player.legacy_score.toLocaleString()}
                </span>
              </div>
            )}

            {player.squad_role && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Role</span>
                <span className="text-[10px] text-[var(--text-secondary)]">{player.squad_role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
              </div>
            )}

            {/* Tags inline */}
            {player.loan_status && (
              <span className="text-[8px] font-semibold px-1 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/25">
                Loan: {player.loan_status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            )}
            {playerTags.slice(0, 5).map((t: { tag_name: string; category: string }, i: number) => (
              <span
                key={i}
                className={`text-[8px] font-semibold px-1 py-0.5 rounded border ${
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

            {/* External links — pushed right */}
            <div className="flex items-center gap-1.5 ml-auto">
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

        {/* News headlines — slim strip */}
        {news.length > 0 && <NewsHeadlines news={news} />}

        {/* Assessment — full width */}
        <FourPillarDashboard playerId={player.person_id} storedBestRole={player.best_role} storedBestRoleScore={player.best_role_score} />
      </div>

      {/* ── Two-column body — fills remaining viewport, each col scrolls ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-1">
        {/* Left: Radar + Personality + Stats */}
        <div className="lg:overflow-y-auto space-y-1 pr-0.5">
          <PlayerRadar playerId={player.person_id} position={player.position} compact />

          {(player.ei != null || player.personality_type) && (
            <div className="glass rounded-xl p-2.5">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-personality)] mb-1.5">Personality</h3>
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

          {(fbrefStats.length > 0 || afStats.length > 0) && (
            <PlayerStats fbrefStats={fbrefStats} afStats={afStats} />
          )}
        </div>

        {/* Right: Valuation + Career + Similar + News + Shortlists */}
        <div className="lg:overflow-y-auto space-y-1 pl-0.5">
          {valuation && <ValuationPanel valuation={valuation} />}

          <CareerAndMoments entries={careerEntries} metrics={careerMetrics} moments={moments} xpMilestones={xpMilestones} />

          <SimilarPlayers playerId={player.person_id} />

          {news.length > 0 && <PlayerNews news={news} />}

          <PlayerShortlists personId={player.person_id} />
        </div>
      </div>
    </div>
  );
}
