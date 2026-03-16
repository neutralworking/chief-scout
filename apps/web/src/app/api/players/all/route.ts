import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { prodFilter } from "@/lib/env";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, club_id, position, level, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt, market_value_eur, director_valuation_meur, best_role, best_role_score";

// 13 SACROSANCT playing models → 4 core attributes each (mirrors radar route)
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

const ATTR_ALIASES: Record<string, string> = {
  takeons: "take_ons",
  unpredicability: "unpredictability",
};

const SOURCE_PRIORITY: Record<string, number> = {
  scout_assessment: 5, statsbomb: 4, fbref: 3, understat: 2, eafc_inferred: 1,
};

function computeFingerprint(
  grades: Array<{ player_id: number; attribute: string; scout_grade: number | null; stat_score: number | null; source: string | null }>,
  position: string | null,
): number[] | null {
  // Priority fallback per attribute
  const attrBest = new Map<string, { normalized: number; priority: number }>();
  for (const g of grades) {
    const raw = g.scout_grade ?? g.stat_score ?? 0;
    if (raw <= 0) continue;
    let attr = g.attribute.toLowerCase().replace(/\s+/g, "_");
    attr = ATTR_ALIASES[attr] ?? attr;
    const priority = SOURCE_PRIORITY[g.source ?? "eafc_inferred"] ?? 1;
    const scale = raw > 10 ? 20.0 : 10.0;
    const normalized = (raw / scale) * 100;
    const existing = attrBest.get(attr);
    if (!existing || priority > existing.priority) {
      attrBest.set(attr, { normalized, priority });
    }
  }

  if (attrBest.size === 0) return null;

  const attrScores = new Map<string, number>();
  for (const [attr, best] of attrBest) {
    attrScores.set(attr, Math.round(best.normalized));
  }

  // Compute model scores
  const modelScores: Record<string, number | null> = {};
  for (const [model, attrs] of Object.entries(MODEL_ATTRIBUTES)) {
    const vals = attrs.map((a) => attrScores.get(a)).filter((v): v is number => v !== undefined);
    modelScores[model] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }

  function avg(...models: string[]): number {
    const vals = models.map((m) => modelScores[m]).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }

  if (position === "GK") {
    // 4-axis: Shot Stop, Command, Sweep, Distribute
    return [
      modelScores["GK"] ?? 0,
      modelScores["Commander"] ?? 0,
      modelScores["Cover"] ?? 0,
      modelScores["Passer"] ?? 0,
    ];
  }

  // 6-axis outfield: DEF, CRE, ATK, PWR, PAC, DRV
  return [
    avg("Cover", "Destroyer"),
    avg("Creator", "Passer"),
    avg("Striker", "Dribbler"),
    avg("Powerhouse", "Target"),
    modelScores["Sprinter"] ?? 0,
    avg("Engine", "Commander", "Controller"),
  ];
}

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const pursuit = searchParams.get("pursuit");
  const personalities = searchParams.get("personalities");
  const tier = searchParams.get("tier");
  const full = searchParams.get("full");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") ?? "value";
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const offset = Number(searchParams.get("offset") || 0);

  let query = prodFilter(supabase.from("player_intelligence_card").select(SELECT));

  // Exclude retired/inactive players by default
  query = query.eq("active", true);

  // Server-side filters
  if (position) query = query.eq("position", position);
  if (pursuit) query = query.eq("pursuit_status", pursuit);
  if (personalities) {
    const types = personalities.split(",").map((t) => t.trim());
    query = query.in("personality_type", types);
  }
  if (tier) query = query.eq("profile_tier", parseInt(tier, 10));
  if (full === "1") {
    query = query.not("archetype", "is", null).not("personality_type", "is", null).not("level", "is", null);
  }
  if (q) query = query.ilike("name", `%${q}%`);

  // Sort
  switch (sort) {
    case "level":
      query = query.order("level", { ascending: false, nullsFirst: false });
      break;
    case "role_score":
      query = query.order("best_role_score", { ascending: false, nullsFirst: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "position":
      query = query.order("position", { ascending: true, nullsFirst: false });
      break;
    case "cs_value":
      query = query.order("director_valuation_meur", { ascending: false, nullsFirst: false });
      break;
    case "tm_value":
      query = query.order("market_value_eur", { ascending: false, nullsFirst: false });
      break;
    case "value":
      query = query.order("director_valuation_meur", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("best_role_score", { ascending: false, nullsFirst: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const players = data ?? [];

  // Batch-fetch fingerprint data for returned player IDs
  const playerIds = players.map((p: { person_id: number }) => p.person_id);

  let fingerprintMap = new Map<number, number[] | null>();

  if (playerIds.length > 0) {
    const { data: grades } = await supabase
      .from("attribute_grades")
      .select("player_id, attribute, scout_grade, stat_score, source")
      .in("player_id", playerIds);

    if (grades && grades.length > 0) {
      // Group grades by player_id
      const gradesByPlayer = new Map<number, typeof grades>();
      for (const g of grades) {
        const pid = g.player_id;
        if (!gradesByPlayer.has(pid)) gradesByPlayer.set(pid, []);
        gradesByPlayer.get(pid)!.push(g);
      }

      for (const p of players) {
        const pid = (p as { person_id: number; position: string | null }).person_id;
        const pos = (p as { position: string | null }).position;
        const playerGrades = gradesByPlayer.get(pid);
        if (playerGrades) {
          fingerprintMap.set(pid, computeFingerprint(playerGrades, pos));
        }
      }
    }
  }

  // Merge fingerprints into player data
  const playersWithFingerprints = players.map((p: { person_id: number }) => ({
    ...p,
    fingerprint: fingerprintMap.get(p.person_id) ?? null,
  }));

  // Return hasMore flag instead of total count (avoids expensive count query on view)
  return NextResponse.json({ players: playersWithFingerprints, hasMore: players.length === limit });
}
