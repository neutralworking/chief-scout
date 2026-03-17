// Football Personality Matrix — custom 4-dimension system
// Dimensions (0-100 scale, threshold at 50):
//   ei: Game Reading     — Analytical (A) ≥50 | Instinctive (I) <50
//   sn: Motivation       — Extrinsic  (X) ≥50 | Intrinsic   (N) <50
//   tf: Social Orient.   — Soloist    (S) ≥50 | Leader      (L) <50
//   jp: Pressure Response — Competitor (C) ≥50 | Composer    (P) <50

const DIMENSION_LABELS = {
  ei: { high: "A", low: "I", name: "Game Reading", highLabel: "Analytical", lowLabel: "Instinctive" },
  sn: { high: "X", low: "N", name: "Motivation", highLabel: "Extrinsic", lowLabel: "Intrinsic" },
  tf: { high: "S", low: "L", name: "Social", highLabel: "Soloist", lowLabel: "Leader" },
  jp: { high: "C", low: "P", name: "Pressure", highLabel: "Competitor", lowLabel: "Composer" },
} as const;

// Theme icons — SVG paths for compact badge display
const THEME_ICONS: Record<string, string> = {
  general: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12", // bars (command structure)
  catalyst: "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z", // star
  maestro: "M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z", // music note
  captain: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z", // shield
  professor: "M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5", // academic cap
};

// Theme accent colors for tinting
const THEME_COLORS: Record<string, string> = {
  general: "rgba(161, 161, 170, 0.12)",    // zinc tint
  catalyst: "rgba(232, 121, 249, 0.10)",    // fuchsia tint
  maestro: "rgba(245, 158, 11, 0.10)",      // amber tint
  captain: "rgba(239, 68, 68, 0.10)",       // red tint
  professor: "rgba(59, 130, 246, 0.10)",    // blue tint
};

const THEME_BORDER_COLORS: Record<string, string> = {
  general: "rgba(161, 161, 170, 0.4)",
  catalyst: "rgba(232, 121, 249, 0.4)",
  maestro: "rgba(245, 158, 11, 0.4)",
  captain: "rgba(239, 68, 68, 0.4)",
  professor: "rgba(59, 130, 246, 0.4)",
};

// Map personality code to theme
function getPersonalityTheme(code: string): string {
  const themeMap: Record<string, string> = {
    ANLC: "general", ANSC: "general", INSC: "general",
    AXLC: "catalyst", IXSC: "catalyst", IXLC: "catalyst",
    INSP: "maestro", ANLP: "maestro", IXSP: "maestro",
    INLC: "captain", INLP: "captain", AXSC: "captain",
    ANSP: "professor", AXSP: "professor", IXLP: "professor", AXLP: "professor",
  };
  return themeMap[code] ?? "general";
}

import { PERSONALITY_TYPES } from "@/lib/personality";

// Compute 4-letter code from dimension scores (client-side, matches SQL view logic)
function computePersonalityCode(ei: number, sn: number, tf: number, jp: number): string {
  return [
    ei >= 50 ? "A" : "I",
    sn >= 50 ? "X" : "N",
    tf >= 50 ? "S" : "L",
    jp >= 50 ? "C" : "P",
  ].join("");
}

