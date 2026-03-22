"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface PoolPlayer {
  person_id: number;
  name: string;
  position: string | null;
  level: number | null;
  overall_pillar_score: number | null;
  archetype: string | null;
  personality_type: string | null;
  age: number | null;
  club: string | null;
  best_role: string | null;
  best_role_score: number | null;
  pool_category: string;
}

interface NationData {
  nation_id: number;
  slug: string;
  total: number;
  players: PoolPlayer[];
}

interface IdealData {
  nation_id: number;
  formation: string;
  starting_xi?: { person_id: number; name: string; position: string; role: string; role_score: number; pool_category: string }[];
  bench?: { person_id: number; name: string; position: string; pool_category: string; overall: number }[];
  squad?: { person_id: number; name: string; position: string; role?: string; role_score?: number; pool_category?: string; is_starter?: boolean }[];
  strength: number;
}

type Step = "pick-squad" | "pick-xi" | "reveal";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const POOL_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "established", label: "Established" },
  { key: "rising_star", label: "Rising Stars" },
  { key: "form_pick", label: "Form" },
  { key: "uncapped", label: "Uncapped" },
  { key: "recall", label: "Recalls" },
];

const CATEGORY_COLORS: Record<string, string> = {
  established: "#fcd34d",
  rising_star: "#22d3ee",
  form_pick: "#4ade80",
  uncapped: "#71717a",
  recall: "#f59e0b",
};

const FORMATIONS = ["4-3-3", "4-2-3-1", "3-5-2", "4-4-2", "3-4-3", "4-1-2-1-2"];

// Position group for squad balance
function posGroup(pos: string): string {
  if (pos === "GK") return "GK";
  if (["WD", "CD"].includes(pos)) return "DEF";
  if (["DM", "CM", "WM", "AM"].includes(pos)) return "MID";
  return "FWD";
}

