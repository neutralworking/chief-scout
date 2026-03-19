"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * 13 SACROSANCT models grouped by four-pillar category.
 * Each model has 4 core attributes. Scout grades are 0-10.
 */
const PILLAR_MODELS: {
  pillar: string;
  color: string;
  models: { name: string; attrs: string[] }[];
}[] = [
  {
    pillar: "Technical",
    color: "var(--color-accent-technical, #a855f7)",
    models: [
      { name: "Striker", attrs: ["close_range", "mid_range", "long_range", "penalties"] },
      { name: "Dribbler", attrs: ["carries", "first_touch", "skills", "take_ons"] },
      { name: "Passer", attrs: ["pass_accuracy", "crossing", "pass_range", "through_balls"] },
      { name: "GK", attrs: ["agility", "footwork", "handling", "reactions"] },
    ],
  },
  {
    pillar: "Tactical",
    color: "var(--color-accent-tactical, #22c55e)",
    models: [
      { name: "Destroyer", attrs: ["blocking", "clearances", "marking", "tackling"] },
      { name: "Cover", attrs: ["awareness", "discipline", "interceptions", "positioning"] },
      { name: "Engine", attrs: ["intensity", "pressing", "stamina", "versatility"] },
    ],
  },
  {
    pillar: "Mental",
    color: "var(--color-accent-mental, #3b82f6)",
    models: [
      { name: "Controller", attrs: ["anticipation", "composure", "decisions", "tempo"] },
      { name: "Commander", attrs: ["communication", "concentration", "drive", "leadership"] },
      { name: "Creator", attrs: ["creativity", "unpredictability", "vision", "guile"] },
    ],
  },
  {
    pillar: "Physical",
    color: "var(--color-accent-physical, #eab308)",
    models: [
      { name: "Target", attrs: ["aerial_duels", "heading", "jumping", "volleys"] },
      { name: "Sprinter", attrs: ["acceleration", "balance", "movement", "pace"] },
      { name: "Powerhouse", attrs: ["aggression", "duels", "shielding", "stamina"] },
    ],
  },
];

const ATTR_LABELS: Record<string, string> = {
  close_range: "Close Range", mid_range: "Mid Range", long_range: "Long Range", penalties: "Penalties",
  carries: "Carries", first_touch: "First Touch", skills: "Skills", take_ons: "Take-Ons",
  pass_accuracy: "Pass Accuracy", crossing: "Crossing", pass_range: "Pass Range", through_balls: "Through Balls",
  agility: "Agility", footwork: "Footwork", handling: "Handling", reactions: "Reactions",
  blocking: "Blocking", clearances: "Clearances", marking: "Marking", tackling: "Tackling",
  awareness: "Awareness", discipline: "Discipline", interceptions: "Interceptions", positioning: "Positioning",
  intensity: "Intensity", pressing: "Pressing", stamina: "Stamina", versatility: "Versatility",
  anticipation: "Anticipation", composure: "Composure", decisions: "Decisions", tempo: "Tempo",
  communication: "Comms", concentration: "Concentration", drive: "Drive", leadership: "Leadership",
  creativity: "Creativity", unpredictability: "Flair", vision: "Vision", guile: "Guile",
  aerial_duels: "Aerial Duels", heading: "Heading", jumping: "Jumping", volleys: "Volleys",
  acceleration: "Acceleration", balance: "Balance", movement: "Movement", pace: "Pace",
  aggression: "Aggression", duels: "Duels", shielding: "Shielding",
};

interface GradeData {
  scout_grade: number | null;
  stat_score: number | null;
  source: string | null;
}

interface Props {
  personId: number;
}

