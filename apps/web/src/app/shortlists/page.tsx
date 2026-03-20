"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

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
  author_id: string | null;
  author_name: string | null;
  visibility: string;
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
  const { fcUserId, session } = useAuth();
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (filter) params.set("category", filter);
        params.set("user_id", fcUserId);
        const res = await fetch(`/api/shortlists?${params}`);
        const data = await res.json();
        setShortlists(data.shortlists ?? []);
      } catch {
        // silently fail
      }
      setLoading(false);
    }
    load();
  }, [filter, fcUserId]);

  const myShortlists = shortlists.filter((s) => s.author_id === fcUserId);
  const publicShortlists = shortlists.filter((s) => s.author_id !== fcUserId);
  const featured = publicShortlists.filter((s) => s.featured);
  const rest = publicShortlists.filter((s) => !s.featured);
  const categories = [...new Set(publicShortlists.map((s) => s.category).filter(Boolean))] as string[];

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/shortlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: fcUserId, title: newTitle.trim(), visibility: "private" }),
    });
    if (!res.ok) return;
    const { shortlist } = await res.json();
    setShortlists((prev) => [shortlist, ...prev]);
    setNewTitle("");
    setCreating(false);
  }

  async function handleDelete(sl: Shortlist) {
    if (!confirm(`Delete "${sl.title}"?`)) return;
    const res = await fetch(`/api/shortlists/${sl.slug}?user_id=${fcUserId}`, { method: "DELETE" });
    if (res.ok) {
      setShortlists((prev) => prev.filter((s) => s.id !== sl.id));
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Shortlists</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Curated player lists by the Chief Scout and our scouting team.
        </p>
      </div>

      {/* My Shortlists */}
      {(myShortlists.length > 0 || !loading) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              My Shortlists
            </h2>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="text-[11px] font-medium text-[var(--color-accent-tactical)] hover:text-white transition-colors"
              >
                + Create
              </button>
            )}
          </div>

          {creating && (
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Shortlist name..."
                autoFocus
                className="flex-1 max-w-xs text-sm px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--color-accent-tactical)]"
              />
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="text-xs font-medium px-3 py-2 rounded-lg bg-[var(--color-accent-tactical)] text-white disabled:opacity-40"
              >
                Create
              </button>
              <button
                onClick={() => { setCreating(false); setNewTitle(""); }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors px-2 py-2"
              >
                Cancel
              </button>
            </div>
          )}

          {myShortlists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myShortlists.map((sl) => (
                <div key={sl.id} className="relative group">
                  <ShortlistCard shortlist={sl} />
                  <button
                    onClick={(e) => { e.preventDefault(); handleDelete(sl); }}
                    className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
                  >
                    Delete
                  </button>
                  {sl.visibility !== "public" && (
                    <span className="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                      {sl.visibility}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : !creating ? (
            <p className="text-sm text-[var(--text-muted)] py-4">
              No shortlists yet. Create one to start tracking players.
              {!session && (
                <span className="block text-[11px] mt-1 text-[var(--text-muted)]">
                  Sign in to keep your shortlists across devices.
                </span>
              )}
            </p>
          ) : null}
        </div>
      )}

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

      {!loading && publicShortlists.length === 0 && (
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

      {!loading && (filter ? publicShortlists : rest).length > 0 && (
        <>
          {!filter && rest.length > 0 && (
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4">
              All Lists
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(filter ? publicShortlists : rest).map((sl) => (
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
