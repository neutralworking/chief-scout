"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/models";
import { PERSONALITY_TYPES } from "@/lib/personality";
import { getCardTheme, THEME_STYLES } from "@/lib/archetype-themes";
import { getArchetypeColor } from "@/lib/archetype-styles";
import {
  PILLAR_KEYS,
  PILLAR_HEX,
  getDominantPillar,
  hasAnyPillarScore,
  type PillarKey,
} from "@/lib/pillar-colors";
import { RadarChart } from "./RadarChart";
import { ScoutingNotes } from "./ScoutingNotes";

interface FeaturedPlayerData {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  nation: string | null;
  nation_code: string | null;
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
  technical_score: number | null;
  tactical_score: number | null;
  mental_score: number | null;
  physical_score: number | null;
  overall_pillar_score: number | null;
  market_value_eur: number | null;
  director_valuation_meur: number | null;
  // Season stats (optional — passed from dashboard)
  af_appearances?: number | null;
  af_goals?: number | null;
  af_assists?: number | null;
  af_rating?: number | null;
}

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"] as const;

const PILLAR_BORDER: Record<PillarKey, string> = {
  technical: "border-l-amber-500",
  tactical: "border-l-purple-500",
  mental: "border-l-green-500",
  physical: "border-l-blue-500",
};

