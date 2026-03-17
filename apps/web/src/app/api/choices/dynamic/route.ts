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
  market_value_tier: string | null;
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
    overall: number | null;
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
      overall: player.overall,
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
  "person_id, name, date_of_birth, position, level, overall, archetype, model_id, personality_type, club, nation, preferred_foot, image_url, best_role, best_role_score, profile_tier, market_value_tier";

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

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

const ATK_POSITIONS = ["CF", "WF", "AM", "WM"];
const DEF_POSITIONS = ["GK", "CD", "WD", "DM"];
const MID_POSITIONS = ["DM", "CM", "WM", "AM"];

// ── Template Generators ──────────────────────────────────────────────────────

// 1. Best young player (U-19/20/21/23)
const bestYoungPlayer: TemplateGenerator = async (sb) => {
  const maxAge = randItem([19, 20, 21, 23]);
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

// 2. Best at position
const bestAtPosition: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);

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

// 3. Role challenge (32 tactical roles)
const roleChallenge: TemplateGenerator = async (sb) => {
  const roleNames = Object.keys(ROLE_INTELLIGENCE);
  const roleName = randItem(roleNames);
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

// 4. Ballon d'Or future
const ballonDor: TemplateGenerator = async (sb) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 25);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .gte("date_of_birth", cutoff.toISOString().slice(0, 10))
    .not("overall", "is", null)
    .gte("level", 12)
    .order("overall", { ascending: false })
    .limit(10);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "ballon_dor",
    "Which young player is most likely to win the Ballon d'Or?",
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

// 5. Archetype pick — different styles for same position
const archetypePick: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);

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

// 6. Position duel — head-to-head archetype comparison
const positionDuel: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);

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
    `${players[0].archetype} or ${players[1].archetype} at ${POS_LABELS[pos] ?? pos}?`,
    `${players[0].name} vs ${players[1].name} — two different philosophies.`,
    players.map((p, i) =>
      makeOption(p, i, { flair_vs_function: i === 0 ? 15 : -15 })
    ),
    CATEGORIES.dugout,
    ["duel", pos.toLowerCase()]
  );
};

// 7. Dream XI slot
const dreamXiSlot: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .not("level", "is", null)
    .gte("level", 13)
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

// 8. Youth vs experience
const youthVsExperience: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);
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
      .gte("level", 12)
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

// 9. Foot preference
const footPreference: TemplateGenerator = async (sb) => {
  const pos = randItem(["WD", "WF", "WM", "AM", "CF"]);

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

// 10. Transfer window signing
const scarcityPick: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);

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
        attack_vs_defense: ATK_POSITIONS.includes(pos) ? 10 : -10,
      })
    ),
    CATEGORIES.transfer,
    ["transfer", pos.toLowerCase()]
  );
};

// 11. Head-to-head — two top players compared directly
const headToHead: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .not("level", "is", null)
    .gte("level", 13)
    .order("overall", { ascending: false })
    .limit(8);

  if (!data || data.length < 2) return null;
  const players = pick(data as PlayerRow[], 2);

  return makeQuestion(
    "head_to_head",
    `${players[0].name} or ${players[1].name}?`,
    `Who would you rather have in your squad?`,
    players.map((p, i) =>
      makeOption(p, i, {
        stats_vs_eye_test: 10,
        flair_vs_function: i === 0 ? 5 : -5,
      })
    ),
    CATEGORIES.pub,
    ["head-to-head", pos.toLowerCase()]
  );
};

// 12. Build from the back or front — attack vs defense priority
const buildDirection: TemplateGenerator = async (sb) => {
  const [atkRes, defRes] = await Promise.all([
    sb
      .from("player_intelligence_card")
      .select(COLS)
      .in("position", ATK_POSITIONS)
      .not("level", "is", null)
      .gte("level", 13)
      .order("overall", { ascending: false })
      .limit(6),
    sb
      .from("player_intelligence_card")
      .select(COLS)
      .in("position", DEF_POSITIONS)
      .not("level", "is", null)
      .gte("level", 13)
      .order("overall", { ascending: false })
      .limit(6),
  ]);

  if (
    !atkRes.data ||
    !defRes.data ||
    atkRes.data.length < 2 ||
    defRes.data.length < 2
  )
    return null;

  const atk = pick(atkRes.data as PlayerRow[], 2);
  const def = pick(defRes.data as PlayerRow[], 2);
  const players = shuffle([...atk, ...def]);

  return makeQuestion(
    "build_direction",
    "First signing for a new project — attack or defence?",
    "You're building a squad from scratch. Where do you start?",
    players.map((p, i) =>
      makeOption(p, i, {
        attack_vs_defense: ATK_POSITIONS.includes(p.position ?? "") ? 15 : -15,
        flair_vs_function: ATK_POSITIONS.includes(p.position ?? "") ? 5 : -5,
      })
    ),
    CATEGORIES.transfer,
    ["squad-building"]
  );
};

