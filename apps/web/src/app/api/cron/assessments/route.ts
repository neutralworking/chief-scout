import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import {
  computeTechnical,
  computeTactical,
  computeMental,
  computePhysical,
  computeAvailability,
  computeOverall,
} from "@/lib/assessment/four-pillars";
import { computeAge } from "@/lib/types";
import { MODEL_ATTRIBUTES, ATTR_ALIASES, SOURCE_PRIORITY, SOURCE_SCALE } from "@/lib/models";
import { computeTraitProfileScore } from "@/lib/assessment/trait-role-impact";

export const maxDuration = 300; // 5 minutes for batch processing

/** Paginated fetch — Supabase caps at 1,000 rows per request */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(
  query: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await query().range(offset, offset + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    if (!result.data || result.data.length === 0) break;
    all.push(...(result.data as T[]));
    if (result.data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

export async function GET(req: NextRequest) {
  // Auth
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const isAdminCall = req.headers.get("x-admin") === "1";

  if (cronSecret && !isAdminCall && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = supabaseServer;
  const started = Date.now();

  // ── Bulk fetch all data (paginated) ─────────────────────────────────────

  type Profile = { person_id: number; level: number | null; position: string | null; archetype: string | null; personality_type: string | null; dob: string | null; ei: number | null; sn: number | null; tf: number | null; jp: number | null; competitiveness: number | null; coachability: number | null };
  type Grade = { player_id: number; attribute: string; scout_grade: number | null; stat_score: number | null; source: string | null };
  type Personality = { person_id: number; competitiveness: number | null; coachability: number | null };
  type Status = { person_id: number; mental_tag: string | null; fitness_tag: string | null };
  type Trait = { player_id: number; trait: string; category: string; severity: number };
  type AfStat = { person_id: number; minutes: number | null; appearances: number | null; duels_total: number | null; duels_won: number | null };
  type FbrefLink = { person_id: number; external_id: string };
  type FbrefStat = { fbref_id: string; minutes: number | null; matches_played: number | null };
  type Height = { id: number; height_cm: number | null };

  let profiles: Profile[];
  let allGrades: Grade[];
  try {
    [profiles, allGrades] = await Promise.all([
      fetchAll<Profile>(() => sb.from("player_intelligence_card")
        .select("person_id, level, position, archetype, personality_type, dob, ei, sn, tf, jp, competitiveness, coachability")),
      fetchAll<Grade>(() => sb.from("attribute_grades")
        .select("player_id, attribute, scout_grade, stat_score, source")),
    ]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  if (profiles.length === 0) {
    return NextResponse.json({ ok: true, computed: 0, message: "No profiles found" });
  }

  // Smaller tables can fetch in parallel (all under 25k rows)
  const [allPersonalities, allStatuses, allTraits, allAfStats, allFbrefLinks, allFbrefStats, allHeights] = await Promise.all([
    fetchAll<Personality>(() => sb.from("player_personality").select("person_id, competitiveness, coachability")),
    fetchAll<Status>(() => sb.from("player_status").select("person_id, mental_tag, fitness_tag")),
    fetchAll<Trait>(() => sb.from("player_trait_scores").select("player_id, trait, category, severity")),
    fetchAll<AfStat>(() => sb.from("api_football_player_stats").select("person_id, minutes, appearances, duels_total, duels_won").order("season", { ascending: false })),
    fetchAll<FbrefLink>(() => sb.from("player_id_links").select("person_id, external_id").eq("source", "fbref")),
    fetchAll<FbrefStat>(() => sb.from("fbref_player_season_stats").select("fbref_id, minutes, matches_played").order("season", { ascending: false })),
    fetchAll<Height>(() => sb.from("people").select("id, height_cm")),
  ]);

  // ── Index all data by person_id ────────────────────────────────────────

  // Grades: group by player_id
  const gradesByPlayer = new Map<number, Grade[]>();
  for (const g of allGrades) {
    const pid = g.player_id;
    if (!gradesByPlayer.has(pid)) gradesByPlayer.set(pid, []);
    gradesByPlayer.get(pid)!.push(g);
  }

  // Personalities
  const personalityMap = new Map<number, Personality>();
  for (const p of allPersonalities) personalityMap.set(p.person_id, p);

  // Statuses
  const statusMap = new Map<number, Status>();
  for (const s of allStatuses) statusMap.set(s.person_id, s);

  // Traits: group by player_id
  const traitsByPlayer = new Map<number, Trait[]>();
  for (const t of allTraits) {
    const pid = t.player_id;
    if (!traitsByPlayer.has(pid)) traitsByPlayer.set(pid, []);
    traitsByPlayer.get(pid)!.push(t);
  }

  // AF stats: group by person_id, keep last 3 seasons
  const afByPlayer = new Map<number, AfStat[]>();
  for (const s of allAfStats) {
    const pid = s.person_id;
    if (!afByPlayer.has(pid)) afByPlayer.set(pid, []);
    const arr = afByPlayer.get(pid)!;
    if (arr.length < 3) arr.push(s);
  }

  // FBRef links: person_id → fbref_id
  const fbrefIdMap = new Map<number, string>();
  for (const link of allFbrefLinks) fbrefIdMap.set(link.person_id, link.external_id);

  // FBRef stats: group by fbref_id, keep last 3 seasons
  const fbrefByFbrefId = new Map<string, FbrefStat[]>();
  for (const s of allFbrefStats) {
    const fid = s.fbref_id;
    if (!fbrefByFbrefId.has(fid)) fbrefByFbrefId.set(fid, []);
    const arr = fbrefByFbrefId.get(fid)!;
    if (arr.length < 3) arr.push(s);
  }

  // Heights
  const heightMap = new Map<number, number | null>();
  for (const h of allHeights) heightMap.set(h.id, h.height_cm);

  // ── Compute pillar scores for each player ──────────────────────────────

  const updates: Array<{
    person_id: number;
    technical_score: number;
    tactical_score: number;
    mental_score: number;
    physical_score: number;
    overall_pillar_score: number;
    pillar_updated_at: string;
  }> = [];

  const now = new Date().toISOString();

  for (const profile of profiles) {
    const pid = profile.person_id;
    const grades = gradesByPlayer.get(pid) ?? [];
    const personality = personalityMap.get(pid);
    const status = statusMap.get(pid);
    const traits = traitsByPlayer.get(pid) ?? [];
    const afStats = afByPlayer.get(pid) ?? [];
    const playerLevel = profile.level ?? null;
    const playerPosition = profile.position ?? null;
    const personalityType = profile.personality_type ?? null;
    const archetype = profile.archetype ?? null;
    const age = computeAge(profile.dob ?? null);

    // Skip players with no data at all
    if (grades.length === 0 && !playerLevel) continue;

    // ── Resolve attributes ─────────────────────────────────────────
    const attrBest = new Map<string, { normalized: number; priority: number; source: string }>();
    const sourcesSeen = new Set<string>();

    for (const g of grades) {
      const raw = g.scout_grade ?? g.stat_score ?? 0;
      if (raw <= 0) continue;

      let attr = g.attribute.toLowerCase().replace(/\s+/g, "_");
      attr = ATTR_ALIASES[attr] ?? attr;
      const source = g.source ?? "eafc_inferred";
      const priority = SOURCE_PRIORITY[source] ?? 1;
      sourcesSeen.add(source);

      const scale = g.scout_grade != null ? 20.0 : (SOURCE_SCALE[source] ?? 10.0);
      const normalized = (raw / scale) * 100;

      const existing = attrBest.get(attr);
      if (!existing || priority > existing.priority) {
        attrBest.set(attr, { normalized, priority, source });
      }
    }

    // Model scores
    const modelScores: Record<string, number> = {};
    for (const [model, attrs] of Object.entries(MODEL_ATTRIBUTES)) {
      const vals = attrs
        .map(a => attrBest.get(a)?.normalized)
        .filter((v): v is number => v !== undefined);
      if (vals.length > 0) {
        modelScores[model] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
    }

    // Data weight
    let realSourceAttrs = 0;
    for (const [, best] of attrBest) {
      if (best.source !== "eafc_inferred") realSourceAttrs++;
    }
    const uniqueValues = new Set(Array.from(attrBest.values()).map(b => Math.round(b.normalized)));
    const isUndifferentiated = uniqueValues.size <= 2 && realSourceAttrs === 0;

    let dataWeight = 0.3;
    if (sourcesSeen.has("scout_assessment")) dataWeight = 1.0;
    else if (sourcesSeen.has("fbref") || sourcesSeen.has("statsbomb")) dataWeight = realSourceAttrs >= 10 ? 0.8 : 0.6;
    else if (sourcesSeen.has("understat")) dataWeight = realSourceAttrs >= 5 ? 0.7 : 0.5;
    else if (!isUndifferentiated) dataWeight = 0.5;

    // ── Technical ───────────────────────────────────────────────────
    const technical = computeTechnical(
      modelScores, playerPosition, playerLevel, dataWeight, Array.from(sourcesSeen),
    );

    // ── Tactical ────────────────────────────────────────────────────
    const tacticalFirstPass = computeTactical({
      level: playerLevel,
      archetype,
      personality_type: personalityType,
      position: playerPosition,
    }, undefined, attrBest);

    const traitScore = traits.length > 0 && tacticalFirstPass.bestRole
      ? computeTraitProfileScore(
          traits as Array<{ trait: string; severity: number }>,
          tacticalFirstPass.bestRole,
        )
      : undefined;

    const tactical = computeTactical({
      level: playerLevel,
      archetype,
      personality_type: personalityType,
      position: playerPosition,
    }, traitScore, attrBest);

    // ── Mental ──────────────────────────────────────────────────────
    const mbtiScores = (profile.tf != null && profile.jp != null)
      ? { tf: profile.tf as number, jp: profile.jp as number }
      : null;

    const mental = computeMental(
      personalityType,
      personality?.competitiveness ?? profile.competitiveness ?? null,
      personality?.coachability ?? profile.coachability ?? null,
      status?.mental_tag ?? null,
      tactical.bestRole,
      mbtiScores,
    );

    // ── Physical ────────────────────────────────────────────────────
    const afSeasons = afStats.map(s => ({
      minutes: s.minutes,
      matches_played: s.appearances,
    }));

    const fbrefId = fbrefIdMap.get(pid);
    const fbrefSeasons = fbrefId ? (fbrefByFbrefId.get(fbrefId) ?? []) : [];

    const maxLen = Math.max(fbrefSeasons.length, afSeasons.length);
    const minuteSeasons: Array<{ minutes: number | null; matches_played: number | null }> = [];
    for (let i = 0; i < maxLen; i++) {
      const fb = fbrefSeasons[i];
      const af = afSeasons[i];
      minuteSeasons.push({
        minutes: Math.max(fb?.minutes ?? 0, af?.minutes ?? 0) || null,
        matches_played: Math.max(fb?.matches_played ?? 0, af?.matches_played ?? 0) || null,
      });
    }

    const availabilityScore = computeAvailability(minuteSeasons);
    const durabilityTrait = traits.find(t => t.trait === "durability" && t.category === "physical");

    let duelWinRate: number | null = null;
    const totalDuels = afStats.reduce((s, r) => s + (r.duels_total ?? 0), 0);
    const wonDuels = afStats.reduce((s, r) => s + (r.duels_won ?? 0), 0);
    if (totalDuels > 0) duelWinRate = wonDuels / totalDuels;

    const physical = computePhysical({
      position: playerPosition,
      age,
      availabilityScore,
      sprinterScore: modelScores["Sprinter"] ?? null,
      powerhouseScore: modelScores["Powerhouse"] ?? null,
      fitnessTag: status?.fitness_tag ?? null,
      durabilitySeverity: durabilityTrait?.severity ?? null,
      duelWinRate,
      heightCm: heightMap.get(pid) ?? null,
    });

    // ── Overall ─────────────────────────────────────────────────────
    const pillars = computeOverall({
      technical: technical.score,
      tactical: tactical.score,
      mental: mental.score,
      physical: physical.score,
    });

    updates.push({
      person_id: pid,
      technical_score: Math.round(technical.score),
      tactical_score: Math.round(tactical.score),
      mental_score: Math.round(mental.score),
      physical_score: Math.round(physical.score),
      overall_pillar_score: Math.round(pillars.overall),
      pillar_updated_at: now,
    });
  }

  // ── Write in chunks ────────────────────────────────────────────────────

  const CHUNK = 500;
  let written = 0;
  const errors: string[] = [];

  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const { error } = await sb
      .from("player_profiles")
      .upsert(chunk, { onConflict: "person_id" });

    if (error) {
      errors.push(`Chunk ${i / CHUNK}: ${error.message}`);
    } else {
      written += chunk.length;
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  return NextResponse.json({
    ok: errors.length === 0,
    stats: {
      profiles_scanned: profiles.length,
      scores_computed: updates.length,
      scores_written: written,
      errors: errors.length,
      elapsed_seconds: parseFloat(elapsed),
    },
    ...(errors.length > 0 ? { errors } : {}),
  });
}
