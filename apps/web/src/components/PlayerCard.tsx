import Link from "next/link";
import {
  PlayerCard as PlayerCardType,
  computeAge,
  POSITION_COLORS,
} from "@/lib/types";
import { getPersonalityName } from "@/lib/personality";
import { getRoleRadarConfig } from "@/lib/role-radar";
import { getCardTheme, THEME_STYLES, type CardTheme } from "@/lib/archetype-themes";
import { ageCurveScore } from "@/lib/assessment/four-pillars";
import { MiniRadar } from "@/components/MiniRadar";
import { RoleTooltip } from "@/components/RoleTooltip";

// Hex colors for radar polygon per theme (matches theme accent)
const RADAR_COLORS: Record<CardTheme, string> = {
  general: "#a1a1aa",   // zinc-400
  catalyst: "#e879f9",  // fuchsia-400
  maestro: "#fcd34d",   // amber-300
  captain: "#f87171",   // red-400
  professor: "#60a5fa", // blue-400
  default: "#4ade80",   // green-400
};

export function PlayerCard({ player }: { player: PlayerCardType }) {
  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const theme = getCardTheme(player.personality_type);
  const styles = THEME_STYLES[theme];

  const mentalLabel = getPersonalityName(player.personality_type);

  return (
    <Link
      href={`/players/${player.person_id}`}
      className="block group"
    >
      <div className={`${styles.card} p-4 hover:brightness-110 transition-all duration-150`}>
        {/* Row 1: Position badge + Name */}
        <div className="flex items-center gap-2 mb-2 min-w-0">
          <span
            className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}
          >
            {player.position ?? "–"}
          </span>
          <h3 className={`text-sm text-[var(--text-primary)] truncate ${styles.nameFont}`}>
            {player.name}
          </h3>
        </div>

        {/* Row 2: Club, Nation, Age */}
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] mb-3">
          {player.club && (
            player.club_id ? (
              <Link
                href={`/clubs/${player.club_id}`}
                className="truncate hover:text-[var(--text-primary)] transition-colors"
              >
                {player.club}
              </Link>
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

        {/* Row 3: Role + Personality + Physical */}
        {(mentalLabel || player.best_role) && (
          <div className="flex items-center gap-2 text-[10px] mb-3 flex-wrap">
            {player.best_role && (
              <RoleTooltip
                roleName={player.best_role}
                roleScore={player.best_role_score}
                position={player.position}
                variant="card"
              />
            )}
            {mentalLabel && (
              <>
                {player.best_role && <span className="text-[var(--text-muted)]">·</span>}
                <span className="text-purple-400 font-medium">
                  {mentalLabel}
                </span>
              </>
            )}
            {age !== null && (() => {
              const phys = ageCurveScore(player.position, age);
              return (
                <>
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className={`font-mono font-bold ${
                    phys >= 80 ? "text-[var(--color-accent-physical)]" :
                    phys >= 60 ? "text-[var(--text-secondary)]" :
                    "text-[var(--text-muted)]"
                  }`}>
                    {phys}
                    <span className="text-[8px] font-normal text-[var(--text-muted)] ml-0.5">PHY</span>
                  </span>
                </>
              );
            })()}
          </div>
        )}

        {/* Row 3b: Stats line — goals/assists/rating */}
        {(player.goals != null || player.assists != null) && (
          <div className="text-[10px] font-mono mb-2">
            {player.goals != null && <span className="text-green-400">{player.goals}G</span>}
            {player.goals != null && player.assists != null && " "}
            {player.assists != null && <span className="text-blue-400">{player.assists}A</span>}
            {player.rating != null && <span className="text-amber-400"> · {player.rating.toFixed(1)}★</span>}
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
            {player.earned_archetype ? (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                player.archetype_tier === "elite" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                player.archetype_tier === "established" ? "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30" :
                player.archetype_tier === "aspiring" ? "bg-blue-500/10 text-blue-400/70 border border-blue-500/20" :
                "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
              }`}>
                {[player.legacy_tag, player.behavioral_tag, player.earned_archetype].filter(Boolean).join(" ")}
              </span>
            ) : player.archetype ? (
              <span className="text-[10px] text-[var(--text-muted)]">
                {player.archetype}
              </span>
            ) : null}
          </div>
          {player.legacy_score != null && player.legacy_score > 0 ? (
            <span className="text-[10px] font-mono font-bold" style={{
              color: player.legacy_score >= 5000 ? "#f59e0b" : player.legacy_score >= 2500 ? "#a855f7" : player.legacy_score >= 1000 ? "#3b82f6" : "var(--text-muted)"
            }}>
              {player.legacy_score.toLocaleString()}
              <span className="text-[8px] font-normal ml-0.5 opacity-60">XP</span>
            </span>
          ) : player.archetype && !player.engine_value_p50 && !player.market_value_eur ? (
            <span className="text-[9px] font-mono text-[var(--text-muted)]">{player.personality_type}</span>
          ) : null}
        </div>

        {/* Row 5: MiniRadar fingerprint (role-specific axes) */}
        {player.fingerprint && player.fingerprint.some((v) => v > 0) && (() => {
          const radarConfig = getRoleRadarConfig(player.best_role, player.position);
          const labels = radarConfig.labels.length === player.fingerprint!.length
            ? radarConfig.labels
            : radarConfig.labels.slice(0, player.fingerprint!.length);
          return (
            <div className="flex justify-center mt-3 pt-3 border-t border-[var(--border-subtle)]/30">
              <MiniRadar
                values={player.fingerprint!}
                size={72}
                color={RADAR_COLORS[theme]}
                labels={labels}
                showLabels
              />
            </div>
          );
        })()}
      </div>
    </Link>
  );
}
