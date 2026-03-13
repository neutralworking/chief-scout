"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PlayerCard as PlayerCardType } from "@/lib/types";
import { PlayerCard } from "@/components/PlayerCard";
import { PlayerFilters } from "@/components/PlayerFilters";

const PAGE_SIZE = 20;

function PlayersContent() {
  const searchParams = useSearchParams();
  const [players, setPlayers] = useState<PlayerCardType[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = searchParams.get("position") ?? "";
  const pursuit = searchParams.get("pursuit") ?? "";
  const personalities = searchParams.get("personalities") ?? "";
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "value";
  const tier = searchParams.get("tier") ?? "";
  const fullOnly = searchParams.get("full") === "1";

  const buildUrl = useCallback((offset: number) => {
    const params = new URLSearchParams();
    if (position) params.set("position", position);
    if (pursuit) params.set("pursuit", pursuit);
    if (personalities) params.set("personalities", personalities);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (tier) params.set("tier", tier);
    if (fullOnly) params.set("full", "1");
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    return `/api/players/all?${params}`;
  }, [position, pursuit, personalities, q, sort, tier, fullOnly]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl(0));
        if (!res.ok) {
          setError(`Failed to load players: ${res.statusText}`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setPlayers(data.players ?? []);
          setHasMore(data.hasMore ?? false);
        }
      } catch (e) {
        if (!cancelled) setError(`Failed to load players: ${e}`);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [buildUrl]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(players.length));
      const data = await res.json();
      setPlayers((prev) => [...prev, ...(data.players ?? [])]);
      setHasMore(data.hasMore ?? false);
    } catch {
      // silently fail
    }
    setLoadingMore(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight mb-1">Players</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          {loading ? "Loading..." : `${players.length.toLocaleString()} shown`}
          {position ? ` · ${position}` : ""}
          {pursuit ? ` · ${pursuit}` : ""}
          {personalities ? ` · ${personalities}` : ""}
          {tier ? ` · Tier ${tier}` : ""}
          {fullOnly ? " · Full profiles" : ""}
        </p>
      </div>

      <PlayerFilters />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {players.map((player) => (
          <PlayerCard key={player.person_id} player={player} />
        ))}
      </div>

      {hasMore && !loading && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 text-sm font-medium glass rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Show more"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-8 glass rounded-xl p-4">
          <p className="text-sm text-[var(--sentiment-negative)]">{error}</p>
        </div>
      )}

      {!loading && !error && players.length === 0 && (
        <div className="mt-12 text-center text-[var(--text-muted)]">
          <p className="text-sm">
            {q || position || pursuit || personalities
              ? "No players match the current filters."
              : "No player data found. Run migration 007 + pipeline seed script."}
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
