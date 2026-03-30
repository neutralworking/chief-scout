import { supabaseServer } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { TacticalPhilosophy, PhilosophyFormation, PhilosophyRole, TacticalSystem, SystemSlot, SlotRole } from "@/lib/tactical-philosophies";
import { PhilosophyDetail } from "@/components/PhilosophyDetail";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PhilosophyDetailPage({ params }: Props) {
  const { slug } = await params;

  if (!supabaseServer) {
    return <div className="text-sm text-[var(--text-secondary)]">Supabase not configured.</div>;
  }

  // Fetch philosophy by slug
  const { data: philosophy } = await supabaseServer
    .from("tactical_philosophies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!philosophy) return notFound();

  const phil = philosophy as TacticalPhilosophy;

  // Fetch related data in parallel
  const [clubsResult, playersResult, allFormationsResult, systemsResult] =
    await Promise.all([
      // Clubs using this philosophy
      supabaseServer
        .from("clubs")
        .select("id, clubname, league_name, short_name")
        .eq("philosophy_id", phil.id)
        .order("clubname"),
      // Top players for fit scoring
      supabaseServer
        .from("player_intelligence_card")
        .select("person_id, name, position, club, level, archetype, personality_type, earned_archetype")
        .not("archetype", "is", null)
        .order("level", { ascending: false })
        .limit(200),
      // All formations for name lookup
      supabaseServer.from("formations").select("id, name"),
      // Systems belonging to this philosophy
      supabaseServer
        .from("tactical_systems")
        .select("*")
        .eq("philosophy_id", phil.id)
        .order("name"),
    ]);

  const clubs = clubsResult.data ?? [];
  const players = playersResult.data ?? [];
  const formations = allFormationsResult.data ?? [];
  const systems = (systemsResult.data ?? []) as TacticalSystem[];

  // Fetch system slots + roles for this philosophy's systems
  let systemSlots: SystemSlot[] = [];
  let allSlotRoles: SlotRole[] = [];
  const systemIds = systems.map((s) => s.id);
  if (systemIds.length > 0) {
    const [slotsRes, rolesRes] = await Promise.all([
      supabaseServer.from("system_slots").select("*").in("system_id", systemIds),
      supabaseServer.from("slot_roles").select("*"),
    ]);
    systemSlots = (slotsRes.data ?? []) as SystemSlot[];
    allSlotRoles = (rolesRes.data ?? []) as SlotRole[];
  }

  // Derive formationLinks (PhilosophyFormation[]) from tactical_systems
  const formationNameToId = new Map(formations.map((f: { id: number; name: string }) => [f.name, f.id]));
  const pfSet = new Set<string>();
  const formationLinks: PhilosophyFormation[] = [];
  for (const sys of systems) {
    const formationId = formationNameToId.get(sys.formation);
    if (!formationId) continue;
    const key = `${sys.philosophy_id}|${formationId}`;
    if (pfSet.has(key)) continue;
    pfSet.add(key);
    formationLinks.push({
      philosophy_id: sys.philosophy_id,
      formation_id: formationId,
      affinity: "primary" as const,
      notes: sys.key_principle,
    });
  }

  // Derive roles (RoleInfo[]) from slot_roles + system_slots
  const slotPositionMap = new Map<number, string>();
  for (const ss of systemSlots) slotPositionMap.set(ss.id, ss.position);

  const derivedRoleMap = new Map<string, { id: number; name: string; position: string; description: string | null }>();
  let roleIdCounter = 1;
  for (const sr of allSlotRoles) {
    const position = slotPositionMap.get(sr.slot_id);
    if (!position) continue;
    const key = `${sr.role_name}|${position}`;
    if (!derivedRoleMap.has(key)) {
      derivedRoleMap.set(key, { id: roleIdCounter++, name: sr.role_name, position, description: sr.rationale ?? null });
    }
  }
  const roles = Array.from(derivedRoleMap.values());

  // Derive roleLinks (PhilosophyRole[]) from slots → roles
  const derivedRoleByNamePos = new Map<string, number>();
  for (const r of roles) derivedRoleByNamePos.set(`${r.name}|${r.position}`, r.id);

  const slotSystemMap = new Map<number, number>();
  for (const ss of systemSlots) slotSystemMap.set(ss.id, ss.system_id);

  const prSet = new Set<string>();
  const roleLinks: PhilosophyRole[] = [];
  for (const sr of allSlotRoles) {
    const position = slotPositionMap.get(sr.slot_id);
    if (!position) continue;
    const roleId = derivedRoleByNamePos.get(`${sr.role_name}|${position}`);
    if (!roleId) continue;
    const key = `${phil.id}|${roleId}`;
    if (prSet.has(key)) continue;
    prSet.add(key);
    roleLinks.push({
      philosophy_id: phil.id,
      role_id: roleId,
      importance: sr.is_default ? "essential" : "preferred",
      rationale: sr.rationale,
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-3 py-4">
      <Link
        href="/tactics"
        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-3 inline-block"
      >
        &larr; All Philosophies
      </Link>

      <PhilosophyDetail
        philosophy={phil}
        clubs={clubs}
        formationLinks={formationLinks}
        roleLinks={roleLinks}
        players={players}
        formations={formations}
        roles={roles}
        systems={systems}
        systemSlots={systemSlots}
        slotRoles={allSlotRoles}
      />
    </div>
  );
}
