"use client";

import Link from "next/link";
import { useTier } from "@/hooks/useTier";

interface UpgradeCTAProps {
  /** Contextual message shown above the CTA */
  message: string;
  /** Optional sub-message for extra context */
  detail?: string;
  /** Visual variant */
  variant?: "inline" | "card";
}

/**
 * Contextual upgrade prompt for free-tier users.
 * Hidden if user already has Scout or above.
 */
export function UpgradeCTA({
  message,
  detail,
  variant = "card",
}: UpgradeCTAProps) {
  const { hasTier, loading } = useTier();

  if (loading || hasTier("scout")) return null;

  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center gap-3 py-2">
        <span className="text-xs text-[var(--text-muted)]">{message}</span>
        <Link
          href="/pricing"
          className="px-3 py-1 bg-[var(--color-accent-personality)]/15 border border-[var(--color-accent-personality)]/30 text-[var(--color-accent-personality)] rounded-md text-[10px] font-semibold hover:bg-[var(--color-accent-personality)]/25 transition-colors"
        >
          See Plans
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-xl px-5 py-4 text-center bg-[var(--bg-surface)] border border-[var(--color-accent-personality)]/20">
      <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
        {message}
      </p>
      {detail && (
        <p className="text-xs text-[var(--text-secondary)] mb-3">{detail}</p>
      )}
      <Link
        href="/pricing"
        className="inline-block px-5 py-2 bg-[var(--color-accent-personality)] text-[#06060c] rounded-lg text-xs font-semibold hover:brightness-110 transition-all"
      >
        Upgrade to Scout
      </Link>
    </div>
  );
}
