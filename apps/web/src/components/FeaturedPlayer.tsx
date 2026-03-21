"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/models";
import { PERSONALITY_TYPES } from "@/lib/personality";
import { getCardTheme, THEME_STYLES } from "@/lib/archetype-themes";
import { getArchetypeColor } from "@/lib/archetype-styles";
import { RadarChart } from "./RadarChart";
import { ScoutingNotes } from "./ScoutingNotes";

interface FeaturedPlayerData {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  nation: string | null;
  level: number | null;
  overall: number | null;
  archetype: string | null;
  earned_archetype: string | null;
  best_role: string | null;
  best_role_score: number | null;
  blueprint: string | null;
  personality_type: string | null;
  market_value_tier: string | null;
  dob: string | null;
  scouting_notes: string | null;
  // Season stats (optional — passed from dashboard)
  af_appearances?: number | null;
  af_goals?: number | null;
  af_assists?: number | null;
  af_rating?: number | null;
}

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"] as const;

interface RadarData {
  modelScores: Record<string, number>;
  positionScores: Record<string, number>;
  positionModels: Record<string, string[]>;
  roleScores: Record<string, Array<{ name: string; primary: string; secondary: string; score: number }>>;
  hasData: boolean;
  hasDifferentiatedData: boolean;
}

function gradeLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Elite", color: "text-amber-400" };
  if (score >= 70) return { label: "Strong", color: "text-green-400" };
  if (score >= 55) return { label: "Adequate", color: "text-blue-400" };
  if (score >= 40) return { label: "Developing", color: "text-orange-400" };
  return { label: "Weak", color: "text-red-400" };
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  dof_pick: { label: "DOF Pick", color: "var(--accent-tactical)" },
  news_trending: { label: "Trending", color: "var(--accent-physical)" },
  discovery: { label: "Discovery", color: "var(--accent-personality)" },
};

