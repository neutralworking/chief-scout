"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { PlayerCard as PlayerCardType, computeAge, POSITION_COLORS, PURSUIT_COLORS } from "@/lib/types";
import Link from "next/link";

const PAGE_SIZE = 25;

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PURSUIT_STATUSES = ["Priority", "Interested", "Scout Further", "Watch", "Monitor", "Pass"];

const POSITION_SHORT: Record<string, string> = {
  GK: "GK", WD: "WD", CD: "CD", DM: "DM", CM: "CM", WM: "WM", AM: "AM", WF: "WF", CF: "CF",
};

function fmtValue(eur: number | null | undefined): string {
  if (eur == null || eur <= 0) return "–";
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}m`;
  if (eur >= 1_000) return `€${(eur / 1_000).toFixed(0)}k`;
  return `€${eur}`;
}

function fmtMeur(meur: number | null | undefined): string {
  if (meur == null || meur <= 0) return "–";
  return `€${meur.toFixed(1)}m`;
}

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
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [totalShown, setTotalShown] = useState(0);

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

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [position, pursuit, q, sort, tier]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl(page * PAGE_SIZE));
        if (!res.ok) { setError(`Failed: ${res.statusText}`); setLoading(false); return; }
        const data = await res.json();
        if (!cancelled) {
          setPlayers(data.players ?? []);
          setHasMore(data.hasMore ?? false);
          setTotalShown(page * PAGE_SIZE + (data.players?.length ?? 0));
        }
      } catch (e) { if (!cancelled) setError(String(e)); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [buildUrl, page]);

  useEffect(() => { setSearchInput(q); }, [q]);

  const hasFilters = !!(position || pursuit || q || tier);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)]">
      {/* Header + Filters — fixed */}
      <div className="shrink-0">
        {/* Title + position pills + pagination */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-lg font-bold tracking-tight">Players</h1>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => updateParam("position", "")}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                !position ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
              }`}>
              All
            </button>
            {POSITIONS.map((pos) => (
              <button key={pos} onClick={() => updateParam("position", position === pos ? "" : pos)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                  position === pos ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
                }`}>
                {POSITION_SHORT[pos]}
              </button>
            ))}
          </div>
          {/* Pagination inline */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="px-2 py-0.5 text-[10px] font-medium glass rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              &larr;
            </button>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {loading ? "..." : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + players.length}`}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasMore || loading}
              className="px-2 py-0.5 text-[10px] font-medium glass rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              &rarr;
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="glass rounded-lg p-2 mb-2 flex flex-col sm:flex-row gap-1.5">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              const val = e.target.value;
              setTimeout(() => {
                if (val.length === 0 || val.length >= 2) updateParam("q", val);
              }, 300);
            }}
            placeholder="Search players..."
            className="flex-1 px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-personality)]"
          />
          <select value={pursuit} onChange={(e) => updateParam("pursuit", e.target.value)}
            className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs">
            <option value="">All Statuses</option>
            {PURSUIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={tier} onChange={(e) => updateParam("tier", e.target.value)}
            className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs">
            <option value="">All Tiers</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
          </select>
          <select value={sort} onChange={(e) => updateParam("sort", e.target.value)}
            className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs">
            <option value="role_score">Role Score</option>
            <option value="level">Level</option>
            <option value="cs_value">CS Value</option>
            <option value="tm_value">TM Value</option>
            <option value="name">Name</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setSearchInput(""); router.push("/players"); }}
              className="px-2.5 py-1 rounded border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table — fills remaining viewport */}
      <div className="flex-1 min-h-0 flex flex-col">
        {!loading && !error && players.length > 0 && (
          <div className="glass rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
            {/* Desktop table */}
            <div className="flex-1 overflow-y-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-surface)] z-10">
                  <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="text-left py-1.5 px-3 font-medium w-10">Pos</th>
                    <th className="text-left py-1.5 px-3 font-medium">Player</th>
                    <th className="text-left py-1.5 px-3 font-medium">Club</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden lg:table-cell">Nation</th>
                    <th className="text-right py-1.5 px-3 font-medium w-10">Age</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden xl:table-cell">Archetype</th>
                    <th className="text-left py-1.5 px-3 font-medium hidden lg:table-cell">Best Role</th>
                    <th className="text-right py-1.5 px-3 font-medium w-14">Score</th>
                    <th className="text-right py-1.5 px-3 font-medium w-16 hidden lg:table-cell">CS Val</th>
                    <th className="text-right py-1.5 px-3 font-medium w-16 hidden lg:table-cell">TM Val</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => {
                    const age = computeAge(player.dob);
                    const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";

                    return (
                      <tr key={player.person_id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors">
                        <td className="py-1.5 px-3">
                          <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}>
                            {player.position ?? "–"}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <Link href={`/players/${player.person_id}`}
                            className="text-[var(--text-primary)] hover:text-white transition-colors font-medium text-xs">
                            {player.name}
                          </Link>
                        </td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)]">{player.club || "–"}</td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden lg:table-cell">{player.nation || "–"}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs text-[var(--text-muted)]">{age ?? "–"}</td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden xl:table-cell">{player.archetype || "–"}</td>
                        <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden lg:table-cell">{player.best_role || "–"}</td>
                        <td className={`py-1.5 px-3 text-right font-mono font-bold text-xs ${levelColor(player.best_role_score)}`}>
                          {player.best_role_score ?? "–"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs text-[var(--color-accent-tactical)] hidden lg:table-cell">
                          {fmtMeur(player.director_valuation_meur)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs text-[var(--text-secondary)] hidden lg:table-cell">
                          {fmtValue(player.market_value_eur)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden flex-1 overflow-y-auto space-y-0.5 p-1">
              {players.map((player) => {
                const age = computeAge(player.dob);
                const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";

                return (
                  <Link key={player.person_id} href={`/players/${player.person_id}`}
                    className="rounded-lg p-2.5 flex items-center justify-between hover:bg-[var(--bg-elevated)]/50 transition-colors block">
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
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {player.best_role && (
                        <span className="text-[10px] text-[var(--text-secondary)]">{player.best_role}</span>
                      )}
                      <span className={`text-base font-mono font-bold ${levelColor(player.best_role_score)}`}>
                        {player.best_role_score ?? "–"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="glass rounded-xl py-12 text-center flex-1">
            <p className="text-sm text-[var(--text-muted)]">Loading players...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass rounded-xl p-4">
            <p className="text-sm text-[var(--color-sentiment-negative)]">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && players.length === 0 && (
          <div className="glass rounded-xl py-12 text-center flex-1">
            <p className="text-sm text-[var(--text-muted)]">
              {hasFilters ? "No players match the current filters." : "No player data found."}
            </p>
          </div>
        )}
      </div>

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
