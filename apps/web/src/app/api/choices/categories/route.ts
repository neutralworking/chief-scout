import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// GET /api/choices/categories — list all categories with question counts
export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await sb
    .from("fc_categories")
    .select("id, slug, name, description, icon, sort_order")
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get question counts per category, only return categories with questions
  const categories = [];
  for (const cat of data ?? []) {
    const { count } = await sb
      .from("fc_questions")
      .select("id", { count: "exact", head: true })
      .eq("category_id", cat.id)
      .eq("active", true);

    const questionCount = count ?? 0;
    if (questionCount > 0) {
      categories.push({
        ...cat,
        question_count: questionCount,
      });
    }
  }

  return NextResponse.json({ categories });
}
