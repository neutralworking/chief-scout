import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS } from "@/lib/types";
import { TacticsPage } from "@/components/TacticsPage";
import type { TacticalPhilosophy, PhilosophyFormation, PhilosophyRole } from "@/lib/tactical-philosophies";

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

export default async function TacticsPageRoute() {
  if (!supabaseServer) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Tactics</h1>
        <p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p>
      </div>
    );
  }

  // Fetch tactical_roles with error handling
  let roles: TacticalRole[] = [];
  try {
    const rolesResult = await supabaseServer
      .from("tactical_roles")
      .select("id, name, position, description, primary_archetype, secondary_archetype");
    roles = (rolesResult.data ?? []) as TacticalRole[];
  } catch {
    // Table doesn't exist yet
  }

  // Fetch philosophies with error handling
  let philosophies: TacticalPhilosophy[] = [];
  let philosophyFormations: PhilosophyFormation[] = [];
  let philosophyRoles: PhilosophyRole[] = [];
  try {
    const [philResult, pfResult, prResult] = await Promise.all([
      supabaseServer.from("tactical_philosophies").select("*").order("name"),
      supabaseServer.from("philosophy_formations").select("philosophy_id, formation_id, affinity, notes"),
      supabaseServer.from("philosophy_roles").select("philosophy_id, role_id, importance, rationale"),
    ]);
    philosophies = (philResult.data ?? []) as TacticalPhilosophy[];
    philosophyFormations = (pfResult.data ?? []) as PhilosophyFormation[];
    philosophyRoles = (prResult.data ?? []) as PhilosophyRole[];
  } catch {
    // Tables don't exist yet
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

  // Formations with slots
  const formationsWithSlots = formations
    .filter((f) => slotsByFormation.has(f.id))
    .map((f) => ({ ...f, slots: slotsByFormation.get(f.id)! }));

  // Unmapped formations
  const unmappedFormations = formations.filter((f) => !slotsByFormation.has(f.id));

  // Count how many formations each role is used in
  const formationSlotCounts: Record<number, number> = {};
  for (const slot of allSlots) {
    if (slot.role_id) {
      formationSlotCounts[slot.role_id] = (formationSlotCounts[slot.role_id] ?? 0) + 1;
    }
  }

  // Build formation → philosophies map for FormationDetail badges
  const formationPhilosophies: Record<number, Array<{ philosophy: { name: string; slug: string }; affinity: string }>> = {};
  for (const pf of philosophyFormations) {
    const phil = philosophies.find((p) => p.id === pf.philosophy_id);
    if (!phil) continue;
    if (!formationPhilosophies[pf.formation_id]) formationPhilosophies[pf.formation_id] = [];
    formationPhilosophies[pf.formation_id].push({
      philosophy: { name: phil.name, slug: phil.slug },
      affinity: pf.affinity,
    });
  }
  // Sort each formation's philosophies by affinity
  const affinityOrder: Record<string, number> = { primary: 0, secondary: 1, compatible: 2 };
  for (const fid of Object.keys(formationPhilosophies)) {
    formationPhilosophies[Number(fid)].sort((a, b) => (affinityOrder[a.affinity] ?? 3) - (affinityOrder[b.affinity] ?? 3));
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Tactics</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">
        {philosophies.length} philosophies &middot; {formationsWithSlots.length} formations &middot; {roles.length} tactical roles &middot; {players.length} tracked players
      </p>

      <TacticsPage
        philosophies={philosophies}
        philosophyFormations={philosophyFormations}
        philosophyRoles={philosophyRoles}
        formations={formationsWithSlots}
        unmappedFormations={unmappedFormations}
        roles={roles}
        rolesById={rolesById}
        rolesByPosition={rolesByPosition}
        playersByPosition={playersByPosition}
        players={players}
        formationSlotCounts={formationSlotCounts}
        formationPhilosophies={formationPhilosophies}
      />
    </div>
  );
}
