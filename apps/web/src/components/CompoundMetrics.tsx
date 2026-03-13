"use client";

import { useState } from "react";

// ── Model-to-attribute mapping (from CHIEF_SCOUT_PROMPT.md) ──────────────────

const MODEL_ATTRIBUTES: Record<string, string[]> = {
  // Technical
  Dribbler:    ["carries", "first_touch", "skills", "take_ons"],
  Passer:      ["pass_accuracy", "crossing", "pass_range", "through_balls"],
  Striker:     ["short_range", "mid_range", "long_range", "penalties"],
  GK:          ["agility", "footwork", "handling", "reactions"],
  // Tactical
  Cover:       ["awareness", "discipline", "interceptions", "positioning"],
  Destroyer:   ["blocking", "clearances", "marking", "tackling"],
  Engine:      ["intensity", "pressing", "stamina", "versatility"],
  // Physical
  Sprinter:    ["acceleration", "balance", "movement", "pace"],
  Powerhouse:  ["aggression", "duels", "shielding", "throwing"],
  Target:      ["aerial_duels", "heading", "jumping", "volleys"],
};

const COMPOUND_MODELS: Record<string, string[]> = {
  Technical: ["Dribbler", "Passer", "Striker"],
  Tactical:  ["Cover", "Destroyer", "Engine"],
  Physical:  ["Sprinter", "Powerhouse", "Target"],
};

const COMPOUND_COLORS: Record<string, string> = {
  Technical: "var(--accent-technical)",
  Tactical:  "var(--accent-tactical)",
  Physical:  "var(--accent-physical)",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface AttributeGrade {
  attribute: string;
  scout_grade: number | null;
  stat_score: number | null;
}

interface CompoundMetricsProps {
  attributeGrades: AttributeGrade[];
  profileTier?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function gradeValue(g: AttributeGrade): number {
  return g.scout_grade ?? g.stat_score ?? 0;
}

function avgScore(grades: AttributeGrade[], attrs: string[]): number | null {
  const vals = attrs
    .map((a) => grades.find((g) => g.attribute === a))
    .filter((g): g is AttributeGrade => g != null)
    .map(gradeValue);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

function formatAttr(attr: string): string {
  return attr.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CompoundMetrics({ attributeGrades }: CompoundMetricsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (attributeGrades.length === 0) return null;

  // Hide attributes that look unfilled (all or mostly default value of 10)
  const values = attributeGrades.map(gradeValue);
  const defaultCount = values.filter((v) => v === 10).length;
  if (defaultCount / values.length >= 0.7) return null;

  const compounds = Object.entries(COMPOUND_MODELS);

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">
        Attributes
      </h3>

      <div className="space-y-4">
        {compounds.map(([compound, models]) => {
          const allAttrs = models.flatMap((m) => MODEL_ATTRIBUTES[m] ?? []);
          const compoundScore = avgScore(attributeGrades, allAttrs);
          if (compoundScore == null) return null;
          const color = COMPOUND_COLORS[compound] ?? "var(--text-secondary)";
          const isExpanded = expanded === compound;

          return (
            <div key={compound}>
              {/* Compound header — clickable */}
              <button
                className="w-full flex items-center gap-3 py-1.5 group"
                onClick={() => setExpanded(isExpanded ? null : compound)}
              >
                <span className="text-[10px] font-bold tracking-widest uppercase w-20 text-left" style={{ color }}>
                  {compound}
                </span>
                <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full opacity-70"
                    style={{ width: `${compoundScore}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-sm font-mono font-bold w-8 text-right">{compoundScore}</span>
                <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors w-4">
                  {isExpanded ? "−" : "+"}
                </span>
              </button>

              {/* Expanded: all models + attributes visible */}
              {isExpanded && (
                <div className="mt-2 ml-2 space-y-3 animate-[fadeIn_150ms_ease-out]">
                  {models.map((model) => {
                    const attrs = MODEL_ATTRIBUTES[model] ?? [];
                    const modelScore = avgScore(attributeGrades, attrs);
                    if (modelScore == null) return null;

                    return (
                      <div key={model}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium text-[var(--text-primary)]">{model}</span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">{modelScore}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 ml-2">
                          {attrs.map((attr) => {
                            const g = attributeGrades.find((gr) => gr.attribute === attr);
                            if (!g) return null;
                            const val = gradeValue(g);
                            const pct = Math.min(Math.max(val, 0), 100);
                            return (
                              <div key={attr} className="flex items-center gap-2 py-0.5">
                                <span className="text-[11px] text-[var(--text-secondary)] w-24 truncate">
                                  {formatAttr(attr)}
                                </span>
                                <div className="flex-1 h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full opacity-70"
                                    style={{ width: `${pct}%`, backgroundColor: color }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono w-5 text-right text-[var(--text-secondary)]">{val}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
