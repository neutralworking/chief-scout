"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

type Reaction = "fire" | "love" | "gutted" | "shocked";
type VoteCounts = Record<string, Record<Reaction, number>>;

const STORY_TYPES = [
  "transfer",
  "injury",
  "performance",
  "tactical",
  "contract",
  "discipline",
  "international",
];

const STORY_TYPE_STYLE: Record<string, string> = {
  transfer: "bg-[var(--color-accent-personality)]/15 text-[var(--color-accent-personality)]",
  injury: "bg-[var(--color-sentiment-negative)]/15 text-[var(--color-sentiment-negative)]",
  performance: "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)]",
  tactical: "bg-[var(--color-accent-mental)]/15 text-[var(--color-accent-mental)]",
  contract: "bg-[var(--color-accent-physical)]/15 text-[var(--color-accent-physical)]",
  discipline: "bg-[var(--color-sentiment-negative)]/15 text-[var(--color-sentiment-negative)]",
  international: "bg-[var(--color-accent-technical)]/15 text-[var(--color-accent-technical)]",
};

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-[var(--color-sentiment-positive)]",
  negative: "bg-[var(--color-sentiment-negative)]",
  neutral: "bg-[var(--color-sentiment-neutral)]",
};

const SOURCE_LABEL: Record<string, string> = {
  bbc_football: "BBC",
  guardian_football: "Guardian",
  skysports_football: "Sky",
  espn_fc: "ESPN",
  fourfourtwo: "442",
  football_italia: "FI",
  "90min": "90min",
};

// Reaction labels vary by story type
const REACTION_LABELS: Record<string, Record<Reaction, string>> = {
  transfer: { fire: "Big move", love: "Great signing", gutted: "Gutted", shocked: "No way" },
  injury: { fire: "Huge blow", love: "Speedy recovery", gutted: "Gutted", shocked: "Not again" },
  performance: { fire: "On fire", love: "Class", gutted: "Poor", shocked: "Unreal" },
  tactical: { fire: "Genius", love: "Love it", gutted: "Risky", shocked: "Bold" },
  contract: { fire: "Deserved", love: "Locked in", gutted: "Overpaid", shocked: "Wow" },
  discipline: { fire: "Drama", love: "Fair enough", gutted: "Harsh", shocked: "Shocking" },
  international: { fire: "Called up", love: "Proud", gutted: "Snubbed", shocked: "Surprise" },
  default: { fire: "Hot", love: "Love it", gutted: "Gutted", shocked: "Shocked" },
};

function getReactionLabel(storyType: string | null, reaction: Reaction): string {
  const labels = REACTION_LABELS[storyType ?? ""] ?? REACTION_LABELS.default;
  return labels[reaction];
}

