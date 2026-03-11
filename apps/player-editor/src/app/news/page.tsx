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

function sentimentColor(sentiment: string | null) {
  if (sentiment === "positive") return { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(57,255,20,0.25)" };
  if (sentiment === "negative") return { bg: "var(--amber-dim)", color: "var(--amber)", border: "rgba(255,42,109,0.25)" };
  return { bg: "var(--surface2)", color: "var(--text3)", border: "var(--border2)" };
}

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

  // Build tag map: story_id -> PlayerTag[]
  const tagsByStory = new Map<string, PlayerTag[]>();
  for (const tag of tags) {
    if (!tagsByStory.has(tag.story_id)) tagsByStory.set(tag.story_id, []);
    tagsByStory.get(tag.story_id)!.push(tag);
  }

  // Compute dominant sentiment per story
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
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px 12px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 12, letterSpacing: "-0.02em" }}>
          News Feed
        </h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setTypeFilter("")}
            style={pillStyle(typeFilter === "")}
          >
            All
          </button>
          {STORY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={pillStyle(typeFilter === t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Stories */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
        {loading ? (
          <p style={{ color: "var(--text3)", fontSize: "0.85rem" }}>Loading...</p>
        ) : stories.length === 0 ? (
          <p style={{ color: "var(--text3)", fontSize: "0.85rem" }}>No stories found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stories.map((story) => {
              const storyTags = tagsByStory.get(story.id) ?? [];
              const sentiment = storySentiment(story.id);
              const sentColors = sentimentColor(sentiment);

              return (
                <article
                  key={story.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  {/* Top row: type badge + sentiment + time */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    {story.story_type && (
                      <span style={{
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--accent-dim)",
                        color: "var(--accent)",
                        border: "1px solid rgba(0,240,255,0.2)",
                      }}>
                        {story.story_type}
                      </span>
                    )}
                    {sentiment && (
                      <span style={{
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: sentColors.bg,
                        color: sentColors.color,
                        border: `1px solid ${sentColors.border}`,
                        textTransform: "capitalize",
                      }}>
                        {sentiment}
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--text3)" }}>
                      {story.published_at ? timeAgo(story.published_at) : ""}
                    </span>
                  </div>

                  {/* Headline */}
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>
                    {story.url ? (
                      <a
                        href={story.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--text)", textDecoration: "none" }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {story.headline}
                      </a>
                    ) : (
                      story.headline
                    )}
                  </div>

                  {/* Summary */}
                  {story.summary && (
                    <p style={{
                      fontSize: "0.78rem",
                      color: "var(--text2)",
                      lineHeight: 1.5,
                      marginBottom: 8,
                      marginTop: 2,
                    }}>
                      {story.summary}
                    </p>
                  )}

                  {/* Tagged players + source */}
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    {storyTags.map((tag) => {
                      const tc = sentimentColor(tag.sentiment);
                      return (
                        <Link
                          key={tag.player_id}
                          href={`/players/${tag.player_id}`}
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: tc.bg,
                            color: tc.color,
                            border: `1px solid ${tc.border}`,
                            textDecoration: "none",
                            transition: "opacity 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                        >
                          {tag.name}
                        </Link>
                      );
                    })}
                    {story.source && (
                      <span style={{
                        marginLeft: "auto",
                        fontSize: "0.65rem",
                        color: "var(--text3)",
                        opacity: 0.7,
                      }}>
                        {story.source}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 16,
    fontSize: "0.72rem",
    fontWeight: 600,
    border: `1px solid ${active ? "var(--accent)" : "var(--border2)"}`,
    background: active ? "var(--accent-dim)" : "var(--surface2)",
    color: active ? "var(--accent)" : "var(--text3)",
    cursor: "pointer",
    transition: "all 0.15s",
    textTransform: "capitalize" as const,
    fontFamily: "inherit",
  };
}
