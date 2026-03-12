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
      id, question_text, subtitle, option_count, difficulty, tags, total_votes,
      category:fc_categories(id, slug, name, icon),
      options:fc_options(id, person_id, label, subtitle, image_url, sort_order, vote_count)
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
  if (userId && questions) {
    const { data: answeredIds } = await sb
      .from("fc_votes")
      .select("question_id")
      .eq("user_id", userId);

    const answered = new Set((answeredIds ?? []).map((v: { question_id: number }) => v.question_id));
    const unanswered = questions.filter((q: { id: number }) => !answered.has(q.id));
    return NextResponse.json({ questions: unanswered.slice(0, count) });
  }

  return NextResponse.json({ questions: questions ?? [] });
  } catch (err) {
    console.error("Choices API error:", err);
    return NextResponse.json({ questions: [] });
  }
}
