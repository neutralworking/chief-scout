"use client";

import Link from "next/link";
import { useState } from "react";
import { POSITION_COLORS } from "@/lib/types";

export interface Transfer {
  id: number;
  player_name: string;
  player_id: number | null;
  age_at_transfer: number | null;
  position: string | null;
  from_club: string;
  from_league: string | null;
  to_club: string;
  to_league: string | null;
  fee_eur_m: number | null;
  fee_type: string;
  deal_context: string | null;
  loan_fee_eur_m: number | null;
  obligation_fee_eur_m: number | null;
  contract_years: number | null;
  transfer_date: string;
  window: string | null;
  primary_archetype: string | null;
  notes: string | null;
  source_url: string | null;
}

interface TransfersTableProps {
  transfers: Transfer[];
  loading: boolean;
}

const FEE_TYPE_STYLES: Record<string, string> = {
  permanent:
    "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)]",
  loan: "bg-[var(--color-accent-mental)]/20 text-[var(--color-accent-mental)]",
  loan_obligation:
    "bg-[var(--color-accent-mental)]/20 text-[var(--color-accent-mental)]",
  loan_option:
    "bg-[var(--color-accent-mental)]/20 text-[var(--color-accent-mental)]",
  free: "bg-[var(--color-accent-physical)]/20 text-[var(--color-accent-physical)]",
  swap: "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)]",
  pre_agreed:
    "bg-[var(--color-accent-technical)]/20 text-[var(--color-accent-technical)]",
  undisclosed: "bg-zinc-700/40 text-[var(--text-muted)]",
};

const FEE_TYPE_LABELS: Record<string, string> = {
  permanent: "Permanent",
  loan: "Loan",
  loan_obligation: "Loan (OB)",
  loan_option: "Loan (Opt)",
  free: "Free",
  swap: "Swap",
  pre_agreed: "Pre-agreed",
  undisclosed: "Undisclosed",
};

const DEAL_CONTEXT_LABELS: Record<string, string> = {
  release_clause: "Release Clause",
  transfer_request: "Transfer Request",
  contract_expiring: "Contract Expiring",
  mutual_termination: "Mutual Termination",
  club_decision: "Club Decision",
  player_surplus: "Player Surplus",
  financial_distress: "Financial Distress",
  pre_contract: "Pre-contract",
  loan_recall: "Loan Recall",
  other: "Other",
};

