"use client";

import { useState } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { PERSONALITY_TYPES } from "@/lib/personality";
import { getArchetypeColor } from "@/lib/archetype-styles";
import { ScoutingNotes } from "./ScoutingNotes";

interface FeaturedPlayerData {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  nation: string | null;
  nation_code: string | null;
  level: number | null;
  overall: number | null;
  archetype: string | null;
  earned_archetype: string | null;
  best_role: string | null;
  best_role_score: number | null;
  blueprint: string | null;
  personality_type: string | null;
  market_value_tier: string | null;
  dob: string | null;
  scouting_notes: string | null;
  technical_score: number | null;
  tactical_score: number | null;
  mental_score: number | null;
  physical_score: number | null;
  overall_pillar_score: number | null;
  market_value_eur: number | null;
  director_valuation_meur: number | null;
  // Season stats (optional — passed from dashboard)
  af_appearances?: number | null;
  af_goals?: number | null;
  af_assists?: number | null;
  af_rating?: number | null;
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

function formatValue(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v.toFixed(0)}`;
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  dof_pick: { label: "DOF Pick", color: "var(--accent-tactical)" },
  news_trending: { label: "Trending", color: "var(--accent-physical)" },
  discovery: { label: "Discovery", color: "var(--accent-personality)" },
};

export function FeaturedPlayer({ player: initialPlayer, reason, pool = [] }: { player: FeaturedPlayerData; reason?: string; pool?: FeaturedPlayerData[] }) {
  const [currentPlayer, setCurrentPlayer] = useState(initialPlayer);
  const [poolIndex, setPoolIndex] = useState(() => {
    const idx = pool.findIndex((p) => p.person_id === initialPlayer.person_id);
    return idx >= 0 ? idx : 0;
  });

  const player = currentPlayer;
  const pt = player.personality_type ? PERSONALITY_TYPES[player.personality_type] : null;
  const personality = pt ? { name: pt.fullName, oneLiner: pt.oneLiner } : null;
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const reasonInfo = reason ? REASON_LABELS[reason] : null;
  const canCycle = pool.length > 1;

  const flag = nationFlag(player.nation_code);
  const value = player.market_value_eur;

  const prevFeatured = () => {
    if (!canCycle) return;
    const prev = (poolIndex - 1 + pool.length) % pool.length;
    setPoolIndex(prev);
    setCurrentPlayer(pool[prev]);
  };

  const nextFeatured = () => {
    if (!canCycle) return;
    const next = (poolIndex + 1) % pool.length;
    setPoolIndex(next);
    setCurrentPlayer(pool[next]);
  };

  const age = player.dob
    ? Math.floor((Date.now() - new Date(player.dob).getTime()) / 31557600000)
    : null;

  return (
    <div className={`card-vibrant border-l-2 border-[var(--color-accent-tactical)] p-4 sm:p-5`}>
      {/* Header: Featured label + cycling */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Featured</span>
        {reasonInfo && (
          <span className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5" style={{ color: reasonInfo.color, backgroundColor: `color-mix(in srgb, ${reasonInfo.color} 15%, transparent)` }}>
            {reasonInfo.label}
          </span>
        )}
        {canCycle && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={prevFeatured} className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">&larr; Prev</button>
            <span className="text-[11px] text-[var(--text-muted)] font-data">{poolIndex + 1}/{pool.length}</span>
            <button onClick={nextFeatured} className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Next &rarr;</button>
          </div>
        )}
      </div>

      {/* Identity + Intel */}
      <div>
        {/* Position + Name + Overall */}
        <Link href={`/players/${player.person_id}`} className="group">
          <div className="flex items-center gap-2 min-w-0 max-w-2xl">
            <span className={`text-[11px] font-bold tracking-wider px-1.5 py-0.5 ${posColor} text-white shrink-0`}>
              {player.position ?? "–"}
            </span>
            <h2 className="text-lg font-[family-name:var(--font-display)] uppercase text-[var(--text-primary)] min-w-0 group-hover:text-[var(--accent-personality)] transition-colors">
              {player.name}
            </h2>
            {player.best_role_score != null && (
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                {player.best_role && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {player.best_role}
                  </span>
                )}
                <span className="text-xl font-data font-bold text-gradient-brand">
                  {player.best_role_score}
                </span>
              </div>
            )}
          </div>
        </Link>

        {/* Flag + Club + Age + Archetype + Best Role + Value */}
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-1 min-w-0 flex-wrap">
          {flag && <span className="shrink-0">{flag}</span>}
          {player.club && <span className="truncate">{player.club}</span>}
          {age !== null && (
            <><span className="text-[var(--text-muted)] shrink-0">·</span><span className="shrink-0">{age}y</span></>
          )}
          {player.best_role && player.best_role_score == null && (
            <><span className="text-[var(--text-muted)] shrink-0">·</span><span className="shrink-0 text-[var(--text-muted)]">{player.best_role}</span></>
          )}
          {value != null && (
            <><span className="text-[var(--text-muted)] shrink-0">·</span><span className="shrink-0 font-data font-semibold">{formatValue(value)}</span></>
          )}
        </div>

        {/* Season stats */}
        {(player.af_appearances ?? 0) > 0 && (
          <p className="text-[11px] font-data text-[var(--text-muted)] mt-1">
            <span className="text-[var(--color-accent-tactical)]">{player.af_appearances}</span> apps
            {(player.af_goals ?? 0) > 0 && <span className="text-green-400"> · {player.af_goals} goals</span>}
            {(player.af_assists ?? 0) > 0 && <span className="text-blue-400"> · {player.af_assists} assists</span>}
            {player.af_rating != null && <span className="text-amber-400"> · {player.af_rating.toFixed(1)}★</span>}
          </p>
        )}

        {/* Scout assessment */}
        {player.scouting_notes && (
          <ScoutingNotes text={player.scouting_notes} clamp={6} className="mt-2" />
        )}

        {/* Personality + Archetype chips */}
        {(personality || player.earned_archetype || player.archetype) && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {personality && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-pit)] border border-[var(--border-panel)]/20">
                <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M9 21h6"/></svg>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{player.personality_type} {personality.name}</span>
              </div>
            )}
            {(player.earned_archetype || player.archetype) && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-pit)] border border-[var(--border-panel)]/20">
                <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                <span className="text-[10px] font-semibold" style={{ color: getArchetypeColor(player.earned_archetype ?? player.archetype ?? "") }}>{player.earned_archetype ?? player.archetype}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
