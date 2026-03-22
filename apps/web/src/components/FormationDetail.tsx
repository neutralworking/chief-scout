"use client";

import { useState } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { getArchetypeColor } from "@/lib/archetype-styles";
import { scorePlayerForRole, getRoleReference, getFormationBlueprint, getSlotBlueprint, ROLE_INTELLIGENCE, type SlotBlueprint } from "@/lib/formation-intelligence";
import { getRoleIcon, type RoleIcon } from "@/lib/role-icons";
import { RoleIconCard, RoleIconBadge } from "@/components/RoleIconCard";

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
  personality_type: string | null;
}

interface PhilosophyBadge {
  philosophy: { name: string; slug: string };
  affinity: string;
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
  rolesByPosition?: Record<string, TacticalRole[]>;
  philosophies?: PhilosophyBadge[];
}

// Pitch Y positions (0 = GK end, 100 = striker end)
const POSITION_Y: Record<string, number> = {
  GK: 6, CD: 22, WD: 24, DM: 40, CM: 52, WM: 54, AM: 67, WF: 80, CF: 92,
};

const RENDER_ORDER = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];

// Expand a slot row (slot_count=2) into individual expanded slots
interface ExpandedSlot {
  position: string;
  index: number; // 0-based within this position
  total: number; // total count for this position
  label: string;
  role: TacticalRole | null;
  blueprint: SlotBlueprint | null; // formation-specific role + archetype player
}

function expandSlots(
  slots: FormationSlot[],
  rolesMap: Record<number, TacticalRole>,
  rolesByPosition: Record<string, TacticalRole[]>,
  formationName: string
): ExpandedSlot[] {
  const expanded: ExpandedSlot[] = [];

  // Group by position first
  const byPos: Record<string, FormationSlot[]> = {};
  for (const s of slots) {
    if (!byPos[s.position]) byPos[s.position] = [];
    byPos[s.position].push(s);
  }

  for (const pos of RENDER_ORDER) {
    const posSlots = byPos[pos];
    if (!posSlots) continue;

    // Total count for this position across all slot rows
    const totalCount = posSlots.reduce((sum, s) => sum + s.slot_count, 0);
    let idx = 0;

    for (const slot of posSlots) {
      // Get roles for this position
      const posRoles = rolesByPosition[pos] ?? [];

      for (let i = 0; i < slot.slot_count; i++) {
        // Check for formation-specific blueprint first
        const bp = getSlotBlueprint(formationName, pos, idx);

        // Assign role: blueprint > explicit role_id > cycle through position roles
        let role: TacticalRole | null = null;
        if (slot.role_id) {
          role = rolesMap[slot.role_id] ?? null;
        } else if (bp) {
          // Find the matching tactical role by name from the blueprint
          role = posRoles.find(r => r.name === bp.role)
            ?? Object.values(rolesMap).find(r => r.name === bp.role)
            ?? null;
        } else if (posRoles.length > 0) {
          role = posRoles[idx % posRoles.length];
        }

        expanded.push({
          position: pos,
          index: idx,
          total: totalCount,
          label: slot.slot_label ?? pos,
          role,
          blueprint: bp,
        });
        idx++;
      }
    }
  }

  return expanded;
}

function distributeX(count: number): number[] {
  if (count === 1) return [50];
  if (count === 2) return [28, 72];
  if (count === 3) return [18, 50, 82];
  if (count === 4) return [12, 37, 63, 88];
  return Array.from({ length: count }, (_, i) => 10 + (80 / (count - 1)) * i);
}

