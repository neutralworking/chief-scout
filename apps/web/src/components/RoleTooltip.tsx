"use client";

import { useState, useRef, useEffect } from "react";
import { getRoleDefinition } from "@/lib/role-definitions";

interface Props {
  roleName: string | null;
  roleScore?: number | null;
  position?: string | null;
  /** "card" = compact inline (PlayerCard), "badge" = larger badge (player detail) */
  variant?: "card" | "badge";
}

export function RoleTooltip({ roleName, roleScore, position, variant = "card" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!roleName) return null;

  const role = getRoleDefinition(roleName, position);

  if (variant === "badge") {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
          className="px-2.5 py-1 rounded-lg border border-[var(--color-accent-tactical)]/30 bg-[var(--color-accent-tactical)]/10 text-center cursor-pointer hover:border-[var(--color-accent-tactical)]/60 active:scale-95 transition-all"
        >
          {roleScore != null && (
            <span className="text-lg font-mono font-bold text-[var(--color-accent-tactical)] mr-1">{roleScore}</span>
          )}
          <span className="text-sm font-bold text-[var(--color-accent-tactical)]">{roleName}</span>
        </button>
        {open && role && (
          <Popover role={role} onClose={() => setOpen(false)} />
        )}
      </div>
    );
  }

  // card variant — inline text
  return (
    <span className="relative" ref={ref}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="text-[var(--color-accent-tactical)] font-medium cursor-pointer hover:underline decoration-dotted underline-offset-2"
      >
        {roleScore != null && (
          <span className="font-mono font-bold text-sm mr-1 leading-none align-baseline">{roleScore}</span>
        )}
        {roleName}
      </button>
      {open && role && (
        <Popover role={role} onClose={() => setOpen(false)} />
      )}
    </span>
  );
}

function Popover({ role, onClose }: { role: { name: string; position: string; description: string; examples: string }; onClose: () => void }) {
  return (
    <div
      className="absolute z-50 left-0 top-full mt-1 w-[260px] glass p-3 shadow-2xl border border-[var(--color-accent-tactical)]/30 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-[var(--color-accent-tactical)]">{role.name}</span>
        <span className="text-[9px] font-mono text-[var(--text-muted)]">{role.position}</span>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-2">
        {role.description}
      </p>
      <p className="text-[10px] text-[var(--text-muted)]">
        <span className="text-[var(--text-secondary)] font-medium">Think:</span> {role.examples}
      </p>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
        className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xs leading-none"
      >
        &times;
      </button>
    </div>
  );
}
