# Design System v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Bloomberg-terminal aesthetic with a "Vibrant Data" identity — Clash Display + Bricolage Grotesque, warm purple surfaces, brand gradient, two surface modes (Vibrant/Calm).

**Architecture:** Token-first migration. Update `globals.css` variables and font loading in `layout.tsx` — this propagates to 69+ files automatically via CSS var references. Then update shared components (SectionHeader, cards, nav). Finally apply Vibrant/Calm surface modes page by page.

**Tech Stack:** Next.js, Tailwind v4, `next/font/google` + `next/font/local`, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-03-23-design-system-v2.md`

---

## File Structure

### Core (touch once, cascades everywhere)
- **Modify:** `apps/web/src/app/globals.css` — All design tokens, utility classes, surface modes
- **Modify:** `apps/web/src/app/layout.tsx` — Font loading, html class

### Fonts
- **Create:** `apps/web/src/fonts/ClashDisplay-Variable.woff2` — Self-hosted Clash Display (must be in src/ for next/font/local resolution)

### Shared Components
- **Modify:** `apps/web/src/components/SectionHeader.tsx` — Clash Display uppercase, remove pip
- **Modify:** `apps/web/src/components/Sidebar.tsx` — New surfaces, remove ThemeToggle, update typography
- **Modify:** `apps/web/src/components/MobileBottomNav.tsx` — New surfaces, remove ThemeToggle
- **Modify:** `apps/web/src/components/Topbar.tsx` — New surfaces
- **Delete:** `apps/web/src/components/ThemeToggle.tsx` — Glass theme removed

### Pages — Vibrant
- **Modify:** `apps/web/src/app/page.tsx` — Dashboard: vibrant bg, new cards, Clash headlines
- **Modify:** `apps/web/src/components/FeaturedPlayer.tsx` — Gradient hero, Clash player name
- **Modify:** `apps/web/src/components/TrendingPlayers.tsx` — New card style
- **Modify:** `apps/web/src/app/players/page.tsx` — Player list: vibrant cards

### Pages — Hybrid (vibrant hero → calm body)
- **Modify:** `apps/web/src/app/players/[id]/page.tsx` — Vibrant identity bar, calm data body

### Remaining Pages (Phase 2 — separate tasks after core lands)
These pages inherit new tokens automatically from Task 3. Explicit surface mode application is Phase 2:
- `apps/web/src/app/free-agents/page.tsx` — Vibrant
- `apps/web/src/app/news/page.tsx` — Vibrant
- `apps/web/src/app/choices/page.tsx` — Vibrant (Games)
- `apps/web/src/app/on-the-plane/page.tsx` — Vibrant (Games)
- `apps/web/src/app/pricing/page.tsx` — Vibrant
- `apps/web/src/app/clubs/page.tsx` + `apps/web/src/app/clubs/[id]/page.tsx` — Hybrid
- `apps/web/src/app/compare/page.tsx` — Calm
- `apps/web/src/app/formations/page.tsx` — Calm
- `apps/web/src/app/shortlists/page.tsx` — Hybrid
- `apps/web/src/components/LandingPage.tsx` — Vibrant
- `apps/web/src/components/PlayerCard.tsx` — Trading card aesthetic
- `apps/web/src/components/GradeBadge.tsx` — New data font
- `apps/web/src/components/PaywallGate.tsx` + `apps/web/src/components/PlayerTeaser.tsx` — Colorful unlock

### Tests
- **Modify:** Existing tests if they assert on removed CSS classes or font names

---

## Task 1: Download & Install Fonts

**Files:**
- Create: `apps/web/src/fonts/ClashDisplay-Variable.woff2`
- Create: `apps/web/src/fonts/ClashDisplay-Variable.woff`

- [ ] **Step 1: Download Clash Display from Fontshare**

```bash
cd /workspaces/chief-scout/apps/web/public
mkdir -p fonts
# Download Clash Display variable font from Fontshare
curl -L "https://api.fontshare.com/v2/css?f[]=clash-display@1&display=swap" -o /tmp/clash-css.txt
# Extract woff2 URL from the CSS and download
# If curl approach fails, manually download from https://www.fontshare.com/fonts/clash-display
# Place ClashDisplay-Variable.woff2 in public/fonts/
```

Note: Fontshare doesn't have a stable direct download URL. If the curl approach fails:
1. Visit https://www.fontshare.com/fonts/clash-display
2. Download the variable font package
3. Extract `ClashDisplay-Variable.woff2` to `apps/web/src/fonts/`

- [ ] **Step 2: Verify font file exists**

```bash
ls -la apps/web/src/fonts/ClashDisplay-Variable.woff2
```

Expected: File exists, ~50-100KB

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/fonts/
git commit -m "feat: add Clash Display variable font (self-hosted from Fontshare)"
```

