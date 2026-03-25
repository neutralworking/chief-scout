import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

// POST /api/choices/vote — submit a vote and get results
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const body = await request.json();
  const {
    user_id,
    question_id,
    option_id,
    option_ids,
    time_ms,
    is_dynamic,
    person_id: votedPersonId,
    dimension_weights: clientWeights,
  } = body;

  // Support both single option_id and multi-pick option_ids array
  const resolvedOptionIds: number[] = option_ids
    ? (option_ids as number[])
    : option_id
    ? [option_id as number]
    : [];

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Ensure user exists
  const { error: userError } = await sb
    .from("fc_users")
    .upsert({ id: user_id, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (userError) {
    console.error("User upsert error:", userError);
  }

  // ── Dynamic question vote ──────────────────────────────────────────────
  if (is_dynamic) {
    // Apply dimension weights from the client payload
    const { data: currentUser } = await sb
      .from("fc_users")
      .select("total_votes, flair_vs_function, youth_vs_experience, attack_vs_defense, loyalty_vs_ambition, domestic_vs_global, stats_vs_eye_test, control_vs_chaos")
      .eq("id", user_id)
      .single();

    if (currentUser && clientWeights) {
      const newTotalVotes = (currentUser.total_votes ?? 0) + 1;
      const userUpdate: Record<string, unknown> = {
        total_votes: newTotalVotes,
      };

      const dampening = Math.max(0.3, 1.0 - newTotalVotes * 0.02);
      const dimensions = [
        "flair_vs_function", "youth_vs_experience", "attack_vs_defense",
        "loyalty_vs_ambition", "domestic_vs_global", "stats_vs_eye_test",
        "control_vs_chaos",
      ] as const;

      for (const dim of dimensions) {
        if (clientWeights[dim] !== undefined) {
          const current = (currentUser[dim] as number | null) ?? 50;
          const shifted = Math.round(
            Math.max(0, Math.min(100, current + clientWeights[dim] * dampening))
          );
          userUpdate[dim] = shifted;
        }
      }

      await sb.from("fc_users").update(userUpdate).eq("id", user_id);
    }

    // Store dynamic vote for crowd intelligence matchup analysis
    if (votedPersonId && body.template) {
      const opponentIds = (body.opponent_ids as number[] | undefined) ?? [];
      await sb.from("fc_dynamic_votes").insert({
        user_id,
        template: body.template,
        chosen_person_id: votedPersonId,
        opponent_ids: opponentIds,
      });
    }

    // Return success without trying to look up fc_options
    return NextResponse.json({
      success: true,
      results: null, // Client builds results from its own option data
      voted_person_id: votedPersonId,
    });
  }

  // ── Static question vote (existing flow) ───────────────────────────────

  if (!question_id || resolvedOptionIds.length === 0) {
    return NextResponse.json(
      { error: "Missing question_id or option_id(s)" },
      { status: 400 }
    );
  }

  // Insert votes (one per option for multi-pick)
  for (const oid of resolvedOptionIds) {
    const { error: voteError } = await sb
      .from("fc_votes")
      .upsert(
        {
          user_id,
          question_id,
          chosen_option_id: oid,
          time_ms: time_ms ?? null,
        },
        { onConflict: "user_id,question_id,chosen_option_id" }
      );

    if (voteError) {
      return NextResponse.json({ error: voteError.message }, { status: 500 });
    }

    // Increment option vote count
    const { data: currentOption } = await sb
      .from("fc_options")
      .select("vote_count")
      .eq("id", oid)
      .single();

    if (currentOption) {
      await sb
        .from("fc_options")
        .update({ vote_count: (currentOption.vote_count ?? 0) + 1 })
        .eq("id", oid);
    }
  }

  // Increment question total votes
  const { data: currentQuestion } = await sb
    .from("fc_questions")
    .select("total_votes")
    .eq("id", question_id)
    .single();

  if (currentQuestion) {
    await sb
      .from("fc_questions")
      .update({ total_votes: (currentQuestion.total_votes ?? 0) + 1 })
      .eq("id", question_id);
  }

  // Increment user total votes + apply dimension scoring
  const { data: currentUser } = await sb
    .from("fc_users")
    .select("total_votes, flair_vs_function, youth_vs_experience, attack_vs_defense, loyalty_vs_ambition, domestic_vs_global, stats_vs_eye_test, control_vs_chaos")
    .eq("id", user_id)
    .single();

  if (currentUser) {
    const newTotalVotes = (currentUser.total_votes ?? 0) + 1;
    const userUpdate: Record<string, unknown> = {
      total_votes: newTotalVotes,
    };

    // Apply dimension weights from chosen option(s) — average if multi-pick
    const { data: chosenOptions } = await sb
      .from("fc_options")
      .select("dimension_weights")
      .in("id", resolvedOptionIds);

    const allWeights = (chosenOptions ?? [])
      .map((o: { dimension_weights: Record<string, number> | null }) => o.dimension_weights)
      .filter(Boolean) as Record<string, number>[];

    if (allWeights.length > 0) {
      // Average weights across all chosen options
      const weights: Record<string, number> = {};
      for (const w of allWeights) {
        for (const [k, v] of Object.entries(w)) {
          weights[k] = (weights[k] ?? 0) + v / allWeights.length;
        }
      }
      const dampening = Math.max(0.3, 1.0 - newTotalVotes * 0.02);

      const dimensions = [
        "flair_vs_function", "youth_vs_experience", "attack_vs_defense",
        "loyalty_vs_ambition", "domestic_vs_global", "stats_vs_eye_test",
        "control_vs_chaos",
      ] as const;

      for (const dim of dimensions) {
        if (weights[dim] !== undefined) {
          const current = (currentUser[dim] as number | null) ?? 50;
          const shifted = Math.round(
            Math.max(0, Math.min(100, current + weights[dim] * dampening))
          );
          userUpdate[dim] = shifted;
        }
      }
    }

    await sb
      .from("fc_users")
      .update(userUpdate)
      .eq("id", user_id);
  }

  // Return all options with updated vote counts
  const { data: options } = await sb
    .from("fc_options")
    .select("id, label, subtitle, vote_count, person_id, image_url")
    .eq("question_id", question_id)
    .order("sort_order");

  return NextResponse.json({
    success: true,
    results: options ?? [],
  });
}
