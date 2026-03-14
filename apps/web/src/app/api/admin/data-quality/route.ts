import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const alerts: Array<{ severity: "red" | "amber" | "green"; label: string; count: number; detail?: string }> = [];

  // Run all checks in parallel
  const [
    noPositionResult,
    noClubResult,
    noDobResult,
    archetypeNoLevelResult,
    levelNoPositionResult,
    emptyNewsResult,
    orphanTagsResult,
    duplicateNamesResult,
  ] = await Promise.all([
    // Players with level but no position
    supabaseServer.rpc("exec_sql", {
      query: `SELECT count(*) as cnt FROM player_profiles WHERE level IS NOT NULL AND position IS NULL`,
    }),
    // People with no club_id
    supabaseServer.rpc("exec_sql", {
      query: `SELECT count(*) as cnt FROM people WHERE club_id IS NULL AND active = true`,
    }),
    // People with no DOB
    supabaseServer.rpc("exec_sql", {
      query: `SELECT count(*) as cnt FROM people WHERE dob IS NULL`,
    }),
    // Profiles with archetype but no level
    supabaseServer.rpc("exec_sql", {
      query: `SELECT count(*) as cnt FROM player_profiles WHERE archetype IS NOT NULL AND level IS NULL`,
    }),
    // Profiles with level but no position
    supabaseServer.rpc("exec_sql", {
      query: `SELECT count(*) as cnt FROM player_profiles WHERE level IS NOT NULL AND position IS NULL`,
    }),
    // News stories with no headline
    supabaseServer.rpc("exec_sql", {
      query: `SELECT count(*) as cnt FROM news_stories WHERE headline IS NULL OR headline = ''`,
    }),
    // Orphan news tags (pointing to non-existent people)
    supabaseServer.rpc("exec_sql", {
      query: `SELECT count(*) as cnt FROM news_player_tags npt LEFT JOIN people p ON p.id = npt.player_id WHERE p.id IS NULL`,
    }),
    // Duplicate names (exact match, more than 1)
    supabaseServer.rpc("exec_sql", {
      query: `SELECT count(*) as cnt FROM (SELECT name FROM people WHERE active = true GROUP BY name HAVING count(*) > 1) sub`,
    }),
  ]);

  function getCount(result: { data: unknown }): number {
    const rows = result.data as Array<{ cnt: number }>;
    return rows?.[0]?.cnt ?? 0;
  }

  const noPosition = getCount(noPositionResult);
  if (noPosition > 0) alerts.push({ severity: "amber", label: "Players with level but no position", count: noPosition });

  const noClub = getCount(noClubResult);
  if (noClub > 50) alerts.push({ severity: "amber", label: "Active players with no club", count: noClub });
  else if (noClub > 0) alerts.push({ severity: "green", label: "Active players with no club", count: noClub });

  const noDob = getCount(noDobResult);
  if (noDob > 1000) alerts.push({ severity: "amber", label: "Players missing DOB", count: noDob });
  else if (noDob > 0) alerts.push({ severity: "green", label: "Players missing DOB", count: noDob });

  const archetypeNoLevel = getCount(archetypeNoLevelResult);
  if (archetypeNoLevel > 0) alerts.push({ severity: "red", label: "Archetype set but no level", count: archetypeNoLevel, detail: "Archetype without level is invalid" });

  const emptyNews = getCount(emptyNewsResult);
  if (emptyNews > 0) alerts.push({ severity: "amber", label: "News stories with empty headline", count: emptyNews });

  const orphanTags = getCount(orphanTagsResult);
  if (orphanTags > 0) alerts.push({ severity: "red", label: "Orphan news tags (deleted players)", count: orphanTags });

  const dupeNames = getCount(duplicateNamesResult);
  if (dupeNames > 10) alerts.push({ severity: "amber", label: "Duplicate player names", count: dupeNames });
  else if (dupeNames > 0) alerts.push({ severity: "green", label: "Duplicate player names", count: dupeNames });

  // Sort: red first, then amber, then green
  const order = { red: 0, amber: 1, green: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return NextResponse.json({ alerts });
}
