"use client";

import { useState } from "react";
import Link from "next/link";
import { computeAge } from "@/lib/types";
import { MiniRadar } from "./MiniRadar";
import { EditableCell } from "./EditableCell";

function nationFlag(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.toUpperCase();
  const GB_FLAGS: Record<string, string> = {
    "GB-ENG": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
    "GB-SCT": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
    "GB-WLS": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F",
  };
  if (GB_FLAGS[c]) return GB_FLAGS[c];
  if (c.length === 2) {
    return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  }
  return "";
}

// ── Gem tier theming (KC-card inspired) ─────────────────────────────────────

const GEM_TIER = {
  gold: {
    border: "border-amber-500/50",
    glow: "shadow-[0_0_16px_rgba(251,191,36,0.25)]",
    bg: "bg-gradient-to-b from-amber-950/60 via-zinc-950/80 to-zinc-950/90",
    accent: "#fbbf24",
    barColor: "bg-amber-400",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  },
  green: {
    border: "border-emerald-500/40",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.2)]",
    bg: "bg-gradient-to-b from-emerald-950/50 via-zinc-950/80 to-zinc-950/90",
    accent: "#10b981",
    barColor: "bg-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  },
  teal: {
    border: "border-teal-500/30",
    glow: "shadow-[0_0_8px_rgba(20,184,166,0.15)]",
    bg: "bg-gradient-to-b from-teal-950/40 via-zinc-950/80 to-zinc-950/90",
    accent: "#14b8a6",
    barColor: "bg-teal-400",
    badge: "bg-teal-500/20 text-teal-400 border-teal-500/40",
  },
};

function getGemTier(score: number) {
  if (score >= 80) return GEM_TIER.gold;
  if (score >= 60) return GEM_TIER.green;
  return GEM_TIER.teal;
}

