"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ScoredComp } from "@/lib/transfer-comparables";
import { SectionHeader } from "@/components/SectionHeader";

interface CompsResponse {
  comparables: ScoredComp[];
  weighted_median_eur_m: number;
  comp_count: number;
}

function formatFee(m: number): string {
  if (m >= 1) return `\u20ac${m.toFixed(1)}m`;
  if (m > 0) return `\u20ac${(m * 1000).toFixed(0)}k`;
  return "\u20ac0";
}

function feeColor(m: number): string {
  if (m >= 80) return "text-emerald-400";
  if (m >= 40) return "text-amber-400";
  if (m >= 15) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function simColor(s: number): string {
  if (s >= 0.8) return "bg-emerald-400";
  if (s >= 0.6) return "bg-amber-400";
  return "bg-[var(--text-muted)]";
}

export function TransferComps({ playerId, embedded = false }: { playerId: number; embedded?: boolean }) {
  const [data, setData] = useState<CompsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/players/${playerId}/comparables`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading) {
    return (
      <div className={`${embedded ? "" : "card p-3 sm:p-4"} space-y-2 animate-pulse`}>
        <div className="h-3 w-40 bg-[var(--bg-elevated)] rounded" />
        <div className="h-8 w-24 bg-[var(--bg-elevated)] rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[var(--bg-elevated)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.comp_count === 0) return null;

  return (
    <div className={`${embedded ? "" : "card p-3 sm:p-4"} space-y-3`}>
      <div className="flex items-center justify-between">
        {!embedded && <SectionHeader label="Transfer Comparables" color="tactical" />}
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)]">
          {data.comp_count} comps
        </span>
      </div>

      {/* Weighted median summary */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--text-muted)]">Median comp fee</span>
        <span className={`text-sm font-mono font-bold ${feeColor(data.weighted_median_eur_m)}`}>
          {formatFee(data.weighted_median_eur_m)}
        </span>
      </div>

      {/* Comp list */}
      <div className="space-y-1.5">
        {data.comparables.map((comp, i) => (
          <div
            key={`${comp.player_name}-${comp.transfer_date}-${i}`}
            className="p-2 rounded bg-[var(--bg-elevated)]/50 space-y-1"
          >
            {/* Row 1: Name + fee */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--bg-pit)] text-[var(--text-muted)] shrink-0">
                  {comp.position}
                </span>
                {comp.player_id ? (
                  <Link
                    href={`/players/${comp.player_id}`}
                    className="text-[11px] font-medium text-[var(--text-primary)] hover:text-[var(--color-accent-tactical)] truncate"
                  >
                    {comp.player_name}
                  </Link>
                ) : (
                  <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                    {comp.player_name}
                  </span>
                )}
                <span className="text-[9px] text-[var(--text-muted)] shrink-0">
                  {comp.age_at_transfer}y
                </span>
              </div>
              <span className={`text-[12px] font-mono font-bold shrink-0 ${feeColor(comp.fee_eur_m)}`}>
                {formatFee(comp.fee_eur_m)}
              </span>
            </div>

            {/* Row 2: Clubs + similarity */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] text-[var(--text-muted)] truncate">
                {comp.from_club} → {comp.to_club}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-12 h-1 rounded-full bg-[var(--bg-pit)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${simColor(comp.similarity)}`}
                    style={{ width: `${comp.similarity * 100}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-[var(--text-secondary)] w-7 text-right">
                  {(comp.similarity * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Row 3: Match reason pills */}
            {comp.match_reasons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {comp.match_reasons.map((reason) => (
                  <span
                    key={reason}
                    className="text-[8px] px-1 py-0.5 rounded bg-[var(--bg-pit)] text-[var(--text-muted)]"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
