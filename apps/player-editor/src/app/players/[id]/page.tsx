import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { computeAge, PURSUIT_COLORS, POSITION_COLORS } from "@/lib/types";
import { PersonalityBadge } from "@/components/PersonalityBadge";
import { ArchetypeShape } from "@/components/ArchetypeShape";

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

interface KeyMoment {
  id: number;
  title: string;
  description: string | null;
  moment_date: string | null;
  moment_type: string | null;
  sentiment: string | null;
  source_url: string | null;
  news_story: {
    title: string;
    url: string | null;
    summary: string | null;
    published_at: string | null;
  } | null;
}

interface AttributeGrade {
  attribute: string;
  scout_grade: number | null;
  stat_score: number | null;
}

// Group attributes by compound category
const ATTRIBUTE_CATEGORIES: Record<string, string[]> = {
  Mental: ["composure", "concentration", "decision_making", "leadership", "vision", "work_rate", "anticipation", "positioning"],
  Physical: ["acceleration", "agility", "balance", "pace", "stamina", "strength", "jumping"],
  Tactical: ["defensive_awareness", "off_the_ball", "pressing", "tactical_discipline"],
  Technical: ["crossing", "dribbling", "finishing", "first_touch", "heading", "long_shots", "passing", "set_pieces", "tackling", "technique"],
};

const CATEGORY_COLORS: Record<string, string> = {
  Mental: "var(--accent-mental)",
  Physical: "var(--accent-physical)",
  Tactical: "var(--accent-tactical)",
  Technical: "var(--accent-technical)",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "var(--sentiment-positive)",
  negative: "var(--sentiment-negative)",
  neutral: "var(--sentiment-neutral)",
};

function AttributeBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[var(--text-secondary)] w-28 capitalize truncate">
        {label.replace(/_/g, " ")}
      </span>
      <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full opacity-70"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono w-6 text-right text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

  const moments = (momentsResult.data ?? []) as unknown as KeyMoment[];
  const grades = (gradesResult.data ?? []) as AttributeGrade[];

  // Build attribute map for Zone E
  const attrMap = new Map<string, AttributeGrade>();
  for (const g of grades) {
    attrMap.set(g.attribute, g);
  }

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 min-h-[320px]" style={{ background: "linear-gradient(135deg, rgba(232,197,71,0.05) 0%, transparent 60%)" }}>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Personality — WHO</h3>
          <PersonalityBadge
            personalityType={player.personality_type}
            ei={player.ei}
            sn={player.sn}
            tf={player.tf}
            jp={player.jp}
            competitiveness={player.competitiveness}
            coachability={player.coachability}
            size="hero"
          />
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Archetype — HOW</h3>
          <ArchetypeShape
            archetype={player.archetype}
            blueprint={player.blueprint}
            size="full"
          />
        </div>
      </div>

      {/* Zone C: Key Moments */}
      {moments.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Key Moments</h3>
          <div className="space-y-3">
            {moments.map((m) => (
              <div key={m.id} className="flex gap-3 items-start">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: SENTIMENT_COLORS[m.sentiment ?? "neutral"] ?? "var(--text-muted)" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.title}</span>
                    {m.moment_type && (
                      <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
                        {m.moment_type}
                      </span>
                    )}
                  </div>
                  {m.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{m.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {m.moment_date && (
                      <span className="text-[10px] text-[var(--text-muted)]">{formatDate(m.moment_date)}</span>
                    )}
                    {m.news_story && m.news_story.url && (
                      <a
                        href={m.news_story.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--accent-personality)] hover:underline"
                      >
                        Source
                      </a>
                    )}
                    {!m.news_story && m.source_url && (
                      <a
                        href={m.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--accent-personality)] hover:underline"
                      >
                        Source
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Zone E: Attribute Grades */}
      {grades.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Attribute Grades</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(ATTRIBUTE_CATEGORIES).map(([category, attrs]) => {
              const categoryGrades = attrs
                .map((a) => attrMap.get(a))
                .filter((g): g is AttributeGrade => g != null);
              if (categoryGrades.length === 0) return null;
              const color = CATEGORY_COLORS[category] ?? "var(--text-secondary)";
              return (
                <div key={category}>
                  <h4
                    className="text-[10px] font-semibold tracking-widest uppercase mb-2"
                    style={{ color }}
                  >
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {categoryGrades.map((g) => (
                      <AttributeBar
                        key={g.attribute}
                        label={g.attribute}
                        value={g.scout_grade ?? g.stat_score ?? 0}
                        color={color}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
