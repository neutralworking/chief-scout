import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/choices — get next question(s) for a user
export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const category = searchParams.get("category");
  const count = Math.min(parseInt(searchParams.get("count") ?? "1", 10), 10);

  const sb = createClient(supabaseUrl, supabaseKey);

  // Build query for questions the user hasn't answered yet
  let query = sb
    .from("fc_questions")
    .select(`
      id, question_text, subtitle, option_count, difficulty, tags, total_votes, tier,
      category:fc_categories(id, slug, name, icon),
      options:fc_options(id, person_id, label, subtitle, image_url, sort_order, vote_count, dimension_weights)
    `)
    .eq("active", true)
    .order("total_votes", { ascending: true })
    .limit(count);

  if (category) {
    // Get category ID from slug
    const { data: cat } = await sb
      .from("fc_categories")
      .select("id")
      .eq("slug", category)
      .single();
    if (cat) {
      query = query.eq("category_id", cat.id);
    }
  }

  const { data: questions, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If user provided, filter out already-answered questions
  let finalQuestions = questions ?? [];
  if (userId && questions) {
    const { data: answeredIds } = await sb
      .from("fc_votes")
      .select("question_id")
      .eq("user_id", userId);

    const answered = new Set((answeredIds ?? []).map((v: { question_id: number }) => v.question_id));
    finalQuestions = questions.filter((q: { id: number }) => !answered.has(q.id)).slice(0, count);
  }

  // Enrich Tier 2 options with player intel (archetype, level, personality)
  const tier2Questions = finalQuestions.filter((q: { tier?: number }) => q.tier === 2);
  if (tier2Questions.length > 0) {
    const personIds = tier2Questions
      .flatMap((q: { options: { person_id: number | null }[] }) => q.options)
      .map((o: { person_id: number | null }) => o.person_id)
      .filter((id: number | null): id is number => id !== null);

    if (personIds.length > 0) {
      const [profilesRes, personalityRes] = await Promise.all([
        sb.from("player_profiles").select("person_id, position, level, archetype").in("person_id", personIds),
        sb.from("player_personality").select("person_id, personality_code").in("person_id", personIds),
      ]);

      const profileMap = new Map((profilesRes.data ?? []).map((p: { person_id: number }) => [p.person_id, p]));
      const personalityMap = new Map((personalityRes.data ?? []).map((p: { person_id: number }) => [p.person_id, p]));

      for (const q of tier2Questions) {
        for (const opt of (q as { options: { person_id: number | null; player_intel?: unknown }[] }).options) {
          if (opt.person_id) {
            const profile = profileMap.get(opt.person_id) as { position?: string; level?: number; archetype?: string } | undefined;
            const personality = personalityMap.get(opt.person_id) as { personality_code?: string } | undefined;
            opt.player_intel = {
              position: profile?.position ?? null,
              level: profile?.level ?? null,
              archetype: profile?.archetype ?? null,
              personality_code: personality?.personality_code ?? null,
            };
          }
        }
      }
    }
  }

  return NextResponse.json({ questions: finalQuestions });
  } catch (err) {
    console.error("Choices API error:", err);
    return NextResponse.json({ questions: [] });
  }
}
