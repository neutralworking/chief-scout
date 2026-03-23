"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { computeAge, POSITION_COLORS } from "@/lib/types";
import { PERSONALITY_TYPES } from "@/lib/personality";

const DIMENSION_LABELS = {
  ei: { high: "A", low: "I", name: "Game Reading", highLabel: "Analytical", lowLabel: "Instinctive", hint: "Pattern recognition vs improvisation. Does the player read situations methodically or react on instinct?" },
  sn: { high: "X", low: "N", name: "Motivation", highLabel: "Extrinsic", lowLabel: "Intrinsic", hint: "What drives their effort? Crowd/occasion energy vs internal standards/self-motivation?" },
  tf: { high: "S", low: "L", name: "Social", highLabel: "Soloist", lowLabel: "Leader", hint: "Self-contained and task-focused vs organizes/commands teammates?" },
  jp: { high: "C", low: "P", name: "Pressure", highLabel: "Competitor", lowLabel: "Composer", hint: "Confrontation and aggression under pressure vs composure and calm decision-making?" },
} as const;

const PERSONALITY_NAMES: Record<string, { name: string; oneLiner: string }> = Object.fromEntries(
  Object.entries(PERSONALITY_TYPES).map(([code, pt]) => [code, { name: pt.fullName, oneLiner: pt.oneLiner }])
);

function computeCode(ei: number, sn: number, tf: number, jp: number): string {
  return [
    ei >= 50 ? "A" : "I",
    sn >= 50 ? "X" : "N",
    tf >= 50 ? "S" : "L",
    jp >= 50 ? "C" : "P",
  ].join("");
}

interface QueuePlayer {
  person_id: number;
  name: string;
  level: number | null;
  position: string | null;
  archetype: string | null;
  blueprint: string | null;
  personality_type: string;
  ei: number;
  sn: number;
  tf: number;
  jp: number;
  competitiveness: number | null;
  coachability: number | null;
  club: string | null;
  nation: string | null;
  dob: string | null;
  scouting_notes: string | null;
  pursuit_status: string | null;
  squad_role: string | null;
  is_inferred: boolean;
  personality_confidence: string;
  trajectory: string | null;
  loyalty_score: number | null;
  mobility_score: number | null;
  clubs_count: number | null;
  career_years: number | null;
  tags: string[];
  top_attributes: Array<{ attribute: string; score: number; source: string }>;
}

