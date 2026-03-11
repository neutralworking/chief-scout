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
    <div
      style={{
        padding: "40px 24px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      {/* Success/Cancel banners */}
      {success && (
        <div
          style={{
            padding: "12px 18px",
            marginBottom: 24,
            borderRadius: 10,
            background: "var(--green-dim)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "var(--green)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          Payment successful! Your account has been upgraded.
        </div>
      )}
      {canceled && (
        <div
          style={{
            padding: "12px 18px",
            marginBottom: 24,
            borderRadius: 10,
            background: "var(--amber-dim)",
            border: "1px solid rgba(245,158,11,0.3)",
            color: "var(--amber)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          Checkout was canceled. No charges were made.
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 900,
            letterSpacing: "0.08em",
            marginBottom: 8,
            fontFamily: "var(--font-orbitron), monospace",
            color: "var(--accent)",
            textShadow: "0 0 20px rgba(0,240,255,0.4), 0 0 40px rgba(0,240,255,0.15)",
            textTransform: "uppercase",
          }}
        >
          Select Protocol
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.8rem", fontFamily: "var(--font-mono), monospace" }}>
          &gt; upgrade your scouting clearance level
        </p>

        {/* Annual toggle */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
            padding: "4px 6px",
            borderRadius: 2,
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
          }}
        >
          <button
            onClick={() => setAnnual(false)}
            style={{
              padding: "6px 16px",
              borderRadius: 2,
              border: !annual ? "1px solid var(--accent)" : "1px solid transparent",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              background: !annual ? "var(--accent-dim)" : "transparent",
              color: !annual ? "var(--accent)" : "var(--text3)",
              transition: "all 0.15s",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            style={{
              padding: "6px 16px",
              borderRadius: 2,
              border: annual ? "1px solid var(--accent)" : "1px solid transparent",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              background: annual ? "var(--accent-dim)" : "transparent",
              color: annual ? "var(--accent)" : "var(--text3)",
              transition: "all 0.15s",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            Annual
            <span
              style={{
                marginLeft: 6,
                fontSize: "0.65rem",
                padding: "1px 6px",
                borderRadius: 2,
                background: "var(--green-dim)",
                color: "var(--green)",
                fontWeight: 700,
                textShadow: "0 0 8px rgba(57,255,20,0.4)",
              }}
            >
              Save 25%
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        {TIERS.map((tier) => {
          const isCurrent = userTier === tier.id;
          const isDowngrade = TIER_RANK[userTier] > TIER_RANK[tier.id];
          const price = annual ? tier.yearlyPrice : tier.monthlyPrice;
          const period = annual ? "/yr" : "/mo";

          return (
            <div
              key={tier.id}
              style={{
                padding: 24,
                borderRadius: 2,
                background: "var(--surface)",
                border: tier.popular
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: tier.popular
                  ? "0 0 30px rgba(0,240,255,0.15), inset 0 0 30px rgba(0,240,255,0.03)"
                  : "none",
              }}
            >
              {tier.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "3px 12px",
                    borderRadius: 2,
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-orbitron), monospace",
                    border: "1px solid var(--accent)",
                    textShadow: "0 0 10px rgba(0,240,255,0.5)",
                  }}
                >
                  Recommended
                </div>
              )}

              <h2
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  marginBottom: 4,
                  fontFamily: "var(--font-orbitron), monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: tier.popular ? "var(--accent)" : "var(--text)",
                }}
              >
                {tier.name}
              </h2>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text2)",
                  marginBottom: 16,
                  lineHeight: 1.4,
                }}
              >
                {tier.description}
              </p>

              <div style={{ marginBottom: 20 }}>
                <span
                  style={{
                    fontSize: "2rem",
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    fontFamily: "var(--font-orbitron), monospace",
                    color: tier.popular ? "var(--accent)" : "var(--text)",
                    textShadow: tier.popular ? "0 0 15px rgba(0,240,255,0.3)" : "none",
                  }}
                >
                  {price === 0 ? "Free" : `\u00A3${price}`}
                </span>
                {price > 0 && (
                  <span
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--text3)",
                      marginLeft: 4,
                    }}
                  >
                    {period}
                  </span>
                )}
              </div>

              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  flex: 1,
                }}
              >
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "0.8rem",
                      color: "var(--text2)",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  if (!isCurrent && !isDowngrade && tier.id !== "free") {
                    handleCheckout(tier.id);
                  }
                }}
                disabled={isCurrent || isDowngrade || tier.id === "free" || loading !== null}
                style={{
                  width: "100%",
                  height: 42,
                  borderRadius: 2,
                  border: isCurrent
                    ? "1px solid var(--green)"
                    : "1px solid var(--accent)",
                  background: isCurrent
                    ? "var(--green-dim)"
                    : tier.id === "free" || isDowngrade
                    ? "var(--surface2)"
                    : "var(--accent-dim)",
                  color: isCurrent
                    ? "var(--green)"
                    : tier.id === "free" || isDowngrade
                    ? "var(--text3)"
                    : "var(--accent)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-orbitron), monospace",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  boxShadow: !isCurrent && !isDowngrade && tier.id !== "free" ? "0 0 15px rgba(0,240,255,0.15)" : "none",
                  cursor:
                    isCurrent || isDowngrade || tier.id === "free"
                      ? "default"
                      : "pointer",
                  opacity:
                    loading !== null && loading !== tier.id ? 0.5 : 1,
                  transition: "all 0.15s",
                }}
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

      {/* Responsive override for mobile */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
            max-width: 380px;
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, color: "var(--text3)" }}>Loading...</div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
