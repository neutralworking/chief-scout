import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS } from "@/lib/types";
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
  personality_type: string | null;
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

  // Fetch tactical_roles separately with error handling (table may not exist)
  let roles: TacticalRole[] = [];
  try {
    const rolesResult = await supabaseServer
      .from("tactical_roles")
      .select("id, name, position, description, primary_archetype, secondary_archetype");
    roles = (rolesResult.data ?? []) as TacticalRole[];
  } catch {
    // Table doesn't exist yet — continue without roles
  }

  const [formationsResult, slotsResult, playersResult] = await Promise.all([
    supabaseServer.from("formations").select("id, name, structure, notes, era, position_count").order("name"),
    supabaseServer.from("formation_slots").select("formation_id, position, slot_count, slot_label, role_id"),
    supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, position, club, level, archetype, pursuit_status, personality_type")
      .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"])
      .order("level", { ascending: false }),
  ]);

  const formations = (formationsResult.data ?? []) as Formation[];
  const allSlots = (slotsResult.data ?? []) as FormationSlot[];
  const players = (playersResult.data ?? []) as TrackedPlayer[];

  // Build role lookups
  const rolesById: Record<number, TacticalRole> = {};
  const rolesByPosition: Record<string, TacticalRole[]> = {};
  for (const role of roles) {
    rolesById[role.id] = role;
    if (!rolesByPosition[role.position]) rolesByPosition[role.position] = [];
    rolesByPosition[role.position].push(role);
  }

  // Group slots by formation
  const slotsByFormation = new Map<number, FormationSlot[]>();
  for (const slot of allSlots) {
    const existing = slotsByFormation.get(slot.formation_id) ?? [];
    existing.push(slot);
    slotsByFormation.set(slot.formation_id, existing);
  }

  // Group players by position
  const playersByPosition: Record<string, TrackedPlayer[]> = {};
  for (const pos of POSITIONS) {
    playersByPosition[pos] = players.filter((p) => p.position === pos);
  }

  // Formations with slots (sorted by name)
  const formationsWithSlots = formations
    .filter((f) => slotsByFormation.has(f.id))
    .map((f) => ({ ...f, slots: slotsByFormation.get(f.id)! }));

  // Unmapped formations
  const unmappedFormations = formations.filter((f) => !slotsByFormation.has(f.id));

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Formations</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">
        {formationsWithSlots.length} formations mapped &middot; {players.length} tracked players &middot; {roles.length} tactical roles
      </p>

      {formationsWithSlots.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <p className="text-sm text-[var(--text-secondary)]">
            No formation slots mapped yet. Run pipeline script 13 to populate.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {formationsWithSlots.map((f) => (
            <FormationDetail
              key={f.id}
              formation={f}
              slots={f.slots}
              fit={0}
              playersByPosition={playersByPosition}
              rolesMap={rolesById}
              rolesByPosition={rolesByPosition}
            />
          ))}
        </div>
      )}

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
