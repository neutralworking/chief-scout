"use client";

import { useState } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";

interface FormationSlot {
  formation_id: number;
  position: string;
  slot_count: number;
  slot_label: string | null;
  role_id: number | null;
}

interface TacticalRole {
  id: number;
  name: string;
  position: string;
  description: string | null;
  primary_archetype: string;
  secondary_archetype: string;
}

interface TrackedPlayer {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  level: number | null;
  archetype: string | null;
  pursuit_status: string | null;
}

interface FormationDetailProps {
  formation: {
    id: number;
    name: string;
    structure: string | null;
    notes: string | null;
    era: string | null;
  };
  slots: FormationSlot[];
  fit: number;
  playersByPosition: Record<string, TrackedPlayer[]>;
  rolesMap?: Record<number, TacticalRole>;
}

// Pitch Y positions for each position (0 = GK end, 100 = striker end)
const POSITION_Y: Record<string, number> = {
  GK: 5,
  CD: 20,
  WD: 22,
  DM: 38,
  CM: 50,
  WM: 52,
  AM: 65,
  WF: 78,
  CF: 90,
};

// Render order (defense → attack)
const RENDER_ORDER = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];

// Archetype category colors
const ARCHETYPE_COLORS: Record<string, string> = {
  Controller: "var(--accent-mental)",
  Commander: "var(--accent-mental)",
  Creator: "var(--accent-mental)",
  Target: "var(--accent-physical)",
  Sprinter: "var(--accent-physical)",
  Powerhouse: "var(--accent-physical)",
  Cover: "var(--accent-tactical)",
  Engine: "var(--accent-tactical)",
  Destroyer: "var(--accent-tactical)",
  Dribbler: "var(--accent-technical)",
  Passer: "var(--accent-technical)",
  Striker: "var(--accent-technical)",
  GK: "var(--accent-personality)",
};

function fitColor(fit: number): string {
  if (fit >= 80) return "var(--sentiment-positive)";
  if (fit >= 50) return "var(--accent-personality)";
  return "var(--sentiment-negative)";
}

function roleFitScore(player: TrackedPlayer, role: TacticalRole): number | null {
  // Simple: if player archetype matches primary or secondary, show affinity
  if (!player.archetype) return null;
  if (player.archetype === role.primary_archetype) return 90;
  if (player.archetype === role.secondary_archetype) return 70;
  return 30;
}

function roleFitBadge(score: number | null): { label: string; color: string } | null {
  if (score === null) return null;
  if (score >= 80) return { label: "ideal", color: "var(--sentiment-positive)" };
  if (score >= 60) return { label: "good", color: "var(--accent-personality)" };
  return { label: "poor", color: "var(--text-muted)" };
}

function distributeX(count: number): number[] {
  if (count === 1) return [50];
  if (count === 2) return [28, 72];
  if (count === 3) return [20, 50, 80];
  if (count === 4) return [15, 38, 62, 85];
  return Array.from({ length: count }, (_, i) => 10 + (80 / (count - 1)) * i);
}

