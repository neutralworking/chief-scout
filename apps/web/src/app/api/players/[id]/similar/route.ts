import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const SOURCE_FIELDS =
  "person_id, name, position, archetype, earned_archetype, overall, best_role, best_role_score, technical_score, physical_score, personality_type, preferred_foot, side, club, nation, image_url, pursuit_status, active, peak" as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Player = Record<string, any>;

/**
 * Legend→Active scoring: skillset-first.
 * Legends often lack best_role, pillar scores, and personality — so we weight
 * archetype (Primary/Secondary model) matching very heavily and use whatever
 * else is available as bonus signal. Max ~100pts.
 */
function scoreLegendToActive(
  src: Player, srcPrimary: string, srcSecondary: string, p: Player,
): number {
  let score = 0;
  const pPrimary = p.archetype?.split("-")[0] ?? "";
  const pSecondary = p.archetype?.split("-")[1] ?? "";

  // 1. Primary model match (40pts — strongest signal for legends)
  if (srcPrimary && pPrimary === srcPrimary) score += 40;
  // 2. Secondary model match (25pts)
  if (srcSecondary && pSecondary === srcSecondary) score += 25;
  // 3. Cross-match: legend secondary = active primary (15pts)
  else if (srcSecondary && pPrimary === srcSecondary) score += 15;
  // 4. Reverse cross: legend primary = active secondary (10pts)
  else if (srcPrimary && pSecondary === srcPrimary) score += 10;

  // 5. Same best_role if both have it (15pts)
  if (src.best_role && p.best_role === src.best_role) score += 15;

  // 6. Earned archetype match (10pts — e.g. both "Wizard")
  if (src.earned_archetype && p.earned_archetype === src.earned_archetype) score += 10;

  // 7. Personality match (5pts)
  if (src.personality_type && p.personality_type === src.personality_type) score += 5;

  // 8. Same preferred foot (5pts)
  if (src.preferred_foot && p.preferred_foot === src.preferred_foot) score += 5;

  // 9. Position match (20pts exact, 8pts adjacent — position matters for "plays like")
  if (src.position && p.position === src.position) {
    score += 20;
  } else if (src.position) {
    const adj: Record<string, string[]> = {
      GK: [], WD: ["WM"], CD: ["DM"], DM: ["CM", "CD"], CM: ["DM", "AM"],
      WM: ["WD", "WF"], AM: ["CM", "WF", "CF"], WF: ["WM", "AM", "CF"], CF: ["AM", "WF"],
    };
    if ((adj[src.position] ?? []).includes(p.position)) score += 8;
  }

  return score;
}

/**
 * Active→Active scoring: balanced across all 8 factors.
 * Same as the original algorithm. Max ~130pts.
 */
