import Link from "next/link";
import { POSITION_COLORS, PURSUIT_COLORS, POSITIONS } from "@/lib/types";
import type { PlayerCard as PlayerCardType } from "@/lib/types";

const PIPELINE_STATUSES = ["Priority", "Interested", "Watch"] as const;

interface PursuitPanelProps {
  pipeline: Record<string, PlayerCardType[]>;
  positionCounts: Record<string, number>;
  stats: {
    total: number;
    fullProfiles: number;
    tracked: number;
    priority: number;
  };
}

export function PursuitPanel({ pipeline, positionCounts, stats }: PursuitPanelProps) {
  const maxDepth = Math.max(...Object.values(positionCounts), 1);

  return (
    <div>
      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Scouting Pipeline
        </span>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Database", value: stats.total.toLocaleString() },
          { label: "Full Profiles", value: stats.fullProfiles.toLocaleString() },
          { label: "Tracked", value: stats.tracked.toString() },
          { label: "Priority", value: stats.priority.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="glass rounded-xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-mono font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Scouting Targets + Position Depth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scouting Targets — 2 cols */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
            Scouting Targets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PIPELINE_STATUSES.map((status) => {
              const players = pipeline[status] ?? [];
              const pursuitColor = PURSUIT_COLORS[status] ?? "";
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded ${pursuitColor}`}>
                      {status}
                    </span>
                    <span className="text-sm font-mono text-[var(--text-secondary)]">{players.length}</span>
                  </div>
                  <div className="space-y-1">
                    {players.slice(0, 5).map((p) => {
                      const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
                      return (
                        <Link
                          key={p.person_id}
                          href={`/players/${p.person_id}`}
                          className="flex items-center gap-2 p-2 rounded hover:bg-[var(--bg-elevated)]/50 transition-colors group"
                        >
                          <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}>
                            {p.position ?? "–"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-white">
                              {p.name}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)] truncate">
                              {p.club}{p.archetype ? ` · ${p.archetype}` : ""}
                            </p>
                          </div>
                          {p.level != null && (
                            <span className="text-sm font-mono text-[var(--text-secondary)]">{p.level}</span>
                          )}
                        </Link>
                      );
                    })}
                    {players.length === 0 && (
                      <p className="text-sm text-[var(--text-muted)] py-2">No players</p>
                    )}
                    {players.length > 5 && (
                      <Link
                        href={`/players?pursuit=${encodeURIComponent(status)}`}
                        className="text-xs text-[var(--accent-personality)] hover:underline block pt-1"
                      >
                        View all {players.length} &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Position Depth */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
            Position Depth
          </h2>
          <div className="space-y-2.5">
            {POSITIONS.map((pos) => {
              const count = positionCounts[pos] ?? 0;
              const pct = (count / maxDepth) * 100;
              const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
              const isWeak = count < 2;
              return (
                <Link
                  key={pos}
                  href={`/players?position=${pos}`}
                  className="flex items-center gap-3 group hover:bg-[var(--bg-elevated)]/30 -mx-2 px-2 py-0.5 rounded transition-colors"
                >
                  <span className={`text-[10px] font-bold tracking-wider w-7 text-center px-1 py-0.5 rounded ${posColor} text-white`}>
                    {pos}
                  </span>
                  <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isWeak ? "bg-[var(--sentiment-negative)]/70" : "bg-[var(--text-primary)]/40"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-sm font-mono w-8 text-right ${isWeak ? "text-[var(--sentiment-negative)]" : "text-[var(--text-secondary)]"}`}>
                    {count}
                  </span>
                  {isWeak && (
                    <span className="text-[10px] font-medium text-[var(--sentiment-negative)]">gap</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
