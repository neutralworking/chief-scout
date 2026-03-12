"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface ClubRow {
  id: number;
  name: string;
  nation: string | null;
  league_name: string | null;
  player_count: number;
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function ClubsList({
  clubs,
  leagues,
  countries,
  initialLeague = "",
  initialCountry = "",
}: {
  clubs: ClubRow[];
  leagues: string[];
  countries: string[];
  initialLeague?: string;
  initialCountry?: string;
}) {
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState(initialLeague);
  const [country, setCountry] = useState(initialCountry);

  const filtered = useMemo(() => {
    let list = clubs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (league) {
      list = list.filter((c) => c.league_name === league);
    }
    if (country) {
      list = list.filter((c) => c.nation === country);
    }
    return list;
  }, [clubs, search, league, country]);

  // Group by first letter for alpha jump
  const letterSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of filtered) {
      const first = c.name[0]?.toUpperCase();
      if (first) s.add(first);
    }
    return s;
  }, [filtered]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Clubs</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-4">
        {filtered.length === clubs.length
          ? `${clubs.length.toLocaleString()} clubs`
          : `${filtered.length.toLocaleString()} of ${clubs.length.toLocaleString()} clubs`}
      </p>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
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
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(search || league || country) && (
          <button
            onClick={() => { setSearch(""); setLeague(""); setCountry(""); }}
            className="px-3 py-1.5 rounded border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Alpha jump */}
      <div className="flex flex-wrap gap-1 mb-4">
        {ALPHA.map((letter) => {
          const hasClubs = letterSet.has(letter);
          return hasClubs ? (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className="w-7 h-7 flex items-center justify-center rounded text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--color-accent-personality)]/20 transition-colors"
            >
              {letter}
            </a>
          ) : (
            <span
              key={letter}
              className="w-7 h-7 flex items-center justify-center rounded text-xs font-mono text-[var(--text-muted)]/30"
            >
              {letter}
            </span>
          );
        })}
      </div>

      {/* Club table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
              <th className="text-left py-2.5 px-4 font-medium">Club</th>
              <th className="text-left py-2.5 px-4 font-medium hidden sm:table-cell">League</th>
              <th className="text-left py-2.5 px-4 font-medium hidden md:table-cell">Country</th>
              <th className="text-right py-2.5 px-4 font-medium w-20">Players</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((club, i) => {
              const first = club.name[0]?.toUpperCase();
              const prevFirst = i > 0 ? filtered[i - 1].name[0]?.toUpperCase() : null;
              const showAnchor = first !== prevFirst;

              return (
                <tr
                  key={club.id}
                  id={showAnchor ? `letter-${first}` : undefined}
                  className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors"
                >
                  <td className="py-2 px-4">
                    <Link
                      href={`/clubs/${club.id}`}
                      className="text-[var(--text-primary)] hover:text-white transition-colors"
                    >
                      {club.name}
                    </Link>
                    {/* Show league/country inline on mobile */}
                    {(club.league_name || club.nation) && (
                      <span className="sm:hidden text-xs text-[var(--text-muted)] ml-2">
                        {club.league_name || club.nation}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-xs text-[var(--text-secondary)] hidden sm:table-cell">
                    {club.league_name || "–"}
                  </td>
                  <td className="py-2 px-4 text-xs text-[var(--text-secondary)] hidden md:table-cell">
                    {club.nation || "–"}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-[var(--text-muted)]">
                    {club.player_count || "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">
            No clubs match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
