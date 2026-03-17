"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { computeAge, POSITION_COLORS } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface PreviewData {
  fixture: any;
  homeClub: any;
  awayClub: any;
  styleMatchup: {
    headline: string;
    narrative: string;
    keyBattle: string;
    tempo: "high" | "medium" | "low";
    spectacle: number;
  };
  predictedXI: {
    home: PredictedSlot[];
    away: PredictedSlot[];
  };
  matchups: PositionMatchup[];
  squadProfile: {
    home: SquadProfile;
    away: SquadProfile;
  };
  formationBlueprint: {
    home: { definedBy: string; philosophy: string; era: string } | null;
    away: { definedBy: string; philosophy: string; era: string } | null;
  };
}

interface PredictedSlot {
  position: string;
  role: string;
  player: {
    person_id: number;
    name: string;
    dob: string | null;
    position: string | null;
    level: number | null;
    archetype: string | null;
    personality_type: string | null;
    squad_role: string | null;
    overall: number | null;
    fitness_tag: string | null;
    scouting_notes: string | null;
  } | null;
  fitScore: number;
  demand: string;
  blueprint: string;
}

interface PositionMatchup {
  position: string;
  homePlayer: any | null;
  awayPlayer: any | null;
  homeLevel: number | null;
  awayLevel: number | null;
  advantage: "home" | "away" | "even";
}

interface SquadProfile {
  size: number;
  avgLevel: number;
  avgAge: number;
  archetypes: Record<string, number>;
  positions: Record<string, number>;
  keyPlayers: any[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function ratingColor(level: number | null): string {
  if (level == null) return "text-[var(--text-muted)]";
  if (level >= 88) return "text-amber-400";
  if (level >= 83) return "text-green-400";
  if (level >= 78) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function tempoColor(tempo: string): string {
  if (tempo === "high") return "text-red-400";
  if (tempo === "medium") return "text-amber-400";
  return "text-blue-400";
}

function advantageBadge(advantage: "home" | "away" | "even") {
  if (advantage === "home") return <span className="text-[9px] font-bold text-green-400 ml-1">HOME+</span>;
  if (advantage === "away") return <span className="text-[9px] font-bold text-red-400 ml-1">AWAY+</span>;
  return <span className="text-[9px] font-bold text-[var(--text-muted)] ml-1">EVEN</span>;
}

// ── Section Components ───────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
      {subtitle && <p className="text-[10px] text-[var(--text-muted)]">{subtitle}</p>}
    </div>
  );
}

function TacticalOverview({ data }: { data: PreviewData }) {
  const { styleMatchup, homeClub, awayClub, formationBlueprint } = data;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
      <SectionHeader title="Tactical Overview" subtitle="Playing style analysis" />

      {/* Headline */}
      <div className="text-center mb-4">
        <div className="text-base font-bold text-[var(--color-accent-tactical)] mb-1">
          {styleMatchup.headline}
        </div>
        <div className="flex items-center justify-center gap-3 text-[10px]">
          <span className={tempoColor(styleMatchup.tempo)}>
            {styleMatchup.tempo.toUpperCase()} TEMPO
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-amber-400">
            {"★".repeat(styleMatchup.spectacle)}{"☆".repeat(5 - styleMatchup.spectacle)} Entertainment
          </span>
        </div>
      </div>

      {/* Narrative */}
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4 italic">
        &ldquo;{styleMatchup.narrative}&rdquo;
      </p>

      {/* Side-by-side styles */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StyleCard club={homeClub} blueprint={formationBlueprint.home} />
        <StyleCard club={awayClub} blueprint={formationBlueprint.away} />
      </div>

      {/* Key battle */}
      <div className="bg-[var(--bg-elevated)] rounded-lg p-3 border border-[var(--border-subtle)]">
        <div className="text-[10px] font-bold text-[var(--color-accent-mental)] uppercase tracking-wider mb-1">
          Key Battle
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{styleMatchup.keyBattle}</p>
      </div>
    </div>
  );
}

function StyleCard({
  club,
  blueprint,
}: {
  club: any;
  blueprint: { definedBy: string; philosophy: string; era: string } | null;
}) {
  if (!club) return <div className="text-[var(--text-muted)] text-xs">Unknown club</div>;

  return (
    <div>
      <div className="text-xs font-bold text-[var(--text-primary)] mb-2">
        {club.short_name ?? club.clubname}
      </div>
      <div className="space-y-1">
        {club.formation && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--text-muted)] w-14">Formation</span>
            <span className="text-[10px] font-semibold text-[var(--text-primary)]">{club.formation}</span>
          </div>
        )}
        {club.team_tactical_style && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--text-muted)] w-14">Style</span>
            <span className="text-[10px] font-semibold text-[var(--color-accent-tactical)]">{club.team_tactical_style}</span>
          </div>
        )}
        {club.offensive_style && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--text-muted)] w-14">Attack</span>
            <span className="text-[10px] font-semibold text-[var(--color-accent-technical)]">{club.offensive_style}</span>
          </div>
        )}
        {club.defensive_style && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--text-muted)] w-14">Defence</span>
            <span className="text-[10px] font-semibold text-[var(--color-accent-physical)]">{club.defensive_style}</span>
          </div>
        )}
      </div>
      {blueprint && (
        <div className="mt-2 text-[9px] text-[var(--text-muted)] italic">
          {blueprint.philosophy} ({blueprint.definedBy})
        </div>
      )}
    </div>
  );
}