function bestPlayerForRole(
  players: TrackedPlayer[],
  role: TacticalRole | null,
  alreadyUsed: Set<number>
): TrackedPlayer | null {
  const available = players.filter((p) => !alreadyUsed.has(p.person_id));
  if (available.length === 0) return null;
  if (!role) return available[0]; // highest level (already sorted)

  // Use role intelligence for scoring (archetype + personality + position + level threshold)
  const scored = available.map((p) => {
    const score = scorePlayerForRole(
      {
        level: p.level,
        archetype: p.archetype,
        personality_type: p.personality_type,
        position: p.position,
      },
      role.name
    );
    return { player: p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].player;
}

export function FormationDetail({
  formation,
  slots,
  fit: _fit,
  playersByPosition,
  rolesMap = {},
  rolesByPosition = {},
  philosophies: philosophyBadges,
}: FormationDetailProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeRoleIcon, setActiveRoleIcon] = useState<RoleIcon | null>(null);

  const formationBlueprint = getFormationBlueprint(formation.name);
  const expandedSlots = expandSlots(slots, rolesMap, rolesByPosition, formation.name);
  const totalPlayers = expandedSlots.length;

  // Group expanded slots by position for pitch rendering
  const slotsByPos: Record<string, ExpandedSlot[]> = {};
  for (const s of expandedSlots) {
    if (!slotsByPos[s.position]) slotsByPos[s.position] = [];
    slotsByPos[s.position].push(s);
  }

  // Build pitch dots
  const dots: { x: number; y: number; pos: string; role: TacticalRole | null }[] = [];
  for (const pos of RENDER_ORDER) {
    const posExpanded = slotsByPos[pos];
    if (!posExpanded) continue;
    const y = POSITION_Y[pos] ?? 50;
    const xs = distributeX(posExpanded.length);
    for (let i = 0; i < posExpanded.length; i++) {
      dots.push({ x: xs[i], y, pos, role: posExpanded[i].role });
    }
  }

  // Position summary for header
  const posSummary: { pos: string; count: number }[] = [];
  for (const pos of RENDER_ORDER) {
    if (pos === "GK") continue;
    const count = slotsByPos[pos]?.length ?? 0;
    if (count > 0) posSummary.push({ pos, count });
  }

  // Assign best players per slot
  const usedPlayers = new Set<number>();
  const slotAssignments: { slot: ExpandedSlot; player: TrackedPlayer | null }[] = [];
  for (const slot of expandedSlots) {
    const posPlayers = playersByPosition[slot.position] ?? [];
    const player = bestPlayerForRole(posPlayers, slot.role, usedPlayers);
    if (player) usedPlayers.add(player.person_id);
    slotAssignments.push({ slot, player });
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-elevated)]/30 transition-colors cursor-pointer text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Mini pitch */}
        <div className="w-16 h-20 bg-[var(--bg-base)]/50 rounded border border-[var(--border-subtle)] relative shrink-0 overflow-hidden">
          {dots.map((dot, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]"
              style={{
                left: `${dot.x}%`,
                bottom: `${dot.y}%`,
                transform: "translate(-50%, 50%)",
                opacity: 0.7,
              }}
            />
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{formation.name}</span>
            {formation.era && (
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
                {formation.era}
              </span>
            )}
          </div>
          {formationBlueprint && (
            <p className="text-[10px] text-[var(--color-accent-tactical)] mt-0.5">
              {formationBlueprint.definedBy}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            {posSummary.map(({ pos, count }) => {
              const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
              return (
                <span key={pos} className={`text-[8px] font-bold px-1 py-0.5 rounded ${posColor} text-white`}>
                  {pos}x{count}
                </span>
              );
            })}
            <span className="text-[10px] text-[var(--text-muted)] ml-1">{totalPlayers} players</span>
          </div>
          {philosophyBadges && philosophyBadges.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {philosophyBadges.map(({ philosophy, affinity }) => (
                <span
                  key={philosophy.slug}
                  className={`text-[8px] px-1.5 py-0.5 rounded border ${
                    affinity === "primary"
                      ? "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)] border-[var(--color-accent-tactical)]/30"
                      : affinity === "secondary"
                        ? "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                        : "text-[var(--text-muted)] border-[var(--border-subtle)]"
                  }`}
                >
                  {philosophy.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <span className={`text-[var(--text-muted)] transition-transform text-lg ${expanded ? "rotate-90" : ""}`}>
          &rsaquo;
        </span>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          {/* Formation Blueprint Context */}
          {formationBlueprint && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--bg-base)]/40 border border-[var(--color-accent-tactical)]/20">
              <p className="text-xs font-semibold text-[var(--color-accent-tactical)]">{formationBlueprint.definedBy}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">{formationBlueprint.philosophy}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pitch */}
            <div className="relative bg-[var(--bg-base)]/30 rounded-lg border border-[var(--border-subtle)] aspect-[3/4] overflow-hidden">
              {/* Pitch markings */}
              <div className="absolute inset-0">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--border-subtle)]" />
                <div className="absolute left-1/2 top-1/2 w-16 h-16 -ml-8 -mt-8 rounded-full border border-[var(--border-subtle)]" />
                <div className="absolute left-[20%] right-[20%] top-0 h-[12%] border-b border-l border-r border-[var(--border-subtle)]" />
                <div className="absolute left-[20%] right-[20%] bottom-0 h-[12%] border-t border-l border-r border-[var(--border-subtle)]" />
              </div>
              {/* Player dots with names */}
              {slotAssignments.map(({ slot, player }, i) => {
                const posExpanded = slotsByPos[slot.position];
                const y = POSITION_Y[slot.position] ?? 50;
                const xs = distributeX(posExpanded.length);
                const x = xs[slot.index];
                const posColor = POSITION_COLORS[slot.position] ?? "bg-zinc-700/60";

                return (
                  <div
                    key={i}
                    className="absolute flex flex-col items-center"
                    style={{
                      left: `${x}%`,
                      bottom: `${y}%`,
                      transform: "translate(-50%, 50%)",
                    }}
                  >
                    <div className={`w-4 h-4 rounded-full ${posColor} flex items-center justify-center`}>
                      <span className="text-[6px] font-bold text-white">{slot.position}</span>
                    </div>
                    <span className="text-[7px] font-medium text-[var(--text-secondary)] mt-0.5 whitespace-nowrap max-w-[60px] truncate text-center">
                      {player ? player.name.split(" ").pop() : "–"}
                    </span>
                    {slot.role && (() => {
                      const icon = getRoleIcon(slot.role!.name);
                      return (
                        <span
                          className={`text-[6px] whitespace-nowrap ${icon ? "text-[var(--color-accent-tactical)] cursor-pointer hover:underline" : "text-[var(--text-muted)]"}`}
                          onClick={icon ? (e) => { e.stopPropagation(); setActiveRoleIcon(icon); } : undefined}
                        >
                          {slot.role!.name}
                          {icon && <span className="ml-0.5 opacity-70">&#9733;</span>}
                        </span>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Role + Player mapping */}
            <div>
              <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
                Roles & Players
              </h3>
              <div className="space-y-3">
                {RENDER_ORDER.map((pos) => {
                  const posAssignments = slotAssignments.filter((a) => a.slot.position === pos);
                  if (posAssignments.length === 0) return null;
                  const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";

                  return (
                    <div key={pos}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white`}>
                          {pos}
                        </span>
                      </div>
                      <div className="ml-4 space-y-1.5">
                        {posAssignments.map(({ slot, player }, i) => {
                          const bp = slot.blueprint;
                          const roleRef = bp ? null : (slot.role ? getRoleReference(slot.role.name) : null);
                          return (
                            <div key={i} className={`border-l-2 pl-3 py-0.5 ${bp ? "border-[var(--color-accent-tactical)]/40" : "border-[var(--border-subtle)]"}`}>
                              {/* Role */}
                              <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 flex-wrap">
                                <span>
                                  {bp ? bp.role : (slot.role ? slot.role.name : `${pos} #${slot.index + 1}`)}
                                </span>
                                {!bp && slot.role?.description && (
                                  <span className="text-[var(--text-muted)]/60">— {slot.role.description}</span>
                                )}
                                {(() => {
                                  const roleName = bp ? bp.role : slot.role?.name;
                                  const icon = roleName ? getRoleIcon(roleName) : null;
                                  if (!icon) return null;
                                  return (
                                    <RoleIconBadge
                                      roleName={icon.role}
                                      iconPlayer={icon.iconPlayer}
                                      peakScore={icon.peakScore}
                                      onClick={() => setActiveRoleIcon(icon)}
                                    />
                                  );
                                })()}
                              </div>
                              {/* Blueprint: archetype player + demand */}
                              {bp && (
                                <div className="mt-0.5">
                                  <span className="text-[10px] font-semibold text-[var(--color-accent-personality)]">{bp.blueprint}</span>
                                  <span className="text-[9px] text-[var(--text-muted)] ml-1.5">— {bp.demand}</span>
                                </div>
                              )}
                              {/* Generic historical reference (only when no blueprint) */}
                              {roleRef && (
                                <div className="text-[9px] italic text-[var(--color-accent-tactical)] mt-0.5">
                                  {roleRef}
                                </div>
                              )}
                              {/* Assigned player */}
                              {player ? (
                                <Link
                                  href={`/players/${player.person_id}`}
                                  className="flex items-center gap-2 text-xs hover:text-white transition-colors mt-0.5"
                                >
                                  <span className="text-[var(--text-primary)] font-medium">{player.name}</span>
                                  {player.level != null && (
                                    <span className="text-[10px] font-mono text-[var(--text-muted)]">OVR {player.level}</span>
                                  )}
                                  {player.archetype && (
                                    <span className="text-[9px]" style={{ color: getArchetypeColor(player.archetype) }}>{player.archetype}</span>
                                  )}
                                  {player.personality_type && slot.role && (() => {
                                    const intel = ROLE_INTELLIGENCE[slot.role!.name];
                                    const pIdx = intel?.personalities.indexOf(player.personality_type!) ?? -1;
                                    const alignColor = pIdx === 0 ? "text-green-400" : pIdx === 1 ? "text-amber-400" : pIdx === 2 ? "text-[var(--color-accent-personality)]" : "text-[var(--text-muted)]";
                                    return (
                                      <span className={`text-[9px] font-mono font-bold ${alignColor}`} title={pIdx >= 0 ? `Personality fit: ${pIdx === 0 ? "ideal" : pIdx === 1 ? "good" : "fair"}` : "Personality mismatch"}>
                                        {player.personality_type}
                                      </span>
                                    );
                                  })()}
                                  {player.personality_type && !slot.role && (
                                    <span className="text-[9px] font-mono text-[var(--color-accent-personality)]">{player.personality_type}</span>
                                  )}
                                  {player.club && (
                                    <span className="text-[9px] text-[var(--text-muted)]">{player.club}</span>
                                  )}
                                </Link>
                              ) : (
                                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">No tracked player</p>
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

          {/* Notes */}
          {formation.notes && (
            <details className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <summary className="text-[10px] text-[var(--color-accent-personality)] cursor-pointer hover:underline">
                Tactical notes
              </summary>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2 whitespace-pre-line">
                {formation.notes}
              </p>
            </details>
          )}
        </div>
      )}

      {/* Role Icon Modal */}
      {activeRoleIcon && (
        <RoleIconCard
          icon={activeRoleIcon}
          onClose={() => setActiveRoleIcon(null)}
        />
      )}
    </div>
  );
}
