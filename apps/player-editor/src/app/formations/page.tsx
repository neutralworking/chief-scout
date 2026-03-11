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
  for (const slot of slots) {
    const count = positionCounts[slot.position] ?? 0;
    for (let i = 0; i < slot.slot_count; i++) {
      totalSlots++;
      if (count > i) {
        covered += count > i + 1 ? 1.0 : count === i + 1 ? 0.5 : 0;
        // Simplified: 2+ players for this slot position = 1, exactly matches = 0.5
      }
    }
  }
  // Re-do with cleaner logic
  totalSlots = 0;
  covered = 0;
  for (const slot of slots) {
    const available = positionCounts[slot.position] ?? 0;
    for (let i = 0; i < slot.slot_count; i++) {
      totalSlots++;
      if (available >= slot.slot_count + 1) {
        // More players than slots = fully covered
        covered += 1;
      } else if (available >= slot.slot_count) {
        // Exactly enough = 0.75
        covered += 0.75;
      } else if (available > i) {
        // Some coverage
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

  const [formationsResult, slotsResult, playersResult] = await Promise.all([
    supabaseServer.from("formations").select("id, name, structure, notes, era, position_count").order("name"),
    supabaseServer.from("formation_slots").select("formation_id, position, slot_count"),
    supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, position, club, level, archetype, pursuit_status")
      .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"])
      .order("level", { ascending: false }),
  ]);

  const formations = (formationsResult.data ?? []) as Formation[];
  const allSlots = (slotsResult.data ?? []) as FormationSlot[];
  const players = (playersResult.data ?? []) as TrackedPlayer[];

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

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Formations</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">
        {formationsWithFit.length} formations mapped · {players.length} tracked players
      </p>

      {formationsWithFit.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <p className="text-sm text-[var(--text-secondary)]">
            No formation slots mapped yet. Run migration 011 and pipeline script 13 to populate.
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
