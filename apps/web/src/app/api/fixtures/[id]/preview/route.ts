import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { scorePlayerForRole, FORMATION_BLUEPRINTS, SLOT_POSITION_MAP } from "@/lib/formation-intelligence";
import { generateStyleMatchup, formatClubStyle } from "@/lib/style-matchup";
import { computeAge, POSITIONS } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface SquadPlayer {
  person_id: number;
  name: string;
  dob: string | null;
  position: string | null;
  level: number | null;
  archetype: string | null;
  personality_type: string | null;
  squad_role: string | null;
  overall: number | null;
  fitness_tag: string | null;
  disciplinary_tag: string | null;
  scouting_notes: string | null;
}

interface PredictedSlot {
  position: string;
  role: string;
  player: SquadPlayer | null;
  fitScore: number;
  demand: string;
  blueprint: string;
}

interface PositionMatchup {
  position: string;
  homePlayer: SquadPlayer | null;
  awayPlayer: SquadPlayer | null;
  homeLevel: number | null;
  awayLevel: number | null;
  advantage: "home" | "away" | "even";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchClubSquad(clubId: number): Promise<SquadPlayer[]> {
  if (!supabaseServer) return [];
  const sb = supabaseServer;

  // Get player IDs for this club
  const { data: people } = await sb
    .from("people")
    .select("id")
    .eq("club_id", clubId)
    .eq("active", true);

  if (!people?.length) return [];

  const personIds = people.map((p: any) => p.id);

  // Fetch intelligence cards for all players
  const { data: cards } = await sb
    .from("player_intelligence_card")
    .select("person_id, name, dob, position, level, archetype, personality_type, overall")
    .in("person_id", personIds);

  // Fetch status
  const { data: statuses } = await sb
    .from("player_status")
    .select("person_id, squad_role, fitness_tag, disciplinary_tag, scouting_notes")
    .in("person_id", personIds);

  const statusMap = new Map<number, any>();
  for (const s of statuses ?? []) {
    statusMap.set(s.person_id, s);
  }

  return (cards ?? []).map((c) => {
    const status = statusMap.get(c.person_id);
    return {
      person_id: c.person_id,
      name: c.name,
      dob: c.dob,
      position: c.position,
      level: c.level,
      archetype: c.archetype,
      personality_type: c.personality_type,
      overall: c.overall,
      squad_role: status?.squad_role ?? null,
      fitness_tag: status?.fitness_tag ?? null,
      disciplinary_tag: status?.disciplinary_tag ?? null,
      scouting_notes: status?.scouting_notes ?? null,
    };
  });
}

function predictXI(
  squad: SquadPlayer[],
  formation: string | null,
): PredictedSlot[] {
  const blueprint = formation ? FORMATION_BLUEPRINTS[formation] : null;
  if (!blueprint) {
    // Fallback: pick top 11 by overall
    const sorted = [...squad].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
    return sorted.slice(0, 11).map((p) => ({
      position: p.position ?? "?",
      role: p.position ?? "?",
      player: p,
      fitScore: p.level ?? 0,
      demand: "",
      blueprint: "",
    }));
  }

  const slots: PredictedSlot[] = [];
  const used = new Set<number>();

  // For each slot in the formation blueprint, find the best available player
  for (const [position, slotBlueprints] of Object.entries(blueprint.slots)) {
    for (const slotBp of slotBlueprints) {
      const roleName = slotBp.role;

      // Score all available players for this role
      let bestPlayer: SquadPlayer | null = null;
      let bestScore = -Infinity;

      // Valid positions for this formation slot
      const validPositions = SLOT_POSITION_MAP[position] ?? [];

      for (const player of squad) {
        if (used.has(player.person_id)) continue;

        // Exclude injured/long-term/injury-prone players (case-insensitive)
        const ft = (player.fitness_tag ?? "").toLowerCase();
        if (ft === "injured" || ft === "long-term" || ft === "injury prone") continue;

        // Exclude suspended players via disciplinary_tag
        const dt = (player.disciplinary_tag ?? "").toLowerCase();
        if (dt === "suspended") continue;

        // Position constraint: player must be valid for this slot position
        if (!player.position || !validPositions.includes(player.position)) continue;

        const score = scorePlayerForRole(
          {
            level: player.level,
            archetype: player.archetype,
            personality_type: player.personality_type,
            position: player.position,
          },
          roleName,
        );

        if (score > bestScore) {
          bestScore = score;
          bestPlayer = player;
        }
      }

      if (bestPlayer) {
        used.add(bestPlayer.person_id);
      }

      slots.push({
        position,
        role: roleName,
        player: bestPlayer,
        fitScore: bestScore > -Infinity ? bestScore : 0,
        demand: slotBp.demand,
        blueprint: slotBp.blueprint,
      });
    }
  }

  return slots;
}

function computePositionMatchups(
  homeXI: PredictedSlot[],
  awayXI: PredictedSlot[],
): PositionMatchup[] {
  const matchups: PositionMatchup[] = [];
  const positionGroups = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];

