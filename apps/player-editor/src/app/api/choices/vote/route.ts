import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// POST /api/choices/vote — submit a vote and get results
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { user_id, question_id, option_id, time_ms } = body;

  if (!user_id || !question_id || !option_id) {
    return NextResponse.json(
      { error: "Missing user_id, question_id, or option_id" },
      { status: 400 }
    );
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Ensure user exists
  const { error: userError } = await sb
    .from("fc_users")
    .upsert({ id: user_id, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (userError) {
    console.error("User upsert error:", userError);
  }

  // Insert or update vote
  const { error: voteError } = await sb
    .from("fc_votes")
    .upsert(
      {
        user_id,
        question_id,
        chosen_option_id: option_id,
        time_ms: time_ms ?? null,
      },
      { onConflict: "user_id,question_id" }
    );

  if (voteError) {
    return NextResponse.json({ error: voteError.message }, { status: 500 });
  }

  // Increment option vote count
  const { data: currentOption } = await sb
    .from("fc_options")
    .select("vote_count")
    .eq("id", option_id)
    .single();

  if (currentOption) {
    await sb
      .from("fc_options")
      .update({ vote_count: (currentOption.vote_count ?? 0) + 1 })
      .eq("id", option_id);
  }

  // Increment question total votes
  const { data: currentQuestion } = await sb
    .from("fc_questions")
    .select("total_votes")
    .eq("id", question_id)
    .single();

  if (currentQuestion) {
    await sb
      .from("fc_questions")
      .update({ total_votes: (currentQuestion.total_votes ?? 0) + 1 })
      .eq("id", question_id);
  }

  // Increment user total votes
  const { data: currentUser } = await sb
    .from("fc_users")
    .select("total_votes")
    .eq("id", user_id)
    .single();

  if (currentUser) {
    await sb
      .from("fc_users")
      .update({ total_votes: (currentUser.total_votes ?? 0) + 1 })
      .eq("id", user_id);
  }

  // Return all options with updated vote counts
  const { data: options } = await sb
    .from("fc_options")
    .select("id, label, subtitle, vote_count, person_id, image_url")
    .eq("question_id", question_id)
    .order("sort_order");

  return NextResponse.json({
    success: true,
    results: options ?? [],
  });
}