function formatFee(t: Transfer): string {
  if (t.fee_type === "loan") {
    if (t.loan_fee_eur_m && t.loan_fee_eur_m > 0) return `€${t.loan_fee_eur_m}m loan`;
    return "Loan";
  }
  if (t.fee_type === "free") return "Free";
  if (t.fee_eur_m == null) return "Undisclosed";
  if (t.fee_eur_m === 0) return "€0";
  return `€${t.fee_eur_m}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildComparableString(t: Transfer): string {
  const age = t.age_at_transfer ? `${t.age_at_transfer}` : "?";
  const pos = t.position || "?";
  const fee = formatFee(t);
  const dateLabel = new Date(t.transfer_date).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
  const archetype = t.primary_archetype ? ` — ${t.primary_archetype}` : "";
  return `[Comparable] ${t.player_name} (${age}, ${pos}) — ${t.from_club} → ${t.to_club} — ${fee} — ${dateLabel}${archetype}`;
}

export default function TransfersTable({
  transfers,
  loading,
}: TransfersTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = async (t: Transfer) => {
    const text = buildComparableString(t);
    await navigator.clipboard.writeText(text);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="glass rounded-xl py-12 text-center">
        <p className="text-sm text-[var(--text-muted)]">Loading transfers...</p>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="glass rounded-xl py-12 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          No transfers found for these filters.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="glass rounded-xl overflow-hidden hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 px-3 font-medium">Date</th>
              <th className="text-left py-2 px-3 font-medium w-10">Pos</th>
              <th className="text-left py-2 px-3 font-medium">Player</th>
              <th className="text-left py-2 px-3 font-medium">From → To</th>
              <th className="text-right py-2 px-3 font-medium">Fee</th>
              <th className="text-center py-2 px-3 font-medium">Type</th>
              <th className="text-center py-2 px-3 font-medium hidden lg:table-cell">
                Context
              </th>
              <th className="text-left py-2 px-3 font-medium hidden xl:table-cell">
                Archetype
              </th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => {
              const posColor =
                POSITION_COLORS[t.position ?? ""] ?? "bg-zinc-700/60";
              const isExpanded = expandedId === t.id;
              const typeStyle =
                FEE_TYPE_STYLES[t.fee_type] ?? "bg-zinc-700/40 text-[var(--text-muted)]";

              return (
                <>
                  <tr
                    key={t.id}
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    className={`border-b border-[var(--border-subtle)]/30 cursor-pointer transition-colors ${
                      isExpanded
                        ? "bg-[var(--bg-elevated)]/50"
                        : "hover:bg-[var(--bg-elevated)]/30"
                    }`}
                  >
                    <td className="py-2 px-3 text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap">
                      {formatDate(t.transfer_date)}
                    </td>
                    <td className="py-2 px-3">
                      {t.position && (
                        <span
                          className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}
                        >
                          {t.position}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {t.player_id ? (
                          <Link
                            href={`/players/${t.player_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[var(--text-primary)] hover:text-white transition-colors font-medium"
                          >
                            {t.player_name}
                          </Link>
                        ) : (
                          <span className="text-[var(--text-primary)] font-medium">
                            {t.player_name}
                          </span>
                        )}
                        {t.age_at_transfer && (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            {t.age_at_transfer}y
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs text-[var(--text-secondary)]">
                      <span>{t.from_club}</span>
                      <span className="text-[var(--text-muted)] mx-1">→</span>
                      <span>{t.to_club}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs font-semibold text-[var(--text-primary)]">
                      {formatFee(t)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${typeStyle}`}
                      >
                        {FEE_TYPE_LABELS[t.fee_type] ?? t.fee_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center hidden lg:table-cell">
                      {t.deal_context && (
                        <span className="text-[9px] text-[var(--text-muted)]">
                          {DEAL_CONTEXT_LABELS[t.deal_context] ?? t.deal_context}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs text-[var(--text-secondary)] hidden xl:table-cell">
                      {t.primary_archetype || "–"}
                    </td>
                  </tr>

                  {/* Expanded details row */}
                  {isExpanded && (
                    <tr
                      key={`${t.id}-detail`}
                      className="bg-[var(--bg-elevated)]/40 border-b border-[var(--border-subtle)]/30"
                    >
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          {/* Info grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                            {t.from_league && (
                              <div>
                                <span className="text-[var(--text-muted)]">
                                  From league:{" "}
                                </span>
                                <span className="text-[var(--text-secondary)]">
                                  {t.from_league}
                                </span>
                              </div>
                            )}
                            {t.to_league && (
                              <div>
                                <span className="text-[var(--text-muted)]">
                                  To league:{" "}
                                </span>
                                <span className="text-[var(--text-secondary)]">
                                  {t.to_league}
                                </span>
                              </div>
                            )}
                            {t.contract_years && (
                              <div>
                                <span className="text-[var(--text-muted)]">
                                  Contract:{" "}
                                </span>
                                <span className="text-[var(--text-secondary)]">
                                  {t.contract_years}yr
                                </span>
                              </div>
                            )}
                            {t.obligation_fee_eur_m != null && (
                              <div>
                                <span className="text-[var(--text-muted)]">
                                  Obligation:{" "}
                                </span>
                                <span className="text-[var(--text-secondary)]">
                                  €{t.obligation_fee_eur_m}m
                                </span>
                              </div>
                            )}
                            {t.deal_context && (
                              <div className="lg:hidden">
                                <span className="text-[var(--text-muted)]">
                                  Context:{" "}
                                </span>
                                <span className="text-[var(--text-secondary)]">
                                  {DEAL_CONTEXT_LABELS[t.deal_context] ??
                                    t.deal_context}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notes */}
                          {t.notes && (
                            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                              {t.notes}
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(t);
                              }}
                              className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30 hover:bg-[var(--color-accent-tactical)]/30 transition-colors"
                            >
                              {copiedId === t.id
                                ? "Copied!"
                                : "Use as Comparable"}
                            </button>
                            {t.source_url && (
                              <a
                                href={t.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors"
                              >
                                Source
                              </a>
                            )}
                            {t.player_id && (
                              <Link
                                href={`/players/${t.player_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors"
                              >
                                Player Profile
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-1">
        {transfers.map((t) => {
          const posColor =
            POSITION_COLORS[t.position ?? ""] ?? "bg-zinc-700/60";
          const typeStyle =
            FEE_TYPE_STYLES[t.fee_type] ?? "bg-zinc-700/40 text-[var(--text-muted)]";
          const isExpanded = expandedId === t.id;

          return (
            <div
              key={t.id}
              onClick={() => setExpandedId(isExpanded ? null : t.id)}
              className="glass rounded-lg p-3 cursor-pointer hover:border-[var(--color-accent-tactical)]/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {t.position && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor} text-white shrink-0`}
                    >
                      {t.position}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {t.player_name}
                      {t.age_at_transfer && (
                        <span className="text-[var(--text-muted)] font-normal ml-1">
                          {t.age_at_transfer}y
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {t.from_club} → {t.to_club}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${typeStyle}`}
                  >
                    {FEE_TYPE_LABELS[t.fee_type] ?? t.fee_type}
                  </span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
                    {formatFee(t)}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]/30">
                  <p className="text-[10px] text-[var(--text-muted)] mb-1">
                    {formatDate(t.transfer_date)}
                    {t.deal_context &&
                      ` · ${DEAL_CONTEXT_LABELS[t.deal_context] ?? t.deal_context}`}
                  </p>
                  {t.notes && (
                    <p className="text-[11px] text-[var(--text-secondary)] mb-2">
                      {t.notes}
                    </p>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(t);
                    }}
                    className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
                  >
                    {copiedId === t.id ? "Copied!" : "Use as Comparable"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
