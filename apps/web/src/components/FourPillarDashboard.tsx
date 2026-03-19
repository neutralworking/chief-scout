"use client";

import { useEffect, useState } from "react";
import type { FullAssessment } from "@/lib/assessment/four-pillars";

interface FourPillarDashboardProps {
  playerId: number;
  compact?: boolean;
}

const PILLAR_CONFIG = [
  { key: "technical" as const, label: "Technical", color: "var(--color-accent-technical)", shortLabel: "How good?" },
  { key: "tactical" as const, label: "Tactical", color: "var(--color-accent-tactical)", shortLabel: "System fit?" },
  { key: "mental" as const, label: "Mental", color: "var(--color-accent-mental)", shortLabel: "Psychology?" },
  { key: "physical" as const, label: "Physical", color: "var(--color-accent-physical)", shortLabel: "Available?" },
];

const PERSONALITY_NAMES: Record<string, string> = {
  ANLC: "General", IXSP: "Spark", ANSC: "Machine", INLC: "Captain",
  AXLC: "Catalyst", INSP: "Maestro", ANLP: "Conductor", IXSC: "Maverick",
  AXSC: "Enforcer", AXSP: "Technician", AXLP: "Orchestrator", INLP: "Guardian",
  INSC: "Mamba", IXLC: "Livewire", IXLP: "Playmaker", ANSP: "Professor",
};

