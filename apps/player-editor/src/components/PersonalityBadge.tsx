const PERSONALITY_NAMES: Record<string, { name: string; oneLiner: string }> = {
  ESTJ: { name: "The Director", oneLiner: "Organized, commanding, drives structure and accountability" },
  ENTJ: { name: "The Commander", oneLiner: "Strategic leader who thrives under pressure" },
  ESFJ: { name: "The Captain", oneLiner: "Supportive leader, team-first, vocal organizer" },
  ENFJ: { name: "The Mentor", oneLiner: "Inspires teammates, emotionally intelligent, leads by example" },
  ESTP: { name: "The Maverick", oneLiner: "Bold risk-taker, thrives in chaos, instinctive" },
  ENTP: { name: "The Innovator", oneLiner: "Creative disruptor, unpredictable, challenges conventions" },
  ESFP: { name: "The Showman", oneLiner: "Expressive, flair-driven, feeds off the crowd" },
  ENFP: { name: "The Spark", oneLiner: "Energetic, imaginative, lifts the dressing room" },
  ISTJ: { name: "The Professional", oneLiner: "Reliable, disciplined, consistent performer" },
  INTJ: { name: "The Architect", oneLiner: "Calculated, self-driven, sees the game three moves ahead" },
  ISFJ: { name: "The Guardian", oneLiner: "Selfless, dependable, quietly holds the team together" },
  INFJ: { name: "The Visionary", oneLiner: "Intuitive, purposeful, reads the game deeply" },
  ISTP: { name: "The Operator", oneLiner: "Cool under pressure, mechanically efficient, adaptable" },
  INTP: { name: "The Analyst", oneLiner: "Cerebral, reads patterns, sometimes overthinks" },
  ISFP: { name: "The Artist", oneLiner: "Elegant, expressive, plays with aesthetic instinct" },
  INFP: { name: "The Idealist", oneLiner: "Driven by personal values, emotionally invested" },
};

function DimensionBar({ left, right, value }: { left: string; right: string; value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold w-3 text-[var(--accent-personality)]">{left}</span>
      <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent-personality)] opacity-60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold w-3 text-[var(--text-muted)]">{right}</span>
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
  if (!personalityType) {
    if (size === "mini") return <span className="text-xs text-[var(--text-muted)]">–</span>;
    return <p className="text-sm text-[var(--text-muted)]">Personality not yet assessed.</p>;
  }

  const info = PERSONALITY_NAMES[personalityType];
  const dims = showDimensions ?? size === "hero";
  const desc = showDescription ?? size === "hero";

  // Mini: just the code in a small box
  if (size === "mini") {
    return (
      <span className="inline-block font-mono text-sm font-bold tracking-widest text-[var(--accent-personality)]">
        {personalityType}
      </span>
    );
  }

  // Compact: code + type name in a bordered box
  if (size === "compact") {
    return (
      <div className="inline-flex flex-col items-center">
        <span className="font-mono text-sm font-bold tracking-widest text-[var(--accent-personality)] border border-[var(--accent-personality)]/20 px-2 py-0.5 rounded">
          {personalityType}
        </span>
        {info && (
          <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">{info.name}</span>
        )}
      </div>
    );
  }

  // Hero: full display with optional dimensions and description
  return (
    <div>
      <div className="text-center mb-4">
        <span className="inline-block font-mono text-3xl font-extrabold tracking-[0.15em] text-[var(--accent-personality)] border border-[var(--accent-personality)]/20 px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(232,197,71,0.1)]">
          {personalityType}
        </span>
        {info && (
          <div className="mt-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{info.name}</span>
          </div>
        )}
      </div>

      {dims && ei != null && sn != null && tf != null && jp != null && (
        <div className="space-y-2 mt-4">
          <DimensionBar left="E" right="I" value={ei} />
          <DimensionBar left="S" right="N" value={sn} />
          <DimensionBar left="T" right="F" value={tf} />
          <DimensionBar left="J" right="P" value={jp} />
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
