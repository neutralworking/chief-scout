"use client";

import { useState, useEffect } from "react";

const THEMES = [
  { key: "default", label: "Glass" },
  { key: "high-contrast", label: "HC" },
] as const;

export function ThemeToggle() {
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    const stored = localStorage.getItem("cs_theme");
    if (stored === "high-contrast") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  function toggle() {
    const next = theme === "default" ? "high-contrast" : "default";
    setTheme(next);
    if (next === "default") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("cs_theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("cs_theme", next);
    }
  }

  const current = THEMES.find((t) => t.key === theme) ?? THEMES[0];

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
      title={`Theme: ${current.label}`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125V4.5M6.75 21h10.5A2.25 2.25 0 0 0 19.5 18.75v-4.5a2.25 2.25 0 0 0-2.25-2.25h-.063M6.75 21l3-3m1.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v2.25" />
      </svg>
      <span>{current.label}</span>
    </button>
  );
}
