"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Shortlist {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  tags: string[] | null;
  featured: boolean;
  position_filter: string | null;
  player_count: number;
  author_type: string;
  author_name: string | null;
  updated_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  "free-agents": "Free Agents",
  wonderkids: "Wonderkids",
  bargains: "Bargains",
  position: "By Position",
  "best-xi": "Best XI",
  league: "By League",
  tactical: "Tactical",
  watchlist: "Watch List",
  custom: "Custom",
};

export default function ShortlistsPage() {
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (filter) params.set("category", filter);
        const res = await fetch(`/api/shortlists?${params}`);
        const data = await res.json();
        setShortlists(data.shortlists ?? []);
      } catch {
        // silently fail
      }
      setLoading(false);
    }
    load();
  }, [filter]);

  const categories = [...new Set(shortlists.map((s) => s.category).filter(Boolean))] as string[];
  const featured = shortlists.filter((s) => s.featured);
  const rest = shortlists.filter((s) => !s.featured);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Shortlists</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Curated player lists by the Chief Scout and our scouting team.
        </p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !filter
              ? "bg-[var(--accent-tactical)] text-white"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === cat
                ? "bg-[var(--accent-tactical)] text-white"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
        </div>
      )}

      {!loading && shortlists.length === 0 && (
        <div className="text-center py-20 text-[var(--text-muted)]">
          No shortlists available yet.
        </div>
      )}

      {!loading && featured.length > 0 && !filter && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4">
            Featured
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {featured.map((sl) => (
              <ShortlistCard key={sl.id} shortlist={sl} featured />
            ))}
          </div>
        </>
      )}

      {!loading && (filter ? shortlists : rest).length > 0 && (
        <>
          {!filter && rest.length > 0 && (
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4">
              All Lists
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(filter ? shortlists : rest).map((sl) => (
              <ShortlistCard key={sl.id} shortlist={sl} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ShortlistCard({ shortlist, featured }: { shortlist: Shortlist; featured?: boolean }) {
  return (
    <Link
      href={`/shortlists/${shortlist.slug}`}
      className={`
        block bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5
        hover:border-[var(--accent-tactical)] transition-all hover:scale-[1.01]
        ${featured ? "ring-1 ring-[var(--accent-tactical)]/20" : ""}
      `}
    >
      <div className="flex items-start gap-3">
        {shortlist.icon && (
          <span className="text-2xl">{shortlist.icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{shortlist.title}</h3>
          {shortlist.description && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
              {shortlist.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {shortlist.player_count} players
            </span>
            {shortlist.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                {CATEGORY_LABELS[shortlist.category] ?? shortlist.category}
              </span>
            )}
            {shortlist.author_name && (
              <span className="text-[10px] text-[var(--text-muted)]">
                by {shortlist.author_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
