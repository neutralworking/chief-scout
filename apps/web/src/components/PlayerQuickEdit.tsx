"use client";

import { useState, useEffect, useRef } from "react";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PURSUIT_STATUSES = ["", "Pass", "Watch", "Monitor", "Scout Further", "Interested", "Priority"];
const SQUAD_ROLES = ["", "Key Player", "Important Player", "Rotation", "Backup", "Youth", "Surplus"];

interface PlayerData {
  person_id: number;
  level: number | null;
  position: string | null;
  archetype: string | null;
  blueprint: string | null;
  pursuit_status: string | null;
  squad_role: string | null;
  scouting_notes: string | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function PlayerQuickEdit({ player }: { player: PlayerData }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Editable fields
  const [level, setLevel] = useState(player.level);
  const [position, setPosition] = useState(player.position ?? "");
  const [archetype, setArchetype] = useState(player.archetype ?? "");
  const [blueprint, setBlueprint] = useState(player.blueprint ?? "");
  const [pursuit, setPursuit] = useState(player.pursuit_status ?? "");
  const [squadRole, setSquadRole] = useState(player.squad_role ?? "");
  const [notes, setNotes] = useState(player.scouting_notes ?? "");
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("network_admin") === "1");
  }, []);

  if (!isAdmin) return null;

  async function save(table: string, updates: Record<string, unknown>) {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/player-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: player.person_id, table, updates }),
      });
      if (!res.ok) throw new Error("Save failed");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  async function saveAll() {
    setStatus("saving");
    try {
      const promises = [];

      // Profile fields
      const profileUpdates: Record<string, unknown> = {};
      if (level !== player.level) profileUpdates.level = level;
      if (position !== (player.position ?? "")) profileUpdates.position = position || null;
      if (archetype !== (player.archetype ?? "")) profileUpdates.archetype = archetype || null;
      if (blueprint !== (player.blueprint ?? "")) profileUpdates.blueprint = blueprint || null;
      if (Object.keys(profileUpdates).length > 0) {
        promises.push(save("player_profiles", profileUpdates));
      }

      // Status fields
      const statusUpdates: Record<string, unknown> = {};
      if (pursuit !== (player.pursuit_status ?? "")) statusUpdates.pursuit_status = pursuit || null;
      if (squadRole !== (player.squad_role ?? "")) statusUpdates.squad_role = squadRole || null;
      if (notes !== (player.scouting_notes ?? "")) statusUpdates.scouting_notes = notes || null;
      if (Object.keys(statusUpdates).length > 0) {
        promises.push(save("player_status", statusUpdates));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-[9px] font-semibold text-[var(--text-muted)] hover:text-[var(--accent-tactical)] transition-colors"
      >
        Edit
      </button>
    );
  }

  // Auto-resize textarea
  function autoResize() {
    const ta = notesRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  }

  const inputClass = "w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-tactical)] transition-colors";
  const selectClass = inputClass + " cursor-pointer";
  const labelClass = "text-[8px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5";

  return (
    <div className="glass rounded-xl p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-tactical)]">Quick Edit</span>
        <div className="flex items-center gap-2">
          {status === "saving" && <span className="text-[9px] text-[var(--text-muted)]">Saving...</span>}
          {status === "saved" && <span className="text-[9px] text-emerald-400">Saved</span>}
          {status === "error" && <span className="text-[9px] text-red-400">Error</span>}
          <button
            onClick={() => setEditing(false)}
            className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Row 1: Level + Position + Pursuit */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelClass}>Level</label>
          <input
            type="number"
            min={1}
            max={99}
            value={level ?? ""}
            onChange={(e) => setLevel(e.target.value ? parseInt(e.target.value) : null)}
            className={inputClass + " font-mono font-bold text-center"}
          />
        </div>
        <div>
          <label className={labelClass}>Position</label>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className={selectClass}>
            <option value="">–</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Pursuit</label>
          <select value={pursuit} onChange={(e) => setPursuit(e.target.value)} className={selectClass}>
            {PURSUIT_STATUSES.map((s) => <option key={s} value={s}>{s || "–"}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Archetype + Blueprint + Squad Role */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelClass}>Archetype</label>
          <input
            type="text"
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            placeholder="e.g. Creator"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Blueprint</label>
          <input
            type="text"
            value={blueprint}
            onChange={(e) => setBlueprint(e.target.value)}
            placeholder="e.g. Iniesta"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Squad Role</label>
          <select value={squadRole} onChange={(e) => setSquadRole(e.target.value)} className={selectClass}>
            {SQUAD_ROLES.map((s) => <option key={s} value={s}>{s || "–"}</option>)}
          </select>
        </div>
      </div>

      {/* Row 3: Scouting Notes */}
      <div>
        <label className={labelClass}>Scouting Notes</label>
        <textarea
          ref={notesRef}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); autoResize(); }}
          onFocus={autoResize}
          placeholder="Write scouting assessment..."
          rows={2}
          className={inputClass + " resize-none min-h-[60px]"}
        />
      </div>

      {/* Save button — full width, thumb-friendly */}
      <button
        onClick={saveAll}
        disabled={status === "saving"}
        className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors cursor-pointer"
      >
        {status === "saving" ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
