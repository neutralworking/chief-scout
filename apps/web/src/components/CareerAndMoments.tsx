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

export interface XpMilestone {
  milestone_key: string;
  milestone_label: string;
  xp_value: number;
  milestone_date: string | null;
  source: string;
  details: Record<string, unknown> | null;
}

interface Props {
  entries: CareerEntry[];
  metrics: CareerMetrics | null;
  moments: KeyMoment[];
  xpMilestones?: XpMilestone[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "var(--sentiment-positive)",
  negative: "var(--sentiment-negative)",
  neutral: "var(--sentiment-neutral)",
};

function formatYear(date: string | null): string {
  if (!date) return "Now";
  return new Date(date).getFullYear().toString().slice(-2);
}

function formatDate(date: string | null): string {
  if (!date) return "Present";
  const d = new Date(date);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function calcYears(start: string | null, end: string | null): string {
  if (!start) return "";
  const from = new Date(start);
  const to = end ? new Date(end) : new Date();
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (months < 12) return `${Math.max(1, months)}m`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y${rem}m` : `${years}y`;
}

function trajectoryColor(t: string | null): string {
  if (!t) return "var(--text-muted)";
  const lower = t.toLowerCase();
  if (lower === "upward" || lower === "rising") return "var(--color-accent-tactical)";
  if (lower === "stable" || lower === "steady" || lower === "peak") return "var(--color-accent-technical)";
  if (lower === "downward" || lower === "declining") return "#ef4444";
  return "var(--text-secondary)";
}

type Tab = "career" | "moments" | "xp";

// ── Component ────────────────────────────────────────────────────────────────

export function CareerAndMoments({ entries, metrics, moments, xpMilestones = [] }: Props) {
  const hasMoments = moments.length > 0;
  const hasCareer = entries.length > 0;
  const hasXp = xpMilestones.length > 0;
  const [tab, setTab] = useState<Tab>(hasCareer ? "career" : "moments");

  // Separate entries by team type
  const seniorEntries = entries.filter((e) => !e.team_type || e.team_type === "senior_club");
  const internationalEntries = entries.filter((e) => e.team_type === "national_team");
  const youthEntries = entries.filter((e) => e.team_type === "youth" || e.team_type === "reserve");

  if (!hasCareer && !hasMoments && !hasXp) return null;

  // XP totals
  const xpTotal = xpMilestones.reduce((sum, m) => sum + m.xp_value, 0);
  const xpClamped = Math.max(-5, Math.min(8, xpTotal));

  // Sort moments chronologically
  const sortedMoments = [...moments].sort((a, b) => {
    if (!a.moment_date && !b.moment_date) return 0;
    if (!a.moment_date) return 1;
    if (!b.moment_date) return -1;
    return a.moment_date.localeCompare(b.moment_date);
  });

  const sortedXp = [...xpMilestones].sort((a, b) => b.xp_value - a.xp_value);

  const tabs: { key: Tab; label: string; count?: number }[] = [];
  if (hasCareer) tabs.push({ key: "career", label: "Career" });
  if (hasMoments) tabs.push({ key: "moments", label: "Moments", count: moments.length });
  if (hasXp) tabs.push({ key: "xp", label: `XP ${xpClamped >= 0 ? "+" : ""}${xpClamped}` });

  return (
    <div className="glass rounded-xl p-3">
      {/* Tab bar */}
      {tabs.length > 1 ? (
        <div className="flex gap-3 mb-2.5 border-b border-[var(--border-subtle)] -mx-3 px-3" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`pb-1.5 text-[10px] font-bold tracking-wider uppercase transition-colors relative ${
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
                <span className="absolute bottom-0 left-0 right-0 h-px bg-[var(--color-accent-personality)]" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
          {tabs[0]?.label ?? "Career"}
        </h3>
      )}

      {/* Career tab — compact horizontal flow */}
      {tab === "career" && hasCareer && (
        <div>
          {/* Metrics row */}
          {metrics && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              <MiniStat label="Clubs" value={metrics.clubs_count} />
              <MiniStat label="Years" value={metrics.career_years} />
              <MiniStat label="Avg" value={`${metrics.avg_tenure_yrs.toFixed(1)}y`} />
              <MiniStat
                label="Trajectory"
                value={metrics.trajectory ? metrics.trajectory.charAt(0).toUpperCase() + metrics.trajectory.slice(1) : "—"}
                color={trajectoryColor(metrics.trajectory)}
              />
              {metrics.loan_count > 0 && (
                <MiniStat label="Loans" value={metrics.loan_count} color="var(--color-accent-physical)" />
              )}
            </div>
          )}

          {/* Horizontal career flow — compact chips */}
          <div className="flex flex-wrap gap-1 mb-2">
            {seniorEntries.map((e, i) => {
              const isActive = !e.end_date;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-colors ${
                    isActive
                      ? "border-[var(--color-accent-tactical)]/40 bg-[var(--color-accent-tactical)]/10"
                      : e.is_loan
                      ? "border-[var(--color-accent-physical)]/30 bg-[var(--color-accent-physical)]/5"
                      : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30"
                  }`}
                >
                  {e.club_id ? (
                    <Link
                      href={`/clubs/${e.club_id}`}
                      className="font-medium hover:text-[var(--color-accent-tactical)] transition-colors"
                    >
                      {e.club_name}
                    </Link>
                  ) : (
                    <span className="font-medium">{e.club_name}</span>
                  )}
                  <span className="text-[var(--text-muted)] font-mono text-[9px]">
                    {calcYears(e.start_date, e.end_date)}
                  </span>
                  {e.is_loan && (
                    <span className="text-[7px] font-bold tracking-wider uppercase text-[var(--color-accent-physical)]">L</span>
                  )}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-tactical)] shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeline bar — visual year markers */}
          {seniorEntries.length > 0 && seniorEntries[0].start_date && (
            <CareerBar entries={seniorEntries} />
          )}

          {/* International + Youth — compact inline */}
          {(internationalEntries.length > 0 || youthEntries.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
              {internationalEntries.map((e, i) => (
                <div key={`intl-${i}`} className="flex items-center gap-1 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-mental)] shrink-0" />
                  <span className="font-medium text-[var(--color-accent-mental)]">{e.club_name}</span>
                  {e.start_date && (
                    <span className="text-[var(--text-muted)] font-mono text-[9px]">
                      &apos;{formatYear(e.start_date)}–{formatYear(e.end_date)}
                    </span>
                  )}
                </div>
              ))}
              {youthEntries.map((e, i) => (
                <div key={`youth-${i}`} className="flex items-center gap-1 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] shrink-0" />
                  <span className="text-[var(--text-muted)]">{e.club_name}</span>
                  {e.start_date && (
                    <span className="text-[var(--text-muted)] font-mono text-[9px] opacity-60">
                      &apos;{formatYear(e.start_date)}–{formatYear(e.end_date)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Moments tab */}
      {tab === "moments" && hasMoments && (
        <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
          {sortedMoments.map((m) => (
            <div key={m.id} className="flex gap-2 items-start px-1 py-1 -mx-1 rounded-md">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: SENTIMENT_COLORS[m.sentiment ?? "neutral"] ?? "var(--text-muted)" }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium truncate block">{m.title}</span>
                {m.description && (
                  <span className="text-[10px] text-[var(--text-muted)] line-clamp-1 block">{m.description}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {m.moment_date && (
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">{formatDate(m.moment_date)}</span>
                )}
                {m.source_url && (
                  <a href={m.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] font-medium hover:underline"
                    style={{ color: "var(--color-accent-personality)" }}
                    onClick={(e) => e.stopPropagation()}
                  >ref</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* XP tab */}
      {tab === "xp" && hasXp && (
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            <MiniStat label="Total" value={`${xpClamped >= 0 ? "+" : ""}${xpClamped}`} color={xpClamped > 0 ? "var(--color-accent-tactical)" : xpClamped < 0 ? "#ef4444" : "var(--text-primary)"} />
            <MiniStat label="Buffs" value={xpMilestones.filter(m => m.xp_value > 0).length} color="var(--color-accent-tactical)" />
            <MiniStat label="Debuffs" value={xpMilestones.filter(m => m.xp_value < 0).length} color="#ef4444" />
          </div>
          <div className="space-y-0.5 max-h-[220px] overflow-y-auto">
            {sortedXp.map((m) => (
              <div key={m.milestone_key} className="flex gap-2 items-center px-1 py-1 -mx-1 rounded-md">
                <span
                  className="text-[10px] font-mono font-bold shrink-0 w-6 text-center rounded px-0.5 py-0.5"
                  style={{
                    color: m.xp_value > 0 ? "var(--color-accent-tactical)" : "#ef4444",
                    backgroundColor: m.xp_value > 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                  }}
                >
                  {m.xp_value > 0 ? "+" : ""}{m.xp_value}
                </span>
                <span className="text-[11px] font-medium truncate flex-1">{m.milestone_label}</span>
                {m.milestone_date && (
                  <span className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">{formatDate(m.milestone_date)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Career Bar — visual timeline ────────────────────────────────────────────

function CareerBar({ entries }: { entries: CareerEntry[] }) {
  const firstStart = entries[0]?.start_date;
  if (!firstStart) return null;

  const startYear = new Date(firstStart).getFullYear();
  const endYear = new Date().getFullYear();
  const totalSpan = Math.max(1, endYear - startYear);

  return (
    <div className="relative">
      {/* Year markers */}
      <div className="flex justify-between text-[8px] text-[var(--text-muted)] font-mono mb-0.5">
        <span>{startYear}</span>
        {totalSpan > 4 && <span>{startYear + Math.floor(totalSpan / 2)}</span>}
        <span>{endYear}</span>
      </div>
      {/* Bar */}
      <div className="relative h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        {entries.map((e, i) => {
          if (!e.start_date) return null;
          const eStart = new Date(e.start_date).getFullYear() + new Date(e.start_date).getMonth() / 12;
          const eEnd = e.end_date
            ? new Date(e.end_date).getFullYear() + new Date(e.end_date).getMonth() / 12
            : endYear + new Date().getMonth() / 12;
          const left = ((eStart - startYear) / totalSpan) * 100;
          const width = Math.max(2, ((eEnd - eStart) / totalSpan) * 100);
          return (
            <div
              key={i}
              className="absolute inset-y-0 rounded-full"
              style={{
                left: `${Math.max(0, Math.min(100, left))}%`,
                width: `${Math.min(width, 100 - left)}%`,
                backgroundColor: !e.end_date
                  ? "var(--color-accent-tactical)"
                  : e.is_loan
                  ? "var(--color-accent-physical)"
                  : "var(--text-secondary)",
                opacity: !e.end_date ? 1 : 0.5,
              }}
              title={`${e.club_name}: ${formatDate(e.start_date)} – ${formatDate(e.end_date)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[var(--bg-elevated)] rounded px-1.5 py-0.5">
      <span className="text-[10px] font-bold font-mono" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </span>
      <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] ml-1">{label}</span>
    </div>
  );
}
