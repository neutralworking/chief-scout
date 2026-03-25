import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import {
  POS_GROUPS,
  computeSimilarity,
  buildMatchReasons,
  weightedMedian,
  type TargetPlayer,
  type TransferComp,
  type ScoredComp,
} from "@/lib/transfer-comparables";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const personId = Number(id);
  if (!personId) {
    return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
  }

  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Fetch player profile + trajectory in parallel
  const [playerRes, metricsRes] = await Promise.all([
    supabase
      .from("player_intelligence_card")
      .select("person_id, position, level, dob, earned_archetype, archetype")
      .eq("person_id", personId)
      .single(),
    supabase
      .from("career_metrics")
      .select("trajectory")
      .eq("person_id", personId)
      .single(),
  ]);

  if (!playerRes.data) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const p = playerRes.data;
  const position = p.position ?? "CM";
  const level = p.level;
  const archetype = p.earned_archetype ?? p.archetype;
  const trajectory = metricsRes.data?.trajectory ?? null;

  // Compute age
  let age = 25; // fallback
  if (p.dob) {
    const dob = new Date(p.dob);
    const now = new Date();
    age = now.getFullYear() - dob.getFullYear();
    if (
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
    ) {
      age--;
    }
  }

  // Build position group filter
  const posGroup = POS_GROUPS[position] ?? "";
  const sameGroupPositions = posGroup
    ? Object.entries(POS_GROUPS)
        .filter(([, g]) => g === posGroup)
        .map(([pos]) => pos)
    : [position];

  // Query transfer_comparables view
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 4);
  const cutoffStr = cutoffDate.toISOString().split("T")[0];

  let query = supabase
    .from("transfer_comparables")
    .select("*")
    .not("fee_eur_m", "is", null)
    .gt("fee_eur_m", 0)
    .eq("fee_type", "permanent")
    .neq("confidence", "low")
    .gte("transfer_date", cutoffStr)
    .gte("age_at_transfer", age - 3)
    .lte("age_at_transfer", age + 3)
    .in("position", sameGroupPositions)
    .order("transfer_date", { ascending: false })
    .limit(50);

  // Exclude self
  query = query.or(`player_id.is.null,player_id.neq.${personId}`);

  const { data: comps, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!comps || comps.length === 0) {
    return NextResponse.json({
      comparables: [],
      weighted_median_eur_m: 0,
      comp_count: 0,
    });
  }

  // Apply level filter in-app (supabase can't do OR NULL easily)
  const filtered = comps.filter((c: TransferComp) => {
    if (level == null || c.level == null) return true;
    return Math.abs(level - c.level) <= 5;
  });

  // Score each comp
  const target: TargetPlayer = { position, level, age, archetype, trajectory };

  const scored: ScoredComp[] = filtered
    .map((c: TransferComp) => ({
      player_name: c.player_name,
      player_id: c.player_id,
      position: c.position ?? position,
      age_at_transfer: c.age_at_transfer ?? age,
      fee_eur_m: Number(c.fee_eur_m),
      from_club: c.from_club,
      to_club: c.to_club,
      to_league: c.to_league,
      transfer_date: c.transfer_date,
      transfer_window: c.transfer_window,
      similarity: computeSimilarity(target, c),
      match_reasons: buildMatchReasons(target, c),
      confidence: c.confidence,
    }))
    .sort((a: ScoredComp, b: ScoredComp) => b.similarity - a.similarity)
    .slice(0, 8);

  // Weighted median using similarity as weight
  const fees = scored.map((c) => c.fee_eur_m);
  const weights = scored.map((c) => c.similarity);
  const median = weightedMedian(fees, weights);

  return NextResponse.json({
    comparables: scored,
    weighted_median_eur_m: Math.round(median * 10) / 10,
    comp_count: scored.length,
  });
}