export function FormationDetail({ formation, slots, fit, playersByPosition, rolesMap = {} }: FormationDetailProps) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const hasRoles = slots.some((s) => s.role_id != null);

  // Group slots by position for pitch dots
  const slotsByPos: Record<string, FormationSlot[]> = {};
  for (const slot of slots) {
    if (!slotsByPos[slot.position]) slotsByPos[slot.position] = [];
    slotsByPos[slot.position].push(slot);
  }

  // Build position dots for pitch diagram
  const dots: { x: number; y: number; pos: string; label: string; role?: TacticalRole; isGap: boolean }[] = [];
  for (const pos of RENDER_ORDER) {
    const posSlots = slotsByPos[pos];
    if (!posSlots) continue;
    const y = POSITION_Y[pos] ?? 50;
    const xs = distributeX(posSlots.length);
    const available = (playersByPosition[pos] ?? []).length;
    for (let i = 0; i < posSlots.length; i++) {
      const slot = posSlots[i];
      const role = slot.role_id ? rolesMap[slot.role_id] : undefined;
      dots.push({
        x: xs[i],
        y,
        pos,
        label: slot.slot_label ?? pos,
        role,
        isGap: available <= i,
      });
    }
  }

  // Unique position summary for header
  const posSummary: { pos: string; count: number }[] = [];
  for (const pos of RENDER_ORDER) {
    if (pos === "GK") continue;
    const count = slotsByPos[pos]?.length ?? 0;
    if (count > 0) posSummary.push({ pos, count });
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-elevated)]/30 transition-colors cursor-pointer text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Mini pitch */}
        <div className="w-16 h-20 bg-[var(--bg-base)]/50 rounded border border-[var(--border-subtle)] relative shrink-0 overflow-hidden">
          {dots.map((dot, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                left: `${dot.x}%`,
                bottom: `${dot.y}%`,
                transform: "translate(-50%, 50%)",
                backgroundColor: dot.isGap ? "var(--sentiment-negative)" : "var(--text-primary)",
                opacity: dot.isGap ? 0.5 : 0.7,
              }}
            />
          ))}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{formation.name}</span>
            {formation.era && (
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
                {formation.era}
              </span>
            )}
            {hasRoles && (
              <span className="text-[9px] uppercase tracking-wider text-[var(--accent-mental)] bg-[var(--accent-mental)]/10 px-1.5 py-0.5 rounded">
                roles
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {posSummary.map(({ pos, count }) => {
              const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
              return (
                <span key={pos} className={`text-[8px] font-bold px-1 py-0.5 rounded ${posColor} text-white`}>
                  {pos}×{count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Fit score */}
        <div className="text-right shrink-0">
          <div className="text-lg font-mono font-bold" style={{ color: fitColor(fit) }}>
            {fit}%
          </div>
          <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Fit</div>
        </div>

        {/* Expand indicator */}
        <span className={`text-[var(--text-muted)] transition-transform ${expanded ? "rotate-90" : ""}`}>
          &rsaquo;
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pitch visualization */}
            <div className="relative bg-[var(--bg-base)]/30 rounded-lg border border-[var(--border-subtle)] aspect-[3/4] overflow-hidden">
              {/* Pitch lines */}
              <div className="absolute inset-0">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--border-subtle)]" />
                <div className="absolute left-1/2 top-1/2 w-16 h-16 -ml-8 -mt-8 rounded-full border border-[var(--border-subtle)]" />
                <div className="absolute left-1/4 right-1/4 top-0 h-[15%] border-b border-l border-r border-[var(--border-subtle)]" />
                <div className="absolute left-1/4 right-1/4 bottom-0 h-[15%] border-t border-l border-r border-[var(--border-subtle)]" />
              </div>
              {/* Position dots with role labels */}
              {dots.map((dot, i) => (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${dot.x}%`,
                    bottom: `${dot.y}%`,
                    transform: "translate(-50%, 50%)",
                  }}
                >
                  <div
                    className={`w-3 h-3 rounded-full border ${dot.isGap ? "border-[var(--sentiment-negative)] bg-[var(--sentiment-negative)]/20" : "border-[var(--text-primary)]/50 bg-[var(--text-primary)]/30"}`}
                  />
                  <span className="text-[6px] font-bold text-[var(--text-muted)] mt-0.5 whitespace-nowrap">
                    {dot.role ? dot.role.name.split(" ")[0] : dot.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Role mapping */}
            <div>
              <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
                {hasRoles ? "Role Mapping" : "Slot Mapping"}
              </h3>
              <div className="space-y-3">
                {RENDER_ORDER.map((pos) => {
                  const posSlots = slotsByPos[pos];
                  if (!posSlots) return null;
                  const posPlayers = playersByPosition[pos] ?? [];
                  const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";

                  return (
                    <div key={pos}>
                      {/* Position header */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white`}>
                          {pos}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {posSlots.length} slot{posSlots.length > 1 ? "s" : ""}
                        </span>
                        {posPlayers.length < posSlots.length && (
                          <span className="text-[9px] text-[var(--sentiment-negative)] font-medium">gap</span>
                        )}
                      </div>

                      {/* Individual slots with roles */}
                      <div className="ml-4 space-y-2">
                        {posSlots.map((slot, slotIdx) => {
                          const role = slot.role_id ? rolesMap[slot.role_id] : null;
                          return (
                            <div key={slotIdx} className="border-l-2 border-[var(--border-subtle)] pl-3">
                              {/* Role name + archetype affinity */}
                              {role ? (
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-semibold text-[var(--text-primary)]">
                                    {slot.slot_label && (
                                      <span className="text-[var(--text-muted)] font-mono mr-1">{slot.slot_label}</span>
                                    )}
                                    {role.name}
                                  </span>
                                  <span
                                    className="text-[8px] font-medium px-1 py-0.5 rounded"
                                    style={{
                                      color: ARCHETYPE_COLORS[role.primary_archetype] ?? "var(--text-muted)",
                                      backgroundColor: `color-mix(in srgb, ${ARCHETYPE_COLORS[role.primary_archetype] ?? "var(--text-muted)"} 15%, transparent)`,
                                    }}
                                  >
                                    {role.primary_archetype}
                                  </span>
                                  <span
                                    className="text-[8px] px-1 py-0.5 rounded"
                                    style={{
                                      color: ARCHETYPE_COLORS[role.secondary_archetype] ?? "var(--text-muted)",
                                      backgroundColor: `color-mix(in srgb, ${ARCHETYPE_COLORS[role.secondary_archetype] ?? "var(--text-muted)"} 10%, transparent)`,
                                    }}
                                  >
                                    {role.secondary_archetype}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] text-[var(--text-secondary)]">
                                    {slot.slot_label ?? `${pos} #${slotIdx + 1}`}
                                  </span>
                                </div>
                              )}

                              {/* Players that fit this slot */}
                              {posPlayers.length > 0 ? (
                                <div className="space-y-0.5">
                                  {posPlayers.slice(0, 3).map((p) => {
                                    const fitBadge = role ? roleFitBadge(roleFitScore(p, role)) : null;
                                    return (
                                      <Link
                                        key={p.person_id}
                                        href={`/players/${p.person_id}`}
                                        className="flex items-center gap-2 text-xs hover:text-[var(--text-primary)] transition-colors group"
                                      >
                                        <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                                          {p.name}
                                        </span>
                                        {p.level != null && (
                                          <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.level}</span>
                                        )}
                                        {p.archetype && (
                                          <span
                                            className="text-[9px] font-medium"
                                            style={{ color: ARCHETYPE_COLORS[p.archetype] ?? "var(--text-muted)" }}
                                          >
                                            {p.archetype}
                                          </span>
                                        )}
                                        {fitBadge && (
                                          <span
                                            className="text-[8px] font-medium px-1 rounded"
                                            style={{ color: fitBadge.color }}
                                          >
                                            {fitBadge.label}
                                          </span>
                                        )}
                                      </Link>
                                    );
                                  })}
                                  {posPlayers.length > 3 && (
                                    <span className="text-[10px] text-[var(--text-muted)]">
                                      +{posPlayers.length - 3} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[10px] text-[var(--sentiment-negative)]">
                                  No tracked players
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Role legend */}
          {hasRoles && (
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-4 text-[9px] text-[var(--text-muted)]">
                <span className="uppercase tracking-wider font-semibold">Archetype fit:</span>
                <span style={{ color: "var(--sentiment-positive)" }}>● ideal</span>
                <span style={{ color: "var(--accent-personality)" }}>● good</span>
                <span>● poor</span>
              </div>
            </div>
          )}

          {/* Tactical notes */}
          {formation.notes && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <button
                className="text-[10px] text-[var(--accent-personality)] hover:underline cursor-pointer"
                onClick={() => setShowNotes(!showNotes)}
              >
                {showNotes ? "Hide" : "Show"} tactical notes
              </button>
              {showNotes && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2 max-h-48 overflow-y-auto whitespace-pre-line">
                  {formation.notes.slice(0, 1000)}
                  {(formation.notes.length > 1000) && "..."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
