"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface ShortlistEntry {
  shortlist_id: number;
  slug: string;
  title: string;
  icon: string | null;
  scout_note: string | null;
  author_id: string | null;
}

export function PlayerShortlists({ personId }: { personId: number }) {
  const { fcUserId } = useAuth();
  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/players/${personId}/shortlists?user_id=${fcUserId}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.shortlists ?? []);
        }
      } catch {
        // silently fail
      }
      setLoading(false);
    }
    load();
  }, [personId, fcUserId]);

  if (loading || entries.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        Appears in Shortlists
      </h3>
      <div className="space-y-2">
        {entries.map((e) => {
          const isOwn = e.author_id === fcUserId;
          return (
            <Link
              key={e.shortlist_id}
              href={`/shortlists/${e.slug}`}
              className="flex items-center gap-2 p-2 -mx-2 rounded-lg hover:bg-[var(--bg-elevated)]/50 transition-colors group"
            >
              {e.icon && <span className="text-sm">{e.icon}</span>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium group-hover:text-white transition-colors truncate">
                    {e.title}
                  </p>
                  {isOwn && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)] shrink-0">
                      Yours
                    </span>
                  )}
                </div>
                {e.scout_note && (
                  <p className="text-xs text-[var(--text-muted)] truncate italic">{e.scout_note}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
