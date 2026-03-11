"use client";

import { useState, useEffect, useRef } from "react";

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
}

type Phase = "pitch" | "picking" | "complete";

const POSITION_COORDS: Record<number, { top: string; left: string }> = {
  1:  { top: "82%", left: "50%" },  // GK
  2:  { top: "65%", left: "85%" },  // RB
  3:  { top: "65%", left: "62%" },  // CB
  4:  { top: "65%", left: "38%" },  // CB
  5:  { top: "65%", left: "15%" },  // LB
  6:  { top: "42%", left: "70%" },  // CM
  7:  { top: "42%", left: "50%" },  // CM
  8:  { top: "42%", left: "30%" },  // CM
  9:  { top: "18%", left: "80%" },  // RW
  10: { top: "18%", left: "50%" },  // ST
  11: { top: "18%", left: "20%" },  // LW
};

function getUserId(): string {
  if (typeof window === "undefined") return "";
  let uid = localStorage.getItem("fc_user_id");
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem("fc_user_id", uid);
  }
  return uid;
}

export function AllTimeXI() {
  const [phase, setPhase] = useState<Phase>("pitch");
  const [positions, setPositions] = useState<SquadPosition[]>([]);
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [slotStats, setSlotStats] = useState<PickStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const timerRef = useRef(0);
  const userId = useRef("");

  useEffect(() => {
    userId.current = getUserId();
    loadSquad();
  }, []);

  async function loadSquad() {
    try {
      const res = await fetch(`/api/choices/squad?user_id=${userId.current}&template=classic-433`);
      const data = await res.json();
      if (data.template?.positions) {
        setPositions(data.template.positions);
      }
      if (data.picks?.length) {
        const pickMap: Record<number, Pick> = {};
        for (const p of data.picks) {
          pickMap[p.slot] = { slot: p.slot, player_name: p.player_name, person_id: p.person_id };
        }
        setPicks(pickMap);
        if (Object.keys(pickMap).length >= 11) {
          setPhase("complete");
        }
      }
    } catch (err) {
      console.error("Failed to load squad:", err);
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

    // Optimistic update
    const pick: Pick = {
      slot: activeSlot,
      player_name: candidate.player_name,
      person_id: candidate.person_id,
    };
    setPicks((prev) => ({ ...prev, [activeSlot]: pick }));
    setShowStats(true);

    try {
      const res = await fetch("/api/choices/squad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId.current,
          template_slug: "classic-433",
          slot: activeSlot,
          player_name: candidate.player_name,
          person_id: candidate.person_id,
          time_ms: timeMs,
        }),
      });
      const data = await res.json();
      if (data.slot_stats) {
        setSlotStats(data.slot_stats);
      }
      if (data.completed) {
        // Don't switch immediately — let user see stats first
      }
    } catch (err) {
      console.error("Failed to save pick:", err);
    }
  }

  function goBackToPitch() {
    setPhase(Object.keys(picks).length >= 11 ? "complete" : "pitch");
    setActiveSlot(null);
    setShowStats(false);
  }

  function nextSlot() {
    const filled = new Set(Object.keys(picks).map(Number));
    for (let s = 1; s <= 11; s++) {
      if (!filled.has(s)) {
        openSlotPicker(s);
        return;
      }
    }
    setPhase("complete");
    setActiveSlot(null);
  }

  const filledCount = Object.keys(picks).length;
  const posLabel = positions.find((p) => p.slot === activeSlot)?.label ?? "";

  // ── Pitch View ──────────────────────────────────────────────────────────
  if (phase === "pitch" || phase === "complete") {
    return (
      <div>
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold">Your All-Time XI</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {filledCount}/11 positions filled
            {phase === "complete" && " — Squad complete!"}
          </p>
        </div>

        {/* Pitch */}
        <div className="relative w-full max-w-lg mx-auto aspect-[3/4] bg-gradient-to-b from-emerald-900/40 to-emerald-800/20 rounded-2xl border border-emerald-700/30 overflow-hidden">
          {/* Pitch markings */}
          <div className="absolute inset-x-4 top-[50%] h-px bg-white/10" />
          <div className="absolute left-1/2 top-[50%] w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
          <div className="absolute inset-x-[20%] top-[70%] bottom-0 border border-white/5 rounded-t-none" />
          <div className="absolute inset-x-[30%] top-[85%] bottom-0 border border-white/5 rounded-t-none" />
          <div className="absolute inset-x-[20%] top-0 h-[30%] border border-white/5 rounded-b-none" />

          {/* Position dots */}
          {positions.map((pos) => {
            const coords = POSITION_COORDS[pos.slot];
            if (!coords) return null;
            const pick = picks[pos.slot];
            const isEmpty = !pick;

            return (
              <button
                key={pos.slot}
                onClick={() => openSlotPicker(pos.slot)}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={{ top: coords.top, left: coords.left }}
              >
                {isEmpty ? (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center hover:border-[var(--accent-tactical)] hover:bg-[var(--accent-tactical)]/10 transition-all">
                    <span className="text-[9px] text-white/40 font-medium group-hover:text-[var(--accent-tactical)]">
                      {pos.label.split(" ").map((w) => w[0]).join("")}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--accent-tactical)] flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-lg shadow-[var(--accent-tactical)]/30 hover:scale-110 transition-transform">
                      {pick.player_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="text-[8px] sm:text-[9px] text-white/80 font-medium mt-0.5 max-w-16 sm:max-w-20 truncate text-center">
                      {pick.player_name.split(" ").pop()}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex justify-center gap-3">
          {filledCount < 11 ? (
            <button
              onClick={nextSlot}
              className="px-6 py-3 bg-[var(--accent-tactical)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Pick next position →
            </button>
          ) : (
            <div className="text-center">
              <div className="text-sm text-[var(--accent-tactical)] font-semibold mb-2">
                Squad complete!
              </div>
              <button
                onClick={() => {
                  setPicks({});
                  setPhase("pitch");
                }}
                className="px-4 py-2 text-xs text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-lg hover:text-[var(--text-secondary)] transition-colors"
              >
                Start over
              </button>
            </div>
          )}
        </div>

        {/* Squad list */}
        {filledCount > 0 && (
          <div className="mt-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Squad</span>
            </div>
            {positions.map((pos) => {
              const pick = picks[pos.slot];
              return (
                <button
                  key={pos.slot}
                  onClick={() => openSlotPicker(pos.slot)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-elevated)]/50 transition-colors border-b border-[var(--border-subtle)] last:border-0"
                >
                  <span className="text-[10px] font-bold text-[var(--text-muted)] w-5 text-right">{pos.slot}</span>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider w-8">{pos.group}</span>
                  {pick ? (
                    <span className="text-sm font-medium">{pick.player_name}</span>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)] italic">{pos.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Picking View ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goBackToPitch}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          ← Pitch
        </button>
        <span className="text-xs text-[var(--text-muted)] font-mono">{filledCount}/11</span>
      </div>

      <div className="text-center mb-6">
        <div className="text-xs text-[var(--accent-tactical)] font-semibold uppercase tracking-wider mb-1">
          Pick your
        </div>
        <h2 className="text-xl sm:text-2xl font-bold">{posLabel}</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Who makes your All-Time XI?
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Candidates grid */}
          <div className="grid grid-cols-2 gap-3">
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
                  className={`
                    relative overflow-hidden rounded-xl border-2 transition-all duration-300 text-left
                    ${showStats ? "cursor-default" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"}
                    ${isChosen ? "border-[var(--accent-tactical)] ring-2 ring-[var(--accent-tactical)]/30" : "border-[var(--border-subtle)]"}
                    bg-[var(--bg-surface)]
                  `}
                >
                  {/* Player image or initials */}
                  <div className="aspect-[3/4] bg-[var(--bg-elevated)] flex items-center justify-center relative">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.player_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-3xl font-bold text-[var(--text-muted)]">
                        {c.player_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                    )}

                    {/* Era badge */}
                    {c.era && (
                      <span className={`absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        c.era === "legend" ? "bg-amber-500/20 text-amber-400" :
                        c.era === "classic" ? "bg-blue-500/20 text-blue-400" :
                        "bg-green-500/20 text-green-400"
                      }`}>
                        {c.era}
                      </span>
                    )}

                    {/* Stats overlay */}
                    {showStats && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-center pb-3 animate-fadeIn">
                        <span className={`text-2xl font-bold font-mono ${isChosen ? "text-[var(--accent-tactical)]" : "text-white"}`}>
                          {pct}%
                        </span>
                      </div>
                    )}

                    {/* Chosen tick */}
                    {isChosen && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--accent-tactical)] rounded-full flex items-center justify-center animate-fadeIn">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Name + subtitle */}
                  <div className="p-3">
                    <div className="font-semibold text-sm truncate">{c.player_name}</div>
                    {c.subtitle && (
                      <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{c.subtitle}</div>
                    )}
                  </div>

                  {/* Vote bar */}
                  {showStats && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--bg-elevated)]">
                      <div
                        className={`h-full transition-all duration-700 ${isChosen ? "bg-[var(--accent-tactical)]" : "bg-[var(--text-muted)]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Next button after picking */}
          {showStats && (
            <div className="mt-6 text-center animate-fadeIn">
              <button
                onClick={nextSlot}
                className="px-8 py-3 bg-[var(--accent-tactical)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {filledCount >= 11 ? "View your XI →" : "Next position →"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
