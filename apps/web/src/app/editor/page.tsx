"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface PlayerResult {
  person_id: number;
  name: string;
  club: string | null;
  nation: string | null;
  position: string | null;
  level: number | null;
  pursuit_status: string | null;
  archetype: string | null;
  scouting_notes: string | null;
  personality_type: string | null;
  market_value_tier: string | null;
}

const POSITIONS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-amber-700/60",
  CD: "bg-blue-700/60",
  WD: "bg-blue-600/60",
  DM: "bg-green-700/60",
  CM: "bg-green-600/60",
  WM: "bg-green-500/60",
  AM: "bg-purple-600/60",
  WF: "bg-red-600/60",
  CF: "bg-red-700/60",
};

function completeness(p: PlayerResult): { filled: number; total: number; missing: string[] } {
  const fields: [string, unknown][] = [
    ["Position", p.position],
    ["Archetype", p.archetype],
    ["Level", p.level],
    ["Scouting Notes", p.scouting_notes],
    ["Personality", p.personality_type],
    ["Market", p.market_value_tier],
  ];
  const missing = fields.filter(([, v]) => v == null || v === "").map(([k]) => k as string);
  return { filled: fields.length - missing.length, total: fields.length, missing };
}

export default function EditorSearchPage() {
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [missingFilter, setMissingFilter] = useState(false);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    const hasQuery = query.length >= 2;
    const hasFilter = positionFilter !== "" || missingFilter;
    if (!hasQuery && !hasFilter) return;

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (hasQuery) params.set("q", query);
      if (positionFilter) params.set("position", positionFilter);
      if (missingFilter) params.set("missing", "1");

      const res = await fetch(`/api/admin/player-search?${params.toString()}`);
      const data = await res.json();
      setResults(data.players ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, positionFilter, missingFilter]);

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-4 inline-block"
      >
        &larr; Dashboard
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Player Editor</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Search for a player to edit their attributes, profile, and scouting data.
      </p>

      {/* Position filter buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => {
              setPositionFilter(positionFilter === pos ? "" : pos);
            }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all ${
              positionFilter === pos
                ? `${POSITION_COLORS[pos]} text-white`
                : "bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]"
            }`}
          >
            {pos}
          </button>
        ))}
        <button
          onClick={() => setMissingFilter(!missingFilter)}
          className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all ${
            missingFilter
              ? "bg-red-600/60 text-white"
              : "bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]"
          }`}
          title="Show players with level >= 70 missing position, archetype, or scouting notes"
        >
          Missing Data
        </button>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search by name..."
          className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-tactical)] transition-colors"
          autoFocus
        />
        <button
          onClick={search}
          disabled={(query.length < 2 && !positionFilter && !missingFilter) || loading}
          className="px-5 py-2.5 rounded-lg bg-[var(--accent-tactical)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          No players found.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-[var(--text-muted)] mb-2">{results.length} result{results.length !== 1 ? "s" : ""}</div>
          {results.map((p) => {
            const comp = completeness(p);
            return (
              <Link
                key={p.person_id}
                href={`/editor/${p.person_id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-solid)] hover:border-[var(--accent-tactical)]/50 hover:bg-[var(--bg-elevated)]/50 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm group-hover:text-[var(--accent-tactical)] transition-colors">
                      {p.name}
                    </span>
                    {p.position && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position] ?? "bg-gray-600/60"} text-white`}>
                        {p.position}
                      </span>
                    )}
                    {p.level != null && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        Lv.{p.level}
                      </span>
                    )}
                    {p.archetype && (
                      <span className="text-[10px] text-purple-400">
                        {p.archetype}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {[p.club, p.nation].filter(Boolean).join(" · ")}
                    {p.pursuit_status && <span className="ml-2 text-[var(--accent-tactical)]">{p.pursuit_status}</span>}
                  </div>
                </div>

                {/* Completeness indicator */}
                <div className="flex items-center gap-1.5 shrink-0" title={comp.missing.length > 0 ? `Missing: ${comp.missing.join(", ")}` : "Complete"}>
                  <div className="flex gap-0.5">
                    {Array.from({ length: comp.total }, (_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-3 rounded-sm ${i < comp.filled ? "bg-[var(--accent-tactical)]" : "bg-[var(--border-subtle)]"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">{comp.filled}/{comp.total}</span>
                </div>

                <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-tactical)] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