const POS_TYPE: Record<string, { color: string }> = {
  GK: { color: "bg-yellow-600" }, CD: { color: "bg-sky-700" }, WD: { color: "bg-emerald-600" },
  DM: { color: "bg-teal-600" }, CM: { color: "bg-indigo-600" }, WM: { color: "bg-violet-600" },
  AM: { color: "bg-orange-600" }, WF: { color: "bg-rose-600" }, CF: { color: "bg-red-600" },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface InsightPlayer {
  person_id: number;
  name: string;
  dob: string | null;
  position: string | null;
  club: string | null;
  league_name: string | null;
  nation: string | null;
  nation_code: string | null;
  hg: boolean | null;
  level: number | null;
  overall: number | null;
  best_role: string | null;
  best_role_score: number | null;
  fingerprint: Record<string, number> | null;
  goals: number | null;
  assists: number | null;
  apps: number | null;
  rating: number | null;
}

interface InsightEvidence {
  goals_p90: number;
  assists_p90: number;
  rating: number | null;
  appearances: number;
  avg_percentile: number;
  flags: string[];
  age: number | null;
}

export interface InsightData {
  person_id: number;
  insight_type: string;
  gem_score: number;
  headline: string | null;
  prose: string | null;
  evidence: InsightEvidence;
  player: InsightPlayer;
}

interface InsightCardProps {
  insight: InsightData;
  isAdmin?: boolean;
  isReviewed?: boolean;
  onAccept?: (personId: number) => void;
  onSkip?: (personId: number) => void;
}

export function InsightCard({ insight, isAdmin, isReviewed, onAccept, onSkip }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [localLevel, setLocalLevel] = useState(insight.player.level);
  const [localRoleScore, setLocalRoleScore] = useState(insight.player.best_role_score);
  const [accepting, setAccepting] = useState(false);
  const { player, evidence } = insight;
  const age = player.dob ? computeAge(player.dob) : evidence.age;
  const flags = evidence.flags ?? [];
  const tier = getGemTier(insight.gem_score);
  const pos = POS_TYPE[player.position ?? ""] ?? { color: "bg-zinc-600" };

  // Suggested values
  const suggestedLevel = (!player.level || player.level === 0)
    ? Math.round(55 + (evidence.avg_percentile ?? 0) * 0.25)
    : player.level;
  const suggestedRoleScore = suggestedLevel - 1;

  // Fingerprint for MiniRadar
  const fp = player.fingerprint;
  const radarValues = fp
    ? [fp.DEF ?? 0, fp.CRE ?? 0, fp.ATK ?? 0, fp.PWR ?? 0, fp.PAC ?? 0, fp.DRV ?? 0]
    : null;

  // Stat bars data
  const stats = [
    { label: "G/90", value: evidence.goals_p90, max: 1.0 },
    { label: "A/90", value: evidence.assists_p90, max: 0.8 },
    { label: "Rating", value: evidence.rating ?? 0, max: 10, displayVal: evidence.rating?.toFixed(1) },
  ];

  async function handleAcceptSuggestions() {
    setAccepting(true);
    try {
      const [res1, res2] = await Promise.all([
        fetch("/api/admin/player-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person_id: player.person_id, table: "player_profiles", updates: { level: suggestedLevel } }),
        }),
        fetch("/api/admin/player-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person_id: player.person_id, table: "player_profiles", updates: { best_role_score: suggestedRoleScore } }),
        }),
      ]);
      if (res1.ok && res2.ok) {
        setLocalLevel(suggestedLevel);
        setLocalRoleScore(suggestedRoleScore);
        onAccept?.(player.person_id);
      }
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className={`
      relative overflow-hidden rounded-2xl border ${tier.border} ${tier.glow}
      ${tier.bg} transition-all duration-200
      ${isReviewed ? "opacity-60" : ""}
    `}>
      {/* ── Top bar: Power number + Name + Position ─────────────── */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Gem score — KC power number style */}
        <div
          className={`w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center shrink-0 bg-black/60 border ${tier.border}`}
          style={{ color: tier.accent }}
        >
          {Math.round(insight.gem_score)}
        </div>

        {/* Name + headline + club */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white truncate">{player.name}</span>
            {age != null && <span className="text-[10px] font-mono text-zinc-500">{age}</span>}
            <span className="text-sm">{nationFlag(player.nation_code)}</span>
            {isReviewed && <span className="text-[10px] text-emerald-400">&#10003;</span>}
          </div>
          {insight.headline && (
            <p className="text-[11px] italic text-zinc-400 truncate leading-tight">
              &ldquo;{insight.headline}&rdquo;
            </p>
          )}
          <div className="text-[10px] text-zinc-500 truncate">
            {player.club || "\u2013"} · {player.league_name || ""}
          </div>
        </div>

        {/* Position pill */}
        <div className={`${pos.color} rounded-full px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shrink-0`}>
          {player.position ?? "?"}
        </div>
      </div>

      {/* ── Context pills (always visible) ─────────────────────── */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {flags.includes("homegrown_abroad") && <Pill color="green">HG</Pill>}
          {flags.includes("young_upstep") && <Pill color="blue">U23</Pill>}
          {flags.includes("contract_opportunity") && <Pill color="red">Expiring</Pill>}
          {flags.includes("loan_performer") && <Pill color="amber">On Loan</Pill>}
          {flags.includes("rising_trajectory") && <Pill color="purple">Rising</Pill>}
          {flags.includes("grade_mismatch") && <Pill color="cyan">Undervalued</Pill>}
        </div>
      )}

      {/* ── Expanded detail ────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-white/5">
          {/* Prose — prominent, KC bio style */}
          {insight.prose && (
            <div className="mx-3 mt-2.5 rounded-lg bg-black/30 border border-white/5 px-3 py-2">
              <p className="text-xs text-zinc-300 leading-relaxed italic">
                &ldquo;{insight.prose}&rdquo;
              </p>
            </div>
          )}

          {/* Stat bars + radar row */}
          <div className="flex items-center gap-3 px-3 mt-2.5">
            {/* Stat bars (KC-style) */}
            <div className="flex-1 space-y-1.5">
              {stats.map((s) => {
                const pct = Math.min((s.value / s.max) * 100, 100);
                return (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-10 shrink-0">{s.label}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${tier.barColor} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold w-8 text-right shrink-0" style={{ color: tier.accent }}>
                      {s.displayVal ?? s.value.toFixed(2)}
                    </span>
                  </div>
                );
              })}
              {/* Apps count */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-10 shrink-0">Apps</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${tier.barColor} rounded-full`} style={{ width: `${Math.min((evidence.appearances / 40) * 100, 100)}%` }} />
                </div>
                <span className="text-[10px] font-mono font-bold w-8 text-right shrink-0" style={{ color: tier.accent }}>
                  {evidence.appearances}
                </span>
              </div>
            </div>

            {/* Radar */}
            {radarValues && (
              <div className="shrink-0">
                <MiniRadar values={radarValues} size={80} showLabels labels={["DEF", "CRE", "ATK", "PWR", "PAC", "DRV"]} color={tier.accent} />
              </div>
            )}
          </div>

          {/* ── Admin assessment zone ─────────────────────────── */}
          {isAdmin && (
            <div className="mx-3 mt-2.5 mb-1 rounded-lg bg-black/20 border border-white/5 px-3 py-2">
              <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-1.5">
                Scout Assessment
              </div>
              <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">Level</span>
                  <div className="flex items-center gap-2">
                    <EditableCell value={localLevel} personId={player.person_id} field="level" table="player_profiles" rowIndex={0} min={1} max={99} onSaved={(v) => setLocalLevel(v)} />
                    {(!player.level || player.level === 0) && (
                      <span className="text-[9px] text-zinc-600 font-mono">suggest: {suggestedLevel}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">Role Score</span>
                  <div className="flex items-center gap-2">
                    <EditableCell value={localRoleScore} personId={player.person_id} field="best_role_score" table="player_profiles" rowIndex={1} min={1} max={99} onSaved={(v) => setLocalRoleScore(v)} />
                    {(!player.level || player.level === 0) && (
                      <span className="text-[9px] text-zinc-600 font-mono">suggest: {suggestedRoleScore}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                {(!player.level || player.level === 0) && (
                  <button onClick={handleAcceptSuggestions} disabled={accepting}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50"
                    style={{ borderColor: tier.accent + "40", color: tier.accent, backgroundColor: tier.accent + "15" }}>
                    {accepting ? "Saving..." : "Accept"}
                  </button>
                )}
                <button onClick={() => onSkip?.(player.person_id)}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors">
                  Skip
                </button>
                <Link href={`/players/${player.person_id}`}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg hover:underline ml-auto"
                  style={{ color: tier.accent }}
                  onClick={(e) => e.stopPropagation()}>
                  Profile &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Non-admin profile link */}
          {!isAdmin && (
            <div className="px-3 pb-2.5 mt-1">
              <Link href={`/players/${player.person_id}`}
                className="text-[10px] font-bold hover:underline"
                style={{ color: tier.accent }}
                onClick={(e) => e.stopPropagation()}>
                View Profile &rarr;
              </Link>
            </div>
          )}

          {/* Admin bottom padding */}
          {isAdmin && <div className="h-1.5" />}
        </div>
      )}
    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────────────────────

const PILL_COLORS: Record<string, string> = {
  green: "bg-green-500/15 text-green-400 border-green-500/30",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${PILL_COLORS[color] ?? PILL_COLORS.green}`}>
      {children}
    </span>
  );
}
