import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { user_id, story_id, reaction } = body;

  if (!user_id || !story_id || !reaction) {
    return NextResponse.json(
      { error: "Missing user_id, story_id, or reaction" },
      { status: 400 }
    );
  }

  const validReactions = ["fire", "love", "gutted", "shocked"];
  if (!validReactions.includes(reaction)) {
    return NextResponse.json(
      { error: `Invalid reaction. Must be one of: ${validReactions.join(", ")}` },
      { status: 400 }
    );
  }

  // Ensure user exists (same pattern as Gaffer votes)
  await supabaseServer
    .from("fc_users")
    .upsert({ id: user_id, updated_at: new Date().toISOString() }, { onConflict: "id" });

  // Check if user already voted on this story
  const { data: existing } = await supabaseServer
    .from("news_story_votes")
    .select("id, reaction")
    .eq("story_id", story_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (existing) {
    if (existing.reaction === reaction) {
      // Same reaction = toggle off (remove vote)
      await supabaseServer
        .from("news_story_votes")
        .delete()
        .eq("id", existing.id);
    } else {
      // Different reaction = update
      await supabaseServer
        .from("news_story_votes")
        .update({ reaction })
        .eq("id", existing.id);
    }
  } else {
    // New vote
    const { error } = await supabaseServer
      .from("news_story_votes")
      .insert({ story_id, user_id, reaction });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Return updated counts for this story
  const { data: votes } = await supabaseServer
    .from("news_story_votes")
    .select("reaction")
    .eq("story_id", story_id);

  const counts: Record<string, number> = { fire: 0, love: 0, gutted: 0, shocked: 0 };
  for (const v of votes ?? []) {
    counts[v.reaction] = (counts[v.reaction] ?? 0) + 1;
  }

  // Return user's current vote (if any)
  const { data: userVote } = await supabaseServer
    .from("news_story_votes")
    .select("reaction")
    .eq("story_id", story_id)
    .eq("user_id", user_id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    counts,
    userReaction: userVote?.reaction ?? null,
  });
}
