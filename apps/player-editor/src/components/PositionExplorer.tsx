import Link from "next/link";
import { POSITIONS, POSITION_COLORS } from "@/lib/types";

interface PositionExplorerProps {
  positionCounts: Record<string, number>;
}

const POSITION_FULL_NAMES: Record<string, string> = {
  GK: "Goalkeeper",
  CD: "Centre-Back",
  WD: "Wing-Back",
  DM: "Defensive Mid",
  CM: "Central Mid",
  WM: "Wide Mid",
  AM: "Attacking Mid",
  WF: "Winger",
  CF: "Centre-Forward",
};

export function PositionExplorer({ positionCounts }: PositionExplorerProps) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Explore by Position
        </h2>
        <Link href="/players" className="text-xs text-[var(--accent-personality)] hover:underline">
          All players &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {POSITIONS.map((pos) => {
          const count = positionCounts[pos] ?? 0;
          const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
          return (
            <Link
              key={pos}
              href={`/players?position=${pos}`}
              className="group text-center p-3 rounded-lg bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <span className={`inline-block text-xs font-bold tracking-wider px-2 py-1 rounded ${posColor} text-white mb-1.5`}>
                {pos}
              </span>
              <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
                {POSITION_FULL_NAMES[pos]}
              </p>
              <p className="text-xs font-mono text-[var(--text-muted)] mt-1">{count}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
