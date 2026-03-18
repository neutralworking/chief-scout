"use client";

import { useState } from "react";

interface FBRefStat {
  comp_name: string;
  season: string;
  team: string;
  minutes: number | null;
  matches_played: number | null;
  starts: number | null;
  goals: number | null;
  assists: number | null;
  xg: number | null;
  npxg: number | null;
  xag: number | null;
  key_passes: number | null;
  progressive_passes: number | null;
  progressive_carries: number | null;
  successful_dribbles: number | null;
  tackles: number | null;
  interceptions: number | null;
  blocks: number | null;
  passes_completed: number | null;
  passes_attempted: number | null;
  pass_pct: number | null;
  shots: number | null;
  shots_on_target: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
}

interface ApiFootballStat {
  season: string;
  league_name: string | null;
  team_name: string | null;
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
  shots_total: number | null;
  shots_on: number | null;
  passes_accuracy: number | null;
  tackles_total: number | null;
  interceptions: number | null;
  blocks: number | null;
  duels_total: number | null;
  duels_won: number | null;
  dribbles_attempted: number | null;
  dribbles_success: number | null;
  fouls_drawn: number | null;
  fouls_committed: number | null;
  cards_yellow: number | null;
  cards_red: number | null;
}

type StatView = "overview" | "attacking" | "passing" | "defense" | "dueling";

function num(v: number | null): string {
  if (v == null) return "–";
  return Number.isInteger(v) ? v.toString() : v.toFixed(1);
}

function pct(won: number | null, total: number | null): string {
  if (won == null || total == null || total === 0) return "–";
  return `${Math.round((won / total) * 100)}%`;
}

