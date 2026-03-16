"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { PlayerCard as PlayerCardType, computeAge, POSITION_COLORS, PURSUIT_COLORS } from "@/lib/types";
import Link from "next/link";

const PAGE_SIZE = 40;

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PURSUIT_STATUSES = ["Priority", "Interested", "Scout Further", "Watch", "Monitor", "Pass"];

const POSITION_SHORT: Record<string, string> = {
  GK: "GK", WD: "WD", CD: "CD", DM: "DM", CM: "CM", WM: "WM", AM: "AM", WF: "WF", CF: "CF",
};

const PERSONALITY_NAMES: Record<string, string> = {
  ANLC: "General", IXSP: "Genius", ANSC: "Machine", INLC: "Captain",
  AXLC: "Warrior", INSP: "Maestro", ANLP: "Conductor", IXSC: "Maverick",
  AXSC: "Enforcer", AXSP: "Technician", AXLP: "Orchestrator", INLP: "Guardian",
  INSC: "Blade", IXLC: "Livewire", IXLP: "Playmaker", ANSP: "Professor",
};

function levelColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 85) return "text-amber-400";
  if (level >= 78) return "text-green-400";
  if (level >= 70) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function PlayersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerCardType[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const position = searchParams.get("position") ?? "";
  const pursuit = searchParams.get("pursuit") ?? "";
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "role_score";
  const tier = searchParams.get("tier") ?? "";

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`/players?${params.toString()}`);
  }, [router, searchParams]);

  const buildUrl = useCallback((offset: number) => {
    const params = new URLSearchParams();
    if (position) params.set("position", position);
    if (pursuit) params.set("pursuit", pursuit);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (tier) params.set("tier", tier);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    return `/api/players/all?${params}`;
  }, [position, pursuit, q, sort, tier]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl(0));
        if (!res.ok) { setError(`Failed: ${res.statusText}`); setLoading(false); return; }
        const data = await res.json();
        if (!cancelled) { setPlayers(data.players ?? []); setHasMore(data.hasMore ?? false); }
      } catch (e) { if (!cancelled) setError(String(e)); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [buildUrl]);

  useEffect(() => { setSearchInput(q); }, [q]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(players.length));
      const data = await res.json();
      setPlayers((prev) => [...prev, ...(data.players ?? [])]);
      setHasMore(data.hasMore ?? false);
    } catch { /* silently fail */ }
    setLoadingMore(false);
  };

  const hasFilters = !!(position || pursuit || q || tier);

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight mb-0.5">Players</h1>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {loading ? "Loading..." : `${players.length.toLocaleString()} shown`}
          {hasMore && !loading && " · more available"}
        </p>
      </div>

      {/* Position quick pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button onClick={() => updateParam("position", "")}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
            !position ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
          }`}>
          All
        </button>
        {POSITIONS.map((pos) => (
          <button key={pos} onClick={() => updateParam("position", position === pos ? "" : pos)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
              position === pos ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}>
            {POSITION_SHORT[pos]}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="glass rounded-xl p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            // Debounced search
            const val = e.target.value;
            setTimeout(() => {
              if (val.length === 0 || val.length >= 2) updateParam("q", val);
            }, 300);
          }}
          placeholder="Search players..."
          className="flex-1 px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-personality)]"
        />
        <select value={pursuit} onChange={(e) => updateParam("pursuit", e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm">
          <option value="">All Statuses</option>
          {PURSUIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tier} onChange={(e) => updateParam("tier", e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm">
          <option value="">All Tiers</option>
          <option value="1">Tier 1 — Scout Assessed</option>
          <option value="2">Tier 2 — Profiled</option>
        </select>
        <select value={sort} onChange={(e) => updateParam("sort", e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm">
          <option value="role_score">Sort: Role Score</option>
          <option value="level">Sort: Level</option>
          <option value="value">Sort: Value</option>
          <option value="name">Sort: Name</option>
        </select>
        {hasFilters && (
          <button onClick={() => { setSearchInput(""); router.push("/players"); }}
            className="px-3 py-1.5 rounded border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Desktop table */}
      {!loading && !error && players.length > 0 && (
        <div className="glass rounded-xl overflow-hidden hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-2 px-4 font-medium w-12">Pos</th>
                <th className="text-left py-2 px-4 font-medium">Player</th>
                <th className="text-left py-2 px-4 font-medium">Club</th>
                <th className="text-left py-2 px-4 font-medium hidden lg:table-cell">Nation</th>
                <th className="text-right py-2 px-4 font-medium w-12">Age</th>
                <th className="text-left py-2 px-4 font-medium hidden xl:table-cell">Archetype</th>
                <th className="text-left py-2 px-4 font-medium hidden xl:table-cell">Status</th>
                <th className="text-right py-2 px-4 font-medium w-16">Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const age = computeAge(player.dob);
                const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
                const pursuitColor = PURSUIT_COLORS[player.pursuit_status ?? ""] ?? "";

                return (
                  <tr key={player.person_id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors">
                    <td className="py-2 px-4">
                      <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}>
                        {player.position ?? "–"}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <Link href={`/players/${player.person_id}`}
                        className="text-[var(--text-primary)] hover:text-white transition-colors font-medium">
                        {player.name}
                      </Link>
                    </td>
                    <td className="py-2 px-4 text-xs text-[var(--text-secondary)]">{player.club || "–"}</td>
                    <td className="py-2 px-4 text-xs text-[var(--text-secondary)] hidden lg:table-cell">{player.nation || "–"}</td>
                    <td className="py-2 px-4 text-right font-mono text-xs text-[var(--text-muted)]">{age ?? "–"}</td>
                    <td className="py-2 px-4 text-xs text-[var(--text-secondary)] hidden xl:table-cell">{player.archetype || "–"}</td>
                    <td className="py-2 px-4 hidden xl:table-cell">
                      {player.pursuit_status && player.pursuit_status !== "Pass" && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${pursuitColor}`}>
                          {player.pursuit_status}
                        </span>
                      )}
                    </td>
                    <td className={`py-2 px-4 text-right font-mono font-bold ${levelColor(player.best_role_score)}`}>
                      {player.best_role_score ?? "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card list */}
      {!loading && !error && players.length > 0 && (
        <div className="sm:hidden space-y-1">
          {players.map((player) => {
            const age = computeAge(player.dob);
            const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";

            return (
              <Link key={player.person_id} href={`/players/${player.person_id}`}
                className="glass rounded-lg p-3 flex items-center justify-between hover:border-[var(--color-accent-personality)]/30 transition-colors block">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
                    {player.position ?? "–"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{player.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {player.club || "Unknown"}
                      {player.nation && ` · ${player.nation}`}
                      {age != null && ` · ${age}y`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {player.archetype && (
                    <span className="text-[10px] text-[var(--text-secondary)] hidden xs:inline">{player.archetype}</span>
                  )}
                  <span className={`text-lg font-mono font-bold ${levelColor(player.best_role_score)}`}>
                    {player.best_role_score ?? "–"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="mt-4 text-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="px-6 py-2 text-sm font-medium glass rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
            {loadingMore ? "Loading..." : "Show more"}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="glass rounded-xl py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">Loading players...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-4 mt-4">
          <p className="text-sm text-[var(--color-sentiment-negative)]">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && players.length === 0 && (
        <div className="glass rounded-xl py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {hasFilters ? "No players match the current filters." : "No player data found."}
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
