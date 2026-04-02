"use client";

import { useState, useEffect, useCallback } from "react";

/* ── 13 SACROSANCT models, 4 pillars, 52 attributes ── */
const PILLAR_MODELS = [
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
] as const;

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
  position?: string | null;
}

export function ScoutGradeEditor({ personId, position }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [grades, setGrades] = useState<Record<string, GradeData>>({});
  const [dirty, setDirty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [loaded, setLoaded] = useState(false);
  const [activePillar, setActivePillar] = useState<string>("All");

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("network_admin") === "1");
  }, []);

  // Load grades on first open
  useEffect(() => {
    if (!open || loaded) return;
    async function load() {
      try {
        const res = await fetch(`/api/admin/attribute-grades?person_id=${personId}`);
        if (res.ok) {
          const data = await res.json();
          setGrades(data.grades ?? {});
        }
      } catch { /* grades will be empty */ }
      setLoaded(true);
    }
    load();
  }, [open, loaded, personId]);

  const setGrade = useCallback((attr: string, value: number | null) => {
    setDirty((prev) => ({ ...prev, [attr]: value ?? -1 }));
    setSaveStatus("idle");
  }, []);

  const saveGrades = useCallback(async () => {
    const entries = Object.entries(dirty).filter(([, v]) => v > 0);
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

  if (!isAdmin) return null;

  // Counts
  const allAttrs = PILLAR_MODELS.flatMap((p) => p.models.flatMap((m) => m.attrs));
  const scoutCount = allAttrs.filter((a) =>
    dirty[a] !== undefined || (grades[a]?.scout_grade ?? null) !== null
  ).length;
  const dirtyCount = Object.values(dirty).filter((v) => v > 0).length;

  // Relevance-sorted pillars for the position
  const positionRelevance: Record<string, string[]> = {
    GK: ["Technical", "Mental", "Physical", "Tactical"],
    CD: ["Tactical", "Physical", "Mental", "Technical"],
    WD: ["Tactical", "Physical", "Technical", "Mental"],
    DM: ["Tactical", "Mental", "Physical", "Technical"],
    CM: ["Mental", "Tactical", "Technical", "Physical"],
    WM: ["Technical", "Physical", "Tactical", "Mental"],
    AM: ["Mental", "Technical", "Tactical", "Physical"],
    WF: ["Technical", "Physical", "Mental", "Tactical"],
    CF: ["Technical", "Physical", "Mental", "Tactical"],
  };
  const pillarOrder = position ? positionRelevance[position] ?? null : null;

  const visiblePillars = activePillar === "All"
    ? (pillarOrder
        ? [...PILLAR_MODELS].sort((a, b) => {
            const ai = pillarOrder.indexOf(a.pillar);
            const bi = pillarOrder.indexOf(b.pillar);
            return ai - bi;
          })
        : PILLAR_MODELS)
    : PILLAR_MODELS.filter((p) => p.pillar === activePillar);

  // Collapsed toggle button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="card rounded-xl p-3 w-full flex items-center justify-between group hover:border-[var(--color-accent-tactical)]/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-accent-tactical)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Scout Grades</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{scoutCount}/52</span>
        </div>
        <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-accent-tactical)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Scout Grades</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{scoutCount}/52</span>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && <span className="text-[10px] text-emerald-400">Saved</span>}
          {saveStatus === "error" && <span className="text-[10px] text-red-400">Error</span>}
          <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pillar tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/50">
        <PillarTab label="All" active={activePillar === "All"} onClick={() => setActivePillar("All")} />
        {PILLAR_MODELS.map((p) => {
          const attrs = p.models.flatMap((m) => m.attrs);
          const count = attrs.filter((a) => dirty[a] !== undefined || (grades[a]?.scout_grade ?? null) !== null).length;
          return (
            <PillarTab
              key={p.pillar}
              label={p.pillar}
              color={p.color}
              active={activePillar === p.pillar}
              onClick={() => setActivePillar(p.pillar)}
              badge={count > 0 ? `${count}/${attrs.length}` : undefined}
            />
          );
        })}
      </div>

      {/* Grade rows */}
      <div className="px-3 py-2 max-h-[60vh] overflow-y-auto space-y-3">
        {!loaded ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">Loading grades...</div>
        ) : (
          visiblePillars.map((pillar) => (
            <div key={pillar.pillar}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: pillar.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: pillar.color }}>{pillar.pillar}</span>
              </div>
              {pillar.models.map((model) => (
                <div key={model.name} className="mb-2">
                  <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 pl-0.5">{model.name}</div>
                  <div className="space-y-0.5">
                    {model.attrs.map((attr) => (
                      <GradeRow
                        key={attr}
                        attr={attr}
                        grade={grades[attr] ?? { scout_grade: null, stat_score: null, source: null }}
                        dirtyValue={dirty[attr]}
                        setGrade={setGrade}
                        pillarColor={pillar.color}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Save bar */}
      {dirtyCount > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/80">
          <button
            onClick={saveGrades}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-[var(--color-accent-tactical)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
          >
            {saving ? "Saving..." : `Save ${dirtyCount} grade${dirtyCount > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Scale hint */}
      <div className="px-3 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/30">
        <p className="text-[9px] text-[var(--text-muted)] text-center">
          1-20 scale &middot; Grey = pipeline stat &middot; Drag slider or type value
        </p>
      </div>
    </div>
  );
}

/* ── Pillar tab ── */
function PillarTab({ label, color, active, onClick, badge }: {
  label: string; color?: string; active: boolean; onClick: () => void; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
        active
          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      }`}
      style={active && color ? { color } : undefined}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
      {label}
      {badge && <span className="text-[8px] font-mono opacity-60">{badge}</span>}
    </button>
  );
}

/* ── Grade row: label + pipeline ref + slider + value ── */
function GradeRow({ attr, grade, dirtyValue, setGrade, pillarColor }: {
  attr: string;
  grade: GradeData;
  dirtyValue: number | undefined;
  setGrade: (attr: string, value: number | null) => void;
  pillarColor: string;
}) {
  const currentValue = dirtyValue !== undefined ? (dirtyValue > 0 ? dirtyValue : null) : grade.scout_grade;
  const hasStat = grade.stat_score !== null;
  const isDirty = dirtyValue !== undefined;
  // Pipeline reference as a percentage position on 1-20 scale
  const statPct = hasStat ? ((grade.stat_score! - 1) / 19) * 100 : 0;

  return (
    <div className={`flex items-center gap-2 py-[3px] px-1.5 rounded ${isDirty ? "bg-[var(--color-accent-tactical)]/5" : ""}`}>
      {/* Attribute label */}
      <span className="text-[10px] text-[var(--text-muted)] w-[72px] shrink-0 truncate" title={ATTR_LABELS[attr] ?? attr}>
        {ATTR_LABELS[attr] ?? attr}
      </span>

      {/* Pipeline reference value */}
      <span
        className="text-[9px] font-mono text-[var(--text-muted)]/40 w-4 text-right shrink-0"
        title={hasStat ? `Pipeline: ${grade.stat_score} (${grade.source})` : "No pipeline data"}
      >
        {hasStat ? grade.stat_score : ""}
      </span>

      {/* Slider */}
      <div className="flex-1 relative h-5 flex items-center min-w-[80px]">
        {/* Pipeline reference marker */}
        {hasStat && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-[var(--text-muted)]/20 rounded-full pointer-events-none z-[1]"
            style={{ left: `${statPct}%` }}
            title={`Pipeline: ${grade.stat_score}`}
          />
        )}
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={currentValue ?? 10}
          onChange={(e) => setGrade(attr, parseInt(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer grade-slider"
          style={{
            background: currentValue
              ? `linear-gradient(to right, ${pillarColor} 0%, ${pillarColor} ${((currentValue - 1) / 19) * 100}%, var(--bg-elevated) ${((currentValue - 1) / 19) * 100}%, var(--bg-elevated) 100%)`
              : "var(--bg-elevated)",
            opacity: currentValue ? 1 : 0.3,
          }}
        />
      </div>

      {/* Value input */}
      <input
        type="number"
        min={1}
        max={20}
        value={currentValue ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            setGrade(attr, null);
          } else {
            setGrade(attr, Math.min(20, Math.max(1, parseInt(v) || 1)));
          }
        }}
        placeholder="--"
        className={`w-8 h-6 text-center text-[11px] font-mono font-bold rounded border transition-colors bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          currentValue
            ? isDirty
              ? "border-[var(--color-accent-tactical)]/50 text-[var(--text-primary)]"
              : "border-[var(--border-subtle)] text-[var(--text-primary)]"
            : "border-[var(--border-subtle)]/50 text-[var(--text-muted)]/30"
        }`}
      />
    </div>
  );
}
