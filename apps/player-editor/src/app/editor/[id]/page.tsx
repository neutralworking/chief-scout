"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ── SACROSANCT attribute model ──────────────────────────────────────────────
const MODELS: Record<string, { label: string; category: string; attrs: string[] }> = {
  Controller:  { label: "Controller",  category: "mental",    attrs: ["anticipation", "composure", "decisions", "tempo"] },
  Commander:   { label: "Commander",   category: "mental",    attrs: ["communication", "concentration", "drive", "leadership"] },
  Creator:     { label: "Creator",     category: "technical", attrs: ["creativity", "unpredictability", "vision", "guile"] },
  Target:      { label: "Target",      category: "physical",  attrs: ["aerial_duels", "heading", "jumping", "volleys"] },
  Sprinter:    { label: "Sprinter",    category: "physical",  attrs: ["acceleration", "balance", "movement", "pace"] },
  Powerhouse:  { label: "Powerhouse",  category: "physical",  attrs: ["aggression", "duels", "shielding", "stamina"] },
  Cover:       { label: "Cover",       category: "tactical",  attrs: ["awareness", "discipline", "interceptions", "positioning"] },
  Engine:      { label: "Engine",      category: "physical",  attrs: ["intensity", "pressing", "stamina", "versatility"] },
  Destroyer:   { label: "Destroyer",   category: "tactical",  attrs: ["blocking", "clearances", "marking", "tackling"] },
  Dribbler:    { label: "Dribbler",    category: "technical", attrs: ["carries", "first_touch", "skills", "take_ons"] },
  Passer:      { label: "Passer",      category: "technical", attrs: ["pass_accuracy", "crossing", "pass_range", "through_balls"] },
  Striker:     { label: "Striker",     category: "technical", attrs: ["close_range", "mid_range", "long_range", "penalties"] },
  GK:          { label: "Goalkeeper",  category: "technical", attrs: ["agility", "footwork", "handling", "reactions"] },
};

const CATEGORY_COLORS: Record<string, string> = {
  mental:    "var(--accent-mental)",
  physical:  "var(--accent-physical)",
  tactical:  "var(--accent-tactical)",
  technical: "var(--accent-personality)",
};

const CATEGORY_BG: Record<string, string> = {
  mental:    "bg-blue-500/10 border-blue-500/20",
  physical:  "bg-amber-500/10 border-amber-500/20",
  tactical:  "bg-green-500/10 border-green-500/20",
  technical: "bg-purple-500/10 border-purple-500/20",
};

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PURSUIT_OPTIONS = ["Priority", "Interested", "Scout Further", "Watch", "Monitor", "Pass"];
const FEET = ["Right", "Left", "Both"];

// All unique attributes across all models
const ALL_ATTRS = [...new Set(Object.values(MODELS).flatMap((m) => m.attrs))].sort();

interface PlayerData {
  person_id: number;
  name: string;
  club: string | null;
  nation: string | null;
  position: string | null;
  level: number | null;
  peak: number | null;
  overall: number | null;
  archetype: string | null;
  pursuit_status: string | null;
  scouting_notes: string | null;
  squad_role: string | null;
  blueprint: string | null;
  preferred_foot: string | null;
  height_cm: number | null;
  dob: string | null;
  hg: boolean | null;
}

interface AttrGrade {
  attribute: string;
  scout_grade: number | null;
  stat_score: number | null;
  source: string;
}

