"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RadarChart } from "@/components/RadarChart";
import { MODEL_ATTRIBUTES, MODEL_SHORT } from "@/lib/models";
import { PERSONALITY_TYPES } from "@/lib/personality";
import { POSITION_COLORS } from "@/lib/types";

/* ────────────────────────── Types ────────────────────────── */

interface SearchResult {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
}

interface ComparePlayer {
  person_id: number;
  name: string;
  dob: string | null;
  age: number | null;
  position: string | null;
  club: string | null;
  nation: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  level: number | null;
  overall: number | null;
  archetype: string | null;
  blueprint: string | null;
  personality_type: string | null;
  best_role: string | null;
  best_role_score: number | null;
  fingerprint: number[] | null;
  market_value_eur: number | null;
  director_valuation_meur: number | null;
  pursuit_status: string | null;
  ei: number | null;
  sn: number | null;
  tf: number | null;
  jp: number | null;
  competitiveness: number | null;
  coachability: number | null;
  modelScores: Record<string, number>;
  topRoles: { name: string; score: number }[];
}

/* ────────────────────────── Constants ────────────────────────── */

const PLAYER_COLORS = ["#38bdf8", "#a78bfa", "#fb923c"];

const PILLAR_CONFIG = {
  Technical: {
    models: ["Dribbler", "Passer", "Striker", "GK"],
    color: "var(--color-accent-technical, #a855f7)",
  },
  Tactical: {
    models: ["Cover", "Destroyer", "Engine"],
    color: "var(--color-accent-tactical, #22c55e)",
  },
  Mental: {
    models: ["Controller", "Commander", "Creator"],
    color: "var(--color-accent-mental, #3b82f6)",
  },
  Physical: {
    models: ["Sprinter", "Powerhouse", "Target"],
    color: "var(--color-accent-physical, #eab308)",
  },
} as const;

const ALL_MODELS = Object.keys(MODEL_ATTRIBUTES);

/* ────────────────────────── Helpers ────────────────────────── */

function pillarScore(
  modelScores: Record<string, number>,
  models: readonly string[],
): number {
  const vals = models
    .map((m) => modelScores[m])
    .filter((v): v is number => v !== undefined);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function formatEur(val: number | null): string {
  if (val == null) return "—";
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}m`;
  if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}k`;
  return `€${val}`;
}

function formatMeur(val: number | null): string {
  if (val == null) return "—";
  return `€${val.toFixed(1)}m`;
}

function winner(vals: (number | null)[]): number | null {
  const nums = vals.map((v) => v ?? -1);
  const max = Math.max(...nums);
  if (max <= 0) return null;
  const winners = nums.filter((n) => n === max);
  if (winners.length > 1) return null; // tie
  return nums.indexOf(max);
}

/* ────────────────────────── Search Dropdown ────────────────────────── */

