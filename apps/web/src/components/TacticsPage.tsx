"use client";

import { useState, useCallback } from "react";
import { FormationDetail } from "@/components/FormationDetail";
import { PhilosophyCard } from "@/components/PhilosophyCard";
import { RoleBrowser } from "@/components/RoleBrowser";
import type { TacticalPhilosophy, PhilosophyFormation, PhilosophyRole } from "@/lib/tactical-philosophies";

type Tab = "philosophies" | "formations" | "roles";

interface Formation {
  id: number;
  name: string;
  structure: string | null;
  notes: string | null;
  era: string | null;
  position_count: number | null;
}

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

interface TacticsPageProps {
  philosophies: TacticalPhilosophy[];
  philosophyFormations: PhilosophyFormation[];
  philosophyRoles: PhilosophyRole[];
  formations: Array<Formation & { slots: FormationSlot[] }>;
  unmappedFormations: Formation[];
  roles: TacticalRole[];
  rolesById: Record<number, TacticalRole>;
  rolesByPosition: Record<string, TacticalRole[]>;
  playersByPosition: Record<string, TrackedPlayer[]>;
  players: TrackedPlayer[];
  formationSlotCounts: Record<number, number>;
  formationPhilosophies: Record<number, Array<{ philosophy: { name: string; slug: string }; affinity: string }>>;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "philosophies", label: "Philosophies" },
  { key: "formations", label: "Formations" },
  { key: "roles", label: "Roles" },
];

export function TacticsPage({
  philosophies,
  philosophyFormations,
  philosophyRoles,
  formations,
  unmappedFormations,
  roles,
  rolesById,
  rolesByPosition,
  playersByPosition,
  players,
  formationSlotCounts,
  formationPhilosophies,
}: TacticsPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("philosophies");

  // All formations as simple info for PhilosophyCard
  const allFormations = [...formations, ...unmappedFormations].map((f) => ({ id: f.id, name: f.name }));
  const allRoles = roles.map((r) => ({ id: r.id, name: r.name, position: r.position, description: r.description }));

  const handleFormationClick = useCallback((formationName: string) => {
    setActiveTab("formations");
    // Scroll to the formation after a tick
    setTimeout(() => {
      const el = document.getElementById(`formation-${formationName}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  const handlePhilosophyClick = useCallback((slug: string) => {
    setActiveTab("philosophies");
    setTimeout(() => {
      const el = document.getElementById(`philosophy-${slug}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--border-subtle)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-xs font-medium px-3 py-2 border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-[var(--color-accent-tactical)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[9px] text-[var(--text-muted)]">
              {tab.key === "philosophies" && philosophies.length}
              {tab.key === "formations" && formations.length}
              {tab.key === "roles" && roles.length}
            </span>
          </button>
        ))}
      </div>

      {/* Philosophies tab */}
      {activeTab === "philosophies" && (
        <div className="space-y-2">
          {philosophies.map((phil) => (
            <div key={phil.id} id={`philosophy-${phil.slug}`}>
              <PhilosophyCard
                philosophy={phil}
                formationLinks={philosophyFormations.filter((pf) => pf.philosophy_id === phil.id)}
                roleLinks={philosophyRoles.filter((pr) => pr.philosophy_id === phil.id)}
                formations={allFormations}
                roles={allRoles}
                players={players}
                onFormationClick={handleFormationClick}
              />
            </div>
          ))}
        </div>
      )}

      {/* Formations tab */}
      {activeTab === "formations" && (
        <div className="space-y-3">
          {formations.map((f) => (
            <div key={f.id} id={`formation-${f.name}`}>
              <FormationDetail
                formation={f}
                slots={f.slots}
                fit={0}
                playersByPosition={playersByPosition}
                rolesMap={rolesById}
                rolesByPosition={rolesByPosition}
                philosophies={formationPhilosophies[f.id]}
              />
            </div>
          ))}
          {unmappedFormations.length > 0 && (
            <div className="mt-6">
              <h2 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
                Unmapped ({unmappedFormations.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {unmappedFormations.map((f) => (
                  <span
                    key={f.id}
                    className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-1 rounded"
                  >
                    {f.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roles tab */}
      {activeTab === "roles" && (
        <RoleBrowser
          roles={roles}
          philosophyRoleLinks={philosophyRoles}
          philosophies={philosophies}
          formationSlotCounts={formationSlotCounts}
          onPhilosophyClick={handlePhilosophyClick}
        />
      )}
    </div>
  );
}