// 13. Midfield engine — pick your midfielder
const midfieldEngine: TemplateGenerator = async (sb) => {
  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .in("position", MID_POSITIONS)
    .not("archetype", "is", null)
    .not("level", "is", null)
    .gte("level", 12)
    .order("overall", { ascending: false })
    .limit(15);

  if (!data || data.length < 4) return null;

  // Try to get different archetypes
  const byArchetype = new Map<string, PlayerRow>();
  for (const p of data as PlayerRow[]) {
    if (p.archetype && !byArchetype.has(p.archetype)) {
      byArchetype.set(p.archetype, p);
    }
  }

  const unique = [...byArchetype.values()];
  if (unique.length < 3) return null;
  const players = pick(unique, 4);

  return makeQuestion(
    "midfield_engine",
    "Pick the engine room — which midfielder runs your team?",
    "The heartbeat of any side. Control or chaos?",
    players.map((p, i) =>
      makeOption(p, i, {
        control_vs_chaos: p.position === "DM" ? -10 : 10,
        flair_vs_function: p.archetype === "Creator" ? 15 : -5,
      })
    ),
    CATEGORIES.dugout,
    ["midfield"]
  );
};

// 14. Captain pick
const captainPick: TemplateGenerator = async (sb) => {
  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .not("level", "is", null)
    .gte("level", 13)
    .not("personality_type", "is", null)
    .order("overall", { ascending: false })
    .limit(15);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "captain_pick",
    "Who gets the armband?",
    "Leadership, personality, presence. Who captains your side?",
    players.map((p, i) =>
      makeOption(p, i, {
        loyalty_vs_ambition: 10,
        control_vs_chaos: -5,
        stats_vs_eye_test: -10,
      })
    ),
    CATEGORIES.dugout,
    ["captain", "leadership"]
  );
};

// 15. Young at position — best U-21 at specific position
const youngAtPosition: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 21);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .gte("date_of_birth", cutoff.toISOString().slice(0, 10))
    .not("level", "is", null)
    .gte("level", 9)
    .order("overall", { ascending: false })
    .limit(10);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "young_at_position",
    `Best young ${POS_LABELS[pos] ?? pos} in the world?`,
    "Under 21 and ready to take over.",
    players.map((p, i) =>
      makeOption(p, i, {
        youth_vs_experience: 20,
        stats_vs_eye_test: -5,
      })
    ),
    CATEGORIES.academy,
    ["youth", pos.toLowerCase()]
  );
};

// 16. Same club different position — pick a player from a mixed-position pool at one club
const clubShowcase: TemplateGenerator = async (sb) => {
  // Get clubs that have multiple high-level players
  const { data: clubs } = await sb
    .from("player_intelligence_card")
    .select("club")
    .not("club", "is", null)
    .not("level", "is", null)
    .gte("level", 12)
    .order("level", { ascending: false })
    .limit(100);

  if (!clubs || clubs.length < 4) return null;

  // Count players per club
  const clubCounts = new Map<string, number>();
  for (const c of clubs as { club: string }[]) {
    clubCounts.set(c.club, (clubCounts.get(c.club) ?? 0) + 1);
  }

  // Pick a club with 4+ players
  const validClubs = [...clubCounts.entries()]
    .filter(([, count]) => count >= 4)
    .map(([club]) => club);

  if (validClubs.length === 0) return null;
  const club = randItem(validClubs);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("club", club)
    .not("level", "is", null)
    .gte("level", 12)
    .order("overall", { ascending: false })
    .limit(8);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "club_showcase",
    `Who is ${club}'s most important player?`,
    "One player to build the team around.",
    players.map((p, i) =>
      makeOption(p, i, {
        loyalty_vs_ambition: 10,
        stats_vs_eye_test: 5,
      })
    ),
    CATEGORIES.scouting,
    ["club", club.toLowerCase().replace(/\s+/g, "-")]
  );
};

