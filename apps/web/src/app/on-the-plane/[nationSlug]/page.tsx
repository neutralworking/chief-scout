"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { UpgradeCTA } from "@/components/UpgradeCTA";
import {
  FORMATION_BLUEPRINTS,
  scorePlayerForRole,
} from "@/lib/formation-intelligence";

// ── Types ────────────────────────────────────────────────────────────────────

interface PoolPlayer {
  person_id: number;
  name: string;
  position: string | null;
  level: number | null;
  overall_pillar_score: number | null;
  archetype: string | null;
  personality_type: string | null;
  preferred_foot: string | null;
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

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Position group for squad balance
function posGroup(pos: string): string {
  if (pos === "GK") return "GK";
  if (["WD", "CD"].includes(pos)) return "DEF";
  if (["DM", "CM", "WM", "AM"].includes(pos)) return "MID";
  return "FWD";
}

// Balance counter color — early visual guidance
function balanceColor(grp: string, cnt: number, total: number): string {
  if (total < 5) return cnt > 0 ? "var(--text-secondary)" : "var(--text-muted)";
  if (grp === "GK" && cnt === 0) return "#ef4444";
  if (total > 15) {
    if (grp === "DEF" && cnt < 4) return "#f59e0b";
    if (grp === "MID" && cnt < 3) return "#f59e0b";
    if (grp === "FWD" && cnt < 2) return "#f59e0b";
  }
  return cnt > 0 ? "var(--text-secondary)" : "var(--text-muted)";
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

// ── Smart XI slot assignment using formation-intelligence scoring ────────────

interface XISlot {
  position: string;
  role: string;
  side?: "L" | "R";
  player: PoolPlayer | null;
  roleScore: number;
  idx: number;
}

function flattenBlueprintSlots(formationName: string): { position: string; role: string; side?: "L" | "R" }[] {
  const bp = FORMATION_BLUEPRINTS[formationName];
  if (!bp) return [];
  const slots: { position: string; role: string; side?: "L" | "R" }[] = [];
  for (const [pos, slotArr] of Object.entries(bp.slots)) {
    for (const slot of slotArr) {
      slots.push({ position: pos, role: slot.role, side: slot.side });
    }
  }
  return slots;
}

/**
 * Assign XI players to formation slots using scorePlayerForRole + side awareness.
 * Uses greedy best-fit: scores every player for every slot, then assigns highest first.
 * Respects preferred side — a right-footed WD won't get placed at LB.
 */
function assignXIToSlots(formationName: string, xiPlayers: PoolPlayer[]): XISlot[] {
  const blueprintSlots = flattenBlueprintSlots(formationName);
  if (blueprintSlots.length === 0) {
    // Fallback: use FORMATION_SLOTS without intelligence
    const simpleSlots = FORMATION_SLOTS[formationName] ?? FORMATION_SLOTS["4-3-3"];
    const used = new Set<number>();
    return simpleSlots.map((slotPos, idx) => {
      const candidate = xiPlayers
        .filter((p) => !used.has(p.person_id) && p.position === slotPos)
        .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
      if (candidate) {
        used.add(candidate.person_id);
        return { position: slotPos, role: slotPos, player: candidate, roleScore: candidate.level ?? 0, idx };
      }
      return { position: slotPos, role: slotPos, player: null, roleScore: 0, idx };
    });
  }

  // Score every player for every slot (role intelligence + side awareness)
  const scores: { slotIdx: number; player: PoolPlayer; score: number }[] = [];
  for (let si = 0; si < blueprintSlots.length; si++) {
    const slot = blueprintSlots[si];
    for (const p of xiPlayers) {
      const s = scorePlayerForRole(
        {
          level: p.level,
          archetype: p.archetype,
          personality_type: p.personality_type,
          position: p.position,
          preferred_foot: p.preferred_foot,
        },
        slot.role,
        slot.side
      );
      scores.push({ slotIdx: si, player: p, score: s });
    }
  }

  // Greedy assignment: sort by score descending, assign greedily
  scores.sort((a, b) => b.score - a.score);
  const usedSlots = new Set<number>();
  const usedPlayers = new Set<number>();
  const assignments = new Map<number, { player: PoolPlayer; score: number }>();

  for (const entry of scores) {
    if (usedSlots.has(entry.slotIdx) || usedPlayers.has(entry.player.person_id)) continue;
    assignments.set(entry.slotIdx, { player: entry.player, score: entry.score });
    usedSlots.add(entry.slotIdx);
    usedPlayers.add(entry.player.person_id);
    if (usedSlots.size === blueprintSlots.length || usedPlayers.size === xiPlayers.length) break;
  }

  return blueprintSlots.map((slot, idx) => {
    const assignment = assignments.get(idx);
    return {
      position: slot.position,
      role: slot.role,
      side: slot.side,
      player: assignment?.player ?? null,
      roleScore: assignment?.score ?? 0,
      idx,
    };
  });
}

// ── Step Progress Bar ────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string; shortLabel: string }[] = [
  { key: "pick-squad", label: "Squad", shortLabel: "Squad" },
  { key: "pick-xi", label: "Starting XI", shortLabel: "XI" },
  { key: "reveal", label: "Results", shortLabel: "Results" },
];

function StepBar({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-1 py-2 px-4"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && (
              <div className="w-8 h-px" style={{ background: done ? "var(--color-accent-personality)" : "var(--border-subtle)" }} />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: done ? "var(--color-accent-personality)" : active ? "var(--bg-elevated)" : "transparent",
                  border: `1.5px solid ${done || active ? "var(--color-accent-personality)" : "var(--border-subtle)"}`,
                  color: done ? "var(--bg-base)" : active ? "var(--color-accent-personality)" : "var(--text-muted)",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className="text-[10px] sm:hidden"
                style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}>
                {s.shortLabel}
              </span>
              <span className="text-[10px] hidden sm:inline"
                style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Score Count-Up Hook ─────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

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

  // UI state
  const [pitchOpen, setPitchOpen] = useState(false);

  // Filters
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"level" | "role_score" | "age" | "name">("role_score");

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
  const [copied, setCopied] = useState(false);
  const [formationMsg, setFormationMsg] = useState<string | null>(null);

  // ── Score animation (must be before early returns — hooks rule) ──────────
  const displayScore = useCountUp(comparison?.score ?? 0);

  // ── Back-nav warning ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (selectedIds.size > 0 && step !== "reveal") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [selectedIds.size, step]);

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
        if (sortBy === "role_score") return (b.best_role_score ?? 0) - (a.best_role_score ?? 0);
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

  // ── Squad balance warnings ────────────────────────────────────────────────
  const balanceWarnings = useMemo(() => {
    if (selectedIds.size < 10) return []; // Show warnings once picking is underway
    const warnings: string[] = [];
    if (squadBalance.GK === 0) warnings.push("No goalkeeper selected");
    if (squadBalance.GK > 3) warnings.push(`${squadBalance.GK} goalkeepers is excessive`);
    if (squadBalance.DEF < 4) warnings.push(`Only ${squadBalance.DEF} defenders — most squads take 7-9`);
    if (squadBalance.MID < 3) warnings.push(`Only ${squadBalance.MID} midfielders — most squads take 6-8`);
    if (squadBalance.FWD < 2) warnings.push(`Only ${squadBalance.FWD} forward(s) — most squads take 4-6`);
    if (squadBalance.FWD > 8) warnings.push(`${squadBalance.FWD} forwards is a lot`);
    return warnings;
  }, [selectedIds.size, squadBalance]);

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

  // ── Quick Pick ──────────────────────────────────────────────────────────

  const quickPick = useCallback(() => {
    if (!nationData) return;
    const targets: Record<string, number> = { GK: 3, DEF: 8, MID: 9, FWD: 6 };
    const counts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const picked = new Set<number>(selectedIds);

    // Count already-selected players by position group
    for (const id of picked) {
      const p = nationData.players.find((pp) => pp.person_id === id);
      const grp = posGroup(p?.position ?? "CM");
      counts[grp] = (counts[grp] ?? 0) + 1;
    }

    const sorted = [...nationData.players].sort(
      (a, b) => (b.best_role_score ?? b.level ?? 0) - (a.best_role_score ?? a.level ?? 0)
    );

    // First pass: fill each position group to target
    for (const p of sorted) {
      if (picked.size >= 26) break;
      if (picked.has(p.person_id)) continue;
      const grp = posGroup(p.position ?? "CM");
      if (counts[grp] < targets[grp]) {
        picked.add(p.person_id);
        counts[grp]++;
      }
    }

    // Second pass: fill remaining with best available
    for (const p of sorted) {
      if (picked.size >= 26) break;
      if (!picked.has(p.person_id)) {
        picked.add(p.person_id);
      }
    }

    setSelectedIds(picked);
    if (selectedIds.size === 0) setXiIds(new Set());
  }, [nationData, selectedIds]);

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

  // ── Pitch layout helpers ──────────────────────────────────────────────────
  // These hooks MUST be above the early returns to satisfy React's rules of hooks.
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

  if (step === "pick-squad") {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
        {/* Header */}
        <div className="sticky top-0 z-10" style={{ background: "var(--bg-surface)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <Link href="/on-the-plane" className="text-xs" style={{ color: "var(--text-muted)" }}>
                ← Nations
              </Link>
              <div className="text-center">
                <h1
                  className="text-sm font-bold uppercase tracking-[1px]"
                  style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                >
                  Pick Your Squad
                </h1>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {selectedIds.size}/26
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size < 26 && (
                  <button
                    onClick={quickPick}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{
                      background: "transparent",
                      color: "var(--color-accent-personality)",
                      border: "1px solid var(--color-accent-personality)",
                    }}
                  >
                    {selectedIds.size === 0 ? "Quick Pick" : "Fill Remaining"}
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => { setSelectedIds(new Set()); setXiIds(new Set()); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{
                      background: "transparent",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => selectedIds.size === 26 && setStep("pick-xi")}
                  disabled={selectedIds.size !== 26}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "var(--color-accent-personality)", color: "var(--bg-base)" }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
          <StepBar current={step} />
          {/* Info bar — always visible */}
          <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Formation</span>
                <select
                  value={formation}
                  onChange={(e) => setFormation(e.target.value)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer"
                  style={{ background: "var(--bg-elevated)", color: "var(--color-accent-personality)", border: "1px solid var(--border-subtle)" }}
                >
                  {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                {Object.entries(squadBalance).map(([grp, cnt]) => (
                  <span key={grp} className="text-[10px] font-mono" style={{ color: balanceColor(grp, cnt, selectedIds.size) }}>
                    {grp} {cnt}
                  </span>
                ))}
                <button onClick={() => setPitchOpen(!pitchOpen)} className="cursor-pointer" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                  {pitchOpen ? "▲" : "▼"}
                </button>
              </div>
            </div>
            {balanceWarnings.length > 0 && (
              <div className="max-w-5xl mx-auto mt-1.5 px-3 py-1 rounded text-[10px]" style={{ background: "rgba(217,63,11,0.1)", color: "#ef4444" }}>
                ⚠ {balanceWarnings[0]}
              </div>
            )}
          </div>
        </div>

        {/* Collapsible pitch */}
        {pitchOpen && (
          <div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
            <div className="animate-slideUp">
              {/* Full-width pitch */}
              <div
                className="rounded-lg p-3 flex flex-col justify-between relative"
                style={{
                  background: "linear-gradient(180deg, #0d3b1e 0%, #0a2e17 100%)",
                  border: "1px solid rgba(111,195,223,0.15)",
                  minHeight: "280px",
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 rounded-full border border-white/10" />
                </div>
                <div className="absolute left-0 right-0 top-1/2 border-t border-white/10" />

                {pitchRows.map((row, ri) => (
                  <div key={ri} className="flex justify-center gap-2 relative z-10" style={{ flex: 1, alignItems: "center" }}>
                    {row.map((s) => (
                      <div key={s.idx} className="flex flex-col items-center" style={{ width: "56px" }}>
                        {s.player ? (
                          <button
                            onClick={() => togglePlayer(s.player!.person_id)}
                            className="cursor-pointer text-center"
                            title={`Remove ${s.player.name}`}
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold mx-auto"
                              style={{ background: "var(--color-accent-personality)", color: "#000" }}
                            >
                              {s.player.position}
                            </div>
                            <div className="text-[8px] mt-0.5 truncate leading-tight" style={{ color: "#fff", maxWidth: "56px" }}>
                              {s.player.name.split(" ").pop()}
                            </div>
                          </button>
                        ) : (
                          <div className="text-center">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-mono mx-auto"
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

              {/* Bench under pitch */}
              {benchPlayers.length > 0 && (
                <div className="mt-2 rounded-lg p-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
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
          </div>
        )}

        {/* ── Filters ── */}
        <div className="max-w-5xl mx-auto px-4 pt-2 pb-2 space-y-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setPosFilter(null)} className="px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 cursor-pointer" style={{ background: !posFilter ? "rgba(232,197,71,0.15)" : "var(--bg-surface)", color: !posFilter ? "var(--color-accent-personality)" : "var(--text-muted)", border: `1px solid ${!posFilter ? "var(--color-accent-personality)" : "var(--border-subtle)"}` }}>All</button>
            {POSITIONS.map((pos) => (
              <button key={pos} onClick={() => setPosFilter(posFilter === pos ? null : pos)} className="px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 cursor-pointer" style={{ background: posFilter === pos ? "rgba(232,197,71,0.15)" : "var(--bg-surface)", color: posFilter === pos ? "var(--color-accent-personality)" : "var(--text-muted)", border: `1px solid ${posFilter === pos ? "var(--color-accent-personality)" : "var(--border-subtle)"}` }}>{pos}</button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {POOL_CATEGORIES.map((cat) => (
              <button key={cat.key} onClick={() => setCatFilter(cat.key)} className="px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 cursor-pointer" style={{ background: catFilter === cat.key ? `${CATEGORY_COLORS[cat.key] ?? "var(--color-accent-personality)"}20` : "var(--bg-surface)", color: catFilter === cat.key ? CATEGORY_COLORS[cat.key] ?? "var(--color-accent-personality)" : "var(--text-muted)", border: `1px solid ${catFilter === cat.key ? CATEGORY_COLORS[cat.key] ?? "var(--color-accent-personality)" : "var(--border-subtle)"}` }}>{cat.label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Search players..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "level" | "role_score" | "age" | "name")} className="px-2 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
              <option value="level">Level</option>
              <option value="role_score">Role Score</option>
              <option value="age">Age</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* ── Player List ── */}
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
                    <span className="text-[8px] px-1 py-0.5 rounded shrink-0" style={{ background: `${CATEGORY_COLORS[p.pool_category] ?? "#71717a"}20`, color: CATEGORY_COLORS[p.pool_category] ?? "#71717a" }}>{titleCase(p.pool_category.replace(/_/g, " "))}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
                    {p.club && <span className="truncate" style={{ maxWidth: "100px" }}>{p.club}</span>}
                    {p.age && <span>· {p.age}y</span>}
                    {p.best_role && <span>· {p.best_role}</span>}
                  </div>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: (p.level ?? 0) >= 16 ? "var(--color-accent-technical)" : (p.level ?? 0) >= 12 ? "var(--color-accent-tactical)" : "var(--text-muted)" }}>{sortBy === "role_score" ? (p.best_role_score ?? "—") : (p.level ?? "—")}</span>
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

    // Smart slot assignment using formation-intelligence scoring (respects preferred side)
    const xiPlayers = squadPlayers.filter((p) => xiIds.has(p.person_id));
    const xiPitchSlots = assignXIToSlots(formation, xiPlayers);

    const xiPitchRowSizes = PITCH_ROWS[formation] ?? [1, 4, 3, 3];
    const xiPitchRows: (typeof xiPitchSlots)[] = [];
    let xiOffset = 0;
    for (const size of xiPitchRowSizes) {
      xiPitchRows.push(xiPitchSlots.slice(xiOffset, xiOffset + size));
      xiOffset += size;
    }

    return (
      <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
        {/* Header */}
        <div className="sticky top-0 z-10" style={{ background: "var(--bg-surface)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <button
                onClick={() => setStep("pick-squad")}
                className="text-xs cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                ← Squad
              </button>
              <div className="text-center">
                <h1
                  className="text-sm font-bold uppercase tracking-[1px]"
                  style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                >
                  Pick Your XI
                </h1>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {xiIds.size}/11 starters
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={xiIds.size !== 11 || submitting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--color-accent-personality)", color: "var(--bg-base)" }}
              >
                {submitting ? "..." : "Reveal →"}
              </button>
            </div>
          </div>
          <StepBar current={step} />
        </div>

        {/* Formation picker */}
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {FORMATIONS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFormation(f);
                  const newSlots = FORMATION_SLOTS[f] ?? FORMATION_SLOTS["4-3-3"];
                  const slotCounts: Record<string, number> = {};
                  for (const s of newSlots) slotCounts[s] = (slotCounts[s] ?? 0) + 1;
                  const kept = new Set<number>();
                  const used: Record<string, number> = {};
                  for (const id of xiIds) {
                    const p = nationData?.players.find((pp) => pp.person_id === id);
                    const pos = p?.position ?? "";
                    used[pos] = (used[pos] ?? 0) + 1;
                    if (used[pos] <= (slotCounts[pos] ?? 0)) kept.add(id);
                  }
                  const removed = xiIds.size - kept.size;
                  if (removed > 0) {
                    setFormationMsg(`${removed} player${removed > 1 ? "s" : ""} removed — didn't fit ${f}`);
                    setTimeout(() => setFormationMsg(null), 2500);
                  }
                  setXiIds(kept);
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
          {formationMsg && (
            <p className="text-xs text-center mt-1" style={{ color: "#f59e0b" }}>{formationMsg}</p>
          )}
        </div>

        {/* Pitch — primary XI selection UI */}
        <div className="max-w-5xl mx-auto px-4 pb-3">
          <div
            className="rounded-lg p-4 flex flex-col justify-between relative"
            style={{
              background: "linear-gradient(180deg, #0d3b1e 0%, #0a2e17 100%)",
              border: "1px solid rgba(111,195,223,0.15)",
              minHeight: "320px",
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full border border-white/10" />
            </div>
            <div className="absolute left-0 right-0 top-1/2 border-t border-white/10" />

            {xiPitchRows.map((row, ri) => (
              <div key={ri} className="flex justify-center gap-3 relative z-10" style={{ flex: 1, alignItems: "center" }}>
                {row.map((s) => (
                  <div key={s.idx} className="flex flex-col items-center" style={{ width: "60px" }}>
                    {s.player ? (
                      <button
                        onClick={() => toggleXI(s.player!.person_id)}
                        className="cursor-pointer text-center"
                        title={`Remove ${s.player.name} from XI`}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-bold mx-auto"
                          style={{
                            background: s.player.position === s.position
                              ? "var(--color-accent-tactical)"
                              : "var(--color-accent-personality)",
                            color: "#000",
                          }}
                        >
                          {s.player.position}
                        </div>
                        <div className="text-[8px] mt-0.5 truncate leading-tight font-medium" style={{ color: "#fff", maxWidth: "60px" }}>
                          {s.player.name.split(" ").pop()}
                        </div>
                        {s.side && (
                          <div className="text-[6px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                            {s.side === "L" ? "Left" : "Right"}
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="text-center">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-mono mx-auto"
                          style={{ border: "1.5px dashed rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.35)" }}
                        >
                          {s.position}
                        </div>
                        {s.side && (
                          <div className="text-[6px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                            {s.side === "L" ? "Left" : "Right"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bench — tap to add to XI */}
        <div className="max-w-5xl mx-auto px-4 pb-24">
          <div className="text-[10px] font-bold uppercase tracking-wider px-1 mb-2"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)", letterSpacing: "1.5px" }}>
            Bench — tap to start ({11 - xiIds.size} {11 - xiIds.size === 1 ? "spot" : "spots"} left)
          </div>
          {[...squadPlayers]
            .sort((a, b) => {
              const aXI = xiIds.has(a.person_id) ? 0 : 1;
              const bXI = xiIds.has(b.person_id) ? 0 : 1;
              if (aXI !== bXI) return aXI - bXI;
              const posOrder = POSITIONS.indexOf(a.position ?? "CM") - POSITIONS.indexOf(b.position ?? "CM");
              if (posOrder !== 0) return posOrder;
              return (b.level ?? 0) - (a.level ?? 0);
            })
            .filter((p) => !xiIds.has(p.person_id))
            .map((p) => (
              <button
                key={p.person_id}
                onClick={() => toggleXI(p.person_id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1 transition-all text-left cursor-pointer"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  opacity: xiIds.size >= 11 ? 0.4 : 1,
                }}
              >
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position ?? "CM"] ?? ""}`}
                  style={{ color: "white" }}
                >
                  {p.position ?? "?"}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
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
            ))}
          {xiIds.size > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wider px-1 mt-4 mb-2"
                style={{ color: "var(--color-accent-tactical)", fontFamily: "var(--font-display)", letterSpacing: "1.5px" }}>
                Starting XI
              </div>
              {[...squadPlayers]
                .filter((p) => xiIds.has(p.person_id))
                .sort((a, b) => {
                  const posOrder = POSITIONS.indexOf(a.position ?? "CM") - POSITIONS.indexOf(b.position ?? "CM");
                  return posOrder !== 0 ? posOrder : (b.level ?? 0) - (a.level ?? 0);
                })
                .map((p) => (
                  <button
                    key={p.person_id}
                    onClick={() => toggleXI(p.person_id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1 transition-all text-left cursor-pointer"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--color-accent-tactical)",
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold"
                      style={{ background: "var(--color-accent-tactical)", color: "var(--bg-base)" }}
                    >
                      XI
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position ?? "CM"] ?? ""}`}
                      style={{ color: "white" }}
                    >
                      {p.position ?? "?"}
                    </span>
                    <span className="text-xs font-medium truncate flex-1" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {p.level ?? "—"}
                    </span>
                  </button>
                ))}
            </>
          )}
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

  // Matched XI player names for reveal highlights
  const matchedXINames = comparison && comparison.xi_matches > 0
    ? nationData.players
        .filter((p) => xiIds.has(p.person_id) && idealXIIds.has(p.person_id))
        .map((p) => p.name)
    : [];

  const scoreColor = comparison
    ? comparison.score >= 75
      ? "var(--color-accent-technical)"
      : comparison.score >= 50
        ? "var(--color-accent-tactical)"
        : comparison.score >= 25
          ? "var(--color-accent-mental)"
          : "var(--color-accent-physical)"
    : "var(--text-muted)";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ background: "var(--bg-surface)" }}>
        <StepBar current={step} />
      </div>

      <div className="px-4 pt-8 pb-6 text-center max-w-3xl mx-auto">
        <h1
          className="text-2xl sm:text-3xl font-bold uppercase tracking-[2px] mb-4"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          The Results Are In
        </h1>

        {!comparison && (
          <div className="px-4 py-6 rounded-xl mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              Our scouts haven&apos;t finished analysing this nation yet.
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Your squad has been saved. Come back once we&apos;ve computed the ideal squad to see your score.
            </p>
          </div>
        )}

        {comparison && (
          <>
            {/* Animated score */}
            <div className="otp-score-reveal">
              <div
                className="text-6xl sm:text-7xl font-bold mb-2"
                style={{ fontFamily: "var(--font-display)", color: scoreColor }}
              >
                {displayScore}
              </div>
            </div>

            {/* Tier — delayed reveal */}
            <div className="otp-tier-reveal">
              <p
                className="text-lg font-semibold uppercase tracking-[2px] mb-6"
                style={{ fontFamily: "var(--font-display)", color: scoreColor }}
              >
                {comparison.tier}
              </p>
            </div>

            {/* Staggered stat cards */}
            <div className="flex justify-center gap-3 sm:gap-4 mb-6">
              {[
                { value: `${comparison.squad_matches}/26`, label: "Squad", color: "var(--text-primary)" },
                { value: `${comparison.xi_matches}/11`, label: "XI", color: "var(--text-primary)" },
                { value: comparison.formation_match ? "✓" : "✗", label: "Formation", color: comparison.formation_match ? "var(--color-accent-tactical)" : "var(--text-muted)" },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="otp-stat-reveal px-4 py-3 rounded-xl text-center"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    animationDelay: `${0.8 + i * 0.15}s`,
                  }}
                >
                  <div className="text-xl font-bold font-mono" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Matched XI highlights */}
            {matchedXINames.length > 0 && (
              <div
                className="otp-stat-reveal mb-6 px-4 py-3 rounded-xl text-left max-w-md mx-auto"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderLeftColor: "var(--color-accent-personality)",
                  borderLeftWidth: "3px",
                  animationDelay: "1.3s",
                }}
              >
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  You nailed it
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {matchedXINames.map((name) => (
                    <span
                      key={name}
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: "rgba(168,85,247,0.15)",
                        color: "var(--color-accent-personality)",
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Conversion CTA */}
            <UpgradeCTA
              message={`Our scouts rated your squad ${comparison.score}/100 — want to know why?`}
              detail="Unlock full player profiles, radar charts, archetypes, and scouting intelligence for every player."
            />
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
            <h2
              className="text-xs font-bold uppercase tracking-[1.5px] mb-1"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              Your Squad ({formation})
            </h2>
            <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
              {selectedIds.size} players
            </p>
            <div className="space-y-0.5">
              {[...userSelectedPlayers]
                .sort((a, b) => POSITIONS.indexOf(a.position ?? "CM") - POSITIONS.indexOf(b.position ?? "CM"))
                .map((p) => {
                  const inIdeal = idealSquadPlayers.some((ip) => ip.person_id === p.person_id);
                  return (
                    <div
                      key={p.person_id}
                      className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                      style={{
                        background: inIdeal ? "rgba(168,85,247,0.08)" : "transparent",
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
            <h2
              className="text-xs font-bold uppercase tracking-[1.5px] mb-1"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-accent-technical)" }}
            >
              Chief Scout&apos;s Squad ({idealData?.formation ?? "—"})
            </h2>
            <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
              Strength: {idealData?.strength ?? "—"}
            </p>
            <div className="space-y-0.5">
              {idealSquadPlayers.map((p) => {
                const inUser = selectedIds.has(p.person_id);
                const isStarter = idealXIIds.has(p.person_id);
                return (
                  <div
                    key={p.person_id}
                    className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                    style={{
                      background: inUser ? "rgba(168,85,247,0.08)" : "transparent",
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
        <div className="flex justify-center gap-3 mt-8 flex-wrap">
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
              setSelectedIds(new Set());
              setXiIds(new Set());
              setFormation("4-3-3");
              setComparison(null);
              setIdealData(null);
              setStep("pick-squad");
            }}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => {
              const text = `On The Plane — I scored ${comparison?.score ?? 0}/100 (${comparison?.tier ?? ""}) picking ${titleCase(slug.replace(/-/g, " "))}'s World Cup squad! ${comparison?.squad_matches ?? 0}/26 squad matches, ${comparison?.xi_matches ?? 0}/11 XI matches. Try it: ${window.location.origin}/on-the-plane`;
              navigator.clipboard?.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors"
            style={{
              background: copied ? "var(--color-accent-tactical)" : "var(--color-accent-personality)",
              color: "var(--bg-base)",
            }}
          >
            {copied ? "Copied!" : "Copy Result"}
          </button>
        </div>
      </div>
    </div>
  );
}
