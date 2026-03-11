"use client";

import { useEffect, useCallback } from "react";

interface NewsModalProps {
  moment: {
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
  };
  onClose: () => void;
}

const SENTIMENT_LABELS: Record<string, { label: string; bg: string }> = {
  positive: { label: "POSITIVE", bg: "var(--sentiment-positive)" },
  negative: { label: "NEGATIVE", bg: "var(--sentiment-negative)" },
  neutral: { label: "NEUTRAL", bg: "var(--sentiment-neutral)" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function NewsModal({ moment, onClose }: NewsModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const sentiment = SENTIMENT_LABELS[moment.sentiment ?? "neutral"] ?? SENTIMENT_LABELS.neutral;
  const story = moment.news_story;
  const headline = story?.title ?? moment.title;
  const date = story?.published_at ?? moment.moment_date;
  const articleUrl = story?.url ?? moment.source_url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={headline}
    >
      <div
        className="relative w-full max-w-[560px] rounded-2xl p-6"
        style={{
          backgroundColor: "var(--bg-elevated)",
          animation: "modalIn 150ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          &times;
        </button>

        {/* Sentiment badge */}
        <span
          className="inline-block text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded mb-4"
          style={{ backgroundColor: sentiment.bg, color: "#fff" }}
        >
          {sentiment.label}
        </span>

        {/* Headline */}
        <h2 className="text-xl font-semibold mb-2 pr-8">{headline}</h2>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-4">
          {date && <span>{formatDate(date)}</span>}
          {moment.moment_type && (
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
              {moment.moment_type}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--border-subtle)] mb-4" />

        {/* Story summary */}
        {story?.summary && (
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
            {story.summary}
          </p>
        )}

        {/* Key Moment Context */}
        {moment.description && (
          <div
            className="border-l-2 pl-4 mb-4 italic text-sm text-[var(--text-secondary)]"
            style={{ borderColor: "var(--accent-personality)" }}
          >
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] not-italic block mb-1">
              Key Moment Context
            </span>
            {moment.description}
          </div>
        )}

        {/* Read Full Article link */}
        {articleUrl && (
          <div className="text-center pt-2">
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline"
              style={{ color: "var(--accent-personality)" }}
            >
              Read Full Article &rarr;
            </a>
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
