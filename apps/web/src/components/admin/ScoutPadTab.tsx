"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"] as const;
const PURSUIT_STATUSES = ["All", "Priority", "Interested", "Scout Further", "Watch", "Monitor"] as const;
const PAGE_SIZE = 50;

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-amber-700/60", CD: "bg-blue-700/60", WD: "bg-blue-600/60",
  DM: "bg-green-700/60", CM: "bg-green-600/60", WM: "bg-green-500/60",
  AM: "bg-purple-600/60", WF: "bg-red-600/60", CF: "bg-red-700/60",
};

interface PlayerRow {
  person_id: number;
  name: string;
  club: string | null;
  position: string | null;
  best_role: string | null;
  best_role_score: number | null;
  level: number | null;
  overall: number | null;
  archetype: string | null;
  pursuit_status: string | null;
}

function roleScoreColor(score: number | null): string {
  if (score == null) return "text-[var(--text-muted)]";
  if (score >= 80) return "text-amber-400";
  if (score >= 65) return "text-green-400";
  if (score >= 50) return "text-[var(--color-accent-mental)]";
  if (score >= 35) return "text-[var(--text-secondary)]";
  return "text-[var(--text-muted)]";
}

function levelColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 85) return "text-amber-400 font-bold";
  if (level >= 75) return "text-green-400";
  if (level >= 65) return "text-[var(--text-primary)]";
  if (level >= 50) return "text-[var(--text-secondary)]";
  return "text-[var(--text-muted)]";
}

