import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const READ_PATTERN = /^\s*(SELECT|WITH|EXPLAIN|SHOW)\b/i;
const ADMIN_KEY = process.env.CRON_SECRET ?? "";

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Auth: require CRON_SECRET as Bearer token
  const auth = req.headers.get("authorization");
  const hasValidKey = ADMIN_KEY && auth === `Bearer ${ADMIN_KEY}`;

  if (!hasValidKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sql } = await req.json();

    if (!sql || typeof sql !== "string" || sql.trim().length === 0) {
      return NextResponse.json({ error: "No SQL provided" }, { status: 400 });
    }

    if (sql.length > 50000) {
      return NextResponse.json({ error: "Query too long (50k char limit)" }, { status: 400 });
    }

    const isRead = READ_PATTERN.test(sql.trim());
    const fnName = isRead ? "exec_sql" : "exec_sql_mutate";

    const { data, error } = await supabaseServer.rpc(fnName, { query: sql });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data: isRead ? (data ?? []) : data,
      rowCount: isRead ? (Array.isArray(data) ? data.length : 0) : data?.affected_rows ?? 0,
      type: isRead ? "query" : "mutation",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
