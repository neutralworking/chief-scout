"use client";

import { useState, useEffect, useRef } from "react";
import { RoleTooltip } from "@/components/RoleTooltip";

// Pipeline-computed roles (from 27_player_ratings.py TACTICAL_ROLES)
// These are the roles the pipeline will assign — keep in sync!
const TACTICAL_ROLES = [
  "",
  // GK
  "Libero GK", "Sweeper Keeper", "Comandante", "Shotstopper",
  // CD
  "Libero", "Stopper", "Sweeper", "Zagueiro",
  // WD
  "Lateral", "Fluidificante", "Invertido", "Corredor",
  // DM
  "Regista", "Sentinelle", "Pivote", "Volante",
  // CM
  "Mezzala", "Tuttocampista", "Metodista", "Relayeur",
  // WM
  "Winger", "Tornante", "False Winger", "Shuttler",
  // AM
  "Trequartista", "Seconda Punta", "Enganche", "Boxcrasher",
  // WF
  "Inside Forward", "Raumdeuter", "Inventor", "Extremo",
  // CF
  "Poacher", "Spearhead", "Falso Nove", "Prima Punta",
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  personId: number;
  bestRole: string | null;
  bestRoleScore: number | null;
  position?: string | null;
}

export function RoleScoreEditor({ personId, bestRole, bestRoleScore, position }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(bestRole ?? "");
  const [score, setScore] = useState(bestRoleScore ?? 50);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("network_admin") === "1");
  }, []);

  // Close on outside tap
  useEffect(() => {
    if (!editing) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editing]);

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/player-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: personId,
          table: "player_profiles",
          updates: {
            best_role: role || null,
            best_role_score: score,
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setStatus("saved");
      setTimeout(() => {
        setStatus("idle");
        setEditing(false);
      }, 800);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  // Non-admin or no role: render clickable role tooltip
  if (!isAdmin) {
    if (!bestRole) return null;
    return (
      <RoleTooltip
        roleName={bestRole}
        roleScore={bestRoleScore}
        position={position}
        variant="badge"
      />
    );
  }

  // Admin — tappable badge
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group px-2.5 py-1 rounded-lg border border-[var(--color-accent-tactical)]/30 bg-[var(--color-accent-tactical)]/10 text-center cursor-pointer hover:border-[var(--color-accent-tactical)]/60 active:scale-95 transition-all relative"
      >
        {bestRole ? (
          <>
            <span className="text-lg font-mono font-bold text-[var(--color-accent-tactical)] mr-1">{score ?? bestRoleScore}</span>
            <span className="text-sm font-bold text-[var(--color-accent-tactical)]">{role || bestRole}</span>
          </>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)]">+ Role</span>
        )}
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--color-accent-tactical)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  // Admin — editing panel
  return (
    <div ref={panelRef} className="relative shrink-0 z-20">
      {/* Editing panel — overlays below the badge area */}
      <div className="absolute right-0 top-0 w-[280px] sm:w-[320px] card p-3 shadow-2xl border border-[var(--color-accent-tactical)]/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent-tactical)]">
            Edit Role
          </span>
          <div className="flex items-center gap-2">
            {status === "saving" && <span className="text-[9px] text-[var(--text-muted)]">Saving...</span>}
            {status === "saved" && <span className="text-[9px] text-emerald-400">Saved!</span>}
            {status === "error" && <span className="text-[9px] text-red-400">Error</span>}
            <button
              onClick={() => setEditing(false)}
              className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Score — large, thumb-friendly slider + number */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">Score</label>
            <span className="text-lg font-mono font-bold text-[var(--color-accent-tactical)]">{score}</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={score}
            onChange={(e) => setScore(parseInt(e.target.value))}
            className="w-full h-8 appearance-none bg-transparent cursor-pointer
              [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full
              [&::-webkit-slider-runnable-track]:bg-[var(--bg-elevated)]
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent-tactical)]
              [&::-webkit-slider-thumb]:-mt-[10px] [&::-webkit-slider-thumb]:shadow-lg
              [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full
              [&::-moz-range-track]:bg-[var(--bg-elevated)]
              [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:h-7
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--color-accent-tactical)]
              [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg"
          />
          {/* Quick-set buttons */}
          <div className="flex gap-1 mt-1">
            {[25, 50, 65, 75, 85, 95].map((v) => (
              <button
                key={v}
                onClick={() => setScore(v)}
                className={`flex-1 py-1 text-[9px] font-mono rounded transition-colors ${
                  score === v
                    ? "bg-[var(--color-accent-tactical)] text-white"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Role dropdown */}
        <div className="mb-3">
          <label className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent-tactical)] transition-colors cursor-pointer"
          >
            <option value="">– None –</option>
            {TACTICAL_ROLES.filter(Boolean).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Save — full-width, fat touch target */}
        <button
          onClick={save}
          disabled={status === "saving"}
          className="w-full py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
        >
          {status === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
