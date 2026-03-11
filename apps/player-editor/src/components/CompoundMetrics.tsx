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

// ── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ label, value, color, onClick }: {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
}) {
  const pct = Math.min(Math.max(value, 0), 100);
  const scale = (pct / 20) * 100; // 1-20 scale → percentage
  return (
    <div
      className={`flex items-center gap-2 py-1 ${onClick ? "cursor-pointer hover:bg-[var(--bg-elevated)]/50 -mx-2 px-2 rounded transition-colors" : ""}`}
      onClick={onClick}
    >
      <span className="text-[11px] text-[var(--text-secondary)] w-28 truncate">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full opacity-70 transition-all duration-300"
          style={{ width: `${pct > 20 ? pct : scale}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono w-6 text-right text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function Breadcrumb({ path, onNavigate }: { path: string[]; onNavigate: (depth: number) => void }) {
  return (
    <div className="flex items-center gap-1 mb-3 text-[10px] text-[var(--text-muted)]">
      {path.map((segment, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[var(--text-muted)]">&rsaquo;</span>}
          {i < path.length - 1 ? (
            <button
              className="hover:text-[var(--text-secondary)] transition-colors"
              onClick={() => onNavigate(i)}
            >
              {segment}
            </button>
          ) : (
            <span className="text-[var(--text-secondary)] font-medium">{segment}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── Layer 4: Attribute Detail ────────────────────────────────────────────────

function AttributeDetailView({ attribute, grades, color }: {
  attribute: string;
  grades: AttributeGrade[];
  color: string;
}) {
  const grade = grades.find((g) => g.attribute === attribute);
  if (!grade) return null;

  return (
    <div className="mt-2 ml-4 py-3 px-4 bg-[var(--bg-base)]/50 border border-[var(--border-subtle)] rounded-lg space-y-2">
      {grade.scout_grade != null && (
        <div>
          <ScoreBar label="Scout Grade" value={grade.scout_grade} color={color} />
        </div>
      )}
      {grade.stat_score != null && (
        <div>
          <ScoreBar label="Stat Score" value={grade.stat_score} color={color} />
        </div>
      )}
      {grade.scout_grade == null && grade.stat_score == null && (
        <p className="text-xs text-[var(--text-muted)]">No data available.</p>
      )}
    </div>
  );
}

// ── Layer 3: Model Breakdown ─────────────────────────────────────────────────

function ModelBreakdown({ model, grades, color, compound, onBack }: {
  model: string;
  grades: AttributeGrade[];
  color: string;
  compound: string;
  onBack: () => void;
}) {
  const [expandedAttr, setExpandedAttr] = useState<string | null>(null);
  const attrs = MODEL_ATTRIBUTES[model] ?? [];
  const score = avgScore(grades, attrs);

  return (
    <div className="animate-[fadeIn_200ms_ease-out]">
      <Breadcrumb
        path={["Attributes", compound, model]}
        onNavigate={(depth) => { if (depth <= 1) onBack(); }}
      />
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold" style={{ color }}>{model}</span>
        {score != null && (
          <span className="text-xs font-mono text-[var(--text-secondary)]">{score}</span>
        )}
      </div>
      <div className="space-y-0.5">
        {attrs.map((attr) => {
          const g = grades.find((gr) => gr.attribute === attr);
          if (!g) return null;
          const isExpanded = expandedAttr === attr;
          return (
            <div key={attr}>
              <ScoreBar
                label={formatAttr(attr)}
                value={gradeValue(g)}
                color={color}
                onClick={() => setExpandedAttr(isExpanded ? null : attr)}
              />
              {isExpanded && (
                <AttributeDetailView attribute={attr} grades={grades} color={color} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Layer 2: Compound Expanded ───────────────────────────────────────────────

function CompoundExpanded({ compound, grades, onBack }: {
  compound: string;
  grades: AttributeGrade[];
  onBack: () => void;
}) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const models = COMPOUND_MODELS[compound] ?? [];
  const color = COMPOUND_COLORS[compound] ?? "var(--text-secondary)";

  if (selectedModel) {
    return (
      <ModelBreakdown
        model={selectedModel}
        grades={grades}
        color={color}
        compound={compound}
        onBack={() => setSelectedModel(null)}
      />
    );
  }

  return (
    <div className="animate-[fadeIn_200ms_ease-out]">
      <Breadcrumb
        path={["Attributes", compound]}
        onNavigate={(depth) => { if (depth === 0) onBack(); }}
      />
      <div className="space-y-2">
        {models.map((model) => {
          const attrs = MODEL_ATTRIBUTES[model] ?? [];
          const score = avgScore(grades, attrs);
          if (score == null) return null;
          return (
            <div
              key={model}
              className="flex items-center gap-3 p-2 -mx-2 rounded cursor-pointer hover:bg-[var(--bg-elevated)]/50 transition-colors"
              onClick={() => setSelectedModel(model)}
            >
              <span className="text-sm font-medium text-[var(--text-primary)] w-24">{model}</span>
              <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full opacity-70"
                  style={{ width: `${score}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-xs font-mono w-6 text-right text-[var(--text-secondary)]">{score}</span>
              <span className="text-[10px] text-[var(--text-muted)]">&rsaquo;</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CompoundMetrics({ attributeGrades }: CompoundMetricsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (attributeGrades.length === 0) return null;

  const compounds = Object.entries(COMPOUND_MODELS);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
      <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
        Attributes
      </h3>

      {/* Collapsed: category gauges */}
      {!expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {compounds.map(([compound, models]) => {
            const allAttrs = models.flatMap((m) => MODEL_ATTRIBUTES[m] ?? []);
            const score = avgScore(attributeGrades, allAttrs);
            if (score == null) return null;
            const color = COMPOUND_COLORS[compound] ?? "var(--text-secondary)";
            return (
              <button
                key={compound}
                className="text-left p-3 rounded-lg bg-[var(--bg-base)]/50 border border-[var(--border-subtle)] hover:border-[var(--text-muted)] transition-colors cursor-pointer"
                onClick={() => setExpanded(compound)}
              >
                <div className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color }}>
                  {compound}
                </div>
                <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">{score}</div>
                <div className="mt-2 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full opacity-70"
                    style={{ width: `${score}%`, backgroundColor: color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Expanded: drill-down */}
      {expanded && (
        <CompoundExpanded
          compound={expanded}
          grades={attributeGrades}
          onBack={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
