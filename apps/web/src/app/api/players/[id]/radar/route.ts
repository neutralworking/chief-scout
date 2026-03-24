import { supabaseServer } from "@/lib/supabase-server";
import { ROLE_INTELLIGENCE } from "@/lib/formation-intelligence";
import { MODEL_ATTRIBUTES, ATTR_ALIASES, SOURCE_PRIORITY } from "@/lib/models";

// Proxy mapping: canonical model attributes → existing DB attributes we have data for.
// These are not identity mappings — they're "best available proxy" for attributes
// that no external source provides. The SACROSANCT model definitions stay pure;
// this is a radar-display concern only.
const ATTR_PROXIES: Record<string, string> = {
  // Commander: mental/leadership traits → proxied from composite mental scores
  communication:    "tactical",      // tactical awareness implies game-reading + organising
  concentration:    "composure",     // composure IS concentration under pressure
  drive:            "intensity",     // intensity captures work ethic / drive
  leadership:       "mental",        // general mental score is the best proxy

  // Controller: game management traits
  anticipation:     "awareness",     // awareness = reading the play ahead
  decisions:        "tactical",      // tactical score reflects decision quality
  tempo:            "composure",     // composure governs tempo control

  // Creator: unpredictability has no proxy but creativity+vision+guile cover 3/4

  // GK: agility + handling have no direct proxies
  agility:          "reactions",     // reaction speed approximates agility
  handling:         "footwork",      // footwork is the closest GK proxy
};
import { NextResponse } from "next/server";

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

// ── Build TACTICAL_ROLES and ROLE_NAMES dynamically from ROLE_INTELLIGENCE ──
// This replaces the old hardcoded dictionaries with the single source of truth.

interface TacticalRoleEntry {
  position: string;
  primary: string;
  secondary: string;
  roleName: string;
  keyAttributes: string[];
}

const TACTICAL_ROLES: Record<string, TacticalRoleEntry[]> = {};
const ROLE_NAMES: Record<string, Record<string, string>> = {};

for (const [roleName, intel] of Object.entries(ROLE_INTELLIGENCE)) {
  const primary = intel.archetypes[0];
  const secondary = intel.archetypes[1] ?? intel.archetypes[0];

  for (const pos of intel.positions) {
    if (!TACTICAL_ROLES[pos]) TACTICAL_ROLES[pos] = [];
    if (!ROLE_NAMES[pos]) ROLE_NAMES[pos] = {};

    TACTICAL_ROLES[pos].push({
      position: pos,
      primary,
      secondary,
      roleName,
      keyAttributes: intel.keyAttributes ?? [],
    });

    const key = `${primary}+${secondary}`;
    // If the same archetype combo already exists for this position, use a
    // disambiguated key so we don't overwrite. The lookup in role scoring
    // uses roleName directly anyway, so ROLE_NAMES is only a fallback.
    if (!ROLE_NAMES[pos][key]) {
      ROLE_NAMES[pos][key] = roleName;
    }
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseServer) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const supabase = supabaseServer;
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
  // Source-specific scales (not heuristic — based on actual data ranges)
  const SOURCE_SCALE: Record<string, number> = {
    scout_assessment: 20, eafc_inferred: 20, statsbomb: 20,
    api_football: 10, fbref: 10, understat: 10, computed: 10,
  };

  // Some attributes are quality ratings (how good is this player at X?) while
  // external sources grade them from rate stats (how often does X happen per 90?).
  // Rate stats penalise players whose role doesn't involve that action frequently.
  // e.g. a striker with pass_accuracy=1 isn't bad — they just don't pass much.
  // For these attributes, only trust quality-rating sources (scout + eafc).
  const QUALITY_ONLY_ATTRS = new Set([
    "composure",      // avg_rating ≠ composure
    "creativity",     // key_passes_p90 penalises non-creators
    "vision",         // assists_p90 penalises non-assisters
    "guile",          // fouls_drawn_p90 — barely related
    "pass_accuracy",  // pass % — position-dependent
    "take_ons",       // dribble success % — sample size issues
    "duels",          // duel win % — position-dependent
  ]);
  const QUALITY_SOURCES = new Set(["scout_assessment", "eafc_inferred"]);

  const attrBest = new Map<string, { normalized: number; priority: number; source: string }>();
  const sourcesSeen = new Set<string>();

  for (const g of grades) {
    const raw = g.scout_grade ?? g.stat_score ?? 0;
    if (raw <= 0) continue;

    let attr = g.attribute.toLowerCase().replace(/\s+/g, "_");
    attr = ATTR_ALIASES[attr] ?? attr;
    const source = g.source ?? "eafc_inferred";
    let priority = SOURCE_PRIORITY[source] ?? 1;
    sourcesSeen.add(source);

    // For quality-only attributes, skip non-quality sources entirely
    if (QUALITY_ONLY_ATTRS.has(attr) && !QUALITY_SOURCES.has(source)) {
      continue;
    }

    const scale = SOURCE_SCALE[source] ?? (raw > 10 ? 20.0 : 10.0);
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
      .map((a) => attrScores.get(a) ?? attrScores.get(ATTR_PROXIES[a] ?? ""))
      .filter((v): v is number => v !== undefined);
    if (vals.length >= 2) {
      modelScores[model] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }

  // ── Contrast stretch for radar display ──
  // Raw model scores cluster 50-70 making radars blobby. Stretch the player's
  // own range so their profile shape is visible. This is purely visual —
  // position/role scores below still use raw values for accuracy.
  const rawModelScores = { ...modelScores };
  const modelVals = Object.values(modelScores);
  if (modelVals.length >= 3) {
    const min = Math.min(...modelVals);
    const max = Math.max(...modelVals);
    const spread = max - min;
    if (spread > 0 && spread < 60) {
      // Map [min, max] → [15, 95] so shape is distinctive
      for (const [model, score] of Object.entries(modelScores)) {
        modelScores[model] = Math.round(15 + ((score - min) / spread) * 80);
      }
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
      if (rawModelScores[model] !== undefined) {
        weightedSum += rawModelScores[model] * weight;
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

  // ── Role fit scores (built from ROLE_INTELLIGENCE) ──
  const roleScores: Record<string, Array<{
    name: string;
    primary: string;
    secondary: string;
    score: number;
    keyAttributes: Array<{
      attribute: string;
      score: number | null;
      importance: "key";
    }>;
  }>> = {};

  for (const [pos, roles] of Object.entries(TACTICAL_ROLES)) {
    roleScores[pos] = roles.map((r) => {
      const pScore = rawModelScores[r.primary] ?? 0;
      const sScore = rawModelScores[r.secondary] ?? 0;
      let score = pScore * 0.6 + sScore * 0.4;

      // Apply level anchor to role scores too
      if (levelAnchor !== null && score > 0) {
        score = score * dataWeight + levelAnchor * (1 - dataWeight);
      }
      score = Math.round(score);

      // Key attribute scores for this role
      const keyAttrScores = (r.keyAttributes).map((attr) => {
        const normalized = attr.toLowerCase().replace(/[\s-]+/g, "_");
        const aliased = ATTR_ALIASES[normalized] ?? normalized;
        return {
          attribute: attr,
          score: attrScores.get(aliased) ?? null,
          importance: "key" as const,
        };
      });

      return {
        name: r.roleName,
        primary: r.primary,
        secondary: r.secondary,
        score,
        keyAttributes: keyAttrScores,
      };
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
    rawGrades: grades.map((g: Record<string, unknown>) => ({
      attribute: g.attribute,
      scout_grade: g.scout_grade,
      stat_score: g.stat_score,
      source: g.source,
    })),
  });
}
