"use client";

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
      { label: "Stats", href: "/stats" },
      { label: "Free Agents", href: "/free-agents" },
      { label: "Compare", href: "/compare" },
      { label: "Legends", href: "/legends" },
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
    ],
  },
  {
    heading: "Admin",
    items: [
      { label: "Tactics", href: "/formations", stagingOnly: true },
      { label: "Scout Pad", href: "/scout-pad", stagingOnly: true },
      { label: "Editor", href: "/editor", stagingOnly: true },
      { label: "Review", href: "/review", stagingOnly: true },
      { label: "Network", href: "/network", stagingOnly: true },
      { label: "Admin", href: "/admin", stagingOnly: true },
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
