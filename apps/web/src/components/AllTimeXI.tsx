"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

interface SquadPosition {
  slot: number;
  label: string;
  group: string;
}

interface Candidate {
  id: number;
  player_name: string;
  person_id: number | null;
  subtitle: string | null;
  image_url: string | null;
  era: string | null;
}

interface PickStat {
  player_name: string;
  pick_count: number;
}

interface Pick {
  slot: number;
  player_name: string;
  person_id: number | null;
  era?: string | null;
  subtitle?: string | null;
}

type Phase = "pitch" | "picking";

const FORMATIONS: { slug: string; label: string; coords: Record<number, { top: string; left: string }> }[] = [
  {
    slug: "classic-433",
    label: "4-3-3",
    coords: {
      1:  { top: "82%", left: "50%" },
      2:  { top: "65%", left: "85%" },
      3:  { top: "65%", left: "62%" },
      4:  { top: "65%", left: "38%" },
      5:  { top: "65%", left: "15%" },
      6:  { top: "42%", left: "70%" },
      7:  { top: "42%", left: "50%" },
      8:  { top: "42%", left: "30%" },
      9:  { top: "18%", left: "80%" },
      10: { top: "18%", left: "50%" },
      11: { top: "18%", left: "20%" },
    },
  },
  {
    slug: "classic-442",
    label: "4-4-2",
    coords: {
      1:  { top: "82%", left: "50%" },
      2:  { top: "65%", left: "85%" },
      3:  { top: "65%", left: "62%" },
      4:  { top: "65%", left: "38%" },
      5:  { top: "65%", left: "15%" },
      6:  { top: "42%", left: "85%" },
      7:  { top: "42%", left: "62%" },
      8:  { top: "42%", left: "38%" },
      9:  { top: "42%", left: "15%" },
      10: { top: "18%", left: "62%" },
      11: { top: "18%", left: "38%" },
    },
  },
  {
    slug: "classic-352",
    label: "3-5-2",
    coords: {
      1:  { top: "82%", left: "50%" },
      2:  { top: "65%", left: "72%" },
      3:  { top: "65%", left: "50%" },
      4:  { top: "65%", left: "28%" },
      5:  { top: "42%", left: "90%" },
      6:  { top: "42%", left: "68%" },
      7:  { top: "42%", left: "50%" },
      8:  { top: "42%", left: "32%" },
      9:  { top: "42%", left: "10%" },
      10: { top: "18%", left: "62%" },
      11: { top: "18%", left: "38%" },
    },
  },
  {
    slug: "classic-4231",
    label: "4-2-3-1",
    coords: {
      1:  { top: "82%", left: "50%" },
      2:  { top: "65%", left: "85%" },
      3:  { top: "65%", left: "62%" },
      4:  { top: "65%", left: "38%" },
      5:  { top: "65%", left: "15%" },
      6:  { top: "48%", left: "62%" },
      7:  { top: "48%", left: "38%" },
      8:  { top: "30%", left: "80%" },
      9:  { top: "30%", left: "50%" },
      10: { top: "30%", left: "20%" },
      11: { top: "14%", left: "50%" },
    },
  },
];

const POSITION_COORDS: Record<number, { top: string; left: string }> = {
  1:  { top: "82%", left: "50%" },
  2:  { top: "65%", left: "85%" },
  3:  { top: "65%", left: "62%" },
  4:  { top: "65%", left: "38%" },
  5:  { top: "65%", left: "15%" },
  6:  { top: "42%", left: "70%" },
  7:  { top: "42%", left: "50%" },
  8:  { top: "42%", left: "30%" },
  9:  { top: "18%", left: "80%" },
  10: { top: "18%", left: "50%" },
  11: { top: "18%", left: "20%" },
};

const ERA_LABELS: Record<string, string> = {
  legend: "Pre-1990",
  classic: "1990–2010",
  modern: "2010+",
};

