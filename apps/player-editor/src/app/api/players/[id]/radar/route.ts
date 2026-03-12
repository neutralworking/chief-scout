import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// 13 compound models, each averaging 4 raw attributes (0-20 scale)
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

// Which models matter for each position (weights 0-1, higher = more important)
const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  GK:  { GK: 1.0, Cover: 0.6, Commander: 0.5, Controller: 0.3 },
  CD:  { Destroyer: 1.0, Cover: 0.9, Commander: 0.7, Target: 0.5, Powerhouse: 0.4 },
  WD:  { Engine: 0.9, Dribbler: 0.7, Passer: 0.7, Sprinter: 0.6, Cover: 0.5 },
  DM:  { Cover: 1.0, Destroyer: 0.9, Controller: 0.8, Passer: 0.5, Commander: 0.4 },
  CM:  { Controller: 1.0, Passer: 0.9, Engine: 0.7, Cover: 0.4, Creator: 0.4 },
  WM:  { Dribbler: 0.9, Passer: 0.8, Engine: 0.7, Sprinter: 0.6, Creator: 0.5 },
  AM:  { Creator: 1.0, Dribbler: 0.8, Passer: 0.7, Controller: 0.5, Sprinter: 0.3 },
  WF:  { Dribbler: 1.0, Sprinter: 0.9, Striker: 0.7, Creator: 0.5, Engine: 0.3 },
  CF:  { Striker: 1.0, Target: 0.7, Sprinter: 0.6, Dribbler: 0.4, Powerhouse: 0.3 },
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
  ],
};

const ROLE_NAMES: Record<string, Record<string, string>> = {
  GK:  { "GK+Cover": "Shot Stopper", "GK+Passer": "Sweeper Keeper" },
  CD:  { "Destroyer+Cover": "Stopper", "Cover+Passer": "Ball-Playing CB", "Destroyer+Commander": "Enforcer" },
  WD:  { "Engine+Dribbler": "Overlapping FB", "Cover+Passer": "Inverted FB", "Engine+Sprinter": "Wing-Back" },
  DM:  { "Cover+Destroyer": "Anchor", "Controller+Passer": "Regista", "Destroyer+Engine": "Ball Winner" },
  CM:  { "Controller+Passer": "Deep Playmaker", "Engine+Cover": "Box-to-Box", "Passer+Creator": "Mezzala" },
  WM:  { "Dribbler+Passer": "Wide Playmaker", "Engine+Sprinter": "Traditional Winger", "Creator+Dribbler": "Inside Forward" },
  AM:  { "Creator+Dribbler": "Trequartista", "Controller+Creator": "Advanced Playmaker", "Dribbler+Striker": "Shadow Striker" },
  WF:  { "Dribbler+Sprinter": "Inside Forward", "Striker+Dribbler": "Wide Forward", "Sprinter+Creator": "Inverted Winger" },
  CF:  { "Striker+Target": "Target Man", "Target+Powerhouse": "Complete Forward", "Striker+Sprinter": "Poacher", "Dribbler+Striker": "False 9" },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = supabaseServer!;
  const { id } = await params;

  // Fetch all attribute grades for this player
  const { data: grades, error } = await supabase
    .from("attribute_grades")
    .select("attribute, scout_grade, stat_score, source")
    .eq("player_id", parseInt(id, 10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Prefer scout_assessment > statsbomb > understat > eafc_inferred
  const SOURCE_PRIORITY: Record<string, number> = {
    scout_assessment: 4, statsbomb: 3, understat: 2, eafc_inferred: 1,
  };

  // Best grade per attribute
  const bestGrades = new Map<string, number>();
  for (const g of grades ?? []) {
    const score = g.scout_grade ?? g.stat_score ?? 0;
    const priority = SOURCE_PRIORITY[g.source] ?? 0;
    const attr = g.attribute.toLowerCase().replace(/\s+/g, "_");
    const existing = bestGrades.get(attr);
    if (existing === undefined || priority > (bestGrades.get(`${attr}_pri`) ?? 0)) {
      bestGrades.set(attr, score);
      bestGrades.set(`${attr}_pri`, priority);
    }
  }

  // Compute model scores (0-100 scale, from 0-20 grades)
  const modelScores: Record<string, number> = {};
  for (const [model, attrs] of Object.entries(MODEL_ATTRIBUTES)) {
    const values = attrs
      .map((a) => bestGrades.get(a))
      .filter((v): v is number => v !== undefined && v > 0);
    if (values.length > 0) {
      modelScores[model] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 5); // 0-20 → 0-100
    }
  }

  // Position suitability scores
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
    positionScores[pos] = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  // Role fit scores per position
  const roleScores: Record<string, Array<{ name: string; primary: string; secondary: string; score: number }>> = {};
  for (const [pos, roles] of Object.entries(TACTICAL_ROLES)) {
    roleScores[pos] = roles.map((r) => {
      const pScore = modelScores[r.primary] ?? 0;
      const sScore = modelScores[r.secondary] ?? 0;
      const score = Math.round(pScore * 0.6 + sScore * 0.4);
      const key = `${r.primary}+${r.secondary}`;
      const name = ROLE_NAMES[pos]?.[key] ?? `${r.primary}/${r.secondary}`;
      return { name, primary: r.primary, secondary: r.secondary, score };
    }).sort((a, b) => b.score - a.score);
  }

  // Check if data is differentiated (not all same score)
  const scoreValues = Object.values(modelScores);
  const uniqueScores = new Set(scoreValues);
  const hasDifferentiatedData = uniqueScores.size > 2; // more than 2 distinct values

  return NextResponse.json({
    modelScores,
    positionScores,
    roleScores,
    hasData: Object.keys(modelScores).length > 0,
    hasDifferentiatedData,
  });
}
