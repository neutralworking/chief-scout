import React from "react";

type PipColor = "tactical" | "technical" | "mental" | "physical" | "personality" | "cyan";

const PIP_COLORS: Record<PipColor, string> = {
  tactical: "bg-[var(--color-accent-tactical)] shadow-[0_0_6px_var(--color-accent-tactical)]",
  technical: "bg-[var(--color-accent-technical)] shadow-[0_0_6px_var(--color-accent-technical)]",
  mental: "bg-[var(--color-accent-mental)] shadow-[0_0_6px_var(--color-accent-mental)]",
  physical: "bg-[var(--color-accent-physical)] shadow-[0_0_6px_var(--color-accent-physical)]",
  personality: "bg-[var(--color-accent-personality)] shadow-[0_0_6px_var(--color-accent-personality)]",
  cyan: "bg-[var(--border-bright)] shadow-[0_0_6px_var(--border-bright)]",
};

const TEXT_COLORS: Record<PipColor, string> = {
  tactical: "text-[var(--color-accent-tactical)]",
  technical: "text-[var(--color-accent-technical)]",
  mental: "text-[var(--color-accent-mental)]",
  physical: "text-[var(--color-accent-physical)]",
  personality: "text-[var(--color-accent-personality)]",
  cyan: "text-[var(--text-secondary)]",
};

interface SectionHeaderProps {
  label: string;
  color: PipColor;
  action?: React.ReactNode;
}

export function SectionHeader({ label, color, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className={`section-pip ${PIP_COLORS[color]}`} />
        <span className={`text-[9px] font-bold uppercase tracking-[2px] ${TEXT_COLORS[color]}`}>
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}
