"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Tier = "free" | "scout" | "pro";

const TIERS = [
  {
    id: "free" as Tier,
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Get started with basic scouting tools",
    features: ["500 players", "Basic search", "Player profiles"],
    cta: "Current Plan",
  },
  {
    id: "scout" as Tier,
    name: "Scout",
    monthlyPrice: 9,
    yearlyPrice: 79,
    description: "Full scouting toolkit for serious analysts",
    features: [
      "Full database access",
      "Player archetypes",
      "Suitability scoring",
      "Squad builder",
    ],
    cta: "Upgrade to Scout",
    popular: true,
  },
  {
    id: "pro" as Tier,
    name: "Pro",
    monthlyPrice: 29,
    yearlyPrice: 249,
    description: "Everything you need for professional scouting",
    features: [
      "Everything in Scout",
      "API access",
      "CSV export",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
  },
];

function PricingContent() {
  const searchParams = useSearchParams();
  const [userTier, setUserTier] = useState<Tier>("free");
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    fetch("/api/user/tier")
      .then((r) => r.json())
      .then((d) => setUserTier(d.tier || "free"))
      .catch(() => {});
  }, []);

  async function handleCheckout(tierId: Tier) {
    setLoading(tierId);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: tierId === "scout"
            ? process.env.NEXT_PUBLIC_STRIPE_SCOUT_PRICE_ID
            : process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
          tier: tierId,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned");
        setLoading(null);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setLoading(null);
    }
  }

  const TIER_RANK: Record<Tier, number> = { free: 0, scout: 1, pro: 2 };

  return (
    <div className="px-6 py-10 max-w-[960px] mx-auto">
      {/* Success banner */}
      {success && (
        <div className="px-4 py-3 mb-6 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold">
          Payment successful! Your account has been upgraded.
        </div>
      )}

      {/* Canceled banner */}
      {canceled && (
        <div className="px-4 py-3 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold">
          Checkout was canceled. No charges were made.
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Pick your level
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md mx-auto">
          Free gets you started. Scout gets you serious. Pro gets you everything.
        </p>

        {/* Annual/Monthly toggle */}
        <div className="inline-flex items-center gap-1 mt-6 p-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all ${
              !annual
                ? "bg-[var(--color-accent-personality)]/15 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                : "text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-2 ${
              annual
                ? "bg-[var(--color-accent-personality)]/15 text-[var(--color-accent-personality)] border border-[var(--color-accent-personality)]/30"
                : "text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            Annual
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
              Save 25%
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TIERS.map((tier) => {
          const isCurrent = userTier === tier.id;
          const isDowngrade = TIER_RANK[userTier] > TIER_RANK[tier.id];
          const price = annual ? tier.yearlyPrice : tier.monthlyPrice;
          const period = annual ? "/yr" : "/mo";

          return (
            <div
              key={tier.id}
              className={`glass rounded-xl p-6 flex flex-col relative ${
                tier.popular
                  ? "border-2 border-[var(--color-accent-personality)] shadow-[0_0_30px_rgba(var(--color-accent-personality),0.1)]"
                  : ""
              }`}
            >
              {/* Popular badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--color-accent-personality)]/15 border border-[var(--color-accent-personality)]/30 text-[var(--color-accent-personality)] text-[10px] font-bold uppercase tracking-wider">
                  Recommended
                </div>
              )}

              {/* Tier name */}
              <h2
                className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                  tier.popular
                    ? "text-[var(--color-accent-personality)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {tier.name}
              </h2>

              {/* Description */}
              <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
                {tier.description}
              </p>

              {/* Price */}
              <div className="mb-5">
                <span
                  className={`text-3xl font-bold tracking-tight ${
                    tier.popular
                      ? "text-[var(--color-accent-personality)]"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {price === 0 ? "Free" : `\u00A3${price}`}
                </span>
                {price > 0 && (
                  <span className="text-sm text-[var(--text-muted)] ml-1">
                    {period}
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-accent-personality)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                onClick={() => {
                  if (!isCurrent && !isDowngrade && tier.id !== "free") {
                    handleCheckout(tier.id);
                  }
                }}
                disabled={isCurrent || isDowngrade || tier.id === "free" || loading !== null}
                className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
                  isCurrent
                    ? "bg-green-500/15 border border-green-500/30 text-green-400 cursor-default"
                    : tier.id === "free" || isDowngrade
                    ? "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-default"
                    : "bg-[var(--color-accent-personality)] text-[#06060c] hover:brightness-110 cursor-pointer"
                } ${loading !== null && loading !== tier.id ? "opacity-50" : ""}`}
              >
                {loading === tier.id
                  ? "Redirecting..."
                  : isCurrent
                  ? "Current Plan"
                  : isDowngrade
                  ? "Current Plan Includes This"
                  : tier.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-[var(--text-muted)]">Loading...</div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