// 17. Cross-position comparison — who adds more value?
const crossPosition: TemplateGenerator = async (sb) => {
  const posA = randItem(["CD", "CM", "CF"]);
  const posB = posA === "CD" ? "CF" : posA === "CM" ? "WF" : "CD";

  const [aRes, bRes] = await Promise.all([
    sb
      .from("player_intelligence_card")
      .select(COLS)
      .eq("position", posA)
      .not("level", "is", null)
      .gte("level", 13)
      .order("overall", { ascending: false })
      .limit(4),
    sb
      .from("player_intelligence_card")
      .select(COLS)
      .eq("position", posB)
      .not("level", "is", null)
      .gte("level", 13)
      .order("overall", { ascending: false })
      .limit(4),
  ]);

  if (!aRes.data || !bRes.data || aRes.data.length < 2 || bRes.data.length < 2)
    return null;

  const a = pick(aRes.data as PlayerRow[], 2);
  const b = pick(bRes.data as PlayerRow[], 2);
  const players = shuffle([...a, ...b]);

  return makeQuestion(
    "cross_position",
    `World-class ${POS_LABELS[posA]} or world-class ${POS_LABELS[posB]}?`,
    "Different positions, equal quality. Which has more impact?",
    players.map((p, i) =>
      makeOption(p, i, {
        attack_vs_defense: ATK_POSITIONS.includes(p.position ?? "") ? 10 : -10,
      })
    ),
    CATEGORIES.pub,
    ["cross-position"]
  );
};

// 18. Veteran appreciation — best 30+ year old
const veteranPick: TemplateGenerator = async (sb) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 30);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .lte("date_of_birth", cutoff.toISOString().slice(0, 10))
    .not("level", "is", null)
    .gte("level", 13)
    .order("overall", { ascending: false })
    .limit(10);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "veteran_pick",
    "Best player over 30 in the world?",
    "Still got it. Who's aging like fine wine?",
    players.map((p, i) =>
      makeOption(p, i, {
        youth_vs_experience: -20,
        stats_vs_eye_test: 10,
        loyalty_vs_ambition: 5,
      })
    ),
    CATEGORIES.pub,
    ["veteran"]
  );
};

// 19. Partnership pick — which pair works best?
const partnershipPick: TemplateGenerator = async (sb) => {
  const scenarios = [
    { posA: "CD", posB: "CD", q: "Pick your centre-back partnership" },
    { posA: "CM", posB: "CM", q: "Pick your midfield partnership" },
    { posA: "CF", posB: "WF", q: "Pick your attacking duo" },
    { posA: "WD", posB: "WD", q: "Pick your full-back pair" },
  ];
  const scenario = randItem(scenarios);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .in("position", [scenario.posA, scenario.posB])
    .not("level", "is", null)
    .gte("level", 12)
    .order("overall", { ascending: false })
    .limit(12);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "partnership",
    scenario.q,
    "Two spots. Pick the first name on the team sheet.",
    players.map((p, i) =>
      makeOption(p, i, {
        control_vs_chaos: i < 2 ? 5 : -5,
        stats_vs_eye_test: 5,
      })
    ),
    CATEGORIES.dugout,
    ["partnership"]
  );
};

// 20. Breakout player — who is the rising star?
const breakoutPlayer: TemplateGenerator = async (sb) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 22);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .gte("date_of_birth", cutoff.toISOString().slice(0, 10))
    .not("level", "is", null)
    .gte("level", 10)
    .lte("level", 14)
    .not("archetype", "is", null)
    .order("overall", { ascending: false })
    .limit(12);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "breakout",
    "Which of these is about to break out?",
    "Young, talented, on the verge. Who explodes next?",
    players.map((p, i) =>
      makeOption(p, i, {
        youth_vs_experience: 15,
        stats_vs_eye_test: -10,
        flair_vs_function: 5,
      })
    ),
    CATEGORIES.scouting,
    ["breakout", "youth"]
  );
};

// 21. Free agent — who would you sign for nothing?
const freeAgentPick: TemplateGenerator = async (sb) => {
  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .not("level", "is", null)
    .gte("level", 11)
    .order("overall", { ascending: false })
    .limit(20);

  if (!data || data.length < 4) return null;
  // Just pick 4 random high-level players as hypothetical free agents
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "free_agent",
    "If one of these players was available on a free — who do you take?",
    "No transfer fee. Just wages. Who's the best value?",
    players.map((p, i) =>
      makeOption(p, i, {
        loyalty_vs_ambition: 15,
        stats_vs_eye_test: 5,
      })
    ),
    CATEGORIES.transfer,
    ["free-agent"]
  );
};

// 22. National team — best from same position, mixed nations
const nationalTeamPick: TemplateGenerator = async (sb) => {
  const pos = randItem(POSITIONS);

  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", pos)
    .not("nation", "is", null)
    .not("level", "is", null)
    .gte("level", 12)
    .order("overall", { ascending: false })
    .limit(15);

  if (!data || data.length < 4) return null;

  // Try to get players from different nations
  const byNation = new Map<string, PlayerRow>();
  for (const p of data as PlayerRow[]) {
    if (p.nation && !byNation.has(p.nation)) {
      byNation.set(p.nation, p);
    }
  }

  const unique = [...byNation.values()];
  const players = unique.length >= 4 ? pick(unique, 4) : pick(data as PlayerRow[], 4);

  return makeQuestion(
    "national_team",
    `Best ${POS_LABELS[pos] ?? pos} in international football?`,
    "Different nations, same position. Who's the pick?",
    players.map((p, i) =>
      makeOption(p, i, {
        domestic_vs_global: -10,
        stats_vs_eye_test: 5,
      })
    ),
    CATEGORIES.pub,
    ["international", pos.toLowerCase()]
  );
};

