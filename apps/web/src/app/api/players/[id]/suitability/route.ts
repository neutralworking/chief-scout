import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Computes a composite suitability score (1–99) for a player
 * against the club's current needs defined in club_needs.
 *
 * Factors:
 *  - Position match  (0–30 pts)
 *  - Archetype fit   (0–15 pts)
 *  - Foot preference  (0–10 pts)
 *  - Quality (level/peak)  (0–35 pts)
 *  - Scarcity bonus  (0–9 pts)
 *
 * The best-matching need is used (highest score).
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseServer) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const supabase = supabaseServer;
  const { id } = await params;

  const [playerRes, needsRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, position, secondary_position, level, peak, archetype, archetype_override, scarcity_score, preferred_foot")
      .eq("id", id)
      .single(),
    supabase.from("club_needs").select("*").order("priority", { ascending: false }),
  ]);

  if (playerRes.error) {
    const status = playerRes.error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: playerRes.error.message }, { status });
  }

  const player = playerRes.data;
  const needs = needsRes.data ?? [];

  if (needs.length === 0) {
    return NextResponse.json({
      score: null,
      reason: "No club needs defined yet",
      breakdown: [],
      matched_need: null,
    });
  }

  const arch = player.archetype_override ?? player.archetype;

  let bestScore = 0;
  let bestBreakdown: { factor: string; points: number; detail: string }[] = [];
  let bestNeed: Record<string, unknown> | null = null;

  for (const need of needs) {
    const breakdown: { factor: string; points: number; detail: string }[] = [];

    // Position match (0–30)
    const posMatch = player.position === need.position;
    const secMatch = player.secondary_position === need.position;
    const posPts = posMatch ? 30 : secMatch ? 18 : 0;
    breakdown.push({
      factor: "Position",
      points: posPts,
      detail: posMatch ? "Primary match" : secMatch ? "Secondary match" : "No match",
    });

    if (posPts === 0) continue;

    // Archetype fit (0–15)
    let archPts = 7;
    if (need.preferred_archetype) {
      archPts = arch?.toLowerCase() === need.preferred_archetype.toLowerCase() ? 15 : 3;
    }
    breakdown.push({
      factor: "Archetype",
      points: archPts,
      detail: need.preferred_archetype
        ? (archPts === 15 ? `Matches ${need.preferred_archetype}` : `Wanted ${need.preferred_archetype}, got ${arch ?? "none"}`)
        : "No preference",
    });

    // Foot preference (0–10)
    let footPts = 5;
    if (need.preferred_foot && player.preferred_foot) {
      footPts = player.preferred_foot.toLowerCase().includes(need.preferred_foot.toLowerCase()) ? 10 : 2;
    }
    breakdown.push({
      factor: "Foot",
      points: footPts,
      detail: need.preferred_foot
        ? (footPts === 10 ? "Foot matches" : `Wanted ${need.preferred_foot}`)
        : "No preference",
    });

    // Level/Peak quality (0–35, replaces old MVT + Level split)
    const level = player.level ?? 70;
    const peak = player.peak ?? level;
    const best = Math.max(level, peak);
    const qualityPts = Math.min(35, Math.max(0, Math.round((best - 70) * 1.4)));
    breakdown.push({
      factor: "Quality",
      points: qualityPts,
      detail: level ? `Level ${level}, Peak ${peak}` : "No level data",
    });

    // Scarcity bonus (0–9)
    const scarcity = player.scarcity_score ?? 0;
    const scarcityPts = Math.min(9, scarcity * 2);
    breakdown.push({
      factor: "Scarcity",
      points: scarcityPts,
      detail: `Scarcity ${scarcity}/5`,
    });

    const total = breakdown.reduce((s, b) => s + b.points, 0);

    if (total > bestScore) {
      bestScore = total;
      bestBreakdown = breakdown;
      bestNeed = need;
    }
  }

  return NextResponse.json({
    score: bestScore,
    breakdown: bestBreakdown,
    matched_need: bestNeed,
  });
}
