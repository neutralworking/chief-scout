import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS, POSITION_COLORS } from "@/lib/types";
import { FormationDetail } from "@/components/FormationDetail";

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
}

function computeFitScore(
  slots: FormationSlot[],
  positionCounts: Record<string, number>
): number {
  if (slots.length === 0) return 0;
  let totalSlots = 0;
  let covered = 0;
  // Aggregate slots by position for counting
  const posNeeded: Record<string, number> = {};
  for (const slot of slots) {
    posNeeded[slot.position] = (posNeeded[slot.position] ?? 0) + slot.slot_count;
  }
  for (const [pos, needed] of Object.entries(posNeeded)) {
    const available = positionCounts[pos] ?? 0;
    for (let i = 0; i < needed; i++) {
      totalSlots++;
      if (available >= needed + 1) {
        covered += 1;
      } else if (available >= needed) {
        covered += 0.75;
      } else if (available > i) {
        covered += 0.5;
      }
    }
  }
  return totalSlots > 0 ? Math.round((covered / totalSlots) * 100) : 0;
}

export default async function FormationsPage() {
  if (!supabaseServer) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Formations</h1>
        <p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  const [formationsResult, slotsResult, rolesResult, playersResult] = await Promise.all([
    supabaseServer.from("formations").select("id, name, structure, notes, era, position_count").order("name"),
    supabaseServer.from("formation_slots").select("formation_id, position, slot_count, slot_label, role_id"),
    supabaseServer.from("tactical_roles").select("id, name, position, description, primary_archetype, secondary_archetype"),
    supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, position, club, level, archetype, pursuit_status")
      .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"])
      .order("level", { ascending: false }),
  ]);

  const formations = (formationsResult.data ?? []) as Formation[];
  const allSlots = (slotsResult.data ?? []) as FormationSlot[];
  const roles = (rolesResult.data ?? []) as TacticalRole[];
  const players = (playersResult.data ?? []) as TrackedPlayer[];

  // Build role lookup
  const rolesById = new Map<number, TacticalRole>();
  for (const role of roles) {
    rolesById.set(role.id, role);
  }

  // Group slots by formation
  const slotsByFormation = new Map<number, FormationSlot[]>();
  for (const slot of allSlots) {
    const existing = slotsByFormation.get(slot.formation_id) ?? [];
    existing.push(slot);
    slotsByFormation.set(slot.formation_id, existing);
  }

  // Count tracked players by position
  const positionCounts: Record<string, number> = {};
  for (const pos of POSITIONS) {
    positionCounts[pos] = players.filter((p) => p.position === pos).length;
  }

  // Group players by position for slot mapping
  const playersByPosition: Record<string, TrackedPlayer[]> = {};
  for (const pos of POSITIONS) {
    playersByPosition[pos] = players.filter((p) => p.position === pos);
  }

  // Compute fit scores and sort
  const formationsWithFit = formations
    .filter((f) => slotsByFormation.has(f.id))
    .map((f) => {
      const slots = slotsByFormation.get(f.id) ?? [];
      const fit = computeFitScore(slots, positionCounts);
      return { ...f, slots, fit };
    })
    .sort((a, b) => b.fit - a.fit);

  // Formations without slots (unmapped)
  const unmappedFormations = formations.filter((f) => !slotsByFormation.has(f.id));

  // Serialize roles map for client
  const rolesMap: Record<number, TacticalRole> = {};
  for (const [id, role] of rolesById) {
    rolesMap[id] = role;
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Formations</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">
        {formationsWithFit.length} formations mapped · {players.length} tracked players · {roles.length} tactical roles
      </p>

      {formationsWithFit.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <p className="text-sm text-[var(--text-secondary)]">
            No formation slots mapped yet. Run migration 018 and pipeline script 13 to populate.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {formationsWithFit.map((f) => (
            <FormationDetail
              key={f.id}
              formation={f}
              slots={f.slots}
              fit={f.fit}
              playersByPosition={playersByPosition}
              rolesMap={rolesMap}
            />
          ))}
        </div>
      )}

      {/* Unmapped formations */}
      {unmappedFormations.length > 0 && (
        <div className="mt-8">
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
  );
}
