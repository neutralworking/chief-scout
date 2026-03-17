import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scorePlayerForRole,
  ROLE_INTELLIGENCE,
} from "@/lib/formation-intelligence";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerRow {
  person_id: number;
  name: string;
  date_of_birth: string | null;
  position: string | null;
  level: number | null;
  overall: number | null;
  archetype: string | null;
  model_id: string | null;
  personality_type: string | null;
  club: string | null;
  nation: string | null;
  preferred_foot: string | null;
  image_url: string | null;
  best_role: string | null;
  best_role_score: number | null;
  profile_tier: number | null;
}

interface DynamicQuestion {
  id: number;
  question_text: string;
  subtitle: string | null;
  option_count: number;
  difficulty: number;
  tags: string[] | null;
  total_votes: number;
  tier: number;
  is_dynamic: boolean;
  template: string;
  category: { id: number; slug: string; name: string; icon: string } | null;
  options: DynamicOption[];
}

interface DynamicOption {
  id: number;
  person_id: number;
  label: string;
  subtitle: string | null;
  image_url: string | null;
  sort_order: number;
  vote_count: number;
  dimension_weights: Record<string, number>;
  player_intel: {
    position: string | null;
    level: number | null;
    archetype: string | null;
    personality_code: string | null;
    club: string | null;
    nation: string | null;
    age: number | null;
    best_role: string | null;
    best_role_score: number | null;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

type TemplateGenerator = (
  sb: SupabaseClient
) => Promise<DynamicQuestion | null>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function makeOption(
  player: PlayerRow,
  index: number,
  weights: Record<string, number>
): DynamicOption {
  const age = computeAge(player.date_of_birth);
  return {
    id: -(player.person_id * 100 + index),
    person_id: player.person_id,
    label: player.name,
    subtitle: [player.club, player.nation].filter(Boolean).join(" · "),
    image_url: player.image_url ?? null,
    sort_order: index,
    vote_count: 0,
    dimension_weights: weights,
    player_intel: {
      position: player.position,
      level: player.level,
      archetype: player.archetype,
      personality_code: player.personality_type,
      club: player.club,
      nation: player.nation,
      age,
      best_role: player.best_role,
      best_role_score: player.best_role_score,
    },
  };
}

function makeQuestion(
  template: string,
  text: string,
  subtitle: string | null,
  options: DynamicOption[],
  category: { id: number; slug: string; name: string; icon: string },
  tags?: string[]
): DynamicQuestion {
  return {
    id: -Date.now(),
    question_text: text,
    subtitle,
    option_count: options.length,
    difficulty: 2,
    tags: tags ?? null,
    total_votes: 0,
    tier: 2,
    is_dynamic: true,
    template,
    category,
    options,
  };
}

const COLS =
  "person_id, name, date_of_birth, position, level, overall, archetype, model_id, personality_type, club, nation, preferred_foot, image_url, best_role, best_role_score, profile_tier";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// ── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = {
  scouting: { id: -1, slug: "scouting", name: "Scouting Report", icon: "🔍" },
  transfer: { id: -2, slug: "transfer", name: "Transfer Window", icon: "💰" },
  dugout: { id: -3, slug: "dugout", name: "The Dugout", icon: "🏟️" },
  dreamxi: { id: -4, slug: "dream-xi", name: "Dream XI", icon: "⭐" },
  academy: { id: -5, slug: "academy", name: "Academy", icon: "🌱" },
  pub: { id: -6, slug: "pub", name: "The Pub", icon: "🍺" },
};

// ── Position labels ──────────────────────────────────────────────────────────

const POS_LABELS: Record<string, string> = {
  GK: "goalkeeper",
  CD: "centre-back",
  WD: "full-back",
  DM: "defensive midfielder",
  CM: "central midfielder",
  WM: "wide midfielder",
  AM: "attacking midfielder",
  WF: "winger",
  CF: "striker",
};

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];

// ── Template Generators ──────────────────────────────────────────────────────

