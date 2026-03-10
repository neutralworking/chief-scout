import Link from "next/link";
import {
  PlayerCard as PlayerCardType,
  computeAge,
  PURSUIT_COLORS,
  POSITION_COLORS,
} from "@/lib/types";

function LevelBar({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number | null;
  max?: number;
}) {
  const pct = value ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-secondary)] w-8 uppercase tracking-wide">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--text-primary)] opacity-60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-[var(--text-primary)] w-6 text-right">
        {value ?? "–"}
      </span>
    </div>
  );
}

export function PlayerCard({ player }: { player: PlayerCardType }) {
  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const pursuitColor =
    PURSUIT_COLORS[player.pursuit_status ?? ""] ?? "bg-[var(--text-muted)]";

  return (
    <Link
      href={`/player?id=${player.person_id}`}
      className="block group"
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4 hover:border-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-all duration-150">
        {/* Row 1: Position badge + Name + Age */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}
            >
              {player.position ?? "–"}
            </span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {player.name}
            </h3>
          </div>
          {player.pursuit_status && (
            <span
              className={`text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded shrink-0 ${pursuitColor}`}
            >
              {player.pursuit_status}
            </span>
          )}
        </div>

        {/* Row 2: Club, Nation, Age */}
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-3">
          {player.club && <span>{player.club}</span>}
          {player.nation && (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <span>{player.nation}</span>
            </>
          )}
          {age !== null && (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <span>{age}y</span>
            </>
          )}
        </div>

        {/* Row 3: Level/Peak bars */}
        <div className="space-y-1 mb-3">
          <LevelBar label="Lvl" value={player.level} />
          <LevelBar label="Peak" value={player.peak} />
        </div>

        {/* Row 4: Archetype + Tier */}
        <div className="flex items-center justify-between">
          {player.archetype ? (
            <span className="text-xs font-medium text-[var(--accent-tactical)]">
              {player.archetype}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">
              No archetype
            </span>
          )}
          {player.profile_tier === 1 && (
            <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--accent-personality)] border border-[var(--accent-personality)]/30 px-1.5 py-0.5 rounded">
              Scout Assessed
            </span>
          )}
          {player.personality_type && (
            <span className="text-xs font-mono font-bold tracking-widest text-[var(--accent-personality)]">
              {player.personality_type}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
