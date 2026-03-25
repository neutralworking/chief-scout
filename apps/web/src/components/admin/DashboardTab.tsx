"use client";

import { useEffect, useState } from "react";
import { AdminActions } from "@/components/AdminActions";

interface DashboardData {
  stats: { totalPlayers: number; tier1Profiles: number; fullProfiles: number; tracked: number; freeAgents: number };
  coverage: { total: number; profiles: number; personality: number; market: number; status: number; attributes: number; wikidata: number; newsStories: number; newsTags: number };
  external: { understat: { matches: number; playerStats: number } };
  valuations: number;
  latestValuationAt: string | null;
  clubs: { total: number; withNation: number; withLeague: number; withWikidata: number; withStadium: number };
}

interface CrowdMismatch {
  person_id: number;
  name: string;
  position: string;
  crowd_win_pct: number;
  db_level: number;
  db_overall: number | null;
  mismatch_score: number;
  direction: "crowd_higher" | "crowd_lower";
  sample_size: number;
}

function fmt(n: number): string {
  return n === 0 ? "\u2013" : n.toLocaleString();
}

function CoverageBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          backgroundColor: pct >= 80 ? "var(--color-accent-tactical)" : pct >= 40 ? "var(--color-accent-physical)" : "var(--color-sentiment-negative)",
        }}
      />
    </div>
  );
}

export function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [crowdIntel, setCrowdIntel] = useState<CrowdMismatch[]>([]);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/admin/crowd-intel")
      .then((r) => r.json())
      .then((d) => setCrowdIntel(d.mismatches ?? []))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[var(--text-muted)] border-t-[var(--color-accent-tactical)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-[11px] text-[var(--text-secondary)]">Failed to load dashboard data.</p>;
  }

  const { stats, coverage, external, clubs, valuations, latestValuationAt } = data;

  return (
    <div className="space-y-4">
      <AdminActions />

      {/* Quick Stats */}
      <div className="card rounded-xl p-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Quick Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {[
            { label: "Total Players", value: stats.totalPlayers },
            { label: "Tier 1 Profiles", value: stats.tier1Profiles, tooltip: "Scout-assessed with archetype (tier 1)" },
            { label: "Full Profiles", value: stats.fullProfiles },
            { label: "Tracked", value: stats.tracked },
            { label: "Free Agents", value: stats.freeAgents, tooltip: "Players with contract_expiry_date set" },
            { label: "News Stories", value: coverage.newsStories },
            { label: "News Tags", value: coverage.newsTags },
            { label: "Valuations", value: valuations },
          ].map(({ label, value, tooltip }) => (
            <div key={label}>
              <p className="text-[10px] text-[var(--text-secondary)] mb-0.5" title={tooltip}>{label}</p>
              <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Coverage */}
      <div className="card rounded-xl p-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Data Coverage</h2>
        <div className="space-y-2.5">
          {[
            { label: "Profiles", value: coverage.profiles },
            { label: "Personality", value: coverage.personality },
            { label: "Market Data", value: coverage.market },
            { label: "Status", value: coverage.status },
            { label: "Wikidata", value: coverage.wikidata },
          ].map(({ label, value }) => {
            const pct = coverage.total > 0 ? Math.round((value / coverage.total) * 100) : 0;
            return (
              <div key={label}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <span className="font-mono text-[var(--text-primary)]">{value.toLocaleString()} / {coverage.total.toLocaleString()} ({pct}%)</span>
                </div>
                <CoverageBar value={value} total={coverage.total} />
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">Attribute Grades (rows)</p>
            <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{coverage.attributes.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">News Stories</p>
            <p className="text-sm font-mono font-bold text-[var(--text-primary)]">{coverage.newsStories.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Pipeline Status */}
      <div className="card rounded-xl p-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Pipeline Status</h2>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-secondary)]">Valuations last computed</span>
          <span className="text-xs font-mono text-[var(--text-primary)]">
            {latestValuationAt
              ? new Date(latestValuationAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Never"}
          </span>
        </div>
      </div>

      {/* External Data + Clubs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card rounded-xl p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">External Data</h2>
          <div className="space-y-2">
            {[
              { label: "Understat Matches", value: external.understat.matches },
              { label: "Understat Player Stats", value: external.understat.playerStats },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
                <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{fmt(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card rounded-xl p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Club Coverage</h2>
          <div className="space-y-2">
            {[
              { label: "Nation Linked", value: clubs.withNation, total: clubs.total },
              { label: "League Assigned", value: clubs.withLeague, total: clubs.total },
              { label: "Wikidata", value: clubs.withWikidata, total: clubs.total },
              { label: "Stadium", value: clubs.withStadium, total: clubs.total },
            ].map(({ label, value, total }) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-[var(--text-secondary)]">{label}</span>
                    <span className="font-mono text-[var(--text-primary)]">{pct}%</span>
                  </div>
                  <CoverageBar value={value} total={total} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Crowd Intel */}
      <div className="card rounded-xl p-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Crowd Intel</h2>
        {crowdIntel.length === 0 ? (
          <p className="text-[11px] text-[var(--text-secondary)]">Insufficient data — need more Gaffer votes to detect mismatches.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-mental)] mb-2">Crowd Says Higher</h3>
              <div className="space-y-1.5">
                {crowdIntel
                  .filter((m) => m.direction === "crowd_higher")
                  .slice(0, 10)
                  .map((m) => (
                    <div key={m.person_id} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[var(--text-primary)] truncate">{m.name}</span>
                        <span className="text-[var(--text-muted)] text-[10px]">{m.position}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-[var(--text-secondary)]">Lvl {m.db_level}</span>
                        <span className="font-mono text-[var(--color-accent-mental)]">{m.crowd_win_pct.toFixed(0)}% win</span>
                        <span className="font-mono text-[var(--text-muted)]">n={m.sample_size}</span>
                        <a href={`/editor/${m.person_id}`} className="text-[var(--color-accent-tactical)] hover:underline">Review</a>
                      </div>
                    </div>
                  ))}
                {crowdIntel.filter((m) => m.direction === "crowd_higher").length === 0 && (
                  <p className="text-[10px] text-[var(--text-muted)]">No mismatches in this direction</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sentiment-negative)] mb-2">Crowd Says Lower</h3>
              <div className="space-y-1.5">
                {crowdIntel
                  .filter((m) => m.direction === "crowd_lower")
                  .slice(0, 10)
                  .map((m) => (
                    <div key={m.person_id} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[var(--text-primary)] truncate">{m.name}</span>
                        <span className="text-[var(--text-muted)] text-[10px]">{m.position}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-[var(--text-secondary)]">Lvl {m.db_level}</span>
                        <span className="font-mono text-[var(--color-sentiment-negative)]">{m.crowd_win_pct.toFixed(0)}% win</span>
                        <span className="font-mono text-[var(--text-muted)]">n={m.sample_size}</span>
                        <a href={`/editor/${m.person_id}`} className="text-[var(--color-accent-tactical)] hover:underline">Review</a>
                      </div>
                    </div>
                  ))}
                {crowdIntel.filter((m) => m.direction === "crowd_lower").length === 0 && (
                  <p className="text-[10px] text-[var(--text-muted)]">No mismatches in this direction</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
