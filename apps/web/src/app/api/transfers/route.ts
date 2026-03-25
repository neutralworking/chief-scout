import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const transferWindow = searchParams.get("window");
  const position = searchParams.get("position");
  const feeType = searchParams.get("fee_type");
  const source = searchParams.get("source");
  const sort = searchParams.get("sort") ?? "fee_desc";
  const limit = parseInt(searchParams.get("limit") ?? "100", 10);

  let query = supabase.from("transfers").select("*");

  if (transferWindow) query = query.eq("transfer_window", transferWindow);
  if (position) query = query.eq("position", position);
  if (feeType) query = query.eq("fee_type", feeType);
  if (source) query = query.eq("source", source);

  switch (sort) {
    case "fee_asc":
      query = query.order("fee_eur_m", { ascending: true, nullsFirst: false });
      break;
    case "date_desc":
      query = query.order("transfer_date", { ascending: false, nullsFirst: false });
      break;
    case "date_asc":
      query = query.order("transfer_date", { ascending: true, nullsFirst: false });
      break;
    case "fee_desc":
    default:
      query = query.order("fee_eur_m", { ascending: false, nullsFirst: false });
      break;
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transfers: data ?? [] });
}
