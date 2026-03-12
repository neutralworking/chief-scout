"use client";

import { useState } from "react";
import { AllTimeXI } from "./AllTimeXI";
import { ChoicesGame } from "./ChoicesGame";

interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

const TABS = [
  { id: "xi", label: "All-Time XI" },
  { id: "trivia", label: "Choices" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function ChoicesShell({ categories }: { categories: Category[] }) {
  const [tab, setTab] = useState<Tab>("xi");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-1 mb-6">
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
      {tab === "xi" && <AllTimeXI />}
      {tab === "trivia" && <ChoicesGame categories={categories} />}
    </div>
  );
}
