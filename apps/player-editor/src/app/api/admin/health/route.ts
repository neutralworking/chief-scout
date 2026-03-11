import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Total people
  const { count: totalPeople } = await supabaseServer
    .from("people")
    .select("*", { count: "exact", head: true });

  // People with profiles
  const { count: withProfiles } = await supabaseServer
    .from("player_profiles")
    .select("*", { count: "exact", head: true });

  // People with personality
  const { count: withPersonality } = await supabaseServer
    .from("player_personality")
    .select("*", { count: "exact", head: true });

  // People with market data
  const { count: withMarket } = await supabaseServer
    .from("player_market")
    .select("*", { count: "exact", head: true });

  // People with status
  const { count: withStatus } = await supabaseServer
    .from("player_status")
    .select("*", { count: "exact", head: true });

  // People with attribute grades (distinct player_ids)
  const { data: attrPlayers } = await supabaseServer
    .from("attribute_grades")
    .select("player_id");
  const withAttributes = attrPlayers
    ? new Set(attrPlayers.map((r) => r.player_id)).size
    : 0;

  // People with wikidata_id
  const { data: wikiPlayers } = await supabaseServer
    .from("people")
    .select("id")
    .not("wikidata_id", "is", null);
  const withWikidata = wikiPlayers?.length ?? 0;

  // FBRef linked (via player_id_links)
  const { data: fbrefLinks } = await supabaseServer
    .from("player_id_links")
    .select("person_id")
    .eq("source", "fbref");
  const withFbref = fbrefLinks
    ? new Set(fbrefLinks.map((r) => r.person_id)).size
    : 0;

  // Club coverage
  const { count: totalClubs } = await supabaseServer
    .from("clubs")
    .select("*", { count: "exact", head: true });

  const { data: clubsWithNation } = await supabaseServer
    .from("clubs")
    .select("id")
    .not("nation_id", "is", null);
  const withNation = clubsWithNation?.length ?? 0;

  const { data: clubsWithLeague } = await supabaseServer
    .from("clubs")
    .select("id")
    .not("league_name", "is", null);
  const withLeague = clubsWithLeague?.length ?? 0;

  const { data: clubsWithWikidata } = await supabaseServer
    .from("clubs")
    .select("id")
    .not("wikidata_id", "is", null);
  const clubsEnriched = clubsWithWikidata?.length ?? 0;

  const { data: clubsWithPlayers } = await supabaseServer
    .from("people")
    .select("club_id")
    .not("club_id", "is", null);
  const clubIdsWithPlayers = clubsWithPlayers
    ? new Set(clubsWithPlayers.map((r) => r.club_id)).size
    : 0;

  // Full profiles: people who have ALL of profiles + personality + market + status + attributes
  const { data: profileIds } = await supabaseServer
    .from("player_profiles")
    .select("person_id");
  const { data: personalityIds } = await supabaseServer
    .from("player_personality")
    .select("person_id");
  const { data: marketIds } = await supabaseServer
    .from("player_market")
    .select("person_id");
  const { data: statusIds } = await supabaseServer
    .from("player_status")
    .select("person_id");

  const profileSet = new Set(profileIds?.map((r) => r.person_id) ?? []);
  const personalitySet = new Set(personalityIds?.map((r) => r.person_id) ?? []);
  const marketSet = new Set(marketIds?.map((r) => r.person_id) ?? []);
  const statusSet = new Set(statusIds?.map((r) => r.person_id) ?? []);
  const attrSet = new Set(attrPlayers?.map((r) => r.player_id) ?? []);

  let fullProfiles = 0;
  for (const id of profileSet) {
    if (
      personalitySet.has(id) &&
      marketSet.has(id) &&
      statusSet.has(id) &&
      attrSet.has(id)
    ) {
      fullProfiles++;
    }
  }

  return NextResponse.json({
    totalPeople: totalPeople ?? 0,
    coverage: {
      profiles: withProfiles ?? 0,
      personality: withPersonality ?? 0,
      market: withMarket ?? 0,
      status: withStatus ?? 0,
      attributes: withAttributes,
      wikidata: withWikidata,
      fbref: withFbref,
      fullProfiles,
    },
    clubs: {
      total: totalClubs ?? 0,
      withNation,
      withLeague,
      withWikidata: clubsEnriched,
      withPlayers: clubIdsWithPlayers,
    },
  });
}