export function ScoutPadTab() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [pursuitFilter, setPursuitFilter] = useState("All");
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const observerRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);

  const fetchPlayers = useCallback(async (reset: boolean) => {
    if (reset) {
      offsetRef.current = 0;
      setHasMore(true);
    }
    if (!reset && !hasMore) return;

    reset ? setLoading(true) : setLoadingMore(true);

    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offsetRef.current));
    params.set("sort", "level");
    params.set("order", "desc");
    if (search) params.set("q", search);
    if (posFilter) params.set("position", posFilter);
    if (pursuitFilter && pursuitFilter !== "All") params.set("pursuit", pursuitFilter);

    try {
      const res = await fetch(`/api/scout-pad?${params}`);
      const data = await res.json();
      const rows = (data.players ?? []) as PlayerRow[];

      if (reset) {
        setPlayers(rows);
      } else {
        setPlayers((prev) => [...prev, ...rows]);
      }

      offsetRef.current += rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      if (reset) setPlayers([]);
      setHasMore(false);
    }

    reset ? setLoading(false) : setLoadingMore(false);
  }, [search, posFilter, pursuitFilter, hasMore]);

  useEffect(() => {
    fetchPlayers(true);
  }, [posFilter, pursuitFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => fetchPlayers(true), 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchPlayers(false);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, fetchPlayers]);

  const saveField = useCallback(async (playerId: number, field: string, value: string) => {
    setEditingCell(null);

    const updates: Record<string, unknown> = {};
    if (field === "level") {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1 || num > 99) return;
      updates.level = num;
    } else if (field === "position") {
      if (!POSITIONS.includes(value as typeof POSITIONS[number])) return;
      updates.position = value;
    }

    setSavingIds((prev) => new Set(prev).add(playerId));

    try {
      await fetch("/api/admin/player-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: playerId, table: "player_profiles", updates }),
      });
      setPlayers((prev) =>
        prev.map((p) => p.person_id === playerId ? { ...p, ...updates } : p)
      );
    } catch { /* silently fail */ }

    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(playerId);
      return next;
    });
  }, []);

  const startEdit = (id: number, field: string, currentValue: string | number | null) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue ?? ""));
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, playerId: number, field: string) => {
    if (e.key === "Enter") { e.preventDefault(); saveField(playerId, field, editValue); }
    if (e.key === "Escape") { setEditingCell(null); }
  };

  return (
    <div>
      <p className="text-[11px] text-[var(--text-secondary)] mb-3">
        {players.length} players loaded. Click level or position to edit inline.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name..."
          className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-tactical)] w-48"
        />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent-tactical)] cursor-pointer"
        >
          <option value="">All Positions</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={pursuitFilter}
          onChange={(e) => setPursuitFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent-tactical)] cursor-pointer"
        >
          {PURSUIT_STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All Pursuit" : s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-2 px-3">Player</th>
                <th className="text-center py-2 px-2 w-14">Pos</th>
                <th className="text-left py-2 px-2">Best Role</th>
                <th className="text-center py-2 px-2 w-14">RS</th>
                <th className="text-center py-2 px-2 w-14">Level</th>
                <th className="text-center py-2 px-2 w-14">OVR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--text-muted)]">
                    <div className="inline-block w-5 h-5 border-2 border-[var(--text-muted)] border-t-[var(--color-accent-tactical)] rounded-full animate-spin" />
                  </td>
                </tr>
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[var(--text-muted)]">No players found.</td>
                </tr>
              ) : (
                players.map((p) => {
                  const isSaving = savingIds.has(p.person_id);
                  return (
                    <tr
                      key={p.person_id}
                      className={`border-t border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/40 transition-colors ${isSaving ? "opacity-50" : ""}`}
                    >
                      <td className="py-1.5 px-3">
                        <Link href={`/players/${p.person_id}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--color-accent-personality)] transition-colors">
                          {p.name}
                        </Link>
                        {p.club && <span className="text-[9px] text-[var(--text-muted)] ml-1.5">{p.club}</span>}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {editingCell?.id === p.person_id && editingCell?.field === "position" ? (
                          <select
                            value={editValue}
                            onChange={(e) => { setEditValue(e.target.value); saveField(p.person_id, "position", e.target.value); }}
                            onBlur={() => setEditingCell(null)}
                            className="w-14 px-1 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-elevated)] border border-[var(--color-accent-tactical)] text-[var(--text-primary)] focus:outline-none"
                            autoFocus
                          >
                            {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                          </select>
                        ) : (
                          <button
                            onClick={() => startEdit(p.person_id, "position", p.position)}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60"} text-white hover:ring-1 hover:ring-[var(--color-accent-tactical)] transition-all cursor-pointer`}
                          >
                            {p.position ?? "\u2013"}
                          </button>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-[10px] text-[var(--text-secondary)]">
                        {p.best_role ?? <span className="text-[var(--text-muted)]">&ndash;</span>}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-mono ${roleScoreColor(p.best_role_score)}`}>
                        {p.best_role_score ?? "\u2013"}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {editingCell?.id === p.person_id && editingCell?.field === "level" ? (
                          <input
                            type="number" min={1} max={99}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveField(p.person_id, "level", editValue)}
                            onKeyDown={(e) => handleEditKeyDown(e, p.person_id, "level")}
                            className="w-12 px-1 py-0.5 rounded text-center font-mono text-[11px] bg-[var(--bg-elevated)] border border-[var(--color-accent-tactical)] text-[var(--text-primary)] focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(p.person_id, "level", p.level)}
                            className={`font-mono cursor-pointer hover:bg-[var(--bg-elevated)] px-2 py-0.5 rounded transition-colors ${levelColor(p.level)}`}
                          >
                            {p.level ?? "\u2013"}
                          </button>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-[var(--text-muted)]">
                        {p.overall ?? "\u2013"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div ref={observerRef} className="h-4" />
        {loadingMore && (
          <div className="text-center py-3">
            <div className="inline-block w-4 h-4 border-2 border-[var(--text-muted)] border-t-[var(--color-accent-tactical)] rounded-full animate-spin" />
          </div>
        )}
        {!hasMore && players.length > 0 && (
          <p className="text-center py-2 text-[9px] text-[var(--text-muted)]">All {players.length} players loaded.</p>
        )}
      </div>
    </div>
  );
}
