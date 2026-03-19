"use client";

import { useState } from "react";
import Link from "next/link";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { MiniRadar } from "./MiniRadar";

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

function gemBadgeColor(score: number): string {
  if (score >= 80) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (score >= 60) return "bg-green-500/20 text-green-400 border-green-500/30";
  return "bg-teal-500/20 text-teal-400 border-teal-500/30";
}

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

export function InsightCard({ insight }: { insight: InsightData }) {
  const [expanded, setExpanded] = useState(false);
  const { player, evidence } = insight;
  const age = player.dob ? computeAge(player.dob) : evidence.age;
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const flags = evidence.flags ?? [];

  // Parse fingerprint for MiniRadar
  const fp = player.fingerprint;
  const radarValues = fp
    ? [fp.DEF ?? 0, fp.CRE ?? 0, fp.ATK ?? 0, fp.PWR ?? 0, fp.PAC ?? 0, fp.DRV ?? 0]
    : null;

  return (
    <div
      className="glass rounded-xl overflow-hidden transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed header */}
      <div className="px-3 py-2.5 cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
              {player.position ?? "–"}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {player.name}
                </span>
                {age != null && (
                  <span className="text-xs font-mono text-[var(--text-muted)]">{age}</span>
                )}
                <span className="text-sm">{nationFlag(player.nation_code)}</span>
              </div>
              {insight.headline && (
                <p className="text-xs italic text-[var(--color-accent-personality)] truncate leading-tight mt-0.5">
                  {insight.headline}
                </p>
              )}
            </div>
          </div>
          <span
            className={`text-xs font-bold font-mono px-2 py-0.5 rounded border shrink-0 ${gemBadgeColor(insight.gem_score)}`}
          >
            {Math.round(insight.gem_score)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 pl-7">
          <span className="text-[10px] text-[var(--text-muted)] truncate">
            {player.club || "–"} · {player.league_name || ""}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-[var(--border-subtle)]/30 pt-2 space-y-2.5">
          {/* Prose */}
          {insight.prose && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {insight.prose}
            </p>
          )}

          {/* Stat boxes + radar */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-1">
              <StatBox label="G/90" value={evidence.goals_p90?.toFixed(2) ?? "–"} />
              <StatBox label="A/90" value={evidence.assists_p90?.toFixed(2) ?? "–"} />
              <StatBox label="Rating" value={evidence.rating?.toFixed(1) ?? "–"} />
              <StatBox label="Apps" value={String(evidence.appearances ?? "–")} />
            </div>
            {radarValues && (
              <div className="shrink-0">
                <MiniRadar values={radarValues} size={80} showLabels labels={["DEF", "CRE", "ATK", "PWR", "PAC", "DRV"]} />
              </div>
            )}
          </div>

          {/* Context pills */}
          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {flags.includes("homegrown_abroad") && <Pill color="green">HG</Pill>}
              {flags.includes("young_upstep") && <Pill color="blue">U23</Pill>}
              {flags.includes("contract_opportunity") && <Pill color="red">Free Agent</Pill>}
              {flags.includes("loan_performer") && <Pill color="amber">On Loan</Pill>}
              {flags.includes("rising_trajectory") && <Pill color="purple">Rising</Pill>}
              {flags.includes("grade_mismatch") && <Pill color="cyan">Undervalued</Pill>}
            </div>
          )}

          {/* View Profile link */}
          <Link
            href={`/players/${player.person_id}`}
            className="text-xs text-[var(--color-accent-tactical)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View Profile →
          </Link>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-2 py-1 rounded bg-[var(--bg-elevated)] flex-1">
      <span className="text-[7px] text-[var(--text-muted)] block leading-none mb-0.5">{label}</span>
      <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

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
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PILL_COLORS[color] ?? PILL_COLORS.green}`}>
      {children}
    </span>
  );
}
