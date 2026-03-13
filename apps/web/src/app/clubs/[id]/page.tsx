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
  archetype: string | null;
  pursuit_status: string | null;
  scouting_notes: string | null;
  squad_role: string | null;
  nation: string | null;
}

interface ClubPageProps {
  params: Promise<{ id: string }>;
}

function levelColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 88) return "text-amber-400";
  if (level >= 83) return "text-green-400";
  if (level >= 78) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function ageGroup(age: number | null): string {
  if (age == null) return "unknown";
  if (age <= 21) return "academy";
  if (age <= 25) return "developing";
  if (age <= 29) return "prime";
  return "veteran";
}

const AGE_GROUP_LABELS: Record<string, string> = {
  academy: "U21",
  developing: "22-25",
  prime: "26-29",
  veteran: "30+",
};

const AGE_GROUP_COLORS: Record<string, string> = {
  academy: "bg-blue-500/20 text-blue-400",
  developing: "bg-green-500/20 text-green-400",
  prime: "bg-amber-500/20 text-amber-400",
  veteran: "bg-red-500/20 text-red-400",
};

export default async function ClubDetailPage({ params }: ClubPageProps) {
  const { id } = await params;
  const clubId = parseInt(id, 10);

  if (!supabaseServer || isNaN(clubId)) {
    return <div className="text-sm text-[var(--text-secondary)]">Invalid club or Supabase not configured.</div>;
  }

  const { data: club } = await supabaseServer
    .from("clubs")
    .select("id, clubname, league_name, stadium, stadium_capacity, founded_year, short_name, logo_url, wikidata_id, nations(name)")
    .eq("id", clubId)
    .single();

  if (!club) {
    return <div className="text-sm text-[var(--text-secondary)]">Club not found.</div>;
  }

  const clubName = (club as any).clubname;
  const nationName = (club as any).nations?.name ?? null;
  const leagueName = (club as any).league_name;
  const stadium = (club as any).stadium;
  const stadiumCapacity = (club as any).stadium_capacity;
  const foundedYear = (club as any).founded_year;
  const shortName = (club as any).short_name;
  const logoUrl = (club as any).logo_url;
  const wikidataId = (club as any).wikidata_id;

  // Fetch players via people → intelligence card
  const { data: peopleData } = await supabaseServer
    .from("people")
    .select("id")
    .eq("club_id", clubId)
    .eq("active", true);

  const personIds = (peopleData ?? []).map((p: any) => p.id);

  let players: ClubPlayer[] = [];
  if (personIds.length > 0) {
    const { data: playersData } = await supabaseServer
      .from("player_intelligence_card")
      .select("person_id, name, dob, position, level, archetype, pursuit_status, scouting_notes, squad_role, nation")
      .in("person_id", personIds)
      .order("level", { ascending: false, nullsFirst: false });
    players = (playersData ?? []) as ClubPlayer[];
  }

  // --- Computed squad analysis ---
  const ages = players.map((p) => computeAge(p.dob)).filter((a): a is number => a !== null);
  const avgAge = ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length) : null;
  const levels = players.map((p) => p.level).filter((l): l is number => l !== null);
  const avgLevel = levels.length > 0 ? (levels.reduce((a, b) => a + b, 0) / levels.length) : null;
  const topLevel = levels.length > 0 ? Math.max(...levels) : null;
  const profiled = players.filter((p) => p.archetype).length;

  // Position depth
  const positionGroups: Record<string, ClubPlayer[]> = {};
  for (const pos of POSITIONS) {
    positionGroups[pos] = players.filter((p) => p.position === pos);
  }

  // Age profile
  const ageGroups: Record<string, ClubPlayer[]> = { academy: [], developing: [], prime: [], veteran: [], unknown: [] };
  for (const p of players) {
    const ag = ageGroup(computeAge(p.dob));
    ageGroups[ag].push(p);
  }

  // Transfer gaps: positions with < 2 players
  const gaps = POSITIONS.filter((pos) => (positionGroups[pos]?.length ?? 0) < 2);

  // Key players: top 5 by level
  const keyPlayers = players.filter((p) => p.level != null).slice(0, 5);

  // Archetype distribution
  const archetypeCounts: Record<string, number> = {};
  for (const p of players) {
    if (p.archetype) {
      archetypeCounts[p.archetype] = (archetypeCounts[p.archetype] ?? 0) + 1;
    }
  }
  const archetypeEntries = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1]);

  // Nations in squad
  const nationCounts: Record<string, number> = {};
  for (const p of players) {
    if (p.nation) {
      nationCounts[p.nation] = (nationCounts[p.nation] ?? 0) + 1;
    }
  }
  const nationEntries = Object.entries(nationCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      <Link href="/clubs" className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors inline-block">
        &larr; Clubs
      </Link>

      {/* Header */}
      <div className="glass rounded-xl p-3 sm:p-4">
        <div className="flex items-start gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={clubName} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-contain bg-white/10 p-1 shrink-0" />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-xs sm:text-sm font-bold text-[var(--text-muted)] shrink-0">
              {(shortName || clubName).slice(0, 3).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">{clubName}</h1>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-secondary)] flex-wrap">
              {nationName && <span>{nationName}</span>}
              {leagueName && <><span className="text-[var(--text-muted)]">&middot;</span><span>{leagueName}</span></>}
              {foundedYear && <><span className="text-[var(--text-muted)]">&middot;</span><span>Est. {foundedYear}</span></>}
            </div>
            {stadium && (
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {stadium}{stadiumCapacity ? ` (${stadiumCapacity.toLocaleString()})` : ""}
              </div>
            )}
          </div>
          {/* External links */}
          <div className="flex items-center gap-2 shrink-0">
            {wikidataId && (
              <a href={`https://www.wikidata.org/wiki/${wikidataId}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Wiki</a>
            )}
          </div>
        </div>

        {/* Key metrics row */}
        <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Squad</span>
            <span className="text-sm font-mono font-bold">{players.length}</span>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Avg Age</span>
            <span className="text-sm font-mono font-bold">{avgAge != null ? avgAge.toFixed(1) : "–"}</span>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Avg Level</span>
            <span className={`text-sm font-mono font-bold ${levelColor(avgLevel != null ? Math.round(avgLevel) : null)}`}>
              {avgLevel != null ? avgLevel.toFixed(1) : "–"}
            </span>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Top Level</span>
            <span className={`text-sm font-mono font-bold ${levelColor(topLevel)}`}>
              {topLevel ?? "–"}
            </span>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Profiled</span>
            <span className="text-sm font-mono font-bold">{profiled}<span className="text-[var(--text-muted)]">/{players.length}</span></span>
          </div>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No active players linked to this club.</p>
        </div>
      ) : (
        <>
          {/* Key Players */}
          {keyPlayers.length > 0 && (
            <div className="glass rounded-xl p-3 sm:p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Key Players</h2>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {keyPlayers.map((p) => {
                  const age = computeAge(p.dob);
                  const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
                  return (
                    <Link key={p.person_id} href={`/players/${p.person_id}`} className="bg-[var(--bg-elevated)] rounded-lg p-2.5 hover:bg-[var(--bg-elevated)]/80 transition-colors group">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${posColor} text-white`}>{p.position}</span>
                        <span className={`text-base font-mono font-bold ${levelColor(p.level)}`}>{p.level}</span>
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {[age != null ? `${age}y` : null, p.archetype].filter(Boolean).join(" · ")}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Left: Position Depth */}
            <div className="glass rounded-xl p-3 sm:p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Positional Depth</h2>
              <div className="space-y-2.5">
                {POSITIONS.map((pos) => {
                  const posPlayers = positionGroups[pos] ?? [];
                  const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
                  const isWeak = posPlayers.length < 2;
                  return (
                    <div key={pos}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold tracking-wider w-7 text-center px-1 py-0.5 rounded ${posColor} text-white`}>{pos}</span>
                        <span className={`text-[10px] font-mono ${isWeak ? "text-[var(--sentiment-negative)]" : "text-[var(--text-muted)]"}`}>
                          {posPlayers.length}
                        </span>
                        {isWeak && <span className="text-[9px] font-medium text-[var(--sentiment-negative)]">gap</span>}
                      </div>
                      <div className="ml-9 flex flex-wrap gap-1">
                        {posPlayers.map((p) => (
                          <Link
                            key={p.person_id}
                            href={`/players/${p.person_id}`}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            {p.name}
                            {p.level != null && <span className={`ml-1 font-mono ${levelColor(p.level)}`}>{p.level}</span>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Age Profile + Gaps + Archetypes + Nations */}
            <div className="space-y-2">
              {/* Age Profile */}
              <div className="glass rounded-xl p-3 sm:p-4">
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Age Profile</h2>
                <div className="grid grid-cols-4 gap-2">
                  {(["academy", "developing", "prime", "veteran"] as const).map((ag) => {
                    const count = ageGroups[ag].length;
                    const pct = players.length > 0 ? Math.round((count / players.length) * 100) : 0;
                    return (
                      <div key={ag} className="text-center">
                        <div className={`text-lg font-mono font-bold ${AGE_GROUP_COLORS[ag].split(" ")[1]}`}>{count}</div>
                        <div className="text-[9px] text-[var(--text-muted)]">{AGE_GROUP_LABELS[ag]}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                          <div className={`h-full rounded-full ${AGE_GROUP_COLORS[ag].split(" ")[0]}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transfer Gaps */}
              {gaps.length > 0 && (
                <div className="glass rounded-xl p-3 sm:p-4 border-l-2 border-l-[var(--sentiment-negative)]">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Transfer Needs</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {gaps.map((pos) => {
                      const count = positionGroups[pos]?.length ?? 0;
                      const posColor = POSITION_COLORS[pos] ?? "bg-zinc-700/60";
                      return (
                        <div key={pos} className="flex items-center gap-1.5 bg-[var(--bg-elevated)] rounded px-2 py-1">
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${posColor} text-white`}>{pos}</span>
                          <span className="text-[10px] text-[var(--sentiment-negative)]">
                            {count === 0 ? "No cover" : "Needs depth"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Archetypes */}
              {archetypeEntries.length > 0 && (
                <div className="glass rounded-xl p-3 sm:p-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Playing Styles</h2>
                  <div className="space-y-1.5">
                    {archetypeEntries.slice(0, 8).map(([archetype, count]) => {
                      const pct = Math.round((count / players.length) * 100);
                      return (
                        <div key={archetype} className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--text-secondary)] w-28 truncate">{archetype}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                            <div className="h-full rounded-full bg-[var(--accent-tactical)]/40" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] w-4 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nationalities */}
              {nationEntries.length > 0 && (
                <div className="glass rounded-xl p-3 sm:p-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Nationalities</h2>
                  <div className="flex flex-wrap gap-1">
                    {nationEntries.slice(0, 12).map(([nation, count]) => (
                      <span key={nation} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                        {nation} <span className="font-mono text-[var(--text-muted)]">{count}</span>
                      </span>
                    ))}
                    {nationEntries.length > 12 && (
                      <span className="text-[10px] px-1.5 py-0.5 text-[var(--text-muted)]">+{nationEntries.length - 12}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full Squad Table */}
          <div className="glass rounded-xl p-3 sm:p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Full Squad</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="text-left py-1.5 font-medium">Player</th>
                    <th className="text-left py-1.5 font-medium">Pos</th>
                    <th className="text-right py-1.5 font-medium">Age</th>
                    <th className="text-right py-1.5 font-medium">Lvl</th>
                    <th className="text-left py-1.5 font-medium hidden sm:table-cell">Archetype</th>
                    <th className="text-left py-1.5 font-medium hidden md:table-cell">Role</th>
                    <th className="text-left py-1.5 font-medium hidden lg:table-cell">Nation</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const age = computeAge(p.dob);
                    const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
                    return (
                      <tr key={p.person_id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30">
                        <td className="py-1.5">
                          <Link href={`/players/${p.person_id}`} className="text-xs text-[var(--text-primary)] hover:text-white transition-colors">
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-1.5">
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${posColor} text-white`}>
                            {p.position ?? "–"}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-xs font-mono text-[var(--text-secondary)]">{age ?? "–"}</td>
                        <td className={`py-1.5 text-right text-xs font-mono font-bold ${levelColor(p.level)}`}>{p.level ?? "–"}</td>
                        <td className="py-1.5 text-[10px] text-[var(--text-secondary)] hidden sm:table-cell">{p.archetype ?? "–"}</td>
                        <td className="py-1.5 text-[10px] text-[var(--text-muted)] hidden md:table-cell">
                          {p.squad_role ? p.squad_role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "–"}
                        </td>
                        <td className="py-1.5 text-[10px] text-[var(--text-muted)] hidden lg:table-cell">{p.nation ?? "–"}</td>
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
