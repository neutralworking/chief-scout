# Wave 1 UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Dashboard, Player List, and Player Detail pages to match the approved Tactical Command mockups — sharp edges, pillar-colored top borders, news-first dashboard, grades not scores.

**Architecture:** Update design tokens in globals.css, create shared UI primitives (Topbar, SectionHeader, PillarBadge, GradeBadge), then rebuild each page component. Work on `feat/wave1-ui` branch.

**Tech Stack:** Next.js, Tailwind CSS v4, React Server Components, Supabase, Inter + JetBrains Mono

**Spec:** `docs/superpowers/specs/2026-03-22-wave1-ui-redesign.md`
**Mockups:** `.stitch/designs/dashboard-v1.html`, `players-list-v1.html`, `player-detail-v1.html` + mobile variants

---

### Task 0: Create Feature Branch

**Files:** None (git only)

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feat/wave1-ui
```

- [ ] **Step 2: Verify clean state**

```bash
git status
```

Expected: clean working tree on `feat/wave1-ui`

---

### Task 1: Design System — Update CSS Tokens

**Files:**
- Modify: `apps/web/src/app/globals.css`

Reference mockup: `.stitch/designs/dashboard-v1.html` (CSS variables section, lines 11-33)

- [ ] **Step 1: Add new CSS variables to `:root`**

Add these variables to the `:root` block in `globals.css` (after line 54):

```css
--bg-pit: #0a0a0a;
--bg-surface-dark: #141414;
--border-panel: rgba(111, 195, 223, 0.35);
--border-bright: #6fc3df;
```

- [ ] **Step 2: Update `.glass` class**

Replace the existing `.glass` block (~line 68):

```css
.glass {
  background: var(--bg-surface-dark, #141414);
  border: 1px solid var(--border-panel);
  border-radius: 0;
}

.glass-elevated {
  background: var(--bg-elevated);
  border: 1px solid var(--border-panel);
  border-radius: 0;
}
```

- [ ] **Step 3: Add new utility classes**

Add after the glass classes:

```css
/* Sharp panel with colored top border */
.panel-accent-tactical { border-top: 2px solid var(--color-accent-tactical); }
.panel-accent-technical { border-top: 2px solid var(--color-accent-technical); }
.panel-accent-mental { border-top: 2px solid var(--color-accent-mental); }
.panel-accent-physical { border-top: 2px solid var(--color-accent-physical); }
.panel-accent-personality { border-top: 2px solid var(--color-accent-personality); }
.panel-accent-cyan { border-top: 2px solid var(--border-bright); }

/* Pit background for inset areas */
.bg-pit { background: var(--bg-pit); }

/* Section header pip */
.section-pip {
  width: 3px;
  height: 10px;
  border-radius: 1px;
  display: inline-block;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Verify build compiles**

```bash
cd apps/web && npx next build --no-lint 2>&1 | tail -5
```

Expected: no CSS errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style: add Wave 1 design tokens — pit bg, panel borders, sharp edges"
```

---

### Task 2: Topbar Component

**Files:**
- Create: `apps/web/src/components/Topbar.tsx`

Reference mockup: `.stitch/designs/dashboard-v1.html` (topbar section)

- [ ] **Step 1: Create the Topbar component**

```tsx
interface TopbarProps {
  playerCount?: number;
  tier1Count?: number;
}

export function Topbar({ playerCount, tier1Count }: TopbarProps) {
  return (
    <div className="h-[34px] bg-[var(--bg-surface-dark,#141414)] border-b border-[var(--border-panel)] flex items-center justify-between px-4 shrink-0">
      <span className="font-mono text-[11px] font-bold tracking-[3px] uppercase text-[var(--border-bright)]">
        Chief Scout
      </span>
      <div className="flex gap-4 items-center text-[10px] text-[var(--text-muted)] font-mono">
        {playerCount != null && <span>{playerCount.toLocaleString()} Players</span>}
        {tier1Count != null && <span>{tier1Count} Scouted</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Import in `layout.tsx` temporarily above `<main>` to check visually. Remove after verification.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Topbar.tsx
git commit -m "feat: add Topbar component — Chief Scout branding bar"
```

---

### Task 3: SectionHeader Component

**Files:**
- Create: `apps/web/src/components/SectionHeader.tsx`

Reference mockup: section headers with glowing pips

- [ ] **Step 1: Create the SectionHeader component**

```tsx
type PipColor = "tactical" | "technical" | "mental" | "physical" | "personality" | "cyan";

const PIP_COLORS: Record<PipColor, string> = {
  tactical: "bg-[var(--color-accent-tactical)] shadow-[0_0_6px_var(--color-accent-tactical)]",
  technical: "bg-[var(--color-accent-technical)] shadow-[0_0_6px_var(--color-accent-technical)]",
  mental: "bg-[var(--color-accent-mental)] shadow-[0_0_6px_var(--color-accent-mental)]",
  physical: "bg-[var(--color-accent-physical)] shadow-[0_0_6px_var(--color-accent-physical)]",
  personality: "bg-[var(--color-accent-personality)] shadow-[0_0_6px_var(--color-accent-personality)]",
  cyan: "bg-[var(--border-bright)] shadow-[0_0_6px_var(--border-bright)]",
};

const TEXT_COLORS: Record<PipColor, string> = {
  tactical: "text-[var(--color-accent-tactical)]",
  technical: "text-[var(--color-accent-technical)]",
  mental: "text-[var(--color-accent-mental)]",
  physical: "text-[var(--color-accent-physical)]",
  personality: "text-[var(--color-accent-personality)]",
  cyan: "text-[var(--text-secondary)]",
};

interface SectionHeaderProps {
  label: string;
  color: PipColor;
  action?: React.ReactNode;
}

export function SectionHeader({ label, color, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className={`section-pip ${PIP_COLORS[color]}`} />
        <span className={`text-[9px] font-bold uppercase tracking-[2px] ${TEXT_COLORS[color]}`}>
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/SectionHeader.tsx
git commit -m "feat: add SectionHeader component — glowing pip + uppercase label"
```

---

### Task 4: GradeBadge Component

**Files:**
- Create: `apps/web/src/components/GradeBadge.tsx`

Used on Player Detail for attribute grades (A/B/C/D instead of raw scores).

- [ ] **Step 1: Create the GradeBadge component**

```tsx
type Grade = "A" | "B" | "C" | "D";

const GRADE_STYLES: Record<Grade, string> = {
  A: "bg-[var(--color-accent-mental)]/15 text-[var(--color-accent-mental)] border-[var(--color-accent-mental)]/30",
  B: "bg-[var(--border-bright)]/15 text-[var(--border-bright)] border-[var(--border-bright)]/30",
  C: "bg-[var(--color-accent-personality)]/15 text-[var(--color-accent-personality)] border-[var(--color-accent-personality)]/30",
  D: "bg-[var(--color-sentiment-negative)]/15 text-[var(--color-sentiment-negative)] border-[var(--color-sentiment-negative)]/30",
};

interface GradeBadgeProps {
  grade: Grade;
}

export function GradeBadge({ grade }: GradeBadgeProps) {
  return (
    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border ${GRADE_STYLES[grade]}`}>
      {grade}
    </span>
  );
}

/** Convert a 0-100 stat score to a letter grade */
export function scoreToGrade(score: number | null | undefined): Grade {
  if (score == null) return "D";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/GradeBadge.tsx
git commit -m "feat: add GradeBadge component — A/B/C/D colored badges"
```

---

### Task 5: Update PlayerCard — Sharp Edges + Model Label

**Files:**
- Modify: `apps/web/src/components/PlayerCard.tsx`

Reference mockup: `.stitch/designs/players-list-v1.html`

- [ ] **Step 1: Read current PlayerCard.tsx**

Read the full file to understand current structure.

- [ ] **Step 2: Add model_id to display**

In Row 2 (after archetype chip, before closing div), add model label:

```tsx
{player.model_id && (
  <span className="font-mono text-[10px] text-[var(--text-muted)] ml-auto">
    {player.model_id}
  </span>
)}
```

- [ ] **Step 3: Remove rounded corners**

Replace any `rounded-lg` or `rounded` on the outer card wrapper with sharp edges. Change the outer Link className:
- Remove: `rounded-lg` or `rounded`
- The card should have no border-radius

- [ ] **Step 4: Remove pursuit status dot**

Find and remove the pursuit status indicator dot/badge from the card. This is Pro-only and should not render.

- [ ] **Step 5: Verify card renders correctly**

```bash
cd apps/web && npm run dev
```

Check `/players` page — cards should have sharp edges, model label visible, no pursuit dots.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/PlayerCard.tsx
git commit -m "style: PlayerCard — sharp edges, model label, remove pursuit status"
```

---

### Task 6: Update Player List Page — Sticky Search, No Tier 1

**Files:**
- Modify: `apps/web/src/app/players/page.tsx`

Reference mockup: `.stitch/designs/players-list-v1.html`

- [ ] **Step 1: Read current players/page.tsx**

Read the full file to understand current filter/search implementation.

- [ ] **Step 2: Remove Tier 1 toggle**

Find and remove any "Tier 1" toggle/filter UI. Do not surface "Tier 1" as a label anywhere.

- [ ] **Step 3: Make search bar sticky**

Wrap the search input and filter bar in a sticky container:

```tsx
<div className="sticky top-0 z-30 bg-[var(--bg-base)] pb-2">
  {/* search + filters here */}
</div>
```

- [ ] **Step 4: Update footer text**

Change any "Showing X of Y" text to just show the count with "scouted players" label:

```tsx
<span className="text-[10px] text-[var(--text-muted)] font-mono">
  {count} scouted players
</span>
```

- [ ] **Step 5: Add panel styling**

Wrap the main content area in glass panel styling with cyan top border:

```tsx
<div className="glass panel-accent-cyan">
```

- [ ] **Step 6: Verify page renders**

Check `/players` — sticky search, no Tier 1 toggle, sharp panels.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/players/page.tsx
git commit -m "feat: Player List — sticky search, remove Tier 1, panel styling"
```

---

### Task 7: Update Dashboard — News First, Fixtures with Odds

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/FeaturedPlayer.tsx`

Reference mockup: `.stitch/designs/dashboard-v1.html`

This is the biggest task — the layout flips from featured-player-first to news-first.

- [ ] **Step 1: Read current page.tsx and FeaturedPlayer.tsx**

Read both files fully to understand current data fetching and layout.

- [ ] **Step 2: Restructure the layout grid**

Change the dashboard JSX from:
```
Row 1: Featured (3col) + Fixtures/League/Contracts (2col)
Row 2: News (3col) + Rising Stars/Market/Trending (2col)
```
To:
```
Row 1: News (3col) + Fixtures (2col)
Row 2: Featured (2col) + Market Movers + Trending + Gaffer (3col)
```

The grid changes from `grid-cols-5` rows to:
```tsx
<div className="flex flex-col gap-2 lg:h-[calc(100vh-2rem)] lg:overflow-hidden">
  {/* Row 1: News + Fixtures — auto height */}
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 shrink-0" style={{ maxHeight: '50vh' }}>
    {/* News — 3 cols */}
    <div className="lg:col-span-3 glass panel-accent-cyan ...">
    {/* Fixtures — 2 cols */}
    <div className="lg:col-span-2 glass panel-accent-tactical ...">
  </div>

  {/* Row 2: Featured + Browse — fills remaining */}
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 flex-1 min-h-0">
    {/* Featured — 2 cols */}
    <div className="lg:col-span-2">
    {/* Browse column — 3 cols */}
    <div className="lg:col-span-3 flex flex-col gap-2">
  </div>
</div>
```

- [ ] **Step 3: Remove Contracts, Rising Stars, League shortcuts**

Delete the JSX and associated data fetching for:
- Contract watch section
- Rising stars section
- League shortcuts section

Remove their queries from `getDashboardData()` (queries 4, 5 in the Promise.all) if no longer needed elsewhere.

- [ ] **Step 4: Add news source attribution**

In the news story rendering, add source after timestamp:

```tsx
<span className="text-[9px] text-[var(--text-muted)] font-mono">
  {timeAgo(story.published_at)}
  {story.source && <> · {story.source}</>}
</span>
```

Note: check if `news_stories` table has a `source` column. If not, skip this and add a TODO comment.

- [ ] **Step 5: Add story type color coding**

Replace the single purple badge style with per-type colors:

```tsx
const NEWS_TYPE_STYLES: Record<string, string> = {
  transfer: "bg-[var(--color-accent-tactical)]/15 text-[var(--color-accent-tactical)] border-[var(--color-accent-tactical)]/20",
  injury: "bg-[var(--color-sentiment-negative)]/10 text-[var(--color-sentiment-negative)] border-[var(--color-sentiment-negative)]/20",
  contract: "bg-[var(--color-accent-mental)]/10 text-[var(--color-accent-mental)] border-[var(--color-accent-mental)]/20",
  tactical: "bg-[var(--color-accent-physical)]/10 text-[var(--color-accent-physical)] border-[var(--color-accent-physical)]/20",
  scouting: "bg-[var(--color-accent-personality)]/10 text-[var(--color-accent-personality)] border-[var(--color-accent-personality)]/20",
  analysis: "bg-[var(--border-bright)]/10 text-[var(--border-bright)] border-[var(--border-bright)]/15",
};
```

- [ ] **Step 6: Add competition name to fixtures**

In the fixture rows, replace the short code with a more readable form:

```tsx
const COMP_DISPLAY: Record<string, string> = {
  "Premier League": "Prem",
  "La Liga": "La Liga",
  "Serie A": "Serie A",
  "Bundesliga": "Bundes.",
  "Ligue 1": "Ligue 1",
};
```

- [ ] **Step 7: Add Topbar to dashboard**

Import and render `<Topbar>` at the top of the dashboard (inside the returned JSX, before the grid). Pass player/tier1 counts from the data fetch.

- [ ] **Step 8: Apply panel styling**

Add `glass` + `panel-accent-*` classes to all panels:
- News: `panel-accent-cyan`
- Fixtures: `panel-accent-tactical`
- Featured: keep existing border-left style
- Market Movers: `panel-accent-physical`
- Trending: `panel-accent-personality`
- Gaffer CTA: `panel-accent-personality`

Use `<SectionHeader>` component for all section titles.

- [ ] **Step 9: Verify dashboard renders**

```bash
cd apps/web && npm run dev
```

Check `/` — news should be top-left, fixtures top-right, featured player below.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/FeaturedPlayer.tsx
git commit -m "feat: Dashboard redesign — news first, fixtures with competition names, panel styling"
```

---

### Task 8: Update FeaturedPlayer — 2-Column Layout + Intel Strip

**Files:**
- Modify: `apps/web/src/components/FeaturedPlayer.tsx`

Reference mockup: `.stitch/designs/dashboard-v1.html` (featured section)

- [ ] **Step 1: Read FeaturedPlayer.tsx fully**

Read the entire 394-line file.

- [ ] **Step 2: Restructure to 2-column layout**

Change the card from vertical stack to a CSS grid:

```tsx
<div className="glass p-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-l-2 border-[var(--color-accent-tactical)]"
     style={{ background: 'linear-gradient(135deg, #141414 0%, #0f1218 50%, #141414 100%)' }}>
```

Left column: identity (position, name, archetype, bio)
Right column: role score block + mini radar + 2x2 pillar badges

- [ ] **Step 3: Add intel strip**

Between bio and bottom stats bar, add a row of chips:

```tsx
<div className="col-span-full flex flex-wrap gap-1.5">
  {player.personality_type && (
    <IntelChip label="Personality" value={player.personality_type} />
  )}
  {player.best_role && (
    <IntelChip label="Best Role" value={player.best_role} accent="tactical" />
  )}
  {/* ... side, foot, age chips */}
</div>
```

Create a simple `IntelChip` inline or as a small component:

```tsx
function IntelChip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-pit border border-[var(--border-panel)]/20 text-[10px]">
      <span className="font-mono text-[7px] font-bold uppercase tracking-[1.5px] opacity-50">{label}</span>
      <span className={`font-semibold ${accent ? `text-[var(--color-accent-${accent})]` : 'text-[var(--text-secondary)]'}`}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Add pillar attribute detail**

Under each pillar score badge, show top 2 attributes. This requires fetching attribute grades for the featured player. If grades aren't available in the current query, add a TODO comment and skip.

- [ ] **Step 5: Verify featured player renders**

Check `/` — featured player should be 2-column with intel strip below bio.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/FeaturedPlayer.tsx
git commit -m "feat: FeaturedPlayer — 2-column layout, intel strip, pillar detail"
```

---

### Task 9: Update Player Detail — Grades, Roles, Career Stats

**Files:**
- Modify: `apps/web/src/app/players/[id]/page.tsx`

Reference mockup: `.stitch/designs/player-detail-v1.html`

- [ ] **Step 1: Read current player detail page**

Read the full file.

- [ ] **Step 2: Replace raw attribute scores with grade badges**

Find where attribute scores are rendered. Replace numeric display with `<GradeBadge>`:

```tsx
import { GradeBadge, scoreToGrade } from "@/components/GradeBadge";

// Replace score display:
<GradeBadge grade={scoreToGrade(attr.stat_score)} />
```

- [ ] **Step 3: Add secondary positions**

Near the position badge, add secondary positions if available. Check if `player_profiles` has secondary position data. If so:

```tsx
<div className="flex items-center gap-1">
  <span className={`font-mono text-[10px] font-bold px-2 py-0.5 ${POSITION_COLORS[player.position]}`}>
    {player.position}
  </span>
  {secondaryPositions?.map(pos => (
    <span key={pos} className="font-mono text-[10px] px-1.5 py-0.5 text-[var(--text-muted)] border border-[var(--border-panel)]/20">
      {pos}
    </span>
  ))}
</div>
```

- [ ] **Step 4: Add Best Roles section**

Create a "Best Roles" panel showing 1-3 tactical roles with score bars:

```tsx
<div className="glass panel-accent-tactical p-3">
  <SectionHeader label="Best Roles" color="tactical" />
  <div className="mt-2 space-y-2">
    {roles.map(role => (
      <div key={role.name} className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-secondary)] w-32 truncate">{role.name}</span>
        <div className="flex-1 h-1.5 bg-pit">
          <div className="h-full bg-[var(--color-accent-tactical)]" style={{ width: `${role.score}%` }} />
        </div>
        <span className="font-mono text-[12px] font-bold text-[var(--color-accent-tactical)] w-8 text-right">{role.score}</span>
      </div>
    ))}
  </div>
</div>
```

Data source: check if `best_role_score` and any secondary role scores exist in the view.

- [ ] **Step 5: Add career timeline with stats**

If career history data is available (from `player_career_history` table), render clubs with apps/goals/assists:

```tsx
<div className="glass panel-accent-cyan p-3">
  <SectionHeader label="Career" color="cyan" />
  <div className="mt-2 space-y-1.5">
    {career.map(stint => (
      <div key={stint.club} className="flex items-center gap-2 py-1">
        <span className="text-[11px] font-medium text-[var(--text-primary)]">{stint.club}</span>
        <span className="text-[9px] text-[var(--text-muted)] font-mono">{stint.years}</span>
        {stint.apps != null && (
          <span className="text-[9px] text-[var(--text-muted)] font-mono ml-auto">
            {stint.apps} apps · {stint.goals} goals · {stint.assists} assists
          </span>
        )}
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 6: Apply sharp panel styling to all sections**

Replace all `rounded-xl`, `rounded-lg` with sharp edges. Add `panel-accent-*` classes and `<SectionHeader>` to each panel.

- [ ] **Step 7: Verify player detail renders**

Check `/players/1` (or any valid ID) — grades instead of scores, secondary positions, best roles with bars.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/players/[id]/page.tsx
git commit -m "feat: Player Detail — grade badges, best roles, career stats, sharp panels"
```

---

### Task 10: Update MobileBottomNav — 5 Tabs

**Files:**
- Modify: `apps/web/src/components/MobileBottomNav.tsx`

- [ ] **Step 1: Read MobileBottomNav.tsx**

Read the full file.

- [ ] **Step 2: Update primary tabs to 5**

Change from 4 tabs (Home, Players, Admin, More) to 5 tabs (Home, Players, Clubs, Compare, More):

Update the primary tab array to include Clubs and Compare, remove Admin from primary tabs (move to More sheet).

- [ ] **Step 3: Verify mobile nav**

Test on mobile viewport — 5 tabs should be evenly spaced.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/MobileBottomNav.tsx
git commit -m "feat: MobileBottomNav — 5 tabs (Home, Players, Clubs, Compare, More)"
```

---

### Task 11: Add Topbar to Layout

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Read layout.tsx**

- [ ] **Step 2: Import and render Topbar**

Add `<Topbar />` inside the body, before the main content area. It should be visible on both mobile and desktop, above the sidebar content area:

```tsx
import { Topbar } from "@/components/Topbar";

// Inside the body, before <main>:
<Topbar />
```

- [ ] **Step 3: Adjust main padding**

Account for the topbar height (34px) in the main content offset:

```tsx
<main className="pb-24 lg:pb-8 lg:ml-64 lg:pt-0 p-4 lg:p-8">
```

- [ ] **Step 4: Verify layout**

Both desktop and mobile should show topbar. Sidebar still works on desktop. Content doesn't overlap.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat: add Topbar to root layout — Chief Scout branding"
```

---

### Task 12: Global Sharp Edge Sweep

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: any component with `rounded-xl` or `rounded-lg` on panels

- [ ] **Step 1: Search for rounded classes on panels**

```bash
grep -r "rounded-xl\|rounded-lg\|rounded-2xl" apps/web/src/app/ apps/web/src/components/ --include="*.tsx" -l
```

- [ ] **Step 2: Replace rounded corners on panel/card elements**

In each file found, replace `rounded-xl` and `rounded-lg` on glass panels and cards with no rounding. Keep `rounded` on small elements (badges, pills, dots) where appropriate.

- [ ] **Step 3: Verify no visual regressions**

Spot-check `/`, `/players`, `/players/[id]` on desktop and mobile.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style: remove rounded corners from all panels — sharp edge sweep"
```

---

### Task 13: QA Pass

**Files:** None (testing only)

- [ ] **Step 1: Desktop QA — Dashboard**

Check: news top-left, fixtures top-right, featured player below, Topbar with "CHIEF SCOUT", panel borders, section header pips, no contracts/rising stars/leagues.

- [ ] **Step 2: Desktop QA — Player List**

Check: no pursuit dots, no Tier 1 toggle, model column visible, sticky search, sharp card edges, footer says "X scouted players".

- [ ] **Step 3: Desktop QA — Player Detail**

Check: grade badges (A/B/C/D) not raw scores, secondary positions if available, best roles panel, career section, sharp panels with colored top borders.

- [ ] **Step 4: Mobile QA — Dashboard**

Check: news first, then fixtures, then featured player. Bottom nav has 5 tabs.

- [ ] **Step 5: Mobile QA — Player List**

Check: sticky search, no Tier 1, descriptive pillar labels, age filters if added.

- [ ] **Step 6: Mobile QA — Player Detail**

Check: dense hero card, grade badges, expandable attribute sections.

- [ ] **Step 7: Responsive transition**

Resize browser from mobile → desktop. No layout breaks, sidebar appears correctly, content reflows.

- [ ] **Step 8: Fix any issues found**

Address bugs, then commit:

```bash
git add -A
git commit -m "fix: Wave 1 QA fixes"
```

---

### Task 14: Merge and Push

- [ ] **Step 1: Verify all tests pass**

```bash
cd apps/web && npm run build
```

Expected: clean build with no errors.

- [ ] **Step 2: Push feature branch**

```bash
git push -u origin feat/wave1-ui
```

- [ ] **Step 3: Create PR or merge to main**

After user approval, merge:

```bash
git checkout main
git merge feat/wave1-ui
git push
```