  for (const pos of positionGroups) {
    const homePlayers = homeXI.filter((s) => s.position === pos);
    const awayPlayers = awayXI.filter((s) => s.position === pos);

    if (homePlayers.length === 0 && awayPlayers.length === 0) continue;

    const homeTop = homePlayers.sort((a, b) => b.fitScore - a.fitScore)[0] ?? null;
    const awayTop = awayPlayers.sort((a, b) => b.fitScore - a.fitScore)[0] ?? null;

    const homeLevel = homeTop?.player?.overall ?? homeTop?.player?.level ?? null;
    const awayLevel = awayTop?.player?.overall ?? awayTop?.player?.level ?? null;
    const diff = (homeLevel ?? 0) - (awayLevel ?? 0);
    const advantage: "home" | "away" | "even" =
      diff > 2 ? "home" : diff < -2 ? "away" : "even";

    matchups.push({
      position: pos,
      homePlayer: homeTop?.player ?? null,
      awayPlayer: awayTop?.player ?? null,
      homeLevel,
      awayLevel,
      advantage,
    });
  }

  return matchups;
}

function computeSquadProfile(squad: SquadPlayer[]) {
  const withLevel = squad.filter((p) => p.overall != null || p.level != null);
  const avgLevel = withLevel.length
    ? withLevel.reduce((sum, p) => sum + (p.overall ?? p.level ?? 0), 0) / withLevel.length
    : 0;

  const withAge = squad
    .map((p) => ({ ...p, age: computeAge(p.dob) }))
    .filter((p) => p.age != null);
  const avgAge = withAge.length
    ? withAge.reduce((sum, p) => sum + (p.age ?? 0), 0) / withAge.length
    : 0;

  // Archetype distribution
  const archetypes: Record<string, number> = {};
  for (const p of squad) {
    if (p.archetype) {
      archetypes[p.archetype] = (archetypes[p.archetype] ?? 0) + 1;
    }
  }

  // Position distribution
  const positions: Record<string, number> = {};
  for (const p of squad) {
    if (p.position) {
      positions[p.position] = (positions[p.position] ?? 0) + 1;
    }
  }

  // Key players (top 3 by overall)
  const keyPlayers = [...squad]
    .sort((a, b) => (b.overall ?? b.level ?? 0) - (a.overall ?? a.level ?? 0))
    .slice(0, 3);

  return {
    size: squad.length,
    avgLevel: Math.round(avgLevel * 10) / 10,
    avgAge: Math.round(avgAge * 10) / 10,
    archetypes,
    positions,
    keyPlayers,
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { id } = await params;
  const fixtureId = parseInt(id, 10);

  // Fetch the fixture
  const { data: fixture, error } = await supabaseServer
    .from("fixtures")
    .select("*")
    .eq("id", fixtureId)
    .single();

  if (error || !fixture) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  // Fetch clubs with philosophy + formation data
  const clubIds = [fixture.home_club_id, fixture.away_club_id].filter(Boolean);
  const { data: clubsData } = await supabaseServer
    .from("clubs")
    .select("id, clubname, short_name, logo_url, league_name, stadium, stadium_capacity, power_rating, philosophy_id")
    .in("id", clubIds);

  const clubMap = new Map<number, any>();
  for (const c of (clubsData ?? []) as any[]) {
    clubMap.set(c.id, c);
  }

  // Fetch philosophy + primary formation for clubs that have a philosophy
  const philIds = (clubsData ?? []).map((c: any) => c.philosophy_id).filter(Boolean);
  const [{ data: philData }, { data: philFormData }] = await Promise.all([
    philIds.length > 0
      ? supabaseServer.from("tactical_philosophies").select("id, name, slug, pressing_intensity, directness, defensive_depth, possession_orientation").in("id", philIds)
      : Promise.resolve({ data: [] }),
    philIds.length > 0
      ? supabaseServer.from("philosophy_formations").select("philosophy_id, formation_id, formations(name)").eq("affinity", "primary").in("philosophy_id", philIds)
      : Promise.resolve({ data: [] }),
  ]);

  const philMap = new Map<number, any>();
  for (const p of (philData ?? []) as any[]) philMap.set(p.id, p);
  const philFormMap = new Map<number, string>();
  for (const pf of (philFormData ?? []) as any[]) {
    if (!philFormMap.has(pf.philosophy_id)) {
      philFormMap.set(pf.philosophy_id, pf.formations?.name ?? null);
    }
  }

  // Enrich clubs with philosophy-derived style info
  function enrichClub(club: any) {
    if (!club) return null;
    const phil = club.philosophy_id ? philMap.get(club.philosophy_id) : null;
    const formation = club.philosophy_id ? philFormMap.get(club.philosophy_id) ?? null : null;
    // Map philosophy properties to style taxonomy
    const tacticalStyle = phil?.name ?? null;
    const pressing = phil?.pressing_intensity ?? 5;
    const directness = phil?.directness ?? 5;
    const depth = phil?.defensive_depth ?? 5;
    const offensiveStyle = pressing > 7 ? "Overload" : directness > 7 ? "Direct" : directness < 3 ? "Possession" : "Balanced";
    const defensiveStyle = pressing > 8 ? "High Press" : depth > 7 ? "Low Block" : depth < 3 ? "Full Press" : "Balanced";
    return { ...club, formation, tacticalStyle, offensiveStyle: phil ? offensiveStyle : null, defensiveStyle: phil ? defensiveStyle : null };
  }

  const homeClub = enrichClub(fixture.home_club_id ? clubMap.get(fixture.home_club_id) : null);
  const awayClub = enrichClub(fixture.away_club_id ? clubMap.get(fixture.away_club_id) : null);

  // Fetch squads in parallel
  const [homeSquad, awaySquad] = await Promise.all([
    fixture.home_club_id ? fetchClubSquad(fixture.home_club_id) : Promise.resolve([]),
    fixture.away_club_id ? fetchClubSquad(fixture.away_club_id) : Promise.resolve([]),
  ]);

  // Style matchup
  const styleMatchup = generateStyleMatchup(
    {
      name: homeClub?.clubname ?? fixture.home_team,
      formation: homeClub?.formation,
      tacticalStyle: homeClub?.tacticalStyle,
      offensiveStyle: homeClub?.offensiveStyle,
      defensiveStyle: homeClub?.defensiveStyle,
    },
    {
      name: awayClub?.clubname ?? fixture.away_team,
      formation: awayClub?.formation,
      tacticalStyle: awayClub?.tacticalStyle,
      offensiveStyle: awayClub?.offensiveStyle,
      defensiveStyle: awayClub?.defensiveStyle,
    },
  );

  // Predicted XIs
  const homeXI = predictXI(homeSquad, homeClub?.formation);
  const awayXI = predictXI(awaySquad, awayClub?.formation);

  // Position matchups
  const matchups = computePositionMatchups(homeXI, awayXI);

  // Squad profiles
  const homeProfile = computeSquadProfile(homeSquad);
  const awayProfile = computeSquadProfile(awaySquad);

  // Formation blueprint info
  const homeBlueprint = homeClub?.formation ? FORMATION_BLUEPRINTS[homeClub.formation] : null;
  const awayBlueprint = awayClub?.formation ? FORMATION_BLUEPRINTS[awayClub.formation] : null;

  return NextResponse.json({
    fixture,
    homeClub: homeClub
      ? {
          ...homeClub,
          style: formatClubStyle({
            name: homeClub.clubname,
            formation: homeClub.formation,
            tacticalStyle: homeClub.tacticalStyle,
          }),
        }
      : null,
    awayClub: awayClub
      ? {
          ...awayClub,
          style: formatClubStyle({
            name: awayClub.clubname,
            formation: awayClub.formation,
            tacticalStyle: awayClub.tacticalStyle,
          }),
        }
      : null,
    styleMatchup,
    predictedXI: {
      home: homeXI,
      away: awayXI,
    },
    matchups,
    squadProfile: {
      home: homeProfile,
      away: awayProfile,
    },
    formationBlueprint: {
      home: homeBlueprint ? { definedBy: homeBlueprint.definedBy, philosophy: homeBlueprint.philosophy, era: homeBlueprint.era } : null,
      away: awayBlueprint ? { definedBy: awayBlueprint.definedBy, philosophy: awayBlueprint.philosophy, era: awayBlueprint.era } : null,
    },
  });
}
