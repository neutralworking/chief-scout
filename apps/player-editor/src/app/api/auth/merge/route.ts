import { NextResponse } from "next/server";
import { createSupabaseAuthServer } from "@/lib/supabase-auth-server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// POST /api/auth/merge — merge anonymous fc_users data into authenticated user
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // Verify the user is authenticated
  const supabaseAuth = await createSupabaseAuthServer();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { anonymous_id } = await request.json();
  if (!anonymous_id) {
    return NextResponse.json({ error: "Missing anonymous_id" }, { status: 400 });
  }

  // Use service role for the merge operations
  const sb = createClient(supabaseUrl, supabaseServiceKey);

  // Check if authenticated user already has an fc_users row
  const { data: existingAuth } = await sb
    .from("fc_users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (existingAuth) {
    // Already merged — nothing to do
    return NextResponse.json({ merged: false, reason: "already_linked" });
  }

  // Check if the anonymous user exists
  const { data: anonUser } = await sb
    .from("fc_users")
    .select("id")
    .eq("id", anonymous_id)
    .single();

  if (anonUser) {
    // Link the anonymous row to the auth user
    await sb
      .from("fc_users")
      .update({
        auth_id: user.id,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        display_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", anonymous_id);

    return NextResponse.json({ merged: true, fc_user_id: anonymous_id });
  }

  // No anonymous user — create a new fc_users row for the auth user
  const newId = user.id; // Use auth ID as fc_users ID for new users
  await sb.from("fc_users").upsert({
    id: newId,
    auth_id: user.id,
    email: user.email,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    display_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null,
  }, { onConflict: "id" });

  return NextResponse.json({ merged: true, fc_user_id: newId, created: true });
}
