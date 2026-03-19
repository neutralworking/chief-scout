"use client";

import type { PlayerValuation } from "@/lib/types";

function formatEur(value: number | null | undefined): string {
  if (value == null) return "–";
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}k`;
  if (value <= 0) return "€0";
  return `€${value.toFixed(0)}`;
}

const CONFIDENCE_STYLES: Record<string, { dot: string; label: string }> = {
  high:   { dot: "bg-green-400", label: "High" },
  medium: { dot: "bg-amber-400", label: "Medium" },
  low:    { dot: "bg-red-400",   label: "Low" },
};

import { useState } from "react";

export function ValuationPanel({ valuation }: { valuation: PlayerValuation }) {
  const [expanded, setExpanded] = useState(false);
  const conf = CONFIDENCE_STYLES[valuation.overall_confidence ?? "low"] ?? CONFIDENCE_STYLES.low;
  const p50 = valuation.market_value_p50;
  const p10 = valuation.market_value_p10;
  const p90 = valuation.market_value_p90;

  // Compute band position for the visual bar (P50 within P10-P90)
  const bandMin = p10 ?? 0;
  const bandMax = p90 ?? 0;
  const bandRange = bandMax - bandMin;
  const p50Pct = bandRange > 0 && p50 != null
    ? Math.max(0, Math.min(100, ((p50 - bandMin) / bandRange) * 100))
    : 50;

  return (
    <div className="glass rounded-xl p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-tactical)]">
          Transfer Valuation
        </h3>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
          <span className="text-[9px] text-[var(--text-muted)]">{conf.label} confidence</span>
        </div>
      </div>

      {/* Central value + band */}
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text-primary)]">
          {formatEur(p50)}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
          {formatEur(p10)} – {formatEur(p90)}
        </div>
      </div>

      {/* Value band visual */}
      <div className="relative h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[var(--color-accent-tactical)]/30 via-[var(--color-accent-tactical)]/60 to-[var(--color-accent-tactical)]/30"
          style={{ left: "5%", right: "5%" }}
        />
        <div
          className="absolute top-0 w-2 h-2 rounded-full bg-[var(--color-accent-tactical)] ring-2 ring-[var(--bg-surface)]"
          style={{ left: `calc(${p50Pct}% - 4px)` }}
        />
      </div>
      <div className="flex justify-between text-[8px] text-[var(--text-muted)] -mt-1">
        <span>P10</span>
        <span>P25: {formatEur(valuation.market_value_p25)}</span>
        <span>P75: {formatEur(valuation.market_value_p75)}</span>
        <span>P90</span>
      </div>

      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-1"
      >
        <span>{expanded ? "Hide details" : "Show details"}</span>
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Collapsible detail sections */}
      {expanded && <>

      {/* Use value + contextual fit */}
      {valuation.use_value_central != null && valuation.contextual_fit_score != null && (
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Use Value (Contextual)</span>
            <span className="text-sm font-mono font-bold text-[var(--color-accent-mental)]">
              {formatEur(valuation.use_value_central)}
            </span>
          </div>

          {/* Contextual fit bar */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--text-muted)] w-6 shrink-0">Fit</span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  valuation.contextual_fit_score >= 0.75 ? "bg-green-400" :
                  valuation.contextual_fit_score >= 0.5 ? "bg-amber-400" :
                  "bg-red-400"
                }`}
                style={{ width: `${(valuation.contextual_fit_score ?? 0) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--text-secondary)] w-8 text-right shrink-0">
              {((valuation.contextual_fit_score ?? 0) * 100).toFixed(0)}%
            </span>
          </div>

          {/* Fit breakdown (compact) */}
          {(valuation.system_archetype_fit != null) && (
            <div className="grid grid-cols-5 gap-1 mt-2">
              <FitDot label="Arch" value={valuation.system_archetype_fit} />
              <FitDot label="Thresh" value={valuation.system_threshold_fit} />
              <FitDot label="Pers" value={valuation.system_personality_fit} />
              <FitDot label="Tags" value={valuation.system_tag_compatibility} />
              <FitDot label="Squad" value={valuation.squad_gap_fill} />
            </div>
          )}

          {valuation.target_system && (
            <div className="text-[9px] text-[var(--text-muted)] mt-1.5">
              System: <span className="text-[var(--text-secondary)]">{valuation.target_system.replace(/_/g, " ")}</span>
            </div>
          )}
        </div>
      )}

      {/* Decomposition */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">Value Drivers</span>
        <div className="space-y-1">
          <DecompBar label="Scout Profile" pct={valuation.scout_profile_pct} color="var(--color-accent-personality)" />
          <DecompBar label="Performance" pct={valuation.performance_data_pct} color="var(--color-accent-tactical)" />
          <DecompBar label="Contract / Age" pct={valuation.contract_age_pct} color="var(--color-accent-physical)" />
          <DecompBar label="Market Context" pct={valuation.market_context_pct} color="var(--color-accent-mental)" />
          {(valuation.personality_adj_pct ?? 0) !== 0 && (
            <DecompBar label="Personality" pct={valuation.personality_adj_pct} color="var(--color-accent-technical)" signed />
          )}
          {(valuation.style_fit_adj_pct ?? 0) !== 0 && (
            <DecompBar label="Style Fit" pct={valuation.style_fit_adj_pct} color="var(--color-accent-tactical)" signed />
          )}
        </div>
      </div>

      {/* Flags */}
      {(valuation.disagreement_flag || valuation.low_data_warning || valuation.stale_profile ||
        (valuation.personality_risk_flags && valuation.personality_risk_flags.length > 0)) && (
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1">
          {valuation.disagreement_flag && (
            <div className="text-[9px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Scout-data disagreement: scout {formatEur(valuation.scout_anchored_value)} vs data {formatEur(valuation.data_implied_value)}
            </div>
          )}
          {valuation.low_data_warning && (
            <div className="text-[9px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              Low data coverage — value band is wide
            </div>
          )}
          {valuation.stale_profile && (
            <div className="text-[9px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Stale profile — some attributes need refreshing
            </div>
          )}
          {valuation.personality_risk_flags && valuation.personality_risk_flags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {valuation.personality_risk_flags.map((flag) => (
                <span key={flag} className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  {flag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Narrative */}
      {valuation.narrative && (
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{valuation.narrative}</p>
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between text-[8px] text-[var(--text-muted)] pt-1">
        <span>Model {valuation.model_version ?? "v1.0"} · {valuation.mode?.replace(/_/g, " ") ?? "scout dominant"}</span>
        {valuation.evaluated_at && (
          <span>{new Date(valuation.evaluated_at).toLocaleDateString()}</span>
        )}
      </div>

      </>}
    </div>
  );
}

function FitDot({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = v >= 0.75 ? "bg-green-400" : v >= 0.5 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="text-center">
      <div className={`w-3 h-3 rounded-full mx-auto ${color}`} style={{ opacity: 0.3 + v * 0.7 }} />
      <div className="text-[7px] text-[var(--text-muted)] mt-0.5">{label}</div>
    </div>
  );
}

function DecompBar({ label, pct, color, signed = false }: { label: string; pct: number | null; color: string; signed?: boolean }) {
  const value = pct ?? 0;
  const displayPct = Math.min(Math.abs(value), 100);
  const prefix = signed && value > 0 ? "+" : "";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-[var(--text-muted)] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${displayPct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[9px] font-mono text-[var(--text-secondary)] w-10 text-right shrink-0">
        {prefix}{value.toFixed(0)}%
      </span>
    </div>
  );
}
