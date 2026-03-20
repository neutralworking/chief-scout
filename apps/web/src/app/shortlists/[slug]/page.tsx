"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { POSITION_COLORS, computeAge } from "@/lib/types";
import { MiniRadar } from "@/components/MiniRadar";
import { getRoleRadarConfig } from "@/lib/role-radar";
import { useAuth } from "@/components/AuthProvider";

interface ShortlistDetail {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  tags: string[] | null;
  featured: boolean;
  author_id: string | null;
  author_name: string | null;
  author_type: string;
  visibility: string;
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
    fingerprint: number[] | null;
    best_role: string | null;
  } | null;
}

export default function ShortlistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { fcUserId } = useAuth();
  const [shortlist, setShortlist] = useState<ShortlistDetail | null>(null);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const isOwner = shortlist?.author_id === fcUserId;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/shortlists/${slug}?user_id=${fcUserId}`);
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
  }, [slug, fcUserId]);

  async function handleRemovePlayer(personId: number) {
    const res = await fetch(`/api/shortlists/${slug}/players?user_id=${fcUserId}&person_id=${personId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPlayers((prev) => prev.filter((e) => e.person_id !== personId));
      setShortlist((prev) => prev ? { ...prev, player_count: Math.max(0, prev.player_count - 1) } : prev);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${shortlist?.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/shortlists/${slug}?user_id=${fcUserId}`, { method: "DELETE" });
    if (res.ok) router.push("/shortlists");
  }

  async function handleSaveEdit() {
    const res = await fetch(`/api/shortlists/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: fcUserId, title: editTitle, description: editDesc }),
    });
    if (res.ok) {
      const { shortlist: updated } = await res.json();
      setShortlist(updated);
      setEditing(false);
    }
  }

  async function handleToggleVisibility() {
    if (!shortlist) return;
    const next = shortlist.visibility === "private" ? "public" : "private";
    const res = await fetch(`/api/shortlists/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: fcUserId, visibility: next }),
    });
    if (res.ok) {
      const { shortlist: updated } = await res.json();
      setShortlist(updated);
    }
  }

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
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-2xl font-bold w-full bg-transparent border-b border-[var(--border-subtle)] outline-none focus:border-[var(--color-accent-tactical)] pb-1"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)..."
              rows={2}
              className="text-sm w-full bg-transparent border border-[var(--border-subtle)] rounded-lg p-2 outline-none focus:border-[var(--color-accent-tactical)] text-[var(--text-secondary)] placeholder-[var(--text-muted)]"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-accent-tactical)] text-white">Save</button>
              <button onClick={() => setEditing(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              {shortlist.icon && <span className="text-3xl">{shortlist.icon}</span>}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{shortlist.title}</h1>
              {isOwner && shortlist.visibility !== "public" && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                  {shortlist.visibility}
                </span>
              )}
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
          </>
        )}

        {/* Owner controls */}
        {isOwner && !editing && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => { setEditTitle(shortlist.title); setEditDesc(shortlist.description ?? ""); setEditing(true); }}
              className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleToggleVisibility}
              className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Make {shortlist.visibility === "private" ? "public" : "private"}
            </button>
            <button
              onClick={handleDelete}
              className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Players */}
      <div className="space-y-2">
        {players.map((entry, i) => {
          const p = entry.player;
          if (!p) return null;

          const age = computeAge(p.dob);
          const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";

          return (
            <div key={entry.person_id} className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--accent-tactical)] transition-all group">
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

              {/* MiniRadar fingerprint */}
              {p.fingerprint?.some(v => v > 0) && (() => {
                const { labels } = getRoleRadarConfig(p.best_role, p.position);
                const trimmedLabels = labels.length === p.fingerprint!.length ? labels : labels.slice(0, p.fingerprint!.length);
                return (
                  <div className="shrink-0">
                    <MiniRadar values={p.fingerprint!} size={56} color="rgba(52,211,153,0.7)" labels={trimmedLabels} />
                  </div>
                );
              })()}

              {/* Player info */}
              <Link href={`/players/${entry.person_id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm group-hover:text-white transition-colors">
                    {p.name}
                  </span>
                  {p.level != null && (
                    <span className="text-xs font-mono font-bold text-[var(--accent-tactical)]">OVR {p.level}</span>
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
              </Link>

              {/* Market value */}
              {p.market_value_tier && (
                <span className="text-xs font-mono text-[var(--text-muted)] shrink-0 hidden sm:block">
                  {p.market_value_tier}
                </span>
              )}

              {/* Owner: remove button */}
              {isOwner && (
                <button
                  onClick={() => handleRemovePlayer(entry.person_id)}
                  className="text-[9px] px-1.5 py-0.5 rounded text-red-400 hover:bg-red-500/20 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                >
                  Remove
                </button>
              )}
            </div>
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
