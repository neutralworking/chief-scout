import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeIdealSquad, type PoolPlayer } from "@/lib/ideal-squad";

export const maxDuration = 300; // 5 minutes for 48 nations

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

/** Paginated fetch — Supabase caps at 1,000 rows per request */
async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const result = await queryFn().range(offset, offset + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    if (!result.data || result.data.length === 0) break;
    all.push(...(result.data as T[]));
    if (result.data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

/**
 * GET /api/cron/otp-squads
 *
 * Batch-computes ideal 26-man squads for all 48 WC nations.
 * Uses the same computeIdealSquad() logic as the on-the-fly API.
 *
 * Query params:
 *   ?nation=<slug>  — compute for a single nation (for testing)
 *   ?force=true     — recompute even if cached
 */
export async function GET(req: NextRequest) {
  // Auth
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const singleSlug = req.nextUrl.searchParams.get("nation");
  const force = req.nextUrl.searchParams.get("force") === "true";

  // Fetch WC nations
  let nationsQuery = sb.from("wc_nations").select("nation_id, slug, kit_emoji");
  if (singleSlug) {
    nationsQuery = nationsQuery.eq("slug", singleSlug);
  }
  const { data: nations, error: nationsErr } = await nationsQuery;
  if (nationsErr || !nations) {
    return NextResponse.json({ error: "Failed to fetch nations", detail: nationsErr?.message }, { status: 500 });
  }

  // Skip nations with existing cached squads (unless force)
  let skipIds = new Set<number>();
  if (!force) {
    const { data: cached } = await sb
      .from("otp_ideal_squads")
      .select("nation_id");
    skipIds = new Set((cached ?? []).map((c) => c.nation_id));
  }

  const results: {
    slug: string;
    emoji: string;
    nation_id: number;
    status: string;
    pool_size?: number;
    formation?: string;
    strength?: number;
  }[] = [];

  const today = new Date();

  for (const nation of nations) {
    const { nation_id, slug, kit_emoji } = nation;

    if (skipIds.has(nation_id)) {
      results.push({ slug, emoji: kit_emoji, nation_id, status: "cached" });
      continue;
    }

    try {
      // Step 1: Collect all person IDs for this nation (primary + dual nationals)
      const primaryPeople = await fetchAll<{ id: number }>(() =>
        sb.from("people").select("id").eq("nation_id", nation_id).eq("active", true).neq("is_female", true)
      );
      const { data: dualNationals } = await sb
        .from("player_nationalities")
        .select("person_id, people!inner(active, is_female)")
        .eq("nation_id", nation_id)
        .eq("people.active", true)
        .neq("people.is_female", true);

      const allIds = new Set<number>();
      for (const p of primaryPeople) allIds.add(p.id);
      for (const d of dualNationals ?? []) allIds.add(d.person_id);
      const personIds = [...allIds];

      if (personIds.length < 11) {
        results.push({
          slug,
          emoji: kit_emoji,
          nation_id,
          status: "skipped_insufficient",
          pool_size: personIds.length,
        });
        continue;
      }

      // Step 2: Fetch player data from intelligence card view
      type PIC = {
        person_id: number;
        name: string;
        position: string | null;
        level: number | null;
        archetype: string | null;
        personality_type: string | null;
        club: string | null;
        best_role: string | null;
        best_role_score: number | null;
        overall_pillar_score: number | null;
        active: boolean;
      };
      const picPlayers = await fetchAll<PIC>(() =>
        sb
          .from("player_intelligence_card")
          .select("person_id, name, position, level, archetype, personality_type, club, best_role, best_role_score, overall_pillar_score, active")
          .in("person_id", personIds)
          .eq("active", true)
      );

      const allPlayers: PoolPlayer[] = picPlayers.map((p) => ({
        person_id: p.person_id,
        name: p.name,
        position: p.position,
        level: p.level,
        overall_pillar_score: p.overall_pillar_score,
        archetype: p.archetype,
        personality_type: p.personality_type,
        age: null,
        club: p.club,
        best_role: p.best_role,
        best_role_score: p.best_role_score,
        international_caps: null,
        has_national_team_history: false,
      }));

      // Enrich with age, caps, national team history
      if (allPlayers.length > 0) {
        const enrichIds = allPlayers.map((p) => p.person_id);
        const people = await fetchAll<{ id: number; date_of_birth: string | null; international_caps: number | null }>(
          () => sb.from("people").select("id, date_of_birth, international_caps").in("id", enrichIds)
        );

        const peopleMap = new Map(people.map((pp) => [pp.id, pp]));
        for (const player of allPlayers) {
          const info = peopleMap.get(player.person_id);
          if (info?.date_of_birth) {
            const birth = new Date(info.date_of_birth);
            player.age = Math.floor(
              (today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
            );
          }
          player.international_caps = info?.international_caps ?? null;
        }

        // National team career history
        const careers = await fetchAll<{ person_id: number }>(
          () =>
            sb
              .from("player_career_history")
              .select("person_id")
              .in("person_id", enrichIds)
              .eq("team_type", "national_team")
        );
        const historySet = new Set(careers.map((c) => c.person_id));
        for (const player of allPlayers) {
          player.has_national_team_history = historySet.has(player.person_id);
        }
      }

      // Compute ideal squad
      const ideal = computeIdealSquad(allPlayers);
      if (!ideal) {
        results.push({
          slug,
          emoji: kit_emoji,
          nation_id,
          status: "computation_failed",
          pool_size: allPlayers.length,
        });
        continue;
      }

      // Build squad_json matching the schema: [{person_id, name, position, pool_category, is_starter, slot, role_score}]
      const squadJson = [
        ...ideal.starting_xi.map((s) => ({
          person_id: s.person_id,
          name: s.name,
          position: s.position,
          pool_category: s.pool_category,
          is_starter: true,
          slot: s.role,
          role_score: s.role_score,
        })),
        ...ideal.bench.map((b) => ({
          person_id: b.person_id,
          name: b.name,
          position: b.position,
          pool_category: b.pool_category,
          is_starter: false,
          slot: null,
          role_score: null,
        })),
      ];

      // Build pool_json (full categorized pool for reference)
      const poolJson = allPlayers.map((p) => ({
        person_id: p.person_id,
        name: p.name,
        position: p.position,
        level: p.level,
        pool_category: p.pool_category,
      }));

      // Upsert
      const { error: upsertErr } = await sb.from("otp_ideal_squads").upsert(
        {
          nation_id,
          formation: ideal.formation,
          squad_json: squadJson,
          pool_json: poolJson,
          strength: ideal.strength,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "nation_id" }
      );

      if (upsertErr) {
        results.push({
          slug,
          emoji: kit_emoji,
          nation_id,
          status: `error: ${upsertErr.message}`,
          pool_size: allPlayers.length,
        });
        continue;
      }

      results.push({
        slug,
        emoji: kit_emoji,
        nation_id,
        status: "computed",
        pool_size: allPlayers.length,
        formation: ideal.formation,
        strength: ideal.strength,
      });
    } catch (err) {
      results.push({
        slug,
        emoji: kit_emoji,
        nation_id,
        status: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const computed = results.filter((r) => r.status === "computed").length;
  const cached = results.filter((r) => r.status === "cached").length;
  const skipped = results.filter((r) => r.status === "skipped_insufficient").length;
  const errors = results.filter((r) => r.status.startsWith("error")).length;

  return NextResponse.json({
    summary: { total: results.length, computed, cached, skipped, errors },
    results,
  });
}