export default function PlayerEditorPage() {
  const params = useParams();
  const personId = Number(params.id);

  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [grades, setGrades] = useState<Map<string, AttrGrade[]>>(new Map());
  const [scoutGrades, setScoutGrades] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<Record<string, string | number | boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayer();
  }, [personId]);

  async function loadPlayer() {
    setLoading(true);
    setError(null);
    try {
      // Fetch player data and attribute grades in parallel
      const [playerRes, gradesRes] = await Promise.all([
        fetch(`/api/players/${personId}`),
        fetch(`/api/players/${personId}/radar`),
      ]);

      if (!playerRes.ok) {
        setError("Player not found");
        setLoading(false);
        return;
      }

      const playerData = await playerRes.json();
      setPlayer(playerData);
      setProfile({
        position: playerData.position ?? "",
        level: playerData.level ?? "",
        peak: playerData.peak ?? "",
        overall: playerData.overall ?? "",
        archetype: playerData.archetype ?? "",
        pursuit_status: playerData.pursuit_status ?? "",
        scouting_notes: playerData.scouting_notes ?? "",
        squad_role: playerData.squad_role ?? "",
        blueprint: playerData.blueprint ?? "",
        preferred_foot: playerData.preferred_foot ?? "",
        height_cm: playerData.height_cm ?? "",
        hg: playerData.hg ?? false,
      });

      // Parse radar response for raw grades
      if (gradesRes.ok) {
        const radarData = await gradesRes.json();
        // Build grades map from raw grades if available
        if (radarData.rawGrades) {
          const gMap = new Map<string, AttrGrade[]>();
          for (const g of radarData.rawGrades) {
            const list = gMap.get(g.attribute) ?? [];
            list.push(g);
            gMap.set(g.attribute, list);
          }
          setGrades(gMap);

          // Pre-fill scout grades from existing scout_assessment source
          const sg: Record<string, number> = {};
          for (const [attr, gradeList] of gMap) {
            const scout = gradeList.find((g) => g.source === "scout_assessment");
            if (scout?.scout_grade != null) {
              sg[attr] = scout.scout_grade;
            }
          }
          setScoutGrades(sg);
        }
      }
    } catch {
      setError("Failed to load player");
    } finally {
      setLoading(false);
    }
  }

  function setGrade(attr: string, value: number | null) {
    setScoutGrades((prev) => {
      if (value === null) {
        const next = { ...prev };
        delete next[attr];
        return next;
      }
      return { ...prev, [attr]: value };
    });
    setSaved(false);
  }

  function setProfileField(field: string, value: string | number | boolean | null) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  const saveAll = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const promises: Promise<Response>[] = [];

      // Save attribute grades
      const gradeEntries = Object.entries(scoutGrades).filter(([, v]) => v != null && v > 0);
      if (gradeEntries.length > 0) {
        promises.push(
          fetch("/api/admin/attribute-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              person_id: personId,
              grades: gradeEntries.map(([attribute, scout_grade]) => ({ attribute, scout_grade })),
            }),
          })
        );
      }

      // Save profile fields
      const profileUpdates: Record<string, unknown> = {};
      if (profile.position) profileUpdates.position = profile.position;
      if (profile.level !== "" && profile.level != null) profileUpdates.level = Number(profile.level);
      if (profile.peak !== "" && profile.peak != null) profileUpdates.peak = Number(profile.peak);
      if (profile.overall !== "" && profile.overall != null) profileUpdates.overall = Number(profile.overall);
      if (profile.archetype) profileUpdates.archetype = profile.archetype;
      if (profile.blueprint !== undefined) profileUpdates.blueprint = profile.blueprint || null;

      if (Object.keys(profileUpdates).length > 0) {
        promises.push(
          fetch("/api/admin/player-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person_id: personId, table: "player_profiles", updates: profileUpdates }),
          })
        );
      }

      // Save status fields
      const statusUpdates: Record<string, unknown> = {};
      if (profile.pursuit_status) statusUpdates.pursuit_status = profile.pursuit_status;
      if (profile.scouting_notes !== undefined) statusUpdates.scouting_notes = profile.scouting_notes || null;
      if (profile.squad_role !== undefined) statusUpdates.squad_role = profile.squad_role || null;

      if (Object.keys(statusUpdates).length > 0) {
        promises.push(
          fetch("/api/admin/player-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person_id: personId, table: "player_status", updates: statusUpdates }),
          })
        );
      }

      // Save people fields
      const peopleUpdates: Record<string, unknown> = {};
      if (profile.preferred_foot) peopleUpdates.preferred_foot = profile.preferred_foot;
      if (profile.height_cm !== "" && profile.height_cm != null) peopleUpdates.height_cm = Number(profile.height_cm);
      if (profile.hg !== undefined) peopleUpdates.hg = profile.hg;

      if (Object.keys(peopleUpdates).length > 0) {
        promises.push(
          fetch("/api/admin/player-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person_id: personId, table: "people", updates: peopleUpdates }),
          })
        );
      }

      const results = await Promise.all(promises);
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setError(`${failed.length} update(s) failed`);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }, [personId, scoutGrades, profile]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !player) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link href="/editor" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-4 inline-block">
          &larr; Back to search
        </Link>
        <div className="text-center py-20 text-[var(--text-muted)]">{error}</div>
      </div>
    );
  }

  if (!player) return null;

  // Helper: get best existing grade for an attribute (for display)
  function getBestGrade(attr: string): { value: number; source: string } | null {
    const list = grades.get(attr);
    if (!list?.length) return null;
    const priority = ["scout_assessment", "statsbomb", "fbref", "understat", "eafc_inferred"];
    const sorted = [...list].sort((a, b) => priority.indexOf(a.source) - priority.indexOf(b.source));
    const best = sorted[0];
    const val = best.scout_grade ?? best.stat_score;
    return val != null ? { value: val, source: best.source } : null;
  }

  const sourceColors: Record<string, string> = {
    scout_assessment: "text-[var(--accent-tactical)]",
    statsbomb: "text-blue-400",
    fbref: "text-purple-400",
    understat: "text-amber-400",
    eafc_inferred: "text-[var(--text-muted)]",
  };

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <Link href="/editor" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          &larr; Back to search
        </Link>
        <Link href={`/players/${personId}`} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          View profile &rarr;
        </Link>
      </div>

      {/* Header */}
      <div className="glass rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{player.name}</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {[player.club, player.nation, player.position, player.archetype].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right text-xs text-[var(--text-muted)] font-mono">
            ID: {personId}
          </div>
        </div>
      </div>

      {/* Profile Fields */}
      <div className="glass rounded-xl p-4 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Profile</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FieldSelect label="Position" value={String(profile.position ?? "")} options={POSITIONS} onChange={(v) => setProfileField("position", v)} />
          <FieldNumber label="Level" value={profile.level as number} onChange={(v) => setProfileField("level", v)} min={1} max={100} />
          <FieldNumber label="Peak" value={profile.peak as number} onChange={(v) => setProfileField("peak", v)} min={1} max={100} />
          <FieldNumber label="Overall" value={profile.overall as number} onChange={(v) => setProfileField("overall", v)} min={1} max={100} />
          <FieldSelect label="Foot" value={String(profile.preferred_foot ?? "")} options={FEET} onChange={(v) => setProfileField("preferred_foot", v)} />
          <FieldNumber label="Height (cm)" value={profile.height_cm as number} onChange={(v) => setProfileField("height_cm", v)} min={140} max={220} />
          <FieldSelect label="Pursuit" value={String(profile.pursuit_status ?? "")} options={PURSUIT_OPTIONS} onChange={(v) => setProfileField("pursuit_status", v)} />
          <FieldCheckbox label="Homegrown" checked={!!profile.hg} onChange={(v) => setProfileField("hg", v)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <FieldText label="Archetype" value={String(profile.archetype ?? "")} onChange={(v) => setProfileField("archetype", v)} />
          <FieldText label="Squad Role" value={String(profile.squad_role ?? "")} onChange={(v) => setProfileField("squad_role", v)} />
        </div>

        <div className="mt-3">
          <FieldTextarea label="Scouting Notes" value={String(profile.scouting_notes ?? "")} onChange={(v) => setProfileField("scouting_notes", v)} />
        </div>
        <div className="mt-3">
          <FieldTextarea label="Blueprint" value={String(profile.blueprint ?? "")} onChange={(v) => setProfileField("blueprint", v)} rows={2} />
        </div>
      </div>

      {/* Attribute Grades by Model */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Attributes</h2>
          <span className="text-[10px] text-[var(--text-muted)]">
            {Object.keys(scoutGrades).length} / {ALL_ATTRS.length} graded
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(MODELS).map(([key, model]) => (
            <div key={key} className={`rounded-xl border p-3 ${CATEGORY_BG[model.category]}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[model.category] }} />
                <span className="text-xs font-bold">{model.label}</span>
                <span className="text-[9px] text-[var(--text-muted)] uppercase">{model.category}</span>
              </div>

              <div className="space-y-1.5">
                {model.attrs.map((attr) => {
                  const existing = getBestGrade(attr);
                  const scoutVal = scoutGrades[attr];

                  return (
                    <div key={attr} className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--text-secondary)] w-28 truncate" title={attr}>
                        {attr.replace(/_/g, " ")}
                      </span>

                      {/* Existing grade indicator */}
                      {existing && scoutVal == null && (
                        <span className={`text-[9px] font-mono ${sourceColors[existing.source] ?? "text-[var(--text-muted)]"}`} title={existing.source}>
                          {existing.value}
                        </span>
                      )}

                      {/* Scout grade input */}
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={1}
                          value={scoutVal ?? 0}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setGrade(attr, v === 0 ? null : v);
                          }}
                          className="flex-1 h-1.5 accent-[var(--accent-tactical)] cursor-pointer"
                          style={{ accentColor: CATEGORY_COLORS[model.category] }}
                        />
                        <span className={`text-xs font-mono w-5 text-right ${scoutVal ? "text-[var(--text-primary)] font-bold" : "text-[var(--text-muted)]"}`}>
                          {scoutVal ?? "–"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Model average */}
              <div className="mt-2 pt-1.5 border-t border-white/5 flex justify-between">
                <span className="text-[9px] text-[var(--text-muted)]">AVG</span>
                <span className="text-[10px] font-mono font-bold" style={{ color: CATEGORY_COLORS[model.category] }}>
                  {(() => {
                    const vals = model.attrs.map((a) => scoutGrades[a]).filter((v): v is number => v != null && v > 0);
                    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "–";
                  })()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-50">
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className="glass rounded-xl p-3 flex items-center justify-between border border-[var(--border-subtle)]">
            <div className="text-xs text-[var(--text-muted)]">
              {error && <span className="text-red-400">{error}</span>}
              {saved && <span className="text-[var(--accent-tactical)]">Saved successfully</span>}
              {!error && !saved && (
                <span>{Object.keys(scoutGrades).length} attributes graded</span>
              )}
            </div>
            <button
              onClick={saveAll}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-[var(--accent-tactical)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field Components ────────────────────────────────────────────────────────

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-tactical)]"
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function FieldNumber({ label, value, onChange, min, max }: { label: string; value: number | string; onChange: (v: number | string) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        min={min}
        max={max}
        className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-tactical)]"
      />
    </div>
  );
}

function FieldText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-tactical)]"
      />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-tactical)] resize-none"
      />
    </div>
  );
}

function FieldCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 pt-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--accent-tactical)]"
      />
      <label className="text-xs text-[var(--text-secondary)]">{label}</label>
    </div>
  );
}
