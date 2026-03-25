"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { ageCurveScore } from "@/lib/assessment/four-pillars";
import { getCardTheme, CardTheme } from "@/lib/archetype-themes";
import { getArchetypeColor } from "@/lib/archetype-styles";
import { MiniRadar } from "@/components/MiniRadar";
import { PlayerCard } from "@/components/PlayerCard";
import Link from "next/link";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

interface FreeAgent {
  person_id: number;
  name: string;
  dob: string | null;
  nation: string | null;
  nation_code: string | null;
  club: string | null;
  club_id: number | null;
  position: string | null;
  side: string | null;
  level: number | null;
  best_role: string | null;
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
  technical_score: number | null;
  tactical_score: number | null;
  mental_score: number | null;
  physical_score: number | null;
  overall_pillar_score: number | null;
  earned_archetype: string | null;
  archetype_tier: string | null;
  legacy_tag: string | null;
  behavioral_tag: string | null;
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

const WIDE_POSITIONS = new Set(["WF", "WD", "WM"]);
const SIDE_ABBREV: Record<string, string> = { Left: "L", Right: "R", Both: "L/R" };

function posWithSide(position: string | null, side: string | null): string {
  if (!position) return "–";
  if (!side || !WIDE_POSITIONS.has(position)) return position;
  const abbr = SIDE_ABBREV[side];
  return abbr ? `${position} (${abbr})` : position;
}

const TABS = [
  { key: "free", label: "Free Agents" },
  { key: "2026", label: "2026" },
  { key: "2027", label: "2027" },
  { key: "2028", label: "2028" },
] as const;

function FreeAgentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<FreeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tab = searchParams.get("tab") ?? "free";
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
      <div className="mb-3">
        <h1 className="text-lg font-bold tracking-tight mb-0.5">Free Agency</h1>
        <p className="text-[10px] text-[var(--text-muted)] font-data mb-1">
          {loading ? "Loading..." : `${players.length} players`}
          {avgScore != null && !loading && ` · avg score ${avgScore}`}
        </p>
        <p className="text-[10px] text-[var(--text-muted)]">
          Summer 2026: Bosman targets across Europe&apos;s top leagues.
        </p>
      </div>

