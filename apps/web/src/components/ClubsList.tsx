"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface ClubRow {
  id: number;
  name: string;
  league_name: string | null;
  player_count: number;
  avg_level: number | null;
  power_rating: number | null;
  power_confidence: number | null;
}

const TOP_LEAGUES = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];
const LEAGUE_SHORT: Record<string, string> = {
  "Premier League": "PL",
  "La Liga": "Liga",
  "Serie A": "SA",
  "Bundesliga": "BL",
  "Ligue 1": "L1",
};

function levelColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 83) return "text-amber-400";
  if (level >= 78) return "text-green-400";
  if (level >= 73) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function powerColor(rating: number | null): string {
  if (rating == null) return "text-[var(--text-muted)]";
  if (rating >= 90) return "text-amber-400";
  if (rating >= 80) return "text-green-400";
  if (rating >= 70) return "text-[var(--text-primary)]";
  if (rating >= 60) return "text-[var(--text-secondary)]";
  return "text-[var(--text-muted)]";
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
  const [sortBy, setSortBy] = useState<"power" | "level">("power");

  const filtered = useMemo(() => {
    let list = clubs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (league) {
      list = list.filter((c) => c.league_name === league);
    }
    return list.sort((a, b) => {
      if (!league) {
        const aNoLeague = a.league_name ? 0 : 1;
        const bNoLeague = b.league_name ? 0 : 1;
        if (aNoLeague !== bNoLeague) return aNoLeague - bNoLeague;
      }
      const aSmall = a.player_count < 5 ? 1 : 0;
      const bSmall = b.player_count < 5 ? 1 : 0;
      if (aSmall !== bSmall) return aSmall - bSmall;
      if (sortBy === "power") {
        const aPwr = a.power_rating ?? 0;
        const bPwr = b.power_rating ?? 0;
        if (aPwr !== bPwr) return bPwr - aPwr;
      }
      const diff = (b.avg_level ?? 0) - (a.avg_level ?? 0);
      if (diff !== 0) return diff;
      return b.player_count - a.player_count;
    });
  }, [clubs, search, league, sortBy]);

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
      <p className="text-[11px] text-[var(--text-secondary)] mb-3">
        {filtered.length === clubs.length
          ? `${clubs.length.toLocaleString()} clubs`
          : `${filtered.length.toLocaleString()} of ${clubs.length.toLocaleString()} clubs`}
      </p>

      {/* Top league quick pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setLeague("")}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
            league === "" ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30" : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
          }`}
        >
          All
        </button>
        {TOP_LEAGUES.map((lg) => (
          <button
            key={lg}
            onClick={() => setLeague(league === lg ? "" : lg)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
              league === lg ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30" : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            {LEAGUE_SHORT[lg] || lg}
          </button>
        ))}
      </div>

      {/* Search + league dropdown */}
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

      {/* Desktop table */}
      <div className="glass rounded-xl overflow-hidden hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 px-4 font-medium">Club</th>
              <th className="text-left py-2 px-4 font-medium">League</th>
              <th className="text-right py-2 px-4 font-medium w-20">Players</th>
              <th className="text-right py-2 px-4 font-medium w-20">
                <button onClick={() => setSortBy("power")} className={`hover:text-[var(--text-secondary)] transition-colors ${sortBy === "power" ? "text-[var(--color-accent-personality)]" : ""}`}>
                  Power
                </button>
              </th>
              <th className="text-right py-2 px-4 font-medium w-20">
                <button onClick={() => setSortBy("level")} className={`hover:text-[var(--text-secondary)] transition-colors ${sortBy === "level" ? "text-[var(--color-accent-personality)]" : ""}`}>
                  Avg Lvl
                </button>
              </th>
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
                <td className={`py-2 px-4 text-right font-mono font-bold ${powerColor(club.power_rating)}`}>
                  {club.power_rating != null ? club.power_rating.toFixed(1) : "–"}
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

      {/* Mobile card list */}
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
              {club.power_rating != null && (
                <div className="text-right">
                  <p className={`text-sm font-mono font-bold ${powerColor(club.power_rating)}`}>
                    {club.power_rating.toFixed(1)}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)]">power</p>
                </div>
              )}
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
