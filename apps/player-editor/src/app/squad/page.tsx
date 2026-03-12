"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface SquadPlayer {
  id: number;
  name: string;
  level: number | null;
  peak: number | null;
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

const DEPTH_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  empty:    { bg: "var(--surface2)", color: "var(--text3)", border: "var(--border2)" },
  thin:     { bg: "var(--amber-dim)", color: "var(--amber)", border: "var(--amber)" },
  adequate: { bg: "var(--green-dim)", color: "var(--green)", border: "var(--green)" },
  strong:   { bg: "var(--accent-dim)", color: "var(--accent)", border: "var(--accent)" },
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
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}>
        Loading squad...
      </div>
    );
  }

  if (error || !squad) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
        <p>{error ?? "No squad data"}</p>
        <p style={{ fontSize: "0.8rem", marginTop: 8 }}>Set your club name in Club Settings first.</p>
      </div>
    );
  }

  const inferredNeeds = needs.filter(n => n.source === "inferred");
  const manualNeeds = needs.filter(n => n.source === "manual");

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 16, flexShrink: 0, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            {squad.club_name}
          </h1>
          <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
            {squad.total} players in squad
          </span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={handleInfer}
            disabled={inferring}
            style={{
              padding: "8px 20px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700,
              background: "var(--accent)", border: "none", color: "white", cursor: "pointer",
              opacity: inferring ? 0.6 : 1,
            }}
          >
            {inferring ? "Analysing..." : "Infer Needs from Squad"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {/* Inference result banner */}
        {inferResult && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--accent)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: "0.82rem",
          }}>
            <strong>{inferResult.inferred_count} needs inferred:</strong>{" "}
            {inferResult.inferred_count > 0
              ? inferResult.inferred.join(", ")
              : "Squad looks complete — no gaps detected"}
          </div>
        )}

        {/* Position grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}>
          {POSITION_ORDER.map(pos => {
            const group = squad.positions[pos];
            if (!group) return null;
            const dc = DEPTH_COLORS[group.depth_rating] ?? DEPTH_COLORS.empty;
            const posNeed = needs.find(n => n.position === pos);

            return (
              <div key={pos} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: 16,
              }}>
                {/* Position header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: "1rem", fontWeight: 800 }}>{pos}</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 6, fontSize: "0.68rem", fontWeight: 700,
                    background: dc.bg, color: dc.color, border: `1px solid ${dc.border}`,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {group.depth_rating}
                  </span>
                  {posNeed && (
                    <span style={{
                      marginLeft: "auto", fontSize: "0.65rem", fontWeight: 600,
                      color: posNeed.source === "inferred" ? "var(--amber)" : "var(--accent)",
                    }}>
                      P{posNeed.priority} need
                    </span>
                  )}
                </div>

                {/* Stats row */}
                {group.count > 0 && group.avg_age != null && (
                  <div style={{ display: "flex", gap: 16, fontSize: "0.72rem", color: "var(--text3)", marginBottom: 8 }}>
                    <span>Avg age: {group.avg_age}</span>
                  </div>
                )}

                {/* Player list */}
                {group.players.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {group.players.map(p => (
                      <Link
                        key={p.id}
                        href={`/players/${p.id}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "4px 8px", borderRadius: 6,
                          textDecoration: "none", color: "var(--text)",
                          fontSize: "0.8rem", background: "var(--surface2)",
                        }}
                      >
                        <span style={{ fontWeight: 600, flex: 1 }}>{p.name}</span>
                        {p.age != null && (
                          <span style={{ fontSize: "0.7rem", color: p.age >= 30 ? "var(--amber)" : "var(--text3)" }}>
                            {p.age}y
                          </span>
                        )}
                        {(p.squad_role || p.loan_status) && (
                          <span style={{
                            fontSize: "0.62rem",
                            color: p.loan_status ? "var(--accent)" : "var(--text3)",
                            textTransform: "uppercase", letterSpacing: "0.04em",
                          }}>
                            {p.loan_status
                              ? `loan: ${p.loan_status.replace("_", " ")}`
                              : p.squad_role!.replace("_", " ")}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.75rem", color: "var(--text3)", fontStyle: "italic" }}>
                    No players
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Club needs summary */}
        {needs.length > 0 && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 20,
          }}>
            <div style={{
              fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--text3)", marginBottom: 12,
            }}>
              Club Needs
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {needs.map(n => (
                <div key={n.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 10px", borderRadius: 8, background: "var(--surface2)",
                  fontSize: "0.8rem",
                }}>
                  <span style={{ fontWeight: 700, width: 32 }}>{n.position}</span>
                  <span style={{
                    padding: "1px 6px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700,
                    background: n.priority >= 4 ? "var(--amber-dim)" : "var(--surface)",
                    color: n.priority >= 4 ? "var(--amber)" : "var(--text2)",
                    border: "1px solid var(--border2)",
                  }}>
                    P{n.priority}
                  </span>
                  <span style={{
                    marginLeft: "auto",
                    padding: "1px 6px", borderRadius: 4, fontSize: "0.62rem", fontWeight: 600,
                    background: n.source === "inferred" ? "var(--amber-dim)" : "var(--accent-dim)",
                    color: n.source === "inferred" ? "var(--amber)" : "var(--accent)",
                  }}>
                    {n.source}
                  </span>
                  {n.inferred_reason && (
                    <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
                      {n.inferred_reason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
