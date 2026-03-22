"use client";

import Link from "next/link";
import {
  PlayerCard as PlayerCardType,
  computeAge,
  POSITION_COLORS,
} from "@/lib/types";
import { getArchetypeColor } from "@/lib/archetype-styles";

/**
 * Locked player preview for free-tier users.
 * Shows name, position, club, nation, level badge — but blurs
 * radar, attributes, personality, and archetype details.
 * CTA links to /pricing.
 */

function nationFlag(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.toUpperCase();
  const GB: Record<string, string> = {
    "GB-ENG":
      "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
    "GB-SCT":
      "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
    "GB-WLS":
      "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F",
  };
  if (GB[c]) return GB[c];
  if (c.length === 2)
    return String.fromCodePoint(
      ...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
    );
  return "";
}

export function PlayerTeaser({ player }: { player: PlayerCardType }) {
  const age = computeAge(player.dob);
  const posBase = (player.position ?? "").split(" ")[0];
  const posColor = POSITION_COLORS[posBase] ?? "bg-zinc-700/60";
  const flag = nationFlag(player.nation_code);

  return (
    <div className="group relative">
      <Link href={`/players/${player.person_id}`} className="block">
        <div className="border-l-2 border-l-zinc-600 bg-[var(--bg-surface)] rounded-lg px-3 py-2.5 transition-all duration-150 hover:brightness-110">
          {/* Row 1: Position + Name + Level badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}
            >
              {player.position ?? "–"}
            </span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate flex-1">
              {player.name}
            </h3>
            {player.level != null && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-700/50 text-[var(--text-muted)] shrink-0">
                Lv.{player.level}
              </span>
            )}
          </div>

          {/* Row 2: Flag + Club + Age */}
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-1 min-w-0">
            {flag && <span className="shrink-0">{flag}</span>}
            {player.club && <span className="truncate">{player.club}</span>}
            {age !== null && (
              <>
                <span className="text-[var(--text-muted)] shrink-0">·</span>
                <span className="shrink-0">{age}y</span>
              </>
            )}
          </div>

          {/* Row 3: Blurred teaser — archetype + stats hint */}
          <div className="flex items-center gap-2 mt-1.5 min-w-0">
            {/* Blurred archetype */}
            {(player.earned_archetype || player.archetype) && (
              <span
                className="text-[10px] font-semibold blur-[3px] select-none"
                style={{
                  color: getArchetypeColor(
                    player.earned_archetype ?? player.archetype
                  ),
                }}
              >
                {player.earned_archetype ?? player.archetype}
              </span>
            )}

            {/* Blurred pillar scores placeholder */}
            <div className="flex items-center gap-1 blur-[3px] select-none">
              <span className="text-[10px] font-mono font-bold text-amber-400">
                ??
              </span>
              <span className="text-[10px] font-mono font-bold text-purple-400">
                ??
              </span>
              <span className="text-[10px] font-mono font-bold text-green-400">
                ??
              </span>
              <span className="text-[10px] font-mono font-bold text-blue-400">
                ??
              </span>
            </div>

            {/* Lock icon + CTA */}
            <span className="ml-auto text-[10px] text-[var(--color-accent-personality)] font-semibold flex items-center gap-1 shrink-0">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Unlock
            </span>
          </div>
        </div>
      </Link>

      {/* Hover overlay with upgrade CTA */}
      <div className="absolute inset-0 rounded-lg bg-[var(--bg-base)]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center pointer-events-none group-hover:pointer-events-auto">
        <p className="text-xs text-[var(--text-secondary)] mb-2">
          Full profile locked
        </p>
        <Link
          href="/pricing"
          className="px-4 py-1.5 bg-[var(--color-accent-personality)] text-[#06060c] rounded-lg text-xs font-semibold hover:brightness-110 transition-all"
        >
          Upgrade to Scout
        </Link>
      </div>
    </div>
  );
}
