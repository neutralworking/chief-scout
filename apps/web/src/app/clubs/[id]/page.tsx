import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS, POSITION_COLORS } from "@/lib/types";
import { computeAge } from "@/lib/types";

interface ClubPlayer {
  person_id: number;
  name: string;
  dob: string | null;
  position: string | null;
  level: number | null;
  peak: number | null;
  archetype: string | null;
  pursuit_status: string | null;
  personality_type: string | null;
  market_value_tier: string | null;
  true_mvt: string | null;
}

interface ClubPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClubDetailPage({ params }: ClubPageProps) {
  const { id } = await params;
  const clubId = parseInt(id, 10);

  if (!supabaseServer || isNaN(clubId)) {
    return <div className="text-sm text-[var(--text-secondary)]">Invalid club or Supabase not configured.</div>;
  }

  // Fetch club info
  const { data: club } = await supabaseServer
    .from("clubs")
    .select("id, clubname, league_tier, league_name, stadium, stadium_capacity, founded_year, short_name, nations(name)")
    .eq("id", clubId)
    .single();

  if (!club) {
    return <div className="text-sm text-[var(--text-secondary)]">Club not found.</div>;
  }

  const clubName = (club as any).clubname;
  const nationName = (club as any).nations?.name ?? null;
  const leagueTier = (club as any).league_tier;
  const leagueName = (club as any).league_name;
  const stadium = (club as any).stadium;
  const stadiumCapacity = (club as any).stadium_capacity;
  const foundedYear = (club as any).founded_year;
  const shortName = (club as any).short_name;

  // Query players by club_id through people table, not by name match
  const { data: peopleData } = await supabaseServer
    .from("people")
    .select("id")
    .eq("club_id", clubId);

  const personIds = (peopleData ?? []).map((p: any) => p.id);

  let players: ClubPlayer[] = [];
  if (personIds.length > 0) {
    const { data: playersData } = await supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, dob, position, level, peak, archetype, pursuit_status, personality_type, market_value_tier, true_mvt")
      .in("person_id", personIds)
      .order("level", { ascending: false });
    players = (playersData ?? []) as ClubPlayer[];
  }

  // Position depth
  const positionCounts: Record<string, ClubPlayer[]> = {};
  for (const pos of POSITIONS) {
    positionCounts[pos] = players.filter((p) => p.position === pos);
  }

  // Squad analysis
  const ages = players.map((p) => computeAge(p.dob)).filter((a): a is number => a !== null);
  const avgAge = ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "–";
  const levels = players.map((p) => p.level).filter((l): l is number => l !== null);
  const avgLevel = levels.length > 0 ? (levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1) : "–";

