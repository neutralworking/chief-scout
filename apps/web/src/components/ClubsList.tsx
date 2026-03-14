"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface ClubRow {
  id: number;
  name: string;
  league_name: string | null;
  player_count: number;
  avg_level: number | null;
}

function levelColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 83) return "text-amber-400";
  if (level >= 78) return "text-green-400";
  if (level >= 73) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

export function ClubsList({
  clubs,
  leagues,
  initialLeague = "",
}: {
  clubs: ClubRow[];
  leagues: string[];
  initialLeague?: string;
}) {
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState(initialLeague);

  const filtered = useMemo(() => {
    let list = clubs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (league) {
      list = list.filter((c) => c.league_name === league);
    }
    // Sort by avg level desc (clubs with data first)
    return list.sort((a, b) => (b.avg_level ?? 0) - (a.avg_level ?? 0));
  }, [clubs, search, league]);

  return (
    <div>
      <Link href="/leagues" className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors inline-block mb-2">
        &larr; Leagues
      </Link>

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-bold tracking-tight">Clubs</h1>
        {league && (
          <span className="text-xs text-[var(--color-accent-personality)]">{league}</span>
        )}
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] mb-4">
        {filtered.length === clubs.length
          ? `${clubs.length.toLocaleString()} clubs`
          : `${filtered.length.toLocaleString()} of ${clubs.length.toLocaleString()} clubs`}
      </p>

      {/* Filters */}
      <div className="glass rounded-xl p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clubs..."
          className="flex-1 px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-personality)]"
        />
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
        >
          <option value="">All Leagues</option>
          {leagues.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {(search || league) && (
          <button
            onClick={() => { setSearch(""); setLeague(""); }}
            className="px-3 py-1.5 rounded border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Mobile: card list / Desktop: table */}
      {/* Desktop table */}
      <div className="glass rounded-xl overflow-hidden hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 px-4 font-medium">Club</th>
              <th className="text-left py-2 px-4 font-medium">League</th>
              <th className="text-right py-2 px-4 font-medium w-20">Players</th>
              <th className="text-right py-2 px-4 font-medium w-20">Avg Lvl</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((club) => (
              <tr
                key={club.id}
                className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors"
              >
                <td className="py-2 px-4">
                  <Link
                    href={`/clubs/${club.id}`}
                    className="text-[var(--text-primary)] hover:text-white transition-colors"
                  >
                    {club.name}
                  </Link>
                </td>
                <td className="py-2 px-4 text-xs text-[var(--text-secondary)]">
                  {club.league_name || "–"}
                </td>
                <td className="py-2 px-4 text-right font-mono text-[var(--text-muted)]">
                  {club.player_count}
                </td>
                <td className={`py-2 px-4 text-right font-mono font-bold ${levelColor(club.avg_level)}`}>
                  {club.avg_level != null ? club.avg_level.toFixed(1) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">
            No clubs match your filters.
          </div>
        )}
      </div>

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-1">
        {filtered.map((club) => (
          <Link
            key={club.id}
            href={`/clubs/${club.id}`}
            className="glass rounded-lg p-3 flex items-center justify-between hover:border-[var(--color-accent-personality)]/30 transition-colors block"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{club.name}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{club.league_name || "Unknown"}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0 ml-3">
              <div className="text-right">
                <p className="text-xs font-mono text-[var(--text-muted)]">{club.player_count}</p>
                <p className="text-[9px] text-[var(--text-muted)]">players</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-mono font-bold ${levelColor(club.avg_level)}`}>
                  {club.avg_level != null ? club.avg_level.toFixed(1) : "–"}
                </p>
                <p className="text-[9px] text-[var(--text-muted)]">avg lvl</p>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="glass rounded-xl py-8 text-center text-sm text-[var(--text-muted)]">
            No clubs match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
