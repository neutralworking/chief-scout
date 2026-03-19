"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

// Matches pipeline/61_fixture_ingest.py COMPETITIONS
// Extend as more competitions are ingested
const COMPETITIONS = [
  { code: "", label: "All Leagues" },
  { code: "PL", label: "Premier League" },
  { code: "PD", label: "La Liga" },
  { code: "BL1", label: "Bundesliga" },
  { code: "SA", label: "Serie A" },
  { code: "FL1", label: "Ligue 1" },
  { code: "ELC", label: "Championship" },
  { code: "DED", label: "Eredivisie" },
  { code: "PPL", label: "Primeira Liga" },
  { code: "CL", label: "Champions League" },
] as const;

interface Fixture {
  id: number;
  external_id: number | null;
  competition: string;
  competition_code: string | null;
  matchday: number | null;
  status: string;
  utc_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  home_club: ClubMeta | null;
  away_club: ClubMeta | null;
}

interface ClubMeta {
  id: number;
  clubname: string;
  short_name: string | null;
  formation: string | null;
  team_tactical_style: string | null;
  offensive_style: string | null;
  defensive_style: string | null;
  logo_url: string | null;
  league_name: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function StylePill({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
      {label}
    </span>
  );
}

function FixtureCard({ fixture }: { fixture: Fixture }) {
  const homeClub = fixture.home_club;
  const awayClub = fixture.away_club;
  const hasPreview = homeClub && awayClub;

  const card = (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 transition-all ${
        hasPreview ? "hover:border-[var(--color-accent-tactical)] cursor-pointer" : ""
      }`}
    >
      {/* Date & venue */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-[var(--color-accent-tactical)] uppercase tracking-wider">
          {formatDate(fixture.utc_date)} · {formatTime(fixture.utc_date)}
        </span>
        {fixture.matchday && (
          <span className="text-[10px] text-[var(--text-muted)]">MD{fixture.matchday}</span>
        )}
      </div>

      {/* Teams */}
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1 text-right">
          <div className="text-sm font-bold text-[var(--text-primary)] mb-1">
            {homeClub?.short_name ?? homeClub?.clubname ?? fixture.home_team}
          </div>
          <div className="flex justify-end gap-1 flex-wrap">
            <StylePill label={homeClub?.formation ?? null} />
            <StylePill label={homeClub?.team_tactical_style ?? null} />
          </div>
        </div>

        {/* VS */}
        <div className="text-[10px] font-bold text-[var(--text-muted)] px-2">vs</div>

        {/* Away */}
        <div className="flex-1">
          <div className="text-sm font-bold text-[var(--text-primary)] mb-1">
            {awayClub?.short_name ?? awayClub?.clubname ?? fixture.away_team}
          </div>
          <div className="flex gap-1 flex-wrap">
            <StylePill label={awayClub?.formation ?? null} />
            <StylePill label={awayClub?.team_tactical_style ?? null} />
          </div>
        </div>
      </div>

      {/* Venue */}
      {fixture.venue && (
        <div className="mt-2 text-[10px] text-[var(--text-muted)] text-center">
          {fixture.venue}
        </div>
      )}

      {/* Preview badge */}
      {hasPreview && (
        <div className="mt-3 text-center">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent-tactical)] bg-[var(--color-accent-tactical)]/10 px-2 py-0.5 rounded-full">
            Scout Preview Available
          </span>
        </div>
      )}
    </div>
  );

  if (hasPreview) {
    return <Link href={`/fixtures/${fixture.id}`}>{card}</Link>;
  }
  return card;
}

function FixturesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const competition = searchParams.get("competition") ?? "";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/fixtures?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (competition) params.set("competition", competition);
        params.set("days", "30");
        const res = await fetch(`/api/fixtures?${params}`);
        if (!res.ok) {
          setError(`Failed: ${res.statusText}`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setFixtures(data.fixtures ?? []);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [competition]);

  // Group fixtures by date
  const byDate: Record<string, Fixture[]> = {};
  for (const f of fixtures) {
    const dateKey = formatDate(f.utc_date);
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(f);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight mb-0.5">Fixtures & Match Previews</h1>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {loading ? "Loading..." : `${fixtures.length} upcoming matches`}
          {" · Scouting-powered tactical previews"}
        </p>
      </div>

      {/* Competition tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {COMPETITIONS.map((c) => (
          <button
            key={c.code}
            onClick={() => updateParam("competition", c.code)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              competition === c.code
                ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 rounded-lg p-3 mb-4">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-sm text-[var(--text-muted)] py-8 text-center">
          Loading fixtures...
        </div>
      )}

      {/* Fixtures by date */}
      {!loading && fixtures.length === 0 && (
        <div className="text-sm text-[var(--text-muted)] py-8 text-center">
          No upcoming fixtures found. Run the fixture ingestion pipeline to populate data.
        </div>
      )}

      {!loading &&
        Object.entries(byDate).map(([dateLabel, dateFixtures]) => (
          <div key={dateLabel} className="mb-6">
            <h2 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              {dateLabel}
            </h2>
            <div className="grid gap-2">
              {dateFixtures.map((f) => (
                <FixtureCard key={f.id} fixture={f} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

export default function FixturesPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-[var(--text-muted)]">Loading...</div>
      }
    >
      <FixturesContent />
    </Suspense>
  );
}
