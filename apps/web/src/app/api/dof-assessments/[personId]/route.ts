import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params;
  const pid = Number(personId);
  if (!pid) {
    return NextResponse.json({ error: "Invalid personId" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await sb
    .from("dof_assessments")
    .select("*")
    .eq("person_id", pid)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "No assessment found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params;
  const pid = Number(personId);
  if (!pid) {
    return NextResponse.json({ error: "Invalid personId" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const body = await request.json();

  // Retire old current assessment
  await sb
    .from("dof_assessments")
    .update({ is_current: false })
    .eq("person_id", pid)
    .eq("is_current", true);

  // Insert new assessment
  const { data, error } = await sb
    .from("dof_assessments")
    .insert({
      person_id: pid,
      technical: body.technical ?? null,
      physical: body.physical ?? null,
      tactical: body.tactical ?? null,
      personality: body.personality ?? null,
      commercial: body.commercial ?? null,
      availability: body.availability ?? null,
      technical_note: body.technical_note ?? null,
      physical_note: body.physical_note ?? null,
      tactical_note: body.tactical_note ?? null,
      personality_note: body.personality_note ?? null,
      commercial_note: body.commercial_note ?? null,
      availability_note: body.availability_note ?? null,
      worth_right_team_meur: body.worth_right_team_meur ?? null,
      worth_any_team_meur: body.worth_any_team_meur ?? null,
      usage_profile: body.usage_profile ?? null,
      summary: body.summary ?? null,
      confidence: body.confidence ?? "informed",
      is_current: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