  // Archetype distribution
  const archetypeCounts: Record<string, number> = {};
  for (const p of players) {
    if (p.archetype) {
      const primary = p.archetype.split("-")[0];
      archetypeCounts[primary] = (archetypeCounts[primary] ?? 0) + 1;
    }
  }
  const archetypeEntries = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1]);

  // Transfer requirements: positions with gaps
  const gaps = POSITIONS.filter((pos) => {
    const count = positionCounts[pos]?.length ?? 0;
    return count < 2;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/clubs" className="text-xs text-[var(--accent-personality)] hover:underline mb-2 inline-block">&larr; All Clubs</Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {clubName}
          {shortName && shortName !== clubName && (
            <span className="text-base font-normal text-[var(--text-muted)] ml-2">({shortName})</span>
          )}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {[nationName, leagueName || (leagueTier ? `Tier ${leagueTier}` : null), foundedYear ? `Est. ${foundedYear}` : null].filter(Boolean).join(" · ")} · {players.length} players
        </p>
        {stadium && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {stadium}{stadiumCapacity ? ` (${stadiumCapacity.toLocaleString()} capacity)` : ""}
          </p>
        )}
      </div>

      {players.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No players linked to this club yet.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Players are linked via pipeline scripts or manual assignment.</p>
        </div>
      ) : (
        <>
          {/* Row 1: Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: "Squad Size", value: players.length.toString() },
              { label: "Avg Age", value: avgAge },
              { label: "Avg Level", value: avgLevel },
              { label: "With Profile", value: players.filter((p) => p.archetype).length.toString() },
              { label: "Tracked", value: players.filter((p) => p.pursuit_status && p.pursuit_status !== "Pass").length.toString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">{label}</p>
                <p className="text-xl font-mono font-bold text-[var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>

          {/* Row 2: Position Depth + Transfer Requirements + Archetypes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Position Depth */}
            <div className="lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
                Positional Depth
              </h2>
              <div className="space-y-3">
                {POSITIONS.map((pos) => {
                  const posPlayers = positionCounts[pos] ?? [];
                  const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
                  const isWeak = posPlayers.length < 2;
                  return (
                    <div key={pos}>
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[10px] font-bold tracking-wider w-7 text-center px-1 py-0.5 rounded ${posColor} text-white`}>
                          {pos}
                        </span>
                        <span className={`text-sm font-mono ${isWeak ? "text-[var(--sentiment-negative)]" : "text-[var(--text-secondary)]"}`}>
                          {posPlayers.length}
                        </span>
                        {isWeak && <span className="text-[10px] font-medium text-[var(--sentiment-negative)]">gap</span>}
                      </div>
                      <div className="ml-10 flex flex-wrap gap-1">
                        {posPlayers.map((p) => (
                          <Link
                            key={p.person_id}
                            href={`/players/${p.person_id}`}
                            className="text-xs px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            {p.name}{p.level != null ? ` (${p.level})` : ""}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column: Transfer Requirements + Archetypes */}
            <div className="space-y-4">
              {/* Transfer Requirements */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
                  Transfer Requirements
                </h2>
                {gaps.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No critical gaps detected</p>
                ) : (
                  <div className="space-y-2">
                    {gaps.map((pos) => {
                      const count = positionCounts[pos]?.length ?? 0;
                      const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
                      return (
                        <div key={pos} className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white`}>{pos}</span>
                          <span className="text-xs text-[var(--sentiment-negative)]">
                            {count === 0 ? "No cover" : "Needs depth"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Archetype Distribution */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
                  Archetype Distribution
                </h2>
                {archetypeEntries.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No archetypes assigned</p>
                ) : (
                  <div className="space-y-2">
                    {archetypeEntries.slice(0, 8).map(([archetype, count]) => (
                      <div key={archetype} className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-secondary)]">{archetype}</span>
                        <span className="text-sm font-mono text-[var(--text-primary)]">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Full Squad */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
              Full Squad
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="text-left py-2 font-medium">Player</th>
                    <th className="text-left py-2 font-medium">Pos</th>
                    <th className="text-right py-2 font-medium">Age</th>
                    <th className="text-right py-2 font-medium">Level</th>
                    <th className="text-right py-2 font-medium">Peak</th>
                    <th className="text-left py-2 font-medium">Archetype</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const age = computeAge(p.dob);
                    const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
                    return (
                      <tr key={p.person_id} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-elevated)]/30">
                        <td className="py-2">
                          <Link href={`/players/${p.person_id}`} className="text-[var(--text-primary)] hover:text-white">
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white`}>
                            {p.position ?? "–"}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono text-[var(--text-secondary)]">{age ?? "–"}</td>
                        <td className="py-2 text-right font-mono font-bold">{p.level ?? "–"}</td>
                        <td className="py-2 text-right font-mono text-[var(--text-secondary)]">{p.peak ?? "–"}</td>
                        <td className="py-2 text-xs text-[var(--text-secondary)]">{p.archetype ?? "–"}</td>
                        <td className="py-2 text-xs text-[var(--text-muted)]">{p.pursuit_status ?? "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
