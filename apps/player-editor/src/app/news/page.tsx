"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface NewsStory {
  id: string;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  story_type: string | null;
}

interface PlayerTag {
  story_id: string;
  player_id: number;
  sentiment: string | null;
  confidence: number | null;
  name: string;
}

const STORY_TYPES = [
  "transfer",
  "injury",
  "performance",
  "tactical",
  "contract",
  "discipline",
  "international",
];

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-[var(--sentiment-positive)]",
  negative: "bg-[var(--sentiment-negative)]",
  neutral: "bg-[var(--sentiment-neutral)]",
};

const SENTIMENT_PILL: Record<string, string> = {
  positive: "bg-[var(--sentiment-positive)]/15 text-[var(--sentiment-positive)] ring-1 ring-[var(--sentiment-positive)]/20",
  negative: "bg-[var(--sentiment-negative)]/15 text-[var(--sentiment-negative)] ring-1 ring-[var(--sentiment-negative)]/20",
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-muted)]",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function NewsPage() {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [tags, setTags] = useState<PlayerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");

  const fetchNews = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    params.set("limit", "50");

    try {
      const res = await fetch(`/api/news?${params}`);
      const data = await res.json();
      setStories(data.stories ?? []);
      setTags(data.tags ?? []);
    } catch {
      setStories([]);
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const tagsByStory = new Map<string, PlayerTag[]>();
  for (const tag of tags) {
    if (!tagsByStory.has(tag.story_id)) tagsByStory.set(tag.story_id, []);
    tagsByStory.get(tag.story_id)!.push(tag);
  }

  function storySentiment(storyId: string): string | null {
    const storyTags = tagsByStory.get(storyId);
    if (!storyTags || storyTags.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const t of storyTags) {
      const s = t.sentiment ?? "neutral";
      counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">News Feed</h1>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          {stories.length > 0 ? `${stories.length} stories` : "Latest scouting intelligence"}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter("")}
            className={`text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full transition-colors ${
              typeFilter === ""
                ? "bg-[var(--accent-personality)]/20 text-[var(--accent-personality)] ring-1 ring-[var(--accent-personality)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            All
          </button>
          {STORY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full transition-colors ${
                typeFilter === t
                  ? "bg-[var(--accent-personality)]/20 text-[var(--accent-personality)] ring-1 ring-[var(--accent-personality)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Stories */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading...</p>
      ) : stories.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No stories found.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Run the news pipeline to ingest stories.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stories.map((story) => {
            const storyTags = tagsByStory.get(story.id) ?? [];
            const sentiment = storySentiment(story.id);

            return (
              <article key={story.id} className="glass rounded-xl p-3 sm:p-4">
                {/* Top row: type + sentiment + time */}
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  {story.story_type && (
                    <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[var(--accent-tactical)]/15 text-[var(--accent-tactical)]">
                      {story.story_type}
                    </span>
                  )}
                  {sentiment && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${SENTIMENT_PILL[sentiment] ?? SENTIMENT_PILL.neutral}`}>
                      {sentiment}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono">
                    {story.published_at ? timeAgo(story.published_at) : ""}
                  </span>
                </div>

                {/* Headline */}
                <div className="text-sm font-semibold leading-snug mb-1">
                  {story.url ? (
                    <a
                      href={story.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--text-primary)] hover:underline"
                    >
                      {story.headline}
                    </a>
                  ) : (
                    story.headline
                  )}
                </div>

                {/* Summary */}
                {story.summary && (
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-2">
                    {story.summary}
                  </p>
                )}

                {/* Tagged players + source */}
                {(storyTags.length > 0 || story.source) && (
                  <div className="flex items-center flex-wrap gap-1.5">
                    {storyTags.map((tag) => {
                      const dotClass = SENTIMENT_DOT[tag.sentiment ?? "neutral"] ?? SENTIMENT_DOT.neutral;
                      return (
                        <Link
                          key={tag.player_id}
                          href={`/players/${tag.player_id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                          {tag.name}
                        </Link>
                      );
                    })}
                    {story.source && (
                      <span className="ml-auto text-[9px] text-[var(--text-muted)] opacity-70">
                        {story.source}
                      </span>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
