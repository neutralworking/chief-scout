import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export const dynamic = "force-dynamic";

// Source priority for picking best stat_score
const SOURCE_PRIORITY: Record<string, number> = {
  scout_assessment: 5,
  statsbomb: 4,
  fbref: 3,
  api_football: 3,
  understat: 2,
  computed: 1,
  eafc_inferred: 0,
};

// GET /api/admin/attribute-grades?person_id=123 (or player_id=123)
export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const playerId = req.nextUrl.searchParams.get("person_id") ?? req.nextUrl.searchParams.get("player_id");
  if (!playerId) {
    return NextResponse.json({ error: "Missing person_id" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await sb
    .from("attribute_grades")
    .select("attribute, scout_grade, stat_score, source")
    .eq("player_id", parseInt(playerId, 10));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Collapse rows: per attribute, pick scout_grade from scout_assessment
  // and best stat_score from highest-priority non-scout source
  const grades: Record<string, { scout_grade: number | null; stat_score: number | null; source: string | null }> = {};

  for (const row of data ?? []) {
    const attr = row.attribute;
    if (!grades[attr]) {
      grades[attr] = { scout_grade: null, stat_score: null, source: null };
    }

    if (row.source === "scout_assessment" && row.scout_grade != null) {
      grades[attr].scout_grade = row.scout_grade;
    }

    if (row.stat_score != null && row.source !== "scout_assessment") {
      const currentPriority = SOURCE_PRIORITY[grades[attr].source ?? ""] ?? -1;
      const newPriority = SOURCE_PRIORITY[row.source ?? ""] ?? 0;
      if (newPriority > currentPriority || grades[attr].stat_score === null) {
        grades[attr].stat_score = row.stat_score;
        grades[attr].source = row.source;
      }
    }
  }

  return NextResponse.json({ grades });
}
