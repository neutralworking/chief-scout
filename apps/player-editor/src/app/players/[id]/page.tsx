import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { computeAge, PURSUIT_COLORS, POSITION_COLORS } from "@/lib/types";
import { PlayerIdentityPanel } from "@/components/PlayerIdentityPanel";
import { CompoundMetrics } from "@/components/CompoundMetrics";
import { KeyMomentsList } from "@/components/KeyMomentsList";
import type { KeyMoment } from "@/components/KeyMomentsList";

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
  const [playerResult, momentsResult, gradesResult] = await Promise.all([
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
  ]);

  const player = playerResult.data as IntelligenceCard | null;
  if (!player) notFound();

  const moments = (momentsResult.data ?? []).map((m: Record<string, unknown>) => ({
    ...m,
    news_story: Array.isArray(m.news_stories) ? m.news_stories[0] ?? null : m.news_stories ?? null,
  })) as KeyMoment[];
  const grades = (gradesResult.data ?? []) as AttributeGrade[];

  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const pursuitColor = PURSUIT_COLORS[player.pursuit_status ?? ""] ?? "";

  return (
    <div className="max-w-4xl">
      <Link
        href="/players"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-6 inline-block"
      >
        &larr; Back to Players
      </Link>

      {/* Zone A: Identity Bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-lg font-bold text-[var(--text-muted)]">
              {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-secondary)]">
                {player.club && <span>{player.club}</span>}
                {player.nation && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.nation}</span></>}
                {age !== null && <><span className="text-[var(--text-muted)]">&middot;</span><span>{age} years</span></>}
                {player.height_cm && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.height_cm}cm</span></>}
                {player.preferred_foot && <><span className="text-[var(--text-muted)]">&middot;</span><span>{player.preferred_foot} foot</span></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${posColor} text-white`}>
              {player.position ?? "–"}
            </span>
            {player.pursuit_status && (
              <span className={`text-[10px] font-semibold tracking-wide px-2 py-1 rounded ${pursuitColor}`}>
                {player.pursuit_status}
              </span>
            )}
            {player.profile_tier === 1 && (
              <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--accent-personality)] border border-[var(--accent-personality)]/30 px-2 py-1 rounded">
                Tier 1
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 max-w-sm">
          <div>
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Level</span>
            <div className="text-2xl font-mono font-bold">{player.level ?? "–"}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Peak</span>
            <div className="text-2xl font-mono font-bold">{player.peak ?? "–"}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Overall</span>
            <div className="text-2xl font-mono font-bold">{player.overall ?? "–"}</div>
          </div>
        </div>
      </div>

      {/* Zone B: Personality + Archetype (hero section) */}
      <div className="mb-4">
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

      {/* Zone C: Key Moments */}
      <KeyMomentsList moments={moments} />

      {/* Zone D: Market Position */}
      {(player.market_value_tier || player.true_mvt) && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Market Position</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {player.market_value_tier && (
              <div><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block">MVT</span><span className="font-mono font-bold">{player.market_value_tier}</span></div>
            )}
            {player.true_mvt && (
              <div><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block">True MVT</span><span className="font-mono font-bold">{player.true_mvt}</span></div>
            )}
            {player.market_premium && (
              <div><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block">Premium</span><span className="font-mono font-bold">{player.market_premium}</span></div>
            )}
            {player.scarcity_score != null && (
              <div><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block">Scarcity</span><span className="font-mono font-bold">{player.scarcity_score}</span></div>
            )}
          </div>
          {(player.transfer_fee_eur != null || player.hg != null) && (
            <div className="mt-3 flex gap-6 text-xs text-[var(--text-secondary)]">
              {player.transfer_fee_eur != null && (
                <div><span className="text-[var(--text-muted)]">Fee: </span><span className="font-mono">&euro;{(player.transfer_fee_eur / 1_000_000).toFixed(1)}m</span></div>
              )}
              {player.hg && (
                <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--accent-tactical)] border border-[var(--accent-tactical)]/30 px-1.5 py-0.5 rounded">HG</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Zone E: Attribute Grades — Progressive Disclosure */}
      <CompoundMetrics attributeGrades={grades} profileTier={player.profile_tier ?? undefined} />

      {/* Zone F: Scouting Notes + Status */}
      {(player.scouting_notes || player.squad_role || player.loan_status) && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Scouting Notes</h3>
          {(player.squad_role || player.loan_status) && (
            <div className="flex gap-4 mb-3 text-xs text-[var(--text-secondary)]">
              {player.squad_role && (
                <div><span className="text-[var(--text-muted)]">Squad Role: </span><span className="font-medium">{player.squad_role}</span></div>
              )}
              {player.loan_status && (
                <div><span className="text-[var(--text-muted)]">Loan: </span><span className="font-medium">{player.loan_status}</span></div>
              )}
            </div>
          )}
          {player.scouting_notes && (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{player.scouting_notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
