import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// 13 SACROSANCT playing models, each averaging 4 core attributes
const MODEL_ATTRIBUTES: Record<string, string[]> = {
  Controller:  ["anticipation", "composure", "decisions", "tempo"],
  Commander:   ["communication", "concentration", "drive", "leadership"],
  Creator:     ["creativity", "unpredictability", "vision", "guile"],
  Target:      ["aerial_duels", "heading", "jumping", "volleys"],
  Sprinter:    ["acceleration", "balance", "movement", "pace"],
  Powerhouse:  ["aggression", "duels", "shielding", "stamina"],
  Cover:       ["awareness", "discipline", "interceptions", "positioning"],
  Engine:      ["intensity", "pressing", "stamina", "versatility"],
  Destroyer:   ["blocking", "clearances", "marking", "tackling"],
  Dribbler:    ["carries", "first_touch", "skills", "take_ons"],
  Passer:      ["pass_accuracy", "crossing", "pass_range", "through_balls"],
  Striker:     ["close_range", "mid_range", "long_range", "penalties"],
  GK:          ["agility", "footwork", "handling", "reactions"],
};

// Attribute aliases (DB inconsistencies)
const ATTR_ALIASES: Record<string, string> = {
  takeons: "take_ons",
  leadership: "leadership",
  unpredicability: "unpredictability",
};

// Which models matter for each position (weights 0-1)
// Reviewed by DOF: Passer added to CD, Powerhouse to DM, Cover raised for CM,
// Striker added to AM, Engine raised for WF, Creator+Powerhouse added to CF
const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  GK:  { GK: 1.0, Cover: 0.6, Commander: 0.5, Controller: 0.3 },
  CD:  { Destroyer: 1.0, Cover: 0.9, Commander: 0.7, Target: 0.5, Powerhouse: 0.4, Passer: 0.3 },
  WD:  { Engine: 0.9, Dribbler: 0.7, Passer: 0.7, Sprinter: 0.6, Cover: 0.6, Destroyer: 0.3 },
  DM:  { Cover: 1.0, Destroyer: 0.9, Controller: 0.8, Passer: 0.5, Commander: 0.4, Powerhouse: 0.3 },
  CM:  { Controller: 1.0, Passer: 0.9, Engine: 0.8, Cover: 0.5, Creator: 0.4 },
  WM:  { Dribbler: 0.9, Passer: 0.8, Engine: 0.7, Sprinter: 0.6, Creator: 0.5 },
  AM:  { Creator: 1.0, Dribbler: 0.8, Passer: 0.7, Controller: 0.5, Striker: 0.4, Sprinter: 0.3 },
  WF:  { Dribbler: 1.0, Sprinter: 0.9, Striker: 0.7, Creator: 0.5, Engine: 0.5 },
  CF:  { Striker: 1.0, Target: 0.7, Sprinter: 0.6, Powerhouse: 0.5, Dribbler: 0.4, Creator: 0.3 },
};

// Tactical roles with primary + secondary model
const TACTICAL_ROLES: Record<string, { position: string; primary: string; secondary: string }[]> = {
  GK:  [
    { position: "GK", primary: "GK", secondary: "Cover" },
    { position: "GK", primary: "GK", secondary: "Passer" },
  ],
  CD:  [
    { position: "CD", primary: "Destroyer", secondary: "Cover" },
    { position: "CD", primary: "Cover", secondary: "Passer" },
    { position: "CD", primary: "Destroyer", secondary: "Commander" },
    { position: "CD", primary: "Cover", secondary: "Dribbler" },
  ],
  WD:  [
    { position: "WD", primary: "Engine", secondary: "Dribbler" },
    { position: "WD", primary: "Cover", secondary: "Passer" },
    { position: "WD", primary: "Engine", secondary: "Sprinter" },
  ],
  DM:  [
    { position: "DM", primary: "Cover", secondary: "Destroyer" },
    { position: "DM", primary: "Controller", secondary: "Passer" },
    { position: "DM", primary: "Destroyer", secondary: "Engine" },
  ],
  CM:  [
    { position: "CM", primary: "Controller", secondary: "Passer" },
    { position: "CM", primary: "Engine", secondary: "Cover" },
    { position: "CM", primary: "Passer", secondary: "Creator" },
  ],
  WM:  [
    { position: "WM", primary: "Dribbler", secondary: "Passer" },
    { position: "WM", primary: "Engine", secondary: "Sprinter" },
    { position: "WM", primary: "Creator", secondary: "Dribbler" },
  ],
  AM:  [
    { position: "AM", primary: "Creator", secondary: "Dribbler" },
    { position: "AM", primary: "Controller", secondary: "Creator" },
    { position: "AM", primary: "Dribbler", secondary: "Striker" },
  ],
  WF:  [
    { position: "WF", primary: "Dribbler", secondary: "Sprinter" },
    { position: "WF", primary: "Striker", secondary: "Dribbler" },
    { position: "WF", primary: "Sprinter", secondary: "Creator" },
  ],
  CF:  [
    { position: "CF", primary: "Striker", secondary: "Target" },
    { position: "CF", primary: "Target", secondary: "Powerhouse" },
    { position: "CF", primary: "Striker", secondary: "Sprinter" },
    { position: "CF", primary: "Dribbler", secondary: "Striker" },
    { position: "CF", primary: "Creator", secondary: "Striker" },
  ],
};

