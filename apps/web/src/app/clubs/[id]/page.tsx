import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { POSITIONS, POSITION_COLORS } from "@/lib/types";
import { computeAge } from "@/lib/types";
import { MiniRadar } from "@/components/MiniRadar";
import { getRoleRadarConfig } from "@/lib/role-radar";
import { getArchetypeColor } from "@/lib/archetype-styles";

interface ClubPlayer {
  person_id: number;
  name: string;
  dob: string | null;
  position: string | null;
  level: number | null;
  overall: number | null;
  archetype: string | null;
  pursuit_status: string | null;
  scouting_notes: string | null;
  squad_role: string | null;
  nation: string | null;
  fingerprint: number[] | null;
  best_role: string | null;
  side: string | null;
}

interface ClubPageProps {
  params: Promise<{ id: string }>;
}

function ratingColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 88) return "text-amber-400";
  if (level >= 83) return "text-green-400";
  if (level >= 78) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function ageGroup(age: number | null): "academy" | "developing" | "prime" | "veteran" | "unknown" {
  if (age == null) return "unknown";
  if (age <= 21) return "academy";
  if (age <= 25) return "developing";
  if (age <= 29) return "prime";
  return "veteran";
}

const AGE_GROUPS = [
  { key: "academy", label: "U21", color: "bg-blue-500/30", textColor: "text-blue-400" },
  { key: "developing", label: "22-25", color: "bg-green-500/30", textColor: "text-green-400" },
  { key: "prime", label: "26-29", color: "bg-amber-500/30", textColor: "text-amber-400" },
  { key: "veteran", label: "30+", color: "bg-red-500/30", textColor: "text-red-400" },
] as const;

