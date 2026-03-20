/**
 * POST /api/admin/club-analysis
 *
 * Runs squad analysis for a single club or all clubs:
 *   - Position coverage gaps
 *   - Age profile balance
 *   - Level distribution
 *   - Squad role breakdown
 *
 * Body: { club_id?: number }  (omit for all clubs summary)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isProduction } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (isProduction()) return NextResponse.json({}, { status: 404 });
  if (!supabaseServer) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const clubId = body.club_id as number | undefined;

  // Build query for players with club assignments
  let query = supabaseServer
    .from("people")
    .select(`
      id, name, date_of_birth, club_id,
      clubs(id, clubname, league_name),
      player_profiles(position, level, peak, overall, archetype),
      player_status(squad_role)
    `)
    .eq("active", true)
    .not("club_id", "is", null);

  if (clubId) query = query.eq("club_id", clubId);

  const { data: players, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players || players.length === 0) {
    return NextResponse.json({ ok: true, clubs: [], summary: "No players found" });
  }

  const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

  // Group by club
  const clubMap: Record<number, {
    name: string;
    league: string | null;
    players: typeof players;
  }> = {};

  for (const p of players as Record<string, unknown>[]) {
    const cid = p.club_id as number;
    const club = p.clubs as { id: number; clubname: string; league_name: string | null } | null;
    if (!club) continue;
    if (!clubMap[cid]) {
      clubMap[cid] = { name: club.clubname, league: club.league_name, players: [] };
    }
    clubMap[cid].players.push(p as (typeof players)[number]);
  }

  // Analyze each club
  const clubs = Object.entries(clubMap).map(([id, club]) => {
    const squadSize = club.players.length;

    // Position coverage
    const posCounts: Record<string, number> = {};
    for (const pos of POSITIONS) posCounts[pos] = 0;
    for (const p of club.players as Record<string, unknown>[]) {
      const profile = p.player_profiles as { position: string | null } | null;
      const pos = profile?.position;
      if (pos && pos in posCounts) posCounts[pos]++;
    }
    const gaps = POSITIONS.filter((pos) => posCounts[pos] < 2);

    // Age distribution
    const now = Date.now();
    const ages = (club.players as Record<string, unknown>[])
      .map((p) => {
        const dob = p.date_of_birth as string | null;
        return dob ? Math.floor((now - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
      })
      .filter((a): a is number => a != null);
    const avgAge = ages.length > 0 ? +(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : null;
    const u21 = ages.filter((a) => a <= 21).length;
    const prime = ages.filter((a) => a >= 26 && a <= 29).length;
    const veteran = ages.filter((a) => a >= 30).length;

    // Level stats
    const levels = (club.players as Record<string, unknown>[])
      .map((p) => (p.player_profiles as { level: number | null } | null)?.level)
      .filter((l): l is number => l != null);
    const avgLevel = levels.length > 0 ? +(levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1) : null;
    const topLevel = levels.length > 0 ? Math.max(...levels) : null;
    const noLevel = squadSize - levels.length;

    // Squad roles
    const roles: Record<string, number> = {};
    for (const p of club.players as Record<string, unknown>[]) {
      const status = p.player_status as { squad_role: string | null } | null;
      const role = status?.squad_role ?? "Unassigned";
      roles[role] = (roles[role] ?? 0) + 1;
    }

    // Archetype diversity
    const archetypes = new Set<string>();
    for (const p of club.players as Record<string, unknown>[]) {
      const profile = p.player_profiles as { archetype: string | null } | null;
      if (profile?.archetype) archetypes.add(profile.archetype);
    }

    return {
      club_id: Number(id),
      name: club.name,
      league: club.league,
      squad_size: squadSize,
      avg_age: avgAge,
      age_profile: { u21, prime, veteran },
      avg_level: avgLevel,
      top_level: topLevel,
      missing_levels: noLevel,
      position_gaps: gaps,
      position_coverage: posCounts,
      squad_roles: roles,
      archetype_count: archetypes.size,
    };
  });

  // Sort by squad size descending
  clubs.sort((a, b) => b.squad_size - a.squad_size);

  // Summary stats
  const totalClubs = clubs.length;
  const totalPlayers = clubs.reduce((s, c) => s + c.squad_size, 0);
  const clubsWithGaps = clubs.filter((c) => c.position_gaps.length >= 3).length;
  const clubsMissingLevels = clubs.filter((c) => c.missing_levels > 0).length;

  return NextResponse.json({
    ok: true,
    summary: {
      total_clubs: totalClubs,
      total_players: totalPlayers,
      clubs_with_major_gaps: clubsWithGaps,
      clubs_missing_levels: clubsMissingLevels,
    },
    clubs: clubId ? clubs : clubs.slice(0, 50),
  });
}