const ROLE_NAMES: Record<string, Record<string, string>> = {
  GK:  { "GK+Cover": "Shot Stopper", "GK+Passer": "Sweeper Keeper" },
  CD:  { "Destroyer+Cover": "Stopper", "Cover+Passer": "Ball-Playing CB", "Destroyer+Commander": "Enforcer", "Cover+Dribbler": "Ball-Carrier" },
  WD:  { "Engine+Dribbler": "Overlapping FB", "Cover+Passer": "Inverted FB", "Engine+Sprinter": "Wing-Back" },
  DM:  { "Cover+Destroyer": "Anchor", "Controller+Passer": "Regista", "Destroyer+Engine": "Ball Winner" },
  CM:  { "Controller+Passer": "Deep Playmaker", "Engine+Cover": "Box-to-Box", "Passer+Creator": "Mezzala" },
  WM:  { "Dribbler+Passer": "Wide Playmaker", "Engine+Sprinter": "Traditional Winger", "Creator+Dribbler": "Inside Forward" },
  AM:  { "Creator+Dribbler": "Trequartista", "Controller+Creator": "Advanced Playmaker", "Dribbler+Striker": "Shadow Striker" },
  WF:  { "Dribbler+Sprinter": "Inside Forward", "Striker+Dribbler": "Wide Forward", "Sprinter+Creator": "Inverted Winger" },
  CF:  { "Striker+Target": "Target Man", "Target+Powerhouse": "Complete Forward", "Striker+Sprinter": "Poacher", "Dribbler+Striker": "False 9", "Creator+Striker": "Deep-Lying Forward" },
};

