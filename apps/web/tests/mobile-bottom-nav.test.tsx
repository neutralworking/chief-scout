/**
 * Tests for MobileBottomNav component.
 *
 * Covers: tab rendering, active states, More sheet open/close, grouped nav,
 * production filtering, and sheet link navigation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock next/navigation
const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock next/link — render as plain anchor
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock isProduction — default staging
const { mockIsProductionRef } = vi.hoisted(() => ({
  mockIsProductionRef: { value: false },
}));
vi.mock("@/lib/env", () => ({
  isProduction: () => mockIsProductionRef.value,
}));

// Mock ThemeToggle
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme</div>,
}));

// Import AFTER mocks
import { MobileBottomNav } from "@/components/MobileBottomNav";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockIsProductionRef.value = false;
  mockPathname.mockReturnValue("/");
});

/** Helper: find a tab bar link by its href */
function getTabLink(container: HTMLElement, href: string) {
  // Tab links are direct children of the 56px bar div
  const bar = container.querySelector('[style="height: 56px;"]');
  return bar?.querySelector(`a[href="${href}"]`) as HTMLElement | null;
}

/** Helper: find the More button in the tab bar */
function getMoreButton(container: HTMLElement) {
  const bar = container.querySelector('[style="height: 56px;"]');
  return bar?.querySelector("button") as HTMLElement | null;
}

describe("MobileBottomNav", () => {
  // ── Happy path ─────────────────────────────────────────────────

  describe("tab bar rendering", () => {
    it("renders Home, Players, Admin, More tabs in staging", () => {
      const { container } = render(<MobileBottomNav />);
      expect(getTabLink(container, "/")).not.toBeNull();
      expect(getTabLink(container, "/players")).not.toBeNull();
      expect(getTabLink(container, "/admin")).not.toBeNull();
      expect(getMoreButton(container)).not.toBeNull();
      // Check labels
      expect(getTabLink(container, "/")!.textContent).toContain("Home");
      expect(getTabLink(container, "/players")!.textContent).toContain("Players");
      expect(getTabLink(container, "/admin")!.textContent).toContain("Admin");
      expect(getMoreButton(container)!.textContent).toContain("More");
    });

    it("highlights Home tab when on /", () => {
      mockPathname.mockReturnValue("/");
      const { container } = render(<MobileBottomNav />);
      const homeTab = getTabLink(container, "/");
      expect(homeTab).toHaveStyle({ color: "var(--color-accent-tactical)" });
    });

    it("highlights Players tab when on /players", () => {
      mockPathname.mockReturnValue("/players");
      const { container } = render(<MobileBottomNav />);
      const playersTab = getTabLink(container, "/players");
      expect(playersTab).toHaveStyle({ color: "var(--color-accent-tactical)" });
    });

    it("highlights Players tab on nested route /players/123", () => {
      mockPathname.mockReturnValue("/players/123");
      const { container } = render(<MobileBottomNav />);
      const playersTab = getTabLink(container, "/players");
      expect(playersTab).toHaveStyle({ color: "var(--color-accent-tactical)" });
    });

    it("highlights Admin tab when on /admin", () => {
      mockPathname.mockReturnValue("/admin");
      const { container } = render(<MobileBottomNav />);
      const adminTab = getTabLink(container, "/admin");
      expect(adminTab).toHaveStyle({ color: "var(--color-accent-tactical)" });
    });
  });

  // ── More sheet ─────────────────────────────────────────────────

  describe("More sheet", () => {
    it("opens sheet when More is tapped", () => {
      const { container } = render(<MobileBottomNav />);
      const moreBtn = getMoreButton(container)!;
      fireEvent.click(moreBtn);
      // Sheet should show grouped nav categories
      expect(screen.getByText("Scouting")).toBeInTheDocument();
      expect(screen.getByText("Browse")).toBeInTheDocument();
      expect(screen.getByText("Games")).toBeInTheDocument();
    });

    it("shows nav links inside sheet", () => {
      const { container } = render(<MobileBottomNav />);
      fireEvent.click(getMoreButton(container)!);
      expect(screen.getByText("Free Agents")).toBeInTheDocument();
      expect(screen.getByText("Clubs")).toBeInTheDocument();
      expect(screen.getByText("Leagues")).toBeInTheDocument();
      expect(screen.getByText("News")).toBeInTheDocument();
      expect(screen.getByText("Gaffer")).toBeInTheDocument();
    });

    it("shows theme toggle in sheet", () => {
      const { container } = render(<MobileBottomNav />);
      fireEvent.click(getMoreButton(container)!);
      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────

  describe("edge cases", () => {
    it("highlights More tab when a sheet-only route is active", () => {
      mockPathname.mockReturnValue("/clubs");
      const { container } = render(<MobileBottomNav />);
      const moreBtn = getMoreButton(container)!;
      expect(moreBtn).toHaveStyle({ color: "var(--color-accent-tactical)" });
    });

    it("does not highlight Home when on /players (exact match)", () => {
      mockPathname.mockReturnValue("/players");
      const { container } = render(<MobileBottomNav />);
      const homeTab = getTabLink(container, "/");
      expect(homeTab).toHaveStyle({ color: "var(--text-muted)" });
    });

    it("shows staging-only items in sheet on staging", () => {
      mockIsProductionRef.value = false;
      const { container } = render(<MobileBottomNav />);
      fireEvent.click(getMoreButton(container)!);
      expect(screen.getByText("Tactics")).toBeInTheDocument();
    });

    it("sheet links have correct hrefs", () => {
      const { container } = render(<MobileBottomNav />);
      fireEvent.click(getMoreButton(container)!);
      const clubsLink = screen.getByText("Clubs").closest("a");
      expect(clubsLink).toHaveAttribute("href", "/clubs");
      const newsLink = screen.getByText("News").closest("a");
      expect(newsLink).toHaveAttribute("href", "/news");
    });
  });

  // ── Production filtering ───────────────────────────────────────

  describe("production mode", () => {
    it("tabs render correctly even in production mock", () => {
      // Note: SHEET_CATEGORIES and tabs filter are evaluated at module
      // load time with isProduction(), so runtime changes don't affect them.
      // This test verifies the component renders without errors.
      mockIsProductionRef.value = true;
      const { container } = render(<MobileBottomNav />);
      expect(getTabLink(container, "/")).not.toBeNull();
      expect(getTabLink(container, "/players")).not.toBeNull();
      expect(getMoreButton(container)).not.toBeNull();
    });
  });
});
