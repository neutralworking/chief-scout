"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { POSITION_COLORS } from "@/lib/types";

/* ── 52 attributes grouped by 4 pillars × 13 models ──────────────────────── */
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
      { name: "Creator", attrs: ["creativity", "flair", "vision", "threat"] },
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

const ALL_ATTRS = PILLAR_MODELS.flatMap((p) => p.models.flatMap((m) => m.attrs));

const ATTR_LABELS: Record<string, string> = {
  close_range: "Close", mid_range: "Mid", long_range: "Long", penalties: "Pen",
  carries: "Carry", first_touch: "1st Touch", skills: "Skills", take_ons: "Take-On",
  pass_accuracy: "Accuracy", crossing: "Cross", pass_range: "Range", through_balls: "Through",
  agility: "Agility", footwork: "Footwk", handling: "Handle", reactions: "React",
  blocking: "Block", clearances: "Clear", marking: "Mark", tackling: "Tackle",
  awareness: "Aware", discipline: "Disc", interceptions: "Intcpt", positioning: "Posn",
  intensity: "Intens", pressing: "Press", stamina: "Stam", versatility: "Versa",
  anticipation: "Antic", composure: "Comp", decisions: "Decide", tempo: "Tempo",
  communication: "Comms", concentration: "Conc", drive: "Drive", leadership: "Lead",
  creativity: "Create", flair: "Flair", vision: "Vision", threat: "Threat",
  aerial_duels: "Aerial", heading: "Head", jumping: "Jump", volleys: "Volley",
  acceleration: "Accel", balance: "Bal", movement: "Move", pace: "Pace",
  aggression: "Aggr", duels: "Duels", shielding: "Shield",
};

