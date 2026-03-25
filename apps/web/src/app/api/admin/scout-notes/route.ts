/**
 * POST /api/admin/scout-notes
 *
 * Generate scouting notes for flagged players or a small batch.
 * Uses Gemini Flash via the Google Generative AI SDK.
 *
 * Body:
 *   mode: "flagged" | "top"  — flagged-only or top N missing
 *   limit: number            — max players (default 10, max 20)
 *   force: boolean           — overwrite existing notes
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";
const geminiKey = process.env.GEMINI_API_KEY ?? "";

// ── Pillar tier ─────────────────────────────────────────────────────────────

function pillarTier(score: number | null): string | null {
  if (score == null) return null;
  if (score >= 70) return "strong";
  if (score >= 55) return "moderate";
  return "limited";
}

function personalityDescriptors(ei: number | null, sn: number | null, tf: number | null, jp: number | null): string[] {
  if (ei == null || sn == null || tf == null || jp == null) return [];
  return [
    ei >= 50 ? "extraverted" : "introverted",
    sn >= 50 ? "practical" : "intuitive",
    tf >= 50 ? "competitive" : "empathetic",
    jp >= 50 ? "structured" : "spontaneous",
  ];
}

// ── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a football intelligence analyst writing scouting dossiers. Each note weaves three perspectives:

1. Scout: data-grounded assessment — strengths, weaknesses, archetype fit, pillar balance
2. Historian: tactical lineage — what tradition this player's role belongs to, what systems suit them
3. Director of Football: squad-building value — market position, what kind of club benefits most, risk factors

Rules:
- Write 3-5 sentences per player. Flowing prose, no bullet points, no headers.
- Be opinionated — name weaknesses, don't hedge.
- Use football language (half-spaces, progressive carries, inverted runs, etc).
- Never use clichés like "world-class talent" or "exciting prospect".
- Reference the player's archetype and best role naturally.
- ONLY use information provided in the dossier. Do NOT invent current-season context, match references, historical comparisons, or any facts not present in the input.
- Do not include raw numeric scores in the output. Speak in relative terms.
- Do not reference MBTI types or personality acronyms.`;

// ── Types ───────────────────────────────────────────────────────────────────

interface PlayerRow {
  id: number;
  name: string;
  age: number | null;
  position: string | null;
  club: string | null;
  nation: string | null;
  earned_archetype: string | null;
  archetype: string | null;
  blueprint: string | null;
  best_role: string | null;
  technical_score: number | null;
  tactical_score: number | null;
  mental_score: number | null;
  physical_score: number | null;
  ei: number | null;
  sn: number | null;
  tf: number | null;
  jp: number | null;
  height_cm: number | null;
  preferred_foot: string | null;
  side: string | null;
}

// ── Build dossier ───────────────────────────────────────────────────────────

function buildDossier(p: PlayerRow, strengths: string[], weaknesses: string[], traits: string[]): string | null {
  const lines: string[] = [];
  let populated = 0;

  lines.push(`Player: ${p.name} (${p.age ?? "?"}, ${p.position ?? "?"}, ${p.club ?? "Unknown"}, ${p.nation ?? "?"})`);

  const arch = p.earned_archetype || p.archetype;
  if (arch || p.blueprint || p.best_role) {
    const parts: string[] = [];
    if (arch) parts.push(`Archetype: ${arch}`);
    if (p.blueprint) parts.push(`Blueprint: ${p.blueprint}`);
    if (p.best_role) parts.push(`Best Role: ${p.best_role}`);
    lines.push(parts.join(" | "));
    populated++;
  }

  const pillars = [
    pillarTier(p.technical_score) ? `technical=${pillarTier(p.technical_score)}` : null,
    pillarTier(p.tactical_score) ? `tactical=${pillarTier(p.tactical_score)}` : null,
    pillarTier(p.mental_score) ? `mental=${pillarTier(p.mental_score)}` : null,
    pillarTier(p.physical_score) ? `physical=${pillarTier(p.physical_score)}` : null,
  ].filter(Boolean);
  if (pillars.length > 0) {
    lines.push(`Pillar Balance: ${pillars.join(", ")}`);
    populated++;
  }

  const descs = personalityDescriptors(p.ei, p.sn, p.tf, p.jp);
  if (descs.length > 0) {
    lines.push(`Personality: ${descs.join(", ")}`);
    populated++;
  }

  if (strengths.length > 0) {
    lines.push(`Strengths: ${strengths.slice(0, 5).join(", ")}`);
    if (weaknesses.length > 0) lines.push(`Weaknesses: ${weaknesses.slice(0, 3).join(", ")}`);
    populated++;
  }

  if (traits.length > 0) {
    lines.push(`Traits: ${traits.slice(0, 6).join(", ")}`);
    populated++;
  }

  const phys: string[] = [];
  if (p.side) phys.push(`Side: ${p.side}`);
  if (p.height_cm) phys.push(`${p.height_cm}cm`);
  if (p.preferred_foot) phys.push(`${p.preferred_foot} foot`);
  if (phys.length > 0) {
    lines.push(phys.join(" | "));
    populated++;
  }

  return populated >= 3 ? lines.join("\n") : null;
}

// ── Gemini call ─────────────────────────────────────────────────────────────

async function callGemini(dossiers: string[]): Promise<{ name: string; notes: string }[] | null> {
  const dossierText = dossiers.join("\n\n---\n\n");
  const prompt = `Write scouting notes for these players. Return JSON: [{"name": "...", "notes": "..."}]\n\n---\n\n${dossierText}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed?.players ?? null;
  } catch {
    return null;
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const isAdmin = request.headers.get("x-admin") === "1";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  const body = await request.json();
  const mode: string = body.mode ?? "flagged";
  const limit = Math.min(body.limit ?? 10, 20);
  const force = body.force ?? false;

  const sb = createClient(supabaseUrl, supabaseKey);

  // 1. Find players
  let query = sb.rpc("get_scout_notes_candidates", { p_mode: mode, p_limit: limit, p_force: force });
  // Fallback: direct SQL if RPC doesn't exist
  let players: PlayerRow[];
  try {
    const { data, error } = await query;
    if (error) throw error;
    players = data ?? [];
  } catch {
    // Direct query fallback
    let sqlWhere = "";
    if (mode === "flagged") {
      sqlWhere = "AND ps.notes_flagged = true";
    } else if (!force) {
      sqlWhere = "AND (ps.scouting_notes IS NULL OR LENGTH(ps.scouting_notes) <= 20)";
    }

    const { data, error: sqlErr } = await sb.rpc("execute_sql", {
      query_text: `
        SELECT p.id, p.name,
               EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
               pp.position, c.clubname AS club, n.name AS nation,
               pp.earned_archetype, pp.archetype, pp.blueprint,
               pp.best_role, pp.technical_score, pp.tactical_score,
               pp.mental_score, pp.physical_score,
               ppers.ei, ppers.sn, ppers.tf, ppers.jp,
               p.height_cm, p.preferred_foot, pp.side
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        LEFT JOIN player_personality ppers ON ppers.person_id = p.id
        LEFT JOIN player_status ps ON ps.person_id = p.id
        LEFT JOIN clubs c ON c.id = p.club_id
        LEFT JOIN nations n ON n.id = p.nation_id
        WHERE pp.best_role_score IS NOT NULL AND p.active = true ${sqlWhere}
        ORDER BY pp.best_role_score DESC NULLS LAST
        LIMIT ${limit}
      `,
    });

    if (sqlErr) return NextResponse.json({ error: sqlErr.message }, { status: 500 });
    players = (data ?? []) as PlayerRow[];
  }

  if (players.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: "No players to process" });
  }

  // 2. Fetch grades + traits for all players
  const pids = players.map((p) => p.id);

  const { data: gradesData } = await sb
    .from("attribute_grades")
    .select("player_id, attribute, scout_grade, stat_score")
    .in("player_id", pids);

  const { data: traitsData } = await sb
    .from("player_trait_scores")
    .select("player_id, trait, severity")
    .in("player_id", pids)
    .order("severity", { ascending: false });

  // Build lookup maps
  const gradesMap: Record<number, { attr: string; score: number }[]> = {};
  for (const g of gradesData ?? []) {
    const score = g.scout_grade ?? g.stat_score;
    if (score == null) continue;
    if (!gradesMap[g.player_id]) gradesMap[g.player_id] = [];
    gradesMap[g.player_id].push({ attr: g.attribute, score });
  }
  // Sort and dedup
  for (const pid of Object.keys(gradesMap)) {
    const seen = new Set<string>();
    gradesMap[Number(pid)] = gradesMap[Number(pid)]
      .sort((a, b) => b.score - a.score)
      .filter((g) => {
        if (seen.has(g.attr)) return false;
        seen.add(g.attr);
        return true;
      });
  }

  const traitsMap: Record<number, string[]> = {};
  for (const t of traitsData ?? []) {
    if (!traitsMap[t.player_id]) traitsMap[t.player_id] = [];
    traitsMap[t.player_id].push(t.trait);
  }

  // 3. Build dossiers
  const dossiers: { player: PlayerRow; text: string }[] = [];
  for (const p of players) {
    const grades = gradesMap[p.id] ?? [];
    const strengths = grades.slice(0, 5).map((g) => g.attr);
    const weaknesses = grades.length >= 5 ? grades.slice(-3).map((g) => g.attr) : [];
    const traits = traitsMap[p.id] ?? [];
    const text = buildDossier(p, strengths, weaknesses, traits);
    if (text) dossiers.push({ player: p, text });
  }

  if (dossiers.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: "No sufficient data for dossiers" });
  }

  // 4. Call Gemini
  const results = await callGemini(dossiers.map((d) => d.text));
  if (!results) {
    return NextResponse.json({ error: "LLM generation failed" }, { status: 500 });
  }

  // 5. Match and upsert
  const resultMap = new Map(results.map((r) => [r.name.toLowerCase().trim(), r.notes]));
  let updated = 0;
  const errors: string[] = [];

  for (const { player } of dossiers) {
    let notes = resultMap.get(player.name.toLowerCase().trim());
    if (!notes) {
      // Partial match
      for (const [rname, rnotes] of resultMap) {
        if (player.name.toLowerCase().includes(rname) || rname.includes(player.name.toLowerCase())) {
          notes = rnotes;
          break;
        }
      }
    }

    if (!notes || notes.length < 20) continue;

    const { error } = await sb.from("player_status").upsert(
      { person_id: player.id, scouting_notes: notes, notes_flagged: false },
      { onConflict: "person_id" },
    );

    if (error) errors.push(`${player.name}: ${error.message}`);
    else updated++;
  }

  return NextResponse.json({
    ok: true,
    updated,
    total: dossiers.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Generated ${updated}/${dossiers.length} notes`,
  });
}