function PlayerSearch({
  slotIndex,
  onSelect,
  placeholder,
}: {
  slotIndex: number;
  onSelect: (player: SearchResult) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/players/all?q=${encodeURIComponent(q)}&limit=5`,
      );
      const data = await res.json();
      setResults(
        (data.players ?? []).map(
          (p: Record<string, unknown>) => ({
            person_id: p.person_id as number,
            name: p.name as string,
            position: p.position as string | null,
            club: p.club as string | null,
          }),
        ),
      );
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                   px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                   focus:outline-none focus:ring-1 focus:ring-[var(--border-subtle)]"
        style={{ borderLeftColor: PLAYER_COLORS[slotIndex], borderLeftWidth: 3 }}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
          ...
        </div>
      )}
      {open && results.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--border-subtle)]
                     bg-[var(--bg-surface)] shadow-lg overflow-hidden"
        >
          {results.map((r) => (
            <li key={r.person_id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors
                           flex items-center gap-2"
                onClick={() => {
                  onSelect(r);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                {r.position && (
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${POSITION_COLORS[r.position] ?? "bg-gray-600/60"}`}
                  >
                    {r.position}
                  </span>
                )}
                <span className="text-[var(--text-primary)] font-medium">
                  {r.name}
                </span>
                {r.club && (
                  <span className="text-[var(--text-muted)] text-xs ml-auto truncate max-w-[120px]">
                    {r.club}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ────────────────────────── Stat Bar ────────────────────────── */

function StatBar({
  label,
  values,
  maxVal = 100,
  color,
}: {
  label: string;
  values: (number | null)[];
  maxVal?: number;
  color?: string;
}) {
  const win = winner(values);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)] font-medium">{label}</span>
      </div>
      <div className="flex gap-2 items-center">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex items-center gap-1.5">
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(((v ?? 0) / maxVal) * 100, 100)}%`,
                  backgroundColor: PLAYER_COLORS[i],
                  opacity: win === null || win === i ? 1 : 0.4,
                }}
              />
            </div>
            <span
              className="text-xs font-mono w-7 text-right"
              style={{
                color: win === i ? PLAYER_COLORS[i] : "var(--text-muted)",
                fontWeight: win === i ? 700 : 400,
              }}
            >
              {v ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── Verdict Chip ────────────────────────── */

function VerdictChip({
  label,
  values,
}: {
  label: string;
  values: (number | null)[];
}) {
  const win = winner(values);
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border border-[var(--border-subtle)]
                 bg-[var(--bg-surface)]"
    >
      <span className="text-[var(--text-muted)]">{label}</span>
      {win !== null ? (
        <span className="font-bold" style={{ color: PLAYER_COLORS[win] }}>
          P{win + 1}
        </span>
      ) : (
        <span className="text-[var(--text-muted)] font-medium">Draw</span>
      )}
    </div>
  );
}

/* ────────────────────────── Main Page ────────────────────────── */

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [players, setPlayers] = useState<ComparePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotCount, setSlotCount] = useState(2);

  // Parse URL ids on mount
  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      if (ids.length >= 2) {
        setSelectedIds(ids.slice(0, 3));
        setSlotCount(Math.max(2, ids.length));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch comparison data when selectedIds change
  useEffect(() => {
    if (selectedIds.length < 2) {
      setPlayers([]);
      return;
    }

    const idsStr = selectedIds.join(",");

    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set("ids", idsStr);
    router.replace(url.pathname + url.search, { scroll: false });

    // Fetch
    setLoading(true);
    fetch(`/api/players/compare?ids=${idsStr}`)
      .then((res) => res.json())
      .then((data) => {
        setPlayers(data.players ?? []);
      })
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  }, [selectedIds, router]);

  function handleSelect(slotIndex: number, result: SearchResult) {
    setSelectedIds((prev) => {
      const next = [...prev];
      // If this slot already has a player, replace it
      if (slotIndex < next.length) {
        next[slotIndex] = result.person_id;
      } else {
        next.push(result.person_id);
      }
      return next;
    });
  }

  function removeSlot(index: number) {
    setSelectedIds((prev) => prev.filter((_, i) => i !== index));
  }

  function addSlot() {
    if (slotCount < 3) setSlotCount(3);
  }

  // Radar data: all 13 models as axes
  const radarLabels = ALL_MODELS.map((m) => MODEL_SHORT[m] ?? m.slice(0, 3));
  const radarLayers = players.map((p, i) => ({
    values: ALL_MODELS.map((m) => p.modelScores[m] ?? 0),
    color: PLAYER_COLORS[i],
    fillOpacity: 0.12,
    strokeWidth: 2,
  }));

  const hasComparison = players.length >= 2;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Page header */}
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        Compare Players
      </h1>

      {/* ── Player Picker ─────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {Array.from({ length: slotCount }).map((_, i) => {
          const player = players.find(
            (p) => p.person_id === selectedIds[i],
          );
          return (
            <div
              key={i}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                         p-3 space-y-2"
              style={{ borderTopColor: PLAYER_COLORS[i], borderTopWidth: 3 }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: PLAYER_COLORS[i] }}
                >
                  Player {i + 1}
                </span>
                {selectedIds[i] != null && (
                  <button
                    type="button"
                    onClick={() => removeSlot(i)}
                    className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]
                               text-xs transition-colors"
                    title="Remove player"
                  >
                    Clear
                  </button>
                )}
              </div>
              {player ? (
                <div className="flex items-center gap-2 text-sm">
                  {player.position && (
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${POSITION_COLORS[player.position] ?? "bg-gray-600/60"}`}
                    >
                      {player.position}
                    </span>
                  )}
                  <span className="text-[var(--text-primary)] font-medium truncate">
                    {player.name}
                  </span>
                </div>
              ) : null}
              <PlayerSearch
                slotIndex={i}
                onSelect={(r) => handleSelect(i, r)}
                placeholder={player ? "Replace..." : "Search player..."}
              />
            </div>
          );
        })}

        {slotCount < 3 && (
          <button
            type="button"
            onClick={addSlot}
            className="rounded-xl border border-dashed border-[var(--border-subtle)]
                       p-3 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]
                       hover:border-[var(--text-muted)] transition-colors flex items-center
                       justify-center gap-1 min-h-[88px]"
          >
            + Add 3rd player
          </button>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          Loading comparison...
        </div>
      )}

      {/* ── Comparison View ───────────────────────────────────── */}
      {hasComparison && !loading && (
        <div className="space-y-6">
          {/* Header Row */}
          <div
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                       p-4 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-[var(--text-muted)] font-normal w-24" />
                  {players.map((p, i) => (
                    <th
                      key={p.person_id}
                      className="text-left font-bold px-2"
                      style={{ color: PLAYER_COLORS[i] }}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Position</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1">
                      {p.position && (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${POSITION_COLORS[p.position] ?? "bg-gray-600/60"}`}
                        >
                          {p.position}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Club</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1">
                      {p.club ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Age</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1">
                      {p.age ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Nation</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1">
                      {p.nation ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Height</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1">
                      {p.height_cm ? `${p.height_cm}cm` : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Foot</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1 capitalize">
                      {p.preferred_foot ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Overall</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1 font-bold">
                      {p.overall ?? p.level ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Archetype</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1">
                      {p.archetype ?? "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Radar Overlay */}
          <div
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                       p-4"
          >
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Model Radar
            </h2>
            <div className="flex justify-center">
              <RadarChart
                labels={radarLabels}
                tooltips={ALL_MODELS}
                layers={radarLayers}
                size={320}
              />
            </div>
            {/* Legend */}
            <div className="flex justify-center gap-4 mt-3">
              {players.map((p, i) => (
                <div key={p.person_id} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: PLAYER_COLORS[i] }}
                  />
                  <span className="text-[var(--text-secondary)]">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Four Pillar Stats */}
          <div
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                       p-4 space-y-4"
          >
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Four Pillars
            </h2>
            {(
              Object.entries(PILLAR_CONFIG) as [
                string,
                { models: readonly string[]; color: string },
              ][]
            ).map(([pillar, config]) => (
              <StatBar
                key={pillar}
                label={pillar}
                values={players.map((p) =>
                  pillarScore(p.modelScores, config.models),
                )}
                color={config.color}
              />
            ))}
          </div>

          {/* Individual Model Scores */}
          <div
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                       p-4 space-y-3"
          >
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              All 13 Models
            </h2>
            {ALL_MODELS.map((model) => (
              <StatBar
                key={model}
                label={`${MODEL_SHORT[model]} — ${model}`}
                values={players.map((p) => p.modelScores[model] ?? null)}
              />
            ))}
          </div>

          {/* Role Comparison */}
          <div
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                       p-4"
          >
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Top Roles
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((p, i) => (
                <div key={p.person_id} className="space-y-2">
                  <div
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: PLAYER_COLORS[i] }}
                  >
                    {p.name}
                  </div>
                  {p.topRoles.length > 0 ? (
                    p.topRoles.map((role, ri) => (
                      <div
                        key={role.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-[var(--text-secondary)]">
                          {ri + 1}. {role.name}
                        </span>
                        <span
                          className="font-mono text-xs font-bold"
                          style={{ color: PLAYER_COLORS[i] }}
                        >
                          {role.score}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">
                      No roles data
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                       p-4"
          >
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Personality
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((p, i) => {
                const pt = p.personality_type
                  ? PERSONALITY_TYPES[p.personality_type]
                  : null;
                return (
                  <div key={p.person_id} className="space-y-1">
                    <div
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: PLAYER_COLORS[i] }}
                    >
                      {p.name}
                    </div>
                    {pt ? (
                      <>
                        <div className="text-sm text-[var(--text-primary)] font-medium">
                          {pt.fullName}{" "}
                          <span className="text-[var(--text-muted)] font-mono text-xs">
                            ({pt.code})
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                          {pt.oneLiner}
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-xs text-[var(--text-secondary)]">
                          {p.competitiveness != null && (
                            <span>Competitiveness: {p.competitiveness}/10</span>
                          )}
                          {p.coachability != null && (
                            <span>Coachability: {p.coachability}/10</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">
                        No personality data
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Market */}
          <div
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                       p-4"
          >
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Market Valuation
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-[var(--text-muted)] font-normal w-36" />
                  {players.map((p, i) => (
                    <th
                      key={p.person_id}
                      className="text-left font-bold px-2"
                      style={{ color: PLAYER_COLORS[i] }}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <tr>
                  <td className="text-[var(--text-muted)] py-1">CS Valuation</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1 font-medium">
                      {formatMeur(p.director_valuation_meur)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-[var(--text-muted)] py-1">Market Value</td>
                  {players.map((p) => (
                    <td key={p.person_id} className="px-2 py-1">
                      {formatEur(p.market_value_eur)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Verdict Row */}
          <div
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
                       p-4"
          >
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Verdict
            </h2>
            <div className="flex flex-wrap gap-2">
              <VerdictChip
                label="Overall"
                values={players.map(
                  (p) => p.overall ?? p.level ?? null,
                )}
              />
              {(
                Object.entries(PILLAR_CONFIG) as [
                  string,
                  { models: readonly string[]; color: string },
                ][]
              ).map(([pillar, config]) => (
                <VerdictChip
                  key={pillar}
                  label={pillar}
                  values={players.map((p) =>
                    pillarScore(p.modelScores, config.models),
                  )}
                />
              ))}
              <VerdictChip
                label="Best Role"
                values={players.map((p) => p.best_role_score ?? null)}
              />
              <VerdictChip
                label="CS Value"
                values={players.map(
                  (p) => p.director_valuation_meur ?? null,
                )}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!hasComparison && !loading && (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">
          Search and select at least 2 players to compare.
        </div>
      )}
    </div>
  );
}
