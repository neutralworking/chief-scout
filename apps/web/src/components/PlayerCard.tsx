import Link from "next/link";
import {
  PlayerCard as PlayerCardType,
  computeAge,
  PURSUIT_COLORS,
  POSITION_COLORS,
} from "@/lib/types";
import { PersonalityBadge } from "@/components/PersonalityBadge";
import { getCardTheme, THEME_STYLES, CardTheme } from "@/lib/archetype-themes";
import { MiniRadar } from "@/components/MiniRadar";

// Hex colors for radar polygon per theme (matches theme accent)
const RADAR_COLORS: Record<CardTheme, string> = {
  general: "#a1a1aa",   // zinc-400
  showman: "#e879f9",   // fuchsia-400
  maestro: "#fcd34d",   // amber-300
  captain: "#f87171",   // red-400
  professor: "#60a5fa", // blue-400
  default: "#4ade80",   // green-400
};

const OUTFIELD_LABELS = ["DEF", "CRE", "ATK", "PWR", "PAC", "DRV"];
const GK_LABELS = ["STP", "CMD", "SWP", "DST"];

const PERSONALITY_NAMES: Record<string, string> = {
  ANLC: "General", IXSP: "Genius", ANSC: "Machine", INLC: "Captain",
  AXLC: "Warrior", INSP: "Maestro", ANLP: "Conductor", IXSC: "Maverick",
  AXSC: "Enforcer", AXSP: "Technician", AXLP: "Orchestrator", INLP: "Guardian",
  INSC: "Blade", IXLC: "Livewire", IXLP: "Playmaker", ANSP: "Professor",
};

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
            {player.best_role_score != null && (
              <span className="text-lg font-mono font-bold text-[var(--text-primary)] leading-none" title={player.best_role ?? "Role Score"}>
                {player.best_role_score}
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
          {player.club && (
            player.club_id ? (
              <span
                className="truncate hover:text-[var(--text-primary)] transition-colors"
                onClick={(e) => { e.preventDefault(); window.location.href = `/clubs/${player.club_id}`; }}
              >
                {player.club}
              </span>
            ) : (
              <span className="truncate">{player.club}</span>
            )
          )}
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

        {/* Row 3: Personality + Best Role */}
        {(mentalLabel || player.best_role) && (
          <div className="flex items-center gap-3 text-[10px] mb-3">
            {mentalLabel && <span className="text-purple-400 font-medium">{mentalLabel}</span>}
            {player.best_role && (
              <>
                {mentalLabel && <span className="text-[var(--text-muted)]">·</span>}
                <span className="text-[var(--color-accent-tactical)] font-medium">{player.best_role}</span>
              </>
            )}
          </div>
        )}

        {/* Row 4: Market Value + Archetype + CSPER badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {player.engine_value_p50 != null ? (
              <span className="text-sm font-mono font-bold text-[var(--color-accent-tactical)]">
                &euro;{player.engine_value_p50 >= 1_000_000
                  ? `${(player.engine_value_p50 / 1_000_000).toFixed(1)}m`
                  : player.engine_value_p50 >= 1_000
                  ? `${(player.engine_value_p50 / 1_000).toFixed(0)}k`
                  : `${player.engine_value_p50.toFixed(0)}`}
                <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${
                  player.engine_confidence === "high" ? "bg-green-400" :
                  player.engine_confidence === "medium" ? "bg-amber-400" :
                  "bg-red-400"
                }`} title={`${player.engine_confidence ?? "low"} confidence`} />
              </span>
            ) : player.market_value_eur != null ? (
              <span className="text-sm font-mono font-bold text-[var(--accent-tactical)]">
                &euro;{player.market_value_eur >= 1_000_000
                  ? `${(player.market_value_eur / 1_000_000).toFixed(1)}m`
                  : `${(player.market_value_eur / 1_000).toFixed(0)}k`}
                <span className="text-[8px] font-normal text-[var(--text-muted)] ml-0.5">TM</span>
              </span>
            ) : null}
            {player.archetype && (
              <span className="text-[10px] text-[var(--text-secondary)]">
                {player.archetype}
              </span>
            )}
          </div>
          <PersonalityBadge personalityType={player.personality_type} size="mini" />
        </div>

        {/* Row 5: MiniRadar fingerprint */}
        {player.fingerprint && player.fingerprint.some((v) => v > 0) && (
          <div className="flex justify-center mt-3 pt-3 border-t border-[var(--border-subtle)]/30">
            <MiniRadar
              values={player.fingerprint}
              size={72}
              color={RADAR_COLORS[theme]}
              labels={player.position === "GK" ? GK_LABELS : OUTFIELD_LABELS}
              showLabels
            />
          </div>
        )}
      </div>
    </Link>
  );
}
