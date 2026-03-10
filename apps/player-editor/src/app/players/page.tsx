import { Suspense } from "react";
import { createServiceClient } from "@/lib/supabase";
import { PlayerCard as PlayerCardType } from "@/lib/types";
import { PlayerCard } from "@/components/PlayerCard";
import { PlayerFilters } from "@/components/PlayerFilters";

// DoF sort: pursuit status (Priority first) > position > level desc
const PURSUIT_ORDER: Record<string, number> = {
  Priority: 0,
  Interested: 1,
  "Scout Further": 2,
  Watch: 3,
  Monitor: 4,
  Pass: 5,
};

const POSITION_ORDER: Record<string, number> = {
  GK: 0,
  CD: 1,
  WD: 2,
  DM: 3,
  CM: 4,
  WM: 5,
  AM: 6,
  WF: 7,
  CF: 8,
};

function sortPlayers(
  players: PlayerCardType[],
  sortKey: string
): PlayerCardType[] {
  const sorted = [...players];
  switch (sortKey) {
    case "level":
      return sorted.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "position":
      return sorted.sort(
        (a, b) =>
          (POSITION_ORDER[a.position ?? ""] ?? 99) -
          (POSITION_ORDER[b.position ?? ""] ?? 99)
      );
    case "pursuit":
    default:
      return sorted.sort((a, b) => {
        const pa = PURSUIT_ORDER[a.pursuit_status ?? ""] ?? 99;
        const pb = PURSUIT_ORDER[b.pursuit_status ?? ""] ?? 99;
        if (pa !== pb) return pa - pb;
        const posa = POSITION_ORDER[a.position ?? ""] ?? 99;
        const posb = POSITION_ORDER[b.position ?? ""] ?? 99;
        if (posa !== posb) return posa - posb;
        return (b.level ?? 0) - (a.level ?? 0);
      });
  }
}

async function fetchPlayers(params: {
  q?: string;
  position?: string;
  pursuit?: string;
  sort?: string;
}): Promise<PlayerCardType[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("player_intelligence_card")
    .select(
      "person_id, name, dob, height_cm, preferred_foot, active, nation, club, position, level, peak, overall, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt"
    );

  if (params.position) {
    query = query.eq("position", params.position);
  }

  if (params.pursuit) {
    query = query.eq("pursuit_status", params.pursuit);
  }

  if (params.q) {
    query = query.ilike("name", `%${params.q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching players:", error);
    return [];
  }

  return sortPlayers(data as PlayerCardType[], params.sort ?? "pursuit");
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const players = await fetchPlayers(params);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight mb-1">Players</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          {players.length} player{players.length !== 1 ? "s" : ""}
          {params.position ? ` · ${params.position}` : ""}
          {params.pursuit ? ` · ${params.pursuit}` : ""}
        </p>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <PlayerFilters />
      </Suspense>

      {/* Card grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {players.map((player) => (
          <PlayerCard key={player.person_id} player={player} />
        ))}
      </div>

      {players.length === 0 && (
        <div className="mt-12 text-center text-[var(--text-muted)]">
          <p className="text-sm">No players match the current filters.</p>
        </div>
      )}
    </div>
  );
}
