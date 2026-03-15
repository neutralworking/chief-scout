"use client";

import React, { useState } from "react";
import { RadarChart } from "@/components/RadarChart";
import {
  type TacticalPhilosophy,
  type PhilosophyFormation,
  type PhilosophyRole,
  getRadarValues,
  getRadarLabels,
  getPhilosophyColor,
  scorePlayerForPhilosophy,
  affinityStyle,
  importanceStyle,
} from "@/lib/tactical-philosophies";
import { POSITION_COLORS } from "@/lib/types";

interface FormationInfo {
  id: number;
  name: string;
}

interface RoleInfo {
  id: number;
  name: string;
  position: string;
  description: string | null;
}

interface TrackedPlayer {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  level: number | null;
  archetype: string | null;
  personality_type: string | null;
}

interface PhilosophyCardProps {
  philosophy: TacticalPhilosophy;
  formationLinks: PhilosophyFormation[];
  roleLinks: PhilosophyRole[];
  formations: FormationInfo[];
  roles: RoleInfo[];
  players: TrackedPlayer[];
  onFormationClick?: (formationName: string) => void;
}

export function PhilosophyCard({
  philosophy,
  formationLinks,
  roleLinks,
  formations,
  roles,
  players,
  onFormationClick,
}: PhilosophyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = getPhilosophyColor(philosophy.slug);
  const radarValues = getRadarValues(philosophy);
  const radarLabels = getRadarLabels();

  // Build formation lookup
  const formationMap = new Map(formations.map((f) => [f.id, f]));
  const roleMap = new Map(roles.map((r) => [r.id, r]));

  // Sort links by affinity/importance
  const affinityOrder = { primary: 0, secondary: 1, compatible: 2 };
  const importanceOrder = { essential: 0, preferred: 1, compatible: 2 };
  const sortedFormations = [...formationLinks].sort((a, b) => affinityOrder[a.affinity] - affinityOrder[b.affinity]);
  const sortedRoles = [...roleLinks].sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);

  // Score players for this philosophy
  const scoredPlayers = players
    .map((p) => ({ ...p, score: scorePlayerForPhilosophy(p, philosophy) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--bg-elevated)]/30 transition-colors"
      >
        {/* Mini radar */}
        <div className="shrink-0">
          <RadarChart
            labels={radarLabels}
            layers={[{ values: radarValues, color, fillOpacity: 0.2 }]}
            size={56}
          />
        </div>

        {/* Name + tagline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{philosophy.name}</h3>
            {philosophy.era && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] shrink-0">
                {philosophy.era}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">{philosophy.tagline}</p>
        </div>

        {/* Count badges */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
            {sortedFormations.length} formations
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
            {sortedRoles.length} roles
          </span>
          <svg
            className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-3 space-y-4">
          {/* Origin story */}
          {philosophy.origin_story && (
            <div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {philosophy.origin_story}
              </p>
            </div>
          )}

          {/* Two-column: Radar + Principles/Managers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Radar chart */}
            <div className="flex justify-center">
              <RadarChart
                labels={radarLabels}
                tooltips={["Possession orientation", "Pressing intensity", "Directness", "Defensive depth", "Width emphasis", "Fluidity"]}
                layers={[{ values: radarValues, color, fillOpacity: 0.2 }]}
                size={160}
              />
            </div>

            <div className="space-y-3">
              {/* Key principles */}
              {philosophy.key_principles && philosophy.key_principles.length > 0 && (
                <div>
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Principles</h4>
                  <div className="flex flex-wrap gap-1">
                    {philosophy.key_principles.map((p, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Defining managers */}
              {philosophy.defining_managers && philosophy.defining_managers.length > 0 && (
                <div>
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Prophets & Disciples</h4>
                  <div className="flex flex-wrap items-center gap-1">
                    {philosophy.defining_managers.map((m, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="text-[11px] text-[var(--text-primary)] font-medium">{m}</span>
                        {i < (philosophy.defining_managers?.length ?? 0) - 1 && (
                          <span className="text-[var(--text-muted)]">&rarr;</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Formations */}
          {sortedFormations.length > 0 && (
            <div>
              <h4 className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Formations</h4>
              <div className="flex flex-wrap gap-1.5">
                {sortedFormations.map((link) => {
                  const f = formationMap.get(link.formation_id);
                  if (!f) return null;
                  return (
                    <button
                      key={link.formation_id}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onFormationClick?.(f.name);
                      }}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors hover:bg-[var(--bg-elevated)] ${affinityStyle(link.affinity)}`}
                    >
                      {f.name}
                      <span className="ml-1 text-[8px] opacity-60">{link.affinity}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key roles */}
          {sortedRoles.length > 0 && (
            <div>
              <h4 className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Key Roles</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {sortedRoles.map((link) => {
                  const r = roleMap.get(link.role_id);
                  if (!r) return null;
                  const posColor = POSITION_COLORS[r.position] ?? "bg-zinc-700/60";
                  return (
                    <div key={link.role_id} className="flex items-center gap-2 p-1.5 rounded bg-[var(--bg-elevated)]/30">
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${posColor} text-white shrink-0`}>
                        {r.position}
                      </span>
                      <span className="text-[11px] text-[var(--text-primary)] font-medium flex-1 truncate">{r.name}</span>
                      <span className={`text-[8px] px-1 py-0.5 rounded ${importanceStyle(link.importance)}`}>
                        {link.importance}
                      </span>
                    </div>
                  );
                })}
              </div>
              {sortedRoles.some((l) => l.rationale) && (
                <div className="mt-2 space-y-1">
                  {sortedRoles.filter((l) => l.rationale && l.importance === "essential").map((link) => {
                    const r = roleMap.get(link.role_id);
                    return r ? (
                      <p key={link.role_id} className="text-[10px] text-[var(--text-muted)]">
                        <span className="text-[var(--text-secondary)] font-medium">{r.name}</span> — {link.rationale}
                      </p>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          {/* Player fit */}
          {scoredPlayers.length > 0 && (
            <div>
              <h4 className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Best Fit Players</h4>
              <div className="space-y-1">
                {scoredPlayers.map((p) => {
                  const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
                  return (
                    <div key={p.person_id} className="flex items-center gap-2 text-[11px]">
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${posColor} text-white`}>
                        {p.position ?? "?"}
                      </span>
                      <a
                        href={`/players/${p.person_id}`}
                        className="text-[var(--text-primary)] hover:text-white transition-colors truncate flex-1"
                      >
                        {p.name}
                      </a>
                      <span className="text-[var(--text-muted)] text-[10px]">{p.club}</span>
                      <span
                        className={`font-mono font-bold text-[10px] ${
                          p.score >= 70 ? "text-green-400" : p.score >= 50 ? "text-amber-400" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {p.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
