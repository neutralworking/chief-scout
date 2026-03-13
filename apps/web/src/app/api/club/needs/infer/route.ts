import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { getSquadAssessment } from "../../../squad/route";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

interface InferredNeed {
  position: string;
  priority: number;
  source: "inferred";
  inferred_reason: string;
}

export async function POST() {
  const supabase = supabaseServer!;
  // 1. Get squad assessment
  const squad = await getSquadAssessment();

  if ("error" in squad) {
    return NextResponse.json({ error: squad.error }, { status: 500 });
  }

  // 2. Apply rules per position
  const inferred: InferredNeed[] = [];

  for (const pos of POSITIONS) {
    const group = squad.positions[pos];

    // Rule 1: No player at position
    if (group.count === 0) {
      inferred.push({
        position: pos,
        priority: 5,
        source: "inferred",
        inferred_reason: `No player at ${pos}`,
      });
      continue;
    }

    // Rule 2: No starter-quality player (best level < 87)
    if (group.best_level !== null && group.best_level < 87) {
      inferred.push({
        position: pos,
        priority: 4,
        source: "inferred",
        inferred_reason: `No starter-quality player (best: level ${group.best_level})`,
      });
      continue;
    }

    // Rule 3: Only 1 player, no depth
    if (group.count === 1) {
      const solo = group.players[0];
      inferred.push({
        position: pos,
        priority: 3,
        source: "inferred",
        inferred_reason: `No depth at ${pos} (only ${solo.name})`,
      });
      continue;
    }

    // Rule 4: All players aged 30+
    const ages = group.players.map(p => p.age).filter((a): a is number => a != null);
    if (ages.length > 0 && ages.every(a => a >= 30)) {
      inferred.push({
        position: pos,
        priority: 3,
        source: "inferred",
        inferred_reason: `Aging squad at ${pos} (avg age: ${group.avg_age})`,
      });
      continue;
    }

    // Rule 5: Below-average quality (avg level < 84)
    if (group.avg_level !== null && group.avg_level < 84) {
      inferred.push({
        position: pos,
        priority: 2,
        source: "inferred",
        inferred_reason: `Below-average quality (avg level: ${group.avg_level})`,
      });
    }
  }

  // 3. Delete old inferred needs
  const { error: deleteErr } = await supabase
    .from("club_needs")
    .delete()
    .eq("source", "inferred");

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  // 4. Insert new inferred needs
  if (inferred.length > 0) {
    const { error: insertErr } = await supabase
      .from("club_needs")
      .insert(inferred);

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  // 5. Return all needs (manual + inferred)
  const { data: allNeeds, error: fetchErr } = await supabase
    .from("club_needs")
    .select("*")
    .order("priority", { ascending: false });

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  return NextResponse.json({
    inferred_count: inferred.length,
    inferred: inferred.map(n => `${n.position} priority ${n.priority}`),
    needs: allNeeds ?? [],
  });
}