      {/* Tabs + Position pills + Sort */}
      <div className="mb-3 space-y-2">
        {/* Tabs */}
        <div className="flex gap-0.5">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => updateParam("tab", t.key === "free" ? "" : t.key)}
                className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 transition-colors"
                style={{
                  background: active ? "rgba(153,89,182,0.15)" : "var(--bg-surface)",
                  color: active ? "var(--color-accent-tactical)" : "var(--text-muted)",
                  border: `1px solid ${active ? "rgba(153,89,182,0.4)" : "var(--border-subtle)"}`,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Position pills */}
        <div className="flex flex-wrap gap-1">
          <button onClick={() => updateParam("position", "")}
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
            style={{
              background: !position ? "rgba(111,195,223,0.12)" : "var(--bg-surface)",
              color: !position ? "var(--border-bright)" : "var(--text-muted)",
              border: `1px solid ${!position ? "rgba(111,195,223,0.3)" : "var(--border-subtle)"}`,
            }}
          >
            All
          </button>
          {POSITIONS.map((pos) => (
            <button key={pos} onClick={() => updateParam("position", position === pos ? "" : pos)}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
              style={{
                background: position === pos ? "rgba(111,195,223,0.12)" : "var(--bg-surface)",
                color: position === pos ? "var(--border-bright)" : "var(--text-muted)",
                border: `1px solid ${position === pos ? "rgba(111,195,223,0.3)" : "var(--border-subtle)"}`,
              }}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          <select value={sort} onChange={(e) => updateParam("sort", e.target.value)}
            className="px-2 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs">
            <option value="overall">Sort: Rating</option>
            <option value="rating">Sort: AF Rating</option>
            <option value="age">Sort: Age</option>
            <option value="value">Sort: Value</option>
            <option value="name">Sort: Name</option>
          </select>
          {position && (
            <button onClick={() => updateParam("position", "")}
              className="px-2 py-1.5 text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              style={{ border: "1px solid var(--border-subtle)" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Desktop table */}
      {!loading && !error && players.length > 0 && (
        <div className="hidden sm:block border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-subtle)]">
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
                  <tr key={player.person_id} className="border-b border-[var(--border-subtle)]/20 hover:bg-[rgba(111,195,223,0.04)] transition-colors"
                    style={{ borderLeft: `2px solid ${isFreeTab ? 'var(--color-accent-tactical)' : 'var(--border-subtle)'}` }}>
                    <td className="py-2 px-4">
                      <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}>
                        {posWithSide(player.position, player.side)}
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
                    <td className="py-2 px-4 text-right font-data text-xs text-[var(--text-muted)]">{age ?? "–"}</td>
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
                    <td className="py-2 px-4 text-xs hidden xl:table-cell">
                      {(player.earned_archetype || player.archetype) ? (
                        <span style={{ color: getArchetypeColor(player.earned_archetype ?? player.archetype) }}>
                          {player.earned_archetype ?? player.archetype}
                        </span>
                      ) : "–"}
                    </td>
                    <td className="py-2 px-4 text-right font-data text-[10px] text-[var(--text-muted)] hidden lg:table-cell">
                      {player.goals ?? "–"}
                    </td>
                    <td className="py-2 px-4 text-right font-data text-[10px] text-[var(--text-muted)] hidden lg:table-cell">
                      {player.assists ?? "–"}
                    </td>
                    <td className="py-2 px-4 text-right font-data text-[10px] hidden lg:table-cell">
                      {player.rating != null ? (
                        <span className="text-amber-400">{player.rating.toFixed(2)}★</span>
                      ) : "–"}
                    </td>
                    <td className="py-2 px-4 text-right text-xs font-data text-[var(--text-secondary)] hidden lg:table-cell">
                      {formatValue(player.market_value_eur)}
                    </td>
                    <td className="py-2 px-4 text-right hidden lg:table-cell">
                      {(() => {
                        const playerAge = computeAge(player.dob);
                        const curve = ageCurveScore(player.position, playerAge);
                        return (
                          <span className={`text-[10px] font-data font-bold ${
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
                        <span className="text-[10px] font-data text-[var(--text-muted)]">
                          {formatExpiry(player.contract_expiry_date)}
                        </span>
                      )}
                    </td>
                    <td className={`py-2 px-4 text-right font-data font-bold ${ratingColor(player.best_role_score)}`}>
                      {player.best_role_score ?? "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card list — uses shared PlayerCard component */}
      {!loading && !error && players.length > 0 && (
        <div className="sm:hidden space-y-1">
          {players.map((player) => (
            <PlayerCard
              key={player.person_id}
              player={{
                person_id: player.person_id,
                name: player.name,
                dob: player.dob,
                height_cm: null,
                preferred_foot: null,
                active: true,
                nation: player.nation,
                nation_code: player.nation_code,
                club: player.club ? (isFreeTab ? `ex-${player.club}` : player.club) : null,
                club_id: player.club_id,
                league_name: null,
                position: posWithSide(player.position, player.side),
                level: player.level,
                archetype: player.archetype,
                model_id: null,
                profile_tier: null,
                personality_type: player.personality_type,
                pursuit_status: player.pursuit_status,
                market_value_tier: null,
                true_mvt: null,
                market_value_eur: player.market_value_eur,
                director_valuation_meur: null,
                best_role: player.best_role,
                best_role_score: player.best_role_score,
                engine_value_p50: null,
                engine_confidence: null,
                apps: null,
                goals: player.goals,
                assists: player.assists,
                xg: null,
                rating: player.rating,
                fingerprint: player.fingerprint,
                technical_score: player.technical_score,
                tactical_score: player.tactical_score,
                mental_score: player.mental_score,
                physical_score: player.physical_score,
                overall_pillar_score: player.overall_pillar_score,
                earned_archetype: player.earned_archetype,
                archetype_tier: player.archetype_tier,
                legacy_tag: player.legacy_tag,
                behavioral_tag: player.behavioral_tag,
              }}
            />
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] py-12 text-center">
          <p className="text-xs text-[var(--text-muted)]">Loading...</p>
        </div>
      )}

      {error && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 mt-2">
          <p className="text-xs text-[var(--color-sentiment-negative)]">{error}</p>
        </div>
      )}

      {!loading && !error && players.length === 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] py-12 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            {isFreeTab ? "No free agents found." : `No contracts expiring in ${tab}.`}
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