export function PersonalityTab() {
  const [players, setPlayers] = useState<QueuePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"inferred" | "reviewed" | "all">("inferred");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/personality-queue?limit=50&filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players ?? []);
      }
    } catch { /* */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  const activePlayer = players.find(p => p.person_id === activeId) ?? null;
  const reviewed = players.filter(p => !p.is_inferred || savedIds.has(p.person_id)).length;
  const total = players.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[var(--text-secondary)]">
          {loading ? "Loading..." : `${total} players \u00b7 ${reviewed} reviewed`}
        </p>
        <div className="flex gap-1">
          {(["inferred", "reviewed", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                filter === f
                  ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent"
              }`}
            >
              {f === "inferred" ? "Needs Review" : f === "reviewed" ? "Reviewed" : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-3">
        {/* Queue list */}
        <div className="card rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading queue...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <th className="text-left py-2 px-3 font-medium w-10">Pos</th>
                  <th className="text-left py-2 px-3 font-medium">Player</th>
                  <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Archetype</th>
                  <th className="text-center py-2 px-3 font-medium w-16">Current</th>
                  <th className="text-right py-2 px-3 font-medium w-12">OVR</th>
                  <th className="text-center py-2 px-3 font-medium w-10">St</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => {
                  const isActive = p.person_id === activeId;
                  const isSaved = savedIds.has(p.person_id);
                  const isSuspect = p.is_inferred && !isSaved && (
                    (p.ei >= 48 && p.ei <= 52) || (p.sn >= 48 && p.sn <= 52) ||
                    (p.tf >= 48 && p.tf <= 52) || (p.jp >= 48 && p.jp <= 52)
                  );

                  return (
                    <tr
                      key={p.person_id}
                      onClick={() => setActiveId(isActive ? null : p.person_id)}
                      className={`border-b border-[var(--border-subtle)]/30 cursor-pointer transition-colors ${
                        isActive ? "bg-[var(--color-accent-personality)]/10" : "hover:bg-[var(--bg-elevated)]/30"
                      }`}
                    >
                      <td className="py-1.5 px-3">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60"} text-white`}>
                          {p.position ?? "\u2013"}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">
                        <span className="font-medium text-[var(--text-primary)]">{p.name}</span>
                        <span className="text-[10px] text-[var(--text-muted)] ml-1.5">{p.club}</span>
                      </td>
                      <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden md:table-cell">
                        {p.archetype || "\u2013"}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <span className={`font-mono text-xs font-bold ${isSuspect ? "text-red-400" : "text-[var(--color-accent-personality)]"}`}>
                          {p.personality_type}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs text-[var(--text-muted)]">
                        {p.level ?? "\u2013"}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        {isSaved ? (
                          <span className="text-green-400 text-xs">&#10003;</span>
                        ) : !p.is_inferred ? (
                          <span className="text-blue-400 text-xs">&#10003;</span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-[10px]">&#x2022;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Assessment panel */}
        {activePlayer ? (
          <AssessmentPanel
            player={activePlayer}
            onSave={(pid) => {
              setSavedIds(prev => new Set(prev).add(pid));
              const idx = players.findIndex(p => p.person_id === pid);
              const next = players[idx + 1];
              if (next) setActiveId(next.person_id);
            }}
          />
        ) : (
          <div className="card rounded-xl p-6 flex items-center justify-center">
            <p className="text-sm text-[var(--text-muted)]">Select a player to assess</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentPanel({ player, onSave }: { player: QueuePlayer; onSave: (pid: number) => void }) {
  const [ei, setEi] = useState(player.ei);
  const [sn, setSn] = useState(player.sn);
  const [tf, setTf] = useState(player.tf);
  const [jp, setJp] = useState(player.jp);
  const [comp, setComp] = useState(player.competitiveness ?? 5);
  const [coach, setCoach] = useState(player.coachability ?? 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEi(player.ei); setSn(player.sn); setTf(player.tf); setJp(player.jp);
    setComp(player.competitiveness ?? 5); setCoach(player.coachability ?? 5);
    setError(null);
  }, [player.person_id, player.ei, player.sn, player.tf, player.jp, player.competitiveness, player.coachability]);

  const code = computeCode(ei, sn, tf, jp);
  const info = PERSONALITY_NAMES[code];
  const originalCode = player.personality_type;
  const changed = code !== originalCode || comp !== (player.competitiveness ?? 5) || coach !== (player.coachability ?? 5);
  const age = computeAge(player.dob);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/player-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: player.person_id, table: "player_personality",
          updates: { ei, sn, tf, jp, competitiveness: comp, coachability: coach, is_inferred: false, confidence: "Medium" },
        }),
      });
      if (!res.ok) { const data = await res.json(); setError(data.error ?? "Save failed"); }
      else { onSave(player.person_id); }
    } catch (e) { setError(String(e)); }
    setSaving(false);
  }

  return (
    <div className="card rounded-xl p-4 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/players/${player.person_id}`} className="text-sm font-bold text-[var(--text-primary)] hover:text-white transition-colors">
            {player.name}
          </Link>
          <p className="text-[10px] text-[var(--text-muted)]">
            {player.club} \u00b7 {player.nation} \u00b7 {age != null ? `${age}y` : "?"} \u00b7 {player.position}
            {player.archetype && ` \u00b7 ${player.archetype}`}
          </p>
        </div>
        <span className="text-lg font-mono font-bold text-[var(--text-muted)]">{player.level ?? "\u2013"}</span>
      </div>

      {/* Context */}
      {player.scouting_notes && (
        <div className="p-2.5 rounded-lg bg-[var(--bg-base)]/40 border-l-2 border-[var(--color-accent-personality)]">
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{player.scouting_notes}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-[10px]">
        {player.trajectory && <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">{player.trajectory}</span>}
        {player.loyalty_score != null && <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">loyalty: {player.loyalty_score}/20</span>}
        {player.clubs_count != null && <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">{player.clubs_count} clubs / {player.career_years?.toFixed(0) ?? "?"}yr</span>}
        {player.tags.slice(0, 8).map(t => <span key={t} className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 text-[9px]">{t}</span>)}
      </div>

      {/* Top attributes */}
      {player.top_attributes.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Top Attributes</p>
          <div className="flex flex-wrap gap-1">
            {player.top_attributes.map(a => (
              <span key={a.attribute} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                {a.attribute}: <span className="font-mono font-bold">{a.score}</span>
                <span className="text-[var(--text-muted)] ml-0.5">({a.source.replace("_assessment", "")})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Live preview */}
      <div className="text-center py-2">
        <span className={`inline-block font-mono text-2xl font-extrabold tracking-[0.15em] px-4 py-2 rounded-lg border ${
          changed ? "text-[var(--color-accent-personality)] border-[var(--color-accent-personality)]/30 bg-[var(--color-accent-personality)]/5" : "text-[var(--text-muted)] border-[var(--border-subtle)]"
        }`}>
          {code}
        </span>
        {info && <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">{info.name}</p>}
        {info && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{info.oneLiner}</p>}
        {changed && <p className="text-[9px] text-amber-400 mt-1">Changed from {originalCode} ({PERSONALITY_NAMES[originalCode]?.name ?? "?"})</p>}
      </div>

      {/* Dimension sliders */}
      <div className="space-y-3">
        {(Object.entries(DIMENSION_LABELS) as Array<[keyof typeof DIMENSION_LABELS, typeof DIMENSION_LABELS[keyof typeof DIMENSION_LABELS]]>).map(([dim, labels]) => {
          const value = dim === "ei" ? ei : dim === "sn" ? sn : dim === "tf" ? tf : jp;
          const setter = dim === "ei" ? setEi : dim === "sn" ? setSn : dim === "tf" ? setTf : setJp;
          const letter = value >= 50 ? labels.high : labels.low;
          const dominant = value >= 50 ? labels.highLabel : labels.lowLabel;

          return (
            <div key={dim}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">{labels.name}</span>
                <span className="text-[10px] font-mono font-bold text-[var(--color-accent-personality)]">
                  {letter} \u2014 {dominant} ({value})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[var(--text-muted)] w-16 text-right">{labels.lowLabel}</span>
                <input type="range" min={0} max={100} value={value} onChange={e => setter(Number(e.target.value))}
                  className="flex-1 h-2 accent-[var(--color-accent-personality)]" />
                <span className="text-[9px] text-[var(--text-muted)] w-16">{labels.highLabel}</span>
              </div>
              <p className="text-[8px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{labels.hint}</p>
            </div>
          );
        })}
      </div>

      {/* Traits */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">Competitiveness</span>
            <span className="text-xs font-mono font-bold text-[var(--color-accent-personality)]">{comp}</span>
          </div>
          <input type="range" min={1} max={10} value={comp} onChange={e => setComp(Number(e.target.value))}
            className="w-full h-2 accent-[var(--color-accent-personality)]" />
          <p className="text-[8px] text-[var(--text-muted)] mt-0.5">Drive to win duels, matches, everything</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">Coachability</span>
            <span className="text-xs font-mono font-bold text-[var(--color-accent-personality)]">{coach}</span>
          </div>
          <input type="range" min={1} max={10} value={coach} onChange={e => setCoach(Number(e.target.value))}
            className="w-full h-2 accent-[var(--color-accent-personality)]" />
          <p className="text-[8px] text-[var(--text-muted)] mt-0.5">Receptive to instruction, adapts tactically</p>
        </div>
      </div>

      {/* Save */}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
          changed
            ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30 hover:bg-[var(--color-accent-personality)]/30"
            : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
        } disabled:opacity-50`}
      >
        {saving ? "Saving..." : changed ? "Save & Next" : "Confirm & Next"}
      </button>
    </div>
  );
}
