"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isProduction } from "@/lib/env";

const ALL_NAV_ITEMS = [
  // Scouting
  { label: "Home", href: "/", exact: true },
  { label: "Players", href: "/players" },
  { label: "Stats", href: "/stats" },
  { label: "Free Agents", href: "/free-agents" },
  { label: "Compare", href: "/compare" },
  { label: "Legends", href: "/legends" },
  // Browse
  { label: "Clubs", href: "/clubs" },
  { label: "Leagues", href: "/leagues" },
  { label: "Fixtures", href: "/fixtures" },
  { label: "News", href: "/news" },
  // Games
  { label: "Gaffer", href: "/choices" },
  { label: "Kickoff Clash", href: "/kc-preview", stagingOnly: true },
  // Admin (staging only)
  { label: "Admin", href: "/admin", stagingOnly: true },
  { label: "Tactics", href: "/formations", stagingOnly: true },
];

const NAV_ITEMS = isProduction()
  ? ALL_NAV_ITEMS.filter((item) => !item.stagingOnly)
  : ALL_NAV_ITEMS;

export function MobileTopNav() {
  const pathname = usePathname();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 lg:hidden bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
      {/* Top row: logo */}
      <div className="flex items-center justify-between px-4 h-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
            CHIEF SCOUT
          </span>
        </Link>
      </div>
      {/* Scrollable nav row */}
      <nav className="flex overflow-x-auto no-scrollbar px-2 pb-2 gap-1">
        {NAV_ITEMS.map((item) => {
          const exact = item.exact;
          const active = exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                active
                  ? "bg-[var(--text-primary)] text-[var(--bg-surface)]"
                  : "text-[var(--text-secondary)] bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
