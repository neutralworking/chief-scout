"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import TransfersTable, { Transfer } from "@/components/TransfersTable";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

const WINDOW_TABS = [
  { key: "", label: "All Windows" },
  { key: "2026_jan", label: "Jan 2026" },
  { key: "2025_summer", label: "Summer 2025" },
  { key: "2025_jan", label: "Jan 2025" },
] as const;

const TYPE_PILLS = [
  { key: "", label: "All" },
  { key: "permanent", label: "Permanent" },
  { key: "loan", label: "Loans" },
  { key: "free", label: "Free" },
  { key: "pre_agreed", label: "Pre-agreed" },
] as const;

const FEE_TIERS = [
  { key: "", label: "Any Fee" },
  { key: "50", label: "€50m+" },
  { key: "30", label: "€30m+" },
  { key: "10", label: "€10m+" },
  { key: "loans", label: "Loans Only" },
  { key: "free", label: "Free Only" },
] as const;

function TransfersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const window = searchParams.get("window") ?? "";
  const feeType = searchParams.get("fee_type") ?? "";
  const position = searchParams.get("position") ?? "";
  const feeTier = searchParams.get("fee_tier") ?? "";
  const sort = searchParams.get("sort") ?? "date";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/transfers?${params.toString()}`);
    },
    [router, searchParams]
  );

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (window) params.set("window", window);
    if (position) params.set("position", position);
    if (sort) params.set("sort", sort);

    // Fee type from pills
    if (feeType) params.set("fee_type", feeType);

    // Fee tier overrides
    if (feeTier === "loans") {
      params.set("fee_type", "loan");
    } else if (feeTier === "free") {
      params.set("fee_type", "free");
    } else if (feeTier) {
      params.set("fee_min", feeTier);
    }

    return `/api/transfers?${params}`;
  }, [window, feeType, position, feeTier, sort]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl());
        if (!res.ok) {
          setError(`Failed: ${res.statusText}`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setTransfers(data.transfers ?? []);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  const totalFee = transfers
    .filter((t) => t.fee_eur_m != null && t.fee_eur_m > 0)
    .reduce((sum, t) => sum + (t.fee_eur_m ?? 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight mb-0.5">
          Recent Transfers
        </h1>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {loading
            ? "Loading..."
            : `${transfers.length} transfers`}
          {!loading && totalFee > 0 && ` · €${totalFee.toFixed(0)}m total`}
        </p>
      </div>

      {/* Window tabs */}
      <div className="flex gap-1 mb-3">
        {WINDOW_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => updateParam("window", t.key)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              window === t.key
                ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Type pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {TYPE_PILLS.map((pill) => (
          <button
            key={pill.key}
            onClick={() => updateParam("fee_type", feeType === pill.key ? "" : pill.key)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
              feeType === pill.key
                ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Position pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => updateParam("position", "")}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
            !position
              ? "bg-[var(--color-accent-technical)]/20 text-[var(--color-accent-technical)] border border-[var(--color-accent-technical)]/30"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
          }`}
        >
          All Pos
        </button>
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() =>
              updateParam("position", position === pos ? "" : pos)
            }
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
              position === pos
                ? "bg-[var(--color-accent-technical)]/20 text-[var(--color-accent-technical)] border border-[var(--color-accent-technical)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Sort + Fee tier */}
      <div className="glass rounded-xl p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
        >
          <option value="date">Sort: Date</option>
          <option value="fee">Sort: Fee</option>
          <option value="name">Sort: Name</option>
        </select>
        <select
          value={feeTier}
          onChange={(e) => updateParam("fee_tier", e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
        >
          {FEE_TIERS.map((tier) => (
            <option key={tier.key} value={tier.key}>
              {tier.label}
            </option>
          ))}
        </select>
        {(position || feeType || window || feeTier) && (
          <button
            onClick={() => router.push("/transfers")}
            className="px-3 py-1.5 rounded border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Table */}
      <TransfersTable transfers={transfers} loading={loading} />

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-4 mt-4">
          <p className="text-sm text-[var(--color-sentiment-negative)]">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TransfersPage() {
  return (
    <Suspense
      fallback={
        <div className="text-[var(--text-muted)] text-sm">Loading...</div>
      }
    >
      <TransfersContent />
    </Suspense>
  );
}
