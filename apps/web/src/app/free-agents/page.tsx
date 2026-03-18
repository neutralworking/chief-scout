"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { ageCurveScore } from "@/lib/assessment/four-pillars";
import { getCardTheme, CardTheme } from "@/lib/archetype-themes";
import { MiniRadar } from "@/components/MiniRadar";
import Link from "next/link";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

interface FreeAgent {
  person_id: number;
  name: string;
  dob: string | null;
  nation: string | null;
  club: string | null;
  position: string | null;
  level: number | null;
  best_role_score: number | null;
  archetype: string | null;
  personality_type: string | null;
  pursuit_status: string | null;
  market_value_eur: number | null;
  contract_expiry_date: string | null;
  contract_tag: string | null;
  fingerprint: number[] | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
}

// Hex colors for radar polygon per theme
const RADAR_COLORS: Record<CardTheme, string> = {
  general: "#a1a1aa",
  catalyst: "#e879f9",
  maestro: "#fcd34d",
  captain: "#f87171",
  professor: "#60a5fa",
  default: "#4ade80",
};

// Labels now derived from getRoleRadarConfig() — position-specific 4-axis

function ratingColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 85) return "text-amber-400";
  if (level >= 78) return "text-green-400";
  if (level >= 70) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function formatExpiry(date: string | null): string {
  if (!date) return "–";
  return new Date(date).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatValue(eur: number | null): string {
  if (eur == null) return "–";
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}m`;
  if (eur >= 1_000) return `€${(eur / 1_000).toFixed(0)}k`;
  return `€${eur}`;
}

const TABS = [
  { key: "2026", label: "Expiring 2026" },
  { key: "free", label: "Free Agents" },
  { key: "2027", label: "Expiring 2027" },
] as const;

function FreeAgentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<FreeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tab = searchParams.get("tab") ?? "2026";
  const position = searchParams.get("position") ?? "";
  const sort = searchParams.get("sort") ?? "overall";
  const isFreeTab = tab === "free";

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`/free-agents?${params.toString()}`);
  }, [router, searchParams]);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (position) params.set("position", position);
    if (sort) params.set("sort", sort);
    return `/api/free-agents?${params}`;
  }, [tab, position, sort]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl());
        if (!res.ok) { setError(`Failed: ${res.statusText}`); setLoading(false); return; }
        const data = await res.json();
        if (!cancelled) setPlayers(data.players ?? []);
      } catch (e) { if (!cancelled) setError(String(e)); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [buildUrl]);

  const withScore = players.filter((p) => p.best_role_score != null);
  const avgScore = withScore.length > 0
    ? Math.round(withScore.reduce((sum, p) => sum + (p.best_role_score ?? 0), 0) / withScore.length)
    : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight mb-0.5">Free Agents & Expiring Contracts</h1>
        <p className="text-[11px] text-[var(--text-secondary)] mb-1">
          {loading ? "Loading..." : `${players.length} players`}
          {avgScore != null && !loading && ` · avg score ${avgScore}`}
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">
          Summer 2026 window: who&apos;s available on a Bosman? Scouting intelligence for every expiring contract across Europe&apos;s top 5 leagues.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => updateParam("tab", t.key === "2026" ? "" : t.key)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              tab === t.key
                ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Position pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button onClick={() => updateParam("position", "")}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
            !position ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
          }`}>
          All
        </button>
        {POSITIONS.map((pos) => (
          <button key={pos} onClick={() => updateParam("position", position === pos ? "" : pos)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
              position === pos ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}>
            {pos}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="glass rounded-xl p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <select value={sort} onChange={(e) => updateParam("sort", e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm">
          <option value="overall">Sort: Rating</option>
          <option value="rating">Sort: AF Rating</option>
          <option value="age">Sort: Age</option>
          <option value="value">Sort: Value</option>
          <option value="name">Sort: Name</option>
        </select>
        {position && (
          <button onClick={() => updateParam("position", "")}
            className="px-3 py-1.5 rounded border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Clear filter
          </button>
        )}
      </div>

      {/* Desktop table */}
      {!loading && !error && players.length > 0 && (
        <div className="glass rounded-xl overflow-hidden hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-2 px-4 font-medium w-12">Pos</th>
                <th className="text-left py-2 px-4 font-medium">Player</th>
                <th className="text-left py-2 px-4 font-medium">{isFreeTab ? "Last Club" : "Club"}</th>
                <th className="text-left py-2 px-4 font-medium hidden lg:table-cell">Nation</th>
                <th className="text-right py-2 px-4 font-medium w-12">Age</th>
                <th className="text-center py-2 px-4 font-medium w-20">Radar</th>
                <th className="text-left py-2 px-4 font-medium hidden xl:table-cell">Archetype</th>
                <th className="text-right py-2 px-4 font-medium w-10 hidden lg:table-cell">G</th>
                <th className="text-right py-2 px-4 font-medium w-10 hidden lg:table-cell">A</th>
                <th className="text-right py-2 px-4 font-medium w-12 hidden lg:table-cell">Rtg</th>
                <th className="text-right py-2 px-4 font-medium hidden lg:table-cell">Value</th>
                <th className="text-right py-2 px-4 font-medium w-16 hidden lg:table-cell">
                  <span className="text-[var(--color-accent-physical)]">Phys</span>
                </th>
                <th className="text-right py-2 px-4 font-medium w-20">
                  {isFreeTab ? "Status" : "Expires"}
                </th>
                <th className="text-right py-2 px-4 font-medium w-16">Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const age = computeAge(player.dob);
                const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
                const theme = getCardTheme(player.personality_type);
                const radarColor = RADAR_COLORS[theme];

                return (
                  <tr key={player.person_id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors">
                    <td className="py-2 px-4">
                      <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}>
                        {player.position ?? "–"}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <Link href={`/players/${player.person_id}`}
                        className="text-[var(--text-primary)] hover:text-white transition-colors font-medium">
                        {player.name}
                      </Link>
                    </td>
                    <td className="py-2 px-4 text-xs text-[var(--text-secondary)]">
                      {player.club ? (
                        isFreeTab ? (
                          <span className="text-[var(--text-muted)] italic">ex-{player.club}</span>
                        ) : (
                          player.club
                        )
                      ) : "–"}
                    </td>
                    <td className="py-2 px-4 text-xs text-[var(--text-secondary)] hidden lg:table-cell">{player.nation || "–"}</td>
                    <td className="py-2 px-4 text-right font-mono text-xs text-[var(--text-muted)]">{age ?? "–"}</td>
                    <td className="py-2 px-4">
                      {player.fingerprint && player.fingerprint.some((v) => v > 0) ? (
                        <div className="flex justify-center">
                          <MiniRadar
                            values={player.fingerprint}
                            size={48}
                            color={radarColor}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 mx-auto" />
                      )}
                    </td>
                    <td className="py-2 px-4 text-xs text-[var(--text-secondary)] hidden xl:table-cell">{player.archetype || "–"}</td>
                    <td className="py-2 px-4 text-right font-mono text-[10px] text-[var(--text-muted)] hidden lg:table-cell">
                      {player.goals ?? "–"}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-[10px] text-[var(--text-muted)] hidden lg:table-cell">
                      {player.assists ?? "–"}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-[10px] hidden lg:table-cell">
                      {player.rating != null ? (
                        <span className="text-amber-400">{player.rating.toFixed(2)}★</span>
                      ) : "–"}
                    </td>
                    <td className="py-2 px-4 text-right text-xs font-mono text-[var(--text-secondary)] hidden lg:table-cell">
                      {formatValue(player.market_value_eur)}
                    </td>
                    <td className="py-2 px-4 text-right hidden lg:table-cell">
                      {(() => {
                        const playerAge = computeAge(player.dob);
                        const curve = ageCurveScore(player.position, playerAge);
                        return (
                          <span className={`text-[10px] font-mono font-bold ${
                            curve >= 80 ? "text-[var(--color-accent-physical)]" :
                            curve >= 60 ? "text-[var(--text-secondary)]" :
                            "text-[var(--text-muted)]"
                          }`}>
                            {curve}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {isFreeTab ? (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)]">
                          Free
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          {formatExpiry(player.contract_expiry_date)}
                        </span>
                      )}
                    </td>
                    <td className={`py-2 px-4 text-right font-mono font-bold ${ratingColor(player.best_role_score)}`}>
                      {player.best_role_score ?? "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card list */}
      {!loading && !error && players.length > 0 && (
        <div className="sm:hidden space-y-1">
          {players.map((player) => {
            const age = computeAge(player.dob);
            const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
            const theme = getCardTheme(player.personality_type);
            const radarColor = RADAR_COLORS[theme];

            return (
              <Link key={player.person_id} href={`/players/${player.person_id}`}
                className="glass rounded-lg p-3 flex items-center gap-3 hover:border-[var(--color-accent-personality)]/30 transition-colors block">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
                    {player.position ?? "–"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{player.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {player.club ? (isFreeTab ? `ex-${player.club}` : player.club) : "Unattached"}
                      {player.nation && ` · ${player.nation}`}
                      {age != null && ` · ${age}y`}
                    </p>
                    {(player.goals != null || player.assists != null) && (
                      <p className="text-[10px] font-mono text-[var(--text-muted)]">
                        {player.goals != null && <span className="text-green-400">{player.goals}G</span>}
                        {player.goals != null && player.assists != null && " "}
                        {player.assists != null && <span className="text-blue-400">{player.assists}A</span>}
                        {player.rating != null && <span className="text-amber-400"> · {player.rating.toFixed(1)}★</span>}
                      </p>
                    )}
                  </div>
                </div>
                {player.fingerprint && player.fingerprint.some((v) => v > 0) && (
                  <div className="shrink-0">
                    <MiniRadar
                      values={player.fingerprint}
                      size={40}
                      color={radarColor}
                    />
                  </div>
                )}
                <div className="flex items-center gap-3 shrink-0">
                  {!isFreeTab && player.contract_expiry_date && (
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">
                      {formatExpiry(player.contract_expiry_date)}
                    </span>
                  )}
                  <span className={`text-lg font-mono font-bold ${ratingColor(player.best_role_score)}`}>
                    {player.best_role_score ?? "–"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="glass rounded-xl py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-4 mt-4">
          <p className="text-sm text-[var(--color-sentiment-negative)]">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && players.length === 0 && (
        <div className="glass rounded-xl py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {isFreeTab ? "No free agents found." : `No contracts expiring in ${tab}.`}
            {" "}Contract data may not be fully populated.
          </p>
        </div>
      )}
    </div>
  );
}

export default function FreeAgentsPage() {
  return (
    <Suspense fallback={<div className="text-[var(--text-muted)] text-sm">Loading...</div>}>
      <FreeAgentsContent />
    </Suspense>
  );
}
