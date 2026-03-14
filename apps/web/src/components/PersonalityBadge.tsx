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
  showman: "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z", // star
  maestro: "M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z", // music note
  captain: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z", // shield
  professor: "M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5", // academic cap
};

// Map personality code to theme
function getPersonalityTheme(code: string): string {
  const themeMap: Record<string, string> = {
    ANLC: "general", ANSC: "general", INSC: "general",
    AXLC: "showman", IXSC: "showman", IXLC: "showman",
    INSP: "maestro", ANLP: "maestro", IXSP: "maestro",
    INLC: "captain", INLP: "captain", AXSC: "captain",
    ANSP: "professor", AXSP: "professor", IXLP: "professor", AXLP: "professor",
  };
  return themeMap[code] ?? "general";
}

// Key personality archetypes from the scouting spec
const PERSONALITY_NAMES: Record<string, { name: string; oneLiner: string }> = {
  // 8 primary archetypes from spec
  ANLC: { name: "The General", oneLiner: "Structured reader, self-driven, organizes others, thrives in confrontation" },
  IXSP: { name: "The Genius", oneLiner: "Improviser, occasion-driven, self-contained, ice-cold under pressure" },
  ANSC: { name: "The Machine", oneLiner: "Reads the game systematically, self-motivated, quiet but relentless" },
  INLC: { name: "The Captain", oneLiner: "Instinct-driven, self-motivated, vocal leader, fierce competitor" },
  AXLC: { name: "The Warrior", oneLiner: "Structured but feeds off atmosphere, demands attention, confrontational" },
  INSP: { name: "The Maestro", oneLiner: "Creative, self-motivated, quietly brilliant, composed under pressure" },
  ANLP: { name: "The Conductor", oneLiner: "Tactical organizer, self-driven, leads through control, ice-cold composure" },
  IXSC: { name: "The Maverick", oneLiner: "Flair player, needs the big stage, self-focused, rises to confrontation" },
  // Remaining 8 combinations
  AXSC: { name: "The Enforcer", oneLiner: "Reads patterns, fuelled by occasion, self-focused, aggressive competitor" },
  AXSP: { name: "The Technician", oneLiner: "Structured, occasion-driven, self-contained, calm under pressure" },
  AXLP: { name: "The Orchestrator", oneLiner: "Tactical mind, feeds off the crowd, organizes others, composed decision-maker" },
  INLP: { name: "The Guardian", oneLiner: "Instinctive, self-motivated, vocal organizer, calm presence" },
  INSC: { name: "The Blade", oneLiner: "Instinctive, self-driven, self-reliant, competitive edge" },
  IXLC: { name: "The Livewire", oneLiner: "Improviser, occasion-driven, leads vocally, thrives on confrontation" },
  IXLP: { name: "The Playmaker", oneLiner: "Creative improviser, occasion-driven, organizes play, composed" },
  ANSP: { name: "The Professor", oneLiner: "Analytical, self-motivated, self-contained, composed under pressure" },
};

// Compute 4-letter code from dimension scores (client-side, matches SQL view logic)
function computePersonalityCode(ei: number, sn: number, tf: number, jp: number): string {
  return [
    ei >= 50 ? "A" : "I",
    sn >= 50 ? "X" : "N",
    tf >= 50 ? "S" : "L",
    jp >= 50 ? "C" : "P",
  ].join("");
}

function DimensionBar({ dimension, value }: { dimension: keyof typeof DIMENSION_LABELS; value: number }) {
  const labels = DIMENSION_LABELS[dimension];
  const pct = Math.min(Math.max(value, 0), 100);
  const dominant = value >= 50 ? labels.highLabel : labels.lowLabel;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold w-3 text-[var(--accent-personality)]" title={labels.lowLabel}>
        {labels.low}
      </span>
      <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent-personality)] opacity-60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold w-3 text-[var(--text-muted)]" title={labels.highLabel}>
        {labels.high}
      </span>
      <span className="text-[10px] text-[var(--text-secondary)] w-16 text-right">{dominant}</span>
      <span className="text-xs font-mono w-6 text-right text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function DotIndicator({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const filled = Math.round((value / max) * 5);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-muted)] w-24">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              i < filled
                ? "bg-[var(--accent-personality)]"
                : "bg-[var(--bg-elevated)]"
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-mono text-[var(--text-secondary)]">{value}</span>
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

  const info = PERSONALITY_NAMES[code];
  const dims = showDimensions ?? size === "hero";
  const desc = showDescription ?? size === "hero";

  // Mini: just the code
  if (size === "mini") {
    return (
      <span className="inline-block font-mono text-sm font-bold tracking-widest text-[var(--accent-personality)]">
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
          <svg className="w-3.5 h-3.5 text-[var(--accent-personality)] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        )}
        {info ? (
          <span className="text-[10px] font-bold text-[var(--accent-personality)] tracking-wide">
            {info.name.replace("The ", "")}
          </span>
        ) : (
          <span className="text-[10px] font-mono font-bold text-[var(--accent-personality)] tracking-wider">
            {code}
          </span>
        )}
      </div>
    );
  }

  // Hero: full display
  return (
    <div>
      <div className="text-center mb-4">
        <span className="inline-block font-mono text-3xl font-extrabold tracking-[0.15em] text-[var(--accent-personality)] border border-[var(--accent-personality)]/20 px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(232,197,71,0.1)]">
          {code}
        </span>
        {info && (
          <div className="mt-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{info.name}</span>
          </div>
        )}
      </div>

      {dims && ei != null && sn != null && tf != null && jp != null && (
        <div className="space-y-2 mt-4">
          <DimensionBar dimension="ei" value={ei} />
          <DimensionBar dimension="sn" value={sn} />
          <DimensionBar dimension="tf" value={tf} />
          <DimensionBar dimension="jp" value={jp} />
        </div>
      )}

      {dims && (competitiveness != null || coachability != null) && (
        <div className="mt-4 space-y-1.5">
          {competitiveness != null && (
            <DotIndicator label="Competitiveness" value={competitiveness} />
          )}
          {coachability != null && (
            <DotIndicator label="Coachability" value={coachability} />
          )}
        </div>
      )}

      {desc && info && (
        <p className="mt-4 text-sm text-[var(--text-secondary)] leading-relaxed">
          {info.oneLiner}
        </p>
      )}
    </div>
  );
}
