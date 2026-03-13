import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

function depthRating(count: number): string {
  if (count === 0) return "empty";
  if (count === 1) return "thin";
  if (count === 2) return "adequate";
  return "strong";
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export interface SquadPlayer {
  id: number;
  name: string;
  level: number | null;
  squad_role: string | null;
  loan_status: string | null;
  age: number | null;
  position: string | null;
  secondary_position: string | null;
}

export interface PositionGroup {
  count: number;
  avg_level: number | null;
  best_level: number | null;
  avg_age: number | null;
  depth_rating: string;
  players: SquadPlayer[];
}

export async function getSquadAssessment() {
  const supabase = supabaseServer!;
  // 1. Get club_name
  const { data: settingsData, error: settingsErr } = await supabase
    .from("club_settings")
    .select("key, value")
    .eq("key", "club_name")
    .single();

  if (settingsErr || !settingsData) {
    return { error: "club_name not set in club_settings" };
  }

  const clubName = settingsData.value;

  // 2. Query squad players
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, name, position, secondary_position, level, squad_role, loan_status, date_of_birth")
    .ilike("club", clubName);

  if (playersErr) {
    return { error: playersErr.message };
  }

  // 3. Group by position
  const positions: Record<string, PositionGroup> = {};

  for (const pos of POSITIONS) {
    positions[pos] = {
      count: 0,
      avg_level: null,
      best_level: null,
      avg_age: null,
      depth_rating: "empty",
      players: [],
    };
  }

  for (const p of players ?? []) {
    const age = computeAge(p.date_of_birth);
    const squadPlayer: SquadPlayer = {
      id: p.id,
      name: p.name,
      level: p.level,
      squad_role: p.squad_role,
      loan_status: p.loan_status,
      age,
      position: p.position,
      secondary_position: p.secondary_position,
    };

    // Add to primary position
    if (p.position && positions[p.position]) {
      positions[p.position].players.push(squadPlayer);
    }
  }

  // 4. Compute stats per position
  for (const pos of POSITIONS) {
    const group = positions[pos];
    group.count = group.players.length;
    group.depth_rating = depthRating(group.count);

    if (group.count > 0) {
      const levels = group.players.map(p => p.level).filter((v): v is number => v != null);
      const ages = group.players.map(p => p.age).filter((v): v is number => v != null);

      group.avg_level = levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null;
      group.best_level = levels.length ? Math.max(...levels) : null;
      group.avg_age = ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null;
    }
  }

  return {
    club_name: clubName,
    total: (players ?? []).length,
    positions,
  };
}

export async function GET() {
  const result = await getSquadAssessment();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