function PredictedXISection({ data }: { data: PreviewData }) {
  const { predictedXI, homeClub, awayClub } = data;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
      <SectionHeader title="Predicted XI" subtitle="Best available lineup based on role intelligence" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <XIPanel
          label={homeClub?.short_name ?? homeClub?.clubname ?? "Home"}
          formation={homeClub?.formation}
          slots={predictedXI.home}
        />
        <XIPanel
          label={awayClub?.short_name ?? awayClub?.clubname ?? "Away"}
          formation={awayClub?.formation}
          slots={predictedXI.away}
        />
      </div>
    </div>
  );
}

function XIPanel({
  label,
  formation,
  slots,
}: {
  label: string;
  formation: string | null;
  slots: PredictedSlot[];
}) {
  // Group slots by position
  const positionOrder = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];
  const grouped: Record<string, PredictedSlot[]> = {};
  for (const s of slots) {
    if (!grouped[s.position]) grouped[s.position] = [];
    grouped[s.position].push(s);
  }

  return (
    <div>
      <div className="text-xs font-bold text-[var(--text-primary)] mb-1">
        {label}
        {formation && <span className="text-[var(--text-muted)] font-normal ml-1">({formation})</span>}
      </div>
      <div className="space-y-0.5">
        {positionOrder.map((pos) => {
          const posSlots = grouped[pos];
          if (!posSlots) return null;
          return posSlots.map((slot, i) => (
            <div
              key={`${pos}-${i}`}
              className="flex items-center gap-2 py-1 px-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
            >
              <span
                className="text-[9px] font-bold w-6 text-center"
                style={{ color: POSITION_COLORS[pos as keyof typeof POSITION_COLORS] ?? "var(--text-muted)" }}
              >
                {pos}
              </span>
              <span className="text-[10px] font-medium text-[var(--text-muted)] w-28 truncate">
                {slot.role}
              </span>
              {slot.player ? (
                <>
                  <Link
                    href={`/players/${slot.player.person_id}`}
                    className="text-[11px] font-semibold text-[var(--text-primary)] hover:text-[var(--color-accent-tactical)] truncate flex-1"
                  >
                    {slot.player.name}
                  </Link>
                  <span className={`text-[10px] font-bold ${ratingColor(slot.player.overall ?? slot.player.level)}`}>
                    {slot.player.overall ?? slot.player.level ?? "?"}
                  </span>
                  {slot.player.archetype && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
                      {slot.player.archetype}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-[var(--text-muted)] italic flex-1">No player</span>
              )}
            </div>
          ));
        })}
      </div>
    </div>
  );
}

