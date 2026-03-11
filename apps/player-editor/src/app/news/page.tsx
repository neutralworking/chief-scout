import { supabaseServer } from "@/lib/supabase-server";

interface NewsStory {
  id: string;
  title: string;
  url: string | null;
  published_at: string | null;
  summary: string | null;
  source: string | null;
  fetched_at: string | null;
}

interface PlayerTag {
  story_id: string;
  person_id: string;
  relevance: string | null;
  name: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDate();
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${day} ${months[d.getUTCMonth()]}`;
}

function groupByDate(stories: NewsStory[]): Record<string, NewsStory[]> {
  const groups: Record<string, NewsStory[]> = {};
  for (const story of stories) {
    const dateKey = story.published_at
      ? story.published_at.slice(0, 10)
      : story.fetched_at
        ? story.fetched_at.slice(0, 10)
        : "Unknown";
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(story);
  }
  return groups;
}

export default async function NewsPage() {
  if (!supabaseServer) {
    return (
      <div className="p-8 text-[var(--text-secondary)]">
        Supabase not configured.
      </div>
    );
  }

  // Fetch stories
  const { data: stories, error } = await supabaseServer
    .from("news_stories")
    .select("id, title, url, published_at, summary, source, fetched_at")
    .order("published_at", { ascending: false })
    .limit(50);

  if (error || !stories) {
    return (
      <div className="p-8 text-[var(--text-secondary)]">
        Failed to load news: {error?.message ?? "Unknown error"}
      </div>
    );
  }

  // Fetch player tags for these stories
  const storyIds = stories.map((s) => s.id);
  let playerTags: PlayerTag[] = [];

  if (storyIds.length > 0) {
    const { data: tags } = await supabaseServer
      .from("news_player_tags")
      .select("story_id, person_id, relevance")
      .in("story_id", storyIds);

    if (tags && tags.length > 0) {
      // Get unique person IDs
      const personIds = [...new Set(tags.map((t) => t.person_id))];

      const { data: people } = await supabaseServer
        .from("people")
        .select("id, name")
        .in("id", personIds);

      const nameMap = new Map<string, string>();
      if (people) {
        for (const p of people) {
          nameMap.set(p.id, p.name);
        }
      }

      playerTags = tags.map((t) => ({
        ...t,
        name: nameMap.get(t.person_id) ?? "Unknown",
      }));
    }
  }

  // Build a map of story_id -> player names
  const tagsByStory = new Map<string, PlayerTag[]>();
  for (const tag of playerTags) {
    if (!tagsByStory.has(tag.story_id)) tagsByStory.set(tag.story_id, []);
    tagsByStory.get(tag.story_id)!.push(tag);
  }

  const grouped = groupByDate(stories);
  const sortedDates = Object.keys(grouped).sort(
    (a, b) => (b > a ? 1 : b < a ? -1 : 0)
  );

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">News Feed</h1>

      {sortedDates.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">No stories found.</p>
      )}

      <div className="flex flex-col gap-8">
        {sortedDates.map((dateKey) => (
          <section key={dateKey}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
              {dateKey === "Unknown"
                ? "Unknown Date"
                : formatDate(dateKey)}
            </h2>

            <div className="flex flex-col gap-3">
              {grouped[dateKey].map((story) => {
                const tags = tagsByStory.get(story.id) ?? [];
                return (
                  <article
                    key={story.id}
                    className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4"
                  >
                    <div className="text-sm font-medium">
                      {story.url ? (
                        <a
                          href={story.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {story.title}
                        </a>
                      ) : (
                        story.title
                      )}
                    </div>

                    {story.summary && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                        {story.summary}
                      </p>
                    )}

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.map((tag) => (
                          <span
                            key={tag.person_id}
                            className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {story.source && (
                      <div className="text-[10px] text-[var(--text-secondary)] mt-2 opacity-60">
                        {story.source}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