export function AllTimeXI() {
  const { fcUserId } = useAuth();
  const [phase, setPhase] = useState<Phase>("pitch");
  const [formation, setFormation] = useState(FORMATIONS[0]);
  const [positions, setPositions] = useState<SquadPosition[]>([]);
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [slotStats, setSlotStats] = useState<PickStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const timerRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (fcUserId) loadSquad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fcUserId]);

  // Analysis of picks
  const analysis = useMemo(() => {
    const pickList = Object.values(picks);
    if (pickList.length === 0) return null;

    const eras: Record<string, number> = {};
    const leagues: Record<string, number> = {};
    let legendCount = 0;

    for (const p of pickList) {
      const era = p.era ?? "unknown";
      eras[era] = (eras[era] ?? 0) + 1;
      if (era === "legend") legendCount++;

      if (p.subtitle) {
        // subtitle often contains league/era info
        const parts = p.subtitle.split("·").map((s) => s.trim());
        if (parts.length > 0) {
          const league = parts[0];
          leagues[league] = (leagues[league] ?? 0) + 1;
        }
      }
    }

    const total = pickList.length;
    const modernPct = Math.round(((eras["modern"] ?? 0) / total) * 100);
    const classicPct = Math.round(((eras["classic"] ?? 0) / total) * 100);
    const legendPct = Math.round((legendCount / total) * 100);
    const rarityPct = Math.round((legendCount / total) * 40 + (total < 5 ? 20 : 40));

    const topLeague = Object.entries(leagues).sort((a, b) => b[1] - a[1])[0];
    const topLeaguePct = topLeague ? Math.round((topLeague[1] / total) * 100) : 0;

    return { modernPct, classicPct, legendPct, rarityPct, topLeague: topLeague?.[0], topLeaguePct, total };
  }, [picks]);

  async function loadSquad() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await fetch(`/api/choices/squad?user_id=${fcUserId}&template=classic-433`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.template?.positions) setPositions(data.template.positions);
      if (data.picks?.length) {
        const pickMap: Record<number, Pick> = {};
        for (const p of data.picks) {
          pickMap[p.slot] = { slot: p.slot, player_name: p.player_name, person_id: p.person_id, era: p.era, subtitle: p.subtitle };
        }
        setPicks(pickMap);
      }
    } catch (err) {
      console.error("Failed to load squad:", err);
    } finally {
      loadingRef.current = false;
    }
  }

  async function openSlotPicker(slot: number) {
    setActiveSlot(slot);
    setPhase("picking");
    setLoading(true);
    setShowStats(false);

    try {
      const res = await fetch(`/api/choices/candidates?template=classic-433&slot=${slot}`);
      const data = await res.json();
      setCandidates(data.candidates ?? []);
      setSlotStats(data.stats ?? []);
    } catch (err) {
      console.error("Failed to load candidates:", err);
    } finally {
      setLoading(false);
      timerRef.current = Date.now();
    }
  }

  async function makePick(candidate: Candidate) {
    if (!activeSlot) return;
    const timeMs = Date.now() - timerRef.current;

    const pick: Pick = {
      slot: activeSlot,
      player_name: candidate.player_name,
      person_id: candidate.person_id,
      era: candidate.era,
      subtitle: candidate.subtitle,
    };
    setPicks((prev) => ({ ...prev, [activeSlot]: pick }));
    setShowStats(true);

    try {
      const res = await fetch("/api/choices/squad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: fcUserId,
          template_slug: "classic-433",
          slot: activeSlot,
          player_name: candidate.player_name,
          person_id: candidate.person_id,
          time_ms: timeMs,
        }),
      });
      const data = await res.json();
      if (data.slot_stats) setSlotStats(data.slot_stats);
    } catch (err) {
      console.error("Failed to save pick:", err);
    }
  }

  function nextSlot() {
    const filled = new Set(Object.keys(picks).map(Number));
    for (let s = 1; s <= 11; s++) {
      if (!filled.has(s)) {
        openSlotPicker(s);
        return;
      }
    }
    setPhase("pitch");
    setActiveSlot(null);
    setShowStats(false);
  }

  const filledCount = Object.keys(picks).length;
  const posLabel = positions.find((p) => p.slot === activeSlot)?.label ?? "";
  const isComplete = filledCount >= 11;

  // ── Layout: Pitch + Analysis side by side, picking overlays ──────────
  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left: Pitch (always visible) */}
      <div className="flex-1 min-w-0">
        {phase === "picking" ? (
          /* Picking View — compact */
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => { setPhase("pitch"); setActiveSlot(null); setShowStats(false); }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                ← Pitch
              </button>
              <span className="text-xs text-[var(--text-muted)] font-mono">{filledCount}/11</span>
            </div>

            <div className="text-center mb-4">
              <div className="text-[10px] text-[var(--accent-tactical)] font-semibold uppercase tracking-wider">Pick your</div>
              <h2 className="text-lg font-bold">{posLabel}</h2>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-6 h-6 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {candidates.map((c) => {
                    const isChosen = picks[activeSlot!]?.player_name === c.player_name;
                    const stat = slotStats.find((s) => s.player_name === c.player_name);
                    const totalPicks = slotStats.reduce((sum, s) => sum + s.pick_count, 0);
                    const pct = stat && totalPicks > 0 ? Math.round((stat.pick_count / totalPicks) * 100) : 0;

                    return (
                      <button
                        key={c.id}
                        onClick={() => makePick(c)}
                        disabled={showStats}
                        className={`relative overflow-hidden rounded-lg border transition-all text-left
                          ${showStats ? "cursor-default" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"}
                          ${isChosen ? "border-[var(--accent-tactical)] ring-1 ring-[var(--accent-tactical)]/30" : "border-[var(--border-subtle)]"}
                          bg-[var(--bg-surface-solid)]`}
                      >
                        <div className="aspect-[4/3] bg-[var(--bg-elevated)] flex items-center justify-center relative">
                          {c.image_url ? (
                            <img src={c.image_url} alt={c.player_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-2xl font-bold text-[var(--text-muted)]">
                              {c.player_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                          )}
                          {c.era && (
                            <span className={`absolute top-1.5 left-1.5 text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${
                              c.era === "legend" ? "bg-amber-500/20 text-amber-400" :
                              c.era === "classic" ? "bg-blue-500/20 text-blue-400" :
                              "bg-green-500/20 text-green-400"
                            }`}>{c.era}</span>
                          )}
                          {showStats && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-2 animate-fadeIn">
                              <span className={`text-xl font-bold font-mono ${isChosen ? "text-[var(--accent-tactical)]" : "text-white"}`}>{pct}%</span>
                            </div>
                          )}
                          {isChosen && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[var(--accent-tactical)] rounded-full flex items-center justify-center animate-fadeIn">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="font-semibold text-xs truncate">{c.player_name}</div>
                          {c.subtitle && <div className="text-[10px] text-[var(--text-muted)] truncate">{c.subtitle}</div>}
                        </div>
                        {showStats && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--bg-elevated)]">
                            <div className={`h-full transition-all duration-700 ${isChosen ? "bg-[var(--accent-tactical)]" : "bg-[var(--text-muted)]"}`} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {showStats && (
                  <div className="mt-4 text-center animate-fadeIn">
                    <button
                      onClick={nextSlot}
                      className="px-6 py-2.5 bg-[var(--accent-tactical)] text-white rounded-lg text-sm font-semibold hover:opacity-90"
                    >
                      {filledCount >= 11 ? "View your XI →" : "Next position →"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Pitch View — compact */
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">Your All-Time XI</h2>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {filledCount}/11{isComplete ? " — Complete!" : ""}
              </span>
            </div>

            <div className="relative w-full max-w-md mx-auto aspect-[4/5] sm:aspect-[3/4] bg-gradient-to-b from-emerald-900/30 to-emerald-800/15 rounded-xl border border-emerald-700/20 overflow-hidden">
              <div className="absolute inset-x-4 top-[50%] h-px bg-white/8" />
              <div className="absolute left-1/2 top-[50%] w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/8" />
              <div className="absolute inset-x-[20%] top-[70%] bottom-0 border border-white/5" />
              <div className="absolute inset-x-[20%] top-0 h-[30%] border border-white/5" />

              {positions.map((pos) => {
                const coords = formation.coords[pos.slot];
                if (!coords) return null;
                const pick = picks[pos.slot];
                return (
                  <button
                    key={pos.slot}
                    onClick={() => openSlotPicker(pos.slot)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group"
                    style={{ top: coords.top, left: coords.left }}
                  >
                    {!pick ? (
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-dashed border-white/25 flex items-center justify-center hover:border-[var(--accent-tactical)] hover:bg-[var(--accent-tactical)]/10 transition-all">
                        <span className="text-[8px] text-white/35 font-medium group-hover:text-[var(--accent-tactical)]">
                          {pos.label.split(" ").map((w) => w[0]).join("")}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[var(--accent-tactical)] flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shadow-lg shadow-[var(--accent-tactical)]/25 hover:scale-110 transition-transform">
                          {pick.player_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-[7px] sm:text-[8px] text-white/75 font-medium mt-0.5 max-w-14 sm:max-w-18 truncate text-center">
                          {pick.player_name.split(" ").pop()}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Formation selector + actions */}
            <div className="mt-2 sm:mt-3 flex items-center justify-between">
              <div className="flex gap-1">
                {FORMATIONS.map((f) => (
                  <button
                    key={f.slug}
                    onClick={() => setFormation(f)}
                    className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                      formation.slug === f.slug
                        ? "bg-[var(--accent-tactical)]/20 text-[var(--accent-tactical)] ring-1 ring-[var(--accent-tactical)]/30"
                        : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {isComplete && (
                <button
                  onClick={() => { setPicks({}); setPhase("pitch"); }}
                  className="px-3 py-1 text-[10px] text-[var(--text-muted)] border border-[var(--border-subtle)] rounded hover:text-[var(--text-secondary)]"
                >
                  Start over
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Analysis Panel (hidden on mobile in pitch view, always visible on desktop) */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 gap-3" style={{ minHeight: "min(60vw, 500px)" }}>
        {/* Squad List — fills available space */}
        <div className="glass rounded-xl overflow-hidden flex-1 flex flex-col">
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Squad</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {positions.map((pos) => {
              const pick = picks[pos.slot];
              return (
                <button
                  key={pos.slot}
                  onClick={() => openSlotPicker(pos.slot)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--bg-elevated)]/50 transition-colors border-b border-[var(--border-subtle)]/50 last:border-0"
                >
                  <span className="text-[9px] font-bold text-[var(--text-muted)] w-4 text-right">{pos.slot}</span>
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider w-6">{pos.group}</span>
                  {pick ? (
                    <span className="text-xs font-medium truncate flex-1">{pick.player_name}</span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)] italic truncate flex-1">{pos.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Analysis */}
        {analysis && analysis.total > 0 && (
          <div className="glass rounded-xl p-3 space-y-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Analysis</span>

            <div className="space-y-1.5">
              {analysis.modernPct > 0 && (
                <AnalysisStat label="Modern Era" value={`${analysis.modernPct}%`} color="bg-green-500" pct={analysis.modernPct} />
              )}
              {analysis.classicPct > 0 && (
                <AnalysisStat label="Classic Era" value={`${analysis.classicPct}%`} color="bg-blue-500" pct={analysis.classicPct} />
              )}
              {analysis.legendPct > 0 && (
                <AnalysisStat label="Legends" value={`${analysis.legendPct}%`} color="bg-amber-500" pct={analysis.legendPct} />
              )}
              {analysis.topLeague && (
                <AnalysisStat label={analysis.topLeague} value={`${analysis.topLeaguePct}%`} color="bg-purple-500" pct={analysis.topLeaguePct} />
              )}
              <AnalysisStat label="Rarity" value={`${analysis.rarityPct}%`} color="bg-[var(--accent-personality)]" pct={analysis.rarityPct} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisStat({ label, value, color, pct }: { label: string; value: string; color: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-mono font-bold text-[var(--text-primary)]">{value}</span>
      </div>
      <div className="h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} opacity-70`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
