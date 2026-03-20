"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isProduction } from "@/lib/env";
import { ThemeToggle } from "@/components/ThemeToggle";

/* ── Nav data (mirrors Sidebar grouping) ─────────────────────────── */

interface NavItem {
  label: string;
  href: string;
  exact?: boolean;
  stagingOnly?: boolean;
}

interface NavCategory {
  heading: string;
  items: NavItem[];
}

const ALL_NAV_CATEGORIES: NavCategory[] = [
  {
    heading: "Scouting",
    items: [
      { label: "Dashboard", href: "/", exact: true },
      { label: "Stats", href: "/stats" },
      { label: "Free Agents", href: "/free-agents" },
      { label: "Compare", href: "/compare" },
      { label: "Legends", href: "/legends" },
      { label: "Shortlists", href: "/shortlists" },
    ],
  },
  {
    heading: "Browse",
    items: [
      { label: "Clubs", href: "/clubs" },
      { label: "Leagues", href: "/leagues" },
      { label: "Fixtures", href: "/fixtures" },
      { label: "News", href: "/news" },
    ],
  },
  {
    heading: "Games",
    items: [
      { label: "Gaffer", href: "/choices" },
      { label: "Kickoff Clash", href: "/kc-preview", stagingOnly: true },
    ],
  },
  {
    heading: "Admin",
    items: [
      { label: "Tactics", href: "/formations", stagingOnly: true },
      { label: "Network", href: "/network", stagingOnly: true },
    ],
  },
];

const SHEET_CATEGORIES: NavCategory[] = isProduction()
  ? ALL_NAV_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => !item.stagingOnly),
    })).filter((cat) => cat.items.length > 0)
  : ALL_NAV_CATEGORIES;

/* ── Icons (inline SVG, 24x24 viewBox) ───────────────────────────── */

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconPlayers({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconAdmin({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconMore({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/* ── Primary tabs ────────────────────────────────────────────────── */

const PRIMARY_TABS: ReadonlyArray<{
  label: string;
  href: string;
  exact?: boolean;
  stagingOnly?: boolean;
  Icon: (props: { active: boolean }) => React.JSX.Element;
}> = [
  { label: "Home", href: "/", exact: true, Icon: IconHome },
  { label: "Players", href: "/players", Icon: IconPlayers },
  { label: "Admin", href: "/admin", stagingOnly: true, Icon: IconAdmin },
];

/* ── Component ───────────────────────────────────────────────────── */

export function MobileBottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const prod = isProduction();

  const tabs = prod
    ? PRIMARY_TABS.filter((t) => !("stagingOnly" in t && t.stagingOnly))
    : PRIMARY_TABS;

  // Animate open/close
  const openSheet = useCallback(() => {
    setSheetOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetVisible(true));
    });
  }, []);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => setSheetOpen(false), 200);
  }, []);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname?.startsWith(href + "/");
  }

  // Check if any sheet link is active (to highlight More tab)
  const sheetLinkActive = SHEET_CATEGORIES.some((cat) =>
    cat.items.some((item) => isActive(item.href, item.exact))
  );

  return (
    <>
      {/* Bottom tab bar */}
      <div className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="flex items-center justify-around bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]" style={{ height: 56 }}>
          {tabs.map((tab) => {
            const active = isActive(tab.href, tab.exact);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="mobile-tab-btn flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
                style={{ color: active ? "var(--color-accent-tactical)" : "var(--text-muted)" }}
                onClick={() => sheetOpen && closeSheet()}
              >
                <tab.Icon active={active} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={sheetOpen ? closeSheet : openSheet}
            className="mobile-tab-btn flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
            style={{ color: sheetOpen || sheetLinkActive ? "var(--color-accent-tactical)" : "var(--text-muted)" }}
          >
            <IconMore active={sheetOpen || sheetLinkActive} />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>

        {/* Safe area spacer */}
        <div className="bg-[var(--bg-surface)]" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>

      {/* Bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: "rgba(0,0,0,0.6)",
              opacity: sheetVisible ? 1 : 0,
            }}
            onClick={closeSheet}
          />

          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] rounded-t-2xl transition-transform duration-300 ease-out"
            style={{
              maxHeight: "70vh",
              overflowY: "auto",
              transform: sheetVisible ? "translateY(0)" : "translateY(100%)",
              paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px) + 8px)",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--text-muted)] opacity-40" />
            </div>

            {/* Grouped nav */}
            <nav className="px-6 pb-4">
              {SHEET_CATEGORIES.map((cat) => (
                <div key={cat.heading} className="mt-4 first:mt-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] pb-2">
                    {cat.heading}
                  </div>
                  <div className="flex flex-wrap gap-x-1 gap-y-1">
                    {cat.items.map((item) => {
                      const active = isActive(item.href, item.exact);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeSheet}
                          className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                          style={{
                            color: active ? "var(--color-accent-tactical)" : "var(--text-secondary)",
                            background: active ? "var(--bg-elevated)" : "transparent",
                          }}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Footer: theme toggle */}
              <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] border-opacity-30">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
