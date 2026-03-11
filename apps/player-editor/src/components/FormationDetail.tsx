"use client";

import { useState } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";

interface FormationSlot {
  formation_id: number;
  position: string;
  slot_count: number;
}

interface TrackedPlayer {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  level: number | null;
  archetype: string | null;
  pursuit_status: string | null;
}

interface FormationDetailProps {
  formation: {
    id: number;
    name: string;
    structure: string | null;
    notes: string | null;
    era: string | null;
  };
  slots: FormationSlot[];
  fit: number;
  playersByPosition: Record<string, TrackedPlayer[]>;
}

// Pitch Y positions for each position (0 = GK end, 100 = striker end)
// X positions center-distributed based on slot count
const POSITION_Y: Record<string, number> = {
  GK: 5,
  CD: 20,
  WD: 22,
  DM: 38,
  CM: 50,
  WM: 52,
  AM: 65,
  WF: 78,
  CF: 90,
};

// Render order (back to front for z-index)
const RENDER_ORDER = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];

function fitColor(fit: number): string {
  if (fit >= 80) return "var(--sentiment-positive)";
  if (fit >= 50) return "var(--accent-personality)";
  return "var(--sentiment-negative)";
}

function distributeX(count: number): number[] {
  if (count === 1) return [50];
  if (count === 2) return [28, 72];
  if (count === 3) return [20, 50, 80];
  if (count === 4) return [15, 38, 62, 85];
  return Array.from({ length: count }, (_, i) => 10 + (80 / (count - 1)) * i);
}

export function FormationDetail({ formation, slots, fit, playersByPosition }: FormationDetailProps) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  // Build position dots for pitch diagram
  const dots: { x: number; y: number; pos: string; isGap: boolean }[] = [];
  for (const slot of slots) {
    const y = POSITION_Y[slot.position] ?? 50;
    const xs = distributeX(slot.slot_count);
    const available = (playersByPosition[slot.position] ?? []).length;
    for (let i = 0; i < slot.slot_count; i++) {
      dots.push({
        x: xs[i],
        y,
        pos: slot.position,
        isGap: available <= i,
      });
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-elevated)]/30 transition-colors cursor-pointer text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Mini pitch */}
        <div className="w-16 h-20 bg-[var(--bg-base)]/50 rounded border border-[var(--border-subtle)] relative shrink-0 overflow-hidden">
          {dots.map((dot, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                left: `${dot.x}%`,
                bottom: `${dot.y}%`,
                transform: "translate(-50%, 50%)",
                backgroundColor: dot.isGap ? "var(--sentiment-negative)" : "var(--text-primary)",
                opacity: dot.isGap ? 0.5 : 0.7,
              }}
            />
          ))}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{formation.name}</span>
            {formation.era && (
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
                {formation.era}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {slots.filter(s => s.position !== "GK").map((slot) => {
              const posColor = POSITION_COLORS[slot.position] ?? "bg-zinc-700/60";
              return (
                <span key={slot.position} className={`text-[8px] font-bold px-1 py-0.5 rounded ${posColor} text-white`}>
                  {slot.position}x{slot.slot_count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Fit score */}
        <div className="text-right shrink-0">
          <div className="text-lg font-mono font-bold" style={{ color: fitColor(fit) }}>
            {fit}%
          </div>
          <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Fit</div>
        </div>

        {/* Expand indicator */}
        <span className={`text-[var(--text-muted)] transition-transform ${expanded ? "rotate-90" : ""}`}>
          &rsaquo;
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pitch visualization */}
            <div className="relative bg-[var(--bg-base)]/30 rounded-lg border border-[var(--border-subtle)] aspect-[3/4] overflow-hidden">
              {/* Pitch lines */}
              <div className="absolute inset-0">
                {/* Center line */}
                <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--border-subtle)]" />
                {/* Center circle */}
                <div className="absolute left-1/2 top-1/2 w-16 h-16 -ml-8 -mt-8 rounded-full border border-[var(--border-subtle)]" />
                {/* Penalty areas */}
                <div className="absolute left-1/4 right-1/4 top-0 h-[15%] border-b border-l border-r border-[var(--border-subtle)]" />
                <div className="absolute left-1/4 right-1/4 bottom-0 h-[15%] border-t border-l border-r border-[var(--border-subtle)]" />
              </div>
              {/* Position dots */}
              {dots.map((dot, i) => (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${dot.x}%`,
                    bottom: `${dot.y}%`,
                    transform: "translate(-50%, 50%)",
                  }}
                >
                  <div
                    className={`w-3 h-3 rounded-full border ${dot.isGap ? "border-[var(--sentiment-negative)] bg-[var(--sentiment-negative)]/20" : "border-[var(--text-primary)]/50 bg-[var(--text-primary)]/30"}`}
                  />
                  <span className="text-[7px] font-bold text-[var(--text-muted)] mt-0.5">{dot.pos}</span>
                </div>
              ))}
            </div>

            {/* Slot mapping */}
            <div>
              <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
                Slot Mapping
              </h3>
              <div className="space-y-3">
                {RENDER_ORDER.map((pos) => {
                  const slot = slots.find((s) => s.position === pos);
                  if (!slot) return null;
                  const posPlayers = playersByPosition[pos] ?? [];
                  const isGap = posPlayers.length < slot.slot_count;
                  const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
                  return (
                    <div key={pos}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white`}>
                          {pos}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {slot.slot_count} needed
                        </span>
                        {isGap && (
                          <span className="text-[9px] text-[var(--sentiment-negative)] font-medium">
                            gap
                          </span>
                        )}
                      </div>
                      {posPlayers.length > 0 ? (
                        <div className="ml-6 space-y-0.5">
                          {posPlayers.slice(0, slot.slot_count + 1).map((p) => (
                            <Link
                              key={p.person_id}
                              href={`/players/${p.person_id}`}
                              className="flex items-center gap-2 text-xs hover:text-[var(--text-primary)] transition-colors group"
                            >
                              <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                                {p.name}
                              </span>
                              {p.level != null && (
                                <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.level}</span>
                              )}
                              {p.club && (
                                <span className="text-[10px] text-[var(--text-muted)]">{p.club}</span>
                              )}
                            </Link>
                          ))}
                          {posPlayers.length > slot.slot_count + 1 && (
                            <span className="text-[10px] text-[var(--text-muted)]">
                              +{posPlayers.length - slot.slot_count - 1} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="ml-6 text-[10px] text-[var(--sentiment-negative)]">
                          No tracked players
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tactical notes */}
          {formation.notes && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <button
                className="text-[10px] text-[var(--accent-personality)] hover:underline cursor-pointer"
                onClick={() => setShowNotes(!showNotes)}
              >
                {showNotes ? "Hide" : "Show"} tactical notes
              </button>
              {showNotes && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2 max-h-48 overflow-y-auto whitespace-pre-line">
                  {formation.notes.slice(0, 1000)}
                  {(formation.notes.length > 1000) && "..."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
