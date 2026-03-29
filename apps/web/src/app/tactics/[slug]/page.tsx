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
  const [clubsResult, formationsResult, rolesResult, playersResult, allFormationsResult, allRolesResult] =
    await Promise.all([
      // Clubs using this philosophy
      supabaseServer
        .from("clubs")
        .select("id, clubname, league_name, short_name")
        .eq("philosophy_id", phil.id)
        .order("clubname"),
      // Formation links
      supabaseServer
        .from("philosophy_formations")
        .select("philosophy_id, formation_id, affinity, notes")
        .eq("philosophy_id", phil.id),
      // Role links
      supabaseServer
        .from("philosophy_roles")
        .select("philosophy_id, role_id, importance, rationale")
        .eq("philosophy_id", phil.id),
      // Top players for fit scoring
      supabaseServer
        .from("player_intelligence_card")
        .select("person_id, name, position, club, level, archetype, personality_type, earned_archetype")
        .not("archetype", "is", null)
        .order("level", { ascending: false })
        .limit(200),
      // All formations for name lookup
      supabaseServer.from("formations").select("id, name"),
      // All tactical roles for name lookup
      supabaseServer.from("tactical_roles").select("id, name, position, description"),
    ]);

  const clubs = clubsResult.data ?? [];
  const formationLinks = (formationsResult.data ?? []) as PhilosophyFormation[];
  const roleLinks = (rolesResult.data ?? []) as PhilosophyRole[];
  const players = playersResult.data ?? [];
  const formations = allFormationsResult.data ?? [];
  const roles = allRolesResult.data ?? [];

  // Fetch systems belonging to this philosophy
  let systems: TacticalSystem[] = [];
  let systemSlots: SystemSlot[] = [];
  let allSlotRoles: SlotRole[] = [];
  try {
    const systemsResult = await supabaseServer
      .from("tactical_systems")
      .select("*")
      .eq("philosophy_id", phil.id)
      .order("name");
    systems = (systemsResult.data ?? []) as TacticalSystem[];

    const systemIds = systems.map((s) => s.id);
    if (systemIds.length > 0) {
      const [slotsRes, rolesRes] = await Promise.all([
        supabaseServer.from("system_slots").select("*").in("system_id", systemIds),
        supabaseServer.from("slot_roles").select("*"),
      ]);
      systemSlots = (slotsRes.data ?? []) as SystemSlot[];
      allSlotRoles = (rolesRes.data ?? []) as SlotRole[];
    }
  } catch {
    // Tables don't exist yet
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
