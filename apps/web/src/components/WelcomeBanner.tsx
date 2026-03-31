"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "cs_onboarding_welcome_dismissed";

const PILLARS = [
  { label: "Technical", color: "var(--color-accent-technical)" },
  { label: "Tactical", color: "var(--color-accent-tactical)" },
  { label: "Mental", color: "var(--color-accent-mental)" },
  { label: "Physical", color: "var(--color-accent-physical)" },
];

export function WelcomeBanner() {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      dismiss();
      router.push(`/players?search=${encodeURIComponent(query.trim())}`);
    }
  }

  function handleQuickPlayer() {
    dismiss();
    router.push("/players/4"); // Mbappé
  }

  if (!visible) return null;

  return (
    <div className="card-vibrant p-4 sm:p-5 relative overflow-hidden">
      {/* Subtle gradient accent at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, #e91e8c, #ff6b35, #fbbf24)",
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold tracking-tight font-[family-name:var(--font-display)] uppercase">
            Welcome to Chief Scout
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed max-w-lg">
            We assess every player across four pillars — find out who fits your
            system, not just who&apos;s available.
          </p>

          {/* Pillar dots */}
          <div className="flex items-center gap-3 mt-2">
            {PILLARS.map((p) => (
              <div key={p.label} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: p.color }}
                >
                  {p.label}
                </span>
              </div>
            ))}
          </div>

          {/* Search + quick link */}
          <div className="flex items-center gap-2 mt-3">
            <form onSubmit={handleSearch} className="flex-1 max-w-xs">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a player you know..."
                className="w-full text-xs px-3 py-1.5 bg-[var(--bg-pit)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-bright)] transition-colors"
                style={{ borderRadius: "var(--radius-sm)" }}
              />
            </form>
            <button
              onClick={handleQuickPlayer}
              className="text-[11px] font-medium px-2.5 py-1.5 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-bright)] transition-colors shrink-0"
              style={{ borderRadius: "var(--radius-sm)" }}
            >
              Show me Mbappé
            </button>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 -m-1"
          aria-label="Dismiss welcome banner"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
