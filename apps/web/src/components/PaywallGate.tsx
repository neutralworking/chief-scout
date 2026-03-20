"use client";

import Link from "next/link";
import { useTier } from "@/hooks/useTier";
import type { Tier } from "@/lib/stripe";

interface PaywallGateProps {
  required: Tier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PaywallGate({ required, children, fallback }: PaywallGateProps) {
  const { hasTier, isLoggedIn, loading } = useTier();

  if (loading) return null;

  if (hasTier(required)) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
      <div className="text-3xl">🔒</div>
      <h3 className="text-lg font-bold text-[var(--text-primary)]">
        {required === "scout" ? "Scout" : "Pro"} feature
      </h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm">
        {!isLoggedIn
          ? "Sign in to access this feature."
          : `Upgrade to ${required === "scout" ? "Scout" : "Pro"} to unlock this.`}
      </p>
      <Link
        href={isLoggedIn ? "/pricing" : "/login"}
        className="px-6 py-2.5 bg-[var(--color-accent-personality)] text-[#06060c] rounded-lg text-sm font-semibold hover:brightness-110 transition-all"
      >
        {isLoggedIn ? "See Plans" : "Sign In"}
      </Link>
    </div>
  );
}