// 23. Peak player — which position has the strongest depth right now?
const positionDepth: TemplateGenerator = async (sb) => {
  // Get best player from 4 different positions
  const positions = pick([...POSITIONS], 4);

  const results = await Promise.all(
    positions.map((pos) =>
      sb
        .from("player_intelligence_card")
        .select(COLS)
        .eq("position", pos)
        .not("level", "is", null)
        .order("overall", { ascending: false })
        .limit(1)
    )
  );

  const players: PlayerRow[] = [];
  for (const { data } of results) {
    if (data && data.length > 0) players.push(data[0] as PlayerRow);
  }

  if (players.length < 4) return null;

  return makeQuestion(
    "position_depth",
    "Which position has the best player in world football right now?",
    "Four positions, four stars. Who's the best of the best?",
    players.map((p, i) =>
      makeOption(p, i, {
        attack_vs_defense: ATK_POSITIONS.includes(p.position ?? "") ? 10 : -10,
      })
    ),
    CATEGORIES.pub,
    ["depth"]
  );
};

// 24. Last line — pick your keeper
const pickYourKeeper: TemplateGenerator = async (sb) => {
  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .eq("position", "GK")
    .not("level", "is", null)
    .gte("level", 12)
    .order("overall", { ascending: false })
    .limit(8);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "pick_keeper",
    "Who guards your goal?",
    "Last line of defence. Shot-stopper or sweeper?",
    players.map((p, i) =>
      makeOption(p, i, {
        control_vs_chaos: -10,
        attack_vs_defense: -15,
        stats_vs_eye_test: 10,
      })
    ),
    CATEGORIES.dugout,
    ["goalkeeper"]
  );
};

// 25. Fantasy XI forward line
const forwardLine: TemplateGenerator = async (sb) => {
  const { data } = await sb
    .from("player_intelligence_card")
    .select(COLS)
    .in("position", ["CF", "WF"])
    .not("level", "is", null)
    .gte("level", 13)
    .order("overall", { ascending: false })
    .limit(10);

  if (!data || data.length < 4) return null;
  const players = pick(data as PlayerRow[], 4);

  return makeQuestion(
    "forward_line",
    "Lead the line — who's your number 9?",
    "Goals win games. Who's putting them in?",
    players.map((p, i) =>
      makeOption(p, i, {
        attack_vs_defense: 15,
        flair_vs_function: p.position === "WF" ? 10 : -5,
      })
    ),
    CATEGORIES.dreamxi,
    ["attack"]
  );
};

// ── Template Registry ────────────────────────────────────────────────────────

const TEMPLATES: { gen: TemplateGenerator; weight: number }[] = [
  { gen: bestYoungPlayer, weight: 12 },
  { gen: bestAtPosition, weight: 14 },
  { gen: roleChallenge, weight: 14 },
  { gen: ballonDor, weight: 8 },
  { gen: archetypePick, weight: 10 },
  { gen: positionDuel, weight: 10 },
  { gen: dreamXiSlot, weight: 6 },
  { gen: youthVsExperience, weight: 7 },
  { gen: footPreference, weight: 3 },
  { gen: scarcityPick, weight: 7 },
  { gen: headToHead, weight: 12 },
  { gen: buildDirection, weight: 5 },
  { gen: midfieldEngine, weight: 7 },
  { gen: captainPick, weight: 6 },
  { gen: youngAtPosition, weight: 8 },
  { gen: clubShowcase, weight: 8 },
  { gen: crossPosition, weight: 5 },
  { gen: veteranPick, weight: 6 },
  { gen: partnershipPick, weight: 6 },
  { gen: breakoutPlayer, weight: 8 },
  { gen: freeAgentPick, weight: 5 },
  { gen: nationalTeamPick, weight: 7 },
  { gen: positionDepth, weight: 5 },
  { gen: pickYourKeeper, weight: 4 },
  { gen: forwardLine, weight: 5 },
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

  // Try up to 5 different templates if one returns null (insufficient data)
  for (let attempt = 0; attempt < 5; attempt++) {
    const gen = pickWeightedTemplate();
    const question = await gen(sb);
    if (question && question.options.length >= 2) {
      return NextResponse.json({ questions: [question] });
    }
  }

  // All attempts failed — return empty
  return NextResponse.json({ questions: [] });
}
