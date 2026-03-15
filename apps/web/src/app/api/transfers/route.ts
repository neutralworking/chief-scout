import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = req.nextUrl;
  const window = searchParams.get("window");
  const feeType = searchParams.get("fee_type");
  const dealContext = searchParams.get("deal_context");
  const position = searchParams.get("position");
  const league = searchParams.get("league");
  const feeMin = searchParams.get("fee_min");
  const feeMax = searchParams.get("fee_max");
  const sort = searchParams.get("sort") ?? "date";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  let query = supabase.from("transfers").select("*");

  if (window) query = query.eq("window", window);
  if (feeType) query = query.eq("fee_type", feeType);
  if (dealContext) query = query.eq("deal_context", dealContext);
  if (position) query = query.ilike("position", `%${position}%`);
  if (league) {
    query = query.or(`from_league.ilike.%${league}%,to_league.ilike.%${league}%`);
  }
  if (feeMin) query = query.gte("fee_eur_m", parseFloat(feeMin));
  if (feeMax) query = query.lte("fee_eur_m", parseFloat(feeMax));

  switch (sort) {
    case "fee":
      query = query.order("fee_eur_m", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "name":
      query = query.order("player_name", { ascending: true });
      break;
    case "date":
    default:
      query = query.order("transfer_date", { ascending: false });
      break;
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transfers: data ?? [], total: data?.length ?? 0 });
}
