"use client";

import { useState, useEffect } from "react";
import { RadarChart } from "./RadarChart";

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"] as const;
const MODEL_SHORT: Record<string, string> = {
  Controller: "CTR", Commander: "CMD", Creator: "CRE", Target: "TGT",
  Sprinter: "SPR", Powerhouse: "PWR", Cover: "COV", Engine: "ENG",
  Destroyer: "DES", Dribbler: "DRB", Passer: "PAS", Striker: "STR", GK: "GK",
};

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

export function PlayerRadar({ playerId, position, compact = false }: { playerId: number; position: string | null; compact?: boolean }) {
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [selectedPos, setSelectedPos] = useState(position ?? "CM");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/players/${playerId}/radar`)
      .then((r) => r.json())
      .then((d) => {
        setRadarData(d);
        const roles = d.roleScores?.[position ?? "CM"];
        if (roles?.length) setSelectedRole(roles[0].name);
      })
      .catch(() => {});
  }, [playerId, position]);

  useEffect(() => {
    if (!radarData) return;
    const roles = radarData.roleScores?.[selectedPos];
    if (roles?.length) setSelectedRole(roles[0].name);
  }, [selectedPos, radarData]);

  if (!radarData?.hasData) return null;

  const models = radarData.positionModels?.[selectedPos] ??
    Object.keys(radarData.modelScores);
  const radarLabels = models.map((m) => MODEL_SHORT[m] ?? m);
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
    layers.push({ values: roleOverlay, color: "rgba(168,130,255,0.5)", fillOpacity: 0.06, strokeWidth: 1 });
  }
  layers.push({ values: radarValues, color: "rgba(56,189,248,0.9)", fillOpacity: 0.25, strokeWidth: 2 });

  const radarSize = compact ? 170 : 200;

  return (
    <div className="glass rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Position & Role Fit</h3>
        <select
          value={selectedPos}
          onChange={(e) => setSelectedPos(e.target.value)}
          className="text-[10px] font-mono font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 text-[var(--text-primary)] cursor-pointer"
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>{p}{p === position ? " *" : ""}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <RadarChart labels={radarLabels} tooltips={radarTooltips} layers={layers} size={radarSize} />
        </div>

        <div className="w-20 shrink-0 space-y-2">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{selectedPos} Fit</div>
            <div className="text-xl font-mono font-bold text-[var(--text-primary)]">
              {posScore}<span className="text-[9px] text-[var(--text-muted)]">%</span>
            </div>
            <div className={`text-[9px] font-semibold ${posGrade.color}`}>{posGrade.label}</div>
          </div>
          {activeRole && (
            <div>
              <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Role</div>
              <div className="text-xl font-mono font-bold text-[var(--text-primary)]">
                {roleScore}<span className="text-[9px] text-[var(--text-muted)]">%</span>
              </div>
              <div className={`text-[9px] font-semibold ${roleGrade.color}`}>{roleGrade.label}</div>
            </div>
          )}
          <div className="space-y-0.5 pt-1 border-t border-[var(--border-subtle)]">
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

      {/* Role pills */}
      {roles.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {roles.map((role) => (
            <button
              key={role.name}
              onClick={() => setSelectedRole(role.name)}
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
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
