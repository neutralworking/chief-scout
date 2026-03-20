"use client";

import { useState, useEffect, useCallback } from "react";

interface DofAssessment {
  id?: number;
  technical: number | null;
  physical: number | null;
  tactical: number | null;
  personality: number | null;
  commercial: number | null;
  availability: number | null;
  technical_note: string;
  physical_note: string;
  tactical_note: string;
  personality_note: string;
  commercial_note: string;
  availability_note: string;
  worth_right_team_meur: number | "";
  worth_any_team_meur: number | "";
  usage_profile: string;
  summary: string;
  confidence: "conviction" | "informed" | "impression";
}

const EMPTY_ASSESSMENT: DofAssessment = {
  technical: null, physical: null, tactical: null,
  personality: null, commercial: null, availability: null,
  technical_note: "", physical_note: "", tactical_note: "",
  personality_note: "", commercial_note: "", availability_note: "",
  worth_right_team_meur: "", worth_any_team_meur: "",
  usage_profile: "", summary: "", confidence: "informed",
};

const DIMENSIONS: {
  key: keyof Pick<DofAssessment, "technical" | "physical" | "tactical" | "personality" | "commercial" | "availability">;
  noteKey: keyof DofAssessment;
  label: string;
  color: string;
  barColor: string;
}[] = [
  { key: "technical", noteKey: "technical_note", label: "Technical", color: "var(--color-accent-technical)", barColor: "bg-amber-500" },
  { key: "physical", noteKey: "physical_note", label: "Physical", color: "var(--color-accent-physical)", barColor: "bg-blue-500" },
  { key: "tactical", noteKey: "tactical_note", label: "Tactical", color: "var(--color-accent-tactical)", barColor: "bg-purple-500" },
  { key: "personality", noteKey: "personality_note", label: "Personality", color: "var(--color-accent-mental)", barColor: "bg-green-500" },
  { key: "commercial", noteKey: "commercial_note", label: "Commercial", color: "var(--color-accent-personality)", barColor: "bg-yellow-500" },
  { key: "availability", noteKey: "availability_note", label: "Availability", color: "var(--text-secondary)", barColor: "bg-gray-400" },
];

const CONFIDENCE_LEVELS = [
  { value: "conviction" as const, label: "Conviction", desc: "Watched extensively" },
  { value: "informed" as const, label: "Informed", desc: "Solid knowledge" },
  { value: "impression" as const, label: "Impression", desc: "Gut feel" },
];

