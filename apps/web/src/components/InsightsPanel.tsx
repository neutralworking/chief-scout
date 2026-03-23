"use client";

import { useCallback, useEffect, useState } from "react";
import { InsightCard, type InsightData } from "./InsightCard";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PAGE_SIZE = 25;

interface InsightsPanelProps {
  position?: string;
  league?: string;
}

export function InsightsPanel({ position: externalPosition, league }: InsightsPanelProps) {
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [posFilter, setPosFilter] = useState(externalPosition ?? "");

  const activePosition = externalPosition ?? posFilter;

  const fetchInsights = useCallback(async (off: number, append: boolean) => {
    if (off === 0) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (activePosition) params.set("position", activePosition);
      if (league) params.set("league", league);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(off));

      const res = await fetch(`/api/insights?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (append) {
        setInsights((prev) => [...prev, ...(data.insights ?? [])]);
      } else {
        setInsights(data.insights ?? []);
      }
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activePosition, league]);

  useEffect(() => {
    setOffset(0);
    fetchInsights(0, false);
  }, [fetchInsights]);

  function loadMore() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchInsights(next, true);
  }

  return (
    <div className="space-y-2">
      {/* Position filter (only if not controlled externally) */}
      {!externalPosition && (
        <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setPosFilter("")}
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
              !posFilter
                ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            ALL
          </button>
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(posFilter === pos ? "" : pos)}
              className={`text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap transition-colors ${
                posFilter === pos
                  ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      )}

      {/* Insight cards */}
      {!loading && insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight) => (
            <InsightCard key={`${insight.person_id}-${insight.insight_type}`} insight={insight} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && insights.length === 0 && (
        <div className="card py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">No insights found. Run pipeline 85 to generate.</p>
        </div>
      )}

      {/* Show more */}
      {!loading && insights.length < total && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          {loadingMore ? "Loading..." : `Show more (${insights.length} of ${total})`}
        </button>
      )}
    </div>
  );
}
