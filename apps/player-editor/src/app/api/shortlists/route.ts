import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/shortlists — list all public shortlists
export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");

  const sb = createClient(supabaseUrl, supabaseKey);

  let query = sb
    .from("shortlists")
    .select("id, slug, title, description, icon, category, tags, featured, position_filter, player_count, author_type, author_name, created_at, updated_at")
    .eq("visibility", "public")
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }
  if (featured === "true") {
    query = query.eq("featured", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shortlists: data ?? [] });
}
