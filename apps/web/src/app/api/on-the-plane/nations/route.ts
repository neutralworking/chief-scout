import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

/**
 * GET /api/on-the-plane/nations
 * List all World Cup 2026 nations with metadata + player pool size.
 */
export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Fetch WC nations joined with nation name
  const { data: nations, error } = await sb
    .from("wc_nations")
    .select(`
      nation_id,
      confederation,
      fifa_ranking,
      group_letter,
      seed,
      kit_emoji,
      slug,
      nation:nations!wc_nations_nation_id_fkey(id, name)
    `)
    .order("fifa_ranking", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each nation, get player pool count
  const nationIds = (nations ?? []).map((n) => n.nation_id);

  // Get player counts per nation using individual count queries (avoids row limit)
  const countMap = new Map<number, number>();
  if (nationIds.length > 0) {
    // Use a single SQL query via rpc or batch count calls
    // Supabase default limit is 1000 rows — counting 21k+ people would be truncated
    const countPromises = nationIds.map(async (nid) => {
      const { count } = await sb
        .from("people")
        .select("id", { count: "exact", head: true })
        .eq("nation_id", nid)
        .eq("active", true);
      return { nid, count: count ?? 0 };
    });
    const counts = await Promise.all(countPromises);
    for (const { nid, count } of counts) {
      countMap.set(nid, count);
    }
  }

  // Get pre-computed strength from otp_ideal_squads
  const { data: strengths } = await sb
    .from("otp_ideal_squads")
    .select("nation_id, strength");

  const strengthMap = new Map<number, number>();
  if (strengths) {
    for (const s of strengths) {
      strengthMap.set(s.nation_id, s.strength);
    }
  }

  // Get entry counts from otp_nation_stats
  const { data: stats } = await sb
    .from("otp_nation_stats")
    .select("nation_id, total_entries");

  const statsMap = new Map<number, number>();
  if (stats) {
    for (const s of stats) {
      statsMap.set(s.nation_id, s.total_entries);
    }
  }

  const result = (nations ?? []).map((n) => ({
    nation_id: n.nation_id,
    name: ((n.nation as unknown as { name: string }) ?? { name: "Unknown" }).name,
    confederation: n.confederation,
    fifa_ranking: n.fifa_ranking,
    group_letter: n.group_letter,
    seed: n.seed,
    kit_emoji: n.kit_emoji,
    slug: n.slug,
    player_count: countMap.get(n.nation_id) ?? 0,
    strength: strengthMap.get(n.nation_id) ?? null,
    total_entries: statsMap.get(n.nation_id) ?? 0,
  }));

  return NextResponse.json(result);
}
