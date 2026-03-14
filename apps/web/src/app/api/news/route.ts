import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const storyType = searchParams.get("type");
  const playerId = searchParams.get("player");
  const limit = Math.min(Number(searchParams.get("limit") || 80), 200);

  let storyIds: string[] | null = null;

  // If filtering by player, first get story IDs from news_player_tags
  if (playerId) {
    const { data: tags } = await supabaseServer
      .from("news_player_tags")
      .select("story_id")
      .eq("player_id", playerId);

    if (!tags || tags.length === 0) {
      return NextResponse.json({ stories: [], tags: [], trackedPlayers: {} });
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
  let tags: Array<{
    story_id: string;
    player_id: number;
    sentiment: string | null;
    confidence: number | null;
    name: string;
    pursuit_status: string | null;
    position: string | null;
    club: string | null;
  }> = [];

  // Map of player_id → pursuit data for tracked players
  const trackedPlayers: Record<number, { name: string; pursuit_status: string; position: string | null; club: string | null }> = {};

  if (ids.length > 0) {
    const { data: rawTags } = await supabaseServer
      .from("news_player_tags")
      .select("story_id, player_id, sentiment, confidence")
      .in("story_id", ids);

    if (rawTags && rawTags.length > 0) {
      const personIds = [...new Set(rawTags.map((t) => t.player_id))];

      // Fetch people + pursuit status + profile in parallel
      const [peopleResult, statusResult, profileResult] = await Promise.all([
        supabaseServer.from("people").select("id, name").in("id", personIds),
        supabaseServer.from("player_status").select("person_id, pursuit_status").in("person_id", personIds).not("pursuit_status", "is", null).not("pursuit_status", "eq", "Pass"),
        supabaseServer.from("player_profiles").select("person_id, position").in("person_id", personIds),
      ]);

      const nameMap = new Map<number, string>();
      if (peopleResult.data) {
        for (const p of peopleResult.data) nameMap.set(p.id, p.name);
      }

      const pursuitMap = new Map<number, string>();
      if (statusResult.data) {
        for (const s of statusResult.data) pursuitMap.set(s.person_id, s.pursuit_status);
      }

      const positionMap = new Map<number, string>();
      if (profileResult.data) {
        for (const p of profileResult.data) positionMap.set(p.person_id, p.position);
      }

      // Get club names for tracked players
      const trackedIds = [...pursuitMap.keys()];
      const clubMap = new Map<number, string>();
      if (trackedIds.length > 0) {
        const { data: clubData } = await supabaseServer
          .from("people")
          .select("id, clubs(clubname)")
          .in("id", trackedIds);
        if (clubData) {
          for (const p of clubData as any[]) {
            if (p.clubs?.clubname) clubMap.set(p.id, p.clubs.clubname);
          }
        }
      }

      tags = rawTags.map((t) => ({
        ...t,
        name: nameMap.get(t.player_id) ?? "Unknown",
        pursuit_status: pursuitMap.get(t.player_id) ?? null,
        position: positionMap.get(t.player_id) ?? null,
        club: clubMap.get(t.player_id) ?? null,
      }));

      // Build tracked players summary
      for (const [pid, status] of pursuitMap) {
        trackedPlayers[pid] = {
          name: nameMap.get(pid) ?? "Unknown",
          pursuit_status: status,
          position: positionMap.get(pid) ?? null,
          club: clubMap.get(pid) ?? null,
        };
      }
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

  return NextResponse.json({ stories: stories ?? [], tags, trackedPlayers, voteCounts });
}