const bestYoungPlayer: TemplateGenerator = async (sb) => {
  const maxAge = [19, 20, 21, 23][Math.floor(Math.random() * 4)];
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - maxAge);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .gte("date_of_birth", cutoff.toISOString().slice(0, 10))
    .not("overall", "is", null)
    .not("position", "is", null)
    .order("overall", { ascending: false })
    .limit(12);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "best_young_player",
    `Who is the best U-${maxAge} in world football?`,
    "Pick the young player you'd build around.",
    players.map((p, i) =>
      makeOption(p, i, { youth_vs_experience: 15, stats_vs_eye_test: 5 })
    ),
    CATEGORIES.academy,
    ["youth", "talent"]
  );
};

const bestAtPosition: TemplateGenerator = async (sb) => {
  const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .not("overall", "is", null)
    .order("overall", { ascending: false })
    .limit(10);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "best_at_position",
    `Who is the best ${POS_LABELS[pos] ?? pos} in the game right now?`,
    "Forget reputation — who would you actually pick?",
    players.map((p, i) =>
      makeOption(p, i, { stats_vs_eye_test: -5, flair_vs_function: 5 })
    ),
    CATEGORIES.scouting,
    ["position", pos.toLowerCase()]
  );
};

const roleChallenge: TemplateGenerator = async (sb) => {
  const roleNames = Object.keys(ROLE_INTELLIGENCE);
  const roleName = roleNames[Math.floor(Math.random() * roleNames.length)];
  const roleInfo = ROLE_INTELLIGENCE[roleName];
  const positions = roleInfo.positions;

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .in("position", positions)
    .not("archetype", "is", null)
    .not("level", "is", null)
    .gte("level", 10)
    .order("overall", { ascending: false })
    .limit(20);

  if (!data || data.length < 4) return null;

  // Score and sort by role fit
  const scored = (data as PlayerRow[])
    .map((p) => ({
      ...p,
      roleScore: scorePlayerForRole(
        {
          level: p.level,
          archetype: p.archetype,
          personality_type: p.personality_type,
          position: p.position,
        },
        roleName
      ),
    }))
    .sort((a, b) => b.roleScore - a.roleScore);

  // Pick top 2 + 2 interesting lower ones for variety
  const top = scored.slice(0, 2);
  const rest = pick(scored.slice(2, 10), 2);
  const players = shuffle([...top, ...rest]);

  return makeQuestion(
    "role_challenge",
    `Which of these players is the best ${roleName}?`,
    roleInfo.reference,
    players.map((p, i) =>
      makeOption(p, i, { control_vs_chaos: 10, flair_vs_function: -5 })
    ),
    CATEGORIES.dugout,
    ["role", roleName.toLowerCase().replace(/\s+/g, "-")]
  );
};

const ballonDor: TemplateGenerator = async (sb) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 25);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .gte("date_of_birth", cutoff.toISOString().slice(0, 10))
    .not("overall", "is", null)
    .gte("level", 13)
    .order("overall", { ascending: false })
    .limit(10);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "ballon_dor",
    "Which of these young players is most likely to win the Ballon d'Or?",
    "The next generation. Who reaches the summit?",
    players.map((p, i) =>
      makeOption(p, i, {
        youth_vs_experience: 20,
        flair_vs_function: 10,
        stats_vs_eye_test: -10,
      })
    ),
    CATEGORIES.pub,
    ["ballon-dor", "youth"]
  );
};

