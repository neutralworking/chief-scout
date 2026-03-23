"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { POSITION_COLORS } from "@/lib/types";
import Link from "next/link";

// Mirrors pipeline/65_api_football_ingest.py LEAGUES (senior only)
const LEAGUE_TIERS = [
  {
    label: "Top 5",
    leagues: [
      { id: 39, name: "Premier League", short: "PL" },
      { id: 140, name: "La Liga", short: "Liga" },
      { id: 135, name: "Serie A", short: "SA" },
      { id: 78, name: "Bundesliga", short: "BL" },
      { id: 61, name: "Ligue 1", short: "L1" },
    ],
  },
  {
    label: "Europe T2",
    leagues: [
      { id: 88, name: "Eredivisie", short: "ERE" },
      { id: 94, name: "Primeira Liga", short: "PRI" },
      { id: 40, name: "Championship", short: "EFL" },
      { id: 203, name: "Süper Lig", short: "SÜP" },
      { id: 144, name: "Jupiler Pro League", short: "JPL" },
      { id: 179, name: "Scottish Premiership", short: "SPL" },
      { id: 218, name: "Austrian Bundesliga", short: "AUT" },
      { id: 207, name: "Swiss Super League", short: "SUI" },
      { id: 119, name: "Danish Superliga", short: "DAN" },
      { id: 197, name: "Greek Super League", short: "GRE" },
    ],
  },
  {
    label: "Europe T3",
    leagues: [
      { id: 210, name: "Croatian HNL", short: "CRO" },
      { id: 286, name: "Serbian Super Liga", short: "SRB" },
      { id: 283, name: "Romanian Liga I", short: "ROU" },
      { id: 345, name: "Czech Liga", short: "CZE" },
      { id: 106, name: "Ekstraklasa", short: "POL" },
      { id: 113, name: "Allsvenskan", short: "SWE" },
      { id: 103, name: "Eliteserien", short: "NOR" },
      { id: 172, name: "Bulgarian First League", short: "BUL" },
    ],
  },
  {
    label: "Americas",
    leagues: [
      { id: 128, name: "Argentine Liga Profesional", short: "ARG" },
      { id: 71, name: "Brasileirão Série A", short: "BRA" },
      { id: 262, name: "Liga MX", short: "MEX" },
      { id: 239, name: "Colombian Primera A", short: "COL" },
      { id: 253, name: "MLS", short: "MLS" },
    ],
  },
  {
    label: "Asia / Other",
    leagues: [
      { id: 307, name: "Saudi Pro League", short: "KSA" },
      { id: 292, name: "K League 1", short: "KOR" },
      { id: 169, name: "Chinese Super League", short: "CHN" },
      { id: 188, name: "A-League", short: "AUS" },
    ],
  },
];

const ALL_LEAGUES = LEAGUE_TIERS.flatMap((t) => t.leagues);

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

type SortKey =
  | "rating"
  | "goals"
  | "assists"
  | "appearances"
  | "minutes"
  | "passes_accuracy"
  | "tackles_total"
  | "interceptions"
  | "duels_pct"
  | "dribbles_pct"
  | "cards";

interface StatRow {
  person_id: number | null;
  name: string;
  position: string | null;
  team_name: string | null;
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
  shots_total: number | null;
  shots_on: number | null;
  passes_accuracy: number | null;
  tackles_total: number | null;
  interceptions: number | null;
  blocks: number | null;
  duels_total: number | null;
  duels_won: number | null;
  dribbles_attempted: number | null;
  dribbles_success: number | null;
  cards_yellow: number | null;
  cards_red: number | null;
}

function num(v: number | null): string {
  if (v == null) return "–";
  return Number.isInteger(v) ? v.toString() : v.toFixed(1);
}

function pct(won: number | null, total: number | null): string {
  if (won == null || total == null || total === 0) return "–";
  return `${Math.round((won / total) * 100)}%`;
}

function StatsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortAsc, setSortAsc] = useState(false);
  const [posFilter, setPosFilter] = useState("");

  const leagueId = parseInt(searchParams.get("league_id") ?? "39", 10);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/stats?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stats?league_id=${leagueId}&season=2025`);
        if (!res.ok) {
          setError(`Failed: ${res.statusText}`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setPlayers(data.players ?? []);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  // Client-side sort + position filter
  const filtered = posFilter
    ? players.filter((p) => p.position === posFilter)
    : players;

  const sorted = [...filtered].sort((a, b) => {
    let va: number;
    let vb: number;
    switch (sortKey) {
      case "duels_pct":
        va = a.duels_total ? ((a.duels_won ?? 0) / a.duels_total) * 100 : 0;
        vb = b.duels_total ? ((b.duels_won ?? 0) / b.duels_total) * 100 : 0;
        break;
      case "dribbles_pct":
        va = a.dribbles_attempted
          ? ((a.dribbles_success ?? 0) / a.dribbles_attempted) * 100
          : 0;
        vb = b.dribbles_attempted
          ? ((b.dribbles_success ?? 0) / b.dribbles_attempted) * 100
          : 0;
        break;
      case "cards":
        va = (a.cards_yellow ?? 0) + (a.cards_red ?? 0) * 3;
        vb = (b.cards_yellow ?? 0) + (b.cards_red ?? 0) * 3;
        break;
      default:
        va = (a[sortKey] as number) ?? 0;
        vb = (b[sortKey] as number) ?? 0;
        break;
    }
    return sortAsc ? va - vb : vb - va;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortTh({
    label,
    sKey,
    className = "",
  }: {
    label: string;
    sKey: SortKey;
    className?: string;
  }) {
    const active = sortKey === sKey;
    return (
      <th
        className={`text-right py-1.5 px-2 font-medium cursor-pointer select-none transition-colors ${active ? "text-[var(--text-primary)]" : ""} ${className}`}
        onClick={() => toggleSort(sKey)}
      >
        {label}
        {active && (
          <span className="ml-0.5 text-[8px]">{sortAsc ? "\u25B2" : "\u25BC"}</span>
        )}
      </th>
    );
  }

  const currentLeague = ALL_LEAGUES.find((l) => l.id === leagueId);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="shrink-0 mb-2">
        <h1 className="text-lg font-bold tracking-tight mb-1">League Stats</h1>
        <p className="text-[11px] text-[var(--text-muted)] mb-2">
          API-Football season stats across {ALL_LEAGUES.length} leagues. {!loading && `${sorted.length} players.`}
        </p>

        {/* League tabs — grouped by tier */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 mb-2">
          {LEAGUE_TIERS.map((tier, ti) => (
            <div key={tier.label} className="contents">
              {ti > 0 && (
                <span className="text-[8px] text-[var(--text-muted)]/40 mx-0.5 select-none">|</span>
              )}
              {tier.leagues.map((l) => (
                <button
                  key={l.id}
                  onClick={() => updateParam("league_id", String(l.id))}
                  title={l.name}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                    leagueId === l.id
                      ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
                      : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {l.short}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Position filter */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setPosFilter("")}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
              !posFilter
                ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            All
          </button>
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(posFilter === pos ? "" : pos)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                posFilter === pos
                  ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col">
        {!loading && !error && sorted.length > 0 && (
          <div className="card rounded-xl overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto h-full">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-surface)] z-10">
                  <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="text-left py-1.5 px-3 font-medium w-8">#</th>
                    <th className="text-left py-1.5 px-2 font-medium w-10">Pos</th>
                    <th className="text-left py-1.5 px-2 font-medium sticky left-0 bg-[var(--bg-surface)] z-20">Player</th>
                    <th className="text-left py-1.5 px-2 font-medium hidden md:table-cell">Club</th>
                    <SortTh label="App" sKey="appearances" />
                    <SortTh label="Min" sKey="minutes" className="hidden md:table-cell" />
                    <SortTh label="G" sKey="goals" />
                    <SortTh label="A" sKey="assists" />
                    <SortTh label="Rtg" sKey="rating" />
                    <SortTh label="Pass%" sKey="passes_accuracy" className="hidden lg:table-cell" />
                    <SortTh label="Tkl" sKey="tackles_total" className="hidden lg:table-cell" />
                    <SortTh label="Int" sKey="interceptions" className="hidden lg:table-cell" />
                    <SortTh label="Duel%" sKey="duels_pct" className="hidden lg:table-cell" />
                    <SortTh label="Drb%" sKey="dribbles_pct" className="hidden xl:table-cell" />
                    <SortTh label="Cards" sKey="cards" className="hidden xl:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, idx) => {
                    const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
                    return (
                      <tr
                        key={`${p.person_id ?? idx}-${p.team_name}`}
                        className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors"
                      >
                        <td className="py-1.5 px-3 font-mono text-[10px] text-[var(--text-muted)]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2">
                          {p.position ? (
                            <span
                              className={`text-[8px] font-bold tracking-wider px-1 py-0.5 rounded ${posColor} text-white`}
                            >
                              {p.position}
                            </span>
                          ) : (
                            <span className="text-[9px] text-[var(--text-muted)]">–</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 sticky left-0 bg-[var(--bg-surface)]">
                          {p.person_id ? (
                            <Link
                              href={`/players/${p.person_id}`}
                              className="text-[var(--text-primary)] hover:text-white transition-colors font-medium"
                            >
                              {p.name}
                            </Link>
                          ) : (
                            <span className="text-[var(--text-secondary)]">{p.name}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-[var(--text-secondary)] hidden md:table-cell truncate max-w-[120px]">
                          {p.team_name || "–"}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">
                          {num(p.appearances)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-[var(--text-secondary)] hidden md:table-cell">
                          {num(p.minutes)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">
                          {num(p.goals)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">
                          {num(p.assists)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-amber-400">
                          {p.rating != null ? p.rating.toFixed(2) : "–"}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono hidden lg:table-cell">
                          {p.passes_accuracy != null ? `${p.passes_accuracy.toFixed(0)}%` : "–"}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono hidden lg:table-cell">
                          {num(p.tackles_total)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono hidden lg:table-cell">
                          {num(p.interceptions)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono hidden lg:table-cell">
                          {pct(p.duels_won, p.duels_total)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono hidden xl:table-cell">
                          {pct(p.dribbles_success, p.dribbles_attempted)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono hidden xl:table-cell">
                          {(p.cards_yellow ?? 0) > 0 || (p.cards_red ?? 0) > 0 ? (
                            <>
                              {(p.cards_yellow ?? 0) > 0 && (
                                <span className="text-amber-400">{p.cards_yellow}Y</span>
                              )}
                              {(p.cards_red ?? 0) > 0 && (
                                <span className="text-red-400 ml-1">{p.cards_red}R</span>
                              )}
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && (
          <div className="card rounded-xl py-12 text-center flex-1">
            <p className="text-sm text-[var(--text-muted)]">Loading stats...</p>
          </div>
        )}

        {error && (
          <div className="card rounded-xl p-4">
            <p className="text-sm text-[var(--color-sentiment-negative)]">{error}</p>
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="card rounded-xl py-12 text-center flex-1">
            <p className="text-sm text-[var(--text-muted)]">
              No stats found for {currentLeague?.name ?? "this league"}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-[var(--text-muted)] text-sm">Loading...</div>
      }
    >
      <StatsContent />
    </Suspense>
  );
}
