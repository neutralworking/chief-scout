"use client";

import { useState, useEffect } from "react";
import { RadarChart } from "./RadarChart";
import Link from "next/link";
import { MODEL_LABEL } from "@/lib/models";

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"] as const;

// Models shown on the position radar (outfield — exclude GK model for outfield, exclude outfield for GK)
const OUTFIELD_MODELS = ["Controller", "Commander", "Creator", "Target", "Sprinter", "Powerhouse", "Cover", "Engine", "Destroyer", "Dribbler", "Passer", "Striker"];
const GK_MODELS = ["GK", "Cover", "Commander", "Controller", "Passer"];

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
  roleScores: Record<string, Array<{ name: string; primary: string; secondary: string; score: number }>>;
  hasData: boolean;
}

interface Props {
  personId: number;
  name: string;
  position: string | null;
  club: string | null;
}

function gradeLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Elite", color: "text-amber-400" };
  if (score >= 70) return { label: "Strong", color: "text-green-400" };
  if (score >= 55) return { label: "Adequate", color: "text-blue-400" };
  if (score >= 40) return { label: "Developing", color: "text-orange-400" };
  return { label: "Weak", color: "text-red-400" };
}

export function FeaturedRadar({ personId, name, position, club }: Props) {
  const [data, setData] = useState<RadarData | null>(null);
  const [selectedPos, setSelectedPos] = useState(position ?? "CM");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/players/${personId}/radar`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Default to best role for the player's position
        const roles = d.roleScores?.[position ?? "CM"];
        if (roles?.length) setSelectedRole(roles[0].name);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [personId, position]);

  // Update selected role when position changes
  useEffect(() => {
    if (!data) return;
    const roles = data.roleScores?.[selectedPos];
    if (roles?.length) setSelectedRole(roles[0].name);
  }, [selectedPos, data]);

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Advanced Metrics</span>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Advanced Metrics</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">No attribute data available.</p>
      </div>
    );
  }

  const isGK = selectedPos === "GK";
  const models = isGK ? GK_MODELS : OUTFIELD_MODELS;
  const radarLabels = models.map((m) => MODEL_LABEL[m]);
  const radarTooltips = models.map((m) => `${m}: ${MODEL_ATTRS[m] ?? ""}`);
  const radarValues = models.map((m) => data.modelScores[m] ?? 0);

  // Role overlay: find selected role and build its ideal radar shape
  const roles = data.roleScores?.[selectedPos] ?? [];
  const activeRole = roles.find((r) => r.name === selectedRole) ?? roles[0];

  // Build role ideal shape — primary model at 90, secondary at 70, others at 20
  const roleOverlay = activeRole
    ? models.map((m) => {
        if (m === activeRole.primary) return 90;
        if (m === activeRole.secondary) return 70;
        return 20;
      })
    : null;

  const posScore = data.positionScores[selectedPos] ?? 0;
  const posGrade = gradeLabel(posScore);
  const roleScore = activeRole?.score ?? 0;
  const roleGrade = gradeLabel(roleScore);

  const layers = [];
  // Role ideal shape (background, muted)
  if (roleOverlay) {
    layers.push({
      values: roleOverlay,
      color: "var(--accent-personality)",
      fillOpacity: 0.06,
      strokeWidth: 1,
    });
  }
  // Player's actual model scores (foreground)
  layers.push({
    values: radarValues,
    color: "var(--accent-tactical)",
    fillOpacity: 0.2,
    strokeWidth: 2,
  });

  return (
    <div className="card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Advanced Metrics</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Link href={`/players/${personId}`} className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-personality)] transition-colors">
              {name}
            </Link>
            {club && <span className="text-xs text-[var(--text-muted)]">{club}</span>}
          </div>
        </div>
        {/* Position dropdown */}
        <select
          value={selectedPos}
          onChange={(e) => setSelectedPos(e.target.value)}
          className="text-xs font-mono font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-2 py-1 text-[var(--text-primary)] cursor-pointer"
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}{p === position ? " *" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Radar + Grades side by side */}
      <div className="flex items-start gap-3">
        {/* Radar */}
        <div className="flex-1 min-w-0">
          <RadarChart labels={radarLabels} tooltips={radarTooltips} layers={layers} size={220} />
        </div>

        {/* Grades panel */}
        <div className="w-24 shrink-0 space-y-3 pt-2">
          {/* Position fit */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              {selectedPos} Fit
            </div>
            <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">
              {posScore}
              <span className="text-[10px] text-[var(--text-muted)]">%</span>
            </div>
            <div className={`text-[10px] font-semibold ${posGrade.color}`}>
              {posGrade.label}
            </div>
          </div>

          {/* Role fit */}
          {activeRole && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Role Fit
              </div>
              <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">
                {roleScore}
                <span className="text-[10px] text-[var(--text-muted)]">%</span>
              </div>
              <div className={`text-[10px] font-semibold ${roleGrade.color}`}>
                {roleGrade.label}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[var(--accent-tactical)] rounded-full" />
              <span className="text-[8px] text-[var(--text-muted)]">Player</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[var(--accent-personality)] rounded-full opacity-50" />
              <span className="text-[8px] text-[var(--text-muted)]">Role ideal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role selector */}
      {roles.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <button
                key={role.name}
                onClick={() => setSelectedRole(role.name)}
                className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                  selectedRole === role.name
                    ? "bg-[var(--accent-personality)]/20 text-[var(--accent-personality)] ring-1 ring-[var(--accent-personality)]/30"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {role.name}
                <span className="ml-1 font-mono opacity-60">{role.score}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