---

## Task 2: Update Font Loading in layout.tsx

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Replace Google Fonts link with next/font imports**

Replace the `<link>` tags for Inter and JetBrains Mono (lines 46-51) with `next/font` imports at the top of the file:

```tsx
import { Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const clash = localFont({
  src: "../fonts/ClashDisplay-Variable.woff2",  // relative to layout.tsx in src/app/
  variable: "--font-clash",
  display: "swap",
});
```

- [ ] **Step 2: Apply font variables to html element**

Change line 36 from:
```tsx
<html lang="en" className="dark">
```
To:
```tsx
<html lang="en" className={`dark ${bricolage.variable} ${clash.variable}`}>
```

- [ ] **Step 3: Remove old Google Fonts link tags**

Delete lines 46-51 (the `<link rel="preconnect">` and `<link href="...googleapis...">` tags). Keep the manifest and meta tags.

- [ ] **Step 4: Verify build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
```

Expected: `ok (no errors)`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat: switch fonts to Bricolage Grotesque + Clash Display via next/font"
```

---

## Task 3: Overhaul globals.css Tokens

This is the highest-impact task — changing these values cascades to 69+ files automatically.

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Replace the @theme inline block**

Replace lines 1-39 with:

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--bg-base);
  --color-foreground: var(--text-primary);
  --font-sans: var(--font-body), "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-body), "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-clash), "Clash Display", Impact, sans-serif;

  /* Four-pillar accents (brighter Tailwind equivalents) */
  --color-accent-technical: #fbbf24;
  --color-accent-tactical: #a855f7;
  --color-accent-mental: #34d399;
  --color-accent-physical: #60a5fa;
  --color-accent-personality: #fbbf24;

  /* Pursuit status */
  --color-pursuit-priority: #ef4444;
  --color-pursuit-interested: #fbbf24;
  --color-pursuit-watch: #60a5fa;
  --color-pursuit-scout: #34d399;
  --color-pursuit-pass: rgba(255,255,255,0.25);
  --color-pursuit-monitor: rgba(255,255,255,0.4);

  /* Sentiment */
  --color-sentiment-positive: #34d399;
  --color-sentiment-negative: #ef4444;
  --color-sentiment-neutral: rgba(255,255,255,0.4);

  /* Tier */
  --color-tier-1: #fbbf24;
  --color-tier-2: rgba(255,255,255,0.4);
  --color-tier-3: rgba(255,255,255,0.25);
}
```

- [ ] **Step 2: Replace :root token declarations**

Replace lines 41-58 with:

```css
:root {
  /* Surfaces — warm purple tint */
  --bg-base: #000000;
  --bg-surface: #0c0a14;
  --bg-surface-solid: #0c0a14;
  --bg-elevated: #161222;
  --bg-card: rgba(255,255,255,0.06);
  --bg-pit: #050508;
  --bg-surface-dark: #0c0a14;

  /* Text — WCAG AA compliant on #000 */
  --text-primary: #ffffff;
  --text-secondary: rgba(255,255,255,0.65);
  --text-muted: rgba(255,255,255,0.45);

  /* Borders — warm, not cyan */
  --border-subtle: rgba(255,255,255,0.08);
  --border-bright: #e91e8c; /* brand pink — replaces old cyan, used in SectionHeader "cyan" variant and accent links */
  --border-panel: rgba(255,255,255,0.08);
  --border-glow: rgba(168,85,247,0.15);

  /* Brand gradient */
  --gradient-brand: linear-gradient(135deg, #e91e8c, #ff6b35, #fbbf24);
  --bg-vibrant: linear-gradient(135deg, #1a0533 0%, #2d1b69 40%, rgba(233,30,140,0.08) 100%);

  /* Shape */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 99px;

  /* Spacing */
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 20px;
  --space-xl: 24px;

  /* Legacy compat */
  --accent-club: #34d399;
  --accent-club-primary: #34d399;
  --accent-club-secondary: #60a5fa;
  --accent-personality: #fbbf24;
}
```

- [ ] **Step 3: Replace utility classes**

Replace the `.glass`, `.glass-elevated`, `.panel-accent-*`, `.bg-pit`, `.section-pip` block (lines 60-127) with:

```css
html, body {
  overflow-x: hidden;
  max-width: 100vw;
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
}

/* Card system */
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.card-elevated {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

/* Vibrant surface cards (translucent on gradient bg) */
.surface-vibrant .card,
.card-vibrant {
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md);
}

/* Calm surface cards with pillar left borders */
.card-pillar-technical { border-left: 3px solid var(--color-accent-technical); }
.card-pillar-tactical { border-left: 3px solid var(--color-accent-tactical); }
.card-pillar-mental { border-left: 3px solid var(--color-accent-mental); }
.card-pillar-physical { border-left: 3px solid var(--color-accent-physical); }
.card-pillar-personality { border-left: 3px solid var(--color-accent-personality); }

/* Surface modes */
.surface-vibrant {
  background: var(--bg-vibrant);
}

/* Brand gradient text */
.text-gradient-brand {
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Hybrid transition (vibrant hero → calm body) */
.hybrid-transition {
  position: relative;
}
.hybrid-transition::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: linear-gradient(to bottom, transparent, var(--bg-base));
  pointer-events: none;
}

/* Data font utility */
.font-data {
  font-family: var(--font-sans);
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
}

/* Responsive type scale */
@media (max-width: 639px) {
  .hero-name { font-size: 24px !important; }
  .hero-score { font-size: 36px !important; }
  .page-title { font-size: 16px !important; }
  .pillar-score { font-size: 18px !important; }
}

/* Pit background for inset areas */
.bg-pit { background: var(--bg-pit); }

/* Scrollbar styling */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* Hide scrollbar utility */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Animation keyframes */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
.animate-slideUp { animation: slideUp 0.4s ease-out forwards; }
```

- [ ] **Step 4: Remove glass theme and landing page sections**

Delete the entire `[data-theme="glass"]` block (was lines 166-192). Keep the PWA safe areas and reduced motion sections.

The final globals.css should end with:

```css
/* Landing page: break out of sidebar layout */
.landing-page {
  position: relative;
  z-index: 60;
  background: var(--bg-base);
  min-height: 100vh;
}

.landing-page ~ aside,
:has(.landing-page) aside {
  display: none !important;
}

/* PWA safe areas */
@supports (padding: env(safe-area-inset-top)) {
  body {
    padding-top: env(safe-area-inset-top);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}

.landing-page ~ .mobile-bottom-nav,
:has(.landing-page) .mobile-bottom-nav {
  display: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .mobile-bottom-nav * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Verify build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
```

Expected: `ok (no errors)` — if there are Tailwind errors about missing classes, check that all referenced CSS variables still exist.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: design system v2 tokens — warm surfaces, brand gradient, new card system"
```

---

## Task 4: Delete ThemeToggle, Update Sidebar & MobileBottomNav

**Files:**
- Delete: `apps/web/src/components/ThemeToggle.tsx`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/MobileBottomNav.tsx`

- [ ] **Step 1: Delete ThemeToggle component**

```bash
rm apps/web/src/components/ThemeToggle.tsx
```

- [ ] **Step 2: Update Sidebar.tsx**

Remove the ThemeToggle import (line 8):
```tsx
// DELETE: import { ThemeToggle } from "@/components/ThemeToggle";
```

Remove the theme toggle section (lines 138-141):
```tsx
// DELETE: <div className="px-4 py-2 border-t border-[var(--border-subtle)]">
//           <ThemeToggle />
//         </div>
```

Update the logo section typography — change the `<h1>` to use Clash Display:
```tsx
<h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-display)] uppercase">
  Chief Scout
</h1>
```

Update the sidebar background to use new surface:
```tsx
className="fixed left-0 top-0 bottom-0 w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex-col z-50 hidden lg:flex"
```
(No change needed — `--bg-surface` and `--border-subtle` are already used and will pick up new values automatically.)

Update category headings from `text-[9px]` to `text-[11px]`:
```tsx
<div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] px-6 pt-4 pb-1">
```

Update nav link padding from `py-2.5` to `py-3`:
```tsx
className={`flex items-center px-6 py-3 text-sm transition-colors ${...}`}
```

- [ ] **Step 3: Update MobileBottomNav.tsx**

Remove the ThemeToggle import (line 7):
```tsx
// DELETE: import { ThemeToggle } from "@/components/ThemeToggle";
```

Remove the footer theme toggle section (lines 276-279):
```tsx
// DELETE: <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] border-opacity-30">
//           <ThemeToggle />
//         </div>
```

Update sheet category headings from `text-[9px]` to `text-[11px]`:
```tsx
<div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] pb-2">
```

- [ ] **Step 4: Verify build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
```

