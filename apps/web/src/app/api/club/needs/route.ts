import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const VALID_POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

export async function GET() {
  const supabase = supabaseServer!;
  const { data, error } = await supabase
    .from("club_needs")
    .select("*")
    .order("priority", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = supabaseServer!;
  const body = await req.json();
  const { position, priority, min_mvt, preferred_archetype, preferred_foot, notes } = body;

  if (!position || !VALID_POSITIONS.includes(position)) {
    return NextResponse.json(
      { error: `position is required and must be one of: ${VALID_POSITIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const row: Record<string, unknown> = { position, source: "manual" };

  if (priority !== undefined) {
    const p = Number(priority);
    if (p < 1 || p > 5) {
      return NextResponse.json({ error: "priority must be between 1 and 5" }, { status: 400 });
    }
    row.priority = p;
  }

  if (min_mvt !== undefined) row.min_mvt = Number(min_mvt);
  if (preferred_archetype !== undefined) row.preferred_archetype = preferred_archetype;
  if (preferred_foot !== undefined) row.preferred_foot = preferred_foot;
  if (notes !== undefined) row.notes = notes;

  const { data, error } = await supabase.from("club_needs").insert(row).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer!;
  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("club_needs").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
