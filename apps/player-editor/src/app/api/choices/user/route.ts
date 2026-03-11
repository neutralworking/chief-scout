import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/choices/user?id=xxx — get user profile and stats
export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Get or create user
  let { data: user } = await sb
    .from("fc_users")
    .select("*")
    .eq("id", userId)
    .single();

  if (!user) {
    const { data: newUser } = await sb
      .from("fc_users")
      .insert({ id: userId })
      .select()
      .single();
    user = newUser;
  }

  // Get achievements
  const { data: achievements } = await sb
    .from("fc_user_achievements")
    .select("unlocked_at, achievement:fc_achievements(slug, name, description, icon)")
    .eq("user_id", userId);

  // Get vote history summary
  const { count: totalVotes } = await sb
    .from("fc_votes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return NextResponse.json({
    user: user ?? { id: userId, total_votes: 0 },
    achievements: achievements ?? [],
    stats: {
      total_votes: totalVotes ?? 0,
    },
  });
}