export function FeaturedPlayer({ player: initialPlayer, reason, pool = [] }: { player: FeaturedPlayerData; reason?: string; pool?: FeaturedPlayerData[] }) {
  const [currentPlayer, setCurrentPlayer] = useState(initialPlayer);
  const [poolIndex, setPoolIndex] = useState(() => {
    const idx = pool.findIndex((p) => p.person_id === initialPlayer.person_id);
    return idx >= 0 ? idx : 0;
  });

  const player = currentPlayer;
  const theme = getCardTheme(player.personality_type);
  const styles = THEME_STYLES[theme];
  const pt = player.personality_type ? PERSONALITY_TYPES[player.personality_type] : null;
  const personality = pt ? { name: pt.fullName, oneLiner: pt.oneLiner } : null;
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const reasonInfo = reason ? REASON_LABELS[reason] : null;
  const canCycle = pool.length > 1;

  const prevFeatured = () => {
    if (!canCycle) return;
    const prev = (poolIndex - 1 + pool.length) % pool.length;
    setPoolIndex(prev);
    setCurrentPlayer(pool[prev]);
    setRadarData(null);
  };

  const nextFeatured = () => {
    if (!canCycle) return;
    const next = (poolIndex + 1) % pool.length;
    setPoolIndex(next);
    setCurrentPlayer(pool[next]);
    setRadarData(null);
  };

  const age = player.dob
    ? Math.floor((Date.now() - new Date(player.dob).getTime()) / 31557600000)
    : null;

  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [selectedPos, setSelectedPos] = useState(player.position ?? "CM");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPos(player.position ?? "CM");
    fetch(`/api/players/${player.person_id}/radar`)
      .then((r) => r.json())
      .then((d) => {
        setRadarData(d);
        const pos = player.position ?? "CM";
        const roles = d.roleScores?.[pos];
        // Prefer stored best_role if it exists in the role list
        if (player.best_role && roles?.some((r: { name: string }) => r.name === player.best_role)) {
          setSelectedRole(player.best_role);
        } else if (roles?.length) {
          setSelectedRole(roles[0].name);
        }
      })
      .catch(() => {});
  }, [player.person_id, player.position, player.best_role]);

  useEffect(() => {
    if (!radarData) return;
    const roles = radarData.roleScores?.[selectedPos];
    // If switching back to home position, prefer stored best_role
    if (player.best_role && selectedPos === (player.position ?? "CM") && roles?.some((r) => r.name === player.best_role)) {
      setSelectedRole(player.best_role);
    } else if (roles?.length) {
      setSelectedRole(roles[0].name);
    }
  }, [selectedPos, radarData, player.best_role, player.position]);

  // Radar computations — use position-specific models from the API (same as PlayerRadar)
  const models = radarData?.positionModels?.[selectedPos] ??
    Object.keys(radarData?.modelScores ?? {});
  const radarLabels = models.map((m) => MODEL_LABEL[m] ?? m);
  const radarValues = radarData ? models.map((m) => radarData.modelScores[m] ?? 0) : [];
  const roles = radarData?.roleScores?.[selectedPos] ?? [];
  const activeRole = roles.find((r) => r.name === selectedRole) ?? roles[0];

  const roleOverlay = activeRole
    ? models.map((m) => {
        if (m === activeRole.primary) return 90;
        if (m === activeRole.secondary) return 70;
        return 20;
      })
    : null;

  const posScore = radarData?.positionScores[selectedPos] ?? 0;
  const posGrade = gradeLabel(posScore);
  const roleScore = activeRole?.score ?? 0;
  const roleGrade = gradeLabel(roleScore);

  const showRadar = radarData?.hasData && radarData?.hasDifferentiatedData;

  const layers = [];
  if (roleOverlay && showRadar) {
    layers.push({ values: roleOverlay, color: "rgba(168,130,255,0.7)", fillOpacity: 0.12, strokeWidth: 1 });
  }
  if (showRadar) {
    layers.push({ values: radarValues, color: "rgba(56,189,248,0.9)", fillOpacity: 0.30, strokeWidth: 2.5 });
  }

  return (
    <div className={`${styles.card} p-5`}>
      {/* Identity row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Featured</span>
            {reasonInfo && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: reasonInfo.color, backgroundColor: `color-mix(in srgb, ${reasonInfo.color} 15%, transparent)` }}>
                {reasonInfo.label}
              </span>
            )}
            {canCycle && (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={prevFeatured}
                  className="text-[9px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  &larr; Prev
                </button>
                <span className="text-[8px] text-[var(--text-muted)] font-mono">{poolIndex + 1}/{pool.length}</span>
                <button
                  onClick={nextFeatured}
                  className="text-[9px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>
          <Link href={`/players/${player.person_id}`} className="group">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}>
                {player.position ?? "–"}
              </span>
              <h2 className={`text-xl ${styles.nameFont} text-[var(--text-primary)] truncate group-hover:text-[var(--accent-personality)] transition-colors`}>
                {player.name}
              </h2>
            </div>
          </Link>
          <p className="text-sm text-[var(--text-secondary)]">
            {[player.club, player.nation, age ? `${age}y` : null].filter(Boolean).join(" · ")}
          </p>
          {(player.earned_archetype || player.archetype) && (
            <p className="text-xs mt-1" style={{ color: getArchetypeColor(player.earned_archetype ?? player.archetype ?? "") }}>
              {player.earned_archetype ?? player.archetype}
              {player.blueprint && <span className="text-[var(--text-muted)]"> · {player.blueprint}</span>}
            </p>
          )}
          {(player.af_appearances ?? 0) > 0 && (
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
              <span className="text-[var(--color-accent-tactical)]">{player.af_appearances}</span> apps
              {(player.af_goals ?? 0) > 0 && <span className="text-green-400"> · {player.af_goals} goals</span>}
              {(player.af_assists ?? 0) > 0 && <span className="text-blue-400"> · {player.af_assists} assists</span>}
              {player.af_rating != null && <span className="text-amber-400"> · {player.af_rating.toFixed(1)}★</span>}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {player.personality_type && (
            <span className={`inline-block font-mono text-sm font-extrabold tracking-[0.12em] ${styles.personalityText}`}>
              {player.personality_type}
            </span>
          )}
        </div>
      </div>

      {/* Scout assessment */}
      {player.scouting_notes && (
        <ScoutingNotes text={player.scouting_notes} clamp={3} className="mb-4" />
      )}

      {/* Radar section */}
      {showRadar && (
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Position Fit</span>
            <select
              value={selectedPos}
              onChange={(e) => setSelectedPos(e.target.value)}
              className="text-xs sm:text-[10px] font-mono font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-2 py-1 sm:px-1.5 sm:py-0.5 text-[var(--text-primary)] cursor-pointer"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}{p === player.position ? " *" : ""}</option>
              ))}
            </select>
          </div>

          {/* Radar + scores: stack on mobile, side-by-side on sm+ */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2">
            {/* Radar */}
            <div className="w-full sm:flex-1 sm:min-w-0 max-w-[220px] mx-auto sm:mx-0">
              <RadarChart labels={radarLabels} layers={layers} size={200} />
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
      )}
    </div>
  );
}