function scoreActiveToActive(src: Player, p: Player): number {
  let score = 0;
  const srcRS = src.best_role_score ?? 0;

  // 1. Same best_role (40pts)
  if (src.best_role && p.best_role === src.best_role) score += 40;

  // 2. Role score proximity (max 30pts)
  score += Math.max(0, 30 - Math.abs((p.best_role_score ?? 0) - srcRS));

  // 3. Archetype match (20pts exact, 10pts earned match)
  if (src.archetype && p.archetype === src.archetype) {
    score += 20;
  } else if (src.earned_archetype && p.earned_archetype === src.earned_archetype) {
    score += 10;
  }

  // 4. Four-pillar proximity (max 20pts)
  if (src.technical_score != null && p.technical_score != null) {
    score += Math.max(0, 10 - Math.abs(p.technical_score - src.technical_score) / 3);
  }
  if (src.physical_score != null && p.physical_score != null) {
    score += Math.max(0, 10 - Math.abs(p.physical_score - src.physical_score) / 3);
  }

  // 5. Personality match (5pts)
  if (src.personality_type && p.personality_type === src.personality_type) score += 5;

  // 6. Same side (10pts for wide players)
  if (src.side && src.side !== "C" && p.side === src.side) score += 10;

  // 7. Same preferred foot (5pts)
  if (src.preferred_foot && p.preferred_foot === src.preferred_foot) score += 5;

  // 8. Different club bonus (5pts)
  if (p.club !== src.club) score += 5;

  return score;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = parseInt(id, 10);

  if (!supabaseServer || isNaN(playerId)) {
    return NextResponse.json({ players: [] });
  }

  const { data: source } = await supabaseServer
    .from("player_intelligence_card")
    .select(SOURCE_FIELDS)
    .eq("person_id", playerId)
    .single();

  if (!source?.position) {
    return NextResponse.json({ players: [] });
  }

  const isLegend = !source.active;
  const srcPrimary = source.archetype?.split("-")[0] ?? "";
  const srcSecondary = source.archetype?.split("-")[1] ?? "";

  // Adjacent positions — legends often played across position boundaries
  // (e.g. Maradona CF but really an AM, Beckenbauer CD but really a DM)
  const ADJACENT: Record<string, string[]> = {
    GK: ["GK"],
    WD: ["WD", "WM"],
    CD: ["CD", "DM"],
    DM: ["DM", "CM", "CD"],
    CM: ["CM", "DM", "AM"],
    WM: ["WM", "WD", "WF"],
    AM: ["AM", "CM", "WF", "CF"],
    WF: ["WF", "WM", "AM", "CF"],
    CF: ["CF", "AM", "WF"],
  };

  // ── Fetch candidates ──────────────────────────────────────────────────────
  // For legends: relax filters — search adjacent positions, require archetype not role score
  // For active players: keep existing exact-position + role score filters
  const positions = isLegend
    ? (ADJACENT[source.position] ?? [source.position])
    : [source.position];

  let activeQuery = supabaseServer
    .from("player_intelligence_card")
    .select(SOURCE_FIELDS)
    .in("position", positions)
    .eq("active", true)
    .neq("person_id", playerId);

  if (isLegend) {
    // Legend→active: require archetype + minimum quality floor
    // Peak 96 → min level 87, Peak 92 → min level 85, Peak 88 → min level 83
    const minLevel = Math.max(80, (source.peak ?? 90) - 9);
    activeQuery = activeQuery
      .not("archetype", "is", null)
      .gte("level", minLevel)
      .limit(800);
  } else {
    activeQuery = activeQuery.not("best_role_score", "is", null).limit(500);
  }

  const [activeRes, legendRes] = await Promise.all([
    activeQuery,
    supabaseServer
      .from("player_intelligence_card")
      .select(SOURCE_FIELDS)
      .eq("position", source.position)
      .eq("active", false)
      .not("best_role_score", "is", null)
      .not("archetype", "is", null)
      .gte("peak", 88)
      .limit(200),
  ]);

  const candidates = activeRes.data ?? [];
  if (!candidates.length && !legendRes.data?.length) {
    return NextResponse.json({ players: [], legendComps: [] });
  }

  // ── Scoring ────────────────────────────────────────────────────────────────
  // Two paths: legend-to-active (skillset-first) vs active-to-active (balanced)

  const scored = candidates.map((p) => {
    const score = isLegend
      ? scoreLegendToActive(source, srcPrimary, srcSecondary, p)
      : scoreActiveToActive(source, p);
    return { ...p, similarity: Math.round(score) };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  // ── Legend comparison: match by skillset (Primary model), role, and quality tier ──
  const legends = legendRes.data ?? [];

  const legendScored = legends.map((leg) => {
    let score = 0;
    const legPrimary = leg.archetype?.split("-")[0] ?? "";
    const legSecondary = leg.archetype?.split("-")[1] ?? "";

    // Primary model match (40pts)
    if (srcPrimary && legPrimary === srcPrimary) score += 40;
    // Secondary model match (20pts)
    if (srcSecondary && legSecondary === srcSecondary) score += 20;
    // Cross-match: player secondary = legend primary (15pts)
    else if (srcSecondary && legPrimary === srcSecondary) score += 15;
    // Same best_role (30pts)
    if (source.best_role && leg.best_role === source.best_role) score += 30;
    // Personality match (10pts)
    if (source.personality_type && leg.personality_type === source.personality_type) score += 10;

    return { ...leg, similarity: Math.round(score) };
  });

  legendScored.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({
    players: scored.slice(0, 5),
    legendComps: legendScored.slice(0, 2).filter((l) => l.similarity >= 40),
  });
}
