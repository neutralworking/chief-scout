"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

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
  pursuit_status: string | null;
  position: string | null;
  club: string | null;
}

interface TrackedPlayer {
  name: string;
  pursuit_status: string;
  position: string | null;
  club: string | null;
}

type Reaction = "fire" | "love" | "gutted" | "shocked";
type VoteCounts = Record<string, Record<Reaction, number>>;

// ── Constants ────────────────────────────────────────────────────────────────

const STORY_TYPES = ["transfer", "injury", "performance", "tactical", "contract", "discipline", "international"];

const STORY_TYPE_STYLE: Record<string, string> = {
  transfer: "bg-[var(--color-accent-personality)]/15 text-[var(--color-accent-personality)]",
  injury: "bg-[var(--color-sentiment-negative)]/15 text-[var(--color-sentiment-negative)]",
  performance: "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)]",
  tactical: "bg-[var(--color-accent-mental)]/15 text-[var(--color-accent-mental)]",
  contract: "bg-[var(--color-accent-physical)]/15 text-[var(--color-accent-physical)]",
  discipline: "bg-[var(--color-sentiment-negative)]/15 text-[var(--color-sentiment-negative)]",
  international: "bg-[var(--color-accent-technical)]/15 text-[var(--color-accent-technical)]",
};

const STORY_TYPE_ICON: Record<string, string> = {
  transfer: "↔",
  injury: "🏥",
  performance: "⚡",
  tactical: "📋",
  contract: "📝",
  discipline: "🟨",
  international: "🌍",
};

