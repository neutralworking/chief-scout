import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const [
    totalPeopleResult,
    tier1Result,
    fullProfilesResult,
    trackedResult,
    profilesResult,
    personalityResult,
    marketResult,
    statusResult,
    attributesResult,
    wikidataResult,
    newsStoriesResult,
    newsTagsResult,
    usMatchResult,
    usStatsResult,
    clubsTotalResult,
    clubsWithNationResult,
    clubsWithLeagueResult,
    clubsWithWikidataResult,
    clubsWithStadiumResult,
    valuationsResult,
    freeAgentsResult,
    latestValuationResult,
  ] = await Promise.all([
    supabaseServer.from("people").select("id", { count: "exact", head: true }),
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).eq("profile_tier", 1),
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }).not("archetype", "is", null).eq("profile_tier", 1),
    supabaseServer.from("player_intelligence_card").select("person_id", { count: "exact", head: true })
      .in("pursuit_status", ["Priority", "Interested", "Watch", "Scout Further", "Monitor"]),
    supabaseServer.from("player_profiles").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_personality").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_market").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("player_status").select("person_id", { count: "exact", head: true }),
    supabaseServer.from("attribute_grades").select("player_id", { count: "exact", head: true }),
    supabaseServer.from("people").select("id", { count: "exact", head: true }).not("wikidata_id", "is", null),
    supabaseServer.from("news_stories").select("id", { count: "exact", head: true }),
    supabaseServer.from("news_player_tags").select("id", { count: "exact", head: true }),
    supabaseServer.from("understat_matches").select("id", { count: "exact", head: true }),
    supabaseServer.from("understat_player_match_stats").select("id", { count: "exact", head: true }),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("nation_id", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("league_name", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("wikidata_id", "is", null),
    supabaseServer.from("clubs").select("id", { count: "exact", head: true }).not("stadium", "is", null),
    supabaseServer.from("player_valuations").select("id", { count: "exact", head: true }),
    supabaseServer.from("people").select("id", { count: "exact", head: true }).not("contract_expiry_date", "is", null),
    supabaseServer.from("player_valuations").select("evaluated_at").order("evaluated_at", { ascending: false }).limit(1),
  ]);

  const totalPlayers = totalPeopleResult.count ?? 0;

  return NextResponse.json({
    stats: {
      totalPlayers,
      tier1Profiles: tier1Result.count ?? 0,
      fullProfiles: fullProfilesResult.count ?? 0,
      tracked: trackedResult.count ?? 0,
      freeAgents: freeAgentsResult.count ?? 0,
    },
    coverage: {
      total: totalPlayers,
      profiles: profilesResult.count ?? 0,
      personality: personalityResult.count ?? 0,
      market: marketResult.count ?? 0,
      status: statusResult.count ?? 0,
      attributes: attributesResult.count ?? 0,
      wikidata: wikidataResult.count ?? 0,
      newsStories: newsStoriesResult.count ?? 0,
      newsTags: newsTagsResult.count ?? 0,
    },
    external: {
      understat: { matches: usMatchResult.count ?? 0, playerStats: usStatsResult.count ?? 0 },
    },
    valuations: valuationsResult.count ?? 0,
    latestValuationAt: latestValuationResult.data?.[0]?.evaluated_at ?? null,
    clubs: {
      total: clubsTotalResult.count ?? 0,
      withNation: clubsWithNationResult.count ?? 0,
      withLeague: clubsWithLeagueResult.count ?? 0,
      withWikidata: clubsWithWikidataResult.count ?? 0,
      withStadium: clubsWithStadiumResult.count ?? 0,
    },
  });
}