export function PlayerStats({
  fbrefStats = [],
  afStats = [],
}: {
  fbrefStats?: FBRefStat[];
  afStats?: ApiFootballStat[];
  /** @deprecated Use fbrefStats instead */
  stats?: FBRefStat[];
}) {
  const [view, setView] = useState<StatView>("overview");

  const hasAF = afStats.length > 0;
  const hasFBRef = fbrefStats.length > 0;

  if (!hasAF && !hasFBRef) return null;

  const views: { key: StatView; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "attacking", label: "Attacking" },
    { key: "passing", label: "Passing" },
    { key: "defense", label: "Defense" },
    ...(hasAF ? [{ key: "dueling" as StatView, label: "Dueling" }] : []),
  ];

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Season Stats
        </h3>
        <div className="flex gap-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                view === v.key
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* API-Football stats */}
      {hasAF && view !== "dueling" && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-1.5 font-medium w-6">
                  <span className="text-amber-400 text-[8px]">AF</span>
                </th>
                <th className="text-left py-1.5 font-medium">Season</th>
                <th className="text-left py-1.5 font-medium">League</th>
                <th className="text-left py-1.5 font-medium">Team</th>
                {view === "overview" && (
                  <>
                    <th className="text-right py-1.5 font-medium">MP</th>
                    <th className="text-right py-1.5 font-medium">Min</th>
                    <th className="text-right py-1.5 font-medium">G</th>
                    <th className="text-right py-1.5 font-medium">A</th>
                    <th className="text-right py-1.5 font-medium">Rtg</th>
                  </>
                )}
                {view === "attacking" && (
                  <>
                    <th className="text-right py-1.5 font-medium">G</th>
                    <th className="text-right py-1.5 font-medium">Shots</th>
                    <th className="text-right py-1.5 font-medium">SoT</th>
                    <th className="text-right py-1.5 font-medium">Drb</th>
                    <th className="text-right py-1.5 font-medium">Rtg</th>
                  </>
                )}
                {view === "passing" && (
                  <>
                    <th className="text-right py-1.5 font-medium">A</th>
                    <th className="text-right py-1.5 font-medium">Pass%</th>
                    <th className="text-right py-1.5 font-medium">Rtg</th>
                  </>
                )}
                {view === "defense" && (
                  <>
                    <th className="text-right py-1.5 font-medium">Tkl</th>
                    <th className="text-right py-1.5 font-medium">Int</th>
                    <th className="text-right py-1.5 font-medium">Blk</th>
                    <th className="text-right py-1.5 font-medium">YC</th>
                    <th className="text-right py-1.5 font-medium">RC</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {afStats.map((s, i) => (
                <tr key={`af-${i}`} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30">
                  <td className="py-1.5" />
                  <td className="py-1.5 font-mono text-[var(--text-secondary)]">{s.season}</td>
                  <td className="py-1.5 text-[var(--text-secondary)] truncate max-w-[120px]">{s.league_name || "–"}</td>
                  <td className="py-1.5 text-[var(--text-secondary)] truncate max-w-[100px]">{s.team_name || "–"}</td>
                  {view === "overview" && (
                    <>
                      <td className="py-1.5 text-right font-mono">{num(s.appearances)}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--text-secondary)]">{num(s.minutes)}</td>
                      <td className="py-1.5 text-right font-mono font-bold">{num(s.goals)}</td>
                      <td className="py-1.5 text-right font-mono font-bold">{num(s.assists)}</td>
                      <td className="py-1.5 text-right font-mono text-amber-400">{s.rating != null ? s.rating.toFixed(2) : "–"}</td>
                    </>
                  )}
                  {view === "attacking" && (
                    <>
                      <td className="py-1.5 text-right font-mono font-bold">{num(s.goals)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.shots_total)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.shots_on)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.dribbles_success)}</td>
                      <td className="py-1.5 text-right font-mono text-amber-400">{s.rating != null ? s.rating.toFixed(2) : "–"}</td>
                    </>
                  )}
                  {view === "passing" && (
                    <>
                      <td className="py-1.5 text-right font-mono font-bold">{num(s.assists)}</td>
                      <td className="py-1.5 text-right font-mono">{s.passes_accuracy != null ? `${s.passes_accuracy.toFixed(0)}%` : "–"}</td>
                      <td className="py-1.5 text-right font-mono text-amber-400">{s.rating != null ? s.rating.toFixed(2) : "–"}</td>
                    </>
                  )}
                  {view === "defense" && (
                    <>
                      <td className="py-1.5 text-right font-mono">{num(s.tackles_total)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.interceptions)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.blocks)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.cards_yellow)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.cards_red)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dueling tab — API-Football only */}
      {hasAF && view === "dueling" && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-1.5 font-medium w-6">
                  <span className="text-amber-400 text-[8px]">AF</span>
                </th>
                <th className="text-left py-1.5 font-medium">Season</th>
                <th className="text-left py-1.5 font-medium">League</th>
                <th className="text-right py-1.5 font-medium">Duels</th>
                <th className="text-right py-1.5 font-medium">Won</th>
                <th className="text-right py-1.5 font-medium">Win%</th>
                <th className="text-right py-1.5 font-medium">Drb Att</th>
                <th className="text-right py-1.5 font-medium">Drb Suc</th>
                <th className="text-right py-1.5 font-medium">Drb%</th>
                <th className="text-right py-1.5 font-medium">Fls D</th>
                <th className="text-right py-1.5 font-medium">Fls C</th>
              </tr>
            </thead>
            <tbody>
              {afStats.map((s, i) => (
                <tr key={`af-duel-${i}`} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30">
                  <td className="py-1.5" />
                  <td className="py-1.5 font-mono text-[var(--text-secondary)]">{s.season}</td>
                  <td className="py-1.5 text-[var(--text-secondary)] truncate max-w-[120px]">{s.league_name || "–"}</td>
                  <td className="py-1.5 text-right font-mono">{num(s.duels_total)}</td>
                  <td className="py-1.5 text-right font-mono font-bold">{num(s.duels_won)}</td>
                  <td className="py-1.5 text-right font-mono text-[var(--color-accent-physical)]">{pct(s.duels_won, s.duels_total)}</td>
                  <td className="py-1.5 text-right font-mono">{num(s.dribbles_attempted)}</td>
                  <td className="py-1.5 text-right font-mono font-bold">{num(s.dribbles_success)}</td>
                  <td className="py-1.5 text-right font-mono text-[var(--color-accent-tactical)]">{pct(s.dribbles_success, s.dribbles_attempted)}</td>
                  <td className="py-1.5 text-right font-mono">{num(s.fouls_drawn)}</td>
                  <td className="py-1.5 text-right font-mono">{num(s.fouls_committed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FBRef stats */}
      {hasFBRef && view !== "dueling" && (
        <div className="overflow-x-auto">
          {hasAF && <div className="border-t border-[var(--border-subtle)] mt-1 mb-2" />}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-1.5 font-medium w-6">
                  <span className="text-blue-400 text-[8px]">FB</span>
                </th>
                <th className="text-left py-1.5 font-medium">Season</th>
                <th className="text-left py-1.5 font-medium">Comp</th>
                <th className="text-left py-1.5 font-medium">Team</th>
                {view === "overview" && (
                  <>
                    <th className="text-right py-1.5 font-medium">MP</th>
                    <th className="text-right py-1.5 font-medium">Min</th>
                    <th className="text-right py-1.5 font-medium">G</th>
                    <th className="text-right py-1.5 font-medium">A</th>
                    <th className="text-right py-1.5 font-medium">xG</th>
                    <th className="text-right py-1.5 font-medium">xAG</th>
                  </>
                )}
                {view === "attacking" && (
                  <>
                    <th className="text-right py-1.5 font-medium">G</th>
                    <th className="text-right py-1.5 font-medium">xG</th>
                    <th className="text-right py-1.5 font-medium">npxG</th>
                    <th className="text-right py-1.5 font-medium">Shots</th>
                    <th className="text-right py-1.5 font-medium">SoT</th>
                    <th className="text-right py-1.5 font-medium">Drb</th>
                    <th className="text-right py-1.5 font-medium">Prog C</th>
                  </>
                )}
                {view === "passing" && (
                  <>
                    <th className="text-right py-1.5 font-medium">A</th>
                    <th className="text-right py-1.5 font-medium">xAG</th>
                    <th className="text-right py-1.5 font-medium">KP</th>
                    <th className="text-right py-1.5 font-medium">Cmp</th>
                    <th className="text-right py-1.5 font-medium">Att</th>
                    <th className="text-right py-1.5 font-medium">Pct</th>
                    <th className="text-right py-1.5 font-medium">Prog P</th>
                  </>
                )}
                {view === "defense" && (
                  <>
                    <th className="text-right py-1.5 font-medium">Tkl</th>
                    <th className="text-right py-1.5 font-medium">Int</th>
                    <th className="text-right py-1.5 font-medium">Blk</th>
                    <th className="text-right py-1.5 font-medium">YC</th>
                    <th className="text-right py-1.5 font-medium">RC</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {fbrefStats.map((s, i) => (
                <tr key={`fb-${i}`} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30">
                  <td className="py-1.5" />
                  <td className="py-1.5 font-mono text-[var(--text-secondary)]">{s.season}</td>
                  <td className="py-1.5 text-[var(--text-secondary)] truncate max-w-[120px]">{s.comp_name}</td>
                  <td className="py-1.5 text-[var(--text-secondary)] truncate max-w-[100px]">{s.team}</td>
                  {view === "overview" && (
                    <>
                      <td className="py-1.5 text-right font-mono">{num(s.matches_played)}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--text-secondary)]">{num(s.minutes)}</td>
                      <td className="py-1.5 text-right font-mono font-bold">{num(s.goals)}</td>
                      <td className="py-1.5 text-right font-mono font-bold">{num(s.assists)}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--text-secondary)]">{num(s.xg)}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--text-secondary)]">{num(s.xag)}</td>
                    </>
                  )}
                  {view === "attacking" && (
                    <>
                      <td className="py-1.5 text-right font-mono font-bold">{num(s.goals)}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--text-secondary)]">{num(s.xg)}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--text-secondary)]">{num(s.npxg)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.shots)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.shots_on_target)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.successful_dribbles)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.progressive_carries)}</td>
                    </>
                  )}
                  {view === "passing" && (
                    <>
                      <td className="py-1.5 text-right font-mono font-bold">{num(s.assists)}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--text-secondary)]">{num(s.xag)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.key_passes)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.passes_completed)}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--text-secondary)]">{num(s.passes_attempted)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.pass_pct)}%</td>
                      <td className="py-1.5 text-right font-mono">{num(s.progressive_passes)}</td>
                    </>
                  )}
                  {view === "defense" && (
                    <>
                      <td className="py-1.5 text-right font-mono">{num(s.tackles)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.interceptions)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.blocks)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.yellow_cards)}</td>
                      <td className="py-1.5 text-right font-mono">{num(s.red_cards)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[9px] text-[var(--text-muted)] mt-2">
        Source: {[hasAF && "API-Football", hasFBRef && "FBRef"].filter(Boolean).join(" + ")}
      </p>
    </div>
  );
}
