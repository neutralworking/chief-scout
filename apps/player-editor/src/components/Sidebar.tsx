"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    exact: true,
  },
  {
    label: "Players",
    href: "/players",
  },
  {
    label: "Formations",
    href: "/formations",
  },
  {
    label: "News Feed",
    href: "/news",
  },
];

const POSITION_SHORTCUTS = [
  "GK",
  "CD",
  "WD",
  "DM",
  "CM",
  "WM",
  "AM",
  "WF",
  "CF",
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-bg-surface border-r border-border-subtle flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-border-subtle">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold tracking-tight text-text-primary">
            CHIEF SCOUT
          </h1>
          <p className="text-xs text-text-secondary mt-0.5 tracking-widest uppercase">
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
                  ? "text-text-primary bg-bg-elevated border-r-2 border-accent-personality"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Position shortcuts */}
        <div className="mt-6 px-6">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-text-muted mb-2">
            By Position
          </p>
          <div className="flex flex-wrap gap-1.5">
            {POSITION_SHORTCUTS.map((pos) => (
              <Link
                key={pos}
                href={`/players?position=${pos}`}
                className="text-[11px] px-2 py-0.5 rounded bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 transition-colors"
              >
                {pos}
              </Link>
            ))}
          </div>
        </div>

        {/* Pursuit shortcuts */}
        <div className="mt-4 px-6">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-text-muted mb-2">
            By Pursuit
          </p>
          <div className="flex flex-col gap-0.5">
            {["Priority", "Interested", "Scout Further", "Watch"].map(
              (status) => (
                <Link
                  key={status}
                  href={`/players?pursuit=${encodeURIComponent(status)}`}
                  className="text-xs px-2 py-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50 transition-colors"
                >
                  {status}
                </Link>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border-subtle">
        <p className="text-[10px] text-text-muted">
          23 profiles · Last updated today
        </p>
      </div>
    </aside>
  );
}
