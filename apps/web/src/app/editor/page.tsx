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
}

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

export default function EditorSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (query.length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/admin/player-search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.players ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-4 inline-block"
      >
        &larr; Dashboard
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Player Editor</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Search for a player to edit their attributes, profile, and scouting data.
      </p>

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
          disabled={query.length < 2 || loading}
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
          No players found for &ldquo;{query}&rdquo;
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-1">
          {results.map((p) => (
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
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {[p.club, p.nation, p.archetype].filter(Boolean).join(" · ")}
                </div>
              </div>
              <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-tactical)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
