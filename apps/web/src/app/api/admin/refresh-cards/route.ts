import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const { error } = await supabaseServer.rpc("refresh_intelligence_cards");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
