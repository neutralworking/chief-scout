"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cs_onboarding_profile_seen";

interface Tip {
  id: string;
  selector: string;
  title: string;
  body: string;
  position: "bottom" | "left";
}

const TIPS: Tip[] = [
  {
    id: "role-score",
    selector: "[data-onboarding='role-score']",
    title: "Role-Fit Score",
    body: "How well this player fits a tactical role, scored 0–100. Based on their attributes, not reputation.",
    position: "bottom",
  },
  {
    id: "radar",
    selector: "[data-onboarding='radar']",
    title: "Four-Pillar Radar",
    body: "Every attribute mapped to Technical, Tactical, Mental, and Physical. The shape shows the player at a glance.",
    position: "bottom",
  },
  {
    id: "personality",
    selector: "[data-onboarding='personality']",
    title: "Personality Type",
    body: "How they think, compete, and lead — 16 types that tell you if a player fits your dressing room, not just your pitch.",
    position: "bottom",
  },
];

export function ProfileOnboarding() {
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [positions, setPositions] = useState<
    Record<string, { top: number; left: number }>
  >({});

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Wait for the page to render fully
    const timer = setTimeout(() => {
      const found: Record<string, { top: number; left: number }> = {};
      for (const tip of TIPS) {
        const el = document.querySelector(tip.selector);
        if (el) {
          const rect = el.getBoundingClientRect();
          found[tip.id] = {
            top: rect.top + window.scrollY + rect.height / 2,
            left: rect.left + window.scrollX + rect.width / 2,
          };
        }
      }
      if (Object.keys(found).length > 0) {
        setPositions(found);
        setVisible(true);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Pulsing dots */}
      {TIPS.map((tip) => {
        const pos = positions[tip.id];
        if (!pos) return null;

        return (
          <button
            key={tip.id}
            onClick={() =>
              setActiveTip(activeTip === tip.id ? null : tip.id)
            }
            className="fixed z-50 group"
            style={{ top: pos.top - 8, left: pos.left - 8 }}
            aria-label={`Learn about ${tip.title}`}
          >
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-[var(--border-bright)] animate-ping opacity-30" />
            {/* Dot */}
            <span className="relative block w-4 h-4 rounded-full bg-[var(--border-bright)] border-2 border-[var(--bg-base)]" />
          </button>
        );
      })}

      {/* Active tooltip */}
      {activeTip && (() => {
        const tip = TIPS.find((t) => t.id === activeTip);
        const pos = positions[activeTip];
        if (!tip || !pos) return null;

        return (
          <div
            className="fixed z-[51] w-56 p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-lg"
            style={{
              top: pos.top + 16,
              left: Math.max(12, Math.min(pos.left - 112, window.innerWidth - 240)),
              borderRadius: "var(--radius)",
            }}
          >
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {tip.title}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
              {tip.body}
            </p>
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)]">
                {TIPS.findIndex((t) => t.id === activeTip) + 1}/{TIPS.length}
              </span>
              <button
                onClick={dismiss}
                className="text-[11px] font-medium text-[var(--border-bright)] hover:underline"
              >
                Got it
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