// Source priority for fallback scoring (higher = preferred)
// For each attribute, we use the score from the highest-priority source that has data.
// This prevents eafc_inferred garbage (undifferentiated all-10s) from polluting real data.
const SOURCE_PRIORITY: Record<string, number> = {
  scout_assessment: 5,
  statsbomb: 4,
  fbref: 3,
  understat: 2,
  eafc_inferred: 1,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = supabaseServer!;
  const { id } = await params;
  const pid = parseInt(id, 10);

  // Fetch all attribute grades + player profile in parallel
  const [gradesRes, profileRes] = await Promise.all([
    supabase
      .from("attribute_grades")
      .select("attribute, scout_grade, stat_score, source")
      .eq("player_id", pid),
    supabase
      .from("player_intelligence_card")
      .select("level, peak, position")
      .eq("person_id", pid)
      .single(),
  ]);

  if (gradesRes.error) return NextResponse.json({ error: gradesRes.error.message }, { status: 500 });

  const grades = gradesRes.data ?? [];
  const profile = profileRes.data;
  const playerLevel = profile?.level ?? profile?.peak ?? null;
  const playerPosition = profile?.position ?? null;

  // ── Priority fallback per attribute ──
  // For each attribute, use the score from the highest-priority source.
  // This prevents eafc garbage (all 10s) from diluting real statistical data.
  // Per-source scale detection: eafc/understat are 0-10, legacy data may be 0-20.
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

    // Per-source scale: scout grades can be 0-20, stats are 0-10
    const scale = raw > 10 ? 20.0 : 10.0;
    const normalized = (raw / scale) * 100;

    const existing = attrBest.get(attr);
    if (!existing || priority > existing.priority) {
      attrBest.set(attr, { normalized, priority, source });
    }
  }

  // Final scores (0-100) — one score per attribute from best available source
  const attrScores = new Map<string, number>();
  for (const [attr, best] of attrBest) {
    attrScores.set(attr, Math.round(best.normalized));
  }

  // ── Data quality assessment ──
  // Count how many attributes come from real sources vs eafc defaults
  let realSourceAttrs = 0;
  let eafcOnlyAttrs = 0;
  for (const [, best] of attrBest) {
    if (best.source !== "eafc_inferred") {
      realSourceAttrs++;
    } else {
      eafcOnlyAttrs++;
    }
  }
  const values = Array.from(attrScores.values());
  const uniqueValues = new Set(values);
  const isUndifferentiated = uniqueValues.size <= 2 && realSourceAttrs === 0;

  // Data confidence: determines how much we trust attributes vs level anchor
  let dataWeight = 0.3; // default: low (eafc-only undifferentiated)
  if (sourcesSeen.has("scout_assessment")) {
    dataWeight = 1.0; // full trust
  } else if (sourcesSeen.has("fbref") || sourcesSeen.has("statsbomb")) {
    dataWeight = realSourceAttrs >= 10 ? 0.8 : 0.6;
  } else if (sourcesSeen.has("understat")) {
    dataWeight = realSourceAttrs >= 5 ? 0.7 : 0.5;
  } else if (!isUndifferentiated) {
    dataWeight = 0.5; // differentiated eafc
  }

  // ── Model scores (0-100) ──
  const modelScores: Record<string, number> = {};
  for (const [model, attrs] of Object.entries(MODEL_ATTRIBUTES)) {
    const vals = attrs
      .map((a) => attrScores.get(a))
      .filter((v): v is number => v !== undefined);
    if (vals.length > 0) {
      modelScores[model] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }

  // ── Level anchor ──
  // For players with established level/peak, anchor scores to their quality
  const levelAnchor = playerLevel ? Math.min(playerLevel, 100) : null;

  // ── Position suitability scores (with level anchoring) ──
  const positionScores: Record<string, number> = {};
  for (const [pos, weights] of Object.entries(POSITION_WEIGHTS)) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [model, weight] of Object.entries(weights)) {
      if (modelScores[model] !== undefined) {
        weightedSum += modelScores[model] * weight;
        totalWeight += weight;
      }
    }
    let attrScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Apply level anchor: blend attribute-based score with player level
    if (levelAnchor !== null && attrScore > 0) {
      attrScore = Math.round(attrScore * dataWeight + levelAnchor * (1 - dataWeight));
    } else {
      attrScore = Math.round(attrScore);
    }
    positionScores[pos] = attrScore;
  }

  // ── Position-specific models (only show relevant axes) ──
  const positionModels: Record<string, string[]> = {};
  for (const [pos, weights] of Object.entries(POSITION_WEIGHTS)) {
    positionModels[pos] = Object.keys(weights).sort(
      (a, b) => (weights[b] ?? 0) - (weights[a] ?? 0)
    );
  }

  // ── Role fit scores ──
  const roleScores: Record<string, Array<{ name: string; primary: string; secondary: string; score: number }>> = {};
  for (const [pos, roles] of Object.entries(TACTICAL_ROLES)) {
    roleScores[pos] = roles.map((r) => {
      const pScore = modelScores[r.primary] ?? 0;
      const sScore = modelScores[r.secondary] ?? 0;
      let score = pScore * 0.6 + sScore * 0.4;

      // Apply level anchor to role scores too
      if (levelAnchor !== null && score > 0) {
        score = score * dataWeight + levelAnchor * (1 - dataWeight);
      }
      score = Math.round(score);

      const key = `${r.primary}+${r.secondary}`;
      const name = ROLE_NAMES[pos]?.[key] ?? `${r.primary}/${r.secondary}`;
      return { name, primary: r.primary, secondary: r.secondary, score };
    }).sort((a, b) => b.score - a.score);
  }

  const hasDifferentiatedData = !isUndifferentiated || sourcesSeen.has("understat") || sourcesSeen.has("statsbomb") || sourcesSeen.has("fbref");

  return NextResponse.json({
    modelScores,
    positionScores,
    positionModels,
    roleScores,
    hasData: Object.keys(modelScores).length > 0,
    hasDifferentiatedData,
    dataWeight,
    levelAnchor,
    sources: Array.from(sourcesSeen),
    realSourceAttrs,
  });
}
