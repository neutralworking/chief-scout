"use client";

import { useState } from "react";

export function AdminActions() {
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsResult, setNewsResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const refreshNews = async () => {
    setNewsRefreshing(true);
    setNewsResult(null);
    try {
      const res = await fetch("/api/cron/news");
      const data = await res.json();
      if (data.ok) {
        const s = data.stats;
        setNewsResult({ type: "success", text: `Fetched ${s.fetched}, processed ${s.processed}, tagged ${s.tagged} players` });
      } else {
        setNewsResult({ type: "error", text: data.error ?? "Failed" });
      }
    } catch (e) {
      setNewsResult({ type: "error", text: String(e) });
    }
    setNewsRefreshing(false);
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
        News Pipeline
      </h2>
      <div className="flex items-center gap-3">
        <button
          onClick={refreshNews}
          disabled={newsRefreshing}
          className="px-4 py-1.5 rounded bg-[var(--accent-tactical)] text-[var(--bg-base)] text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition-all"
        >
          {newsRefreshing ? "Refreshing..." : "Refresh News Feed"}
        </button>
        <span className="text-xs text-[var(--text-muted)]">Fetch RSS + process with Gemini</span>
      </div>
      {newsResult && (
        <p className={`mt-3 text-sm ${newsResult.type === "error" ? "text-[var(--sentiment-negative)]" : "text-[var(--accent-tactical)]"}`}>
          {newsResult.text}
        </p>
      )}
    </div>
  );
}