const POSITIONS = ["All", "GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

/* ── Types ────────────────────────────────────────────────────────────────── */
interface QueuePlayer {
  id: number;
  name: string;
  position: string | null;
  club: string | null;
  nation_code: string | null;
  best_role: string | null;
  best_role_score: number | null;
  earned_archetype: string | null;
  archetype: string | null;
  level: number | null;
  age: number | null;
  scout_grades: number;
  pipeline_grades: number;
  total_coverage: number;
}

interface GradeData {
  scout_grade: number | null;
  stat_score: number | null;
  source: string | null;
}

/* ── Main component ───────────────────────────────────────────────────────── */
export function GradingTab() {
  const [players, setPlayers] = useState<QueuePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "needs_grades" | "partial">("needs_grades");
  const [posFilter, setPosFilter] = useState("All");
  const [gradedIds, setGradedIds] = useState<Set<number>>(new Set());

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200", filter });
      if (posFilter !== "All") params.set("position", posFilter);
      const res = await fetch(`/api/admin/grading-queue?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players ?? []);
      }
    } catch { /* */ }
    setLoading(false);
  }, [filter, posFilter]);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  const activePlayer = players.find((p) => p.id === activeId) ?? null;
  const gradedCount = players.filter((p) => gradedIds.has(p.id) || p.scout_grades > 0).length;

  function handleSaved(pid: number) {
    setGradedIds((prev) => new Set(prev).add(pid));
    // Auto-advance to next player
    const idx = players.findIndex((p) => p.id === pid);
    const next = players[idx + 1];
    if (next) setActiveId(next.id);
  }

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-[var(--text-secondary)]">
          {loading ? "Loading..." : `${players.length} players · ${gradedCount} with scout grades`}
        </p>
        <div className="flex gap-1 flex-wrap">
          {(["needs_grades", "partial", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                filter === f
                  ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent"
              }`}
            >
              {f === "needs_grades" ? "Needs Grades" : f === "partial" ? "Partial" : "All"}
            </button>
          ))}
          <span className="w-px bg-[var(--border-subtle)] mx-1" />
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${
                posFilter === pos
                  ? "bg-[var(--color-accent-physical)]/20 text-[var(--color-accent-physical)] border border-[var(--color-accent-physical)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3">
        {/* Queue list */}
        <div className="card rounded-xl overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading queue...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-surface-solid)] z-10">
                <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <th className="text-left py-2 px-2 font-medium w-8">Pos</th>
                  <th className="text-left py-2 px-2 font-medium">Player</th>
                  <th className="text-right py-2 px-2 font-medium w-10">RS</th>
                  <th className="text-center py-2 px-2 font-medium w-14">Grades</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const isActive = p.id === activeId;
                  const hasScout = gradedIds.has(p.id) || p.scout_grades > 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setActiveId(isActive ? null : p.id)}
                      className={`border-b border-[var(--border-subtle)]/30 cursor-pointer transition-colors ${
                        isActive ? "bg-[var(--color-accent-tactical)]/10" : "hover:bg-[var(--bg-elevated)]/30"
                      }`}
                    >
                      <td className="py-1 px-2">
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60"} text-white`}>
                          {p.position ?? "–"}
                        </span>
                      </td>
                      <td className="py-1 px-2">
                        <div className="text-[11px] font-medium text-[var(--text-primary)] truncate max-w-[160px]">{p.name}</div>
                        <div className="text-[9px] text-[var(--text-muted)] truncate">{p.club ?? "—"}</div>
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-[11px] text-[var(--text-secondary)]">
                        {p.best_role_score ?? "–"}
                      </td>
                      <td className="py-1 px-2 text-center">
                        {hasScout ? (
                          <span className="text-green-400 text-[10px]">✓ {p.scout_grades}</span>
                        ) : p.total_coverage > 0 ? (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">{p.total_coverage}</span>
                        ) : (
                          <span className="text-[10px] text-red-400/60">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Grade editor panel */}
        {activePlayer ? (
          <GradePanel player={activePlayer} onSaved={handleSaved} />
        ) : (
          <div className="card rounded-xl p-6 flex items-center justify-center">
            <p className="text-sm text-[var(--text-muted)]">Select a player to grade</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Grade editor panel ───────────────────────────────────────────────────── */
function GradePanel({ player, onSaved }: { player: QueuePlayer; onSaved: (pid: number) => void }) {
  const [grades, setGrades] = useState<Record<string, GradeData>>({});
  const [dirty, setDirty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load grades when player changes
  useEffect(() => {
    setLoaded(false);
    setDirty({});
    async function load() {
      try {
        const res = await fetch(`/api/admin/attribute-grades?person_id=${player.id}`);
        if (res.ok) {
          const data = await res.json();
          setGrades(data.grades ?? {});
        }
      } catch { /* */ }
      setLoaded(true);
    }
    load();
    // Scroll to top of panel
    containerRef.current?.scrollTo(0, 0);
  }, [player.id]);

  const setGrade = useCallback((attr: string, value: number) => {
    setDirty((prev) => ({ ...prev, [attr]: value }));
  }, []);

  const saveAndNext = useCallback(async () => {
    const entries = Object.entries(dirty);
    if (entries.length === 0) {
      // No changes, just advance
      onSaved(player.id);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attribute-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: player.id,
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
        onSaved(player.id);
      }
    } catch { /* */ }
    setSaving(false);
  }, [player.id, dirty, onSaved]);

  // Keyboard shortcut: Ctrl+Enter to save & next
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        saveAndNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveAndNext]);

  const dirtyCount = Object.keys(dirty).length;
  const scoutCount = ALL_ATTRS.filter((a) =>
    dirty[a] !== undefined || (grades[a]?.scout_grade ?? null) !== null
  ).length;

  return (
    <div ref={containerRef} className="card rounded-xl p-3 max-h-[calc(100vh-200px)] overflow-y-auto space-y-3">
      {/* Player header */}
      <div className="flex items-center justify-between sticky top-0 bg-[var(--bg-surface-solid)] z-10 pb-2 -mt-1 pt-1 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60"} text-white shrink-0`}>
            {player.position ?? "–"}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--text-primary)] truncate">{player.name}</div>
            <div className="text-[10px] text-[var(--text-muted)] truncate">
              {player.club ?? "—"} · {player.nation_code ?? ""} · {player.age ?? "?"}y
              {player.best_role && <> · <span className="text-[var(--color-accent-tactical)]">{player.best_role}</span></>}
              {player.earned_archetype && <> · {player.earned_archetype}</>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {scoutCount}/52 scout
          </span>
          <button
            onClick={saveAndNext}
            disabled={saving}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              dirtyCount > 0
                ? "bg-[var(--color-accent-tactical)] text-white hover:opacity-90"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-secondary)]"
            } disabled:opacity-50`}
          >
            {saving ? "..." : dirtyCount > 0 ? `Save ${dirtyCount} & Next ⌘↵` : "Skip → Next"}
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">Loading grades...</div>
      ) : (
        /* Grade grid — all 4 pillars visible */
        <div className="space-y-4">
          {PILLAR_MODELS.map((pillar) => (
            <div key={pillar.pillar}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: pillar.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: pillar.color }}>
                  {pillar.pillar}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1">
                {pillar.models.map((model) => (
                  <div key={model.name}>
                    <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-0.5 pl-0.5">
                      {model.name}
                    </div>
                    {model.attrs.map((attr) => (
                      <CompactAttrRow
                        key={attr}
                        attr={attr}
                        grade={grades[attr] ?? { scout_grade: null, stat_score: null, source: null }}
                        dirtyValue={dirty[attr]}
                        setGrade={setGrade}
                        pillarColor={pillar.color}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Compact attribute row — designed for speed (1-20 scale) ──────────────── */
function CompactAttrRow({
  attr,
  grade,
  dirtyValue,
  setGrade,
  pillarColor,
}: {
  attr: string;
  grade: GradeData;
  dirtyValue: number | undefined;
  setGrade: (attr: string, value: number) => void;
  pillarColor: string;
}) {
  const currentValue = dirtyValue ?? grade.scout_grade;
  const hasStat = grade.stat_score !== null;
  const isDirty = dirtyValue !== undefined;
  const statPct = hasStat ? ((grade.stat_score! - 1) / 19) * 100 : 0;

  return (
    <div className={`flex items-center gap-1.5 py-[3px] px-1 rounded ${isDirty ? "bg-[var(--color-accent-tactical)]/5" : ""}`}>
      {/* Label */}
      <span className="text-[10px] text-[var(--text-muted)] w-16 shrink-0 truncate" title={attr}>
        {ATTR_LABELS[attr] ?? attr}
      </span>

      {/* Pipeline reference */}
      <span className="text-[9px] font-mono text-[var(--text-muted)]/50 w-5 text-right shrink-0" title={`Pipeline: ${grade.stat_score} (${grade.source})`}>
        {hasStat ? grade.stat_score : ""}
      </span>

      {/* Slider (1-20) */}
      <div className="flex-1 relative h-5 flex items-center min-w-[60px]">
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

      {/* Value display */}
      <input
        type="number"
        min={1}
        max={20}
        value={currentValue ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v !== "") {
            setGrade(attr, Math.min(20, Math.max(1, parseInt(v) || 1)));
          }
        }}
        placeholder="--"
        className={`w-7 h-5 text-center text-[10px] font-mono font-bold rounded border bg-transparent transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          currentValue
            ? isDirty
              ? "border-[var(--color-accent-tactical)]/50 text-[var(--text-primary)]"
              : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
            : "border-transparent text-[var(--text-muted)]/30"
        }`}
      />
    </div>
  );
}
