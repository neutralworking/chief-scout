"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { getCardTheme, THEME_STYLES } from "@/lib/archetype-themes";
import { RadarChart } from "./RadarChart";

interface FeaturedPlayerData {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  nation: string | null;
  level: number | null;
  overall: number | null;
  archetype: string | null;
  blueprint: string | null;
  personality_type: string | null;
  market_value_tier: string | null;
  dob: string | null;
}

const PERSONALITY_NAMES: Record<string, { name: string; oneLiner: string }> = {
  ANLC: { name: "The General", oneLiner: "Structured reader, self-driven, organizes others, thrives in confrontation" },
  IXSP: { name: "The Genius", oneLiner: "Improviser, occasion-driven, self-contained, ice-cold under pressure" },
  ANSC: { name: "The Machine", oneLiner: "Reads the game systematically, self-motivated, quiet but relentless" },
  INLC: { name: "The Captain", oneLiner: "Instinct-driven, self-motivated, vocal leader, fierce competitor" },
  AXLC: { name: "The Showman", oneLiner: "Structured but feeds off atmosphere, demands attention, confrontational" },
  INSP: { name: "The Maestro", oneLiner: "Creative, self-motivated, quietly brilliant, composed under pressure" },
  ANLP: { name: "The Conductor", oneLiner: "Tactical organizer, self-driven, leads through control, ice-cold composure" },
  IXSC: { name: "The Maverick", oneLiner: "Flair player, needs the big stage, self-focused, rises to confrontation" },
  AXSC: { name: "The Enforcer", oneLiner: "Reads patterns, fuelled by occasion, self-focused, aggressive competitor" },
  AXSP: { name: "The Technician", oneLiner: "Structured, occasion-driven, self-contained, calm under pressure" },
  AXLP: { name: "The Orchestrator", oneLiner: "Tactical mind, feeds off the crowd, organizes others, composed decision-maker" },
  INLP: { name: "The Guardian", oneLiner: "Instinctive, self-motivated, vocal organizer, calm presence" },
  INSC: { name: "The Hunter", oneLiner: "Instinctive, self-driven, self-reliant, competitive edge" },
  IXLC: { name: "The Provocateur", oneLiner: "Improviser, occasion-driven, leads vocally, thrives on confrontation" },
  IXLP: { name: "The Playmaker", oneLiner: "Creative improviser, occasion-driven, organizes play, composed" },
  ANSP: { name: "The Professor", oneLiner: "Analytical, self-motivated, self-contained, composed under pressure" },
};

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"] as const;
const OUTFIELD_MODELS = ["Controller", "Commander", "Creator", "Target", "Sprinter", "Powerhouse", "Cover", "Engine", "Destroyer", "Dribbler", "Passer", "Striker"];
const GK_MODELS = ["GK", "Cover", "Commander", "Controller", "Passer"];
const MODEL_SHORT: Record<string, string> = {
  Controller: "CTR", Commander: "CMD", Creator: "CRE", Target: "TGT",
  Sprinter: "SPR", Powerhouse: "PWR", Cover: "COV", Engine: "ENG",
  Destroyer: "DES", Dribbler: "DRB", Passer: "PAS", Striker: "STR", GK: "GK",
};

interface RadarData {
  modelScores: Record<string, number>;
  positionScores: Record<string, number>;
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

export function FeaturedPlayer({ player }: { player: FeaturedPlayerData }) {
  const theme = getCardTheme(player.personality_type);
  const styles = THEME_STYLES[theme];
  const personality = player.personality_type ? PERSONALITY_NAMES[player.personality_type] : null;
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";

  const age = player.dob
    ? Math.floor((Date.now() - new Date(player.dob).getTime()) / 31557600000)
    : null;

  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [selectedPos, setSelectedPos] = useState(player.position ?? "CM");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/players/${player.person_id}/radar`)
      .then((r) => r.json())
      .then((d) => {
        setRadarData(d);
        const roles = d.roleScores?.[player.position ?? "CM"];
        if (roles?.length) setSelectedRole(roles[0].name);
      })
      .catch(() => {});
  }, [player.person_id, player.position]);

  useEffect(() => {
    if (!radarData) return;
    const roles = radarData.roleScores?.[selectedPos];
    if (roles?.length) setSelectedRole(roles[0].name);
  }, [selectedPos, radarData]);

  // Radar computations
  const isGK = selectedPos === "GK";
  const models = isGK ? GK_MODELS : OUTFIELD_MODELS;
  const radarLabels = models.map((m) => MODEL_SHORT[m]);
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
    layers.push({ values: roleOverlay, color: "rgba(168,130,255,0.5)", fillOpacity: 0.06, strokeWidth: 1 });
  }
  if (showRadar) {
    layers.push({ values: radarValues, color: "rgba(56,189,248,0.9)", fillOpacity: 0.25, strokeWidth: 2 });
  }

  return (
    <div className={`${styles.card} p-5`}>
      {/* Identity row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Featured</span>
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
          {player.archetype && (
            <p className="text-xs text-[var(--accent-tactical)] mt-1">
              {player.archetype}
              {player.blueprint && <span className="text-[var(--text-muted)]"> · {player.blueprint}</span>}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {player.personality_type && (
            <div>
              <span className={`inline-block font-mono text-xl font-extrabold tracking-[0.12em] ${styles.personalityText}`}>
                {player.personality_type}
              </span>
              {personality && (
                <p className="text-xs font-medium text-[var(--text-primary)] mt-0.5">{personality.name}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Personality one-liner */}
      {personality && (
        <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed italic">
          &ldquo;{personality.oneLiner}&rdquo;
        </p>
      )}

      {/* Radar section */}
      {showRadar && (
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Position Fit</span>
            <select
              value={selectedPos}
              onChange={(e) => setSelectedPos(e.target.value)}
              className="text-[10px] font-mono font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 text-[var(--text-primary)] cursor-pointer"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}{p === player.position ? " *" : ""}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Radar */}
            <div className="flex-1 min-w-0">
              <RadarChart labels={radarLabels} layers={layers} size={200} />
            </div>

            {/* Scores */}
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
      )}
    </div>
  );
}