export default function DofAssessmentSection({ personId }: { personId: number }) {
  const [assessment, setAssessment] = useState<DofAssessment>(EMPTY_ASSESSMENT);
  const [hasExisting, setHasExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dof-assessments/${personId}`);
        if (res.ok) {
          const data = await res.json();
          setAssessment({
            id: data.id,
            technical: data.technical,
            physical: data.physical,
            tactical: data.tactical,
            personality: data.personality,
            commercial: data.commercial,
            availability: data.availability,
            technical_note: data.technical_note ?? "",
            physical_note: data.physical_note ?? "",
            tactical_note: data.tactical_note ?? "",
            personality_note: data.personality_note ?? "",
            commercial_note: data.commercial_note ?? "",
            availability_note: data.availability_note ?? "",
            worth_right_team_meur: data.worth_right_team_meur ?? "",
            worth_any_team_meur: data.worth_any_team_meur ?? "",
            usage_profile: data.usage_profile ?? "",
            summary: data.summary ?? "",
            confidence: data.confidence ?? "informed",
          });
          setHasExisting(true);
          setExpanded(true);
        }
      } catch {
        // No existing assessment
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [personId]);

  const setField = useCallback(<K extends keyof DofAssessment>(key: K, value: DofAssessment[K]) => {
    setAssessment(prev => ({ ...prev, [key]: value }));
    setSaveMsg(null);
  }, []);

  const saveAssessment = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = {
        ...assessment,
        worth_right_team_meur: assessment.worth_right_team_meur === "" ? null : Number(assessment.worth_right_team_meur),
        worth_any_team_meur: assessment.worth_any_team_meur === "" ? null : Number(assessment.worth_any_team_meur),
      };
      delete (payload as Record<string, unknown>).id;

      const res = await fetch(`/api/dof-assessments/${personId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setAssessment(prev => ({ ...prev, id: data.id }));
        setHasExisting(true);
        setSaveMsg("saved");
        setTimeout(() => setSaveMsg(null), 3000);
      } else {
        const err = await res.json();
        setSaveMsg(`Error: ${err.error}`);
      }
    } catch {
      setSaveMsg("Save failed");
    } finally {
      setSaving(false);
    }
  }, [personId, assessment]);

  if (loading) {
    return (
      <div className="glass rounded-xl p-4 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">DoF Assessment</h2>
        <p className="text-xs text-[var(--text-muted)] mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">DoF Assessment</h2>
          {hasExisting && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30 font-semibold">
              {assessment.confidence}
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Confidence selector */}
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">Confidence</label>
            <div className="flex gap-2">
              {CONFIDENCE_LEVELS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setField("confidence", c.value)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-semibold border transition-colors ${
                    assessment.confidence === c.value
                      ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border-[var(--color-accent-tactical)]/40"
                      : "bg-[var(--bg-surface-solid)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--text-muted)]"
                  }`}
                  title={c.desc}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimension inputs — 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DIMENSIONS.map(dim => (
              <DimensionInput
                key={dim.key}
                label={dim.label}
                value={assessment[dim.key]}
                note={assessment[dim.noteKey] as string}
                color={dim.color}
                barColor={dim.barColor}
                onValueChange={v => setField(dim.key, v)}
                onNoteChange={v => setField(dim.noteKey as keyof DofAssessment, v as never)}
              />
            ))}
          </div>

          {/* Valuations */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Worth (right team)</label>
              <div className="relative">
                <input
                  type="number"
                  value={assessment.worth_right_team_meur}
                  onChange={e => setField("worth_right_team_meur", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="200"
                  min={0}
                  className="w-full px-2 py-1.5 pr-8 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent-tactical)] transition-colors"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">m&euro;</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Worth (any team)</label>
              <div className="relative">
                <input
                  type="number"
                  value={assessment.worth_any_team_meur}
                  onChange={e => setField("worth_any_team_meur", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="100"
                  min={0}
                  className="w-full px-2 py-1.5 pr-8 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent-tactical)] transition-colors"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">m&euro;</span>
              </div>
            </div>
          </div>

          {/* Context premium indicator */}
          {assessment.worth_right_team_meur && assessment.worth_any_team_meur && Number(assessment.worth_any_team_meur) > 0 && (
            <div className="text-[10px] text-[var(--text-muted)] px-2">
              Context premium: <span className="text-[var(--text-primary)] font-mono">{(Number(assessment.worth_right_team_meur) / Number(assessment.worth_any_team_meur)).toFixed(2)}x</span>
              {" "}&mdash;{" "}
              {Number(assessment.worth_right_team_meur) / Number(assessment.worth_any_team_meur) > 1.5
                ? "high context dependency"
                : Number(assessment.worth_right_team_meur) / Number(assessment.worth_any_team_meur) > 1.2
                ? "moderate context dependency"
                : "universally valuable"}
            </div>
          )}

          {/* Usage profile */}
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Usage Profile</label>
            <input
              type="text"
              value={assessment.usage_profile}
              onChange={e => setField("usage_profile", e.target.value)}
              placeholder="Must-win situations, creativity focus, penalty box dominance..."
              className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-tactical)] transition-colors"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Summary</label>
            <textarea
              value={assessment.summary}
              onChange={e => setField("summary", e.target.value)}
              placeholder="Overall DoF assessment narrative..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-tactical)] transition-colors resize-y"
            />
          </div>

          {/* Save */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs">
              {saveMsg === "saved" && <span className="text-[var(--color-accent-tactical)]">Assessment saved</span>}
              {saveMsg && saveMsg !== "saved" && <span className="text-red-400">{saveMsg}</span>}
            </div>
            <button
              onClick={saveAssessment}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[var(--color-accent-mental)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? "Saving..." : hasExisting ? "Update Assessment" : "Save Assessment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DimensionInput({
  label, value, note, color, barColor, onValueChange, onNoteChange,
}: {
  label: string;
  value: number | null;
  note: string;
  color: string;
  barColor: string;
  onValueChange: (v: number | null) => void;
  onNoteChange: (v: string) => void;
}) {
  const score = value ?? 0;
  const pct = score * 10;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color }}>{label}</label>
        <span className="text-xs font-mono font-bold" style={{ color }}>{value ?? "–"}</span>
      </div>

      {/* Bar + slider */}
      <div className="relative h-2 bg-[var(--bg-surface-solid)] rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%`, opacity: 0.8 }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={10}
        value={value ?? 0}
        onChange={e => {
          const v = Number(e.target.value);
          onValueChange(v === 0 ? null : v);
        }}
        className="w-full h-1 appearance-none cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
        style={{ accentColor: color }}
      />

      {/* Note */}
      <textarea
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder={`${label} reasoning...`}
        rows={2}
        className="w-full px-2 py-1 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-glow)] transition-colors resize-y"
      />
    </div>
  );
}
