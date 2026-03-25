"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface Transfer {
  id: number;
  player_name: string;
  player_id: number | null;
  age_at_transfer: number | null;
  position: string | null;
  from_club: string | null;
  from_league: string | null;
  to_club: string | null;
  to_league: string | null;
  fee_eur_m: number | null;
  fee_type: string | null;
  deal_context: string | null;
  loan_fee_eur_m: number | null;
  obligation_fee_eur_m: number | null;
  contract_years: number | null;
  transfer_date: string | null;
  transfer_window: string | null;
  primary_archetype: string | null;
  notes: string | null;
  source_url: string | null;
  source: string | null;
  confidence: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

const SOURCE_STYLE: Record<string, string> = {
  seed: "bg-[var(--color-accent-technical)]/15 text-[var(--color-accent-technical)]",
  kaggle: "bg-[var(--color-accent-physical)]/15 text-[var(--color-accent-physical)]",
  wikidata: "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)]",
  manual: "bg-[var(--bg-elevated)] text-[var(--text-muted)]",
};

const FEE_TYPE_STYLE: Record<string, string> = {
  permanent: "bg-[var(--color-accent-technical)]/15 text-[var(--color-accent-technical)]",
  loan: "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)]",
  free: "bg-[var(--color-accent-mental)]/15 text-[var(--color-accent-mental)]",
  pre_agreed: "bg-[var(--color-accent-personality)]/15 text-[var(--color-accent-personality)]",
};

