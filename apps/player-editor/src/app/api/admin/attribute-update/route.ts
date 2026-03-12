import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// POST /api/admin/attribute-update — bulk upsert attribute grades
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { person_id, grades } = await request.json();

    if (!person_id || !Array.isArray(grades)) {
      return NextResponse.json({ error: "Missing person_id or grades array" }, { status: 400 });
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    const rows = grades.map((g: { attribute: string; scout_grade: number }) => ({
      player_id: person_id,
      attribute: g.attribute,
      scout_grade: g.scout_grade,
      source: "scout_assessment",
    }));

    const { error } = await sb
      .from("attribute_grades")
      .upsert(rows, { onConflict: "player_id,attribute,source" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error("Attribute update error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
