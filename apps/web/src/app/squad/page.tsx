"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PaywallGate } from "@/components/PaywallGate";

interface SquadPlayer {
  id: number;
  name: string;
  level: number | null;
  squad_role: string | null;
  loan_status: string | null;
  age: number | null;
  position: string | null;
  secondary_position: string | null;
}

interface PositionGroup {
  count: number;
  avg_age: number | null;
  depth_rating: string;
  players: SquadPlayer[];
}

interface SquadData {
  club_name: string;
  total: number;
  positions: Record<string, PositionGroup>;
}

interface InferResult {
  inferred_count: number;
  inferred: string[];
  needs: ClubNeed[];
}

interface ClubNeed {
  id: number;
  position: string;
  priority: number;
  source: string;
  inferred_reason: string | null;
  preferred_archetype: string | null;
  notes: string | null;
}

const DEPTH_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  empty:    { bg: "var(--bg-elevated)", text: "var(--text-muted)", border: "var(--border-subtle)" },
  thin:     { bg: "rgba(251,191,36,0.1)", text: "var(--color-accent-technical)", border: "var(--color-accent-technical)" },
  adequate: { bg: "rgba(52,211,153,0.1)", text: "var(--color-accent-mental)", border: "var(--color-accent-mental)" },
  strong:   { bg: "rgba(96,165,250,0.1)", text: "var(--color-accent-physical)", border: "var(--color-accent-physical)" },
};

const POSITION_ORDER = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

export default function SquadPage() {
  const [squad, setSquad] = useState<SquadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inferring, setInferring] = useState(false);
  const [inferResult, setInferResult] = useState<InferResult | null>(null);
  const [needs, setNeeds] = useState<ClubNeed[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [squadRes, needsRes] = await Promise.all([
          fetch("/api/squad"),
          fetch("/api/club/needs"),
        ]);
        if (squadRes.ok) {
          setSquad(await squadRes.json());
        } else {
          const err = await squadRes.json();
          setError(err.error ?? "Failed to load squad");
        }
        if (needsRes.ok) {
          setNeeds(await needsRes.json());
        }
      } catch {
        setError("Failed to load squad data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleInfer = useCallback(async () => {
    setInferring(true);
    setInferResult(null);
    try {
      const res = await fetch("/api/club/needs/infer", { method: "POST" });
      if (res.ok) {
        const result: InferResult = await res.json();
        setInferResult(result);
        setNeeds(result.needs);
      }
    } catch {}
    finally { setInferring(false); }
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-[var(--text-muted)]">
        Loading squad...
      </div>
    );
  }

  if (error || !squad) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <p className="text-xs text-[var(--text-muted)]">{error ?? "No squad data"}</p>
        <p className="text-[10px] text-[var(--text-muted)] mt-1">Set your club name in Club Settings first.</p>
      </div>
    );
  }

  return (
    <PaywallGate required="pro">
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{squad.club_name}</h1>
          <p className="text-[10px] text-[var(--text-muted)] font-data">{squad.total} players</p>
        </div>
        <button
          onClick={handleInfer}
          disabled={inferring}
          className="text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 transition-colors disabled:opacity-40"
          style={{
            background: "rgba(111,195,223,0.12)",
            color: "var(--border-bright)",
            border: "1px solid rgba(111,195,223,0.3)",
          }}
        >
          {inferring ? "Analysing..." : "Infer Needs"}
        </button>
      </div>

      {/* Inference result banner */}
      {inferResult && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-bright)] p-3 mb-4 text-xs">
          <strong>{inferResult.inferred_count} needs inferred:</strong>{" "}
          {inferResult.inferred_count > 0
            ? inferResult.inferred.join(", ")
            : "Squad looks complete — no gaps detected"}
        </div>
      )}

      {/* Position grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 mb-4">
        {POSITION_ORDER.map(pos => {
          const group = squad.positions[pos];
          if (!group) return null;
          const ds = DEPTH_STYLE[group.depth_rating] ?? DEPTH_STYLE.empty;
          const posNeed = needs.find(n => n.position === pos);

          return (
            <div
              key={pos}
              className="bg-[var(--bg-surface)] p-3"
              style={{ borderLeft: `2px solid ${ds.border}`, borderBottom: "1px solid var(--border-subtle)", borderRight: "1px solid var(--border-subtle)", borderTop: "1px solid var(--border-subtle)" }}
            >
              {/* Position header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold">{pos}</span>
                <span
                  className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                  style={{ background: ds.bg, color: ds.text, border: `1px solid ${ds.border}` }}
                >
                  {group.depth_rating}
                </span>
                {posNeed && (
                  <span className="ml-auto text-[9px] font-bold font-data" style={{ color: "var(--color-accent-technical)" }}>
                    P{posNeed.priority}
                  </span>
                )}
              </div>

              {/* Stats */}
              {group.count > 0 && group.avg_age != null && (
                <div className="text-[9px] text-[var(--text-muted)] mb-1.5 font-data">
                  {group.count} players · Avg {group.avg_age}y
                </div>
              )}

              {/* Player list */}
              {group.players.length > 0 ? (
                <div className="space-y-0">
                  {group.players.map(p => (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-[rgba(111,195,223,0.04)] transition-colors"
                    >
                      <span className="text-[11px] font-medium text-[var(--text-primary)] flex-1 truncate">{p.name}</span>
                      {p.age != null && (
                        <span className={`text-[9px] font-data ${p.age >= 30 ? "text-[var(--color-accent-technical)]" : "text-[var(--text-muted)]"}`}>
                          {p.age}y
                        </span>
                      )}
                      {(p.squad_role || p.loan_status) && (
                        <span className={`text-[8px] uppercase tracking-wider ${p.loan_status ? "text-[var(--color-accent-physical)]" : "text-[var(--text-muted)]"}`}>
                          {p.loan_status
                            ? `Loan: ${p.loan_status.replace(/_/g, " ")}`
                            : p.squad_role!.replace(/_/g, " ")}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-[var(--text-muted)] italic">No players</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Club needs summary */}
      {needs.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 bg-[var(--color-accent-technical)] shadow-[0_0_6px_var(--color-accent-technical)]" />
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-[var(--color-accent-technical)]">Club Needs</span>
          </div>
          <div className="space-y-0.5">
            {needs.map(n => (
              <div
                key={n.id}
                className="flex items-center gap-2 px-2 py-1.5 text-[11px] bg-[var(--bg-elevated)]"
              >
                <span className="font-bold font-data w-8">{n.position}</span>
                <span
                  className="text-[8px] font-bold uppercase px-1.5 py-0.5"
                  style={{
                    background: n.priority >= 4 ? "rgba(251,191,36,0.1)" : "var(--bg-surface)",
                    color: n.priority >= 4 ? "var(--color-accent-technical)" : "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  P{n.priority}
                </span>
                <span
                  className="text-[8px] font-bold uppercase px-1.5 py-0.5 ml-auto"
                  style={{
                    background: n.source === "inferred" ? "rgba(251,191,36,0.1)" : "rgba(111,195,223,0.1)",
                    color: n.source === "inferred" ? "var(--color-accent-technical)" : "var(--border-bright)",
                  }}
                >
                  {n.source}
                </span>
                {n.inferred_reason && (
                  <span className="text-[10px] text-[var(--text-muted)]">{n.inferred_reason}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </PaywallGate>
  );
}
