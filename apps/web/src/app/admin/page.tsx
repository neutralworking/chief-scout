"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { ScoutPadTab } from "@/components/admin/ScoutPadTab";
import { EditorTab } from "@/components/admin/EditorTab";
import { PersonalityTab } from "@/components/admin/PersonalityTab";
import { KCPreviewTab } from "@/components/admin/KCPreviewTab";
import { GradingTab } from "@/components/admin/GradingTab";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "grading", label: "Grading" },
  { id: "scout-pad", label: "Scout Pad" },
  { id: "editor", label: "Editor" },
  { id: "personality", label: "Personality" },
  { id: "kc-preview", label: "KC Cards" },
] as const;

type TabId = typeof TABS[number]["id"];

function AdminTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some(t => t.id === tabParam) ? tabParam! : "dashboard"
  );

  // Sync URL when tab changes
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== activeTab) {
      const url = activeTab === "dashboard" ? "/admin" : `/admin?tab=${activeTab}`;
      router.replace(url, { scroll: false });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold tracking-tight">Admin</h1>
      </div>

      {/* Tab bar — horizontally scrollable on mobile */}
      <div className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-1 px-1 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === tab.id
                ? "bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] border border-[var(--color-accent-tactical)]/30"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)] hover:border-[var(--border-subtle)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "grading" && <GradingTab />}
      {activeTab === "scout-pad" && <ScoutPadTab />}
      {activeTab === "editor" && <EditorTab />}
      {activeTab === "personality" && <PersonalityTab />}
      {activeTab === "kc-preview" && <KCPreviewTab />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[var(--text-muted)] border-t-[var(--color-accent-tactical)] rounded-full animate-spin" />
      </div>
    }>
      <AdminTabs />
    </Suspense>
  );
}
