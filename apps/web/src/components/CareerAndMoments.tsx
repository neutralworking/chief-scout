"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CareerEntry {
  club_name: string;
  start_date: string | null;
  end_date: string | null;
  is_loan: boolean;
  club_id: number | null;
  team_type: string | null;
}

export interface CareerMetrics {
  clubs_count: number;
  loan_count: number;
  career_years: number;
  avg_tenure_yrs: number;
  loyalty_score: number;
  mobility_score: number;
  trajectory: string | null;
}

export interface KeyMoment {
  id: number;
  title: string;
  description: string | null;
  moment_date: string | null;
  moment_type: string | null;
  sentiment: string | null;
  source_url: string | null;
}

interface Props {
  entries: CareerEntry[];
  metrics: CareerMetrics | null;
  moments: KeyMoment[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "var(--sentiment-positive)",
  negative: "var(--sentiment-negative)",
  neutral: "var(--sentiment-neutral)",
};

function formatDate(date: string | null): string {
  if (!date) return "Present";
  const d = new Date(date);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function calcDuration(start: string | null, end: string | null): string {
  if (!start) return "";
  const from = new Date(start);
  const to = end ? new Date(end) : new Date();
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0 && rem === 0) return "< 1m";
  if (years === 0) return `${rem}m`;
  if (rem === 0) return `${years}y`;
  return `${years}y ${rem}m`;
}

function trajectoryColor(t: string | null): string {
  if (!t) return "var(--text-muted)";
  const lower = t.toLowerCase();
  if (lower === "upward" || lower === "rising") return "var(--accent-tactical)";
  if (lower === "stable" || lower === "steady" || lower === "peak") return "var(--accent-technical)";
  if (lower === "downward" || lower === "declining") return "#ef4444";
  return "var(--text-secondary)";
}

type Tab = "career" | "moments";

// ── Component ────────────────────────────────────────────────────────────────

export function CareerAndMoments({ entries, metrics, moments }: Props) {
  const hasMoments = moments.length > 0;
  const hasCareer = entries.length > 0;
  const [tab, setTab] = useState<Tab>(hasCareer ? "career" : "moments");
  const [momentsExpanded, setMomentsExpanded] = useState(false);

  // Separate entries by team type
  const seniorEntries = entries.filter((e) => !e.team_type || e.team_type === "senior_club");
  const internationalEntries = entries.filter((e) => e.team_type === "national_team");
  const youthEntries = entries.filter((e) => e.team_type === "youth" || e.team_type === "reserve");

  if (!hasCareer && !hasMoments) return null;

  // Sort moments chronologically (earliest first)
  const sortedMoments = [...moments].sort((a, b) => {
    if (!a.moment_date && !b.moment_date) return 0;
    if (!a.moment_date) return 1;
    if (!b.moment_date) return -1;
    return a.moment_date.localeCompare(b.moment_date);
  });

  const tabs: { key: Tab; label: string; count?: number }[] = [];
  if (hasCareer) tabs.push({ key: "career", label: "Career" });
  if (hasMoments) tabs.push({ key: "moments", label: "Key Moments", count: moments.length });

  const MOMENT_LIMIT = 8;
  const visibleMoments = momentsExpanded ? sortedMoments : sortedMoments.slice(0, MOMENT_LIMIT);

  return (
    <div className="glass rounded-xl p-4">
      {/* Tab bar */}
      {tabs.length > 1 ? (
        <div className="flex gap-4 mb-3 border-b border-[var(--border-subtle)] -mx-4 px-4" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`pb-2 text-[10px] font-bold tracking-wider uppercase transition-colors relative ${
                tab === t.key
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className="ml-1 text-[9px] font-mono text-[var(--text-muted)]">{t.count}</span>
              )}
              {tab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-[var(--accent-personality)]" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
          {tabs[0]?.label ?? "Career"}
        </h3>
      )}

      {/* Career tab */}
      {tab === "career" && hasCareer && (
        <div>
          {/* Metrics row */}
          {metrics && (
            <div className="flex flex-wrap gap-3 mb-3 text-center">
              <MiniStat label="Clubs" value={metrics.clubs_count} />
              <MiniStat label="Years" value={metrics.career_years} />
              <MiniStat label="Avg Tenure" value={`${metrics.avg_tenure_yrs.toFixed(1)}y`} />
              <MiniStat label="Trajectory" value={metrics.trajectory ? metrics.trajectory.charAt(0).toUpperCase() + metrics.trajectory.slice(1) : "—"} color={trajectoryColor(metrics.trajectory)} />
            </div>
          )}

          {/* Senior club career timeline */}
          <CareerTimeline entries={seniorEntries} />

          {/* International section */}
          {internationalEntries.length > 0 && (
            <details className="mt-3">
              <summary className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-mental)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors mb-2">
                International ({internationalEntries.length})
              </summary>
              <CareerTimeline entries={internationalEntries} accent="var(--accent-mental)" />
            </details>
          )}

          {/* Youth / Reserve section */}
          {youthEntries.length > 0 && (
            <details className="mt-3">
              <summary className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors mb-2">
                Academy &amp; Youth ({youthEntries.length})
              </summary>
              <CareerTimeline entries={youthEntries} accent="var(--text-muted)" />
            </details>
          )}
        </div>
      )}

      {/* Moments tab */}
      {tab === "moments" && hasMoments && (
        <div>
          <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
            {visibleMoments.map((m) => (
              <div
                key={m.id}
                className="flex gap-2 items-start px-2 py-1.5 -mx-2 rounded-md"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: SENTIMENT_COLORS[m.sentiment ?? "neutral"] ?? "var(--text-muted)" }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">{m.title}</span>
                  {m.description && (
                    <span className="text-[10px] text-[var(--text-muted)] line-clamp-1 block mt-0.5">{m.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.moment_date && (
                    <span className="text-[9px] text-[var(--text-muted)] font-mono">{formatDate(m.moment_date)}</span>
                  )}
                  {m.source_url && (
                    <a
                      href={m.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] font-medium hover:underline"
                      style={{ color: "var(--accent-personality)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      ref
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          {sortedMoments.length > MOMENT_LIMIT && (
            <button
              onClick={() => setMomentsExpanded(!momentsExpanded)}
              className="mt-2 text-[10px] font-medium tracking-wide hover:underline"
              style={{ color: "var(--accent-personality)" }}
            >
              {momentsExpanded ? "Show Less" : `See All (${sortedMoments.length}) →`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CareerTimeline({ entries, accent }: { entries: CareerEntry[]; accent?: string }) {
  if (entries.length === 0) return null;
  return (
    <div className="relative ml-2 max-h-[280px] overflow-y-auto pb-1">
      <div className="absolute left-0 top-1 bottom-1 w-px bg-[var(--border-subtle)]" />
      <div className="space-y-0">
        {entries.map((e, i) => {
          const isActive = !e.end_date;
          const activeColor = accent ?? "var(--accent-tactical)";
          return (
            <div key={i} className="relative pl-5 pb-3 last:pb-0">
              <div
                className="absolute left-0 top-[5px] w-2 h-2 rounded-full -translate-x-[3.5px] border-[1.5px]"
                style={{
                  borderColor: isActive ? activeColor : e.is_loan ? "var(--accent-physical)" : "var(--text-secondary)",
                  backgroundColor: isActive ? activeColor : "transparent",
                  boxShadow: isActive ? `0 0 6px ${activeColor}66` : undefined,
                }}
              />
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex items-center gap-1.5">
                  {e.club_id ? (
                    <Link href={`/clubs/${e.club_id}`} className="text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-tactical)] transition-colors truncate">
                      {e.club_name}
                    </Link>
                  ) : (
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate">{e.club_name}</span>
                  )}
                  {e.is_loan && (
                    <span className="text-[8px] font-bold tracking-wider uppercase px-1 py-0.5 rounded text-[var(--accent-physical)] bg-[var(--accent-physical)]/10">Loan</span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0 font-mono">
                  {calcDuration(e.start_date, e.end_date)}
                </span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {formatDate(e.start_date)} — {formatDate(e.end_date)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[var(--bg-elevated)] rounded px-2 py-1">
      <div className="text-xs font-bold font-mono" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
