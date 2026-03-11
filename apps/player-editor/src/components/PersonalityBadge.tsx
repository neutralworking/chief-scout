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

// Key personality archetypes from the scouting spec
const PERSONALITY_NAMES: Record<string, { name: string; oneLiner: string }> = {
  // 8 primary archetypes from spec
  ANLC: { name: "The General", oneLiner: "Structured reader, self-driven, organizes others, thrives in confrontation" },
  IXSP: { name: "The Genius", oneLiner: "Improviser, occasion-driven, self-contained, ice-cold under pressure" },
  ANSC: { name: "The Machine", oneLiner: "Reads the game systematically, self-motivated, quiet but relentless" },
  INLC: { name: "The Captain", oneLiner: "Instinct-driven, self-motivated, vocal leader, fierce competitor" },
  AXLC: { name: "The Showman", oneLiner: "Structured but feeds off atmosphere, demands attention, confrontational" },
  INSP: { name: "The Maestro", oneLiner: "Creative, self-motivated, quietly brilliant, composed under pressure" },
  ANLP: { name: "The Conductor", oneLiner: "Tactical organizer, self-driven, leads through control, ice-cold composure" },
  IXSC: { name: "The Maverick", oneLiner: "Flair player, needs the big stage, self-focused, rises to confrontation" },
  // Remaining 8 combinations
  AXSC: { name: "The Enforcer", oneLiner: "Reads patterns, fuelled by occasion, self-focused, aggressive competitor" },
  AXSP: { name: "The Technician", oneLiner: "Structured, occasion-driven, self-contained, calm under pressure" },
  AXLP: { name: "The Orchestrator", oneLiner: "Tactical mind, feeds off the crowd, organizes others, composed decision-maker" },
  INLP: { name: "The Guardian", oneLiner: "Instinctive, self-motivated, vocal organizer, calm presence" },
  INSC: { name: "The Hunter", oneLiner: "Instinctive, self-driven, self-reliant, competitive edge" },
  IXLC: { name: "The Provocateur", oneLiner: "Improviser, occasion-driven, leads vocally, thrives on confrontation" },
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

  // Compact: code + type name in a bordered box
  if (size === "compact") {
    return (
      <div className="inline-flex flex-col items-center">
        <span className="font-mono text-sm font-bold tracking-widest text-[var(--accent-personality)] border border-[var(--accent-personality)]/20 px-2 py-0.5 rounded">
          {code}
        </span>
        {info && (
          <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">{info.name}</span>
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
