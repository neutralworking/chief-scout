"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";

interface SimilarPlayer {
  person_id: number;
  name: string;
  position: string | null;
  archetype: string | null;
  overall: number | null;
  club: string | null;
  nation: string | null;
  image_url: string | null;
  best_role: string | null;
  pursuit_status: string | null;
  similarity: number;
}

export function SimilarPlayers({ playerId }: { playerId: number }) {
  const [players, setPlayers] = useState<SimilarPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/players/${playerId}/similar`);
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.players ?? []);
        }
      } catch {
        // silently fail
      }
      setLoading(false);
    }
    load();
  }, [playerId]);

  if (loading) {
    return (
      <div className="glass rounded-xl p-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Similar Players</h3>
        <p className="text-[10px] text-[var(--text-muted)]">Finding matches...</p>
      </div>
    );
  }

  if (players.length === 0) return null;

  return (
    <div className="glass rounded-xl p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Similar Players</h3>
      <div className="space-y-0.5">
        {players.map((p) => {
          const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
          return (
            <Link
              key={p.person_id}
              href={`/players/${p.person_id}`}
              className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md hover:bg-[var(--bg-elevated)]/50 transition-colors group"
            >
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-7 h-7 rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)] shrink-0">
                  {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium truncate group-hover:text-white transition-colors">{p.name}</span>
                  {p.overall != null && (
                    <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] shrink-0">{p.overall}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  {p.club && <span className="truncate">{p.club}</span>}
                  {p.archetype && (
                    <>
                      <span>&middot;</span>
                      <span className="text-[var(--color-accent-tactical)] shrink-0">{p.archetype}</span>
                    </>
                  )}
                </div>
              </div>
              <span className={`text-[8px] font-bold tracking-wider px-1 py-0.5 rounded ${posColor} text-white shrink-0`}>
                {p.position ?? "–"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
