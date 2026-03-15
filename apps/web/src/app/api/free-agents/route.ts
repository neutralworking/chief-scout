import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const SELECT =
  "person_id, name, dob, height_cm, preferred_foot, active, nation, club, position, level, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_eur, director_valuation_meur";

// ── Fingerprint computation (mirrors /api/players/all) ──

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
    return [modelScores["GK"] ?? 0, modelScores["Commander"] ?? 0, modelScores["Cover"] ?? 0, modelScores["Passer"] ?? 0];
  }

  return [avg("Cover", "Destroyer"), avg("Creator", "Passer"), avg("Striker", "Dribbler"), avg("Powerhouse", "Target"), modelScores["Sprinter"] ?? 0, avg("Engine", "Commander", "Controller")];
}

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const position = searchParams.get("position");
  const sort = searchParams.get("sort") ?? "level";
  const tab = searchParams.get("tab") ?? "free"; // free | 2026 | 2027

  // Determine date ranges based on tab
  const now = new Date();
  const currentYear = now.getFullYear();

  // Collect player IDs and contract dates
  const playerIds = new Set<number>();
  const contractDates: Record<number, string> = {};
  const contractTags: Record<number, string> = {};

  if (tab === "free") {
    // Players whose contract already expired or tagged as free agent
    const [{ data: expired }, { data: freeStatus }] = await Promise.all([
      supabase
        .from("people")
        .select("id, contract_expiry_date")
        .not("contract_expiry_date", "is", null)
        .lt("contract_expiry_date", now.toISOString().split("T")[0]),
      supabase
        .from("player_status")
        .select("person_id, contract_tag")
        .or("contract_tag.ilike.%free%,contract_tag.ilike.%end of contract%,contract_tag.ilike.%unattached%"),
    ]);

    for (const row of expired ?? []) {
      playerIds.add(row.id);
      contractDates[row.id] = row.contract_expiry_date;
    }
    for (const row of freeStatus ?? []) {
      playerIds.add(row.person_id);
      contractTags[row.person_id] = row.contract_tag;
    }
  } else {
    // Expiring in a specific year
    const year = tab === "2027" ? currentYear + 1 : currentYear;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: expiring } = await supabase
      .from("people")
      .select("id, contract_expiry_date")
      .not("contract_expiry_date", "is", null)
      .gte("contract_expiry_date", startDate)
      .lte("contract_expiry_date", endDate);

    for (const row of expiring ?? []) {
      playerIds.add(row.id);
      contractDates[row.id] = row.contract_expiry_date;
    }
  }

  if (playerIds.size === 0) {
    return NextResponse.json({ players: [], total: 0 });
  }

  // Fetch player cards — Supabase .in() has a limit, batch if needed
  const idArray = Array.from(playerIds);
  let query = supabase
    .from("player_intelligence_card")
    .select(SELECT)
    .in("person_id", idArray);

  // Only show active players (filter out retired)
  query = query.eq("active", true);
  if (position) query = query.eq("position", position);

  switch (sort) {
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "age":
      query = query.order("dob", { ascending: true, nullsFirst: false });
      break;
    case "value":
      query = query.order("market_value_eur", { ascending: false, nullsFirst: false });
      break;
    case "level":
    default:
      query = query.order("level", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawPlayers = data ?? [];

  // Batch-fetch fingerprint data
  const returnedIds = rawPlayers.map((p: { person_id: number }) => p.person_id);
  const fingerprintMap = new Map<number, number[] | null>();

  if (returnedIds.length > 0) {
    const { data: grades } = await supabase
      .from("attribute_grades")
      .select("player_id, attribute, scout_grade, stat_score, source")
      .in("player_id", returnedIds);

    if (grades && grades.length > 0) {
      const gradesByPlayer = new Map<number, typeof grades>();
      for (const g of grades) {
        if (!gradesByPlayer.has(g.player_id)) gradesByPlayer.set(g.player_id, []);
        gradesByPlayer.get(g.player_id)!.push(g);
      }
      for (const p of rawPlayers) {
        const pid = (p as { person_id: number; position: string | null }).person_id;
        const pos = (p as { position: string | null }).position;
        const playerGrades = gradesByPlayer.get(pid);
        if (playerGrades) {
          fingerprintMap.set(pid, computeFingerprint(playerGrades, pos));
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players = rawPlayers.map((p: any) => ({
    ...p,
    contract_expiry_date: contractDates[p.person_id as number] ?? null,
    contract_tag: contractTags[p.person_id as number] ?? null,
    fingerprint: fingerprintMap.get(p.person_id as number) ?? null,
  }));

  return NextResponse.json({ players, total: players.length });
}