// Inline SVG icons — 14px
function FireIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C9.5 6.5 6 8.5 6 13c0 3.31 2.69 6 6 6s6-2.69 6-6c0-2-1-4-2-5.5-.5.5-1 1.5-1 2.5 0 0-1.5-2-1.5-4S12 2 12 2z"
        fill={active ? "#f59e0b" : "none"}
        stroke={active ? "#f59e0b" : "currentColor"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoveIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"
        fill={active ? "#ef4444" : "none"}
        stroke={active ? "#ef4444" : "currentColor"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GuttedIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke={active ? "#6366f1" : "currentColor"} strokeWidth="1.5" fill={active ? "#6366f122" : "none"} />
      <path d="M8 15s1.5-2 4-2 4 2 4 2" stroke={active ? "#6366f1" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="9" x2="9.01" y2="9" stroke={active ? "#6366f1" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15.01" y2="9" stroke={active ? "#6366f1" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShockedIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke={active ? "#06b6d4" : "currentColor"} strokeWidth="1.5" fill={active ? "#06b6d422" : "none"} />
      <circle cx="12" cy="16" r="1.5" fill={active ? "#06b6d4" : "currentColor"} />
      <line x1="9" y1="9" x2="9.01" y2="9" stroke={active ? "#06b6d4" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15.01" y2="9" stroke={active ? "#06b6d4" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const REACTION_ICONS: Record<Reaction, (props: { active: boolean }) => React.ReactNode> = {
  fire: FireIcon,
  love: LoveIcon,
  gutted: GuttedIcon,
  shocked: ShockedIcon,
};

const REACTIONS: Reaction[] = ["fire", "love", "gutted", "shocked"];

function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("cs_user_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("cs_user_id", id);
  }
  return id;
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

function dateGroup(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const storyDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());

  if (storyDay.getTime() >= today.getTime()) return "Today";
  if (storyDay.getTime() >= yesterday.getTime()) return "Yesterday";
  const diffDays = Math.floor((today.getTime() - storyDay.getTime()) / 86400000);
  if (diffDays < 7) return "This Week";
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function ReactionBar({
  storyId,
  storyType,
  counts,
  userReaction,
  onVote,
}: {
  storyId: string;
  storyType: string | null;
  counts: Record<Reaction, number>;
  userReaction: Reaction | null;
  onVote: (storyId: string, reaction: Reaction) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {REACTIONS.map((reaction) => {
        const Icon = REACTION_ICONS[reaction];
        const active = userReaction === reaction;
        const count = counts[reaction] ?? 0;
        const label = getReactionLabel(storyType, reaction);

        return (
          <button
            key={reaction}
            onClick={() => onVote(storyId, reaction)}
            title={label}
            className={`
              group flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] transition-all
              ${active
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
              }
            `}
          >
            <Icon active={active} />
            {count > 0 && (
              <span className={`font-mono text-[9px] ${active ? "text-[var(--text-secondary)]" : ""}`}>
                {count}
              </span>
            )}
            <span className="hidden group-hover:inline text-[8px] font-medium tracking-wide uppercase">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function NewsPage() {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [tags, setTags] = useState<PlayerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [userVotes, setUserVotes] = useState<Record<string, Reaction>>({});
  const [votingStory, setVotingStory] = useState<string | null>(null);
  const userIdRef = useRef("");

  useEffect(() => {
    userIdRef.current = getUserId();
  }, []);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    params.set("limit", "80");

    try {
      const res = await fetch(`/api/news?${params}`);
      const data = await res.json();
      setStories(data.stories ?? []);
      setTags(data.tags ?? []);
      setVoteCounts(data.voteCounts ?? {});
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

  const handleVote = useCallback(async (storyId: string, reaction: Reaction) => {
    if (votingStory) return;
    setVotingStory(storyId);

    const isToggleOff = userVotes[storyId] === reaction;

    setUserVotes((prev) => {
      const next = { ...prev };
      if (isToggleOff) {
        delete next[storyId];
      } else {
        next[storyId] = reaction;
      }
      return next;
    });

    setVoteCounts((prev) => {
      const base = prev[storyId] ?? { fire: 0, love: 0, gutted: 0, shocked: 0 };
      const storyCounts = { ...base };
      const oldReaction = userVotes[storyId];
      if (oldReaction) storyCounts[oldReaction] = Math.max(0, storyCounts[oldReaction] - 1);
      if (!isToggleOff) storyCounts[reaction] = storyCounts[reaction] + 1;
      return { ...prev, [storyId]: storyCounts };
    });

    try {
      const res = await fetch("/api/news/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userIdRef.current,
          story_id: storyId,
          reaction,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVoteCounts((prev) => ({ ...prev, [storyId]: data.counts }));
        setUserVotes((prev) => {
          const next = { ...prev };
          if (data.userReaction) {
            next[storyId] = data.userReaction;
          } else {
            delete next[storyId];
          }
          return next;
        });
      }
    } catch {
      fetchNews();
    } finally {
      setVotingStory(null);
    }
  }, [votingStory, userVotes, fetchNews]);

  const tagsByStory = new Map<string, PlayerTag[]>();
  for (const tag of tags) {
    if (!tagsByStory.has(tag.story_id)) tagsByStory.set(tag.story_id, []);
    tagsByStory.get(tag.story_id)!.push(tag);
  }

  // Filter out stories with empty headlines
  const validStories = stories.filter((s) => s.headline && s.headline.trim().length > 0);

  // Group stories by date
  const grouped = new Map<string, NewsStory[]>();
  for (const story of validStories) {
    const group = story.published_at ? dateGroup(story.published_at) : "Undated";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(story);
  }

  // Count stories with tagged players
  const taggedCount = validStories.filter((s) => tagsByStory.has(s.id)).length;

  // Count story types
  const typeCounts = new Map<string, number>();
  for (const s of validStories) {
    const t = s.story_type ?? "other";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight mb-0.5">News Intelligence</h1>
        <p className="text-[11px] text-[var(--text-secondary)] mb-3">
          {validStories.length} stories
          {taggedCount > 0 && <> &middot; {taggedCount} with player links</>}
        </p>

        {/* Type filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter("")}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
              typeFilter === ""
                ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            All
          </button>
          {STORY_TYPES.map((t) => {
            const count = typeCounts.get(t) ?? 0;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors capitalize ${
                  typeFilter === t
                    ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
                }`}
              >
                {t}
                {count > 0 && (
                  <span className="ml-1 font-mono text-[9px] opacity-60">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stories */}
      {loading ? (
        <div className="glass rounded-xl py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        </div>
      ) : validStories.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No stories found.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Run the news pipeline to ingest stories.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([group, groupStories]) => (
            <div key={group}>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 px-1">
                {group}
              </h2>
              <div className="space-y-1">
                {groupStories.map((story) => {
                  const storyTags = tagsByStory.get(story.id) ?? [];
                  const counts = voteCounts[story.id] ?? { fire: 0, love: 0, gutted: 0, shocked: 0 };
                  const hasReactions = Object.values(counts).some((c) => c > 0);

                  return (
                    <article key={story.id} className="glass rounded-lg p-3 group/story">
                      <div className="flex gap-3">
                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          {/* Headline */}
                          <div className="text-sm font-semibold leading-snug mb-1 line-clamp-2">
                            {story.url ? (
                              <a
                                href={story.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--text-primary)] hover:text-white transition-colors"
                              >
                                {story.headline}
                              </a>
                            ) : (
                              <span className="text-[var(--text-primary)]">{story.headline}</span>
                            )}
                          </div>

                          {/* Summary */}
                          {story.summary && (
                            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-1.5">
                              {story.summary}
                            </p>
                          )}

                          {/* Meta row: type pill + tagged players + source + time */}
                          <div className="flex items-center flex-wrap gap-1.5">
                            {story.story_type && (
                              <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${STORY_TYPE_STYLE[story.story_type] ?? "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
                                {story.story_type}
                              </span>
                            )}

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

                            <span className="ml-auto flex items-center gap-2 shrink-0">
                              {story.source && (
                                <span className="text-[9px] text-[var(--text-muted)] font-medium">
                                  {SOURCE_LABEL[story.source] ?? story.source}
                                </span>
                              )}
                              {story.published_at && (
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                  {timeAgo(story.published_at)}
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Reactions — show if there are existing reactions, otherwise show on hover */}
                          <div className={`mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] ${hasReactions ? "" : "opacity-0 group-hover/story:opacity-100"} transition-opacity`}>
                            <ReactionBar
                              storyId={story.id}
                              storyType={story.story_type}
                              counts={counts}
                              userReaction={userVotes[story.id] ?? null}
                              onVote={handleVote}
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