function PillarBar({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function FourPillarDashboard({ playerId, compact = false }: FourPillarDashboardProps) {
  const [data, setData] = useState<FullAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/players/${playerId}/assessment`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } catch { /* silently fail */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [playerId]);

  if (loading) {
    return (
      <div className="glass rounded-xl p-3">
        <div className="h-16 flex items-center justify-center">
          <p className="text-[10px] text-[var(--text-muted)]">Computing assessment...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { pillars, technical, tactical, mental, physical, commercial } = data;

  if (compact) {
    return <CompactPillars pillars={pillars} />;
  }

  return (
    <div className="glass rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Assessment
        </h3>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-lg font-mono font-bold text-[var(--text-primary)]">{pillars.overall}</span>
            <span className="block text-[7px] uppercase tracking-widest text-[var(--text-muted)] -mt-0.5">Overall</span>
          </div>
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold ${
            pillars.confidence === "high" ? "bg-green-500/20 text-green-400" :
            pillars.confidence === "medium" ? "bg-amber-500/20 text-amber-400" :
            "bg-red-500/20 text-red-400"
          }`}>
            {pillars.confidence}
          </span>
        </div>
      </div>

      {/* Pillar grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PILLAR_CONFIG.map(({ key, label, color }) => {
          const score = pillars[key];
          const isExpanded = expanded === key;

          return (
            <button
              key={key}
              onClick={() => setExpanded(isExpanded ? null : key)}
              className={`text-left p-2.5 rounded-lg border transition-colors ${
                isExpanded
                  ? "border-current bg-[var(--bg-elevated)]"
                  : "border-[var(--border-subtle)] hover:border-[var(--border-subtle)]/80 hover:bg-[var(--bg-elevated)]/30"
              }`}
              style={isExpanded ? { borderColor: color } : undefined}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
                <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{score}</span>
              </div>
              <PillarBar value={score} color={color} />
              <p className="text-[8px] text-[var(--text-muted)] mt-1">
                {key === "technical" && (technical.sources.length > 0 ? technical.sources.join(", ") : "no data")}
                {key === "tactical" && (tactical.bestRole ?? "no role fit")}
                {key === "mental" && (mental.personalityType ? PERSONALITY_NAMES[mental.personalityType] ?? mental.personalityType : "unknown")}
                {key === "physical" && (physical.age != null ? `age ${physical.age}` : "unknown age")}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded detail */}
      {expanded === "technical" && (
        <TechnicalDetail breakdown={technical} />
      )}
      {expanded === "tactical" && (
        <TacticalDetail breakdown={tactical} />
      )}
      {expanded === "mental" && (
        <MentalDetail breakdown={mental} />
      )}
      {expanded === "physical" && (
        <PhysicalDetail breakdown={physical} />
      )}

      {/* Commercial modifier */}
      {commercial.multiplier !== 1.0 && (
        <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center gap-3">
          <span className="text-[9px] text-[var(--text-muted)]">Value modifier</span>
          <span className={`text-xs font-mono font-bold ${
            commercial.multiplier > 1.0 ? "text-green-400" : commercial.multiplier < 1.0 ? "text-red-400" : "text-[var(--text-secondary)]"
          }`}>
            {commercial.multiplier > 1.0 ? "+" : ""}{Math.round((commercial.multiplier - 1) * 100)}%
          </span>
          {commercial.contractMonths != null && commercial.contractMonths <= 12 && (
            <span className="text-[8px] text-amber-400/80">contract leverage</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Compact version for player list cards ────────────────────────────────────

function CompactPillars({ pillars }: { pillars: { technical: number; tactical: number; mental: number; physical: number } }) {
  return (
    <div className="flex items-center gap-1">
      {PILLAR_CONFIG.map(({ key, color }) => (
        <div key={key} className="w-6 h-3 rounded-sm overflow-hidden bg-[var(--bg-elevated)]" title={`${key}: ${pillars[key]}`}>
          <div
            className="h-full rounded-sm"
            style={{ width: `${pillars[key]}%`, backgroundColor: color }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Detail panels ────────────────────────────────────────────────────────────

function SubScore({ label, value, maxLabel }: { label: string; value: number; maxLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--text-muted)]" style={{ width: `${value}%` }} />
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)] w-6 text-right">{value}</span>
        {maxLabel && <span className="text-[8px] text-[var(--text-muted)]">{maxLabel}</span>}
      </div>
    </div>
  );
}

function TechnicalDetail({ breakdown }: { breakdown: FullAssessment["technical"] }) {
  const topModels = Object.entries(breakdown.modelScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent-technical)]">
        Model Scores (top 5)
      </p>
      {topModels.map(([model, score]) => (
        <SubScore key={model} label={model} value={score} />
      ))}
      <div className="flex items-center gap-3 mt-2 text-[9px] text-[var(--text-muted)]">
        <span>Data weight: {Math.round(breakdown.dataWeight * 100)}%</span>
        <span>Sources: {breakdown.sources.join(", ") || "none"}</span>
      </div>
    </div>
  );
}

function TacticalDetail({ breakdown }: { breakdown: FullAssessment["tactical"] }) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent-tactical)]">
        Tactical Profile
      </p>
      <SubScore label="Role Fit (40%)" value={breakdown.roleFit} />
      <SubScore label="Flexibility (30%)" value={breakdown.flexibility} maxLabel={`${breakdown.viableRoleCount} roles`} />
      <SubScore label="Trait Profile (30%)" value={breakdown.traitProfile} />
      {breakdown.bestRole && (
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Best role: <span className="font-semibold text-[var(--color-accent-tactical)]">{breakdown.bestRole}</span>
        </p>
      )}
    </div>
  );
}

function MentalDetail({ breakdown }: { breakdown: FullAssessment["mental"] }) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent-mental)]">
        Mental Profile
      </p>
      <SubScore label="Personality-Role Fit (50%)" value={breakdown.personalityRoleAlignment} />
      <SubScore label="Mental Strength (30%)" value={breakdown.mentalStrength} />
      <SubScore label="Mental Stability (20%)" value={breakdown.mentalStability} />
      {breakdown.personalityType && (
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Type: <span className="font-mono font-bold text-[var(--color-accent-personality)]">{breakdown.personalityType}</span>
          {PERSONALITY_NAMES[breakdown.personalityType] && (
            <span className="ml-1">{PERSONALITY_NAMES[breakdown.personalityType]}</span>
          )}
        </p>
      )}
      {breakdown.mentalTag && (
        <p className="text-[10px] text-[var(--text-muted)]">
          State: {breakdown.mentalTag}
        </p>
      )}
    </div>
  );
}

function PhysicalDetail({ breakdown }: { breakdown: FullAssessment["physical"] }) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent-physical)]">
        Physical & Availability
      </p>
      <SubScore label="Athleticism (30%)" value={breakdown.athleticism} />
      <SubScore label="Availability (25%)" value={breakdown.availability} />
      <SubScore label="Durability (20%)" value={breakdown.durability} />
      <SubScore label="Age Curve (15%)" value={breakdown.ageCurve} />
      <SubScore label="Dominance (10%)" value={breakdown.dominance} />
      <div className="flex items-center gap-3 mt-1 text-[9px] text-[var(--text-muted)]">
        {breakdown.age != null && <span>Age: {breakdown.age}</span>}
      </div>
    </div>
  );
}