const PURSUIT_STYLE: Record<string, string> = {
  Priority: "bg-[var(--color-pursuit-priority)]/15 text-[var(--color-pursuit-priority)] ring-1 ring-[var(--color-pursuit-priority)]/30",
  Interested: "bg-[var(--color-pursuit-interested)]/15 text-[var(--color-pursuit-interested)] ring-1 ring-[var(--color-pursuit-interested)]/30",
  Watch: "bg-[var(--color-pursuit-watch)]/15 text-[var(--color-pursuit-watch)] ring-1 ring-[var(--color-pursuit-watch)]/30",
  "Scout Further": "bg-[var(--color-pursuit-scout)]/15 text-[var(--color-pursuit-scout)] ring-1 ring-[var(--color-pursuit-scout)]/30",
  Monitor: "bg-[var(--color-pursuit-monitor)]/15 text-[var(--color-pursuit-monitor)] ring-1 ring-[var(--color-pursuit-monitor)]/30",
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

const REACTION_LABELS: Record<string, Record<Reaction, string>> = {
  transfer: { fire: "Big move", love: "Great signing", gutted: "Gutted", shocked: "No way" },
  injury: { fire: "Huge blow", love: "Speedy recovery", gutted: "Gutted", shocked: "Not again" },
  performance: { fire: "On fire", love: "Class", gutted: "Poor", shocked: "Unreal" },
  tactical: { fire: "Spark", love: "Love it", gutted: "Risky", shocked: "Bold" },
  contract: { fire: "Deserved", love: "Locked in", gutted: "Overpaid", shocked: "Wow" },
  discipline: { fire: "Drama", love: "Fair enough", gutted: "Harsh", shocked: "Shocking" },
  international: { fire: "Called up", love: "Proud", gutted: "Snubbed", shocked: "Surprise" },
  default: { fire: "Hot", love: "Love it", gutted: "Gutted", shocked: "Shocked" },
};

// ── Icons ────────────────────────────────────────────────────────────────────

function FireIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C9.5 6.5 6 8.5 6 13c0 3.31 2.69 6 6 6s6-2.69 6-6c0-2-1-4-2-5.5-.5.5-1 1.5-1 2.5 0 0-1.5-2-1.5-4S12 2 12 2z"
        fill={active ? "#f59e0b" : "none"} stroke={active ? "#f59e0b" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LoveIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"
        fill={active ? "#ef4444" : "none"} stroke={active ? "#ef4444" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GuttedIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={active ? "#6366f1" : "currentColor"} strokeWidth="1.5" fill={active ? "#6366f122" : "none"} />
      <path d="M8 15s1.5-2 4-2 4 2 4 2" stroke={active ? "#6366f1" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="9" x2="9.01" y2="9" stroke={active ? "#6366f1" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15.01" y2="9" stroke={active ? "#6366f1" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShockedIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={active ? "#06b6d4" : "currentColor"} strokeWidth="1.5" fill={active ? "#06b6d422" : "none"} />
      <circle cx="12" cy="16" r="1.5" fill={active ? "#06b6d4" : "currentColor"} />
      <line x1="9" y1="9" x2="9.01" y2="9" stroke={active ? "#06b6d4" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15.01" y2="9" stroke={active ? "#06b6d4" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const REACTION_ICONS: Record<Reaction, (props: { active: boolean }) => React.ReactNode> = {
  fire: FireIcon, love: LoveIcon, gutted: GuttedIcon, shocked: ShockedIcon,
};
const REACTIONS: Reaction[] = ["fire", "love", "gutted", "shocked"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("cs_user_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("cs_user_id", id); }
  return id;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
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

// ── ReactionBar ──────────────────────────────────────────────────────────────

function ReactionBar({
  storyId, storyType, counts, userReaction, onVote,
}: {
  storyId: string;
  storyType: string | null;
  counts: Record<Reaction, number>;
  userReaction: Reaction | null;
  onVote: (storyId: string, reaction: Reaction) => void;
}) {
  const labels = REACTION_LABELS[storyType ?? ""] ?? REACTION_LABELS.default;
  return (
    <div className="flex items-center gap-0.5">
      {REACTIONS.map((r) => {
        const Icon = REACTION_ICONS[r];
        const active = userReaction === r;
        const count = counts[r] ?? 0;
        return (
          <button key={r} onClick={() => onVote(storyId, r)} title={labels[r]}
            className={`group flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] transition-all ${
              active ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
            }`}>
            <Icon active={active} />
            {count > 0 && <span className={`font-mono text-[9px] ${active ? "text-[var(--text-secondary)]" : ""}`}>{count}</span>}
            <span className="hidden group-hover:inline text-[8px] font-medium tracking-wide uppercase">{labels[r]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Briefing Card ────────────────────────────────────────────────────────────

function BriefingCard({
  playerId,
  player,
  stories,
  tagsByStory,
}: {
  playerId: number;
  player: TrackedPlayer;
  stories: NewsStory[];
  tagsByStory: Map<string, PlayerTag[]>;
}) {
  // Find stories mentioning this player
  const playerStories = stories.filter((s) => {
    const tags = tagsByStory.get(s.id) ?? [];
    return tags.some((t) => t.player_id === playerId);
  });

  if (playerStories.length === 0) return null;

  const pursuitStyle = PURSUIT_STYLE[player.pursuit_status] ?? "";

  return (
    <div className="card rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/players/${playerId}`} className="text-sm font-bold text-[var(--text-primary)] hover:text-white transition-colors">
          {player.name}
        </Link>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pursuitStyle}`}>
          {player.pursuit_status}
        </span>
        {player.position && (
          <span className="text-[9px] text-[var(--text-muted)] font-mono">{player.position}</span>
        )}
        {player.club && (
          <span className="text-[10px] text-[var(--text-secondary)]">{player.club}</span>
        )}
      </div>
      <div className="space-y-1">
        {playerStories.slice(0, 3).map((story) => {
          const storyTag = (tagsByStory.get(story.id) ?? []).find((t) => t.player_id === playerId);
          return (
            <div key={story.id} className="flex items-start gap-2">
              {story.story_type && (
                <span className="text-[10px] mt-0.5 shrink-0">{STORY_TYPE_ICON[story.story_type] ?? "•"}</span>
              )}
              <div className="min-w-0 flex-1">
                {story.url ? (
                  <a href={story.url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors line-clamp-1">
                    {story.headline}
                  </a>
                ) : (
                  <span className="text-[11px] text-[var(--text-secondary)] line-clamp-1">{story.headline}</span>
                )}
              </div>
              {storyTag?.sentiment && storyTag.sentiment !== "neutral" && (
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SENTIMENT_DOT[storyTag.sentiment] ?? ""}`} />
              )}
              {story.published_at && (
                <span className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">{timeAgo(story.published_at)}</span>
              )}
            </div>
          );
        })}
        {playerStories.length > 3 && (
          <Link href={`/players/${playerId}`} className="text-[10px] text-[var(--color-accent-mental)] hover:text-[var(--text-primary)] transition-colors">
            +{playerStories.length - 3} more
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Story Card ───────────────────────────────────────────────────────────────

function StoryCard({
  story,
  storyTags,
  counts,
  userReaction,
  onVote,
  isTracked,
}: {
  story: NewsStory;
  storyTags: PlayerTag[];
  counts: Record<Reaction, number>;
  userReaction: Reaction | null;
  onVote: (storyId: string, reaction: Reaction) => void;
  isTracked: boolean;
}) {
  const hasReactions = Object.values(counts).some((c) => c > 0);

  return (
    <article className={`card rounded-lg p-3 group/story ${isTracked ? "ring-1 ring-[var(--color-accent-personality)]/20" : ""}`}>
      {/* Headline */}
      <div className="text-sm font-semibold leading-snug mb-1 line-clamp-2">
        {story.url ? (
          <a href={story.url} target="_blank" rel="noopener noreferrer"
            className="text-[var(--text-primary)] hover:text-white transition-colors">
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

      {/* Meta row */}
      <div className="flex items-center flex-wrap gap-1.5">
        {story.story_type && (
          <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${STORY_TYPE_STYLE[story.story_type] ?? "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
            {story.story_type}
          </span>
        )}

        {storyTags.map((tag) => {
          const dotClass = SENTIMENT_DOT[tag.sentiment ?? "neutral"] ?? SENTIMENT_DOT.neutral;
          const hasPursuit = tag.pursuit_status && tag.pursuit_status !== "Pass";
          return (
            <Link key={tag.player_id} href={`/players/${tag.player_id}`}
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                hasPursuit
                  ? "bg-[var(--color-accent-personality)]/10 text-[var(--color-accent-personality)] hover:text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
              {tag.name}
              {hasPursuit && (
                <span className="text-[8px] opacity-70">{tag.pursuit_status}</span>
              )}
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

      {/* Reactions */}
      <div className={`mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] ${hasReactions ? "" : "opacity-0 group-hover/story:opacity-100"} transition-opacity`}>
        <ReactionBar storyId={story.id} storyType={story.story_type} counts={counts} userReaction={userReaction} onVote={onVote} />
      </div>
    </article>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [tags, setTags] = useState<PlayerTag[]>([]);
  const [trackedPlayers, setTrackedPlayers] = useState<Record<number, TrackedPlayer>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [viewMode, setViewMode] = useState<"feed" | "briefing">("feed");
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [userVotes, setUserVotes] = useState<Record<string, Reaction>>({});
  const [votingStory, setVotingStory] = useState<string | null>(null);
  const userIdRef = useRef("");

  useEffect(() => { userIdRef.current = getUserId(); }, []);

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
      setTrackedPlayers(data.trackedPlayers ?? {});
      setVoteCounts(data.voteCounts ?? {});
    } catch {
      setStories([]);
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const handleVote = useCallback(async (storyId: string, reaction: Reaction) => {
    if (votingStory) return;
    setVotingStory(storyId);
    const isToggleOff = userVotes[storyId] === reaction;

    setUserVotes((prev) => {
      const next = { ...prev };
      if (isToggleOff) delete next[storyId]; else next[storyId] = reaction;
      return next;
    });
    setVoteCounts((prev) => {
      const base = prev[storyId] ?? { fire: 0, love: 0, gutted: 0, shocked: 0 };
      const storyCounts = { ...base };
      const old = userVotes[storyId];
      if (old) storyCounts[old] = Math.max(0, storyCounts[old] - 1);
      if (!isToggleOff) storyCounts[reaction] = storyCounts[reaction] + 1;
      return { ...prev, [storyId]: storyCounts };
    });

    try {
      const res = await fetch("/api/news/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userIdRef.current, story_id: storyId, reaction }),
      });
      const data = await res.json();
      if (data.success) {
        setVoteCounts((prev) => ({ ...prev, [storyId]: data.counts }));
        setUserVotes((prev) => {
          const next = { ...prev };
          if (data.userReaction) next[storyId] = data.userReaction; else delete next[storyId];
          return next;
        });
      }
    } catch { fetchNews(); } finally { setVotingStory(null); }
  }, [votingStory, userVotes, fetchNews]);

  const tagsByStory = useMemo(() => {
    const map = new Map<string, PlayerTag[]>();
    for (const tag of tags) {
      if (!map.has(tag.story_id)) map.set(tag.story_id, []);
      map.get(tag.story_id)!.push(tag);
    }
    return map;
  }, [tags]);

  // Filter out empty headlines
  const validStories = useMemo(() => stories.filter((s) => s.headline?.trim()), [stories]);

  // Identify stories mentioning tracked players
  const trackedStoryIds = useMemo(() => {
    const ids = new Set<string>();
    const trackedIds = new Set(Object.keys(trackedPlayers).map(Number));
    for (const [storyId, storyTags] of tagsByStory) {
      if (storyTags.some((t) => trackedIds.has(t.player_id))) ids.add(storyId);
    }
    return ids;
  }, [tagsByStory, trackedPlayers]);

  // Group stories by date
  const grouped = useMemo(() => {
    const map = new Map<string, NewsStory[]>();
    for (const story of validStories) {
      const group = story.published_at ? dateGroup(story.published_at) : "Undated";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(story);
    }
    return map;
  }, [validStories]);

  // Count story types
  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of validStories) {
      const t = s.story_type ?? "other";
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return map;
  }, [validStories]);

  const hasTracked = Object.keys(trackedPlayers).length > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-baseline gap-3 mb-0.5">
          <h1 className="text-lg font-bold tracking-tight">News Intelligence</h1>
          {hasTracked && (
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode("feed")}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                  viewMode === "feed"
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                Feed
              </button>
              <button
                onClick={() => setViewMode("briefing")}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                  viewMode === "briefing"
                    ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                Briefing
                {trackedStoryIds.size > 0 && (
                  <span className="ml-1 text-[9px] font-mono">{trackedStoryIds.size}</span>
                )}
              </button>
            </div>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] mb-3">
          {validStories.length} stories
          {trackedStoryIds.size > 0 && <> &middot; <span className="text-[var(--color-accent-personality)]">{trackedStoryIds.size} about tracked players</span></>}
        </p>

        {/* Type filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setTypeFilter("")}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
              typeFilter === ""
                ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}>
            All
          </button>
          {STORY_TYPES.map((t) => {
            const count = typeCounts.get(t) ?? 0;
            return (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors capitalize ${
                  typeFilter === t
                    ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
                }`}>
                {t}
                {count > 0 && <span className="ml-1 font-mono text-[9px] opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card rounded-xl py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">Loading intelligence...</p>
        </div>
      ) : validStories.length === 0 ? (
        <div className="card rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No stories found.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Run the news pipeline to ingest stories.</p>
        </div>
      ) : viewMode === "briefing" && hasTracked ? (
        /* ── Briefing Mode ─────────────────────────────────────────── */
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-personality)] mb-2 px-1">
            Player Briefing
          </h2>
          <p className="text-[10px] text-[var(--text-muted)] mb-3 px-1">
            Stories about players you&apos;re tracking (Watch, Interested, Priority)
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {Object.entries(trackedPlayers).map(([pid, player]) => (
              <BriefingCard
                key={pid}
                playerId={Number(pid)}
                player={player}
                stories={validStories}
                tagsByStory={tagsByStory}
              />
            ))}
          </div>
          {trackedStoryIds.size === 0 && (
            <div className="card rounded-xl p-6 text-center mt-2">
              <p className="text-sm text-[var(--text-muted)]">No recent news about tracked players.</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">Stories mentioning players you&apos;re pursuing will appear here.</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Feed Mode ─────────────────────────────────────────────── */
        <div className="flex gap-4">
          {/* Main feed */}
          <div className="flex-1 min-w-0 space-y-4">
            {[...grouped.entries()].map(([group, groupStories]) => (
              <div key={group}>
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 px-1">
                  {group}
                </h2>
                <div className="space-y-1">
                  {groupStories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      storyTags={tagsByStory.get(story.id) ?? []}
                      counts={voteCounts[story.id] ?? { fire: 0, love: 0, gutted: 0, shocked: 0 }}
                      userReaction={userVotes[story.id] ?? null}
                      onVote={handleVote}
                      isTracked={trackedStoryIds.has(story.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop sidebar: tracked player summary */}
          {hasTracked && (
            <div className="hidden xl:block w-72 shrink-0 space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-personality)] mb-1 px-1">
                Watchlist Activity
              </h3>
              {Object.entries(trackedPlayers).map(([pid, player]) => {
                const playerStoryCount = validStories.filter((s) =>
                  (tagsByStory.get(s.id) ?? []).some((t) => t.player_id === Number(pid))
                ).length;

                if (playerStoryCount === 0) return null;

                const pursuitStyle = PURSUIT_STYLE[player.pursuit_status] ?? "";

                return (
                  <Link key={pid} href={`/players/${pid}`}
                    className="card rounded-lg p-2.5 flex items-center gap-2 hover:border-[var(--color-accent-personality)]/30 transition-colors block">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{player.name}</p>
                      <p className="text-[9px] text-[var(--text-muted)]">
                        {player.position && <span className="font-mono">{player.position}</span>}
                        {player.club && <span> &middot; {player.club}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-[var(--text-secondary)]">{playerStoryCount}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${pursuitStyle}`}>
                        {player.pursuit_status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