Expected: `ok (no errors)`

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/components/ThemeToggle.tsx apps/web/src/components/Sidebar.tsx apps/web/src/components/MobileBottomNav.tsx
git commit -m "feat: remove glass theme toggle, update nav typography to 11px min"
```

---

## Task 5: Update SectionHeader Component

**Files:**
- Modify: `apps/web/src/components/SectionHeader.tsx`

- [ ] **Step 1: Rewrite SectionHeader with Clash Display uppercase**

Replace entire file contents:

```tsx
import React from "react";

type PipColor = "tactical" | "technical" | "mental" | "physical" | "personality" | "cyan";

const TEXT_COLORS: Record<PipColor, string> = {
  tactical: "text-[var(--color-accent-tactical)]",
  technical: "text-[var(--color-accent-technical)]",
  mental: "text-[var(--color-accent-mental)]",
  physical: "text-[var(--color-accent-physical)]",
  personality: "text-[var(--color-accent-personality)]",
  cyan: "text-[var(--text-secondary)]",
};

const DOT_COLORS: Record<PipColor, string> = {
  tactical: "bg-[var(--color-accent-tactical)]",
  technical: "bg-[var(--color-accent-technical)]",
  mental: "bg-[var(--color-accent-mental)]",
  physical: "bg-[var(--color-accent-physical)]",
  personality: "bg-[var(--color-accent-personality)]",
  cyan: "bg-[var(--text-muted)]",
};

