"use client";

import { useState, useEffect } from "react";
import { RadarChart } from "./RadarChart";
import { MODEL_LABEL } from "@/lib/models";

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"] as const;

const MODEL_ATTRS: Record<string, string> = {
  Controller: "Anticipation, Composure, Decisions, Tempo",
  Commander: "Communication, Concentration, Drive, Leadership",
  Creator: "Creativity, Unpredictability, Vision, Guile",
  Target: "Aerial Duels, Heading, Jumping, Volleys",
  Sprinter: "Acceleration, Balance, Movement, Pace",
  Powerhouse: "Aggression, Duels, Shielding, Stamina",
  Cover: "Awareness, Discipline, Interceptions, Positioning",
  Engine: "Intensity, Pressing, Stamina, Versatility",
  Destroyer: "Blocking, Clearances, Marking, Tackling",
  Dribbler: "Carries, First Touch, Skills, Take-Ons",
  Passer: "Pass Accuracy, Crossing, Pass Range, Through Balls",
  Striker: "Close Range, Mid Range, Long Range, Penalties",
  GK: "Agility, Footwork, Handling, Reactions",
};

interface RadarData {
  modelScores: Record<string, number>;
  positionScores: Record<string, number>;
  positionModels: Record<string, string[]>;
  roleScores: Record<string, Array<{ name: string; primary: string; secondary: string; score: number }>>;
  hasData: boolean;
  hasDifferentiatedData: boolean;
  dataWeight: number;
  levelAnchor: number | null;
}

function gradeLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Elite", color: "text-amber-400" };
  if (score >= 70) return { label: "Strong", color: "text-green-400" };
  if (score >= 55) return { label: "Adequate", color: "text-blue-400" };
  if (score >= 40) return { label: "Developing", color: "text-orange-400" };
  return { label: "Weak", color: "text-red-400" };
}

function confidenceLabel(w: number): string {
  if (w >= 0.9) return "Scout assessed";
  if (w >= 0.6) return "Stats-derived";
  if (w >= 0.4) return "Partially inferred";
  return "Level-anchored";
}

