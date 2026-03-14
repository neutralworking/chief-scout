import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const storyType = searchParams.get("type");
  const playerId = searchParams.get("player");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  let storyIds: string[] | null = null;

  // If filtering by player, first get story IDs from news_player_tags
  if (playerId) {
    const { data: tags } = await supabaseServer
      .from("news_player_tags")
      .select("story_id")
      .eq("player_id", playerId);

    if (!tags || tags.length === 0) {
      return NextResponse.json({ stories: [], tags: [] });
    }
    storyIds = tags.map((t) => t.story_id);
  }

  // Fetch stories
  let query = supabaseServer
    .from("news_stories")
    .select("id, headline, summary, source, url, published_at, story_type")
    .order("published_at", { ascending: false })
    .limit(limit);

  // Always exclude empty headlines
  query = query.neq("headline", "").not("headline", "is", null);
  if (storyType) query = query.eq("story_type", storyType);
  if (storyIds) query = query.in("id", storyIds);

  const { data: stories, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch player tags for returned stories
  const ids = (stories ?? []).map((s) => s.id);
  let tags: Array<{ story_id: string; player_id: number; sentiment: string | null; confidence: number | null; name: string }> = [];

  if (ids.length > 0) {
    const { data: rawTags } = await supabaseServer
      .from("news_player_tags")
      .select("story_id, player_id, sentiment, confidence")
      .in("story_id", ids);

    if (rawTags && rawTags.length > 0) {
      const personIds = [...new Set(rawTags.map((t) => t.player_id))];
      const { data: people } = await supabaseServer
        .from("people")
        .select("id, name")
        .in("id", personIds);

      const nameMap = new Map<number, string>();
      if (people) {
        for (const p of people) nameMap.set(p.id, p.name);
      }

      tags = rawTags.map((t) => ({
        ...t,
        name: nameMap.get(t.player_id) ?? "Unknown",
      }));
    }
  }

  // Fetch vote counts for returned stories
  let voteCounts: Record<string, Record<string, number>> = {};

  if (ids.length > 0) {
    const { data: votes } = await supabaseServer
      .from("news_story_votes")
      .select("story_id, reaction")
      .in("story_id", ids);

    if (votes) {
      for (const v of votes) {
        if (!voteCounts[v.story_id]) {
          voteCounts[v.story_id] = { fire: 0, love: 0, gutted: 0, shocked: 0 };
        }
        voteCounts[v.story_id][v.reaction] = (voteCounts[v.story_id][v.reaction] ?? 0) + 1;
      }
    }
  }

  return NextResponse.json({ stories: stories ?? [], tags, voteCounts });
}
