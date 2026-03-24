import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseServer) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const supabase = supabaseServer;
  const { id } = await params;

  const { data: player, error } = await supabase
    .from("players")
    .select("id, name, club, nation, position, division")
    .eq("id", id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json({
      player_id: player.id,
      player_name: player.name,
      news: null,
      reason: "GEMINI_API_KEY not configured",
    });
  }

  const prompt = `You are a football scouting intelligence assistant. Give me a brief, bullet-point summary (4-6 bullets) of the latest transfer rumours, form, injuries, and any notable news for the following player. Be concise and factual. If you're not sure about recent events, say so.

Player: ${player.name}
Club: ${player.club ?? "Unknown"}
Nation: ${player.nation ?? "Unknown"}
Position: ${player.position ?? "Unknown"}
Division: ${player.division ?? "Unknown"}

Respond with bullet points only, no preamble.`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        player_id: player.id,
        player_name: player.name,
        news: null,
        reason: `Gemini API error: ${res.status}`,
        detail: errText,
      });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

    return NextResponse.json({
      player_id: player.id,
      player_name: player.name,
      news: text,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      player_id: player.id,
      player_name: player.name,
      news: null,
      reason: `Fetch error: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
}