const SORT_OPTIONS = [
  { key: "fee_desc", label: "Fee (High)" },
  { key: "fee_asc", label: "Fee (Low)" },
  { key: "date_desc", label: "Date (Recent)" },
  { key: "date_asc", label: "Date (Old)" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFee(fee: number | null): string {
  if (fee === null || fee === undefined) return "Undisclosed";
  if (fee === 0) return "Free";
  if (fee >= 1) return `\u20AC${fee.toFixed(1)}m`;
  return `\u20AC${(fee * 1000).toFixed(0)}k`;
}

function feeColor(fee: number | null): string {
  if (fee === null || fee === undefined) return "text-[var(--text-muted)]";
  if (fee === 0) return "text-[var(--color-accent-mental)]";
  if (fee >= 80) return "text-[var(--color-accent-personality)]";
  if (fee >= 30) return "text-[var(--color-accent-technical)]";
  return "text-[var(--text-secondary)]";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function windowLabel(w: string): string {
  // e.g. "2025_summer" -> "Summer 2025", "2026_jan" -> "Jan 2026"
  const parts = w.split("_");
  if (parts.length === 2) {
    const year = parts[0];
    const period = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return `${period} ${year}`;
  }
  return w;
}

// ── Transfer Card ────────────────────────────────────────────────────────────

function TransferCard({ t }: { t: Transfer }) {
  const posClass = POSITION_COLORS[t.position ?? ""] ?? "bg-[var(--bg-elevated)]";

  return (
    <article
      className="bg-[var(--bg-surface)] p-3 transition-colors hover:bg-[rgba(111,195,223,0.03)]"
      style={{ borderLeft: "2px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      {/* Row 1: Player + position + fee */}
      <div className="flex items-center gap-2 mb-1.5">
        {t.position && (
          <span className={`text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 ${posClass} text-white`}>
            {t.position}
          </span>
        )}
        {t.player_id ? (
          <Link
            href={`/players/${t.player_id}`}
            className="text-xs font-bold text-[var(--text-primary)] hover:text-[var(--border-bright)] transition-colors truncate"
          >
            {t.player_name}
          </Link>
        ) : (
          <span className="text-xs font-bold text-[var(--text-primary)] truncate">{t.player_name}</span>
        )}
        {t.age_at_transfer && (
          <span className="text-[9px] text-[var(--text-muted)] font-data">{t.age_at_transfer}y</span>
        )}
        <span className="ml-auto shrink-0">
          <span className={`text-xs font-bold font-data ${feeColor(t.fee_eur_m)}`}>
            {formatFee(t.fee_eur_m)}
          </span>
        </span>
      </div>

      {/* Row 2: From -> To */}
      <div className="flex items-center gap-1 text-[10px] mb-1.5">
        <span className="text-[var(--text-secondary)] truncate max-w-[40%]">
          {t.from_club ?? "Unknown"}
          {t.from_league && (
            <span className="text-[var(--text-muted)]"> ({t.from_league})</span>
          )}
        </span>
        <span className="text-[var(--text-muted)] shrink-0 px-0.5">&rarr;</span>
        <span className="text-[var(--text-primary)] font-medium truncate max-w-[40%]">
          {t.to_club ?? "Unknown"}
          {t.to_league && (
            <span className="text-[var(--text-muted)]"> ({t.to_league})</span>
          )}
        </span>
      </div>

      {/* Row 3: Metadata pills */}
      <div className="flex items-center flex-wrap gap-1">
        {t.fee_type && (
          <span className={`text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 ${FEE_TYPE_STYLE[t.fee_type] ?? "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
            {t.fee_type.replace("_", " ")}
          </span>
        )}
        {t.transfer_window && (
          <span className="text-[8px] font-data text-[var(--text-muted)] px-1.5 py-0.5 bg-[var(--bg-elevated)]">
            {windowLabel(t.transfer_window)}
          </span>
        )}
        {t.transfer_date && (
          <span className="text-[8px] font-data text-[var(--text-muted)]">
            {formatDate(t.transfer_date)}
          </span>
        )}
        {t.primary_archetype && (
          <span className="text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 bg-[var(--color-accent-personality)]/10 text-[var(--color-accent-personality)]">
            {t.primary_archetype}
          </span>
        )}
        {t.deal_context && (
          <span className="text-[8px] font-data text-[var(--text-secondary)] px-1.5 py-0.5 bg-[var(--bg-elevated)]">
            {t.deal_context}
          </span>
        )}
        {t.source && (
          <span className={`text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 ml-auto ${SOURCE_STYLE[t.source] ?? "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
            {t.source}
          </span>
        )}
      </div>

      {/* Loan details */}
      {(t.loan_fee_eur_m || t.obligation_fee_eur_m) && (
        <div className="mt-1 flex items-center gap-2 text-[9px] text-[var(--text-muted)] font-data">
          {t.loan_fee_eur_m != null && <span>Loan fee: {formatFee(t.loan_fee_eur_m)}</span>}
          {t.obligation_fee_eur_m != null && <span>Obligation: {formatFee(t.obligation_fee_eur_m)}</span>}
        </div>
      )}

      {/* Contract + notes */}
      {(t.contract_years || t.notes) && (
        <div className="mt-1 text-[9px] text-[var(--text-muted)]">
          {t.contract_years && <span className="font-data">{t.contract_years}yr deal</span>}
          {t.contract_years && t.notes && <span> &middot; </span>}
          {t.notes && <span className="italic">{t.notes}</span>}
        </div>
      )}
    </article>
  );
}

// ── Main Content ─────────────────────────────────────────────────────────────

function TransfersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const windowFilter = searchParams.get("window") ?? "";
  const positionFilter = searchParams.get("position") ?? "";
  const feeTypeFilter = searchParams.get("fee_type") ?? "";
  const sourceFilter = searchParams.get("source") ?? "";
  const sortFilter = searchParams.get("sort") ?? "fee_desc";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/transfers?${params.toString()}`);
    },
    [router, searchParams]
  );

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (windowFilter) params.set("window", windowFilter);
    if (positionFilter) params.set("position", positionFilter);
    if (feeTypeFilter) params.set("fee_type", feeTypeFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    params.set("sort", sortFilter);
    params.set("limit", "200");
    return `/api/transfers?${params}`;
  }, [windowFilter, positionFilter, feeTypeFilter, sourceFilter, sortFilter]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!cancelled) setTransfers(data.transfers ?? []);
      } catch {
        if (!cancelled) setTransfers([]);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [apiUrl]);

  // Derive unique windows from data for pills
  const allWindows = useMemo(() => {
    const set = new Set<string>();
    for (const t of transfers) {
      if (t.transfer_window) set.add(t.transfer_window);
    }
    return [...set].sort().reverse();
  }, [transfers]);

  // Derive unique sources
  const allSources = useMemo(() => {
    const set = new Set<string>();
    for (const t of transfers) {
      if (t.source) set.add(t.source);
    }
    return [...set].sort();
  }, [transfers]);

  // Derive unique fee types
  const allFeeTypes = useMemo(() => {
    const set = new Set<string>();
    for (const t of transfers) {
      if (t.fee_type) set.add(t.fee_type);
    }
    return [...set].sort();
  }, [transfers]);

  // Stats
  const stats = useMemo(() => {
    const withFee = transfers.filter((t) => t.fee_eur_m != null && t.fee_eur_m > 0);
    const totalValue = withFee.reduce((sum, t) => sum + (t.fee_eur_m ?? 0), 0);
    const avgFee = withFee.length > 0 ? totalValue / withFee.length : 0;
    return { total: transfers.length, totalValue, avgFee };
  }, [transfers]);

  const hasFilters = windowFilter || positionFilter || feeTypeFilter || sourceFilter;

  return (
    <div>
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-lg font-bold tracking-tight mb-0.5">Transfers</h1>
        <div className="flex items-center gap-3 text-[10px] font-data text-[var(--text-muted)]">
          {loading ? (
            <span>Loading...</span>
          ) : (
            <>
              <span>{stats.total} transfers</span>
              {stats.totalValue > 0 && (
                <span>
                  <span className="text-[var(--color-accent-technical)]">{"\u20AC"}{stats.totalValue.toFixed(0)}m</span> total
                </span>
              )}
              {stats.avgFee > 0 && (
                <span>
                  {"\u20AC"}{stats.avgFee.toFixed(1)}m avg
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Window pills */}
      {allWindows.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1 h-1 bg-[var(--border-bright)] shadow-[0_0_4px_var(--border-bright)]" />
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-[var(--text-muted)]">Window</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => updateParam("window", "")}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
              style={{
                background: windowFilter === "" ? "rgba(111,195,223,0.12)" : "var(--bg-surface)",
                color: windowFilter === "" ? "var(--border-bright)" : "var(--text-muted)",
                border: `1px solid ${windowFilter === "" ? "rgba(111,195,223,0.3)" : "var(--border-subtle)"}`,
              }}
            >
              All
            </button>
            {allWindows.map((w) => (
              <button
                key={w}
                onClick={() => updateParam("window", windowFilter === w ? "" : w)}
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
                style={{
                  background: windowFilter === w ? "rgba(111,195,223,0.12)" : "var(--bg-surface)",
                  color: windowFilter === w ? "var(--border-bright)" : "var(--text-muted)",
                  border: `1px solid ${windowFilter === w ? "rgba(111,195,223,0.3)" : "var(--border-subtle)"}`,
                }}
              >
                {windowLabel(w)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Position pills */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-1 h-1 bg-[var(--color-accent-technical)] shadow-[0_0_4px_var(--color-accent-technical)]" />
          <span className="text-[9px] font-bold uppercase tracking-[2px] text-[var(--text-muted)]">Position</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => updateParam("position", "")}
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
            style={{
              background: positionFilter === "" ? "rgba(232,197,71,0.12)" : "var(--bg-surface)",
              color: positionFilter === "" ? "var(--color-accent-technical)" : "var(--text-muted)",
              border: `1px solid ${positionFilter === "" ? "rgba(232,197,71,0.3)" : "var(--border-subtle)"}`,
            }}
          >
            All
          </button>
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => updateParam("position", positionFilter === pos ? "" : pos)}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
              style={{
                background: positionFilter === pos ? "rgba(232,197,71,0.12)" : "var(--bg-surface)",
                color: positionFilter === pos ? "var(--color-accent-technical)" : "var(--text-muted)",
                border: `1px solid ${positionFilter === pos ? "rgba(232,197,71,0.3)" : "var(--border-subtle)"}`,
              }}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Fee type + Source + Sort row */}
      <div className="flex flex-wrap gap-4 mb-3">
        {/* Fee type pills */}
        {allFeeTypes.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1 h-1 bg-[var(--color-accent-mental)] shadow-[0_0_4px_var(--color-accent-mental)]" />
              <span className="text-[9px] font-bold uppercase tracking-[2px] text-[var(--text-muted)]">Deal</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => updateParam("fee_type", "")}
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
                style={{
                  background: feeTypeFilter === "" ? "rgba(74,222,128,0.12)" : "var(--bg-surface)",
                  color: feeTypeFilter === "" ? "var(--color-accent-mental)" : "var(--text-muted)",
                  border: `1px solid ${feeTypeFilter === "" ? "rgba(74,222,128,0.3)" : "var(--border-subtle)"}`,
                }}
              >
                All
              </button>
              {allFeeTypes.map((ft) => (
                <button
                  key={ft}
                  onClick={() => updateParam("fee_type", feeTypeFilter === ft ? "" : ft)}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
                  style={{
                    background: feeTypeFilter === ft ? "rgba(74,222,128,0.12)" : "var(--bg-surface)",
                    color: feeTypeFilter === ft ? "var(--color-accent-mental)" : "var(--text-muted)",
                    border: `1px solid ${feeTypeFilter === ft ? "rgba(74,222,128,0.3)" : "var(--border-subtle)"}`,
                  }}
                >
                  {ft.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Source pills */}
        {allSources.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1 h-1 bg-[var(--color-accent-tactical)] shadow-[0_0_4px_var(--color-accent-tactical)]" />
              <span className="text-[9px] font-bold uppercase tracking-[2px] text-[var(--text-muted)]">Source</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => updateParam("source", "")}
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
                style={{
                  background: sourceFilter === "" ? "rgba(168,85,247,0.12)" : "var(--bg-surface)",
                  color: sourceFilter === "" ? "var(--color-accent-tactical)" : "var(--text-muted)",
                  border: `1px solid ${sourceFilter === "" ? "rgba(168,85,247,0.3)" : "var(--border-subtle)"}`,
                }}
              >
                All
              </button>
              {allSources.map((s) => (
                <button
                  key={s}
                  onClick={() => updateParam("source", sourceFilter === s ? "" : s)}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
                  style={{
                    background: sourceFilter === s ? "rgba(168,85,247,0.12)" : "var(--bg-surface)",
                    color: sourceFilter === s ? "var(--color-accent-tactical)" : "var(--text-muted)",
                    border: `1px solid ${sourceFilter === s ? "rgba(168,85,247,0.3)" : "var(--border-subtle)"}`,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sort + Clear */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateParam("sort", opt.key)}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
              style={{
                background: sortFilter === opt.key ? "rgba(111,195,223,0.12)" : "var(--bg-surface)",
                color: sortFilter === opt.key ? "var(--border-bright)" : "var(--text-muted)",
                border: `1px solid ${sortFilter === opt.key ? "rgba(111,195,223,0.3)" : "var(--border-subtle)"}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={() => router.push("/transfers")}
            className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 border border-[var(--border-subtle)]"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Transfer list */}
      {loading ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] py-12 text-center">
          <p className="text-xs text-[var(--text-muted)]">Loading transfers...</p>
        </div>
      ) : transfers.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center">
          <p className="text-xs text-[var(--text-muted)]">No transfers found.</p>
          {hasFilters && (
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Try adjusting your filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-0">
          {transfers.map((t) => (
            <TransferCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page Export ───────────────────────────────────────────────────────────────

export default function TransfersPage() {
  return (
    <Suspense fallback={<div className="text-[var(--text-muted)] text-sm p-4">Loading...</div>}>
      <TransfersContent />
    </Suspense>
  );
}
