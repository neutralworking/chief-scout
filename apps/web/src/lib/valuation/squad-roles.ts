/**
 * Squad Roles Engine — TypeScript port of 30_squad_roles.py
 *
 * Assigns squad roles based on level, peak, trajectory:
 *   Key Player → Important Player → Rotation → Backup → Youth → Surplus
 *
 * Writes: player_status.squad_role
 */

import type { SupabaseClient } from "@supabase/supabase-js";

function determineRole(
  level: number,
  peak: number,
  trajectory: string,
): string {
  const gap = peak - level;

  if (level >= 88) return "Key Player";
  if (level >= 86 && (trajectory === "rising" || trajectory === "peak" || !trajectory)) return "Key Player";
  if (level >= 86 && trajectory === "declining") return "Important Player";
  if (level >= 84) return "Important Player";
  if (level >= 82 && gap >= 5 && trajectory === "rising") return "Important Player";
  if (level >= 78) return "Rotation";
  if (level >= 73) return gap >= 8 ? "Youth" : "Backup";
  if (gap >= 8) return "Youth";
  if (level >= 68) return "Backup";

  let role = "Surplus";

  // Override: declining veterans with no ceiling
  if (trajectory === "declining" && gap <= 1 && level < 82) {
    role = "Surplus";
  }

  return role;
}

export interface SquadRolesResult {
  evaluated: number;
  changed: number;
  written: number;
  errors: string[];
  breakdown: Record<string, number>;
}

export async function runSquadRoles(sb: SupabaseClient): Promise<SquadRolesResult> {
  const result: SquadRolesResult = { evaluated: 0, changed: 0, written: 0, errors: [], breakdown: {} };

  // Load profiles with levels
  const { data: profiles, error: profileErr } = await sb
    .from("player_profiles")
    .select("person_id, position, level, peak")
    .not("level", "is", null);

  if (profileErr || !profiles) {
    result.errors.push(profileErr?.message ?? "No player data");
    return result;
  }

  const personIds = (profiles as { person_id: number }[]).map((p) => p.person_id);

  // Load statuses and career metrics separately (avoids FK join issues)
  const { data: statuses } = await sb
    .from("player_status")
    .select("person_id, squad_role")
    .in("person_id", personIds);

  const { data: careers } = await sb
    .from("career_metrics")
    .select("person_id, trajectory")
    .in("person_id", personIds);

  const statusMap: Record<number, string | null> = {};
  for (const s of (statuses ?? []) as { person_id: number; squad_role: string | null }[]) {
    statusMap[s.person_id] = s.squad_role;
  }

  const trajectoryMap: Record<number, string | null> = {};
  for (const c of (careers ?? []) as { person_id: number; trajectory: string | null }[]) {
    trajectoryMap[c.person_id] = c.trajectory;
  }

  // Ensure player_status rows exist for all players with levels
  const missingStatusIds = personIds.filter((id) => !(id in statusMap));

  if (missingStatusIds.length > 0) {
    const rows = missingStatusIds.map((id) => ({ person_id: id }));
    for (let i = 0; i < rows.length; i += 200) {
      await sb.from("player_status").upsert(rows.slice(i, i + 200), { onConflict: "person_id" });
    }
  }

  // Evaluate roles
  const updates: { person_id: number; squad_role: string }[] = [];

  for (const p of profiles as { person_id: number; level: number; peak: number | null }[]) {
    const level = p.level;
    const peak = p.peak ?? level;
    const oldRole = statusMap[p.person_id] ?? "";
    const trajectory = trajectoryMap[p.person_id] ?? "";

    result.evaluated++;
    const newRole = determineRole(level, peak, trajectory);
    result.breakdown[newRole] = (result.breakdown[newRole] ?? 0) + 1;

    if (newRole !== oldRole) {
      result.changed++;
      updates.push({ person_id: p.person_id as number, squad_role: newRole });
    }
  }

  // Write
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    const { error } = await sb.from("player_status").upsert(chunk, { onConflict: "person_id" });
    if (error) result.errors.push(error.message);
    else result.written += chunk.length;
  }

  return result;
}
