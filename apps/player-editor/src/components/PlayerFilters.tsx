"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { POSITIONS, PURSUIT_STATUSES } from "@/lib/types";

export function PlayerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPosition = searchParams.get("position") ?? "";
  const currentPursuit = searchParams.get("pursuit") ?? "";
  const currentSearch = searchParams.get("q") ?? "";
  const currentSort = searchParams.get("sort") ?? "pursuit";

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
    [router, searchParams]
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search players..."
          defaultValue={currentSearch}
          onChange={(e) => {
            // Debounce would be nice but keeping it simple for v1
            const val = e.target.value;
            if (val.length === 0 || val.length >= 2) {
              updateParam("q", val);
            }
          }}
          className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-personality)] transition-colors"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-3">
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

        {/* Sort */}
        <select
          value={currentSort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-personality)] cursor-pointer"
        >
          <option value="pursuit">Sort: Pursuit Status</option>
          <option value="level">Sort: Level (High→Low)</option>
          <option value="name">Sort: Name (A→Z)</option>
          <option value="position">Sort: Position</option>
        </select>
      </div>
    </div>
  );
}
