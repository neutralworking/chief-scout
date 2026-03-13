"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { POSITION_COLORS, computeAge } from "@/lib/types";

interface ShortlistDetail {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  tags: string[] | null;
  featured: boolean;
  author_name: string | null;
  author_type: string;
  player_count: number;
  updated_at: string;
}

interface PlayerEntry {
  person_id: number;
  sort_order: number;
  scout_note: string | null;
  player: {
    person_id: number;
    name: string;
    dob: string | null;
    nation: string | null;
    club: string | null;
    position: string | null;
    level: number | null;
    archetype: string | null;
    pursuit_status: string | null;
    market_value_tier: string | null;
    personality_type: string | null;
  } | null;
}

export default function ShortlistDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [shortlist, setShortlist] = useState<ShortlistDetail | null>(null);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/shortlists/${slug}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setShortlist(data.shortlist);
        setPlayers(data.players ?? []);
      } catch {
        // silently fail
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!shortlist) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-2">Shortlist not found</h1>
        <Link href="/shortlists" className="text-sm text-[var(--accent-tactical)] hover:underline">
          &larr; Back to shortlists
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-2">
        <Link href="/shortlists" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          &larr; All Shortlists
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {shortlist.icon && <span className="text-3xl">{shortlist.icon}</span>}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{shortlist.title}</h1>
        </div>
        {shortlist.description && (
          <p className="text-sm text-[var(--text-secondary)] max-w-2xl">{shortlist.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-muted)]">
          {shortlist.author_name && (
            <span>Curated by <strong>{shortlist.author_name}</strong></span>
          )}
          <span>{shortlist.player_count} players</span>
          {shortlist.updated_at && (
            <span>Updated {new Date(shortlist.updated_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Players */}
      <div className="space-y-2">
        {players.map((entry, i) => {
          const p = entry.player;
          if (!p) return null;

          const age = computeAge(p.dob);
          const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";

          return (
            <Link
              key={entry.person_id}
              href={`/players/${entry.person_id}`}
              className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--accent-tactical)] transition-all group"
            >
              {/* Rank */}
              <span className="text-lg font-mono font-bold text-[var(--text-muted)] w-8 text-center shrink-0">
                {i + 1}
              </span>

              {/* Position badge */}
              {p.position && (
                <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${posColor} text-white shrink-0`}>
                  {p.position}
                </span>
              )}

              {/* Player info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm group-hover:text-white transition-colors">
                    {p.name}
                  </span>
                  {p.level != null && (
                    <span className="text-xs font-mono font-bold text-[var(--accent-tactical)]">{p.level}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-0.5">
                  {p.club && <span>{p.club}</span>}
                  {age != null && <span>&middot; {age}</span>}
                  {p.nation && <span>&middot; {p.nation}</span>}
                  {p.archetype && (
                    <span className="text-[var(--text-muted)]">&middot; {p.archetype}</span>
                  )}
                </div>
                {entry.scout_note && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 italic line-clamp-1">
                    {entry.scout_note}
                  </p>
                )}
              </div>

              {/* Market value */}
              {p.market_value_tier && (
                <span className="text-xs font-mono text-[var(--text-muted)] shrink-0 hidden sm:block">
                  {p.market_value_tier}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {players.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          No players in this shortlist yet.
        </div>
      )}
    </div>
  );
}
