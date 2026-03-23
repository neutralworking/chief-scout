import React from "react";

type PipColor = "tactical" | "technical" | "mental" | "physical" | "personality" | "cyan";

const TEXT_COLORS: Record<PipColor, string> = {
  tactical: "text-[var(--color-accent-tactical)]",
  technical: "text-[var(--color-accent-technical)]",
  mental: "text-[var(--color-accent-mental)]",
  physical: "text-[var(--color-accent-physical)]",
  personality: "text-[var(--color-accent-personality)]",
  cyan: "text-[var(--text-secondary)]",
};

const DOT_COLORS: Record<PipColor, string> = {
  tactical: "bg-[var(--color-accent-tactical)]",
  technical: "bg-[var(--color-accent-technical)]",
  mental: "bg-[var(--color-accent-mental)]",
  physical: "bg-[var(--color-accent-physical)]",
  personality: "bg-[var(--color-accent-personality)]",
  cyan: "bg-[var(--text-muted)]",
};

interface SectionHeaderProps {
  label: string;
  color: PipColor;
  action?: React.ReactNode;
}

export function SectionHeader({ label, color, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[color]}`} />
        <span className={`text-[11px] font-bold uppercase tracking-[1.5px] font-[family-name:var(--font-display)] ${TEXT_COLORS[color]}`}>
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}
