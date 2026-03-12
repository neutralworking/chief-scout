import Link from "next/link";
import {
  PlayerCard as PlayerCardType,
  computeAge,
  PURSUIT_COLORS,
  POSITION_COLORS,
} from "@/lib/types";
import { PersonalityBadge } from "@/components/PersonalityBadge";
import { getCardTheme, THEME_STYLES } from "@/lib/archetype-themes";

const PERSONALITY_NAMES: Record<string, string> = {
  ANLC: "General", IXSP: "Genius", ANSC: "Machine", INLC: "Captain",
  AXLC: "Showman", INSP: "Maestro", ANLP: "Conductor", IXSC: "Maverick",
  AXSC: "Enforcer", AXSP: "Technician", AXLP: "Orchestrator", INLP: "Guardian",
  INSC: "Hunter", IXLC: "Provocateur", IXLP: "Playmaker", ANSP: "Professor",
};

function QuadrantMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string | null;
  color: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[8px] font-bold uppercase tracking-wider ${color} w-[3ch]`}>
        {label}
      </span>
      <span className="text-[10px] text-[var(--text-primary)] truncate">
        {value}
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

  const mentalLabel = player.personality_type ? PERSONALITY_NAMES[player.personality_type] ?? player.personality_type : null;

  return (
    <Link
      href={`/players/${player.person_id}`}
      className="block group"
    >
      <div className={`${styles.card} p-4 hover:brightness-110 transition-all duration-150`}>
        {/* Row 1: Position badge + Name + Level */}
        <div className="flex items-start justify-between gap-2 mb-2">
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
            {player.level != null && (
              <span className="text-lg font-mono font-bold text-[var(--text-primary)] leading-none">
                {player.level}
              </span>
            )}
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
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] mb-3">
          {player.club && <span className="truncate">{player.club}</span>}
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

        {/* Row 3: Four quadrant metrics */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
          <QuadrantMetric
            label="TEC"
            value={player.technical_score != null ? `${player.technical_score}` : null}
            color="text-sky-400"
          />
          <QuadrantMetric
            label="PHY"
            value={player.physical_score != null ? `${player.physical_score}` : null}
            color="text-amber-400"
          />
          <QuadrantMetric
            label="MEN"
            value={mentalLabel}
            color="text-purple-400"
          />
          <QuadrantMetric
            label="TAC"
            value={player.best_role}
            color="text-green-400"
          />
        </div>

        {/* Row 4: Market Value + Archetype + CSPER badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {player.market_value_eur != null && (
              <span className="text-sm font-mono font-bold text-[var(--accent-tactical)]">
                &euro;{player.market_value_eur >= 1_000_000
                  ? `${(player.market_value_eur / 1_000_000).toFixed(1)}m`
                  : `${(player.market_value_eur / 1_000).toFixed(0)}k`}
              </span>
            )}
            {player.archetype && (
              <span className="text-[10px] text-[var(--text-secondary)]">
                {player.archetype}
              </span>
            )}
          </div>
          <PersonalityBadge personalityType={player.personality_type} size="mini" />
        </div>
      </div>
    </Link>
  );
}
