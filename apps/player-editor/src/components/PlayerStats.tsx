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

type StatView = "overview" | "attacking" | "passing" | "defense";

function num(v: number | null): string {
  if (v == null) return "–";
  return Number.isInteger(v) ? v.toString() : v.toFixed(1);
}

export function PlayerStats({ stats }: { stats: FBRefStat[] }) {
  const [view, setView] = useState<StatView>("overview");

  if (stats.length === 0) return null;

  const views: { key: StatView; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "attacking", label: "Attacking" },
    { key: "passing", label: "Passing" },
    { key: "defense", label: "Defense" },
  ];

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
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

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
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
            {stats.map((s, i) => (
              <tr key={i} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30">
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
      <p className="text-[9px] text-[var(--text-muted)] mt-2">Source: FBRef</p>
    </div>
  );
}
