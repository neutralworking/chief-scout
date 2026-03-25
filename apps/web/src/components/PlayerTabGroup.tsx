"use client";

import { useState, type ReactNode } from "react";

interface Tab {
  label: string;
  content: ReactNode;
}

export function PlayerTabGroup({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);

  if (tabs.length === 0) return null;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Tab strip */}
      <div className="flex gap-0.5 border-b border-[var(--border-subtle)] shrink-0">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              i === active
                ? "text-[var(--text-primary)] border-b-2 border-[var(--color-accent-tactical)] -mb-px"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-2">
        {tabs[active].content}
      </div>
    </div>
  );
}
