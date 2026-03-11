"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useEffect } from "react";
import { POSITIONS, PURSUIT_STATUSES } from "@/lib/types";

export function PlayerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentPosition = searchParams.get("position") ?? "";
  const currentPursuit = searchParams.get("pursuit") ?? "";
  const currentSearch = searchParams.get("q") ?? "";
  const currentSort = searchParams.get("sort") ?? "pursuit";
  const currentTier = searchParams.get("tier") ?? "";
  const fullOnly = searchParams.get("full") === "1";

  const hasFilters = !!(currentPosition || currentPursuit || currentSearch || currentTier || fullOnly);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/players?${params.toString()}`);
    },
    [router, searchParams],
  );

  const clearAll = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
    router.push("/players");
  }, [router]);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search players... (press / to focus)"
          defaultValue={currentSearch}
          onChange={(e) => {
            const val = e.target.value;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              if (val.length === 0 || val.length >= 2) {
                updateParam("q", val);
              }
            }, 250);
          }}
          className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-personality)] transition-colors"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Position filter */}
        <select
          value={currentPosition}
          onChange={(e) => updateParam("position", e.target.value)}
          className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-personality)] cursor-pointer"
        >
          <option value="">All Positions</option>
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>

        {/* Pursuit status filter */}
        <select
          value={currentPursuit}
          onChange={(e) => updateParam("pursuit", e.target.value)}
          className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-personality)] cursor-pointer"
        >
          <option value="">All Statuses</option>
          {PURSUIT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Tier filter */}
        <select
          value={currentTier}
          onChange={(e) => updateParam("tier", e.target.value)}
          className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-personality)] cursor-pointer"
        >
          <option value="">All Tiers</option>
          <option value="1">Tier 1 — Scout Assessed</option>
          <option value="2">Tier 2 — Profiled</option>
        </select>

        {/* Full profiles toggle */}
        <button
          onClick={() => updateParam("full", fullOnly ? "" : "1")}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            fullOnly
              ? "bg-[var(--accent-personality)]/15 border-[var(--accent-personality)]/40 text-[var(--accent-personality)]"
              : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Full Profiles
        </button>

        {/* Sort */}
        <select
          value={currentSort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-personality)] cursor-pointer"
        >
          <option value="pursuit">Sort: Pursuit Status</option>
          <option value="level">Sort: Level (High→Low)</option>
          <option value="peak">Sort: Peak (High→Low)</option>
          <option value="name">Sort: Name (A→Z)</option>
          <option value="position">Sort: Position</option>
        </select>

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-[10px] font-medium tracking-wide text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
