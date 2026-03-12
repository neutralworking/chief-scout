import Link from "next/link";
import {
  PlayerCard as PlayerCardType,
  computeAge,
  PURSUIT_COLORS,
  POSITION_COLORS,
} from "@/lib/types";
import { PersonalityBadge } from "@/components/PersonalityBadge";
import { getCardTheme, THEME_STYLES } from "@/lib/archetype-themes";

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

export function PlayerCard({ player, showPursuit = false }: { player: PlayerCardType; showPursuit?: boolean }) {
  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const pursuitColor =
    PURSUIT_COLORS[player.pursuit_status ?? ""] ?? "bg-[var(--text-muted)]";
  const theme = getCardTheme(player.personality_type);
  const styles = THEME_STYLES[theme];

  return (
    <Link
      href={`/players/${player.person_id}`}
      className="block group"
    >
      <div className={`${styles.card} p-4 hover:brightness-110 transition-all duration-150`}>
        {/* Row 1: Position badge + Name + CSPER */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}
            >
              {player.position ?? "–"}
            </span>
            <h3 className={`text-sm text-[var(--text-primary)] truncate ${styles.nameFont}`}>
              {player.name}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PersonalityBadge personalityType={player.personality_type} size="compact" />
            {showPursuit && player.pursuit_status && (
              <span
                className={`text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded ${pursuitColor}`}
              >
                {player.pursuit_status}
              </span>
            )}
          </div>
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

        {/* Row 3: Level/Peak/Overall bars */}
        <div className="space-y-1 mb-3">
          <LevelBar label="Lvl" value={player.level} />
          <LevelBar label="Peak" value={player.peak} />
          <LevelBar label="OVR" value={player.overall} />
        </div>

        {/* Row 4: Archetype + Market Value */}
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
          <div className="flex items-center gap-1.5">
            {player.market_value_eur != null && (
              <span className="text-[10px] font-mono font-bold text-[var(--text-secondary)]">
                &euro;{player.market_value_eur >= 1_000_000
                  ? `${(player.market_value_eur / 1_000_000).toFixed(1)}m`
                  : `${(player.market_value_eur / 1_000).toFixed(0)}k`}
              </span>
            )}
            {player.profile_tier === 1 && (
              <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--accent-personality)] border border-[var(--accent-personality)]/30 px-1.5 py-0.5 rounded">
                Scout Assessed
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
