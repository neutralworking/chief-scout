"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

interface UserShortlist {
  id: number;
  slug: string;
  title: string;
  icon: string | null;
  player_count: number;
}

export function AddToShortlist({ personId }: { personId: number }) {
  const { fcUserId, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [shortlists, setShortlists] = useState<UserShortlist[]>([]);
  const [playerIn, setPlayerIn] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function loadShortlists() {
    setLoading(true);
    try {
      // Fetch user's shortlists
      const res = await fetch(`/api/shortlists?user_id=${fcUserId}`);
      const data = await res.json();
      const userLists = ((data.shortlists ?? []) as Array<UserShortlist & { author_id: string }>)
        .filter((s) => s.author_id === fcUserId);
      setShortlists(userLists);

      // Check which shortlists this player is in (including user's own)
      const playerRes = await fetch(`/api/players/${personId}/shortlists?user_id=${fcUserId}`);
      if (playerRes.ok) {
        const playerData = await playerRes.json();
        const ids = new Set<number>(
          ((playerData.shortlists ?? []) as Array<{ shortlist_id: number }>).map((s) => s.shortlist_id)
        );
        setPlayerIn(ids);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  function handleOpen() {
    setOpen(!open);
    if (!open) loadShortlists();
  }

  async function togglePlayer(sl: UserShortlist) {
    const isIn = playerIn.has(sl.id);
    if (isIn) {
      await fetch(`/api/shortlists/${sl.slug}/players?user_id=${fcUserId}&person_id=${personId}`, {
        method: "DELETE",
      });
      setPlayerIn((prev) => { const next = new Set(prev); next.delete(sl.id); return next; });
      setShortlists((prev) => prev.map((s) => s.id === sl.id ? { ...s, player_count: Math.max(0, s.player_count - 1) } : s));
    } else {
      await fetch(`/api/shortlists/${sl.slug}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: fcUserId, person_id: personId }),
      });
      setPlayerIn((prev) => new Set(prev).add(sl.id));
      setShortlists((prev) => prev.map((s) => s.id === sl.id ? { ...s, player_count: s.player_count + 1 } : s));
    }
  }

  async function createAndAdd() {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/shortlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: fcUserId, title: newTitle.trim(), visibility: "private" }),
    });
    if (!res.ok) return;
    const { shortlist } = await res.json();

    // Add player to the new shortlist
    await fetch(`/api/shortlists/${shortlist.slug}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: fcUserId, person_id: personId }),
    });

    setShortlists((prev) => [{ id: shortlist.id, slug: shortlist.slug, title: shortlist.title, icon: shortlist.icon, player_count: 1 }, ...prev]);
    setPlayerIn((prev) => new Set(prev).add(shortlist.id));
    setNewTitle("");
    setCreating(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="text-[10px] font-medium px-2 py-1 rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--color-accent-tactical)] transition-colors"
      >
        + Shortlist
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-[var(--border-subtle)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Your Shortlists
            </p>
          </div>

          {loading ? (
            <div className="p-4 text-center">
              <div className="inline-block w-4 h-4 border-2 border-[var(--text-muted)] border-t-[var(--color-accent-tactical)] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {shortlists.length === 0 && !creating && (
                <p className="text-[11px] text-[var(--text-muted)] p-3 text-center">
                  No shortlists yet
                </p>
              )}
              {shortlists.map((sl) => {
                const isIn = playerIn.has(sl.id);
                return (
                  <button
                    key={sl.id}
                    onClick={() => togglePlayer(sl)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)]/50 transition-colors text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${
                      isIn
                        ? "bg-[var(--color-accent-tactical)] border-[var(--color-accent-tactical)] text-white"
                        : "border-[var(--border-subtle)]"
                    }`}>
                      {isIn && "✓"}
                    </span>
                    <span className="text-[11px] truncate flex-1">
                      {sl.icon && <span className="mr-1">{sl.icon}</span>}
                      {sl.title}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">
                      {sl.player_count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Create new */}
          <div className="border-t border-[var(--border-subtle)] p-2">
            {creating ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                  placeholder="Shortlist name..."
                  autoFocus
                  className="flex-1 text-[11px] px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--color-accent-tactical)]"
                />
                <button
                  onClick={createAndAdd}
                  disabled={!newTitle.trim()}
                  className="text-[10px] font-medium px-2 py-1 rounded bg-[var(--color-accent-tactical)] text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full text-[11px] text-[var(--color-accent-tactical)] hover:text-white transition-colors py-1 text-center font-medium"
              >
                + Create new shortlist
              </button>
            )}
          </div>

          {/* Sign-in nudge */}
          {!session && (
            <div className="border-t border-[var(--border-subtle)] px-3 py-1.5">
              <p className="text-[9px] text-[var(--text-muted)]">
                <Link href="/auth/login" className="text-[var(--color-accent-tactical)] hover:underline">Sign in</Link>
                {" "}to keep shortlists across devices
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
