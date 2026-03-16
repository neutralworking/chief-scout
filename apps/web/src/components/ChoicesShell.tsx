"use client";

import { Component, useState } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AllTimeXI } from "./AllTimeXI";
import { ChoicesGame } from "./ChoicesGame";

interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

/* ── Error boundary to prevent full-page crash ─────────────────────── */
class ChoicesErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Gaffer error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="text-center py-12">
          <div className="text-2xl mb-3">Something went wrong</div>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-[var(--accent-tactical)] text-white rounded-lg text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TABS = [
  { id: "xi", label: "Dream XI" },
  { id: "trivia", label: "Quick Fire" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function ChoicesShell({ categories }: { categories: Category[] }) {
  const [tab, setTab] = useState<Tab>("xi");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-1 mb-3 sm:mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.id
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <ChoicesErrorBoundary>
        {tab === "xi" && <AllTimeXI />}
        {tab === "trivia" && <ChoicesGame categories={categories} />}
      </ChoicesErrorBoundary>
    </div>
  );
}
