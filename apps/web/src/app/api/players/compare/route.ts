import { supabaseServer } from "@/lib/supabase-server";
import { MODEL_ATTRIBUTES, ATTR_ALIASES, SOURCE_PRIORITY } from "@/lib/models";
import { NextRequest, NextResponse } from "next/server";

// ── Tactical roles: position → [primary, secondary, roleName] tuples ──
// Mirrors valuation_core ratings.ts TACTICAL_ROLES
const TACTICAL_ROLES: Record<string, [string, string, string][]> = {
  GK: [["GK", "Cover", "Shot Stopper"], ["GK", "Passer", "Sweeper Keeper"]],
  CD: [["Destroyer", "Cover", "Stopper"], ["Cover", "Passer", "Ball-Playing CB"], ["Destroyer", "Commander", "Enforcer"], ["Cover", "Dribbler", "Ball-Carrier"]],
  WD: [["Engine", "Dribbler", "Overlapping FB"], ["Cover", "Passer", "Inverted FB"], ["Engine", "Sprinter", "Wing-Back"]],
  DM: [["Cover", "Destroyer", "Anchor"], ["Controller", "Passer", "Regista"], ["Destroyer", "Engine", "Ball Winner"]],
  CM: [["Controller", "Passer", "Deep Playmaker"], ["Engine", "Cover", "Box-to-Box"], ["Passer", "Creator", "Mezzala"]],
  WM: [["Dribbler", "Passer", "Wide Playmaker"], ["Engine", "Sprinter", "Traditional Winger"], ["Creator", "Dribbler", "Inside Forward"]],
  AM: [["Creator", "Dribbler", "Trequartista"], ["Controller", "Creator", "Advanced Playmaker"], ["Dribbler", "Striker", "Second Striker"]],
  WF: [["Dribbler", "Sprinter", "Inside Forward"], ["Striker", "Dribbler", "Wide Forward"], ["Sprinter", "Creator", "Inverted Winger"]],
  CF: [["Striker", "Target", "Target Man"], ["Target", "Powerhouse", "Complete Forward"], ["Striker", "Sprinter", "Poacher"], ["Dribbler", "Striker", "False 9"], ["Creator", "Striker", "Deep-Lying Forward"]],
};

const IDENTITY_FIELDS = [
  "person_id", "name", "dob", "height_cm", "preferred_foot",
  "position", "club", "club_id", "nation", "overall", "level",
  "archetype", "blueprint", "personality_type", "best_role",
  "best_role_score", "fingerprint", "market_value_eur",
  "director_valuation_meur", "pursuit_status",
  "ei", "sn", "tf", "jp", "competitiveness", "coachability",
].join(", ");

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function computeModelScores(
  grades: { attribute: string; scout_grade: number | null; stat_score: number | null; source: string | null }[],
): Record<string, number> {
  // Priority fallback per attribute (same logic as radar route)
  const attrBest = new Map<string, { normalized: number; priority: number }>();

  for (const g of grades) {
    const raw = g.scout_grade ?? g.stat_score ?? 0;
    if (raw <= 0) continue;

    let attr = g.attribute.toLowerCase().replace(/\s+/g, "_");
    attr = ATTR_ALIASES[attr] ?? attr;
    const source = g.source ?? "eafc_inferred";
    const priority = SOURCE_PRIORITY[source] ?? 1;

    const scale = raw > 10 ? 20.0 : 10.0;
    const normalized = (raw / scale) * 100;

    const existing = attrBest.get(attr);
    if (!existing || priority > existing.priority) {
      attrBest.set(attr, { normalized, priority });
    }
  }

  const attrScores = new Map<string, number>();
  for (const [attr, best] of attrBest) {
    attrScores.set(attr, Math.round(best.normalized));
  }

  // Compute 13 model scores (0-100)
  const modelScores: Record<string, number> = {};
  for (const [model, attrs] of Object.entries(MODEL_ATTRIBUTES)) {
    const vals = attrs
      .map((a) => attrScores.get(a))
      .filter((v): v is number => v !== undefined);
    if (vals.length > 0) {
      modelScores[model] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }

  return modelScores;
}

function computeTopRoles(
  modelScores: Record<string, number>,
  position: string | null,
): { name: string; score: number }[] {
  if (!position || !TACTICAL_ROLES[position]) return [];

  const roles = TACTICAL_ROLES[position].map(([primary, secondary, roleName]) => {
    const score = Math.round(
      (modelScores[primary] ?? 0) * 0.6 + (modelScores[secondary] ?? 0) * 0.4,
    );
    return { name: roleName, score };
  });

  return roles.sort((a, b) => b.score - a.score).slice(0, 3);
}

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "Missing required parameter: ids" }, { status: 400 });
  }

  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

  if (ids.some(isNaN)) {
    return NextResponse.json({ error: "All IDs must be valid numbers" }, { status: 400 });
  }

  if (ids.length < 2 || ids.length > 3) {
    return NextResponse.json(
      { error: "Provide 2 or 3 player IDs (received " + ids.length + ")" },
      { status: 400 },
    );
  }

  // Fetch identity + grades in parallel
  const [identityRes, gradesRes] = await Promise.all([
    supabase
      .from("player_intelligence_card")
      .select(IDENTITY_FIELDS)
      .in("person_id", ids),
    supabase
      .from("attribute_grades")
      .select("player_id, attribute, scout_grade, stat_score, source")
      .in("player_id", ids),
  ]);

  if (identityRes.error) {
    return NextResponse.json({ error: identityRes.error.message }, { status: 500 });
  }
  if (gradesRes.error) {
    return NextResponse.json({ error: gradesRes.error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const identityRows = (identityRes.data ?? []) as any[];
  const identityMap = new Map<number, Record<string, unknown>>();
  for (const row of identityRows) {
    identityMap.set(row.person_id as number, row);
  }

  // Group grades by player
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gradeRows = (gradesRes.data ?? []) as any[];
  const gradesByPlayer = new Map<number, typeof gradeRows>();
  for (const g of gradeRows) {
    const pid = g.player_id as number;
    if (!gradesByPlayer.has(pid)) gradesByPlayer.set(pid, []);
    gradesByPlayer.get(pid)!.push(g);
  }

  // Build response — maintain input order
  const players = ids.map((id) => {
    const identity = identityMap.get(id);
    if (!identity) return null;

    const grades = gradesByPlayer.get(id) ?? [];
    const modelScores = computeModelScores(grades);
    const position = (identity.position as string) ?? null;
    const topRoles = computeTopRoles(modelScores, position);

    return {
      ...identity,
      age: computeAge(identity.dob as string | null),
      modelScores,
      topRoles,
    };
  }).filter(Boolean);

  return NextResponse.json({ players });
}