export default function AttributeGradeEditor({ personId }: Props) {
  const [grades, setGrades] = useState<Record<string, GradeData>>({});
  const [dirty, setDirty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [loaded, setLoaded] = useState(false);

  // Load existing grades
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/attribute-grades?person_id=${personId}`);
        if (res.ok) {
          const data = await res.json();
          setGrades(data.grades ?? {});
        }
      } catch {
        // grades will be empty
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, [personId]);

  const setGrade = useCallback((attr: string, value: number | null) => {
    setDirty((prev) => ({ ...prev, [attr]: value ?? -1 }));
    setSaveStatus("idle");
  }, []);

  const saveGrades = useCallback(async () => {
    const entries = Object.entries(dirty).filter(([, v]) => v >= 0);
    if (entries.length === 0) return;

    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/admin/attribute-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: personId,
          grades: entries.map(([attribute, scout_grade]) => ({ attribute, scout_grade })),
        }),
      });
      if (res.ok) {
        // Merge saved values into grades state
        setGrades((prev) => {
          const next = { ...prev };
          for (const [attr, val] of entries) {
            next[attr] = { ...next[attr], scout_grade: val, source: "scout_assessment", stat_score: next[attr]?.stat_score ?? null };
          }
          return next;
        });
        setDirty({});
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [personId, dirty]);

  // Clear removed grades (set to null)
  const clearGrade = useCallback((attr: string) => {
    setDirty((prev) => {
      const next = { ...prev };
      delete next[attr];
      return next;
    });
    setGrades((prev) => {
      const next = { ...prev };
      if (next[attr]) {
        next[attr] = { ...next[attr], scout_grade: null };
      }
      return next;
    });
  }, []);

  const dirtyCount = Object.keys(dirty).length;

  if (!loaded) {
    return (
      <div className="glass rounded-xl p-4 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute Grades</h2>
        <div className="text-xs text-[var(--text-muted)] mt-2">Loading grades...</div>
      </div>
    );
  }

  // Count how many attrs have any data (scout or stat)
  const allAttrs = PILLAR_MODELS.flatMap((p) => p.models.flatMap((m) => m.attrs));
  const coveredCount = allAttrs.filter((a) => (grades[a]?.scout_grade ?? null) !== null || (grades[a]?.stat_score ?? null) !== null).length;

  return (
    <div className="glass rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute Grades</h2>
        <span className="text-[10px] text-[var(--text-muted)] font-mono">{coveredCount}/{allAttrs.length} attrs</span>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mb-3">Scout grades (0-10). Grey numbers = pipeline stat scores. Tap +/- or type directly.</p>

      {PILLAR_MODELS.map((pillar) => (
        <PillarSection key={pillar.pillar} pillar={pillar} grades={grades} dirty={dirty} setGrade={setGrade} clearGrade={clearGrade} />
      ))}

      {/* Save bar */}
      {dirtyCount > 0 && (
        <div className="sticky bottom-20 mt-3">
          <button
            onClick={saveGrades}
            disabled={saving}
            className="w-full py-3 rounded-lg bg-[var(--color-accent-tactical)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? "Saving..." : `Save ${dirtyCount} grade${dirtyCount > 1 ? "s" : ""}`}
          </button>
          {saveStatus === "error" && <div className="text-[10px] text-red-400 text-center mt-1">Save failed</div>}
        </div>
      )}
      {saveStatus === "saved" && dirtyCount === 0 && (
        <div className="text-[10px] text-[var(--color-accent-tactical)] text-center mt-2">Grades saved</div>
      )}
    </div>
  );
}

function PillarSection({
  pillar,
  grades,
  dirty,
  setGrade,
  clearGrade,
}: {
  pillar: (typeof PILLAR_MODELS)[number];
  grades: Record<string, GradeData>;
  dirty: Record<string, number>;
  setGrade: (attr: string, value: number | null) => void;
  clearGrade: (attr: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Count grades in this pillar
  const pillarAttrs = pillar.models.flatMap((m) => m.attrs);
  const scoutCount = pillarAttrs.filter((a) => (grades[a]?.scout_grade ?? null) !== null || dirty[a] !== undefined).length;
  const statCount = pillarAttrs.filter((a) => (grades[a]?.stat_score ?? null) !== null).length;

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2 group"
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: pillar.color }} />
        <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{pillar.pillar}</span>
        <span className="text-[9px] text-[var(--text-muted)] font-mono ml-auto mr-2">
          {scoutCount > 0 && <span className="text-[var(--color-accent-tactical)]">{scoutCount}s</span>}
          {scoutCount > 0 && statCount > 0 && " "}
          {statCount > 0 && <span>{statCount}d</span>}
          {scoutCount === 0 && statCount === 0 && "empty"}
        </span>
        <svg
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="space-y-3 pb-2">
          {pillar.models.map((model) => (
            <ModelRow key={model.name} model={model} color={pillar.color} grades={grades} dirty={dirty} setGrade={setGrade} clearGrade={clearGrade} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelRow({
  model,
  color,
  grades,
  dirty,
  setGrade,
  clearGrade,
}: {
  model: { name: string; attrs: string[] };
  color: string;
  grades: Record<string, GradeData>;
  dirty: Record<string, number>;
  setGrade: (attr: string, value: number | null) => void;
  clearGrade: (attr: string) => void;
}) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5 pl-1" style={{ color }}>
        {model.name}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {model.attrs.map((attr) => (
          <AttrInput
            key={attr}
            attr={attr}
            grade={grades[attr] ?? { scout_grade: null, stat_score: null, source: null }}
            dirtyValue={dirty[attr]}
            setGrade={setGrade}
            clearGrade={clearGrade}
          />
        ))}
      </div>
    </div>
  );
}

function AttrInput({
  attr,
  grade,
  dirtyValue,
  setGrade,
  clearGrade,
}: {
  attr: string;
  grade: GradeData;
  dirtyValue: number | undefined;
  setGrade: (attr: string, value: number | null) => void;
  clearGrade: (attr: string) => void;
}) {
  const currentValue = dirtyValue !== undefined ? dirtyValue : grade.scout_grade;
  const hasScout = currentValue !== null && currentValue !== undefined && currentValue >= 0;
  const hasStat = grade.stat_score !== null;
  const isDirty = dirtyValue !== undefined;

  return (
    <div className={`rounded-md border px-2 py-1.5 ${isDirty ? "border-[var(--color-accent-tactical)]/50 bg-[var(--color-accent-tactical)]/5" : "border-[var(--border-subtle)] bg-[var(--bg-surface-solid)]/50"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-[var(--text-muted)] truncate">{ATTR_LABELS[attr] ?? attr}</span>
        {hasStat && (
          <span className="text-[8px] text-[var(--text-muted)] font-mono ml-1 shrink-0" title={`Pipeline: ${grade.stat_score} (${grade.source})`}>
            {grade.stat_score}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            if (hasScout && currentValue > 0) setGrade(attr, currentValue - 1);
          }}
          className="w-7 h-7 flex items-center justify-center rounded bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] hover:text-[var(--text-primary)] active:bg-[var(--bg-elevated)] text-sm font-bold shrink-0"
        >
          -
        </button>
        <input
          type="number"
          min={0}
          max={10}
          value={hasScout ? currentValue : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              clearGrade(attr);
            } else {
              const n = Math.min(10, Math.max(0, parseInt(v) || 0));
              setGrade(attr, n);
            }
          }}
          placeholder="-"
          className="w-full h-7 text-center text-sm font-mono bg-transparent border-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          onClick={() => {
            const next = hasScout ? Math.min(10, currentValue + 1) : 5;
            setGrade(attr, next);
          }}
          className="w-7 h-7 flex items-center justify-center rounded bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] hover:text-[var(--text-primary)] active:bg-[var(--bg-elevated)] text-sm font-bold shrink-0"
        >
          +
        </button>
      </div>
    </div>
  );
}
