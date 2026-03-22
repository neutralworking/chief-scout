"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { isProduction } from "@/lib/env";
import { ThemeToggle } from "@/components/ThemeToggle";

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
      { label: "Players", href: "/players" },
      { label: "Network", href: "/network", stagingOnly: true },
      { label: "Stats", href: "/stats" },
      { label: "Free Agency", href: "/free-agents" },
      { label: "Compare", href: "/compare" },
      { label: "Legends", href: "/legends" },
    ],
  },
  {
    heading: "Browse",
    items: [
      { label: "Clubs", href: "/clubs" },
      { label: "Leagues", href: "/leagues" },
      { label: "Tactics", href: "/tactics" },
      { label: "Fixtures", href: "/fixtures" },
      { label: "News", href: "/news" },
    ],
  },
  {
    heading: "Games",
    items: [
      { label: "Gaffer", href: "/choices" },
      { label: "Kickoff Clash", href: "/kickoff-clash", stagingOnly: true },
      { label: "On The Plane", href: "/on-the-plane", stagingOnly: true },
    ],
  },
  {
    heading: "Admin",
    items: [
      { label: "Admin", href: "/admin", stagingOnly: true },
      { label: "Editor", href: "/editor", stagingOnly: true },
    ],
  },
];

const NAV_CATEGORIES: NavCategory[] = isProduction()
  ? ALL_NAV_CATEGORIES
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => !item.stagingOnly),
      }))
      .filter((cat) => cat.items.length > 0)
  : ALL_NAV_CATEGORIES;

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("network_admin") === "1");
  }, []);

  function handlePin() {
    if (pin === "0.123456789") {
      sessionStorage.setItem("network_admin", "1");
      setIsAdmin(true);
      setShowPin(false);
      setPin("");
    }
  }

  return (
    <>
      {/* Sidebar (desktop only — mobile uses MobileTopNav) */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex-col z-50 hidden lg:flex"
      >
        {/* Logo */}
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <Link href="/" className="block">
            <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              CHIEF SCOUT
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 tracking-widest uppercase">
              Intelligence Platform
            </p>
          </Link>
        </div>

        {/* Main nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_CATEGORIES.map((cat) => (
            <div key={cat.heading}>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] px-6 pt-4 pb-1">
                {cat.heading}
              </div>
              {cat.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-6 py-2.5 text-sm transition-colors ${
                      active
                        ? "text-[var(--text-primary)] bg-[var(--bg-elevated)] border-r-2 border-[var(--accent-personality)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Theme toggle */}
        <div className="px-4 py-2 border-t border-[var(--border-subtle)]">
          <ThemeToggle />
        </div>

        {/* Admin login */}
        <div className="p-4 border-t border-[var(--border-subtle)]">
          {isAdmin ? (
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-accent-tactical)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Admin active
            </div>
          ) : showPin ? (
            <div className="flex gap-1">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePin(); }}
                placeholder="PIN"
                className="flex-1 px-2 py-1.5 text-xs rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent-tactical)]"
                autoFocus
              />
              <button onClick={handlePin} className="px-2.5 py-1.5 text-xs font-medium text-[var(--color-accent-tactical)] hover:bg-[var(--bg-elevated)] rounded transition-colors">Go</button>
            </div>
          ) : (
            <button
              onClick={() => setShowPin(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-lg hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
            >
              Admin Login
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
