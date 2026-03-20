import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || "",
);

export const dynamic = "force-dynamic";

// Fake characters from Airtable + LLM bios — loaded once
interface FakeCharacter {
  name: string;
  nation: string | null;
  position: string | null;
  model: string | null;
  bio: string;
  tags: string[];
  strengths: string[];
  weaknesses: string[];
  quirk: string;
}

let fakeCharacters: FakeCharacter[] | null = null;

async function loadFakeCharacters(): Promise<FakeCharacter[] | null> {
  if (fakeCharacters) return fakeCharacters;
  try {
    const paths = [
      join(process.cwd(), "../../pipeline/.cache/kc_characters.json"),
      join(process.cwd(), "public/data/kc_characters.json"),
    ];
    for (const p of paths) {
      try {
        const raw = await readFile(p, "utf-8");
        fakeCharacters = JSON.parse(raw);
        return fakeCharacters;
      } catch { /* try next */ }
    }
  } catch { /* fall through */ }
  return null;
}

// Seeded shuffle — deterministic per session but looks random
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rarity = searchParams.get("rarity");
  const position = searchParams.get("position");
  const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);

  // Fetch KC-flagged players from intelligence card view
  let query = supabase
    .from("player_intelligence_card")
    .select("*")
    .eq("kc", true)
    .not("archetype", "is", null)
    .not("overall", "is", null)
    .order("overall", { ascending: false })
    .limit(limit);

  if (position) query = query.eq("position", position);

  const { data: players, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players?.length) return NextResponse.json([]);

  const personIds = players.map((p: Record<string, unknown>) => p.person_id);

  // Load fake characters for skinning
  const characters = await loadFakeCharacters();
  const shuffledChars = characters ? seededShuffle(characters, 42) : null;

  // Fetch top attributes per player
  const { data: attrs } = await supabase
    .from("attribute_grades")
    .select("player_id, attribute, scout_grade, stat_score, source")
    .in("player_id", personIds);

  // Source priority for dedup (higher = preferred)
  const SOURCE_RANK: Record<string, number> = {
    scout_assessment: 6, statsbomb: 5, fbref: 4, api_football: 3,
    understat: 2, eafc_inferred: 1, computed: 0,
  };

  // Normalize raw score (0-20 scale) to 0-99
  function normalize(score: number, source: string): number {
    if (source === "computed") return Math.round(score * 9.9);
    return Math.round((score / 20) * 99);
  }

  // Group by player, deduplicate attrs (keep best source), normalize to 0-99
  const attrMap: Record<number, { attribute: string; score: number; source: string }[]> = {};
  for (const a of attrs || []) {
    const raw = a.scout_grade || a.stat_score || 0;
    if (raw <= 0) continue;
    const pid = a.player_id;
    if (!attrMap[pid]) attrMap[pid] = [];

    const existing = attrMap[pid].find(x => x.attribute === a.attribute);
    const rank = SOURCE_RANK[a.source] ?? 0;
    if (existing) {
      const existingRank = SOURCE_RANK[existing.source] ?? 0;
      if (rank > existingRank) {
        existing.score = normalize(raw, a.source);
        existing.source = a.source;
      }
    } else {
      attrMap[pid].push({ attribute: a.attribute, score: normalize(raw, a.source), source: a.source });
    }
  }
  for (const pid in attrMap) {
    attrMap[pid].sort((a, b) => b.score - a.score);
    attrMap[pid] = attrMap[pid].slice(0, 6);
  }

  // Build card data — skin with fake names
  const cards = players.map((p: Record<string, unknown>, i: number) => {
    const ovr = (p.overall as number) || 50;
    let suggested_rarity: string;
    if (ovr >= 83) suggested_rarity = "legendary";
    else if (ovr >= 76) suggested_rarity = "epic";
    else if (ovr >= 68) suggested_rarity = "rare";
    else if (ovr >= 58) suggested_rarity = "uncommon";
    else suggested_rarity = "common";

    // Skin with fake character data
    const fake = shuffledChars?.[i % shuffledChars.length];

    return {
      person_id: p.person_id,
      name: fake?.name ?? p.name,
      position: p.position,
      archetype: p.archetype,
      blueprint: p.blueprint,
      personality_code: p.personality_type,
      level: p.level,
      peak: (p as Record<string, unknown>).peak || null,
      overall: p.overall,
      scouting_notes: fake?.bio || null,
      nation: fake?.nation ?? p.nation,
      club: null, // hide real club
      tags: fake?.tags || [],
      strengths: fake?.strengths || [],
      weaknesses: fake?.weaknesses || [],
      quirk: fake?.quirk || null,
      active: p.active,
      suggested_rarity,
      top_attributes: attrMap[p.person_id as number] || [],
      fingerprint: p.fingerprint,
      best_role: p.best_role,
      ei: p.ei,
      sn: p.sn,
      tf: p.tf,
      jp: p.jp,
      competitiveness: p.competitiveness,
      coachability: p.coachability,
    };
  });

  // Filter by rarity if requested
  const filtered = rarity ? cards.filter((c: { suggested_rarity: string }) => c.suggested_rarity === rarity) : cards;

  return NextResponse.json(filtered, {
    headers: { "Cache-Control": "no-store" },
  });
}
