"use client";

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

interface PlayerNewsProps {
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

export function PlayerNews({ news }: PlayerNewsProps) {
  if (news.length === 0) return null;

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">
        News <span className="font-mono ml-1">{news.length}</span>
      </h3>

      <div className="space-y-1">
        {news.map((story) => (
          <a
            key={story.id}
            href={story.url || undefined}
            target={story.url ? "_blank" : undefined}
            rel={story.url ? "noopener noreferrer" : undefined}
            className="flex gap-3 items-start px-2 py-2.5 -mx-2 rounded-md transition-colors hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
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
    </div>
  );
}
