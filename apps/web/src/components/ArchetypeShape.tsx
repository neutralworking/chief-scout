// Model-to-compound category mapping (from spec)
const MODEL_CATEGORIES: Record<string, { compound: string; color: string }> = {
  Controller: { compound: "Mental", color: "var(--color-accent-mental)" },
  Commander: { compound: "Mental", color: "var(--color-accent-mental)" },
  Creator: { compound: "Mental", color: "var(--color-accent-mental)" },
  Target: { compound: "Physical", color: "var(--color-accent-physical)" },
  Sprinter: { compound: "Physical", color: "var(--color-accent-physical)" },
  Powerhouse: { compound: "Physical", color: "var(--color-accent-physical)" },
  Cover: { compound: "Tactical", color: "var(--color-accent-tactical)" },
  Engine: { compound: "Tactical", color: "var(--color-accent-tactical)" },
  Destroyer: { compound: "Tactical", color: "var(--color-accent-tactical)" },
  Dribbler: { compound: "Technical", color: "var(--color-accent-technical)" },
  Passer: { compound: "Technical", color: "var(--color-accent-technical)" },
  Striker: { compound: "Technical", color: "var(--color-accent-technical)" },
  Keeper: { compound: "Technical", color: "var(--color-accent-technical)" },
};

function ConfidenceDots({ confidence }: { confidence: string | null }) {
  const filled = confidence === "high" ? 3 : confidence === "medium" ? 2 : confidence === "low" ? 1 : 0;
  if (filled === 0) return null;
  return (
    <div className="flex items-center gap-1 ml-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < filled
              ? "bg-[var(--text-primary)]"
              : "bg-[var(--bg-elevated)]"
          }`}
        />
      ))}
      <span className="text-[10px] text-[var(--text-muted)] ml-1">{confidence}</span>
    </div>
  );
}

export interface ArchetypeShapeProps {
  archetype: string | null;
  confidence?: string | null;
  modelScores?: Record<string, number>;
  blueprint?: string | null;
  size?: "full" | "compact";
  showBlueprint?: boolean;
}

export function ArchetypeShape({
  archetype,
  confidence = null,
  modelScores = {},
  blueprint = null,
  size = "full",
  showBlueprint,
}: ArchetypeShapeProps) {
  if (!archetype) {
    if (size === "compact") return <span className="text-xs text-[var(--text-muted)]">No archetype</span>;
    return <p className="text-sm text-[var(--text-muted)]">Archetype not yet assessed.</p>;
  }

  // Compact: archetype name + confidence dots
  if (size === "compact") {
    return (
      <div className="flex items-center">
        <span className="text-xs font-medium text-[var(--color-accent-tactical)]">{archetype}</span>
        <ConfidenceDots confidence={confidence as string | null} />
      </div>
    );
  }

  // Full: archetype name, confidence, model fit bars sorted by score, blueprint
  const sortedModels = Object.entries(modelScores)
    .sort(([, a], [, b]) => b - a);

  const showBp = showBlueprint ?? true;

  return (
    <div>
      <div className="flex items-center mb-1">
        <span className="text-xl font-semibold text-[var(--color-accent-tactical)]">{archetype}</span>
        <ConfidenceDots confidence={confidence as string | null} />
      </div>

      {/* Model fit bars — the player's visual "shape" */}
      {sortedModels.length > 0 && (
        <div className="mt-4 space-y-1">
          {sortedModels.map(([model, score]) => {
            const cat = MODEL_CATEGORIES[model];
            const color = cat?.color ?? "var(--text-secondary)";
            const pct = Math.min(Math.max(score, 0), 100);
            return (
              <div key={model} className="flex items-center gap-2" style={{ height: "24px" }}>
                <span className="text-[11px] text-[var(--text-secondary)] w-20 text-right truncate">{model}</span>
                <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full opacity-70"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs font-mono w-6 text-right text-[var(--text-secondary)]">{score}</span>
              </div>
            );
          })}
        </div>
      )}

      {showBp && blueprint && (
        <div className="mt-4">
          <h4 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">Blueprint</h4>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{blueprint}</p>
        </div>
      )}
    </div>
  );
}
