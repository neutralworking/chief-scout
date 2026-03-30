import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS } from "@/lib/types";
import { TacticsPage } from "@/components/TacticsPage";
import type { TacticalPhilosophy, PhilosophyFormation, PhilosophyRole, TacticalSystem, SystemSlot, SlotRole } from "@/lib/tactical-philosophies";

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

  // Fetch philosophies
  let philosophies: TacticalPhilosophy[] = [];
  try {
    const philResult = await supabaseServer.from("tactical_philosophies").select("*").order("name");
    philosophies = (philResult.data ?? []) as TacticalPhilosophy[];
  } catch {
    // Table doesn't exist yet
  }

  // Fetch systems hierarchy (tactical_systems → system_slots → slot_roles)
  let systems: TacticalSystem[] = [];
  let systemSlots: SystemSlot[] = [];
  let slotRoles: SlotRole[] = [];
  try {
    const [systemsResult, systemSlotsResult, slotRolesResult] = await Promise.all([
      supabaseServer.from("tactical_systems").select("*").order("name"),
      supabaseServer.from("system_slots").select("*"),
      supabaseServer.from("slot_roles").select("*"),
    ]);
    systems = (systemsResult.data ?? []) as TacticalSystem[];
    systemSlots = (systemSlotsResult.data ?? []) as SystemSlot[];
    slotRoles = (slotRolesResult.data ?? []) as SlotRole[];
  } catch {
    // Tables don't exist yet
  }

  const [formationsResult, slotsResult, playersResult] = await Promise.all([
    supabaseServer.from("formations").select("id, name, structure, notes, era, position_count").order("name"),
    supabaseServer.from("formation_slots").select("formation_id, position, slot_count, slot_label"),
    supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, position, club, level, archetype, pursuit_status, personality_type")
      .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"])
      .order("level", { ascending: false }),
  ]);

  const formations = (formationsResult.data ?? []) as Formation[];
  const allSlots = (slotsResult.data ?? []) as FormationSlot[];
  const players = (playersResult.data ?? []) as TrackedPlayer[];

  // ── Derive old-shape data from new systems hierarchy ──────────────────────

  // Build slot_id → position map
  const slotPositionMap = new Map<number, string>();
  const slotSystemMap = new Map<number, number>();
  for (const ss of systemSlots) {
    slotPositionMap.set(ss.id, ss.position);
    slotSystemMap.set(ss.id, ss.system_id);
  }

  // Derive TacticalRole[] from unique (role_name, position) in slot_roles
  const derivedRoleMap = new Map<string, TacticalRole>();
  let roleIdCounter = 1;
  for (const sr of slotRoles) {
    const position = slotPositionMap.get(sr.slot_id);
    if (!position) continue;
    const key = `${sr.role_name}|${position}`;
    if (!derivedRoleMap.has(key)) {
      derivedRoleMap.set(key, {
        id: roleIdCounter++,
        name: sr.role_name,
        position,
        description: sr.rationale ?? null,
        primary_archetype: sr.primary_model,
        secondary_archetype: sr.secondary_model,
      });
    }
  }
  const roles: TacticalRole[] = Array.from(derivedRoleMap.values());

  // Derived role lookup: "name|position" → synthetic id
  const derivedRoleByNamePos = new Map<string, number>();
  for (const role of roles) {
    derivedRoleByNamePos.set(`${role.name}|${role.position}`, role.id);
  }

  // system_id → philosophy_id
  const systemPhilMap = new Map<number, number>();
  for (const sys of systems) {
    if (sys.philosophy_id) systemPhilMap.set(sys.id, sys.philosophy_id);
  }

  // Formation name → id
  const allFormationsList = formations;
  const formationNameToId = new Map(allFormationsList.map((f) => [f.name, f.id]));

  // Derive PhilosophyFormation[] from tactical_systems
  const pfSet = new Set<string>();
  const philosophyFormations: PhilosophyFormation[] = [];
  for (const sys of systems) {
    const formationId = formationNameToId.get(sys.formation);
    if (!formationId || !sys.philosophy_id) continue;
    const key = `${sys.philosophy_id}|${formationId}`;
    if (pfSet.has(key)) continue;
    pfSet.add(key);
    philosophyFormations.push({
      philosophy_id: sys.philosophy_id,
      formation_id: formationId,
      affinity: "primary" as const,
      notes: sys.key_principle,
    });
  }

  // Derive PhilosophyRole[] from systems → slots → roles
  const prSet = new Set<string>();
  const philosophyRoles: PhilosophyRole[] = [];
  for (const sr of slotRoles) {
    const systemId = slotSystemMap.get(sr.slot_id);
    if (!systemId) continue;
    const philId = systemPhilMap.get(systemId);
    if (!philId) continue;
    const position = slotPositionMap.get(sr.slot_id);
    if (!position) continue;
    const roleId = derivedRoleByNamePos.get(`${sr.role_name}|${position}`);
    if (!roleId) continue;
    const key = `${philId}|${roleId}`;
    if (prSet.has(key)) continue;
    prSet.add(key);
    philosophyRoles.push({
      philosophy_id: philId,
      role_id: roleId,
      importance: sr.is_default ? "essential" : "preferred",
      rationale: sr.rationale,
    });
  }

  // ── Build lookups ─────────────────────────────────────────────────────────

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

  // Count how many systems/formations use each role
  const formationSlotCounts: Record<number, number> = {};
  const roleFormationSets = new Map<number, Set<string>>();
  for (const sr of slotRoles) {
    const systemId = slotSystemMap.get(sr.slot_id);
    if (!systemId) continue;
    const sys = systems.find((s) => s.id === systemId);
    if (!sys) continue;
    const position = slotPositionMap.get(sr.slot_id);
    if (!position) continue;
    const roleId = derivedRoleByNamePos.get(`${sr.role_name}|${position}`);
    if (!roleId) continue;
    if (!roleFormationSets.has(roleId)) roleFormationSets.set(roleId, new Set());
    roleFormationSets.get(roleId)!.add(sys.formation);
  }
  for (const [roleId, fSet] of roleFormationSets) {
    formationSlotCounts[roleId] = fSet.size;
  }

  // Build formation → philosophies map from tactical_systems
  const formationPhilosophies: Record<number, Array<{ philosophy: { name: string; slug: string }; affinity: string }>> = {};
  for (const sys of systems) {
    const fid = formationNameToId.get(sys.formation);
    if (!fid || !sys.philosophy_id) continue;
    const phil = philosophies.find((p) => p.id === sys.philosophy_id);
    if (!phil) continue;
    if (!formationPhilosophies[fid]) formationPhilosophies[fid] = [];
    if (!formationPhilosophies[fid].some((fp) => fp.philosophy.slug === phil.slug)) {
      formationPhilosophies[fid].push({
        philosophy: { name: phil.name, slug: phil.slug },
        affinity: "primary",
      });
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-lg font-bold tracking-tight mb-0.5">Tactics</h1>
      <p className="text-[10px] text-[var(--text-muted)] mb-4 font-data">
        {philosophies.length} philosophies &middot; {systems.length} systems &middot; {formationsWithSlots.length} formations &middot; {roles.length} roles &middot; {players.length} tracked
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
        systems={systems}
        systemSlots={systemSlots}
        slotRoles={slotRoles}
      />
    </div>
  );
}
