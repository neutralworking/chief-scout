import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = supabaseServer!;
  const { data, error } = await supabase
    .from("tags")
    .select("id, tag_name, category, is_scout_only")
    .order("category")
    .order("tag_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
