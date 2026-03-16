import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { isProduction, prodFilter } from "@/lib/env";

const SELECT = [
  "id","name","club","division","nation",
  "position","secondary_position",
  "level","peak",
  "archetype","archetype_confidence","archetype_override",
  "market_value_tier","scarcity_score","national_scarcity","market_premium",
  "scouting_notes",
  "pursuit_status","director_valuation_meur","fit_note",
  "squad_role","loan_status",
  "blueprint",
].join(", ");

// Maps each editable field to its target table
const FIELD_TABLE: Record<string, string> = {
  // player_profiles
  position: "player_profiles", secondary_position: "player_profiles",
  level: "player_profiles", peak: "player_profiles",
  archetype_override: "player_profiles", blueprint: "player_profiles",
  // player_status
  scouting_notes: "player_status", pursuit_status: "player_status",
  fit_note: "player_status", squad_role: "player_status", loan_status: "player_status",
  // player_market
  director_valuation_meur: "player_market",
};
const ALLOWED = Object.keys(FIELD_TABLE);

const SORT_FIELDS: Record<string, { column: string; ascending: boolean; nullsFirst: boolean }> = {
  level_desc:             { column: "level",             ascending: false, nullsFirst: false },
  level_asc:              { column: "level",             ascending: true,  nullsFirst: true },
  name_asc:               { column: "name",              ascending: true,  nullsFirst: false },
  name_desc:              { column: "name",              ascending: false, nullsFirst: false },
  scarcity_score_desc:    { column: "scarcity_score",    ascending: false, nullsFirst: false },
  scarcity_score_asc:     { column: "scarcity_score",    ascending: true,  nullsFirst: true },
};

export async function GET(req: Request) {
  const supabase = supabaseServer!;
  const { searchParams } = new URL(req.url);
  const limit    = parseInt(searchParams.get("limit")  ?? "60");
  const offset   = parseInt(searchParams.get("offset") ?? "0");
  const search   = searchParams.get("search")?.trim()   ?? "";
  const position = searchParams.get("position")          ?? "";
  const pursuit  = searchParams.get("pursuit")           ?? "";
  const division = searchParams.get("division")          ?? "";
  const sortKey  = searchParams.get("sort")              ?? "level_desc";

  let query = supabase
    .from("players")
    .select(SELECT)
    .or("club.not.is.null,division.not.is.null");

  // --- filters ---

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (position) {
    query = query.eq("position", position);
  }

  if (pursuit === "unset") {
    query = query.is("pursuit_status", null);
  } else if (pursuit) {
    query = query.eq("pursuit_status", pursuit);
  } else {
    // Default behaviour: exclude "Pass"
    query = query.or("pursuit_status.is.null,pursuit_status.neq.Pass");
  }

  if (division) {
    query = query.eq("division", division);
  }

  // --- sorting ---

  const sort = SORT_FIELDS[sortKey] ?? SORT_FIELDS["level_desc"];
  query = query
    .order("pursuit_status", { ascending: true, nullsFirst: true })
    .order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst });

  // --- pagination ---

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function PATCH(req: Request) {
  // Block write operations in production (use admin tools on staging only)
  if (isProduction()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = supabaseServer!;
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Group updates by target table
  const updates: Record<string, Record<string, unknown>> = {};
  for (const key of ALLOWED) {
    if (key in fields && fields[key] !== undefined) {
      const table = FIELD_TABLE[key];
      if (!updates[table]) updates[table] = {};
      updates[table][key] = fields[key] === "" ? null : fields[key];
    }
  }
  if (!Object.keys(updates).length)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  for (const [table, payload] of Object.entries(updates)) {
    const { error } = await supabase.from(table).update(payload).eq("person_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
