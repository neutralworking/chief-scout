"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getFeatureFlags } from "@/lib/features";
import { isProduction } from "@/lib/env";
import { ThemeToggle } from "@/components/ThemeToggle";

const ALL_NAV_ITEMS = [
  { label: "Dashboard", href: "/", exact: true },
  { label: "Players", href: "/players" },
  { label: "Clubs", href: "/clubs" },
  { label: "Leagues", href: "/leagues" },
  { label: "Tactics", href: "/formations", stagingOnly: true },
  { label: "Fixtures", href: "/fixtures" },
  { label: "News Feed", href: "/news" },
  { label: "Free Agents", href: "/free-agents" },
  { label: "Compare", href: "/compare" },
  { label: "Gaffer", href: "/choices" },
  { label: "Network", href: "/network", stagingOnly: true },
  { label: "Scout Pad", href: "/scout-pad", stagingOnly: true },
  { label: "Review", href: "/review", stagingOnly: true },
  { label: "Editor", href: "/editor", stagingOnly: true },
  { label: "Admin", href: "/admin", stagingOnly: true },
];

const NAV_ITEMS = isProduction()
  ? ALL_NAV_ITEMS.filter((item) => !("stagingOnly" in item && item.stagingOnly))
  : ALL_NAV_ITEMS;

const POSITION_SHORTCUTS = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [shortlistsEnabled, setShortlistsEnabled] = useState(false);

  // Load feature flags from localStorage preferences
  useEffect(() => {
    try {
      const stored = localStorage.getItem("fc_preferences");
      if (stored) {
        const prefs = JSON.parse(stored);
        const flags = getFeatureFlags(prefs);
        setShortlistsEnabled(flags.shortlists);
      }
    } catch { /* ignore parse errors */ }
  }, []);

  return (
    <>
      {/* Sidebar (desktop only — mobile uses MobileTopNav) */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex-col z-50 hidden lg:flex"
      >
        {/* Logo + close button */}
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
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const exact = "exact" in item && item.exact;
            const active = exact
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

          {/* Position shortcuts */}
          <div className="mt-6 px-6">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
              By Position
            </p>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_SHORTCUTS.map((pos) => (
                <Link
                  key={pos}
                  href={`/players?position=${pos}`}
                  className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/80 transition-colors"
                >
                  {pos}
                </Link>
              ))}
            </div>
          </div>

          {/* Pursuit shortcuts — pro feature, requires shortlists enabled */}
          {shortlistsEnabled && (
            <div className="mt-4 px-6">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
                By Pursuit
              </p>
              <div className="flex flex-col gap-0.5">
                {["Priority", "Interested", "Scout Further", "Watch"].map(
                  (status) => (
                    <Link
                      key={status}
                      href={`/players?pursuit=${encodeURIComponent(status)}`}
                      className="text-xs px-2 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
                    >
                      {status}
                    </Link>
                  )
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Theme toggle */}
        <div className="px-4 py-2 border-t border-[var(--border-subtle)]">
          <ThemeToggle />
        </div>

        {/* Auth section */}
        <div className="p-4 border-t border-[var(--border-subtle)]">
          {authLoading ? (
            <div className="h-10" />
          ) : user ? (
            <Link
              href="/profile"
              className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-[var(--bg-elevated)]/50 transition-colors"
            >
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--accent-tactical)] flex items-center justify-center text-white text-xs font-bold">
                  {(user.user_metadata?.full_name ?? user.email ?? "?")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Scout"}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</div>
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-[var(--accent-tactical)] border border-[var(--accent-tactical)]/30 rounded-lg hover:bg-[var(--accent-tactical)]/10 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