export function PlayerRadar({ playerId, position, compact = false, storedBestRole }: { playerId: number; position: string | null; compact?: boolean; storedBestRole?: string | null }) {
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [selectedPos, setSelectedPos] = useState(position ?? "CM");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/players/${playerId}/radar`)
      .then((r) => r.json())
      .then((d) => {
        setRadarData(d);
        const roles = d.roleScores?.[position ?? "CM"];
        // Prefer stored best_role if it exists in the role list for this position
        if (storedBestRole && roles?.some((r: { name: string }) => r.name === storedBestRole)) {
          setSelectedRole(storedBestRole);
        } else if (roles?.length) {
          setSelectedRole(roles[0].name);
        }
      })
      .catch(() => {});
  }, [playerId, position, storedBestRole]);

  useEffect(() => {
    if (!radarData) return;
    const roles = radarData.roleScores?.[selectedPos];
    // If switching back to home position, prefer stored best_role
    if (storedBestRole && selectedPos === (position ?? "CM") && roles?.some((r) => r.name === storedBestRole)) {
      setSelectedRole(storedBestRole);
    } else if (roles?.length) {
      setSelectedRole(roles[0].name);
    }
  }, [selectedPos, radarData, storedBestRole, position]);

  if (!radarData?.hasData) return null;

  const models = radarData.positionModels?.[selectedPos] ??
    Object.keys(radarData.modelScores);
  const radarLabels = models.map((m) => MODEL_LABEL[m] ?? m);
  const radarTooltips = models.map((m) => `${m}: ${MODEL_ATTRS[m] ?? ""}`);
  const radarValues = models.map((m) => radarData.modelScores[m] ?? 0);
  const roles = radarData.roleScores?.[selectedPos] ?? [];
  const activeRole = roles.find((r) => r.name === selectedRole) ?? roles[0];

  const roleOverlay = activeRole
    ? models.map((m) => {
        if (m === activeRole.primary) return 90;
        if (m === activeRole.secondary) return 70;
        return 20;
      })
    : null;

  const posScore = radarData.positionScores[selectedPos] ?? 0;
  const posGrade = gradeLabel(posScore);
  const roleScore = activeRole?.score ?? 0;
  const roleGrade = gradeLabel(roleScore);

  const layers = [];
  if (roleOverlay) {
    layers.push({ values: roleOverlay, color: "rgba(168,130,255,0.7)", fillOpacity: 0.12, strokeWidth: 1 });
  }
  layers.push({ values: radarValues, color: "rgba(56,189,248,0.9)", fillOpacity: 0.30, strokeWidth: 2.5 });

  const radarSize = compact ? 190 : 200;

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Position & Role Fit</h3>
        <select
          value={selectedPos}
          onChange={(e) => setSelectedPos(e.target.value)}
          className="text-xs sm:text-[10px] font-mono font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-2 py-1 sm:px-1.5 sm:py-0.5 text-[var(--text-primary)] cursor-pointer"
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>{p}{p === position ? " *" : ""}</option>
          ))}
        </select>
      </div>

      {/* Radar + scores: stack on mobile, side-by-side on sm+ */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:flex-1 sm:min-w-0 max-w-[220px] mx-auto sm:mx-0">
          <RadarChart labels={radarLabels} tooltips={radarTooltips} layers={layers} size={radarSize} />
        </div>

        {/* Scores row on mobile, column on sm+ */}
        <div className="flex sm:flex-col sm:w-20 sm:shrink-0 gap-3 sm:gap-0 sm:space-y-2 justify-center w-full">
          <div className="text-center sm:text-left">
            <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{selectedPos} Fit</div>
            <div className="text-xl font-mono font-bold text-[var(--text-primary)]">
              {posScore}<span className="text-[9px] text-[var(--text-muted)]">%</span>
            </div>
            <div className={`text-[9px] font-semibold ${posGrade.color}`}>{posGrade.label}</div>
          </div>
          {activeRole && (
            <div className="text-center sm:text-left">
              <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Role</div>
              <div className="text-xl font-mono font-bold text-[var(--text-primary)]">
                {roleScore}<span className="text-[9px] text-[var(--text-muted)]">%</span>
              </div>
              <div className={`text-[9px] font-semibold ${roleGrade.color}`}>{roleGrade.label}</div>
            </div>
          )}
          <div className="hidden sm:block space-y-0.5 pt-1 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 rounded-full" style={{ background: "rgba(56,189,248,0.9)" }} />
              <span className="text-[7px] text-[var(--text-muted)]">Player</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 rounded-full" style={{ background: "rgba(168,130,255,0.5)" }} />
              <span className="text-[7px] text-[var(--text-muted)]">Role ideal</span>
            </div>
            {radarData.dataWeight != null && (
              <div className="text-[7px] text-[var(--text-muted)] mt-0.5 opacity-60">
                {confidenceLabel(radarData.dataWeight)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Physical Profile — composite of Sprinter + Powerhouse + Target */}
      <PhysicalProfile modelScores={radarData.modelScores} />

      {/* Role pills */}
      {roles.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {roles.map((role) => (
            <button
              key={role.name}
              onClick={() => setSelectedRole(role.name)}
              className={`text-[10px] sm:text-[9px] px-2 py-1 sm:px-1.5 sm:py-0.5 rounded font-medium transition-colors ${
                selectedRole === role.name
                  ? "bg-[var(--accent-personality)]/20 text-[var(--accent-personality)] ring-1 ring-[var(--accent-personality)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {role.name} <span className="font-mono opacity-60">{role.score}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PHYS_LABELS: Record<string, string> = {
  Sprinter: "Pace & Agility",
  Powerhouse: "Strength & Power",
  Target: "Aerial & Presence",
};

function PhysicalProfile({ modelScores }: { modelScores: Record<string, number> }) {
  const physModels = ["Sprinter", "Powerhouse", "Target"] as const;
  const physScores = physModels
    .map((m) => ({ name: m, score: modelScores[m] }))
    .filter((s) => s.score != null && s.score > 0);

  if (physScores.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Physical</span>
        <p className="text-[9px] text-[var(--text-muted)] mt-1">No physical data available</p>
      </div>
    );
  }

  const physAvg = Math.round(physScores.reduce((s, p) => s + p.score, 0) / physScores.length);
  const physGrade = gradeLabel(physAvg);

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-physical)]">Physical</span>
        <span className={`text-[10px] font-bold ${physGrade.color}`}>{physAvg}</span>
        <span className={`text-[9px] ${physGrade.color}`}>{physGrade.label}</span>
      </div>
      <div className="space-y-1.5">
        {physScores.map(({ name, score }) => (
          <div key={name} className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--text-secondary)] w-20 sm:w-28 truncate">{PHYS_LABELS[name] ?? name}</span>
            <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(score, 100)}%`,
                  backgroundColor: "var(--color-accent-physical)",
                  opacity: score >= 70 ? 1 : score >= 50 ? 0.75 : 0.5,
                }}
              />
            </div>
            <span className="text-[9px] font-mono w-5 text-right text-[var(--text-secondary)]">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
