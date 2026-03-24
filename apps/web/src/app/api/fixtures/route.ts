import { supabaseServer } from "@/lib/supabase-server";
import {
  predictMatch,
  fifaPointsToPower,
  type PredictionResult,
} from "@/lib/prediction-engine";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const competition = searchParams.get("competition");
  const clubId = searchParams.get("club");
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const status = searchParams.get("status");
  const compType = searchParams.get("type"); // domestic | continental | international

  // Build query
  let query = supabaseServer
    .from("fixtures")
    .select("*")
    .in("status", status ? [status] : ["SCHEDULED", "TIMED"])
    .gte("utc_date", new Date().toISOString())
    .lte("utc_date", new Date(Date.now() + days * 86400000).toISOString())
    .order("utc_date", { ascending: true });

  if (competition) {
    query = query.eq("competition_code", competition);
  }
  if (compType) {
    query = query.eq("competition_type", compType);
  }
  if (clubId) {
    const id = parseInt(clubId, 10);
    query = query.or(`home_club_id.eq.${id},away_club_id.eq.${id}`);
  }

  const { data: fixtures, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Collect unique club IDs and nation IDs for enrichment
  const clubIds = new Set<number>();
  const nationIds = new Set<number>();
  for (const f of fixtures ?? []) {
    if (f.home_club_id) clubIds.add(f.home_club_id);
    if (f.away_club_id) clubIds.add(f.away_club_id);
    if (f.home_nation_id) nationIds.add(f.home_nation_id);
    if (f.away_nation_id) nationIds.add(f.away_nation_id);
  }

  // Fetch club metadata + power ratings in parallel
  const clubPromise =
    clubIds.size > 0
      ? supabaseServer
          .from("clubs")
          .select(
            "id, clubname, short_name, formation, team_tactical_style, offensive_style, defensive_style, logo_url, league_name, power_rating",
          )
          .in("id", Array.from(clubIds))
      : Promise.resolve({ data: [] });

  // Fetch nation metadata for international fixtures
  const nationPromise =
    nationIds.size > 0
      ? supabaseServer
          .from("nations")
          .select("id, name, fifa_rank, fifa_points")
          .in("id", Array.from(nationIds))
      : Promise.resolve({ data: [] });

  const [{ data: clubData }, { data: nationData }] = await Promise.all([
    clubPromise,
    nationPromise,
  ]);

  const clubs: Record<number, any> = {};
  for (const c of clubData ?? []) {
    clubs[c.id] = c;
  }

  const nations: Record<number, any> = {};
  for (const n of nationData ?? []) {
    nations[n.id] = n;
  }

  // Enrich fixtures with club/nation data + predictions
  const enriched = (fixtures ?? []).map((f: any) => {
    const homeClub = f.home_club_id ? clubs[f.home_club_id] ?? null : null;
    const awayClub = f.away_club_id ? clubs[f.away_club_id] ?? null : null;
    const homeNation = f.home_nation_id
      ? nations[f.home_nation_id] ?? null
      : null;
    const awayNation = f.away_nation_id
      ? nations[f.away_nation_id] ?? null
      : null;

    // Compute prediction (prefer cached, fallback to live computation)
    let prediction: Record<string, any> | null = null;

    if (f.home_win_prob != null && f.predictions_computed_at) {
      // Use cached prediction from pipeline
      prediction = {
        scoreline: {
          home: Math.round(f.predicted_home_goals),
          away: Math.round(f.predicted_away_goals),
        },
        homeXG: f.predicted_home_goals,
        awayXG: f.predicted_away_goals,
        homeWinProb: f.home_win_prob,
        drawProb: f.draw_prob,
        awayWinProb: f.away_win_prob,
        confidence: f.prediction_confidence,
      };
    } else {
      // Live computation
      const competitionType =
        (f.competition_type as
          | "domestic"
          | "continental"
          | "international"
          | null) ?? "domestic";
      let homePower: number | null = null;
      let awayPower: number | null = null;

      if (competitionType === "international") {
        if (homeNation?.fifa_points)
          homePower = fifaPointsToPower(homeNation.fifa_points);
        if (awayNation?.fifa_points)
          awayPower = fifaPointsToPower(awayNation.fifa_points);
      } else {
        if (homeClub?.power_rating) homePower = Number(homeClub.power_rating);
        if (awayClub?.power_rating) awayPower = Number(awayClub.power_rating);
      }

      if (homePower != null && awayPower != null) {
        const result: PredictionResult = predictMatch({
          homePower,
          awayPower,
          competitionType,
        });
        prediction = {
          scoreline: result.scoreline,
          homeXG: result.homeXG,
          awayXG: result.awayXG,
          homeWinProb: result.homeWinProb,
          drawProb: result.drawProb,
          awayWinProb: result.awayWinProb,
          confidence: result.confidence,
        };
      }
    }

    return {
      ...f,
      home_club: homeClub,
      away_club: awayClub,
      home_nation: homeNation,
      away_nation: awayNation,
      prediction,
    };
  });

  // Group by competition
  const grouped: Record<string, typeof enriched> = {};
  for (const f of enriched) {
    const key = f.competition ?? "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  }

  return NextResponse.json({ fixtures: enriched, byCompetition: grouped });
}
