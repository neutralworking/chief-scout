"use client";

import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CareerEntry {
  club_name: string;
  start_date: string | null;
  end_date: string | null;
  is_loan: boolean;
  club_id: number | null;
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

interface CareerTimelineProps {
  entries: CareerEntry[];
  metrics?: CareerMetrics | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string | null): string {
  if (!date) return "Present";
  const d = new Date(date);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
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
  if (years === 0 && rem === 0) return "< 1 month";
  if (years === 0) return `${rem} month${rem !== 1 ? "s" : ""}`;
  if (rem === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years} year${years !== 1 ? "s" : ""}, ${rem} month${rem !== 1 ? "s" : ""}`;
}

function trajectoryColor(trajectory: string | null): string {
  if (!trajectory) return "var(--text-muted)";
  const t = trajectory.toLowerCase();
  if (t === "upward" || t === "rising") return "var(--accent-tactical)";
  if (t === "stable" || t === "steady") return "var(--accent-technical)";
  if (t === "downward" || t === "declining") return "#ef4444";
  return "var(--text-secondary)";
}

// ── Component ────────────────────────────────────────────────────────────────

export function CareerTimeline({ entries, metrics }: CareerTimelineProps) {
  if (entries.length === 0) return null;

  const totalClubs = metrics?.clubs_count ?? new Set(entries.map((e) => e.club_name)).size;
  const totalYears = metrics?.career_years;

  return (
    <div className="bg-[var(--bg-surface)]/80 backdrop-blur border border-[var(--border-subtle)] rounded-lg p-5">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
          Career History
        </h3>
        <span className="text-[11px] text-[var(--text-muted)]">
          {totalClubs} club{totalClubs !== 1 ? "s" : ""}
          {totalYears != null ? ` · ${totalYears} yr${totalYears !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {/* Metrics bar */}
      {metrics && (
        <div className="grid grid-cols-5 gap-2 mb-5">
          <MetricBox label="Clubs" value={metrics.clubs_count} />
          <MetricBox label="Career Yrs" value={metrics.career_years} />
          <MetricBox label="Avg Tenure" value={`${metrics.avg_tenure_yrs.toFixed(1)}y`} />
          <MetricBox label="Loyalty" value={metrics.loyalty_score} />
          <MetricBox
            label="Trajectory"
            value={metrics.trajectory ?? "—"}
            color={trajectoryColor(metrics.trajectory)}
          />
        </div>
      )}

      {/* Timeline */}
      <div className="relative ml-3">
        {/* Vertical line */}
        <div
          className="absolute left-0 top-2 bottom-2 w-px"
          style={{ backgroundColor: "var(--border-subtle)" }}
        />

        <div className="space-y-0">
          {entries.map((entry, i) => {
            const isActive = !entry.end_date;
            const isLoan = entry.is_loan;

            return (
              <div key={i} className="relative pl-6 pb-5 last:pb-0">
                {/* Node dot */}
                <div
                  className="absolute left-0 top-[7px] w-2.5 h-2.5 rounded-full -translate-x-[5px] border-2"
                  style={{
                    borderColor: isActive
                      ? "var(--accent-tactical)"
                      : isLoan
                        ? "var(--accent-physical)"
                        : "var(--text-secondary)",
                    backgroundColor: isActive ? "var(--accent-tactical)" : "transparent",
                    boxShadow: isActive
                      ? "0 0 8px rgba(34,197,94,0.4)"
                      : undefined,
                  }}
                />

                {/* Content */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {entry.club_id ? (
                        <Link
                          href={`/clubs/${entry.club_id}`}
                          className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-tactical)] transition-colors truncate"
                        >
                          {entry.club_name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {entry.club_name}
                        </span>
                      )}
                      {isLoan && (
                        <span
                          className="shrink-0 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded"
                          style={{
                            color: "var(--accent-physical)",
                            backgroundColor: "rgba(232,197,71,0.12)",
                            border: "1px solid rgba(232,197,71,0.25)",
                          }}
                        >
                          Loan
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {formatDate(entry.start_date)} — {formatDate(entry.end_date)}
                      </span>
                      {entry.start_date && (
                        <span className="text-[10px] text-[var(--text-muted)] opacity-60">
                          {calcDuration(entry.start_date, entry.end_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Metric Box ───────────────────────────────────────────────────────────────

function MetricBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-[var(--bg-elevated)] rounded-md px-2 py-2 text-center">
      <div
        className="text-sm font-bold font-mono"
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">
        {label}
      </div>
    </div>
  );
}
