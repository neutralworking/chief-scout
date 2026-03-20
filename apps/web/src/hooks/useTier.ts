"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { Tier } from "@/lib/stripe";

const TIER_RANK: Record<Tier, number> = { free: 0, scout: 1, pro: 2 };

export function useTier() {
  const { session, user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<Tier>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!session?.access_token) {
      setTier("free");
      setLoading(false);
      return;
    }

    fetch("/api/user/tier", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setTier(d.tier || "free"))
      .catch(() => setTier("free"))
      .finally(() => setLoading(false));
  }, [session?.access_token, authLoading]);

  return {
    tier,
    loading: loading || authLoading,
    isLoggedIn: !!user,
    hasTier: (required: Tier) => TIER_RANK[tier] >= TIER_RANK[required],
  };
}