function KeyMatchupsSection({ data }: { data: PreviewData }) {
  const { matchups, homeClub, awayClub } = data;
  const filtered = matchups.filter((m) => m.homePlayer || m.awayPlayer);

  if (filtered.length === 0) return null;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
      <SectionHeader title="Key Matchups" subtitle="Position-by-position comparison" />

      <div className="space-y-2">
        {/* Header */}
        <div className="grid grid-cols-[1fr_40px_1fr] gap-2 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2">
          <span className="text-right">{homeClub?.short_name ?? "Home"}</span>
          <span className="text-center">POS</span>
          <span>{awayClub?.short_name ?? "Away"}</span>
        </div>

        {filtered.map((m) => (
          <div
            key={m.position}
            className="grid grid-cols-[1fr_40px_1fr] gap-2 items-center py-2 px-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
          >
            {/* Home player */}
            <div className="text-right">
              {m.homePlayer ? (
                <div>
                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                    {m.homePlayer.name}
                  </span>
                  <span className={`text-[10px] font-bold ml-1 ${ratingColor(m.homeLevel)}`}>
                    {m.homeLevel ?? "?"}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-[var(--text-muted)]">—</span>
              )}
            </div>

            {/* Position badge */}
            <div className="text-center">
              <span
                className="text-[10px] font-bold"
                style={{ color: POSITION_COLORS[m.position as keyof typeof POSITION_COLORS] ?? "var(--text-muted)" }}
              >
                {m.position}
              </span>
              <div>{advantageBadge(m.advantage)}</div>
            </div>

            {/* Away player */}
            <div>
              {m.awayPlayer ? (
                <div>
                  <span className={`text-[10px] font-bold mr-1 ${ratingColor(m.awayLevel)}`}>
                    {m.awayLevel ?? "?"}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                    {m.awayPlayer.name}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-[var(--text-muted)]">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SquadIntelligence({ data }: { data: PreviewData }) {
  const { squadProfile, homeClub, awayClub } = data;
  const home = squadProfile.home;
  const away = squadProfile.away;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
      <SectionHeader title="Squad Intelligence" subtitle="Aggregate squad comparison" />

      {/* Stats comparison */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCompare label="Avg OVR" home={home.avgLevel} away={away.avgLevel} />
        <StatCompare label="Avg Age" home={home.avgAge} away={away.avgAge} invert />
        <StatCompare label="Squad Size" home={home.size} away={away.size} />
      </div>

      {/* Archetype distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ArchetypeChart
          label={homeClub?.short_name ?? "Home"}
          archetypes={home.archetypes}
        />
        <ArchetypeChart
          label={awayClub?.short_name ?? "Away"}
          archetypes={away.archetypes}
        />
      </div>
    </div>
  );
}

function StatCompare({
  label,
  home,
  away,
  invert = false,
}: {
  label: string;
  home: number;
  away: number;
  invert?: boolean;
}) {
  const diff = invert ? away - home : home - away;
  const homeWins = diff > 0;
  const awayWins = diff < 0;

  return (
    <div className="text-center">
      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-bold ${homeWins ? "text-green-400" : "text-[var(--text-secondary)]"}`}>
          {home}
        </span>
        <span className="text-[9px] text-[var(--text-muted)]">vs</span>
        <span className={`text-sm font-bold ${awayWins ? "text-green-400" : "text-[var(--text-secondary)]"}`}>
          {away}
        </span>
      </div>
    </div>
  );
}

function ArchetypeChart({ label, archetypes }: { label: string; archetypes: Record<string, number> }) {
  const sorted = Object.entries(archetypes).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...sorted.map(([, v]) => v), 1);

  return (
    <div>
      <div className="text-[10px] font-bold text-[var(--text-primary)] mb-2">{label}</div>
      <div className="space-y-1">
        {sorted.slice(0, 6).map(([archetype, count]) => (
          <div key={archetype} className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--text-muted)] w-16 truncate">{archetype}</span>
            <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent-tactical)] rounded-full transition-all"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="text-[9px] font-bold text-[var(--text-secondary)] w-4 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoutingNotes({ data }: { data: PreviewData }) {
  const { squadProfile, homeClub, awayClub } = data;
  const homeKeys = squadProfile.home.keyPlayers;
  const awayKeys = squadProfile.away.keyPlayers;

  if (homeKeys.length === 0 && awayKeys.length === 0) return null;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
      <SectionHeader title="Scouting Notes" subtitle="Key players to watch" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KeyPlayersList
          label={homeClub?.short_name ?? "Home"}
          players={homeKeys}
        />
        <KeyPlayersList
          label={awayClub?.short_name ?? "Away"}
          players={awayKeys}
        />
      </div>
    </div>
  );
}

function KeyPlayersList({ label, players }: { label: string; players: any[] }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-[var(--text-primary)] mb-2">{label} — Players to Watch</div>
      <div className="space-y-1.5">
        {players.map((p: any) => (
          <Link
            key={p.person_id}
            href={`/players/${p.person_id}`}
            className="flex items-center gap-2 p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--color-accent-tactical)] transition-colors"
          >
            <span
              className="text-[9px] font-bold w-6 text-center"
              style={{ color: POSITION_COLORS[p.position as keyof typeof POSITION_COLORS] ?? "var(--text-muted)" }}
            >
              {p.position ?? "?"}
            </span>
            <span className="text-[11px] font-semibold text-[var(--text-primary)] flex-1">
              {p.name}
            </span>
            <span className={`text-[10px] font-bold ${ratingColor(p.level)}`}>{p.level ?? "?"}</span>
            {p.archetype && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
                {p.archetype}
              </span>
            )}
            {p.scouting_notes && (
              <span className="text-[8px] text-[var(--color-accent-mental)] max-w-[120px] truncate">
                {p.scouting_notes}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MatchPreviewPage() {
  const params = useParams();
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/fixtures/${params.id}/preview`);
        if (!res.ok) {
          setError(`Failed: ${res.statusText}`);
          setLoading(false);
          return;
        }
        setData(await res.json());
      } catch (e) {
        setError(String(e));
      }
      setLoading(false);
    }
    load();
  }, [params.id]);

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)] py-8 text-center">Loading match preview...</div>;
  }

  if (error || !data) {
    return (
      <div className="py-8 text-center">
        <div className="text-sm text-red-400 mb-2">{error ?? "Preview not available"}</div>
        <Link href="/fixtures" className="text-xs text-[var(--color-accent-tactical)] hover:underline">
          Back to fixtures
        </Link>
      </div>
    );
  }

  const { fixture, homeClub, awayClub } = data;

  return (
    <div>
      {/* Back link */}
      <Link href="/fixtures" className="text-[10px] text-[var(--text-muted)] hover:text-[var(--color-accent-tactical)] mb-3 inline-block">
        &larr; Back to fixtures
      </Link>

      {/* Match header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 mb-4">
        <div className="text-center">
          {/* Competition & date */}
          <div className="text-[10px] font-bold text-[var(--color-accent-tactical)] uppercase tracking-wider mb-1">
            {fixture.competition}
            {fixture.matchday && ` · Matchday ${fixture.matchday}`}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mb-3">
            {formatDate(fixture.utc_date)} · {formatTime(fixture.utc_date)}
          </div>

          {/* Teams */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-right flex-1">
              <div className="text-base font-bold text-[var(--text-primary)]">
                {homeClub?.short_name ?? homeClub?.clubname ?? fixture.home_team}
              </div>
              {homeClub?.style && (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{homeClub.style}</div>
              )}
            </div>

            <div className="text-lg font-bold text-[var(--text-muted)] px-3">vs</div>

            <div className="flex-1">
              <div className="text-base font-bold text-[var(--text-primary)]">
                {awayClub?.short_name ?? awayClub?.clubname ?? fixture.away_team}
              </div>
              {awayClub?.style && (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{awayClub.style}</div>
              )}
            </div>
          </div>

          {/* Venue */}
          {fixture.venue && (
            <div className="text-[10px] text-[var(--text-muted)] mt-3">{fixture.venue}</div>
          )}
        </div>
      </div>

      {/* Section 1: Tactical Overview */}
      <TacticalOverview data={data} />

      {/* Section 2: Predicted XI */}
      <PredictedXISection data={data} />

      {/* Section 3: Key Matchups */}
      <KeyMatchupsSection data={data} />

      {/* Section 4: Squad Intelligence */}
      <SquadIntelligence data={data} />

      {/* Section 5: Scouting Notes */}
      <ScoutingNotes data={data} />
    </div>
  );
}
