import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = supabaseServer!;
  const { id } = await params;

  const { data, error } = await supabase
    .from("player_valuations")
    .select(
      [
        "id",
        "person_id",
        "market_value_p10",
        "market_value_p25",
        "market_value_p50",
        "market_value_p75",
        "market_value_p90",
        "use_value_central",
        "contextual_fit_score",
        "system_archetype_fit",
        "system_threshold_fit",
        "system_personality_fit",
        "system_tag_compatibility",
        "squad_gap_fill",
        "scout_profile_pct",
        "performance_data_pct",
        "contract_age_pct",
        "market_context_pct",
        "personality_adj_pct",
        "style_fit_adj_pct",
        "profile_confidence",
        "data_coverage",
        "overall_confidence",
        "band_width_ratio",
        "disagreement_flag",
        "scout_anchored_value",
        "data_implied_value",
        "divergent_features",
        "disagreement_narrative",
        "stale_profile",
        "low_data_warning",
        "personality_risk_flags",
        "style_risk_flags",
        "mode",
        "target_position",
        "target_system",
        "model_version",
        "narrative",
        "evaluated_at",
      ].join(", "),
    )
    .eq("person_id", id)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return null if no valuation exists (not an error)
  return NextResponse.json(data);
}
