import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

const ALLOWED_TRAITS = [
  "set_piece_specialist", "dribble_artist", "playmaker_vision", "through_ball_king",
  "one_touch_play", "tempo_controller", "long_range_threat", "fox_in_the_box",
  "sweeper_reader", "brick_wall", "hard_man", "captain_leader",
  "target_man", "pace_merchant", "big_game_player", "clutch",
];

const TRAIT_CATEGORY: Record<string, string> = {
  set_piece_specialist: "tactical", dribble_artist: "style", playmaker_vision: "style",
  through_ball_king: "style", one_touch_play: "style", tempo_controller: "style",
  long_range_threat: "tactical", fox_in_the_box: "tactical", sweeper_reader: "tactical",
  brick_wall: "tactical", hard_man: "tactical", captain_leader: "tactical",
  target_man: "physical", pace_merchant: "physical",
  big_game_player: "behavioral", clutch: "behavioral",
};

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const body = await request.json();
  const { person_id, trait, action, severity } = body as {
    person_id: number;
    trait: string;
    action: "add" | "remove";
    severity?: number;
  };

  if (!person_id || !trait || !action) {
    return NextResponse.json({ error: "Missing person_id, trait, or action" }, { status: 400 });
  }

  if (!ALLOWED_TRAITS.includes(trait)) {
    return NextResponse.json({ error: `Trait "${trait}" not allowed` }, { status: 400 });
  }

  if (action === "add") {
    const category = TRAIT_CATEGORY[trait] ?? "style";
    const sev = severity ?? 7;
    const { error } = await sb
      .from("player_trait_scores")
      .upsert(
        { player_id: person_id, trait, category, severity: sev, source: "editor" },
        { onConflict: "player_id,trait,source" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, person_id, trait, action: "added" });
  }

  if (action === "remove") {
    const { error } = await sb
      .from("player_trait_scores")
      .delete()
      .eq("player_id", person_id)
      .eq("trait", trait)
      .eq("source", "editor");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, person_id, trait, action: "removed" });
  }

  return NextResponse.json({ error: "action must be add or remove" }, { status: 400 });
}
