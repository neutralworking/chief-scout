import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { getPersonalityFullName } from "@/lib/personality";
import { CareerAndMoments } from "@/components/CareerAndMoments";
import type { KeyMoment, XpMilestone } from "@/components/CareerAndMoments";
import { PlayerNews } from "@/components/PlayerNews";
import type { NewsStory } from "@/components/PlayerNews";
import { PlayerStats } from "@/components/PlayerStats";
import { PlayerTabGroup } from "@/components/PlayerTabGroup";
import { PlayerRadar } from "@/components/PlayerRadar";
import { PlayerShortlists } from "@/components/PlayerShortlists";
import { AddToShortlist } from "@/components/AddToShortlist";
import { PlayerQuickEdit } from "@/components/PlayerQuickEdit";
import { ScoutGradeEditor } from "@/components/ScoutGradeEditor";
import { BackLink } from "@/components/BackLink";
import { ScoutingNotesAdmin } from "@/components/ScoutingNotesAdmin";
import { RoleScoreEditor } from "@/components/RoleScoreEditor";
import { ValuationPanel } from "@/components/ValuationPanel";
import { FourPillarDashboard } from "@/components/FourPillarDashboard";
import { SimilarPlayers } from "@/components/SimilarPlayers";
import { SystemFit } from "@/components/SystemFit";
import { TierGatedSection } from "@/components/TierGatedSection";
import type { PlayerValuation } from "@/lib/types";
import { getArchetypeColor, getArchetypeBadgeClasses } from "@/lib/archetype-styles";
import { ProfileOnboarding } from "@/components/ProfileOnboarding";
import { isProduction } from "@/lib/env";


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
  side: string | null;
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
  earned_archetype: string | null;
  archetype_tier: string | null;
  legacy_tag: string | null;
  behavioral_tag: string | null;
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