export default async function ClubDetailPage({ params }: ClubPageProps) {
  const { id } = await params;
  const clubId = parseInt(id, 10);

  if (!supabaseServer || isNaN(clubId)) {
    return <div className="text-sm text-[var(--text-secondary)]">Invalid club or Supabase not configured.</div>;
  }

  const [{ data: club }, { data: ratingData }] = await Promise.all([
    supabaseServer
      .from("clubs")
      .select("id, clubname, league_name, stadium, stadium_capacity, founded_year, short_name, logo_url, wikidata_id, philosophy_id, nations(name), tactical_philosophies(name, slug)")
      .eq("id", clubId)
      .single(),
    supabaseServer
      .from("club_ratings")
      .select("power_rating, projected_gd, confidence, xg_diff_score, squad_value_score, defensive_score, buildup_score, data_sources")
      .eq("club_id", clubId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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
  const philosophyData = (club as any).tactical_philosophies;

  // Fetch players
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
      .select("person_id, name, dob, position, level, overall, archetype, pursuit_status, scouting_notes, squad_role, nation, fingerprint, best_role, side")
      .in("person_id", personIds)
      .order("overall", { ascending: false, nullsFirst: false });
    players = (playersData ?? []) as ClubPlayer[];
  }

  // Computed analysis
  const ages = players.map((p) => computeAge(p.dob)).filter((a): a is number => a !== null);
  const avgAge = ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length) : null;
  const ratings = players.map((p) => p.overall).filter((l): l is number => l !== null);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;
  const topRating = ratings.length > 0 ? Math.max(...ratings) : null;
  const profiled = players.filter((p) => p.archetype).length;

  // Position depth
  const positionGroups: Record<string, ClubPlayer[]> = {};
  for (const pos of POSITIONS) {
    positionGroups[pos] = players.filter((p) => p.position === pos);
  }

  // Age profile counts
  const ageCounts: Record<string, number> = { academy: 0, developing: 0, prime: 0, veteran: 0 };
  for (const p of players) {
    const ag = ageGroup(computeAge(p.dob));
    if (ag !== "unknown") ageCounts[ag]++;
  }

  // Transfer gaps
  const gaps = POSITIONS.filter((pos) => (positionGroups[pos]?.length ?? 0) < 2);

  // Key players
  const keyPlayers = players.filter((p) => p.overall != null).slice(0, 5);

  // Archetypes (needed for both strengths analysis and playing styles display)
  const archetypeCounts: Record<string, number> = {};
  for (const p of players) {
    if (p.archetype) {
      archetypeCounts[p.archetype] = (archetypeCounts[p.archetype] ?? 0) + 1;
    }
  }
  const archetypeEntries = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1]);

  // ── Strengths & Weaknesses analysis ──────────────────────────────────────
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Squad size
  if (players.length >= 25) strengths.push("Deep squad — well covered across positions");
  else if (players.length >= 18) { /* normal */ }
  else if (players.length >= 5) weaknesses.push("Thin squad — vulnerable to injuries and fixture congestion");

  // Star power
  const elitePlayers = players.filter((p) => (p.overall ?? 0) >= 83);
  const strongPlayers = players.filter((p) => (p.overall ?? 0) >= 78);
  if (elitePlayers.length >= 5) strengths.push(`Elite core — ${elitePlayers.length} players rated 83+`);
  else if (elitePlayers.length >= 2) strengths.push(`${elitePlayers.length} high-quality starters (83+)`);
  if (strongPlayers.length < 11 && players.length >= 11) weaknesses.push("Lacks quality depth — fewer than 11 players at 78+");

  // Age balance
  const primeCount = ageCounts.prime;
  const academyCount = ageCounts.academy;
  const veteranCount = ageCounts.veteran;
  const developingCount = ageCounts.developing;
  if (academyCount >= 5 && developingCount >= 3) strengths.push("Strong youth pipeline — good mix of academy and developing talent");
  else if (academyCount + developingCount <= 2 && players.length >= 10) weaknesses.push("Ageing squad — limited young talent coming through");
  if (primeCount >= 8) strengths.push("Peak-age core — most of the squad in their prime years");
  if (veteranCount >= 6 && players.length >= 10) weaknesses.push("Heavy veteran presence — squad renewal needed soon");

  // Positional balance
  const positionsWithCover = POSITIONS.filter((pos) => (positionGroups[pos]?.length ?? 0) >= 2);
  if (positionsWithCover.length >= 8) strengths.push("Excellent positional coverage across the pitch");
  if (gaps.length >= 4) weaknesses.push(`${gaps.length} positional gaps — needs significant recruitment`);
  else if (gaps.length >= 2) {
    const gapLabels = gaps.slice(0, 3).join(", ");
    weaknesses.push(`Thin at ${gapLabels}`);
  }

  // Attack vs defence balance
  const atkPositions = ["CF", "WF", "AM", "WM"];
  const defPositions = ["GK", "CD", "WD", "DM"];
  const atkAvg = players.filter((p) => atkPositions.includes(p.position ?? "")).map((p) => p.overall ?? 0);
  const defAvg = players.filter((p) => defPositions.includes(p.position ?? "")).map((p) => p.overall ?? 0);
  const avgAtk = atkAvg.length > 0 ? atkAvg.reduce((a, b) => a + b, 0) / atkAvg.length : 0;
  const avgDef = defAvg.length > 0 ? defAvg.reduce((a, b) => a + b, 0) / defAvg.length : 0;
  if (avgAtk > avgDef + 5 && atkAvg.length >= 3) strengths.push("Attack-heavy squad — front line outpaces the defence");
  if (avgDef > avgAtk + 5 && defAvg.length >= 3) strengths.push("Defensively solid — backline is the strongest unit");
  if (avgAtk > 0 && avgDef > 0 && avgAtk < avgDef - 5 && atkAvg.length >= 3) weaknesses.push("Attacking quality lags behind defensive strength");
  if (avgDef > 0 && avgAtk > 0 && avgDef < avgAtk - 5 && defAvg.length >= 3) weaknesses.push("Defensive vulnerability — backline below the squad average");

  // Archetype diversity
  const uniqueArchetypes = Object.keys(archetypeCounts).length;
  if (uniqueArchetypes >= 8) strengths.push("Tactical versatility — diverse range of player profiles");
  else if (uniqueArchetypes <= 3 && players.length >= 10) weaknesses.push("One-dimensional squad — limited tactical flexibility");

  // Top player quality
  if (topRating != null && topRating >= 88) strengths.push(`Headline talent — best player rated ${topRating}`);
  if (avgRating != null && avgRating >= 80) strengths.push("High overall standard across the squad");
  if (avgRating != null && avgRating < 72 && players.length >= 10) weaknesses.push("Below-average squad quality overall");

  const maxAgeCount = Math.max(...Object.values(ageCounts), 1);

  return (
    <div className="space-y-2">
      <Link href={leagueName ? `/clubs?league=${encodeURIComponent(leagueName)}` : "/clubs"} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors inline-block">
        &larr; {leagueName || "Clubs"}
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
            {philosophyData && (
              <Link
                href="/tactics"
                className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded mt-1 bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30 hover:bg-[var(--color-accent-tactical)]/25 transition-colors"
              >
                {philosophyData.name}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {wikidataId && (
              <a href={`https://www.wikidata.org/wiki/${wikidataId}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Wiki</a>
            )}
          </div>
        </div>

        {/* Metrics */}
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
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Avg OVR</span>
            <span className={`text-sm font-mono font-bold ${ratingColor(avgRating != null ? Math.round(avgRating) : null)}`}>
              {avgRating != null ? avgRating.toFixed(1) : "–"}
            </span>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Top OVR</span>
            <span className={`text-sm font-mono font-bold ${ratingColor(topRating)}`}>
              {topRating ?? "–"}
            </span>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Profiled</span>
            <span className="text-sm font-mono font-bold">{profiled}<span className="text-[var(--text-muted)]">/{players.length}</span></span>
          </div>
        </div>
      </div>

      {/* Power Rating */}
      {ratingData && (() => {
        const r = ratingData as any;
        const rating = Number(r.power_rating);
        const conf = Number(r.confidence);
        const gd = r.projected_gd != null ? Number(r.projected_gd) : null;
        const pillars = [
          { label: "xG Diff", score: r.xg_diff_score != null ? Number(r.xg_diff_score) : null, color: "bg-[var(--color-accent-tactical)]" },
          { label: "Squad Value", score: r.squad_value_score != null ? Number(r.squad_value_score) : null, color: "bg-[var(--color-accent-personality)]" },
          { label: "Defense", score: r.defensive_score != null ? Number(r.defensive_score) : null, color: "bg-[var(--color-accent-physical)]" },
          { label: "Buildup", score: r.buildup_score != null ? Number(r.buildup_score) : null, color: "bg-[var(--color-accent-mental)]" },
        ];
        const ratingColorClass = rating >= 90 ? "text-amber-400" : rating >= 80 ? "text-green-400" : rating >= 70 ? "text-[var(--text-primary)]" : rating >= 60 ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]";
        const confLabel = conf >= 0.7 ? "High" : conf >= 0.4 ? "Medium" : "Low";
        const confColor = conf >= 0.7 ? "text-green-400" : conf >= 0.4 ? "text-amber-400" : "text-[var(--text-muted)]";

        return (
          <div className="glass rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Power</span>
                <span className={`text-3xl font-mono font-bold ${ratingColorClass}`}>{rating.toFixed(1)}</span>
              </div>
              <div className="flex-1 space-y-1.5">
                {pillars.map(({ label, score, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[9px] text-[var(--text-muted)] w-20">{label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div className={`h-full rounded-full ${color}/50`} style={{ width: `${score ?? 0}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)] w-6 text-right">{score != null ? Math.round(score) : "–"}</span>
                  </div>
                ))}
              </div>
              <div className="text-center shrink-0 space-y-1">
                {gd != null && (
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">GD/M</span>
                    <span className={`text-sm font-mono font-bold ${gd > 0 ? "text-green-400" : gd < 0 ? "text-red-400" : "text-[var(--text-secondary)]"}`}>{gd > 0 ? "+" : ""}{gd.toFixed(2)}</span>
                  </div>
                )}
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">Conf</span>
                  <span className={`text-[10px] font-semibold ${confColor}`}>{confLabel}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {keyPlayers.map((p) => {
                  const age = computeAge(p.dob);
                  const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
                  return (
                    <Link key={p.person_id} href={`/players/${p.person_id}`} className="bg-[var(--bg-elevated)] rounded-lg p-2.5 hover:bg-[var(--bg-elevated)]/80 transition-colors group">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${posColor} text-white`}>{p.position}</span>
                        <span className={`text-base font-mono font-bold ${ratingColor(p.overall)}`}>{p.overall ?? "–"}</span>
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {[age != null ? `${age}y` : null, p.archetype].filter(Boolean).join(" · ")}
                      </div>
                      {p.fingerprint?.some(v => v > 0) && (() => {
                        const { labels } = getRoleRadarConfig(p.best_role, p.position);
                        const trimmedLabels = labels.length === p.fingerprint!.length ? labels : labels.slice(0, p.fingerprint!.length);
                        return (
                          <div className="flex justify-center mt-1.5">
                            <MiniRadar values={p.fingerprint!} size={48} color="rgba(52,211,153,0.7)" labels={trimmedLabels} />
                          </div>
                        );
                      })()}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          {(strengths.length > 0 || weaknesses.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {strengths.length > 0 && (
                <div className="glass rounded-xl p-3 sm:p-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-tactical)] mb-2">Strengths</h2>
                  <ul className="space-y-1.5">
                    {strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                        <span className="text-[var(--color-accent-tactical)] shrink-0 mt-px">+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {weaknesses.length > 0 && (
                <div className="glass rounded-xl p-3 sm:p-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sentiment-negative)] mb-2">Weaknesses</h2>
                  <ul className="space-y-1.5">
                    {weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                        <span className="text-[var(--color-sentiment-negative)] shrink-0 mt-px">&minus;</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Two-column: Positional Depth + Squad Profile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Positional Depth */}
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
                            {p.overall != null && <span className={`ml-1 font-mono ${ratingColor(p.overall)}`}>{p.overall}</span>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Squad Profile — merged card */}
            <div className="glass rounded-xl p-3 sm:p-4 space-y-4">
              {/* Age Profile */}
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Age Profile</h2>
                <div className="space-y-1.5">
                  {AGE_GROUPS.map(({ key, label, color, textColor }) => {
                    const count = ageCounts[key];
                    const pct = maxAgeCount > 0 ? Math.round((count / maxAgeCount) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--text-muted)] w-10">{label}</span>
                        <div className="flex-1 h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-mono font-bold w-5 text-right ${textColor}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transfer Needs */}
              {gaps.length > 0 && (
                <div className="pt-3 border-t border-[var(--border-subtle)]">
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

              {/* Playing Styles */}
              {archetypeEntries.length > 0 && (
                <div className="pt-3 border-t border-[var(--border-subtle)]">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Playing Styles</h2>
                  <div className="space-y-1.5">
                    {archetypeEntries.slice(0, 6).map(([archetype, count]) => {
                      const pct = Math.round((count / players.length) * 100);
                      return (
                        <div key={archetype} className="flex items-center gap-2">
                          <span className="text-[10px] w-28 truncate" style={{ color: getArchetypeColor(archetype) }}>{archetype}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: getArchetypeColor(archetype), opacity: 0.5 }} />
                          </div>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] w-4 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full Squad */}
          <div className="glass rounded-xl p-3 sm:p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Full Squad</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="text-left py-1.5 font-medium">Player</th>
                    <th className="text-left py-1.5 font-medium">Pos</th>
                    <th className="text-right py-1.5 font-medium">Age</th>
                    <th className="text-right py-1.5 font-medium">OVR</th>
                    <th className="text-left py-1.5 font-medium">Archetype</th>
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
                            {p.position ?? "–"}{p.side && ["WF", "WD", "WM"].includes(p.position ?? "") ? ` (${p.side.charAt(0).toUpperCase()})` : ""}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-xs font-mono text-[var(--text-secondary)]">{age ?? "–"}</td>
                        <td className={`py-1.5 text-right text-xs font-mono font-bold ${ratingColor(p.overall)}`}>{p.overall ?? "–"}</td>
                        <td className="py-1.5 text-[10px]">
                          {p.archetype ? (
                            <span style={{ color: getArchetypeColor(p.archetype) }}>{p.archetype}</span>
                          ) : "–"}
                        </td>
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