function nationFlag(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.toUpperCase();
  const GB: Record<string, string> = {
    "GB-ENG": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
    "GB-SCT": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
    "GB-WLS": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F",
  };
  if (GB[c]) return GB[c];
  if (c.length === 2) return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  return "";
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v.toFixed(0)}`;
}

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

function IntelChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-pit)] border border-[var(--border-panel)]/20 text-[10px]">
      <span className="font-mono text-[7px] font-bold uppercase tracking-[1.5px] opacity-50">{label}</span>
      <span className="font-semibold text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

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

  const pillarScores = {
    technical: player.technical_score ?? null,
    tactical: player.tactical_score ?? null,
    mental: player.mental_score ?? null,
    physical: player.physical_score ?? null,
  };
  const hasPillars = hasAnyPillarScore(pillarScores);
  const dominant = getDominantPillar(pillarScores);
  const overall = player.overall_pillar_score;
  const flag = nationFlag(player.nation_code);
  const value = player.market_value_eur;

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
    <div className={`border-l-2 border-[var(--color-accent-tactical)] ${styles.card} p-5`}>
      {/* Header: Featured label + cycling */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Featured</span>
        {reasonInfo && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5" style={{ color: reasonInfo.color, backgroundColor: `color-mix(in srgb, ${reasonInfo.color} 15%, transparent)` }}>
            {reasonInfo.label}
          </span>
        )}
        {canCycle && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={prevFeatured} className="text-[9px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">&larr; Prev</button>
            <span className="text-[8px] text-[var(--text-muted)] font-mono">{poolIndex + 1}/{pool.length}</span>
            <button onClick={nextFeatured} className="text-[9px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Next &rarr;</button>
          </div>
        )}
      </div>

      {/* 2-column grid: Left (identity + bio) / Right (scores + radar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left column: Position, Name, Archetype, Bio */}
        <div className="min-w-0">
          {/* Position + Name + Overall */}
          <Link href={`/players/${player.person_id}`} className="group">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 ${posColor} text-white shrink-0`}>
                {player.position ?? "–"}
              </span>
              <h2 className={`text-lg ${styles.nameFont} text-[var(--text-primary)] truncate flex-1 group-hover:text-[var(--accent-personality)] transition-colors`}>
                {player.name}
              </h2>
              {overall != null && (
                <span className="text-xl font-mono font-bold shrink-0" style={{ color: dominant ? PILLAR_HEX[dominant] : "var(--text-primary)" }}>
                  {overall}
                </span>
              )}
            </div>
          </Link>

          {/* Flag + Club + Age + Archetype */}
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-1 min-w-0">
            {flag && <span className="shrink-0">{flag}</span>}
            {player.club && <span className="truncate">{player.club}</span>}
            {age !== null && (
              <><span className="text-[var(--text-muted)] shrink-0">·</span><span className="shrink-0">{age}y</span></>
            )}
            {(player.earned_archetype || player.archetype) && (
              <><span className="text-[var(--text-muted)] shrink-0">·</span><span className="shrink-0" style={{ color: getArchetypeColor(player.earned_archetype ?? player.archetype ?? "") }}>{player.earned_archetype ?? player.archetype}</span></>
            )}
          </div>

          {/* Scout assessment */}
          {player.scouting_notes && (
            <ScoutingNotes text={player.scouting_notes} clamp={3} className="mt-2" />
          )}

          {/* Season stats */}
          {(player.af_appearances ?? 0) > 0 && (
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
              <span className="text-[var(--color-accent-tactical)]">{player.af_appearances}</span> apps
              {(player.af_goals ?? 0) > 0 && <span className="text-green-400"> · {player.af_goals} goals</span>}
              {(player.af_assists ?? 0) > 0 && <span className="text-blue-400"> · {player.af_assists} assists</span>}
              {player.af_rating != null && <span className="text-amber-400"> · {player.af_rating.toFixed(1)}★</span>}
            </p>
          )}
        </div>

        {/* Right column: Role score block + Radar + 2x2 Pillars */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Role + Value row */}
          {(player.best_role || value) && (
            <div className="flex items-center gap-2 min-w-0">
              {player.best_role && (
                <span className="text-[10px] text-[var(--text-muted)] truncate">{player.best_role}</span>
              )}
              {value != null && (
                <span className="text-[10px] font-mono font-semibold text-[var(--text-secondary)] ml-auto shrink-0">
                  {formatValue(value)}
                </span>
              )}
            </div>
          )}

          {/* Mini Radar */}
          {showRadar && (
            <div className="flex flex-col items-center">
              <div className="w-full max-w-[180px]">
                <RadarChart labels={radarLabels} layers={layers} size={170} />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="text-center">
                  <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{selectedPos} Fit</div>
                  <div className="text-lg font-mono font-bold text-[var(--text-primary)]">
                    {posScore}<span className="text-[9px] text-[var(--text-muted)]">%</span>
                  </div>
                  <div className={`text-[9px] font-semibold ${posGrade.color}`}>{posGrade.label}</div>
                </div>
                {activeRole && (
                  <div className="text-center">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Role</div>
                    <div className="text-lg font-mono font-bold text-[var(--text-primary)]">
                      {roleScore}<span className="text-[9px] text-[var(--text-muted)]">%</span>
                    </div>
                    <div className={`text-[9px] font-semibold ${roleGrade.color}`}>{roleGrade.label}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2x2 Pillar badges */}
          {hasPillars && (
            <div className="grid grid-cols-2 gap-1">
              {PILLAR_KEYS.map((key) => {
                const v = pillarScores[key];
                if (v == null) return null;
                return (
                  <div key={key} className={`flex items-center gap-1.5 px-2 py-1 border-l-2 ${PILLAR_BORDER[key]} bg-[var(--bg-pit)]`}>
                    <span className="text-[7px] font-bold uppercase tracking-[1px] text-[var(--text-muted)]">{key.slice(0, 3)}</span>
                    <span className="text-[11px] font-mono font-bold" style={{ color: PILLAR_HEX[key] }}>{v}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Intel strip — full width */}
      {(personality || player.best_role || age !== null) && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--border-subtle)]">
          {personality && (
            <IntelChip label="Type" value={`${player.personality_type} ${personality.name}`} />
          )}
          {player.best_role && (
            <IntelChip label="Best Role" value={player.best_role} />
          )}
          {age !== null && (
            <IntelChip label="Age" value={`${age}`} />
          )}
        </div>
      )}

      {/* Position selector + Role pills */}
      {showRadar && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Position Fit</span>
            <select
              value={selectedPos}
              onChange={(e) => setSelectedPos(e.target.value)}
              className="text-xs sm:text-[10px] font-mono font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-1 sm:px-1.5 sm:py-0.5 text-[var(--text-primary)] cursor-pointer"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}{p === player.position ? " *" : ""}</option>
              ))}
            </select>
          </div>
          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <button
                  key={role.name}
                  onClick={() => setSelectedRole(role.name)}
                  className={`text-[10px] sm:text-[9px] px-2 py-1 sm:px-1.5 sm:py-0.5 font-medium transition-colors ${
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
