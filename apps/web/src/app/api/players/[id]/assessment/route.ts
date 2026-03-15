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

// ── Attribute resolution (mirrors radar route logic) ─────────────────────────

const MODEL_ATTRIBUTES: Record<string, string[]> = {
  Controller: ["anticipation", "composure", "decisions", "tempo"],
  Commander: ["communication", "concentration", "drive", "leadership"],
  Creator: ["creativity", "unpredictability", "vision", "guile"],
  Target: ["aerial_duels", "heading", "jumping", "volleys"],
  Sprinter: ["acceleration", "balance", "movement", "pace"],
  Powerhouse: ["aggression", "duels", "shielding", "stamina"],
  Cover: ["awareness", "discipline", "interceptions", "positioning"],
  Engine: ["intensity", "pressing", "stamina", "versatility"],
  Destroyer: ["blocking", "clearances", "marking", "tackling"],
  Dribbler: ["carries", "first_touch", "skills", "take_ons"],
  Passer: ["pass_accuracy", "crossing", "pass_range", "through_balls"],
  Striker: ["close_range", "mid_range", "long_range", "penalties"],
  GK: ["agility", "footwork", "handling", "reactions"],
};

const ATTR_ALIASES: Record<string, string> = {
  takeons: "take_ons",
  unpredicability: "unpredictability",
};

const SOURCE_PRIORITY: Record<string, number> = {
  scout_assessment: 5, statsbomb: 4, fbref: 3, understat: 2, eafc_inferred: 1,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = supabaseServer!;
  const { id } = await params;
  const pid = parseInt(id, 10);

  // Fetch everything in parallel
  const [gradesRes, profileRes, personalityRes, statusRes, metricsRes, sentimentRes, fbrefLinkRes] = await Promise.all([
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

  // ── Compute all pillars ──────────────────────────────────────────────────
  const technical = computeTechnical(
    modelScores, playerPosition, playerLevel, dataWeight, Array.from(sourcesSeen),
  );

  const tactical = computeTactical({
    level: playerLevel,
    archetype,
    personality_type: personalityType,
    position: playerPosition,
  });

  const mental = computeMental(
    personalityType,
    personality?.competitiveness ?? profile?.competitiveness ?? null,
    personality?.coachability ?? profile?.coachability ?? null,
    status?.mental_tag ?? null,
    tactical.bestRole,
  );

  const availabilityScore = computeAvailability(fbrefSeasons);
  const physical = computePhysical(
    playerPosition,
    age,
    metrics?.trajectory ?? null,
    availabilityScore,
  );

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
