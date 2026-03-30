import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const revalidate = 3600; // cache for 1 hour

export async function GET() {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const [rolesRes, archetypesRes] = await Promise.all([
    supabase
      .from("player_intelligence_card")
      .select("best_role")
      .not("best_role", "is", null)
      .eq("active", true),
    supabase
      .from("player_intelligence_card")
      .select("earned_archetype")
      .not("earned_archetype", "is", null)
      .eq("active", true),
  ]);

  const roles = [
    ...new Set((rolesRes.data ?? []).map((r) => r.best_role as string)),
  ].sort();
  const archetypes = [
    ...new Set((archetypesRes.data ?? []).map((r) => r.earned_archetype as string)),
  ].sort();

  return NextResponse.json({ roles, archetypes });
}
