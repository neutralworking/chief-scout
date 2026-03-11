"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { PlayerCard as PlayerCardType } from "@/lib/types";
import { PlayerCard } from "@/components/PlayerCard";
import { PlayerFilters } from "@/components/PlayerFilters";

const PURSUIT_ORDER: Record<string, number> = {
  Priority: 0,
  Interested: 1,
  "Scout Further": 2,
  Watch: 3,
  Monitor: 4,
  Pass: 5,
};

const POSITION_ORDER: Record<string, number> = {
  GK: 0, CD: 1, WD: 2, DM: 3, CM: 4, WM: 5, AM: 6, WF: 7, CF: 8,
};

function sortPlayers(players: PlayerCardType[], sortKey: string): PlayerCardType[] {
  const sorted = [...players];
  switch (sortKey) {
    case "level":
      return sorted.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    case "peak":
      return sorted.sort((a, b) => (b.peak ?? 0) - (a.peak ?? 0));
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

function PlayersContent() {
  const searchParams = useSearchParams();
  const [allPlayers, setAllPlayers] = useState<PlayerCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const position = searchParams.get("position") ?? "";
  const pursuit = searchParams.get("pursuit") ?? "";
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "pursuit";
  const tier = searchParams.get("tier") ?? "";
  const fullOnly = searchParams.get("full") === "1";

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setError("Supabase not configured. Run scripts/setup-env.sh to set credentials.");
        setLoading(false);
        return;
      }
      const { data, error: fetchError } = await supabase
        .from("player_intelligence_card")
        .select(
          "person_id, name, dob, height_cm, preferred_foot, active, nation, club, position, level, peak, overall, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt"
        );

      if (fetchError) {
        setError(`Supabase error: ${fetchError.message}. Check RLS policies (run migration 009).`);
      } else if (data) {
        setAllPlayers(data as PlayerCardType[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = allPlayers;
    if (position) result = result.filter((p) => p.position === position);
    if (pursuit) result = result.filter((p) => p.pursuit_status === pursuit);
    if (tier) { const t = parseInt(tier, 10); if (!isNaN(t)) result = result.filter((p) => p.profile_tier === t); }
    if (fullOnly) result = result.filter((p) => p.archetype != null && p.personality_type != null && p.level != null);
    if (q) result = result.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    return sortPlayers(result, sort);
  }, [allPlayers, position, pursuit, tier, fullOnly, q, sort]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight mb-1">Players</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          {loading ? "Loading..." : `${filtered.length} player${filtered.length !== 1 ? "s" : ""}`}
          {position ? ` · ${position}` : ""}
          {pursuit ? ` · ${pursuit}` : ""}
          {tier ? ` · Tier ${tier}` : ""}
          {fullOnly ? " · Full profiles" : ""}
        </p>
      </div>

      <PlayerFilters />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((player) => (
          <PlayerCard key={player.person_id} player={player} />
        ))}
      </div>

      {error && (
        <div className="mt-8 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg">
          <p className="text-sm text-[var(--sentiment-negative)]">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="mt-12 text-center text-[var(--text-muted)]">
          <p className="text-sm">
            {allPlayers.length === 0
              ? "No player data found. Run migration 007 + pipeline seed script."
              : "No players match the current filters."}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<div className="text-[var(--text-muted)] text-sm">Loading...</div>}>
      <PlayersContent />
    </Suspense>
  );
}
