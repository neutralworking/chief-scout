"use client";

import { useState } from "react";

export interface NewsStory {
  id: string;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  story_type: string | null;
  sentiment: string | null;
  confidence: number | null;
}

interface ScoutPadProps {
  scoutingNotes: string | null;
  squadRole: string | null;
  loanStatus: string | null;
  news: NewsStory[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "var(--sentiment-positive)",
  negative: "var(--sentiment-negative)",
  neutral: "var(--sentiment-neutral)",
};

const STORY_TYPE_COLORS: Record<string, string> = {
  transfer: "var(--accent-personality)",
  injury: "var(--sentiment-negative)",
  form: "var(--accent-tactical)",
  contract: "var(--accent-mental)",
  debut: "var(--accent-physical)",
  personal: "var(--text-muted)",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type Tab = "notes" | "news";

export function ScoutPad({ scoutingNotes, squadRole, loanStatus, news }: ScoutPadProps) {
  const hasNotes = !!(scoutingNotes || squadRole || loanStatus);
  const hasNews = news.length > 0;

  // Default to notes if available, otherwise news
  const [activeTab, setActiveTab] = useState<Tab>(hasNotes ? "notes" : "news");

  // Don't render if there's nothing to show
  if (!hasNotes && !hasNews) return null;

  const tabs: { key: Tab; label: string; count?: number }[] = [];
  if (hasNotes) tabs.push({ key: "notes", label: "Scouting Notes" });
  tabs.push({ key: "news", label: "News", count: news.length });

  return (
    <div className="glass rounded-xl p-5">
      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="flex gap-4 mb-4 border-b border-[var(--border-subtle)] -mx-5 px-5" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 text-[11px] font-bold tracking-wider uppercase transition-colors relative ${
                activeTab === tab.key
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 text-[9px] font-mono text-[var(--text-muted)]">
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ backgroundColor: "var(--accent-personality)" }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Single tab header when only one tab */}
      {tabs.length === 1 && (
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">
          {tabs[0].label}
        </h3>
      )}

      {/* Notes tab */}
      {activeTab === "notes" && hasNotes && (
        <div className="max-h-80 overflow-y-auto">
          {(squadRole || loanStatus) && (
            <div className="flex gap-4 mb-3 text-xs text-[var(--text-secondary)]">
              {squadRole && (
                <div>
                  <span className="text-[var(--text-muted)]">Squad Role: </span>
                  <span className="font-medium">{squadRole}</span>
                </div>
              )}
              {loanStatus && (
                <div>
                  <span className="text-[var(--text-muted)]">Loan: </span>
                  <span className="font-medium">{loanStatus}</span>
                </div>
              )}
            </div>
          )}
          {scoutingNotes && (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {scoutingNotes}
            </p>
          )}
        </div>
      )}

      {/* News tab */}
      {activeTab === "news" && (
        <div>
          {news.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic">No news stories tagged yet</p>
          ) : (
            <div className="space-y-1">
              {news.map((story) => (
                <a
                  key={story.id}
                  href={story.url || undefined}
                  target={story.url ? "_blank" : undefined}
                  rel={story.url ? "noopener noreferrer" : undefined}
                  className="flex gap-3 items-start px-2 py-2.5 -mx-2 rounded-md transition-colors hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  {/* Sentiment dot */}
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{
                      backgroundColor:
                        SENTIMENT_COLORS[story.sentiment ?? "neutral"] ?? "var(--text-muted)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{story.headline}</span>
                      {story.story_type && (
                        <span
                          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            color: STORY_TYPE_COLORS[story.story_type] ?? "var(--text-muted)",
                            backgroundColor: "var(--bg-elevated)",
                          }}
                        >
                          {story.story_type}
                        </span>
                      )}
                    </div>
                    {story.summary && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {story.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-muted)]">
                      {story.source && <span>{story.source}</span>}
                      {story.published_at && (
                        <>
                          {story.source && <span>&middot;</span>}
                          <span>{formatDate(story.published_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
