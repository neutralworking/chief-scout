"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { getArchetypeColor } from "@/lib/archetype-styles";

interface SimilarityResult {
  player: {
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
    peak: number | null;
    active: boolean;
  };
  similarity: number;
  confidence: "strong" | "partial" | "indicative";
  populated_factors: number;
  factors: Record<string, number>;
  match_reasons: string[];
}

type Lens = "match" | "replacement";

export function SimilarPlayers({ playerId, limit }: { playerId: number; limit?: number }) {
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [lens, setLens] = useState<Lens>("match");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/players/${playerId}/similar?lens=${lens}&include_legends=true`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {
        // silently fail
      }
      setLoading(false);
    }
    load();
  }, [playerId, lens]);

  const legendMatches = results.filter((r) => r.player.active === false);
  const activeMatches = results.filter((r) => r.player.active !== false);

  if (loading) {
    return (
      <div className="card rounded-xl p-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Similar Players</h3>
        <p className="text-[10px] text-[var(--text-muted)]">Finding matches...</p>
      </div>
    );
  }

  if (activeMatches.length === 0 && legendMatches.length === 0) return null;

  return (
    <div className="card rounded-xl p-3">
      {/* Lens toggle */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setLens("match")}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
            lens === "match"
              ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
          }`}
        >
          Closest Match
        </button>
        <button
          onClick={() => setLens("replacement")}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
            lens === "replacement"
              ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
          }`}
        >
          Replacements
        </button>
      </div>

      {/* Legend comparisons */}
      {legendMatches.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 mb-1.5">Plays Like</h3>
          <div className="space-y-1">
            {legendMatches.map((r) => (
              <Link
                key={r.player.person_id}
                href={`/players/${r.player.person_id}`}
                className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md bg-amber-400/5 border border-amber-400/10 hover:bg-amber-400/10 transition-colors"
              >
                <span className="text-amber-400 text-xs font-semibold truncate">{r.player.name}</span>
                {r.player.peak && <span className="text-[10px] font-mono font-bold text-amber-400/60 shrink-0">{r.player.peak}</span>}
                {r.player.best_role && <span className="text-[9px] text-[var(--text-muted)] shrink-0">{r.player.best_role}</span>}
                <span className="text-[9px] font-mono text-amber-400/40 shrink-0 ml-auto">{Math.min(99, r.similarity)}%</span>
                {r.confidence === "partial" && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-400/10 text-amber-400/70 shrink-0">partial</span>}
                {r.confidence === "indicative" && <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-[var(--text-muted)] shrink-0">indicative</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Similar Players</h3>
      <div className="space-y-0.5">
        {(limit ? activeMatches.slice(0, limit) : activeMatches).map((r) => {
          const p = r.player;
          const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
          return (
            <div key={p.person_id}>
              <Link
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
                    <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">{Math.min(99, r.similarity)}%</span>
                    {r.confidence === "partial" && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-400/10 text-amber-400/70 shrink-0">partial</span>}
                    {r.confidence === "indicative" && <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-[var(--text-muted)] shrink-0">indicative</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                    {p.club && <span className="truncate">{p.club}</span>}
                    {p.archetype && (
                      <>
                        <span>&middot;</span>
                        <span className="shrink-0" style={{ color: getArchetypeColor(p.archetype) }}>{p.archetype}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className={`text-[8px] font-bold tracking-wider px-1 py-0.5 rounded ${posColor} text-white shrink-0`}>
                  {p.position ?? "\u2013"}
                </span>
              </Link>
              {r.match_reasons.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 -mt-0.5 mb-1 ml-9">
                  {r.match_reasons.map((reason) => (
                    <span key={reason} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-muted)]">
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
