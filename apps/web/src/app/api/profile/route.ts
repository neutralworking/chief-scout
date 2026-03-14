import { NextResponse } from "next/server";
import { createSupabaseAuthServer } from "@/lib/supabase-auth-server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/profile — get current user's profile, XI summary, vote stats
export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const supabaseAuth = await createSupabaseAuthServer();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);

  // Get fc_users profile
  const { data: profile } = await sb
    .from("fc_users")
    .select("*")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get squad picks for All-Time XI summary
  const { data: squad } = await sb
    .from("fc_squads")
    .select("id, completed, updated_at")
    .eq("user_id", profile.id)
    .limit(1)
    .single();

  let picks: { slot: number; player_name: string; person_id: number | null }[] = [];
  if (squad) {
    const { data: picksData } = await sb
      .from("fc_squad_picks")
      .select("slot, player_name, person_id")
      .eq("squad_id", squad.id)
      .order("slot");
    picks = picksData ?? [];
  }

  // Get vote count
  const { count: voteCount } = await sb
    .from("fc_votes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id);

  // Get identity dimensions
  const identity = {
    flair_vs_function: profile.flair_vs_function,
    youth_vs_experience: profile.youth_vs_experience,
    attack_vs_defense: profile.attack_vs_defense,
    loyalty_vs_ambition: profile.loyalty_vs_ambition,
    domestic_vs_global: profile.domestic_vs_global,
    stats_vs_eye_test: profile.stats_vs_eye_test,
    control_vs_chaos: profile.control_vs_chaos,
    era_bias: profile.era_bias,
  };

  return NextResponse.json({
    profile: {
      id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
      avatar_url: profile.avatar_url,
      preferences: profile.preferences ?? {},
      created_at: profile.created_at,
    },
    stats: {
      total_votes: voteCount ?? 0,
      squad_complete: squad?.completed ?? false,
      squad_picks: picks,
    },
    identity,
  });
}

// PATCH /api/profile — update display_name, preferences
export async function PATCH(request: Request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const supabaseAuth = await createSupabaseAuthServer();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.display_name !== undefined) {
    updates.display_name = body.display_name;
  }
  if (body.preferences !== undefined) {
    updates.preferences = body.preferences;
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const { error } = await sb
    .from("fc_users")
    .update(updates)
    .eq("auth_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: true });
}