// ── SEO: Dynamic metadata + OG image ────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pid = parseInt(id, 10);
  if (!supabaseServer || isNaN(pid)) return {};

  const { data: p } = await supabaseServer
    .from("player_intelligence_card")
    .select("name, position, club, nation, archetype, scouting_notes, overall_pillar_score")
    .eq("person_id", pid)
    .single();

  if (!p) return {};

  const title = `${p.name} — ${p.position ?? "Player"}${p.club ? ` · ${p.club}` : ""} | Chief Scout`;
  const description = p.scouting_notes
    ? p.scouting_notes.slice(0, 160) + (p.scouting_notes.length > 160 ? "..." : "")
    : `${p.name} player intelligence: role-fit scoring, personality profiling, and scouting assessment.`;

  const ogUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/og/player?id=${pid}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "Chief Scout",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${p.name} scouting profile` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
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

  const [playerResult, momentsResult, newsResult, fbrefLinkResult, careerResult, metricsResult, playerTagsResult, valuationResult, xpResult, afStatsResult, playerStatusResult] = await Promise.all([
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
    supabaseServer
      .from("player_status")
      .select("notes_flagged")
      .eq("person_id", playerId)
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
  const xpMilestones = (xpResult.data ?? []) as XpMilestone[];
  const afStats = (afStatsResult.data ?? []) as ApiFootballStat[];
  const notesFlagged = (playerStatusResult.data as { notes_flagged: boolean | null } | null)?.notes_flagged ?? false;

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

  // ── JSON-LD structured data ──────────────────────────────────────────
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: player.name,
    ...(player.dob ? { birthDate: player.dob } : {}),
    ...(player.nation ? { nationality: { "@type": "Country", name: player.nation } } : {}),
    ...(player.height_cm ? { height: { "@type": "QuantitativeValue", value: player.height_cm, unitCode: "CMT" } } : {}),
    ...(player.club ? { memberOf: { "@type": "SportsTeam", name: player.club } } : {}),
    ...(player.scouting_notes ? { description: player.scouting_notes.slice(0, 300) } : {}),
    ...(player.image_url ? { image: player.image_url } : {}),
  };

  return (
    <div className="flex flex-col lg:h-[calc(100vh-4rem)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
        <div className="card-vibrant p-4 sm:p-5 hybrid-transition">
          {/* Row 1: Avatar + Name + Bio details + Role badge */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            {player.image_url ? (
              <img src={player.image_url} alt={player.name} className="w-11 h-11 object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 bg-[var(--bg-elevated)] flex items-center justify-center text-sm font-bold text-[var(--text-muted)] shrink-0">
                {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
            )}

            {/* Name + bio line + scouting notes */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold tracking-tight truncate font-[family-name:var(--font-display)] uppercase">{player.name}</h1>
                <Link href={`/players?position=${player.position ?? ""}`} className={`text-[11px] font-bold tracking-wider px-1.5 py-0.5 ${posColor} text-white shrink-0 hover:brightness-110 transition-all`}>
                  {player.position ?? "–"}{player.side && ["WF", "WD", "WM"].includes(player.position ?? "") ? ` · ${player.side}` : ""}
                </Link>
                {/* TODO: secondary positions when data available */}
                {!player.active && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-muted)] shrink-0">Inactive</span>
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
                <p className="text-[11px] font-data text-[var(--text-muted)] mt-1">
                  <span className="text-[var(--text-secondary)]">{latestAfSeason.season.slice(2)}/{(parseInt(latestAfSeason.season) + 1).toString().slice(2)}:</span>
                  {" "}{latestAfSeason.appearances} apps
                  {(latestAfSeason.goals ?? 0) > 0 && <span className="text-green-400"> · {latestAfSeason.goals}G</span>}
                  {(latestAfSeason.assists ?? 0) > 0 && <span className="text-blue-400"> {latestAfSeason.assists}A</span>}
                  {latestAfSeason.rating != null && <span className="text-amber-400"> · {latestAfSeason.rating.toFixed(1)}★ avg</span>}
                </p>
              )}
              {/* Scouting notes inline — tap to expand, admin can flag for rewrite */}
              {player.scouting_notes && (
                <ScoutingNotesAdmin
                  personId={player.person_id}
                  text={player.scouting_notes}
                  initialFlagged={notesFlagged}
                  clamp={2}
                />
              )}
            </div>

            {/* Role badge — right side (editable for admins) */}
            <div className="shrink-0" data-onboarding="role-score">
              <RoleScoreEditor
                personId={player.person_id}
                bestRole={player.best_role}
                bestRoleScore={player.best_role_score}
                position={player.position}
              />
            </div>
          </div>

          {/* Row 2: Meta chips — archetype, personality, valuation, tags, links */}
          <TierGatedSection required="scout" message="Unlock full scouting profile" detail={`See ${player.name}'s archetype, personality, radar, and detailed assessment.`}>
          <div className="mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-3 gap-y-1">
            {(player.earned_archetype || player.archetype) && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                  {player.earned_archetype ? "Archetype" : "Style"}
                </span>
                {player.earned_archetype ? (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 ${getArchetypeBadgeClasses(player.earned_archetype)}`}>
                    {[player.legacy_tag, player.behavioral_tag, player.earned_archetype].filter(Boolean).join(" ")}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold" style={{ color: getArchetypeColor(player.archetype) }}>
                    {player.archetype}
                  </span>
                )}
              </div>
            )}

            {player.personality_type && (
              <div className="flex items-center gap-1" data-onboarding="personality">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Type</span>
                <span className="text-[11px] font-data font-bold text-[var(--color-accent-personality)]">{player.personality_type}</span>
                {personalityName && (
                  <span className="text-[11px] text-[var(--text-muted)]">{personalityName}</span>
                )}
              </div>
            )}

            {player.legacy_score != null && player.legacy_score > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Legacy</span>
                <span className="text-[11px] font-data font-bold" style={{
                  color: player.legacy_score >= 5000 ? "#f59e0b" : player.legacy_score >= 2500 ? "#a855f7" : player.legacy_score >= 1000 ? "#3b82f6" : "var(--text-secondary)"
                }}>
                  {player.legacy_score.toLocaleString()}
                </span>
              </div>
            )}

            {player.squad_role && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Role</span>
                <span className="text-[11px] text-[var(--text-secondary)]">{player.squad_role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
              </div>
            )}

            {/* Tags inline */}
            {player.loan_status && (
              <span className="text-[11px] font-semibold px-1 py-0.5 border bg-amber-500/15 text-amber-400 border-amber-500/25">
                Loan: {player.loan_status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            )}
            {playerTags.slice(0, 5).map((t: { tag_name: string; category: string }, i: number) => (
              <span
                key={i}
                className={`text-[11px] font-semibold px-1 py-0.5 border ${
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
                <a href={`https://www.transfermarkt.com/spieler/profil/spieler/${player.transfermarkt_id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">TM</a>
              )}
              {fbrefId && (
                <a href={`https://fbref.com/en/players/${fbrefId}/`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">FBRef</a>
              )}
              {player.wikidata_id && (
                <a href={`https://www.wikidata.org/wiki/${player.wikidata_id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Wiki</a>
              )}
            </div>
          </div>
          </TierGatedSection>
        </div>

        {/* Assessment — full width */}
        <TierGatedSection required="scout" message="Unlock player assessment" detail={`See ${player.name}'s four-pillar assessment scores.`}>
        <FourPillarDashboard playerId={player.person_id} storedBestRole={player.best_role} storedBestRoleScore={player.best_role_score} />
        </TierGatedSection>
      </div>

      {/* ── Two-column body — fills remaining viewport, no scroll ── */}
      <TierGatedSection required="scout" message="Unlock full intelligence" detail="Upgrade to Scout to see radar, stats, career history, valuation, and more.">
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left: Radar + System Fit + Tab group (Career / Stats / News) */}
        <div className="flex flex-col gap-2 min-h-0">
          <div data-onboarding="radar">
            <PlayerRadar playerId={player.person_id} position={player.position} compact storedBestRole={player.best_role} />
          </div>

          <ScoutGradeEditor personId={player.person_id} position={player.position} />

          <SystemFit
            clubId={player.club_id}
            archetype={player.earned_archetype ?? player.archetype}
            personalityType={player.personality_type}
            level={player.level}
          />

          <PlayerTabGroup tabs={[
            ...(careerEntries.length > 0 ? [{
              label: "Career",
              content: <CareerAndMoments entries={careerEntries} metrics={careerMetrics} moments={moments} xpMilestones={xpMilestones} hideXp />,
            }] : []),
            ...((fbrefStats.length > 0 || afStats.length > 0) ? [{
              label: "Stats",
              content: <PlayerStats fbrefStats={fbrefStats} afStats={afStats} />,
            }] : []),
            ...(news.length > 0 ? [{
              label: "News",
              content: <PlayerNews news={news} />,
            }] : []),
          ]} />
        </div>

        {/* Right: Valuation + Similar Players + Tab group (Shortlists / Career XP) */}
        <div className="flex flex-col gap-2 min-h-0">
          {valuation && <ValuationPanel valuation={valuation} playerId={player.person_id} />}

          <SimilarPlayers playerId={player.person_id} limit={5} />

          <PlayerTabGroup tabs={[
            ...(xpMilestones.length > 0 ? [{
              label: "Career XP",
              content: <CareerAndMoments entries={[]} metrics={null} moments={moments} xpMilestones={xpMilestones} />,
            }] : []),
            {
              label: "Shortlists",
              content: <PlayerShortlists personId={player.person_id} />,
            },
          ]} />
        </div>
      </div>
      </TierGatedSection>

      {/* First-visit onboarding tooltips — production only */}
      {isProduction() && <ProfileOnboarding />}
    </div>
  );
}
