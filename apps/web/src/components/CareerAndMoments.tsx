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
  category?: string | null;
  rarity?: string | null;
  season?: string | null;
}

interface Props {
  entries: CareerEntry[];
  metrics: CareerMetrics | null;
  moments: KeyMoment[];
  xpMilestones?: XpMilestone[];
}

// ── XP Level System ─────────────────────────────────────────────────────────

const XP_LEVELS: { level: number; threshold: number; title: string }[] = [
  { level: 1, threshold: 0, title: "Novice" },
  { level: 2, threshold: 3, title: "Apprentice" },
  { level: 3, threshold: 9, title: "Journeyman" },
  { level: 4, threshold: 19, title: "Professional" },
  { level: 5, threshold: 34, title: "Established" },
  { level: 6, threshold: 54, title: "Veteran" },
  { level: 7, threshold: 82, title: "Distinguished" },
  { level: 8, threshold: 120, title: "Elite" },
  { level: 9, threshold: 170, title: "World Class" },
  { level: 10, threshold: 240, title: "Legendary" },
  { level: 11, threshold: 340, title: "Immortal" },
  { level: 12, threshold: 490, title: "GOAT" },
];

function computeXpLevel(totalPositiveXp: number) {
  let level = 1, title = "Novice";
  let nextThreshold = 3;
  for (const entry of XP_LEVELS) {
    if (totalPositiveXp >= entry.threshold) {
      level = entry.level;
      title = entry.title;
    } else {
      nextThreshold = entry.threshold;
      break;
    }
  }
  if (level === 12) nextThreshold = totalPositiveXp; // Max level
  return { level, title, nextThreshold };
}

