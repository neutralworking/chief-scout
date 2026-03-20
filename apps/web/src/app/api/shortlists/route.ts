import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserTier, hasTierAccess } from "@/lib/stripe";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

const MAX_SHORTLISTS_PER_USER = 20;

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

// GET /api/shortlists — list public shortlists + optionally user's own
export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const userId = searchParams.get("user_id");

  const sb = createClient(supabaseUrl, supabaseKey);

  const cols = "id, slug, title, description, icon, category, tags, featured, position_filter, player_count, author_type, author_id, author_name, visibility, created_at, updated_at";

  // Public shortlists
  let publicQuery = sb
    .from("shortlists")
    .select(cols)
    .eq("visibility", "public")
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (category) publicQuery = publicQuery.eq("category", category);
  if (featured === "true") publicQuery = publicQuery.eq("featured", true);

  const { data: publicData, error } = await publicQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let userShortlists: typeof publicData = [];
  if (userId) {
    const { data: userData } = await sb
      .from("shortlists")
      .select(cols)
      .eq("author_id", userId)
      .order("updated_at", { ascending: false });
    userShortlists = userData ?? [];
  }

  // Merge: user's own lists first (deduped), then public
  const seen = new Set<number>();
  const merged = [];
  for (const sl of userShortlists ?? []) {
    seen.add((sl as { id: number }).id);
    merged.push(sl);
  }
  for (const sl of publicData ?? []) {
    if (!seen.has((sl as { id: number }).id)) merged.push(sl);
  }

  return NextResponse.json({ shortlists: merged });
}

// POST /api/shortlists — create a user shortlist (requires scout tier)
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { user_id, title, description, icon, category, visibility } = body;

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  // Check tier — shortlists require scout+
  const sbCheck = createClient(supabaseUrl, supabaseKey);
  const { data: fcUser } = await sbCheck
    .from("fc_users")
    .select("tier")
    .or(`auth_id.eq.${user_id},id.eq.${user_id}`)
    .single();
  const tier = (fcUser?.tier as "free" | "scout" | "pro") || "free";
  if (!hasTierAccess(tier, "scout")) {
    return NextResponse.json(
      { error: "Shortlists require a Scout subscription" },
      { status: 403 }
    );
  }
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Ensure user exists
  await sb
    .from("fc_users")
    .upsert({ id: user_id, updated_at: new Date().toISOString() }, { onConflict: "id" });

  // Check limit
  const { count } = await sb
    .from("shortlists")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user_id);

  if ((count ?? 0) >= MAX_SHORTLISTS_PER_USER) {
    return NextResponse.json({ error: `Maximum ${MAX_SHORTLISTS_PER_USER} shortlists reached` }, { status: 400 });
  }

  const slug = generateSlug(title.trim());

  const { data, error } = await sb
    .from("shortlists")
    .insert({
      slug,
      title: title.trim(),
      description: description?.trim() || null,
      icon: icon || null,
      category: category || "custom",
      visibility: ["public", "private", "unlisted"].includes(visibility) ? visibility : "private",
      author_type: "user",
      author_id: user_id,
      player_count: 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shortlist: data }, { status: 201 });
}