interface SectionHeaderProps {
  label: string;
  color: PipColor;
  action?: React.ReactNode;
}

export function SectionHeader({ label, color, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[color]}`} />
        <span className={`text-[11px] font-bold uppercase tracking-[1.5px] font-[family-name:var(--font-display)] ${TEXT_COLORS[color]}`}>
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}
```

Key changes: `section-pip` (3×10px bar) → 6×6px dot. Text from 9px → 11px. Uses `--font-display` (Clash).

- [ ] **Step 2: Verify build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SectionHeader.tsx
git commit -m "feat: SectionHeader v2 — Clash Display uppercase, dot accent, 11px min"
```

---

## Task 6: Dashboard — Vibrant Surface

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/FeaturedPlayer.tsx`
- Modify: `apps/web/src/components/TrendingPlayers.tsx`

- [ ] **Step 1: Update dashboard page wrapper**

In `apps/web/src/app/page.tsx`, change the outer wrapper (line 361) from:
```tsx
<div className="flex flex-col gap-2 sm:gap-3 pb-20 lg:pb-0 lg:h-[calc(100vh-2rem)] lg:overflow-hidden">
```
To:
```tsx
<div className="surface-vibrant flex flex-col gap-3 sm:gap-4 pb-20 lg:pb-0 lg:h-[calc(100vh-2rem)] lg:overflow-hidden rounded-[var(--radius-lg)]">
```

- [ ] **Step 2: Update news panel**

Change the news panel (line 376) from:
```tsx
<div className="lg:col-span-3 glass panel-accent-cyan p-3 sm:p-4 flex flex-col min-h-0 max-h-[60vh] lg:max-h-none">
```
To:
```tsx
<div className="lg:col-span-3 card-vibrant p-4 sm:p-5 flex flex-col min-h-0 max-h-[60vh] lg:max-h-none">
```

- [ ] **Step 3: Update fixtures panel**

Change (line 439) from:
```tsx
<div className="glass panel-accent-tactical p-3 sm:p-4 flex flex-col flex-1 min-h-0 max-h-[50vh] lg:max-h-none">
```
To:
```tsx
<div className="card-vibrant p-4 sm:p-5 flex flex-col flex-1 min-h-0 max-h-[50vh] lg:max-h-none">
```

- [ ] **Step 4: Update market movers panel**

Change (line 473) from:
```tsx
<div className="glass panel-accent-physical p-3 shrink-0">
```
To:
```tsx
<div className="card-vibrant p-4 shrink-0">
```

- [ ] **Step 5: Update news text sizes — minimum 11px**

In the news map block, update all `text-[8px]` and `text-[9px]` instances to `text-[11px]` and `text-[10px]` instances to `text-[11px]`. Specifically:

- `text-[9px]` timestamp → `text-[11px]`
- `text-[8px]` story type badge → `text-[11px]`
- `text-[9px]` player tag links → `text-[11px]`
- `text-[10px]` "All stories" link → `text-[11px]`

- [ ] **Step 6: Update fixture text sizes**

- `text-[8px]` competition code → `text-[11px]`
- `text-[9px]` "v" separator → `text-[11px]`
- `text-[9px]` fixture date → `text-[11px]`
- `text-[8px]` fixture time → `text-[11px]`

- [ ] **Step 7: Verify build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: dashboard vibrant surface — new cards, 11px min text"
```

---

## Task 7: FeaturedPlayer & TrendingPlayers — Vibrant Hero

**Files:**
- Modify: `apps/web/src/components/FeaturedPlayer.tsx`

- [ ] **Step 1: Read current FeaturedPlayer**

```bash
# Read the file to understand current structure before editing
```

- [ ] **Step 2: Update the outer card**

Change the main wrapper from `glass` + `panel-accent-tactical` styling to vibrant card with gradient border:
- Replace `border-l-2 border-[var(--color-accent-tactical)]` with rounded card
- Replace `${styles.card}` references with `card-vibrant`
- Update padding from `p-3 sm:p-5` to `p-4 sm:p-6`

- [ ] **Step 3: Update player name to Clash Display**

Find the player name heading and add the Clash Display font class:
```tsx
<h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate font-[family-name:var(--font-display)] uppercase">
  {player.name}
</h2>
```

- [ ] **Step 4: Update overall score to gradient text**

Find the overall score display and apply brand gradient:
```tsx
<span className="text-3xl sm:text-4xl font-extrabold text-gradient-brand font-data">
  {player.overall ?? "–"}
</span>
```

- [ ] **Step 5: Update pillar score pills**

Change the four-pillar score display to use new pillar colors with rounded containers:
```tsx
<div className="flex gap-2">
  {[
    { label: "Tech", score: player.technical_score, color: "var(--color-accent-technical)" },
    { label: "Tact", score: player.tactical_score, color: "var(--color-accent-tactical)" },
    { label: "Ment", score: player.mental_score, color: "var(--color-accent-mental)" },
    { label: "Phys", score: player.physical_score, color: "var(--color-accent-physical)" },
  ].map(({ label, score, color }) => (
    <div key={label} className="flex-1 rounded-[var(--radius-md)] p-2 sm:p-3 text-center" style={{ background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      <div className="text-lg sm:text-xl font-extrabold font-data" style={{ color }}>{score ?? "–"}</div>
      <div className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)]">{label}</div>
    </div>
  ))}
</div>
```

- [ ] **Step 6: Update all text sizes to 11px minimum**

Scan file for `text-[8px]`, `text-[9px]`, `text-[10px]` and raise to `text-[11px]`. This includes:
- `IntelChip` component (around line 103-109) — has `text-[10px]`, `text-[7px]`, and `font-mono`
- Season stats line — has `text-[10px]` and `font-mono`
- Replace all `font-mono` with `font-data` class

- [ ] **Step 7: Update TrendingPlayers.tsx**

In `apps/web/src/components/TrendingPlayers.tsx`, replace `glass panel-accent-personality` with `card-vibrant`. Update any sub-11px text.

- [ ] **Step 8: Verify build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/FeaturedPlayer.tsx apps/web/src/components/TrendingPlayers.tsx
git commit -m "feat: FeaturedPlayer + TrendingPlayers vibrant hero — gradient score, Clash name, rounded cards"
```

---

## Task 8: Player Detail — Hybrid (Vibrant Hero → Calm Body)

**Files:**
- Modify: `apps/web/src/app/players/[id]/page.tsx`

- [ ] **Step 1: Read current player detail page**

Read the full file to understand the structure before editing.

- [ ] **Step 2: Update identity bar to vibrant**

Change the identity bar wrapper from:
```tsx
<div className="glass panel-accent-cyan p-2.5">
```
To:
```tsx
<div className="card-vibrant p-4 sm:p-5 hybrid-transition">
```

- [ ] **Step 3: Update player name to Clash Display**

```tsx
<h1 className="text-lg sm:text-xl font-bold tracking-tight truncate font-[family-name:var(--font-display)] uppercase">{player.name}</h1>
```

- [ ] **Step 4: Update position badge with gradient**

Change the position badge from flat color to rounded gradient:
```tsx
<Link href={`/players?position=${player.position ?? ""}`} className="text-[11px] font-bold tracking-wider px-2 py-1 rounded-[var(--radius-sm)] text-white shrink-0 hover:brightness-110 transition-all text-gradient-brand font-[family-name:var(--font-display)] uppercase" style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'unset', WebkitTextFillColor: 'unset' }}>
  {player.position ?? "–"}
</Link>
```

Note: Position badge uses gradient as background (not text), so override the text-gradient-brand behavior.

- [ ] **Step 5: Update meta chips section to 11px minimum**

In the Row 2 meta chips area, update all `text-[8px]` labels to `text-[11px]` and `text-[10px]` values to `text-[11px]`.

- [ ] **Step 6: Update body panels to calm card style**

Change all `glass panel-accent-*` in the body section to `card card-pillar-*`:

```tsx
// Personality panel
<div className="card card-pillar-personality p-4">

// Best roles panel
<div className="card card-pillar-tactical p-4">
```

- [ ] **Step 7: Update two-column body spacing**

Change gap from `gap-1` to `gap-3`:
```tsx
<div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
```

And inner column spacing from `space-y-1` to `space-y-3`:
```tsx
<div className="lg:overflow-y-auto space-y-3 pr-0.5">
```

- [ ] **Step 8: Verify build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/players/[id]/page.tsx
git commit -m "feat: player detail hybrid — vibrant identity hero, calm data body"
```

---

## Task 9: Player List — Vibrant Surface

**Files:**
- Modify: `apps/web/src/app/players/page.tsx`

- [ ] **Step 1: Read current player list page**

Read the file to understand structure.

- [ ] **Step 2: Update page wrapper to vibrant**

Add `surface-vibrant` to the page wrapper and `rounded-[var(--radius-lg)]`.

- [ ] **Step 3: Update any glass/panel-accent classes**

Replace `glass panel-accent-cyan` with `card-vibrant`.

- [ ] **Step 4: Update text sizes to 11px minimum**

Scan for sub-11px text sizes and raise them.

- [ ] **Step 5: Verify build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/players/page.tsx
git commit -m "feat: player list vibrant surface"
```

---

## Task 10: Topbar Update

**Files:**
- Modify: `apps/web/src/components/Topbar.tsx`

- [ ] **Step 1: Read current Topbar**

- [ ] **Step 2: Update surface references**

Replace any `--bg-surface-dark` or `--border-panel` references with new tokens (these will already have new values from Task 3, but check for any hardcoded colors).

- [ ] **Step 3: Update text sizes to 11px minimum**

- [ ] **Step 4: Verify build and commit**

```bash
cd /workspaces/chief-scout/apps/web && npm run build 2>&1 | tail -5
git add apps/web/src/components/Topbar.tsx
git commit -m "feat: topbar v2 surfaces"
```

---

## Task 11: Verify Full Build & Visual Smoke Test

- [ ] **Step 1: Full build**

```bash
cd /workspaces/chief-scout/apps/web && npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Run existing tests**

```bash
cd /workspaces/chief-scout/apps/web && npm test 2>&1 | tail -20
```

Fix any test failures caused by removed classes (`glass`, `panel-accent-*`, `section-pip`, `ThemeToggle`).

- [ ] **Step 3: Dev server smoke test**

```bash
cd /workspaces/chief-scout/apps/web && npm run dev &
```

Check in browser:
1. Dashboard loads with gradient background
2. Featured player shows Clash Display name, gradient score
3. News/fixtures panels have rounded corners
4. Player detail has vibrant hero → calm body
5. Sidebar and mobile nav render correctly
6. No cyan borders visible anywhere
7. Text is readable (no sub-11px text)

- [ ] **Step 4: Fix any visual issues found**

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: design system v2 visual polish pass"
```

---

## Task 12: Update Stitch Design File

**Files:**
- Modify: `.stitch/DESIGN.md`

- [ ] **Step 1: Update DESIGN.md to reflect new system**

Update the color palette, typography, and component descriptions to match the new Vibrant Data system. Remove all references to cyan borders, sharp edges, Inter font.

- [ ] **Step 2: Commit**

```bash
git add .stitch/DESIGN.md
git commit -m "docs: update Stitch design system to v2 Vibrant Data"
```