const archetypePick: TemplateGenerator = async (sb) => {
  const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .not("archetype", "is", null)
    .not("level", "is", null)
    .gte("level", 10)
    .order("overall", { ascending: false })
    .limit(20);

  if (!data || data.length < 3) return null;

  // Pick players with different archetypes
  const byArchetype = new Map<string, PlayerRow>();
  for (const p of data as PlayerRow[]) {
    if (p.archetype && !byArchetype.has(p.archetype)) {
      byArchetype.set(p.archetype, p);
    }
  }

  const unique = [...byArchetype.values()];
  if (unique.length < 3) return null;
  const players = pick(unique, Math.min(4, unique.length));

  return makeQuestion(
    "archetype_pick",
    `Pick your ${POS_LABELS[pos] ?? pos} style`,
    "Different players, different approaches. What's your philosophy?",
    players.map((p, i) =>
      makeOption(p, i, { flair_vs_function: 10, control_vs_chaos: -5 })
    ),
    CATEGORIES.dugout,
    ["archetype", pos.toLowerCase()]
  );
};

const positionDuel: TemplateGenerator = async (sb) => {
  const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .not("archetype", "is", null)
    .not("level", "is", null)
    .gte("level", 12)
    .order("overall", { ascending: false })
    .limit(12);

  if (!data || data.length < 2) return null;

  // Pick 2 players with different archetypes
  const byArchetype = new Map<string, PlayerRow>();
  for (const p of data as PlayerRow[]) {
    if (p.archetype && !byArchetype.has(p.archetype)) {
      byArchetype.set(p.archetype, p);
    }
  }

  const unique = [...byArchetype.values()];
  if (unique.length < 2) return null;
  const players = pick(unique, 2);

  return makeQuestion(
    "position_duel",
    `${players[0].archetype} or ${players[1].archetype} for your ${POS_LABELS[pos] ?? pos}?`,
    `${players[0].name} vs ${players[1].name} — two different philosophies.`,
    players.map((p, i) =>
      makeOption(p, i, { flair_vs_function: i === 0 ? 15 : -15 })
    ),
    CATEGORIES.dugout,
    ["duel", pos.toLowerCase()]
  );
};

const dreamXiSlot: TemplateGenerator = async (sb) => {
  const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .not("level", "is", null)
    .gte("level", 14)
    .order("overall", { ascending: false })
    .limit(10);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "dream_xi_slot",
    `Pick your Dream XI ${POS_LABELS[pos] ?? pos}`,
    "One slot. Make it count.",
    players.map((p, i) =>
      makeOption(p, i, { domestic_vs_global: 5, loyalty_vs_ambition: 5 })
    ),
    CATEGORIES.dreamxi,
    ["dream-xi", pos.toLowerCase()]
  );
};

const youthVsExperience: TemplateGenerator = async (sb) => {
  const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
  const youngCutoff = new Date();
  youngCutoff.setFullYear(youngCutoff.getFullYear() - 23);
  const oldCutoff = new Date();
  oldCutoff.setFullYear(oldCutoff.getFullYear() - 29);

  const [youngRes, expRes] = await Promise.all([
    sb
      .from("player_intelligence_card")
      .select(COLS)
      .eq("position", pos)
      .gte("date_of_birth", youngCutoff.toISOString().slice(0, 10))
      .not("level", "is", null)
      .gte("level", 11)
      .order("overall", { ascending: false })
      .limit(6),
    sb
      .from("player_intelligence_card")
      .select(COLS)
      .eq("position", pos)
      .lte("date_of_birth", oldCutoff.toISOString().slice(0, 10))
      .not("level", "is", null)
      .gte("level", 13)
      .order("overall", { ascending: false })
      .limit(6),
  ]);

  if (
    !youngRes.data ||
    !expRes.data ||
    youngRes.data.length < 2 ||
    expRes.data.length < 2
  )
    return null;

  const young = pick(youngRes.data as PlayerRow[], 2);
  const experienced = pick(expRes.data as PlayerRow[], 2);
  const players = shuffle([...young, ...experienced]);

  return makeQuestion(
    "youth_vs_experience",
    `Youth or experience at ${POS_LABELS[pos] ?? pos}?`,
    "Potential ceiling vs proven floor. What matters more?",
    players.map((p, i) => {
      const age = computeAge(p.date_of_birth);
      const isYoung = age !== null && age < 24;
      return makeOption(p, i, {
        youth_vs_experience: isYoung ? 15 : -15,
        stats_vs_eye_test: isYoung ? -5 : 5,
      });
    }),
    CATEGORIES.academy,
    ["youth-vs-experience", pos.toLowerCase()]
  );
};

