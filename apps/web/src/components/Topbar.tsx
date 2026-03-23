interface TopbarProps {
  playerCount?: number;
  tier1Count?: number;
}

export function Topbar({ playerCount, tier1Count }: TopbarProps) {
  return (
    <div className="h-[34px] bg-[var(--bg-surface-dark,#141414)] border-b border-[var(--border-panel)] flex items-center justify-between px-4 shrink-0">
      <span className="font-mono text-[11px] font-bold tracking-[3px] uppercase text-[var(--border-bright)]">
        Chief Scout
      </span>
      <div className="flex gap-4 items-center text-[11px] text-[var(--text-muted)] font-mono">
        {playerCount != null && <span>{playerCount.toLocaleString()} Players</span>}
        {tier1Count != null && <span>{tier1Count} Scouted</span>}
      </div>
    </div>
  );
}
