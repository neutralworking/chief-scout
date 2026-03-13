import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = supabaseServer!;
  const [settingsRes, needsRes] = await Promise.all([
    supabase.from("club_settings").select("key, value"),
    supabase.from("club_needs").select("*").order("priority", { ascending: false }),
  ]);

  if (settingsRes.error)
    return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
  if (needsRes.error)
    return NextResponse.json({ error: needsRes.error.message }, { status: 500 });

  const settings: Record<string, string> = {};
  for (const row of settingsRes.data ?? []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ settings, needs: needsRes.data ?? [] });
}

export async function PUT(req: Request) {
  const supabase = supabaseServer!;
  const body = await req.json();

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be a key-value object" }, { status: 400 });
  }

  const entries = Object.entries(body) as [string, string][];
  if (entries.length === 0) {
    return NextResponse.json({ error: "no settings provided" }, { status: 400 });
  }

  for (const [key, value] of entries) {
    const { error } = await supabase
      .from("club_settings")
      .upsert({ key, value: String(value) }, { onConflict: "key" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
