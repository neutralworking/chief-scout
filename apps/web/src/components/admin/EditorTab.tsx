"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { getArchetypeColor } from "@/lib/archetype-styles";

/* ── 52 canonical attributes, 4 pillars × 13 models ─────────────────────── */
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
      { name: "Powerhouse", attrs: ["aggression", "duels", "shielding", "throwing"] },
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
  aggression: "Aggr", duels: "Duels", shielding: "Shield", throwing: "Throw",
};

const POSITIONS = ["All", "GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const SQUAD_ROLES = ["", "Key Player", "Important Player", "Rotation", "Backup", "Youth", "Surplus"];

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
  scouting_notes?: string | null;
  pursuit_status?: string | null;
  personality_type?: string | null;
}

interface GradeData {
  scout_grade: number | null;
  stat_score: number | null;
  source: string | null;
}

/* ── Main component ───────────────────────────────────────────────────────── */
export function EditorTab() {
  const [players, setPlayers] = useState<QueuePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "needs_grades" | "partial">("all");
  const [posFilter, setPosFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [gradedIds, setGradedIds] = useState<Set<number>>(new Set());

  // Search via player-search API or load queue
  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.length >= 2) {
        // Name search mode
        setSearchMode(true);
        const params = new URLSearchParams({ q: searchQuery });
        if (posFilter !== "All") params.set("position", posFilter);
        const res = await fetch(`/api/admin/player-search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPlayers((data.players ?? []).map((p: Record<string, unknown>) => ({
            id: p.person_id,
            name: p.name,
            position: p.position,
            club: p.club,
            nation_code: p.nation ?? null,
            best_role: null,
            best_role_score: null,
            earned_archetype: null,
            archetype: p.archetype,
            level: p.level,
            age: null,
            scout_grades: 0,
            pipeline_grades: 0,
            total_coverage: 0,
            scouting_notes: p.scouting_notes,
            pursuit_status: p.pursuit_status,
            personality_type: p.personality_type,
          })));
        }
      } else {
        // Queue mode
        setSearchMode(false);
        const params = new URLSearchParams({ limit: "200", filter });
        if (posFilter !== "All") params.set("position", posFilter);
        const res = await fetch(`/api/admin/grading-queue?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.players ?? []);
        }
      }
    } catch { /* */ }
    setLoading(false);
  }, [filter, posFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => loadPlayers(), searchQuery.length >= 2 ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadPlayers]);

  const activePlayer = players.find((p) => p.id === activeId) ?? null;
  const gradedCount = players.filter((p) => gradedIds.has(p.id) || p.scout_grades > 0).length;

  function handleSaved(pid: number) {
    setGradedIds((prev) => new Set(prev).add(pid));
    // Auto-advance to next
    const idx = players.findIndex((p) => p.id === pid);
    const next = players[idx + 1];
    if (next) setActiveId(next.id);
  }

  return (
    <div className="space-y-3">
      {/* Search + filters toolbar */}
      <div className="space-y-2">
        {/* Search bar */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name... or browse queue below"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--color-accent-tactical)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1 flex-wrap items-center">
            {/* Position pills */}
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${
                  posFilter === pos
                    ? pos === "All"
                      ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--text-muted)]/30"
                      : `${POSITION_COLORS[pos] ?? "bg-zinc-700/60"} text-white`
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {pos}
              </button>
            ))}

            {/* Grading filters (only in queue mode) */}
            {!searchMode && (
              <>
                <span className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
                {(["needs_grades", "partial", "all"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${
                      filter === f
                        ? "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {f === "needs_grades" ? "Ungraded" : f === "partial" ? "Partial" : "All"}
                  </button>
                ))}
              </>
            )}
          </div>

          <p className="text-[10px] text-[var(--text-muted)]">
            {loading ? "Loading..." : `${players.length} players${!searchMode ? ` · ${gradedCount} graded` : ""}`}
          </p>
        </div>
      </div>

      {/* Split pane: player list + editor */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3">
        {/* Player list */}
        <div className="card rounded-xl overflow-hidden max-h-[calc(100vh-220px)] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-5 h-5 border-2 border-[var(--text-muted)] border-t-[var(--color-accent-tactical)] rounded-full animate-spin" />
            </div>
          ) : players.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              {searchQuery ? "No players found" : "No players in queue"}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-surface-solid)] z-10">
                <tr className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
                  <th className="text-left py-2 px-2.5 font-medium w-8">Pos</th>
                  <th className="text-left py-2 px-2.5 font-medium">Player</th>
                  <th className="text-right py-2 px-2.5 font-medium w-12">Score</th>
                  <th className="text-center py-2 px-2.5 font-medium w-16">Grades</th>
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
                      className={`border-b border-[var(--border-subtle)]/20 cursor-pointer transition-colors group ${
                        isActive
                          ? "bg-[var(--color-accent-tactical)]/10"
                          : "hover:bg-[var(--bg-elevated)]/40"
                      }`}
                    >
                      <td className="py-1.5 px-2.5">
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60"} text-white`}>
                          {p.position ?? "–"}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5">
                        <div className="text-[11px] font-medium text-[var(--text-primary)] truncate max-w-[180px] group-hover:text-[var(--color-accent-tactical)] transition-colors">
                          {p.name}
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] truncate flex items-center gap-1">
                          <span>{p.club ?? "—"}</span>
                          {p.archetype && (
                            <>
                              <span className="text-[var(--border-subtle)]">&middot;</span>
                              <span style={{ color: getArchetypeColor(p.archetype) }}>{p.archetype}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                          {p.best_role_score ?? p.level ?? "–"}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        {hasScout ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-green-400">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            {p.scout_grades}
                          </span>
                        ) : p.total_coverage > 0 ? (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">{p.total_coverage}</span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)]/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Editor panel */}
        {activePlayer ? (
          <EditorPanel player={activePlayer} onSaved={handleSaved} />
        ) : (
          <div className="card rounded-xl p-8 flex flex-col items-center justify-center gap-2">
            <svg className="w-8 h-8 text-[var(--text-muted)]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="text-sm text-[var(--text-muted)]">Select a player to edit</p>
            <p className="text-[10px] text-[var(--text-muted)]/60">Search by name or browse the queue</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Editor panel — grades + profile editing ─────────────────────────────── */
function EditorPanel({ player, onSaved }: { player: QueuePlayer; onSaved: (pid: number) => void }) {
  const [grades, setGrades] = useState<Record<string, GradeData>>({});
  const [dirty, setDirty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<"grades" | "profile">("grades");
  const containerRef = useRef<HTMLDivElement>(null);

  // Profile editing state
  const [profileDirty, setProfileDirty] = useState<Record<string, unknown>>({});
  const [profileData, setProfileData] = useState<Record<string, unknown>>({});

  // Load grades + profile when player changes
  useEffect(() => {
    setLoaded(false);
    setDirty({});
    setProfileDirty({});
    async function load() {
      try {
        const [gradesRes, profileRes] = await Promise.all([
          fetch(`/api/admin/attribute-grades?person_id=${player.id}`),
          fetch(`/api/admin/player-search?id=${player.id}`),
        ]);
        if (gradesRes.ok) {
          const data = await gradesRes.json();
          setGrades(data.grades ?? {});
        }
        if (profileRes.ok) {
          const data = await profileRes.json();
          const p = data.players?.[0] ?? {};
          setProfileData(p);
        }
      } catch { /* */ }
      setLoaded(true);
    }
    load();
    containerRef.current?.scrollTo(0, 0);
  }, [player.id]);

  const setGrade = useCallback((attr: string, value: number) => {
    setDirty((prev) => ({ ...prev, [attr]: value }));
  }, []);

  const setProfileField = useCallback((field: string, value: unknown) => {
    setProfileDirty((prev) => ({ ...prev, [field]: value }));
  }, []);

  const saveAll = useCallback(async () => {
    const gradeEntries = Object.entries(dirty);
    const profileEntries = Object.entries(profileDirty);
    if (gradeEntries.length === 0 && profileEntries.length === 0) {
      onSaved(player.id);
      return;
    }
    setSaving(true);
    try {
      const promises: Promise<Response>[] = [];

      // Save grades
      if (gradeEntries.length > 0) {
        promises.push(
          fetch("/api/admin/attribute-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              person_id: player.id,
              grades: gradeEntries.map(([attribute, scout_grade]) => ({ attribute, scout_grade })),
            }),
          })
        );
      }

      // Save profile fields
      if (profileEntries.length > 0) {
        // Split by table
        const profileFields = ["position", "archetype", "blueprint", "side", "level"];
        const statusFields = ["scouting_notes", "squad_role", "pursuit_status"];

        const profileUpdates: Record<string, unknown> = {};
        const statusUpdates: Record<string, unknown> = {};
        for (const [k, v] of profileEntries) {
          if (profileFields.includes(k)) profileUpdates[k] = v;
          else if (statusFields.includes(k)) statusUpdates[k] = v;
        }

        if (Object.keys(profileUpdates).length > 0) {
          promises.push(
            fetch("/api/admin/player-update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ person_id: player.id, table: "player_profiles", updates: profileUpdates }),
            })
          );
        }
        if (Object.keys(statusUpdates).length > 0) {
          promises.push(
            fetch("/api/admin/player-update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ person_id: player.id, table: "player_status", updates: statusUpdates }),
            })
          );
        }
      }

      const results = await Promise.all(promises);
      const allOk = results.every((r) => r.ok);

      if (allOk) {
        // Merge saved grades
        setGrades((prev) => {
          const next = { ...prev };
          for (const [attr, val] of gradeEntries) {
            next[attr] = { ...next[attr], scout_grade: val, source: "scout_assessment", stat_score: next[attr]?.stat_score ?? null };
          }
          return next;
        });
        setDirty({});
        setProfileDirty({});
        onSaved(player.id);
      }
    } catch { /* */ }
    setSaving(false);
  }, [player.id, dirty, profileDirty, onSaved]);

  // Keyboard shortcut: Ctrl+Enter to save & next
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        saveAll();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveAll]);

  const dirtyGradeCount = Object.keys(dirty).length;
  const dirtyProfileCount = Object.keys(profileDirty).length;
  const totalDirty = dirtyGradeCount + dirtyProfileCount;
  const scoutCount = ALL_ATTRS.filter((a) =>
    dirty[a] !== undefined || (grades[a]?.scout_grade ?? null) !== null
  ).length;

  return (
    <div ref={containerRef} className="card rounded-xl flex flex-col max-h-[calc(100vh-220px)]">
      {/* Sticky header */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-solid)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60"} text-white shrink-0`}>
              {player.position ?? "–"}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-[var(--text-primary)] truncate">{player.name}</span>
                <Link
                  href={`/players/${player.id}`}
                  className="text-[9px] text-[var(--text-muted)] hover:text-[var(--color-accent-tactical)] transition-colors shrink-0"
                  title="View profile"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">
                {player.club ?? "—"} · {player.nation_code ?? ""}{player.age ? ` · ${player.age}y` : ""}
                {player.best_role && <> · <span className="text-[var(--color-accent-tactical)]">{player.best_role}</span></>}
                {(player.earned_archetype || player.archetype) && <> · <span style={{ color: getArchetypeColor(player.earned_archetype ?? player.archetype) }}>{player.earned_archetype ?? player.archetype}</span></>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-[var(--text-muted)]">{scoutCount}/52</span>
            <button
              onClick={saveAll}
              disabled={saving}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                totalDirty > 0
                  ? "bg-[var(--color-accent-tactical)] text-white hover:opacity-90"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-secondary)]"
              } disabled:opacity-50`}
            >
              {saving ? "..." : totalDirty > 0 ? `Save ${totalDirty} & Next` : "Next →"}
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setActiveSection("grades")}
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              activeSection === "grades"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            Attributes {dirtyGradeCount > 0 && <span className="text-[var(--color-accent-tactical)] ml-1">{dirtyGradeCount}</span>}
          </button>
          <button
            onClick={() => setActiveSection("profile")}
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              activeSection === "profile"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            Profile {dirtyProfileCount > 0 && <span className="text-[var(--color-accent-tactical)] ml-1">{dirtyProfileCount}</span>}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3">
        {!loaded ? (
          <div className="py-8 text-center">
            <div className="inline-block w-5 h-5 border-2 border-[var(--text-muted)] border-t-[var(--color-accent-tactical)] rounded-full animate-spin" />
          </div>
        ) : activeSection === "grades" ? (
          <GradesSection grades={grades} dirty={dirty} setGrade={setGrade} />
        ) : (
          <ProfileSection player={player} profileData={profileData} profileDirty={profileDirty} setField={setProfileField} />
        )}
      </div>

      {/* Keyboard hint */}
      <div className="shrink-0 px-3 py-1 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/30">
        <p className="text-[9px] text-[var(--text-muted)]/60 text-center">
          {activeSection === "grades" ? "1-20 scale · Grey = pipeline stat" : "Edit profile fields"} · <kbd className="px-1 py-0.5 rounded bg-[var(--bg-elevated)] text-[8px]">⌘↵</kbd> Save & Next
        </p>
      </div>
    </div>
  );
}

/* ── Grades section ──────────────────────────────────────────────────────── */
function GradesSection({ grades, dirty, setGrade }: {
  grades: Record<string, GradeData>;
  dirty: Record<string, number>;
  setGrade: (attr: string, value: number) => void;
}) {
  return (
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
  );
}

/* ── Profile section ─────────────────────────────────────────────────────── */
function ProfileSection({ player, profileData, profileDirty, setField }: {
  player: QueuePlayer;
  profileData: Record<string, unknown>;
  profileDirty: Record<string, unknown>;
  setField: (field: string, value: unknown) => void;
}) {
  const get = (field: string) => profileDirty[field] !== undefined ? profileDirty[field] : (profileData[field] ?? "");

  const inputClass = "w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent-tactical)] transition-colors";
  const selectClass = inputClass + " cursor-pointer";
  const labelClass = "text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5 font-medium";

  return (
    <div className="space-y-4">
      {/* Position + Level */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Position</label>
          <select
            value={get("position") as string}
            onChange={(e) => setField("position", e.target.value || null)}
            className={selectClass}
          >
            <option value="">–</option>
            {POSITIONS.filter(p => p !== "All").map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Side</label>
          <select
            value={get("side") as string}
            onChange={(e) => setField("side", e.target.value || null)}
            className={selectClass}
          >
            <option value="">–</option>
            {["Left", "Right", "Central", "Both"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Level</label>
          <input
            type="number"
            min={1}
            max={99}
            value={get("level") as string}
            onChange={(e) => setField("level", e.target.value ? parseInt(e.target.value) : null)}
            className={inputClass + " font-mono text-center"}
          />
        </div>
      </div>

      {/* Archetype + Blueprint */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Archetype</label>
          <input
            type="text"
            value={get("archetype") as string}
            onChange={(e) => setField("archetype", e.target.value || null)}
            placeholder="e.g. Controller-Passer"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Blueprint</label>
          <input
            type="text"
            value={get("blueprint") as string}
            onChange={(e) => setField("blueprint", e.target.value || null)}
            placeholder="e.g. Iniesta"
            className={inputClass}
          />
        </div>
      </div>

      {/* Pursuit + Squad Role */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Pursuit Status</label>
          <select
            value={get("pursuit_status") as string}
            onChange={(e) => setField("pursuit_status", e.target.value || null)}
            className={selectClass}
          >
            <option value="">–</option>
            {["Pass", "Watch", "Monitor", "Scout Further", "Interested", "Priority"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Squad Role</label>
          <select
            value={get("squad_role") as string}
            onChange={(e) => setField("squad_role", e.target.value || null)}
            className={selectClass}
          >
            {SQUAD_ROLES.map((s) => <option key={s} value={s}>{s || "–"}</option>)}
          </select>
        </div>
      </div>

      {/* Scouting Notes */}
      <div>
        <label className={labelClass}>Scouting Notes</label>
        <textarea
          value={get("scouting_notes") as string}
          onChange={(e) => setField("scouting_notes", e.target.value || null)}
          placeholder="Write scouting assessment..."
          rows={4}
          className={inputClass + " resize-none"}
        />
      </div>

      {/* Full editor link */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <Link
          href={`/editor/${player.id}`}
          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--color-accent-tactical)] transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Full editor (tags, DoF assessment, personality)
        </Link>
      </div>
    </div>
  );
}

/* ── Compact attribute row — 1-20 slider ─────────────────────────────────── */
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
      <span className="text-[10px] text-[var(--text-muted)] w-16 shrink-0 truncate" title={attr}>
        {ATTR_LABELS[attr] ?? attr}
      </span>

      <span className="text-[9px] font-mono text-[var(--text-muted)]/40 w-5 text-right shrink-0" title={hasStat ? `Pipeline: ${grade.stat_score} (${grade.source})` : ""}>
        {hasStat ? grade.stat_score : ""}
      </span>

      <div className="flex-1 relative h-5 flex items-center min-w-[60px]">
        {hasStat && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-[var(--text-muted)]/20 rounded-full pointer-events-none z-[1]"
            style={{ left: `${statPct}%` }}
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
