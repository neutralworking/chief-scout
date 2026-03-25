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
  "Championship": "Champ",
  "Eredivisie": "Ere",
  "Liga Portugal": "PT",
  "Primeira Liga": "PT",
  "Major League Soccer": "MLS",
  "MLS": "MLS",
  "Saudi Pro League": "SPL",
  "Scottish Premiership": "SPL",
  "Süper Lig": "TUR",
  "Super Lig": "TUR",
};

function powerBorderColor(rating: number | null): string {
  if (rating == null) return "var(--text-muted)";
  if (rating >= 90) return "var(--color-accent-technical)";
  if (rating >= 80) return "var(--color-accent-mental)";
  if (rating >= 70) return "var(--color-accent-physical)";
  if (rating >= 60) return "var(--text-secondary)";
  return "var(--text-muted)";
}

function powerTextClass(rating: number | null): string {
  if (rating == null) return "text-[var(--text-muted)]";
  if (rating >= 90) return "text-[var(--color-accent-technical)]";
  if (rating >= 80) return "text-[var(--color-accent-mental)]";
  if (rating >= 70) return "text-[var(--text-primary)]";
  if (rating >= 60) return "text-[var(--text-secondary)]";
  return "text-[var(--text-muted)]";
}

function levelTextClass(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 83) return "text-[var(--color-accent-technical)]";
  if (level >= 78) return "text-[var(--color-accent-mental)]";
  if (level >= 73) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function leagueShort(name: string | null): string {
  if (!name) return "–";
  return LEAGUE_SHORT[name] ?? name.split(" ").map(w => w[0]).join("").slice(0, 4);
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
    let list = [...clubs];
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

  const maxPower = useMemo(() => {
    return Math.max(...clubs.map(c => c.power_rating ?? 0), 1);
  }, [clubs]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-bold tracking-tight">Clubs</h1>
          {league && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent-personality)]">
              {league}
            </span>
          )}
        </div>
        <Link
          href="/leagues"
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Leagues &rarr;
        </Link>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mb-3 font-mono">
        {filtered.length === clubs.length
          ? `${clubs.length.toLocaleString()} clubs`
          : `${filtered.length.toLocaleString()} / ${clubs.length.toLocaleString()}`}
      </p>

      {/* Search + filters */}
      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clubs..."
            className="flex-1 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-bright)]"
          />
          <select
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className="px-2 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs"
          >
            <option value="">All Leagues</option>
            {leagues.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* League pills */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setLeague("")}
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
            style={{
              background: league === "" ? "rgba(111,195,223,0.12)" : "var(--bg-surface)",
              color: league === "" ? "var(--border-bright)" : "var(--text-muted)",
              border: `1px solid ${league === "" ? "rgba(111,195,223,0.3)" : "var(--border-subtle)"}`,
            }}
          >
            All
          </button>
          {TOP_LEAGUES.map((lg) => (
            <button
              key={lg}
              onClick={() => setLeague(league === lg ? "" : lg)}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
              style={{
                background: league === lg ? "rgba(111,195,223,0.12)" : "var(--bg-surface)",
                color: league === lg ? "var(--border-bright)" : "var(--text-muted)",
                border: `1px solid ${league === lg ? "rgba(111,195,223,0.3)" : "var(--border-subtle)"}`,
              }}
            >
              {LEAGUE_SHORT[lg] || lg}
            </button>
          ))}
          {(search || league) && (
            <button
              onClick={() => { setSearch(""); setLeague(""); }}
              className="text-[9px] px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              style={{ border: "1px solid var(--border-subtle)" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 px-3 font-medium w-8">#</th>
              <th className="text-left py-2 px-3 font-medium">Club</th>
              <th className="text-left py-2 px-3 font-medium">League</th>
              <th className="text-right py-2 px-3 font-medium w-14">Plrs</th>
              <th className="text-right py-2 px-3 font-medium w-20">
                <button
                  onClick={() => setSortBy("power")}
                  className={`hover:text-[var(--text-secondary)] transition-colors ${sortBy === "power" ? "text-[var(--border-bright)]" : ""}`}
                >
                  Power
                </button>
              </th>
              <th className="text-right py-2 px-3 font-medium w-16">
                <button
                  onClick={() => setSortBy("level")}
                  className={`hover:text-[var(--text-secondary)] transition-colors ${sortBy === "level" ? "text-[var(--border-bright)]" : ""}`}
                >
                  Avg
                </button>
              </th>
              <th className="py-2 px-3 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((club, i) => {
              const pwr = club.power_rating ?? 0;
              const barWidth = maxPower > 0 ? (pwr / maxPower) * 100 : 0;
              return (
                <tr
                  key={club.id}
                  className="border-b border-[var(--border-subtle)]/20 hover:bg-[rgba(111,195,223,0.04)] transition-colors"
                  style={{ borderLeft: `2px solid ${powerBorderColor(club.power_rating)}` }}
                >
                  <td className="py-1.5 px-3 font-mono text-[var(--text-muted)] text-[10px]">
                    {i + 1}
                  </td>
                  <td className="py-1.5 px-3">
                    <Link
                      href={`/clubs/${club.id}`}
                      className="text-[var(--text-primary)] hover:text-[var(--border-bright)] transition-colors font-medium"
                    >
                      {club.name}
                    </Link>
                  </td>
                  <td className="py-1.5 px-3 text-[var(--text-muted)] text-[10px]">
                    {club.league_name || "–"}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-[var(--text-muted)]">
                    {club.player_count}
                  </td>
                  <td className={`py-1.5 px-3 text-right font-mono font-bold ${powerTextClass(club.power_rating)}`}>
                    {club.power_rating != null ? club.power_rating.toFixed(1) : "–"}
                  </td>
                  <td className={`py-1.5 px-3 text-right font-mono ${levelTextClass(club.avg_level)}`}>
                    {club.avg_level != null ? club.avg_level.toFixed(1) : "–"}
                  </td>
                  <td className="py-1.5 px-3">
                    <div className="h-1 bg-[var(--bg-elevated)] overflow-hidden" style={{ width: "100%" }}>
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${barWidth}%`,
                          background: powerBorderColor(club.power_rating),
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            No clubs match your filters.
          </div>
        )}
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-0">
        {filtered.map((club, i) => {
          const pwr = club.power_rating ?? 0;
          const barWidth = maxPower > 0 ? (pwr / maxPower) * 100 : 0;
          return (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-subtle)]/20 hover:bg-[rgba(111,195,223,0.04)] transition-colors"
              style={{ borderLeft: `2px solid ${powerBorderColor(club.power_rating)}` }}
            >
              {/* Rank */}
              <span className="text-[9px] font-mono text-[var(--text-muted)] w-5 shrink-0">
                {i + 1}
              </span>

              {/* League badge */}
              <span
                className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 shrink-0"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                  minWidth: "28px",
                  textAlign: "center",
                }}
              >
                {leagueShort(club.league_name)}
              </span>

              {/* Club name + bar */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {club.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-[var(--text-muted)]">
                    {club.player_count} players
                  </span>
                  {club.avg_level != null && (
                    <span className={`text-[9px] font-mono ${levelTextClass(club.avg_level)}`}>
                      Avg {club.avg_level.toFixed(1)}
                    </span>
                  )}
                </div>
                {/* Power bar */}
                <div className="h-[3px] bg-[var(--bg-elevated)] mt-1 overflow-hidden" style={{ width: "100%" }}>
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${barWidth}%`,
                      background: powerBorderColor(club.power_rating),
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>

              {/* Power score */}
              <div className="shrink-0 text-right">
                <span className={`text-sm font-mono font-bold ${powerTextClass(club.power_rating)}`}>
                  {club.power_rating != null ? club.power_rating.toFixed(0) : "–"}
                </span>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            No clubs match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