// ── Rarity Colors ───────────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, { text: string; bg: string }> = {
  common: { text: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  uncommon: { text: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  rare: { text: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  epic: { text: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  legendary: { text: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  cursed: { text: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const CATEGORY_LABELS: Record<string, string> = {
  origin: "Origin",
  quests: "Quests",
  combat: "Combat",
  exploration: "Exploration",
  character: "Character",
  adversity: "Adversity",
  reputation: "Reputation",
  bonds: "Bonds",
  cursed: "Cursed",
  stats_deep: "Stats",
};

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

type Tab = "career" | "xp";

// ── Component ────────────────────────────────────────────────────────────────

export function CareerAndMoments({ entries, metrics, moments, xpMilestones = [] }: Props) {
  const hasCareer = entries.length > 0;
  const hasXp = xpMilestones.length > 0;
  const [tab, setTab] = useState<Tab>(hasCareer ? "career" : "xp");
  const [xpFilter, setXpFilter] = useState<string | null>(null);

  // Separate entries by team type
  const seniorEntries = entries.filter((e) => !e.team_type || e.team_type === "senior_club");
  const internationalEntries = entries.filter((e) => e.team_type === "national_team");
  const youthEntries = entries.filter((e) => e.team_type === "youth" || e.team_type === "reserve");

  if (!hasCareer && !hasXp) return null;

  // XP calculations
  const positiveXp = xpMilestones.reduce((sum, m) => sum + (m.xp_value > 0 ? m.xp_value : 0), 0);
  const negativeXp = Math.abs(xpMilestones.reduce((sum, m) => sum + (m.xp_value < 0 ? m.xp_value : 0), 0));
  const { level: xpLevel, title: xpTitle, nextThreshold } = computeXpLevel(positiveXp);
  const currentLevelThreshold = XP_LEVELS.find(l => l.level === xpLevel)?.threshold ?? 0;
  const progressPct = xpLevel >= 12 ? 100 :
    Math.min(100, ((positiveXp - currentLevelThreshold) / (nextThreshold - currentLevelThreshold)) * 100);

  // Category counts
  const categories = new Set(xpMilestones.map(m => m.category).filter(Boolean));

  // Filtered milestones
  const filteredXp = xpFilter
    ? xpMilestones.filter(m => m.category === xpFilter)
    : xpMilestones;
  const sortedXp = [...filteredXp].sort((a, b) => b.xp_value - a.xp_value);

  // Legacy score from XP data
  const legacyScore = xpMilestones.reduce((sum, m) => {
    const xp = m.xp_value;
    const rarity = m.rarity ?? "common";
    const mults: Record<string, number> = { legendary: 25, epic: 15, rare: 8, uncommon: 4, common: 2, cursed: -3 };
    const mult = mults[rarity] ?? 2;
    return sum + (xp > 0 ? xp * mult : -(Math.abs(xp) * Math.abs(mult)));
  }, 0);

  const tabs: { key: Tab; label: string; count?: number }[] = [];
  if (hasCareer) tabs.push({ key: "career", label: "Career" });
  if (hasXp) tabs.push({ key: "xp", label: `Lv${xpLevel} ${xpTitle}` });

  return (
    <div className="card p-3">
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

      {/* XP tab — BG3-style with key moments */}
      {tab === "xp" && hasXp && (
        <div>
          {/* Level bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[14px] font-black font-mono"
                  style={{ color: xpLevel >= 10 ? "#f59e0b" : xpLevel >= 8 ? "#a855f7" : xpLevel >= 6 ? "#3b82f6" : "var(--text-primary)" }}
                >
                  Lv{xpLevel}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{
                  color: xpLevel >= 10 ? "#f59e0b" : xpLevel >= 8 ? "#a855f7" : xpLevel >= 6 ? "#3b82f6" : "var(--text-secondary)"
                }}>
                  {xpTitle}
                </span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">
                {positiveXp} XP{negativeXp > 0 ? ` / -${negativeXp}` : ""}
              </span>
            </div>
            {/* Progress bar */}
            <div className="relative h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: xpLevel >= 10 ? "#f59e0b" : xpLevel >= 8 ? "#a855f7" : xpLevel >= 6 ? "#3b82f6" : "var(--color-accent-tactical)",
                }}
              />
            </div>
            {xpLevel < 12 && (
              <div className="flex justify-between mt-0.5">
                <span className="text-[8px] font-mono text-[var(--text-muted)]">Lv{xpLevel}</span>
                <span className="text-[8px] font-mono text-[var(--text-muted)]">Lv{xpLevel + 1} ({nextThreshold} XP)</span>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2 mb-2">
            <MiniStat label="Legacy" value={legacyScore.toLocaleString()} color={
              legacyScore >= 3000 ? "#f59e0b" : legacyScore >= 1500 ? "#a855f7" : legacyScore >= 700 ? "#3b82f6" : "var(--text-primary)"
            } />
            <MiniStat label="Events" value={xpMilestones.length} />
            <MiniStat label="Buffs" value={xpMilestones.filter(m => m.xp_value > 0).length} color="var(--color-accent-tactical)" />
            {negativeXp > 0 && (
              <MiniStat label="Curses" value={xpMilestones.filter(m => m.xp_value < 0).length} color="#ef4444" />
            )}
          </div>

          {/* Category filter chips */}
          {categories.size > 1 && (
            <div className="flex flex-wrap gap-1 mb-2">
              <button
                onClick={() => setXpFilter(null)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  !xpFilter ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                }`}
              >
                All
              </button>
              {Array.from(categories).sort().map((cat) => (
                <button
                  key={cat}
                  onClick={() => setXpFilter(xpFilter === cat ? null : cat!)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    xpFilter === cat ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                  }`}
                >
                  {CATEGORY_LABELS[cat!] ?? cat}
                </button>
              ))}
            </div>
          )}

          {/* Milestone list */}
          <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
            {sortedXp.map((m) => {
              const rarity = m.rarity ?? "common";
              const colors = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
              return (
                <div key={m.milestone_key} className="flex gap-1.5 items-center px-1 py-1 -mx-1 rounded-md">
                  {/* XP badge */}
                  <span
                    className="text-[10px] font-mono font-bold shrink-0 w-6 text-center rounded px-0.5 py-0.5"
                    style={{ color: colors.text, backgroundColor: colors.bg }}
                  >
                    {m.xp_value > 0 ? "+" : ""}{m.xp_value}
                  </span>
                  {/* Rarity dot */}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: colors.text }}
                  />
                  {/* Label */}
                  <span className="text-[11px] font-medium truncate flex-1">{m.milestone_label}</span>
                  {/* Date/season */}
                  {(m.season || m.milestone_date) && (
                    <span className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">
                      {m.season ?? formatDate(m.milestone_date)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Key Moments — inline highlights */}
          {moments.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Key Moments</span>
              <div className="space-y-0.5 mt-1 max-h-[100px] overflow-y-auto">
                {moments.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex gap-1.5 items-center text-[10px]">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: SENTIMENT_COLORS[m.sentiment ?? "neutral"] ?? "var(--text-muted)" }}
                    />
                    <span className="font-medium truncate flex-1">{m.title}</span>
                    {m.moment_date && (
                      <span className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">{formatDate(m.moment_date)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
