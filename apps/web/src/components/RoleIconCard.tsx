"use client";

import { useEffect, useCallback } from "react";
import { POSITION_COLORS } from "@/lib/types";
import type { RoleIcon } from "@/lib/role-icons";

interface RoleIconCardProps {
  icon: RoleIcon;
  onClose: () => void;
}

export function RoleIconCard({ icon, onClose }: RoleIconCardProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const posColor = POSITION_COLORS[icon.position] ?? "bg-zinc-700/60";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — score + player name */}
        <div className="relative px-5 pt-5 pb-4 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Position + Role */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white`}
                >
                  {icon.position}
                </span>
                <span className="text-xs font-semibold text-[var(--color-accent-tactical)]">
                  {icon.role}
                </span>
                {icon.culturalName && (
                  <span className="text-[10px] italic text-[var(--text-muted)]">
                    {icon.culturalName}
                    {icon.origin && (
                      <span className="ml-1 text-[var(--text-muted)]/50">
                        ({icon.origin})
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Player name */}
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                {icon.iconPlayer}
              </h2>

              {/* Meta line */}
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-muted)]">
                <span>{icon.nationality}</span>
                <span className="opacity-30">|</span>
                <span>{icon.peakClub}</span>
                <span className="opacity-30">|</span>
                <span>{icon.peakEra}</span>
              </div>
            </div>

            {/* Peak Score */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-14 h-14 rounded-lg bg-[var(--color-accent-tactical)]/15 border border-[var(--color-accent-tactical)]/30 flex items-center justify-center">
                <span className="text-2xl font-black font-mono text-[var(--color-accent-tactical)]">
                  {icon.peakScore}
                </span>
              </div>
              <span className="text-[8px] uppercase tracking-widest text-[var(--text-muted)] mt-1">
                Peak
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Formation badge */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
              Formation
            </span>
            <span className="text-xs font-mono font-semibold text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded">
              {icon.peakFormation}
            </span>
          </div>

          {/* Snapshot */}
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {icon.snapshot}
          </p>

          {/* Key Traits */}
          <div>
            <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] block mb-2">
              Defining Traits
            </span>
            <div className="flex flex-wrap gap-1.5">
              {icon.keyTraits.map((trait) => (
                <span
                  key={trait}
                  className="text-[10px] font-medium px-2 py-1 rounded-full bg-[var(--color-accent-tactical)]/10 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/20"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/30 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
            Role Icon — All-Time Peak
          </span>
          <button
            onClick={onClose}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            ESC to close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline role icon badge — shows a small crown/star icon next to a role name.
 * Clicking it opens the RoleIconCard modal.
 */
export function RoleIconBadge({
  roleName,
  iconPlayer,
  peakScore,
  onClick,
}: {
  roleName: string;
  iconPlayer: string;
  peakScore: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 text-[9px] text-[var(--color-accent-tactical)]/70 hover:text-[var(--color-accent-tactical)] transition-colors cursor-pointer group"
      title={`${roleName} Icon: ${iconPlayer} (${peakScore})`}
    >
      <span className="opacity-60 group-hover:opacity-100 transition-opacity">
        &#9733;
      </span>
      <span className="font-medium">{iconPlayer}</span>
      <span className="font-mono opacity-60">{peakScore}</span>
    </button>
  );
}
