"use client";

import { useState } from "react";
import { NewsModal } from "./NewsModal";

export interface KeyMoment {
  id: number;
  title: string;
  description: string | null;
  moment_date: string | null;
  moment_type: string | null;
  sentiment: string | null;
  source_url: string | null;
  news_story: {
    title: string;
    url: string | null;
    summary: string | null;
    published_at: string | null;
  } | null;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "var(--sentiment-positive)",
  negative: "var(--sentiment-negative)",
  neutral: "var(--sentiment-neutral)",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const COLLAPSED_LIMIT = 5;

export function KeyMomentsList({ moments }: { moments: KeyMoment[] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<KeyMoment | null>(null);

  if (moments.length === 0) {
    return (
      <div className="glass rounded-xl p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Key Moments
        </h3>
        <p className="text-sm text-[var(--text-muted)] italic">No key moments recorded yet</p>
      </div>
    );
  }

  const visible = expanded ? moments : moments.slice(0, COLLAPSED_LIMIT);
  const hasMore = moments.length > COLLAPSED_LIMIT;

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Key Moments
        </h3>
        {hasMore && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] font-medium tracking-wide hover:underline"
            style={{ color: "var(--accent-personality)" }}
          >
            See All ({moments.length}) &rarr;
          </button>
        )}
      </div>
      <div className="space-y-1">
        {visible.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMoment(m)}
            className="w-full flex gap-3 items-start text-left px-2 py-2 -mx-2 rounded-md transition-colors hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            <div
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{
                backgroundColor:
                  SENTIMENT_COLORS[m.sentiment ?? "neutral"] ?? "var(--text-muted)",
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{m.title}</span>
                {m.moment_type && (
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded shrink-0">
                    {m.moment_type}
                  </span>
                )}
              </div>
            </div>
            {m.moment_date && (
              <span className="text-[10px] text-[var(--text-muted)] shrink-0 mt-0.5">
                {formatDate(m.moment_date)}
              </span>
            )}
          </button>
        ))}
      </div>
      {hasMore && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-3 text-[10px] font-medium tracking-wide hover:underline"
          style={{ color: "var(--accent-personality)" }}
        >
          Show Less
        </button>
      )}

      {selectedMoment && (
        <NewsModal moment={selectedMoment} onClose={() => setSelectedMoment(null)} />
      )}
    </div>
  );
}
