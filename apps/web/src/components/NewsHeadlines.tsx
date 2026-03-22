import type { NewsStory } from "@/components/PlayerNews";

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-[var(--color-sentiment-positive)]",
  negative: "bg-[var(--color-sentiment-negative)]",
  neutral: "bg-[var(--color-sentiment-neutral)]",
};

export function NewsHeadlines({ news }: { news: NewsStory[] }) {
  const headlines = news.slice(0, 4);
  if (headlines.length === 0) return null;

  return (
    <div className="glass px-2.5 py-1.5 flex items-center gap-3 overflow-x-auto">
      <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">News</span>
      <div className="flex items-center gap-3 min-w-0">
        {headlines.map((story) => {
          const dotClass = SENTIMENT_DOT[story.sentiment ?? "neutral"] ?? SENTIMENT_DOT.neutral;
          const date = story.published_at
            ? new Date(story.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : null;
          return (
            <a
              key={story.id}
              href={story.url ?? "#"}
              target={story.url ? "_blank" : undefined}
              rel={story.url ? "noopener noreferrer" : undefined}
              className="flex items-center gap-1.5 min-w-0 shrink-0 max-w-[220px] group"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
              <span className="text-[10px] text-[var(--text-secondary)] truncate group-hover:text-[var(--text-primary)] transition-colors">
                {story.headline}
              </span>
              {date && (
                <span className="text-[8px] text-[var(--text-muted)] shrink-0">{date}</span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
