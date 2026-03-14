"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────

interface Club {
  id: number;
  clubname: string;
  league_name: string | null;
}

interface Profile {
  position: string | null;
  level: number | null;
  peak: number | null;
  overall: number | null;
  archetype: string | null;
  blueprint: string | null;
}

interface Status {
  scouting_notes: string | null;
  pursuit_status: string | null;
  squad_role: string | null;
}

interface Market {
  market_value_tier: string | null;
  true_mvt: string | null;
  scarcity_score: number | null;
}

interface NetworkPlayer {
  id: number;
  name: string;
  date_of_birth: string | null;
  preferred_foot: string | null;
  height_cm: number | null;
  clubs: Club;
  player_profiles: Profile | Profile[] | null;
  player_status: Status | Status[] | null;
  player_market: Market | Market[] | null;
  grades: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────────────────

const CORE_ATTRIBUTES = [
  "passing", "vision", "crossing", "dribbling", "ball_control",
  "shooting", "finishing", "heading", "long_shots",
  "tackling", "marking", "interceptions", "positioning",
  "pace", "acceleration", "stamina", "strength", "agility",
  "composure", "decisions", "leadership", "work_rate",
];

const ATTR_CATEGORIES: Record<string, string[]> = {
  technical: ["passing", "vision", "crossing", "dribbling", "ball_control", "shooting", "finishing", "heading", "long_shots"],
  physical: ["pace", "acceleration", "stamina", "strength", "agility"],
  mental: ["composure", "decisions", "leadership", "work_rate", "positioning"],
  defensive: ["tackling", "marking", "interceptions"],
};

const CATEGORY_COLORS: Record<string, string> = {
  technical: "var(--color-accent-technical)",
  physical: "var(--color-accent-physical)",
  mental: "var(--color-accent-mental)",
  defensive: "var(--color-accent-tactical)",
};

const MODAL_TABS = [
  { key: "basic", label: "Basic Info" },
  { key: "attributes", label: "Attributes" },
  { key: "availability", label: "Availability" },
  { key: "bio", label: "History & Bio" },
  { key: "admin", label: "Admin" },
];

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PURSUIT_STATUSES = ["Priority", "Interested", "Scout Further", "Watch", "Monitor", "Pass"];
const SQUAD_ROLES = ["Key Player", "Important Player", "Rotation", "Backup", "Youth", "Surplus"];

const PURSUIT_COLORS: Record<string, string> = {
  Priority: "var(--color-pursuit-priority)",
  Interested: "var(--color-pursuit-interested)",
  Watch: "var(--color-pursuit-watch)",
  "Scout Further": "var(--color-pursuit-scout)",
  Monitor: "var(--color-pursuit-monitor)",
  Pass: "var(--color-pursuit-pass)",
};

// ── Helpers ──────────────────────────────────────────────────────────────

// Supabase returns objects for 1-to-1 relations, arrays for 1-to-many
function unwrap<T>(val: T | T[] | null | undefined): T | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

function age(dob: string | null): string {
  if (!dob) return "?";
  const diff = Date.now() - new Date(dob).getTime();
  return String(Math.floor(diff / 31557600000));
}

function levelColor(level: number | null): string {
  if (!level) return "var(--text-muted)";
  if (level >= 85) return "#e74c3c";
  if (level >= 78) return "#d4a035";
  if (level >= 70) return "#3dba6f";
  return "var(--text-secondary)";
}

function gradeColor(grade: number): string {
  if (grade >= 16) return "#e74c3c";
  if (grade >= 13) return "#d4a035";
  if (grade >= 10) return "#3dba6f";
  if (grade >= 7) return "var(--text-secondary)";
  return "var(--text-muted)";
}

// ── Inline Editable Cell ─────────────────────────────────────────────────

function EditableCell({
  value,
  field,
  playerId,
  table,
  type = "number",
  min,
  max,
  editMode,
  onSave,
  color,
  className = "",
}: {
  value: number | string | null;
  field: string;
  playerId: number;
  table: string;
  type?: "number" | "text";
  min?: number;
  max?: number;
  editMode: boolean;
  onSave: (playerId: number, table: string, field: string, value: unknown) => void;
  color?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (!editMode) {
    return (
      <span className={className} style={{ color: color }}>
        {value ?? "–"}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const newVal = type === "number"
            ? (draft === "" ? null : parseInt(draft))
            : (draft === "" ? null : draft);
          if (newVal !== value) {
            onSave(playerId, table, field, newVal);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(String(value ?? "")); setEditing(false); }
        }}
        className="w-full bg-[var(--bg-elevated)] border border-[var(--color-accent-tactical)]/50 rounded px-1 py-0.5 text-center text-xs font-mono text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent-tactical)]/50"
        style={{ maxWidth: type === "number" ? "3rem" : "6rem" }}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:ring-1 hover:ring-[var(--color-accent-tactical)]/40 rounded px-0.5 ${className}`}
      style={{ color: color }}
      onClick={() => setEditing(true)}
    >
      {value ?? "–"}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [players, setPlayers] = useState<NetworkPlayer[]>([]);
  const [leagues, setLeagues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leagueFilter, setLeagueFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [saveQueue, setSaveQueue] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [expandedAttrs, setExpandedAttrs] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<NetworkPlayer | null>(null);
  const [modalTab, setModalTab] = useState("basic");

  // Check admin auth from sessionStorage (set on /admin page)
  useEffect(() => {
    const stored = sessionStorage.getItem("network_admin");
    if (stored === "1") {
      setAdminAuth(true);
      setEditMode(true);
    }
  }, []);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (leagueFilter) params.set("league", leagueFilter);
    if (clubFilter) params.set("club", clubFilter);
    params.set("limit", "100");

    try {
      const res = await fetch(`/api/network?${params}`);
      if (!res.ok) {
        const body = await res.text();
        let msg = `API error (${res.status})`;
        try { msg = JSON.parse(body).error ?? msg; } catch { /* not JSON */ }
        console.error("[network]", msg);
        setError(msg);
        setPlayers([]);
        return;
      }
      const data = await res.json();
      setError(null);
      setPlayers(data.players ?? []);
      setLeagues(data.leagues ?? []);
    } catch (err) {
      console.error("[network] fetch failed:", err);
      setError("Failed to load players");
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [leagueFilter, clubFilter]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // ── Save handler ────────────────────────────────────────────────────

  const handleSave = useCallback(async (
    playerId: number,
    table: string,
    field: string,
    value: unknown
  ) => {
    const key = `${playerId}:${field}`;
    setSaveQueue((q) => [...q, key]);

    try {
      if (table === "attribute_grades") {
        // Special handling for attribute grades
        const res = await fetch("/api/network/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: playerId, attribute: field, scout_grade: value }),
        });
        if (!res.ok) throw new Error("Failed to save grade");
      } else {
        const res = await fetch("/api/admin/player-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person_id: playerId, table, updates: { [field]: value } }),
        });
        if (!res.ok) throw new Error("Failed to save");
      }

      // Update local state
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId) return p;
          if (table === "attribute_grades") {
            return { ...p, grades: { ...p.grades, [field]: value as number } };
          }
          if (table === "player_profiles") {
            const profile = unwrap(p.player_profiles) ?? {} as Profile;
            return { ...p, player_profiles: { ...profile, [field]: value } };
          }
          if (table === "player_status") {
            const status = unwrap(p.player_status) ?? {} as Status;
            return { ...p, player_status: { ...status, [field]: value } };
          }
          return p;
        })
      );
      setSavedCount((c) => c + 1);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaveQueue((q) => q.filter((k) => k !== key));
    }
  }, []);

  // ── Unique clubs for current league ─────────────────────────────────

  const clubs = [...new Set(players.map((p) => p.clubs?.clubname).filter(Boolean))].sort();

  return (
    <div className="space-y-3 -mx-2 sm:mx-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Network</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {players.length > 0
              ? `${players.length} players${leagueFilter ? ` · ${leagueFilter}` : ""}${clubFilter ? ` · ${clubFilter}` : ""}`
              : "Scouting network feedback & batch editing"}
            {savedCount > 0 && (
              <span className="ml-2 text-[var(--color-accent-tactical)]">
                {savedCount} saved
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {adminAuth && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`text-[10px] font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full transition-colors ${
                editMode
                  ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] ring-1 ring-[var(--color-accent-tactical)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
              }`}
            >
              {editMode ? "Editing" : "View Only"}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
            League
          </label>
          <select
            value={leagueFilter}
            onChange={(e) => { setLeagueFilter(e.target.value); setClubFilter(""); }}
            className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent-tactical)]/50"
          >
            <option value="">All Leagues</option>
            {leagues.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        {clubs.length > 1 && (
          <div className="space-y-1">
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
              Club
            </label>
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent-tactical)]/50"
            >
              <option value="">All Clubs</option>
              {clubs.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={() => setExpandedAttrs(!expandedAttrs)}
          className={`text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1.5 rounded-full transition-colors ${
            expandedAttrs
              ? "bg-[var(--color-accent-technical)]/20 text-[var(--color-accent-technical)] ring-1 ring-[var(--color-accent-technical)]/30"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {expandedAttrs ? "Hide Attributes" : "Show Attributes"}
        </button>
        {saveQueue.length > 0 && (
          <span className="text-[10px] text-[var(--color-accent-tactical)] animate-pulse ml-auto">
            Saving {saveQueue.length}...
          </span>
        )}
      </div>

      {/* Player Table */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading...</p>
      ) : error ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--color-pursuit-priority)]">{error}</p>
          <button
            onClick={() => { setError(null); fetchPlayers(); }}
            className="mt-3 text-xs px-3 py-1.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : players.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No players found.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Select a league or club to view players.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left px-3 py-2 text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)] sticky left-0 bg-[var(--bg-surface-solid)] z-10">
                    Player
                  </th>
                  <th className="px-2 py-2 text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Pos</th>
                  <th className="px-2 py-2 text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Age</th>
                  <th className="px-2 py-2 text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Club</th>
                  <th className="px-2 py-2 text-[9px] font-semibold tracking-wider uppercase text-[var(--color-accent-tactical)]">Lvl</th>
                  <th className="px-2 py-2 text-[9px] font-semibold tracking-wider uppercase text-[var(--color-accent-tactical)]">Ovr</th>
                  <th className="px-2 py-2 text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Archetype</th>
                  <th className="px-2 py-2 text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Pursuit</th>
                  {expandedAttrs && Object.entries(ATTR_CATEGORIES).map(([cat, attrs]) =>
                    attrs.map((attr) => (
                      <th
                        key={attr}
                        className="px-1 py-2 text-[8px] font-semibold tracking-wider uppercase whitespace-nowrap"
                        style={{ color: CATEGORY_COLORS[cat] }}
                        title={attr}
                      >
                        {attr.slice(0, 3)}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const profile = unwrap(player.player_profiles);
                  const status = unwrap(player.player_status);

                  return (
                    <tr
                      key={player.id}
                      className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-elevated)]/30 transition-colors"
                    >
                      {/* Player Name (sticky) */}
                      <td className="px-3 py-2 sticky left-0 bg-[var(--bg-surface-solid)] z-10">
                        <button
                          onClick={() => { setSelectedPlayer(player); setModalTab("basic"); }}
                          className="font-medium text-[var(--text-primary)] hover:underline whitespace-nowrap text-left"
                        >
                          {player.name}
                        </button>
                        {!profile?.level && (
                          <span className="ml-1 text-[8px] text-[var(--color-pursuit-priority)] opacity-70">●</span>
                        )}
                      </td>

                      {/* Position */}
                      <td className="px-2 py-2 text-center font-mono text-[10px] text-[var(--text-secondary)]">
                        {profile?.position ?? "–"}
                      </td>

                      {/* Age */}
                      <td className="px-2 py-2 text-center font-mono text-[10px] text-[var(--text-secondary)]">
                        {age(player.date_of_birth)}
                      </td>

                      {/* Club */}
                      <td className="px-2 py-2 text-[10px] text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate">
                        {player.clubs?.clubname ?? "–"}
                      </td>

                      {/* Level */}
                      <td className="px-2 py-2 text-center font-mono font-bold">
                        <EditableCell
                          value={profile?.level ?? null}
                          field="level"
                          playerId={player.id}
                          table="player_profiles"
                          min={1}
                          max={99}
                          editMode={editMode}
                          onSave={handleSave}
                          color={levelColor(profile?.level ?? null)}
                        />
                      </td>

                      {/* Overall */}
                      <td className="px-2 py-2 text-center font-mono font-bold">
                        <EditableCell
                          value={profile?.overall ?? null}
                          field="overall"
                          playerId={player.id}
                          table="player_profiles"
                          min={1}
                          max={99}
                          editMode={editMode}
                          onSave={handleSave}
                          color={levelColor(profile?.overall ?? null)}
                        />
                      </td>

                      {/* Archetype */}
                      <td className="px-2 py-2 text-[10px] text-[var(--color-accent-personality)] whitespace-nowrap">
                        <EditableCell
                          value={profile?.archetype ?? null}
                          field="archetype"
                          playerId={player.id}
                          table="player_profiles"
                          type="text"
                          editMode={editMode}
                          onSave={handleSave}
                          color="var(--color-accent-personality)"
                        />
                      </td>

                      {/* Pursuit Status */}
                      <td className="px-2 py-2 text-center">
                        <span
                          className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded"
                          style={{
                            color: PURSUIT_COLORS[status?.pursuit_status ?? ""] ?? "var(--text-muted)",
                            backgroundColor: `color-mix(in srgb, ${PURSUIT_COLORS[status?.pursuit_status ?? ""] ?? "var(--text-muted)"} 15%, transparent)`,
                          }}
                        >
                          {status?.pursuit_status ?? "–"}
                        </span>
                      </td>

                      {/* Attribute Grades */}
                      {expandedAttrs && CORE_ATTRIBUTES.map((attr) => (
                        <td key={attr} className="px-1 py-2 text-center font-mono text-[10px]">
                          <EditableCell
                            value={player.grades[attr] ?? null}
                            field={attr}
                            playerId={player.id}
                            table="attribute_grades"
                            min={1}
                            max={20}
                            editMode={editMode}
                            onSave={handleSave}
                            color={player.grades[attr] ? gradeColor(player.grades[attr]) : "var(--text-muted)"}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Player Detail Modal ──────────────────────────────────────── */}
      {selectedPlayer && (() => {
        const p = selectedPlayer;
        const profile = unwrap(p.player_profiles);
        const status = unwrap(p.player_status);
        const market = unwrap(p.player_market);

        return (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-8 pb-8 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedPlayer(null); }}
          >
            <div className="glass rounded-xl w-full max-w-2xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">{p.name}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {profile?.position ?? "?"} · {age(p.date_of_birth)} · {p.clubs?.clubname ?? "Free Agent"}
                    {p.clubs?.league_name && <span className="text-[var(--text-muted)]"> · {p.clubs.league_name}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/players/${p.id}`}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    Full Profile
                  </Link>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 4l10 10M14 4L4 14" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--border-subtle)] px-5">
                {MODAL_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setModalTab(tab.key)}
                    className={`px-3 py-2.5 text-xs font-semibold tracking-wide transition-colors border-b-2 -mb-px ${
                      modalTab === tab.key
                        ? "text-[var(--color-accent-tactical)] border-[var(--color-accent-tactical)]"
                        : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-5 max-h-[60vh] overflow-y-auto">

                {/* ── Basic Info ────────────────────────────────── */}
                {modalTab === "basic" && (
                  <div className="grid grid-cols-2 gap-4">
                    <ModalField label="Position" value={profile?.position} field="position" table="player_profiles" playerId={p.id} editMode={editMode} onSave={handleSave} options={POSITIONS} />
                    <ModalField label="Level" value={profile?.level} field="level" table="player_profiles" playerId={p.id} editMode={editMode} onSave={handleSave} type="number" min={1} max={99} />
                    <ModalField label="Overall" value={profile?.overall} field="overall" table="player_profiles" playerId={p.id} editMode={editMode} onSave={handleSave} type="number" min={1} max={99} />
                    <ModalField label="Peak" value={profile?.peak} field="peak" table="player_profiles" playerId={p.id} editMode={editMode} onSave={handleSave} type="number" min={1} max={99} />
                    <ModalField label="Archetype" value={profile?.archetype} field="archetype" table="player_profiles" playerId={p.id} editMode={editMode} onSave={handleSave} />
                    <ModalField label="Blueprint" value={profile?.blueprint} field="blueprint" table="player_profiles" playerId={p.id} editMode={editMode} onSave={handleSave} />
                    <ModalField label="Preferred Foot" value={p.preferred_foot} field="preferred_foot" table="people" playerId={p.id} editMode={editMode} onSave={handleSave} options={["Right", "Left", "Both"]} />
                    <ModalField label="Height (cm)" value={p.height_cm} field="height_cm" table="people" playerId={p.id} editMode={editMode} onSave={handleSave} type="number" min={140} max={220} />
                    <ModalField label="Date of Birth" value={p.date_of_birth} field="date_of_birth" table="people" playerId={p.id} editMode={editMode} onSave={handleSave} />
                  </div>
                )}

                {/* ── Attributes ────────────────────────────────── */}
                {modalTab === "attributes" && (
                  <div className="space-y-5">
                    {Object.entries(ATTR_CATEGORIES).map(([cat, attrs]) => (
                      <div key={cat}>
                        <h3
                          className="text-[10px] font-semibold tracking-wider uppercase mb-2"
                          style={{ color: CATEGORY_COLORS[cat] }}
                        >
                          {cat}
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                          {attrs.map((attr) => (
                            <div key={attr} className="flex items-center justify-between bg-[var(--bg-elevated)]/50 rounded px-2.5 py-1.5">
                              <span className="text-xs text-[var(--text-secondary)] capitalize">
                                {attr.replace(/_/g, " ")}
                              </span>
                              <EditableCell
                                value={p.grades[attr] ?? null}
                                field={attr}
                                playerId={p.id}
                                table="attribute_grades"
                                min={1}
                                max={20}
                                editMode={editMode}
                                onSave={handleSave}
                                color={p.grades[attr] ? gradeColor(p.grades[attr]) : "var(--text-muted)"}
                                className="font-mono font-bold text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Availability ──────────────────────────────── */}
                {modalTab === "availability" && (
                  <div className="grid grid-cols-2 gap-4">
                    <ModalField label="Pursuit Status" value={status?.pursuit_status} field="pursuit_status" table="player_status" playerId={p.id} editMode={editMode} onSave={handleSave} options={PURSUIT_STATUSES} />
                    <ModalField label="Squad Role" value={status?.squad_role} field="squad_role" table="player_status" playerId={p.id} editMode={editMode} onSave={handleSave} options={SQUAD_ROLES} />
                    <ModalField label="Market Value Tier" value={market?.market_value_tier} field="market_value_tier" table="player_market" playerId={p.id} editMode={editMode} onSave={handleSave} />
                    <ModalField label="True MVT" value={market?.true_mvt} field="true_mvt" table="player_market" playerId={p.id} editMode={editMode} onSave={handleSave} />
                    <ModalField label="Scarcity Score" value={market?.scarcity_score} field="scarcity_score" table="player_market" playerId={p.id} editMode={editMode} onSave={handleSave} type="number" min={1} max={20} />
                  </div>
                )}

                {/* ── History & Bio ─────────────────────────────── */}
                {modalTab === "bio" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)] mb-1 block">
                        Scouting Notes
                      </label>
                      {editMode ? (
                        <EditableTextarea
                          value={status?.scouting_notes ?? ""}
                          field="scouting_notes"
                          playerId={p.id}
                          table="player_status"
                          onSave={handleSave}
                        />
                      ) : (
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap bg-[var(--bg-elevated)]/50 rounded-lg p-3 min-h-[80px]">
                          {status?.scouting_notes || <span className="text-[var(--text-muted)] italic">No scouting notes</span>}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Club</span>
                        <p className="text-sm text-[var(--text-primary)] mt-0.5">{p.clubs?.clubname ?? "–"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">League</span>
                        <p className="text-sm text-[var(--text-primary)] mt-0.5">{p.clubs?.league_name ?? "–"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Admin Panel ───────────────────────────────── */}
                {modalTab === "admin" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Player ID</span>
                        <p className="text-sm font-mono text-[var(--text-primary)] mt-0.5">{p.id}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Attributes</span>
                        <p className="text-sm font-mono text-[var(--text-primary)] mt-0.5">{Object.keys(p.grades).length} grades</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-[var(--border-subtle)]">
                      <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">Raw Grades</span>
                      <div className="mt-2 bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto">
                        <pre className="text-[10px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap">
                          {JSON.stringify(p.grades, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Link
                        href={`/players/${p.id}`}
                        className="text-xs px-3 py-1.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        View Full Profile
                      </Link>
                      <Link
                        href={`/editor/${p.id}`}
                        className="text-xs px-3 py-1.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Open in Editor
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Modal Field Component ──────────────────────────────────────────────

function ModalField({
  label,
  value,
  field,
  table,
  playerId,
  editMode,
  onSave,
  type = "text",
  options,
  min,
  max,
}: {
  label: string;
  value: string | number | null | undefined;
  field: string;
  table: string;
  playerId: number;
  editMode: boolean;
  onSave: (playerId: number, table: string, field: string, value: unknown) => void;
  type?: "text" | "number";
  options?: string[];
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  const commit = () => {
    const newVal = type === "number"
      ? (draft === "" ? null : parseInt(draft))
      : (draft === "" ? null : draft);
    if (newVal !== value) {
      onSave(playerId, table, field, newVal);
    }
  };

  return (
    <div>
      <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)] mb-1 block">
        {label}
      </label>
      {!editMode ? (
        <p className="text-sm text-[var(--text-primary)]">{value ?? <span className="text-[var(--text-muted)]">–</span>}</p>
      ) : options ? (
        <select
          value={draft}
          onChange={(e) => { setDraft(e.target.value); }}
          onBlur={commit}
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent-tactical)]/50"
        >
          <option value="">–</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={draft}
          min={min}
          max={max}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent-tactical)]/50"
        />
      )}
    </div>
  );
}

// ── Editable Textarea ──────────────────────────────────────────────────

function EditableTextarea({
  value,
  field,
  playerId,
  table,
  onSave,
}: {
  value: string;
  field: string;
  playerId: number;
  table: string;
  onSave: (playerId: number, table: string, field: string, value: unknown) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(playerId, table, field, draft || null);
      }}
      rows={5}
      className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent-tactical)]/50 resize-y"
      placeholder="Write scouting notes..."
    />
  );
}