function DimensionTrack({ dimension, value }: { dimension: keyof typeof DIMENSION_LABELS; value: number }) {
  const labels = DIMENSION_LABELS[dimension];
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[var(--text-secondary)]">{labels.lowLabel}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{labels.name}</span>
        <span className="text-[9px] text-[var(--text-secondary)]">{labels.highLabel}</span>
      </div>
      <div className="relative h-1.5 bg-[var(--bg-elevated)] rounded-full">
        {/* Center line marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--text-muted)]/30" />
        {/* Position dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[var(--color-accent-personality)] shadow-[0_0_6px_rgba(232,197,71,0.4)] border-2 border-[var(--bg-surface)]"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
    </div>
  );
}

function GaugeBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-[var(--text-muted)] w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent-personality)]"
          style={{ width: `${pct}%`, opacity: pct >= 60 ? 0.9 : pct >= 40 ? 0.6 : 0.35 }}
        />
      </div>
      <span className="text-[10px] font-mono text-[var(--text-secondary)] w-6 text-right shrink-0">{value}</span>
    </div>
  );
}

export interface PersonalityBadgeProps {
  personalityType: string | null;
  ei?: number | null;
  sn?: number | null;
  tf?: number | null;
  jp?: number | null;
  competitiveness?: number | null;
  coachability?: number | null;
  size?: "hero" | "compact" | "mini";
  showDimensions?: boolean;
  showDescription?: boolean;
}

export function PersonalityBadge({
  personalityType,
  ei,
  sn,
  tf,
  jp,
  competitiveness,
  coachability,
  size = "hero",
  showDimensions,
  showDescription,
}: PersonalityBadgeProps) {
  // Compute the correct football personality code from raw scores if available
  const code =
    ei != null && sn != null && tf != null && jp != null
      ? computePersonalityCode(ei, sn, tf, jp)
      : personalityType;

  if (!code) {
    if (size === "mini") return <span className="text-xs text-[var(--text-muted)]">–</span>;
    if (size === "compact") return null;
    return <p className="text-sm text-[var(--text-muted)]">Personality not yet assessed.</p>;
  }

  const pt = PERSONALITY_TYPES[code];
  const info = pt ? { name: pt.fullName, oneLiner: pt.oneLiner } : null;
  const dims = showDimensions ?? size === "hero";
  const desc = showDescription ?? size === "hero";

  // Mini: just the code
  if (size === "mini") {
    return (
      <span className="inline-block font-mono text-sm font-bold tracking-widest text-[var(--color-accent-personality)]">
        {code}
      </span>
    );
  }

  // Compact: icon + personality name as highlight, code secondary
  if (size === "compact") {
    const theme = getPersonalityTheme(code);
    const iconPath = THEME_ICONS[theme];
    return (
      <div className="inline-flex items-center gap-1.5">
        {iconPath && (
          <svg className="w-3.5 h-3.5 text-[var(--color-accent-personality)] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        )}
        {info ? (
          <span className="text-[10px] font-bold text-[var(--color-accent-personality)] tracking-wide">
            {info.name.replace("The ", "")}
          </span>
        ) : (
          <span className="text-[10px] font-mono font-bold text-[var(--color-accent-personality)] tracking-wider">
            {code}
          </span>
        )}
      </div>
    );
  }

  // Hero: themed personality card
  const theme = getPersonalityTheme(code);
  const iconPath = THEME_ICONS[theme];
  const bgTint = THEME_COLORS[theme] ?? THEME_COLORS.general;
  const borderColor = THEME_BORDER_COLORS[theme] ?? THEME_BORDER_COLORS.general;

  return (
    <div
      className="rounded-lg p-4 border-l-4"
      style={{ backgroundColor: bgTint, borderLeftColor: borderColor }}
    >
      {/* Header: icon + name + code */}
      <div className="flex items-start gap-3">
        {iconPath && (
          <div className="shrink-0 mt-0.5">
            <svg className="w-8 h-8 text-[var(--color-accent-personality)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {info && (
            <h4 className="text-base font-bold text-[var(--text-primary)] leading-tight">{info.name}</h4>
          )}
          <span className="text-xs font-mono font-bold tracking-[0.2em] text-[var(--color-accent-personality)] opacity-80">{code}</span>
          {desc && info && (
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-1 italic">
              {info.oneLiner}
            </p>
          )}
        </div>
      </div>

      {/* Dimension tracks */}
      {dims && ei != null && sn != null && tf != null && jp != null && (
        <div className="space-y-3 mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <DimensionTrack dimension="ei" value={ei} />
          <DimensionTrack dimension="sn" value={sn} />
          <DimensionTrack dimension="tf" value={tf} />
          <DimensionTrack dimension="jp" value={jp} />
        </div>
      )}

      {/* Trait gauges */}
      {dims && (competitiveness != null || coachability != null) && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
          {competitiveness != null && (
            <GaugeBar label="Competitiveness" value={competitiveness} />
          )}
          {coachability != null && (
            <GaugeBar label="Coachability" value={coachability} />
          )}
        </div>
      )}
    </div>
  );
}
