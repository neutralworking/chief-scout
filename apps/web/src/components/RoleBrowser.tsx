"use client";

import { POSITIONS, POSITION_COLORS } from "@/lib/types";
import { ROLE_INTELLIGENCE, getRoleReference } from "@/lib/formation-intelligence";
import { type PhilosophyRole, type TacticalPhilosophy, importanceStyle } from "@/lib/tactical-philosophies";

interface TacticalRole {
  id: number;
  name: string;
  position: string;
  description: string | null;
  primary_archetype: string;
  secondary_archetype: string;
}

interface RoleBrowserProps {
  roles: TacticalRole[];
  philosophyRoleLinks: PhilosophyRole[];
  philosophies: TacticalPhilosophy[];
  formationSlotCounts: Record<number, number>; // role_id → count of formations using it
  onPhilosophyClick?: (slug: string) => void;
}

export function RoleBrowser({
  roles,
  philosophyRoleLinks,
  philosophies,
  formationSlotCounts,
  onPhilosophyClick,
}: RoleBrowserProps) {
  // Group roles by position
  const rolesByPosition = new Map<string, TacticalRole[]>();
  for (const pos of POSITIONS) {
    rolesByPosition.set(pos, []);
  }
  for (const role of roles) {
    const list = rolesByPosition.get(role.position) ?? [];
    list.push(role);
    rolesByPosition.set(role.position, list);
  }

  // Build role → philosophy links map
  const rolePhilosophies = new Map<number, Array<{ philosophy: TacticalPhilosophy; importance: string }>>();
  for (const link of philosophyRoleLinks) {
    const phil = philosophies.find((p) => p.id === link.philosophy_id);
    if (!phil) continue;
    const existing = rolePhilosophies.get(link.role_id) ?? [];
    existing.push({ philosophy: phil, importance: link.importance });
    rolePhilosophies.set(link.role_id, existing);
  }

  return (
    <div className="space-y-4">
      {POSITIONS.map((pos) => {
        const posRoles = rolesByPosition.get(pos) ?? [];
        if (posRoles.length === 0) return null;
        const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";

        return (
          <div key={pos}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white`}>{pos}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{posRoles.length} roles</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {posRoles.map((role) => {
                const reference = getRoleReference(role.name);
                const roleIntel = ROLE_INTELLIGENCE[role.name];
                const philLinks = rolePhilosophies.get(role.id) ?? [];
                const formationCount = formationSlotCounts[role.id] ?? 0;

                return (
                  <div key={role.id} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-2.5">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">{role.name}</h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                          {role.primary_archetype}
                        </span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                          {role.secondary_archetype}
                        </span>
                      </div>
                    </div>

                    {role.description && (
                      <p className="text-[10px] text-[var(--text-secondary)] mb-1.5">{role.description}</p>
                    )}

                    {reference && (
                      <p className="text-[10px] text-[var(--text-muted)] italic mb-1.5">{reference}</p>
                    )}

                    {/* Key attributes from ROLE_INTELLIGENCE */}
                    {roleIntel?.keyAttributes && roleIntel.keyAttributes.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mb-1.5">
                        {roleIntel.keyAttributes.map((attr: string) => (
                          <span key={attr} className="text-[8px] px-1 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                            {attr}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Philosophy + Formation counts */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {formationCount > 0 && (
                        <span className="text-[9px] text-[var(--text-muted)]">{formationCount} formations</span>
                      )}
                      {philLinks.map(({ philosophy, importance }) => (
                        <button
                          key={philosophy.id}
                          onClick={() => onPhilosophyClick?.(philosophy.slug)}
                          className={`text-[8px] px-1 py-0.5 rounded ${importanceStyle(importance)} hover:opacity-80 transition-opacity`}
                        >
                          {philosophy.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