const footPreference: TemplateGenerator = async (sb) => {
  const pos =
    ["WD", "WF", "WM", "AM", "CF"][Math.floor(Math.random() * 5)];

  const [leftRes, rightRes] = await Promise.all([
    sb
      .from("player_intelligence_card")
      .select(COLS)
      .eq("position", pos)
      .eq("preferred_foot", "Left")
      .not("level", "is", null)
      .gte("level", 11)
      .order("overall", { ascending: false })
      .limit(4),
    sb
      .from("player_intelligence_card")
      .select(COLS)
      .eq("position", pos)
      .eq("preferred_foot", "Right")
      .not("level", "is", null)
      .gte("level", 11)
      .order("overall", { ascending: false })
      .limit(4),
  ]);

  if (
    !leftRes.data ||
    !rightRes.data ||
    leftRes.data.length < 1 ||
    rightRes.data.length < 1
  )
    return null;

  const left = pick(leftRes.data as PlayerRow[], Math.min(2, leftRes.data.length));
  const right = pick(rightRes.data as PlayerRow[], Math.min(2, rightRes.data.length));
  const players = shuffle([...left, ...right]);

  if (players.length < 2) return null;

  return makeQuestion(
    "foot_preference",
    `Left foot or right foot at ${POS_LABELS[pos] ?? pos}?`,
    "Does it matter which side they favour?",
    players.map((p, i) =>
      makeOption(p, i, {
        flair_vs_function: p.preferred_foot === "Left" ? 10 : -5,
      })
    ),
    CATEGORIES.scouting,
    ["foot", pos.toLowerCase()]
  );
};

const scarcityPick: TemplateGenerator = async (sb) => {
  const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .not("archetype", "is", null)
    .not("level", "is", null)
    .gte("level", 11)
    .order("overall", { ascending: false })
    .limit(10);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "scarcity_pick",
    `Sign one ${POS_LABELS[pos] ?? pos} this window — who is it?`,
    "Budget approved. One signing. Make it count.",
    players.map((p, i) =>
      makeOption(p, i, {
        stats_vs_eye_test: 5,
        loyalty_vs_ambition: 10,
        attack_vs_defense: pos === "CF" || pos === "WF" || pos === "AM" ? 10 : -10,
      })
    ),
    CATEGORIES.transfer,
    ["transfer", pos.toLowerCase()]
  );
};

// ── Template Registry ────────────────────────────────────────────────────────

const TEMPLATES: { gen: TemplateGenerator; weight: number }[] = [
  { gen: bestYoungPlayer, weight: 15 },
  { gen: bestAtPosition, weight: 15 },
  { gen: roleChallenge, weight: 15 },
  { gen: ballonDor, weight: 10 },
  { gen: archetypePick, weight: 12 },
  { gen: positionDuel, weight: 10 },
  { gen: dreamXiSlot, weight: 8 },
  { gen: youthVsExperience, weight: 8 },
  { gen: footPreference, weight: 4 },
  { gen: scarcityPick, weight: 8 },
];

function pickWeightedTemplate(): TemplateGenerator {
  const totalWeight = TEMPLATES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalWeight;
  for (const t of TEMPLATES) {
    r -= t.weight;
    if (r <= 0) return t.gen;
  }
  return TEMPLATES[0].gen;
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Try up to 3 different templates if one returns null (insufficient data)
  for (let attempt = 0; attempt < 3; attempt++) {
    const gen = pickWeightedTemplate();
    const question = await gen(sb);
    if (question && question.options.length >= 2) {
      return NextResponse.json({ questions: [question] });
    }
  }

  // All attempts failed — return empty so client falls back to static
  return NextResponse.json({ questions: [] });
}
