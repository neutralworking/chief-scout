import Link from "next/link";
import {
  PlayerCard as PlayerCardType,
  computeAge,
  POSITION_COLORS,
} from "@/lib/types";
import { getPersonalityName } from "@/lib/personality";
import { getRoleRadarConfig } from "@/lib/role-radar";
import { ageCurveScore } from "@/lib/assessment/four-pillars";
import { MiniRadar } from "@/components/MiniRadar";
import {
  PILLAR_KEYS,
  PILLAR_HEX,
  PILLAR_LABELS,
  getDominantPillar,
  hasAnyPillarScore,
  getConditionLabel,
  type PillarKey,
} from "@/lib/pillar-colors";

// Border color for the dominant pillar (left accent stripe)
const PILLAR_BORDER: Record<PillarKey, string> = {
  technical: "border-l-amber-500",
  tactical: "border-l-purple-500",
  mental: "border-l-green-500",
  physical: "border-l-blue-500",
};

function formatValue(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v.toFixed(0)}`;
}

/** Compact 4-bar pillar strip */
function PillarStrip({ scores }: { scores: Record<PillarKey, number | null> }) {
  return (
    <div className="flex items-center gap-0.5">
      {PILLAR_KEYS.map((key) => {
        const v = scores[key];
        if (v == null) return null;
        return (
          <div key={key} className="flex items-center gap-0.5">
            <span className="text-[8px] font-bold tracking-wider" style={{ color: PILLAR_HEX[key] }}>
              {PILLAR_LABELS[key]}
            </span>
            <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">
              {v}
            </span>
          </div>
        );
      }).filter(Boolean).reduce<React.ReactNode[]>((acc, el, i) => {
        if (i > 0) acc.push(<span key={`sep-${i}`} className="text-[var(--text-muted)] text-[8px] mx-0.5">·</span>);
        acc.push(el);
        return acc;
      }, [])}
    </div>
  );
}

export function PlayerCard({ player }: { player: PlayerCardType }) {
  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const mentalLabel = getPersonalityName(player.personality_type);

  const pillarScores = {
    technical: player.technical_score ?? null,
    tactical: player.tactical_score ?? null,
    mental: player.mental_score ?? null,
    physical: player.physical_score ?? null,
  };
  const hasPillars = hasAnyPillarScore(pillarScores);
  const dominant = getDominantPillar(pillarScores);
  const overall = player.overall_pillar_score;

  const borderClass = dominant ? PILLAR_BORDER[dominant] : "border-l-zinc-600";
  const conditionLabel = getConditionLabel(
    pillarScores.physical, age, player.position, ageCurveScore,
  );

  return (
    <Link
      href={`/players/${player.person_id}`}
      className="block group"
    >
      <div className={`border-l-2 ${borderClass} bg-[var(--bg-surface)] rounded-lg p-4 hover:brightness-110 transition-all duration-150`}>
        {/* Row 1: Position + Name + Overall */}
        <div className="flex items-center gap-2 mb-1.5 min-w-0">
          <span
            className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}
          >
            {player.position ?? "–"}
          </span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate flex-1">
            {player.name}
          </h3>
          {overall != null && (
            <span
              className="text-base font-mono font-bold shrink-0"
              style={{ color: dominant ? PILLAR_HEX[dominant] : "var(--text-primary)" }}
            >
              {overall}
            </span>
          )}
        </div>

        {/* Row 2: Club · Nation · Age */}
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] mb-2">
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

        {/* Row 3: Pillar scores strip */}
        {hasPillars && (
          <div className="mb-2">
            <PillarStrip scores={pillarScores} />
          </div>
        )}

        {/* Row 4: Four-pillar detail lines */}
        <div className="space-y-0.5 mb-2">
          {/* Technical (gold): archetype + level */}
          {(player.archetype || player.level != null) && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: PILLAR_HEX.technical }} />
              {player.archetype && (
                <span className="font-medium" style={{ color: PILLAR_HEX.technical }}>
                  {player.archetype}
                </span>
              )}
              {player.level != null && (
                <span className="font-mono text-[var(--text-muted)]">{player.level}</span>
              )}
            </div>
          )}

          {/* Tactical (purple): best role */}
          {player.best_role && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: PILLAR_HEX.tactical }} />
              <span className="font-medium" style={{ color: PILLAR_HEX.tactical }}>
                {player.best_role}
              </span>
              {player.best_role_score != null && (
                <span className="font-mono text-[var(--text-muted)]">{player.best_role_score}</span>
              )}
            </div>
          )}

          {/* Mental (green): personality */}
          {mentalLabel && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: PILLAR_HEX.mental }} />
              <span className="font-medium" style={{ color: PILLAR_HEX.mental }}>
                {mentalLabel}
              </span>
              {player.personality_type && (
                <span className="font-mono text-[var(--text-muted)]">{player.personality_type}</span>
              )}
            </div>
          )}

          {/* Physical (blue): condition */}
          {(conditionLabel || pillarScores.physical != null) && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: PILLAR_HEX.physical }} />
              {conditionLabel && (
                <span className="font-medium" style={{ color: PILLAR_HEX.physical }}>
                  {conditionLabel}
                </span>
              )}
              {!conditionLabel && age != null && (
                <span className="font-mono" style={{ color: PILLAR_HEX.physical }}>
                  {ageCurveScore(player.position, age)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Row 5: Stats line — goals/assists/rating */}
        {(player.goals != null || player.assists != null) && (
          <div className="text-[10px] font-mono mb-2">
            {player.goals != null && <span className="text-green-400">{player.goals}G</span>}
            {player.goals != null && player.assists != null && " "}
            {player.assists != null && <span className="text-blue-400">{player.assists}A</span>}
            {player.rating != null && <span className="text-amber-400"> · {player.rating.toFixed(1)}★</span>}
          </div>
        )}

        {/* Row 6: Value + Earned archetype */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {player.engine_value_p50 != null ? (
              <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
                {formatValue(player.engine_value_p50)}
                <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${
                  player.engine_confidence === "high" ? "bg-green-400" :
                  player.engine_confidence === "medium" ? "bg-amber-400" :
                  "bg-red-400"
                }`} title={`${player.engine_confidence ?? "low"} confidence`} />
              </span>
            ) : player.market_value_eur != null ? (
              <span className="text-sm font-mono font-bold text-[var(--text-secondary)]">
                {formatValue(player.market_value_eur)}
                <span className="text-[8px] font-normal text-[var(--text-muted)] ml-0.5">TM</span>
              </span>
            ) : null}
            {player.earned_archetype ? (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                player.archetype_tier === "elite" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                player.archetype_tier === "established" ? "bg-purple-500/15 text-purple-400 border border-purple-500/30" :
                player.archetype_tier === "aspiring" ? "bg-blue-500/10 text-blue-400/70 border border-blue-500/20" :
                "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
              }`}>
                {[player.legacy_tag, player.behavioral_tag, player.earned_archetype].filter(Boolean).join(" ")}
              </span>
            ) : null}
          </div>
          {player.legacy_score != null && player.legacy_score > 0 && (
            <span className="text-[10px] font-mono font-bold" style={{
              color: player.legacy_score >= 5000 ? "#f59e0b" : player.legacy_score >= 2500 ? "#a855f7" : player.legacy_score >= 1000 ? "#3b82f6" : "var(--text-muted)"
            }}>
              {player.legacy_score.toLocaleString()}
              <span className="text-[8px] font-normal ml-0.5 opacity-60">XP</span>
            </span>
          )}
        </div>

        {/* Row 7: MiniRadar fingerprint */}
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
                color={dominant ? PILLAR_HEX[dominant] : "#4ade80"}
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