// Formation slot definitions (simplified — position + count)
const FORMATION_SLOTS: Record<string, string[]> = {
  "4-3-3": ["GK", "WD", "CD", "CD", "WD", "CM", "CM", "CM", "WF", "CF", "WF"],
  "4-2-3-1": ["GK", "WD", "CD", "CD", "WD", "DM", "DM", "WF", "AM", "WF", "CF"],
  "3-5-2": ["GK", "CD", "CD", "CD", "WM", "CM", "CM", "WM", "AM", "CF", "CF"],
  "4-4-2": ["GK", "WD", "CD", "CD", "WD", "WM", "CM", "CM", "WM", "CF", "CF"],
  "3-4-3": ["GK", "CD", "CD", "CD", "WM", "CM", "CM", "WM", "WF", "CF", "WF"],
  "4-1-2-1-2": ["GK", "WD", "CD", "CD", "WD", "DM", "CM", "CM", "AM", "CF", "CF"],
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function SquadBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.nationSlug as string;

  const [step, setStep] = useState<Step>("pick-squad");
  const [nationData, setNationData] = useState<NationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Squad state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [formation, setFormation] = useState("4-3-3");
  const [xiIds, setXiIds] = useState<Set<number>>(new Set());

  // Filters
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"level" | "age" | "name">("level");

  // Reveal state
  const [idealData, setIdealData] = useState<IdealData | null>(null);
  const [comparison, setComparison] = useState<{
    squad_matches: number;
    xi_matches: number;
    formation_match: boolean;
    score: number;
    tier: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch nation data ────────────────────────────────────────────────────

  useEffect(() => {
    // First resolve slug to nation_id via nations list
    fetch("/api/on-the-plane/nations")
      .then((r) => r.json())
      .then((nations) => {
        const nation = (nations as { nation_id: number; slug: string }[]).find(
          (n) => n.slug === slug
        );
        if (!nation) {
          setError("Nation not found");
          setLoading(false);
          return;
        }
        return fetch(`/api/on-the-plane/nations/${nation.nation_id}/players`);
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data?.players) {
          setNationData(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load player data");
        setLoading(false);
      });
  }, [slug]);

  // ── Filtered + sorted players ────────────────────────────────────────────

  const filteredPlayers = useMemo(() => {
    if (!nationData) return [];
    return nationData.players
      .filter((p) => {
        if (posFilter && p.position !== posFilter) return false;
        if (catFilter !== "all" && p.pool_category !== catFilter) return false;
        if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "level") return (b.level ?? 0) - (a.level ?? 0);
        if (sortBy === "age") return (a.age ?? 99) - (b.age ?? 99);
        return a.name.localeCompare(b.name);
      });
  }, [nationData, posFilter, catFilter, searchText, sortBy]);

  // ── Squad balance ────────────────────────────────────────────────────────

  const squadBalance = useMemo(() => {
    const counts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const id of selectedIds) {
      const p = nationData?.players.find((pp) => pp.person_id === id);
      if (p?.position) {
        const grp = posGroup(p.position);
        counts[grp]++;
      }
    }
    return counts;
  }, [selectedIds, nationData]);

  // ── Toggle player selection ──────────────────────────────────────────────

  const togglePlayer = useCallback(
    (id: number) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          // Also remove from XI if they were in it
          setXiIds((xi) => {
            const nxi = new Set(xi);
            nxi.delete(id);
            return nxi;
          });
        } else if (next.size < 26) {
          next.add(id);
        }
        return next;
      });
    },
    []
  );

  const toggleXI = useCallback(
    (id: number) => {
      setXiIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else if (next.size < 11) {
          next.add(id);
        }
        return next;
      });
    },
    []
  );

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!nationData) return;
    setSubmitting(true);

    const userId =
      typeof window !== "undefined"
        ? localStorage.getItem("fc_user_id") ?? crypto.randomUUID()
        : crypto.randomUUID();
    if (typeof window !== "undefined") {
      localStorage.setItem("fc_user_id", userId);
    }

    const squad = Array.from(selectedIds).map((id) => {
      const p = nationData.players.find((pp) => pp.person_id === id);
      return {
        person_id: id,
        position: p?.position ?? "CM",
        is_starter: xiIds.has(id),
      };
    });

    try {
      const res = await fetch("/api/on-the-plane/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          nation_id: nationData.nation_id,
          formation,
          squad,
          starting_xi: Array.from(xiIds),
        }),
      });

      const data = await res.json();
      if (data.comparison) {
        setComparison(data.comparison);
      }
      if (data.ideal) {
        setIdealData({
          nation_id: nationData.nation_id,
          formation: data.ideal.formation,
          squad: data.ideal.squad,
          strength: data.ideal.strength,
        });
      }
      setStep("reveal");
    } catch {
      setError("Failed to submit squad");
    } finally {
      setSubmitting(false);
    }
  }, [nationData, selectedIds, xiIds, formation]);

  // ── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-current border-t-transparent rounded-full mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading national pool...
          </p>
        </div>
      </div>
    );
  }

  if (error || !nationData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="text-center">
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
            {error ?? "No data available"}
          </p>
          <Link
            href="/on-the-plane"
            className="text-sm underline"
            style={{ color: "var(--color-accent-personality)" }}
          >
            Back to nations
          </Link>
        </div>
      </div>
    );
  }

  // ── Step 1: Pick Squad ───────────────────────────────────────────────────

  // ── Pitch layout helpers ──────────────────────────────────────────────────
  // Map selected players to formation slots by position affinity
  const selectedPlayers = useMemo(() => {
    if (!nationData) return [];
    return nationData.players.filter((p) => selectedIds.has(p.person_id));
  }, [nationData, selectedIds]);

  const pitchSlots = useMemo(() => {
    const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS["4-3-3"];
    const used = new Set<number>();
    return slots.map((slotPos, idx) => {
      // Find best unused selected player for this position
      const candidate = selectedPlayers
        .filter((p) => !used.has(p.person_id) && p.position === slotPos)
        .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
      if (candidate) {
        used.add(candidate.person_id);
        return { slot: slotPos, idx, player: candidate };
      }
      return { slot: slotPos, idx, player: null };
    });
  }, [selectedPlayers, formation]);

  const benchPlayers = useMemo(() => {
    const pitchIds = new Set(pitchSlots.filter((s) => s.player).map((s) => s.player!.person_id));
    return selectedPlayers.filter((p) => !pitchIds.has(p.person_id));
  }, [selectedPlayers, pitchSlots]);

  // Pitch row layout for common formations
  // Row sizes must sum to 11 and match FORMATION_SLOTS order
  const PITCH_ROWS: Record<string, number[]> = {
    "4-3-3":     [1, 4, 3, 3],           // GK | WD CD CD WD | CM CM CM | WF CF WF
    "4-2-3-1":   [1, 4, 2, 3, 1],        // GK | WD CD CD WD | DM DM | WF AM WF | CF
    "3-5-2":     [1, 3, 4, 1, 2],        // GK | CD CD CD | WM CM CM WM | AM | CF CF
    "4-4-2":     [1, 4, 4, 2],           // GK | WD CD CD WD | WM CM CM WM | CF CF
    "3-4-3":     [1, 3, 4, 3],           // GK | CD CD CD | WM CM CM WM | WF CF WF
    "4-1-2-1-2": [1, 4, 1, 2, 1, 2],    // GK | WD CD CD WD | DM | CM CM | AM | CF CF
  };

  const pitchRows = useMemo(() => {
    const rowSizes = PITCH_ROWS[formation] ?? [1, 4, 3, 3];
    const rows: typeof pitchSlots[] = [];
    let offset = 0;
    for (const size of rowSizes) {
      rows.push(pitchSlots.slice(offset, offset + size));
      offset += size;
    }
    return rows;
  }, [pitchSlots, formation]);

  if (step === "pick-squad") {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-4 py-3 border-b"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/on-the-plane" className="text-xs" style={{ color: "var(--text-muted)" }}>
              ← Nations
            </Link>
            <div className="text-center">
              <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                ✈️ Pick Your Squad
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {selectedIds.size}/26 selected
              </p>
            </div>
            <button
              onClick={() => selectedIds.size === 26 && setStep("pick-xi")}
              disabled={selectedIds.size !== 26}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "var(--color-accent-personality)", color: "var(--bg-base)" }}
            >
              Next →
            </button>
          </div>
          {/* Balance bar */}
          <div className="max-w-5xl mx-auto mt-2 flex gap-2 text-[10px]">
            {Object.entries(squadBalance).map(([grp, cnt]) => (
              <span key={grp} className="px-2 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: cnt > 0 ? "var(--text-secondary)" : "var(--text-muted)" }}>
                {grp} {cnt}
              </span>
            ))}
            {/* Formation selector inline */}
            <select
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
              className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer"
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
            >
              {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* ── Split: Pitch + Additions ── */}
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
          <div className="flex gap-3" style={{ minHeight: "260px" }}>
            {/* LEFT: Pitch + Bench */}
            <div className="w-1/2 flex flex-col gap-2">
              {/* Pitch */}
              <div
                className="rounded-lg p-2 flex flex-col justify-between relative"
                style={{
                  background: "linear-gradient(180deg, #0d3b1e 0%, #0a2e17 100%)",
                  border: "1px solid rgba(111,195,223,0.15)",
                  minHeight: "200px",
                }}
              >
                {/* Center circle decoration */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full border border-white/10" />
                </div>
                {/* Halfway line */}
                <div className="absolute left-0 right-0 top-1/2 border-t border-white/10" />

                {pitchRows.map((row, ri) => (
                  <div key={ri} className="flex justify-center gap-1 relative z-10" style={{ flex: 1, alignItems: "center" }}>
                    {row.map((s) => (
                      <div
                        key={s.idx}
                        className="flex flex-col items-center"
                        style={{ width: "48px" }}
                      >
                        {s.player ? (
                          <button
                            onClick={() => togglePlayer(s.player!.person_id)}
                            className="cursor-pointer text-center"
                            title={`Remove ${s.player.name}`}
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold mx-auto"
                              style={{ background: "var(--color-accent-personality)", color: "#000" }}
                            >
                              {s.player.position}
                            </div>
                            <div className="text-[7px] mt-0.5 truncate leading-tight" style={{ color: "#fff", maxWidth: "48px" }}>
                              {s.player.name.split(" ").pop()}
                            </div>
                          </button>
                        ) : (
                          <div className="text-center">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-mono mx-auto"
                              style={{ border: "1px dashed rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.3)" }}
                            >
                              {s.slot}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Bench */}
              {benchPlayers.length > 0 && (
                <div className="rounded-lg p-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                    Bench ({benchPlayers.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {benchPlayers.map((p) => (
                      <button
                        key={p.person_id}
                        onClick={() => togglePlayer(p.person_id)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] cursor-pointer"
                        style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                        title={`Remove ${p.name}`}
                      >
                        <span className="font-mono" style={{ color: "var(--text-muted)", fontSize: "8px" }}>{p.position}</span>
                        <span className="truncate" style={{ maxWidth: "60px" }}>{p.name.split(" ").pop()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Additions list */}
            <div className="w-1/2 rounded-lg overflow-hidden flex flex-col" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                Squad ({selectedIds.size}/26)
              </div>
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: "280px" }}>
                {selectedPlayers.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Tap players below to add
                  </div>
                ) : (
                  selectedPlayers
                    .sort((a, b) => {
                      const posOrder = POSITIONS.indexOf(a.position ?? "CM") - POSITIONS.indexOf(b.position ?? "CM");
                      return posOrder !== 0 ? posOrder : (b.level ?? 0) - (a.level ?? 0);
                    })
                    .map((p) => (
                      <button
                        key={p.person_id}
                        onClick={() => togglePlayer(p.person_id)}
                        className="w-full flex items-center gap-1.5 px-2 py-1 text-left cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
                        title={`Remove ${p.name}`}
                      >
                        <span
                          className={`text-[8px] font-mono px-1 py-0.5 rounded shrink-0 ${POSITION_COLORS[p.position ?? "CM"] ?? ""}`}
                          style={{ color: "white" }}
                        >
                          {p.position}
                        </span>
                        <span className="text-[11px] truncate flex-1" style={{ color: "var(--text-primary)" }}>
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
                          {p.level ?? "—"}
                        </span>
                        <span className="text-[9px] shrink-0" style={{ color: "var(--text-muted)" }}>✕</span>
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="max-w-5xl mx-auto px-4 pt-2 pb-2 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setPosFilter(null)} className="px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 cursor-pointer" style={{ background: !posFilter ? "rgba(232,197,71,0.15)" : "var(--bg-surface)", color: !posFilter ? "var(--color-accent-personality)" : "var(--text-muted)", border: `1px solid ${!posFilter ? "var(--color-accent-personality)" : "var(--border-subtle)"}` }}>All</button>
            {POSITIONS.map((pos) => (
              <button key={pos} onClick={() => setPosFilter(posFilter === pos ? null : pos)} className="px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 cursor-pointer" style={{ background: posFilter === pos ? "rgba(232,197,71,0.15)" : "var(--bg-surface)", color: posFilter === pos ? "var(--color-accent-personality)" : "var(--text-muted)", border: `1px solid ${posFilter === pos ? "var(--color-accent-personality)" : "var(--border-subtle)"}` }}>{pos}</button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {POOL_CATEGORIES.map((cat) => (
              <button key={cat.key} onClick={() => setCatFilter(cat.key)} className="px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 cursor-pointer" style={{ background: catFilter === cat.key ? `${CATEGORY_COLORS[cat.key] ?? "var(--color-accent-personality)"}20` : "var(--bg-surface)", color: catFilter === cat.key ? CATEGORY_COLORS[cat.key] ?? "var(--color-accent-personality)" : "var(--text-muted)", border: `1px solid ${catFilter === cat.key ? CATEGORY_COLORS[cat.key] ?? "var(--color-accent-personality)" : "var(--border-subtle)"}` }}>{cat.label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Search players..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "level" | "age" | "name")} className="px-2 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
              <option value="level">Level</option>
              <option value="age">Age</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* ── Player List (full width) ── */}
        <div className="max-w-5xl mx-auto px-4 pb-24">
          {filteredPlayers.map((p) => {
            const selected = selectedIds.has(p.person_id);
            return (
              <button
                key={p.person_id}
                onClick={() => togglePlayer(p.person_id)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg mb-1 transition-all text-left cursor-pointer"
                style={{
                  background: selected ? "var(--bg-elevated)" : "var(--bg-surface)",
                  border: `1px solid ${selected ? "var(--color-accent-personality)" : "var(--border-subtle)"}`,
                  opacity: !selected && selectedIds.size >= 26 ? 0.4 : 1,
                }}
              >
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: selected ? "var(--color-accent-personality)" : "var(--border-subtle)", background: selected ? "var(--color-accent-personality)" : "transparent" }}>
                  {selected && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--bg-base)" strokeWidth="2" strokeLinecap="round" /></svg>}
                </div>
                <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${POSITION_COLORS[p.position ?? "CM"] ?? ""}`} style={{ color: "white" }}>{p.position ?? "?"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    <span className="text-[8px] px-1 py-0.5 rounded shrink-0" style={{ background: `${CATEGORY_COLORS[p.pool_category] ?? "#71717a"}20`, color: CATEGORY_COLORS[p.pool_category] ?? "#71717a" }}>{p.pool_category.replace("_", " ")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
                    {p.club && <span className="truncate" style={{ maxWidth: "100px" }}>{p.club}</span>}
                    {p.age && <span>· {p.age}y</span>}
                  </div>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: (p.level ?? 0) >= 16 ? "var(--color-accent-technical)" : (p.level ?? 0) >= 12 ? "var(--color-accent-tactical)" : "var(--text-muted)" }}>{p.level ?? "—"}</span>
              </button>
            );
          })}
          {filteredPlayers.length === 0 && (
            <p className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>No players match filters</p>
          )}
        </div>
      </div>
    );
  }

  // ── Step 2: Pick Formation + Starting XI ─────────────────────────────────

  if (step === "pick-xi") {
    const squadPlayers = nationData.players.filter((p) => selectedIds.has(p.person_id));
    const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS["4-3-3"];

    return (
      <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-4 py-3 border-b"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setStep("pick-squad")}
              className="text-xs cursor-pointer"
              style={{ color: "var(--text-muted)" }}
            >
              ← Squad
            </button>
            <div className="text-center">
              <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                ✈️ Pick Your XI
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {xiIds.size}/11 starters
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={xiIds.size !== 11 || submitting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "var(--color-accent-personality)",
                color: "var(--bg-base)",
              }}
            >
              {submitting ? "..." : "Reveal →"}
            </button>
          </div>
        </div>

        {/* Formation picker */}
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {FORMATIONS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFormation(f);
                  setXiIds(new Set());
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-mono shrink-0 cursor-pointer"
                style={{
                  background: formation === f ? "var(--color-accent-personality)" : "var(--bg-surface)",
                  color: formation === f ? "var(--bg-base)" : "var(--text-secondary)",
                  border: `1px solid ${formation === f ? "var(--color-accent-personality)" : "var(--border-subtle)"}`,
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Formation slots needed */}
          <div className="flex gap-1.5 text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
            {Object.entries(
              slots.reduce<Record<string, number>>((acc, pos) => {
                acc[pos] = (acc[pos] ?? 0) + 1;
                return acc;
              }, {})
            ).map(([pos, cnt]) => (
              <span key={pos} className="px-1.5 py-0.5 rounded" style={{ background: "var(--bg-elevated)" }}>
                {pos} ×{cnt}
              </span>
            ))}
          </div>
        </div>

        {/* Squad list for XI selection */}
        <div className="max-w-5xl mx-auto px-4 pb-24">
          {squadPlayers
            .sort((a, b) => {
              // Sort: starters first, then by position order, then by level
              const aXI = xiIds.has(a.person_id) ? 0 : 1;
              const bXI = xiIds.has(b.person_id) ? 0 : 1;
              if (aXI !== bXI) return aXI - bXI;
              const posOrder = POSITIONS.indexOf(a.position ?? "CM") - POSITIONS.indexOf(b.position ?? "CM");
              if (posOrder !== 0) return posOrder;
              return (b.level ?? 0) - (a.level ?? 0);
            })
            .map((p) => {
              const inXI = xiIds.has(p.person_id);
              return (
                <button
                  key={p.person_id}
                  onClick={() => toggleXI(p.person_id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 transition-all text-left cursor-pointer"
                  style={{
                    background: inXI ? "var(--bg-elevated)" : "var(--bg-surface)",
                    border: `1px solid ${inXI ? "var(--color-accent-tactical)" : "var(--border-subtle)"}`,
                    opacity: !inXI && xiIds.size >= 11 ? 0.4 : 1,
                  }}
                >
                  {/* XI badge */}
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-[9px] font-bold"
                    style={{
                      borderColor: inXI ? "var(--color-accent-tactical)" : "var(--border-subtle)",
                      background: inXI ? "var(--color-accent-tactical)" : "transparent",
                      color: inXI ? "var(--bg-base)" : "var(--text-muted)",
                    }}
                  >
                    {inXI ? "XI" : ""}
                  </div>

                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position ?? "CM"] ?? ""}`}
                    style={{ color: "white" }}
                  >
                    {p.position ?? "?"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </span>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {p.club && <span>{p.club}</span>}
                      {p.age && <span>· {p.age}y</span>}
                      {p.best_role && <span>· {p.best_role}</span>}
                    </div>
                  </div>

                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {p.level ?? "—"}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    );
  }

  // ── Step 3: Reveal ───────────────────────────────────────────────────────

  const idealSquadPlayers = idealData?.squad ?? [
    ...(idealData?.starting_xi ?? []),
    ...(idealData?.bench ?? []),
  ];
  const idealXIIds = new Set(
    (idealData?.starting_xi ?? (idealData?.squad ?? []).filter((p) => p.role)).map((p) => p.person_id)
  );
  const userSelectedPlayers = nationData.players.filter((p) => selectedIds.has(p.person_id));

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div className="px-4 pt-8 pb-4 text-center max-w-3xl mx-auto">
        <div className="text-4xl mb-3">✈️</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          The Results Are In
        </h1>

        {comparison && (
          <>
            {/* Score */}
            <div
              className="text-5xl font-bold font-mono mb-1"
              style={{
                color:
                  comparison.score >= 75
                    ? "var(--color-accent-technical)"
                    : comparison.score >= 50
                      ? "var(--color-accent-tactical)"
                      : comparison.score >= 25
                        ? "var(--color-accent-mental)"
                        : "var(--color-accent-physical)",
              }}
            >
              {comparison.score}
            </div>
            <p
              className="text-lg font-semibold mb-4"
              style={{
                color:
                  comparison.score >= 75
                    ? "var(--color-accent-technical)"
                    : comparison.score >= 50
                      ? "var(--color-accent-tactical)"
                      : "var(--text-secondary)",
              }}
            >
              {comparison.tier}
            </p>

            {/* Breakdown */}
            <div className="flex justify-center gap-4 mb-6">
              <div
                className="px-4 py-3 rounded-xl text-center"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                  {comparison.squad_matches}/26
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Squad Matches
                </div>
              </div>
              <div
                className="px-4 py-3 rounded-xl text-center"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                  {comparison.xi_matches}/11
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  XI Matches
                </div>
              </div>
              <div
                className="px-4 py-3 rounded-xl text-center"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="text-xl font-bold font-mono" style={{ color: comparison.formation_match ? "var(--color-accent-tactical)" : "var(--text-muted)" }}>
                  {comparison.formation_match ? "✓" : "✗"}
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Formation
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Side by side comparison */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* User's Squad */}
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Your Squad ({formation})
            </h2>
            <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
              {selectedIds.size} players
            </p>
            <div className="space-y-1">
              {userSelectedPlayers
                .sort((a, b) => POSITIONS.indexOf(a.position ?? "CM") - POSITIONS.indexOf(b.position ?? "CM"))
                .map((p) => {
                  const inIdeal = idealSquadPlayers.some((ip) => ip.person_id === p.person_id);
                  return (
                    <div
                      key={p.person_id}
                      className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                      style={{
                        background: inIdeal ? "var(--color-accent-tactical)/10" : "transparent",
                      }}
                    >
                      <span
                        className={`text-[9px] font-mono px-1 py-0.5 rounded ${POSITION_COLORS[p.position ?? "CM"] ?? ""}`}
                        style={{ color: "white" }}
                      >
                        {p.position}
                      </span>
                      <span
                        className="flex-1 truncate"
                        style={{
                          color: xiIds.has(p.person_id) ? "var(--text-primary)" : "var(--text-secondary)",
                          fontWeight: xiIds.has(p.person_id) ? 600 : 400,
                        }}
                      >
                        {p.name}
                        {xiIds.has(p.person_id) && (
                          <span className="ml-1 text-[9px]" style={{ color: "var(--color-accent-tactical)" }}>
                            XI
                          </span>
                        )}
                      </span>
                      {inIdeal && (
                        <span className="text-[9px]" style={{ color: "var(--color-accent-tactical)" }}>
                          ✓
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Chief Scout's Squad */}
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-accent-technical)" }}>
              Chief Scout&apos;s Squad ({idealData?.formation ?? "—"})
            </h2>
            <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
              Strength: {idealData?.strength ?? "—"}
            </p>
            <div className="space-y-1">
              {idealSquadPlayers.map((p) => {
                const inUser = selectedIds.has(p.person_id);
                const isStarter = idealXIIds.has(p.person_id);
                return (
                  <div
                    key={p.person_id}
                    className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                    style={{
                      background: inUser ? "var(--color-accent-tactical)/10" : "transparent",
                    }}
                  >
                    <span
                      className={`text-[9px] font-mono px-1 py-0.5 rounded ${POSITION_COLORS[p.position ?? "CM"] ?? ""}`}
                      style={{ color: "white" }}
                    >
                      {p.position}
                    </span>
                    <span
                      className="flex-1 truncate"
                      style={{
                        color: isStarter ? "var(--text-primary)" : "var(--text-secondary)",
                        fontWeight: isStarter ? 600 : 400,
                      }}
                    >
                      {p.name}
                      {isStarter && (
                        <span className="ml-1 text-[9px]" style={{ color: "var(--color-accent-technical)" }}>
                          XI
                        </span>
                      )}
                    </span>
                    {"role" in p && p.role && (
                      <span className="text-[9px] truncate max-w-20" style={{ color: "var(--text-muted)" }}>
                        {p.role}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3 mt-8">
          <Link
            href="/on-the-plane"
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Pick Another Nation
          </Link>
          <button
            onClick={() => {
              const text = `✈️ On The Plane — I scored ${comparison?.score ?? 0}/100 (${comparison?.tier ?? ""}) picking ${slug.replace(/-/g, " ")}'s World Cup squad! ${comparison?.squad_matches ?? 0}/26 squad matches, ${comparison?.xi_matches ?? 0}/11 XI matches.`;
              navigator.clipboard?.writeText(text);
            }}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer"
            style={{
              background: "var(--color-accent-personality)",
              color: "var(--bg-base)",
            }}
          >
            Copy Result
          </button>
        </div>
      </div>
    </div>
  );
}
