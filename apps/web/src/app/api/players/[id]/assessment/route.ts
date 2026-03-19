import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import {
  computeTechnical,
  computeTactical,
  computeMental,
  computePhysical,
  computeCommercialModifier,
  computeOverall,
  computeAvailability,
  type FullAssessment,
} from "@/lib/assessment/four-pillars";
import { computeAge } from "@/lib/types";
import { MODEL_ATTRIBUTES, ATTR_ALIASES, SOURCE_PRIORITY } from "@/lib/models";
import { computeTraitProfileScore } from "@/lib/assessment/trait-role-impact";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = supabaseServer!;
  const { id } = await params;
  const pid = parseInt(id, 10);

  // Fetch everything in parallel
  const [gradesRes, profileRes, personalityRes, statusRes, metricsRes, sentimentRes, fbrefLinkRes, traitsRes, afStatsRes, heightRes] = await Promise.all([
    supabase
      .from("attribute_grades")
      .select("attribute, scout_grade, stat_score, source")
      .eq("player_id", pid),
    supabase
      .from("player_intelligence_card")
      .select("level, position, archetype, personality_type, dob, ei, sn, tf, jp, competitiveness, coachability")
      .eq("person_id", pid)
      .single(),
    supabase
      .from("player_personality")
      .select("competitiveness, coachability")
      .eq("person_id", pid)
      .single(),
    supabase
      .from("player_status")
      .select("mental_tag, contract_tag, fitness_tag")
      .eq("person_id", pid)
      .single(),
    supabase
      .from("career_metrics")
      .select("trajectory")
      .eq("person_id", pid)
      .single(),
    supabase
      .from("news_sentiment_agg")
      .select("buzz_score, sentiment_score")
      .eq("person_id", pid)
      .single(),
    supabase
      .from("player_id_links")
      .select("external_id")
      .eq("person_id", pid)
      .eq("source", "fbref")
      .limit(1),
    // Trait scores for tactical + physical pillars
    supabase
      .from("player_trait_scores")
      .select("trait, category, severity")
      .eq("player_id", pid),
    // API-Football: minutes + duels for physical pillar
    supabase
      .from("api_football_player_stats")
      .select("minutes, appearances, duels_total, duels_won")
      .eq("person_id", pid)
      .order("season", { ascending: false })
      .limit(3),
    // Height for physical dominance
    supabase
      .from("people")
      .select("height_cm")
      .eq("id", pid)
      .single(),
  ]);

  if (gradesRes.error) return NextResponse.json({ error: gradesRes.error.message }, { status: 500 });

  const grades = gradesRes.data ?? [];
  const profile = profileRes.data;
  const personality = personalityRes.data;
  const status = statusRes.data;
  const metrics = metricsRes.data;
  const sentiment = sentimentRes.data;

  const playerLevel = profile?.level ?? null;
  const playerPosition = profile?.position ?? null;
  const personalityType = profile?.personality_type ?? null;
  const archetype = profile?.archetype ?? null;
  const age = computeAge(profile?.dob ?? null);

  // ── Resolve attributes (same as radar) ───────────────────────────────────
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

    const scale = raw > 10 ? 20.0 : 10.0;
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

  // ── Fetch FBRef minutes for availability ─────────────────────────────────
  let fbrefSeasons: Array<{ minutes: number | null; matches_played: number | null }> = [];
  const fbrefLink = (fbrefLinkRes.data ?? [])[0];
  if (fbrefLink) {
    const { data: statsData } = await supabase
      .from("fbref_player_season_stats")
      .select("minutes, matches_played")
      .eq("fbref_id", fbrefLink.external_id)
      .order("season", { ascending: false })
      .limit(3);
    fbrefSeasons = (statsData ?? []) as Array<{ minutes: number | null; matches_played: number | null }>;
  }

  // ── Prepare trait + API-Football data ────────────────────────────────────
  const allTraits = (traitsRes.data ?? []) as Array<{ trait: string; category: string; severity: number }>;
  const traits = allTraits as Array<{ trait: string; severity: number }>;
  const afStats = (afStatsRes.data ?? []) as Array<{ minutes: number | null; appearances: number | null; duels_total: number | null; duels_won: number | null }>;

  // ── Compute all pillars ──────────────────────────────────────────────────
  const technical = computeTechnical(
    modelScores, playerPosition, playerLevel, dataWeight, Array.from(sourcesSeen),
  );

  // Tactical: first pass to get bestRole, then compute trait score, then full pass
  const tacticalFirstPass = computeTactical({
    level: playerLevel,
    archetype,
    personality_type: personalityType,
    position: playerPosition,
  }, undefined, attrBest);

  const traitScore = traits.length > 0 && tacticalFirstPass.bestRole
    ? computeTraitProfileScore(traits, tacticalFirstPass.bestRole)
    : undefined;

  const tactical = computeTactical({
    level: playerLevel,
    archetype,
    personality_type: personalityType,
    position: playerPosition,
  }, traitScore, attrBest);

  // Mental: pass MBTI scores as fallback for comp/coach
  const mbtiScores = (profile?.tf != null && profile?.jp != null)
    ? { tf: profile.tf as number, jp: profile.jp as number }
    : null;

  const mental = computeMental(
    personalityType,
    personality?.competitiveness ?? profile?.competitiveness ?? null,
    personality?.coachability ?? profile?.coachability ?? null,
    status?.mental_tag ?? null,
    tactical.bestRole,
    mbtiScores,
  );

  // Physical: gather all data sources
  const afSeasons = afStats.map(s => ({
    minutes: s.minutes,
    matches_played: s.appearances,
  }));
  const minuteSeasons = fbrefSeasons.length > 0 ? fbrefSeasons : afSeasons;
  const availabilityScore = computeAvailability(minuteSeasons);

  // Sprinter + Powerhouse model scores (already in modelScores from technical)
  const sprinterScore = modelScores["Sprinter"] ?? null;
  const powerhouseScore = modelScores["Powerhouse"] ?? null;

  // Durability trait from player_trait_scores
  const durabilityTrait = allTraits.find(t => t.trait === "durability" && t.category === "physical");

  // AF duel win rate (aggregate across recent seasons)
  let duelWinRate: number | null = null;
  const totalDuels = afStats.reduce((s, r) => s + (r.duels_total ?? 0), 0);
  const wonDuels = afStats.reduce((s, r) => s + (r.duels_won ?? 0), 0);
  if (totalDuels > 0) duelWinRate = wonDuels / totalDuels;

  const physical = computePhysical({
    position: playerPosition,
    age,
    availabilityScore,
    sprinterScore,
    powerhouseScore,
    fitnessTag: status?.fitness_tag ?? null,
    durabilitySeverity: durabilityTrait?.severity ?? null,
    duelWinRate,
    heightCm: heightRes.data?.height_cm ?? null,
  });

  const pillars = computeOverall({
    technical: technical.score,
    tactical: tactical.score,
    mental: mental.score,
    physical: physical.score,
  });

  // Contract months remaining for commercial modifier
  let contractMonths: number | null = null;
  // Infer from contract_tag or player data if available
  const contractTag = status?.contract_tag;
  if (contractTag === "expiring_6m") contractMonths = 3;
  else if (contractTag === "expiring_12m") contractMonths = 9;
  else if (contractTag === "expiring_18m") contractMonths = 15;
  else if (contractTag === "long_term") contractMonths = 36;

  const commercial = computeCommercialModifier(
    sentiment?.buzz_score ?? null,
    sentiment?.sentiment_score ?? null,
    contractMonths,
    metrics?.trajectory ?? null,
  );

  const assessment: FullAssessment = {
    pillars,
    technical,
    tactical,
    mental,
    physical,
    commercial,
  };

  return NextResponse.json(assessment);
}
