import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { getArchetypeColor } from "@/lib/archetype-styles";
import { MiniRadar } from "@/components/MiniRadar";
import { getRoleRadarConfig } from "@/lib/role-radar";

interface TrendingPlayer {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  personality_type: string | null;
  archetype: string | null;
  level: number | null;
  fingerprint: number[] | null;
  best_role: string | null;
  story_count: number;
}

export function TrendingPlayers({ players }: { players: TrendingPlayer[] }) {
  if (players.length === 0) return null;

  return (
    <div className="glass rounded-xl p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Trending Players
        </h2>
        <Link href="/news" className="text-xs text-[var(--accent-personality)] hover:underline">
          News feed &rarr;
        </Link>
      </div>
      <div className="space-y-1.5">
        {players.map((p) => {
          const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
          return (
            <Link
              key={p.person_id}
              href={`/players/${p.person_id}`}
              className="flex items-center gap-3 p-2 rounded hover:bg-[var(--bg-elevated)]/50 transition-colors group"
            >
              <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}>
                {p.position ?? "–"}
              </span>
              {p.fingerprint?.some(v => v > 0) && (() => {
                const { labels } = getRoleRadarConfig(p.best_role, p.position);
                const trimmedLabels = labels.length === p.fingerprint!.length ? labels : labels.slice(0, p.fingerprint!.length);
                return (
                  <div className="shrink-0">
                    <MiniRadar values={p.fingerprint!} size={40} color="rgba(52,211,153,0.7)" labels={trimmedLabels} />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-white">
                  {p.name}
                </p>
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {p.club}
                  {p.archetype && <>{" · "}<span style={{ color: getArchetypeColor(p.archetype) }}>{p.archetype}</span></>}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {p.personality_type && (
                  <span className="text-[10px] font-mono font-bold tracking-wider text-[var(--accent-personality)]">
                    {p.personality_type}
                  </span>
                )}
                <span className="text-[10px] text-[var(--text-muted)]" title={`${p.story_count} recent stories`}>
                  {p.story_count} stories
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
