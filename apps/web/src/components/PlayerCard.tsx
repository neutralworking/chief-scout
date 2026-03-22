import Link from "next/link";
import {
  PlayerCard as PlayerCardType,
  computeAge,
  POSITION_COLORS,
} from "@/lib/types";
import {
  PILLAR_KEYS,
  PILLAR_HEX,
  getDominantPillar,
  hasAnyPillarScore,
  type PillarKey,
} from "@/lib/pillar-colors";
import { getArchetypeColor } from "@/lib/archetype-styles";

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

function nationFlag(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.toUpperCase();
  const GB: Record<string, string> = {
    "GB-ENG": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
    "GB-SCT": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
    "GB-WLS": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F",
  };
  if (GB[c]) return GB[c];
  if (c.length === 2) return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  return "";
}

export function PlayerCard({ player }: { player: PlayerCardType }) {
  const age = computeAge(player.dob);
  const posBase = (player.position ?? "").split(" ")[0];
  const posColor = POSITION_COLORS[posBase] ?? "bg-zinc-700/60";

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

  const flag = nationFlag(player.nation_code);
  const value = player.engine_value_p50 ?? player.market_value_eur;

  return (
    <Link
      href={`/players/${player.person_id}`}
      className="block group"
    >
      <div className={`border-l-2 ${borderClass} bg-[var(--bg-surface)] px-3 py-2.5 hover:brightness-110 transition-all duration-150`}>
        {/* Row 1: Position + Name + Overall */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
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

        {/* Row 2: Flag + Club · Age · Archetype */}
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-1 min-w-0">
          {flag && <span className="shrink-0">{flag}</span>}
          {player.club && <span className="truncate">{player.club}</span>}
          {age !== null && (
            <><span className="text-[var(--text-muted)] shrink-0">·</span><span className="shrink-0">{age}y</span></>
          )}
          {(player.earned_archetype || player.archetype) && (
            <><span className="text-[var(--text-muted)] shrink-0">·</span><span className="shrink-0" style={{ color: getArchetypeColor(player.earned_archetype ?? player.archetype) }}>{player.earned_archetype ?? player.archetype}</span></>
          )}
          {player.model_id && (
            <span className="font-mono text-[10px] text-[var(--text-muted)] ml-auto">
              {player.model_id}
            </span>
          )}
        </div>

        {/* Row 3: Pillar scores + Role + Value */}
        {(hasPillars || player.best_role || value) && (
          <div className="flex items-center gap-1 mt-1 min-w-0">
            {/* 4 pillar numbers, color-coded */}
            {hasPillars && (
              <div className="flex items-center gap-1 shrink-0">
                {PILLAR_KEYS.map((key) => {
                  const v = pillarScores[key];
                  if (v == null) return null;
                  return (
                    <span key={key} className="text-[10px] font-mono font-bold" style={{ color: PILLAR_HEX[key] }}>
                      {v}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Best role */}
            {player.best_role && (
              <>
                {hasPillars && <span className="text-[var(--text-muted)] text-[8px] shrink-0">·</span>}
                <span className="text-[10px] text-[var(--text-muted)] truncate">
                  {player.best_role}
                </span>
              </>
            )}

            {/* Value — right-aligned */}
            {value != null && (
              <span className="text-[10px] font-mono font-semibold text-[var(--text-secondary)] ml-auto shrink-0">
                {formatValue(value)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
