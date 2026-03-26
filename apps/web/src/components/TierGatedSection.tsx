"use client";

import { useTier } from "@/hooks/useTier";
import { UpgradeCTA } from "@/components/UpgradeCTA";
import type { Tier } from "@/lib/stripe";

interface TierGatedSectionProps {
  required: Tier;
  children: React.ReactNode;
  /** What to show free users instead of the content */
  message?: string;
  detail?: string;
}

/**
 * Client-side tier gate for use inside server components.
 * Shows children to users with sufficient tier, upgrade CTA otherwise.
 * Unlike PaywallGate (full-page block), this gates individual sections.
 */
export function TierGatedSection({
  required,
  children,
  message = "Unlock full scouting intelligence",
  detail = "Upgrade to see radar, personality, attributes, and more.",
}: TierGatedSectionProps) {
  const { hasTier, loading } = useTier();

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 py-8">
        <div className="h-4 bg-[var(--bg-surface)] rounded w-3/4 mx-auto" />
        <div className="h-4 bg-[var(--bg-surface)] rounded w-1/2 mx-auto" />
      </div>
    );
  }

  if (hasTier(required)) {
    return <>{children}</>;
  }

  return <UpgradeCTA message={message} detail={detail} />;
}
