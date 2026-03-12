import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = supabaseServer!;
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (isNaN(playerId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data, error } = await supabase
    .from("player_tags")
    .select("id, tag_id, tags(tag_name, category)")
    .eq("player_id", playerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r: Record<string, unknown>) => {
    const tag = r.tags as { tag_name: string; category: string } | null;
    return {
      id: r.id,
      tag_id: r.tag_id,
      tag_name: tag?.tag_name ?? null,
      tag_category: tag?.category ?? null,
    };
  });

  return NextResponse.json(rows);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = supabaseServer!;
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (isNaN(playerId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const tagId = body.tag_id;
  if (!tagId) return NextResponse.json({ error: "tag_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("player_tags")
    .insert({ player_id: playerId, tag_id: tagId })
    .select("id, player_id, tag_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = supabaseServer!;
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (isNaN(playerId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const tagId = body.tag_id;
  if (!tagId) return NextResponse.json({ error: "tag_id required" }, { status: 400 });

  const { error } = await supabase
    .from("player_tags")
    .delete()
    .eq("player_id", playerId)
    .eq("tag_id", tagId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
