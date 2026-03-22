# Wave 1 UI Redesign — Dashboard, Player List, Player Detail

**Date:** 2026-03-22
**Status:** Draft
**Mockups:** `.stitch/designs/dashboard-v1.html`, `players-list-v1.html`, `player-detail-v1.html` + mobile variants

## Goal

Rebuild the three highest-traffic pages to match the approved Tactical Command mockups. Ship on a feature branch, QA, then merge to main.

## Design Principles (from mockups)

- **Sharp edges**: `border-radius: 0` on all panels (current: rounded-lg/rounded-xl)
- **2px colored top borders** on every panel, color matches its category
- **Section headers**: 3px glowing color pip + 9px uppercase + letter-spacing 2px
- **Topbar**: "CHIEF SCOUT" in cyan JetBrains Mono, replacing current sidebar-driven nav
- **Glass panels**: bg `#141414` (darker than current `#1e1e1e`), border `rgba(111,195,223,0.35)`
- **Alternating row tinting** on all lists
- **Glow effects**: sentiment dots, key numbers, active borders
- **Mobile**: bottom nav with 5 tabs (Home, Players, Clubs, Compare, More)

## Scope

### 1. Design System Updates (`globals.css` + shared)

**CSS variable changes:**
- `--bg-surface`: `#1e1e1e` → `#141414`
- `--bg-pit` (new): `#0a0a0a`
- `--border-subtle`: keep `#6fc3df` but default panel border becomes `rgba(111,195,223,0.35)`
- Add `--border-bright: #6fc3df` for active/hover states

**Global class changes:**
- `.glass`: remove `border-radius`, darken background to `#141414`, add subtle inset shadow
- `.glass-elevated`: same treatment
- New `.section-header` class: pip + uppercase + tracking
- New `.pillar-badge` variants with `inset 0 -2px 0` bottom accent
- All `rounded-xl`, `rounded-lg` on panels → `rounded-none` or remove

**Typography:**
- Already using Inter + JetBrains Mono — no change needed
- Section headers: enforce `text-[9px] font-bold uppercase tracking-[2px]`

### 2. Dashboard (`/`) — `apps/web/src/app/page.tsx`

**Layout change (major):**
- Current: Featured Player (3col) + Fixtures/League/Contracts (2col) top, News + Intel bottom
- New: News (3col) + Fixtures (2col) top, Featured Player (2col) + Browse (3col) bottom
- Remove: Contracts panel, Rising Stars, League shortcuts
- Keep: Market Movers, Trending Players, Gaffer CTA

**Featured Player changes:**
- 2-column internal layout: identity/bio left, role score + radar + 2x2 pillars right
- Intel strip: personality, best role, plays like, side, foot, age chips
- Pillar badges show top 2 attributes per pillar (e.g. "Passing A · First Touch A")

**Fixtures changes:**
- Show competition name (not just code)
- Add decimal odds columns (1/X/2) — sourced from fixtures table or calculated
- Alternating row tinting

**News changes:**
- Add source attribution per story
- Color-coded story type badges (Transfer=purple, Injury=red, Contract=green, etc.)

**Topbar:**
- Replace sidebar-based nav with "CHIEF SCOUT" topbar
- Desktop: keep sidebar for navigation but add topbar for branding
- Stats: player count, tier 1 count

### 3. Player List (`/players`) — `apps/web/src/app/players/page.tsx`

**Changes:**
- Remove pursuit status dots (Pro-only)
- Remove "Tier 1" toggle — never surface this label
- Add Model column (e.g. "Creator-9")
- Search bar becomes sticky (always visible)
- Filter bar: position chips + archetype dropdown + sort toggle
- Mobile: add age filter row (U21, U23, 23-27, 28-32, 32+)
- Mobile: pillar scores get descriptive labels (TEC/TAC/MEN/PHY with colored backgrounds)
- Footer: "276 scouted players" (not "Showing X of Y")

**PlayerCard component updates:**
- `border-radius: 0` (sharp edges)
- 2px left border = dominant pillar color (keep)
- Add model label to row 2

### 4. Player Detail (`/players/[id]`) — `apps/web/src/app/players/[id]/page.tsx`

**Changes:**
- Attributes: show grade badges (A/B/C/D) not raw scores (Pro-only)
- Career timeline: add Apps/Goals/Assists per club stint
- Best Roles section: show 1-3 tactical roles with role scores and bars
- Secondary positions: show next to primary position badge
- Mobile hero: pack in all key info (position, name, club, nation, age, height, foot, archetype, personality, RS)

### 5. Shared Components to Update

| Component | Changes |
|---|---|
| `PlayerCard.tsx` | Sharp edges, model label, no pursuit dots |
| `FeaturedPlayer.tsx` | 2-column layout, intel strip, pillar detail |
| `Sidebar.tsx` | Keep but add topbar above it |
| `MobileBottomNav.tsx` | 5 tabs (Home, Players, Clubs, Compare, More) |
| `RadarChart.tsx` | Cyan grid lines, purple fill by default |
| `globals.css` | All design token changes |

### 6. New Components

| Component | Purpose |
|---|---|
| `Topbar.tsx` | "CHIEF SCOUT" branding bar with stats |
| `SectionHeader.tsx` | Glowing pip + uppercase label |
| `PillarBadge.tsx` | Score + label + bottom accent bar |
| `GradeBadge.tsx` | A/B/C/D colored badge for attributes |
| `BestRoles.tsx` | 1-3 roles with score bars |
| `IntelChip.tsx` | Label + value chip for featured player |

## Out of Scope (Wave 2+)

- Clubs, leagues, formations, free agents, news, compare, squad, gaffer
- Fixture odds calculation pipeline (show placeholder if no data)
- Pro-level features (raw scores, pursuit status)

## QA Checklist

- [ ] Desktop dashboard: news first, fixtures with competition names, featured player 2-column
- [ ] Desktop player list: no pursuit, no Tier 1, model column, sticky search
- [ ] Desktop player detail: grades not scores, career stats, best roles, secondary positions
- [ ] Mobile dashboard: news first, fixtures, featured player compact
- [ ] Mobile player list: age filters, descriptive pillar labels, sticky search
- [ ] Mobile player detail: dense hero, expandable attribute sections
- [ ] All panels: sharp edges (0 radius), 2px colored top borders
- [ ] All section headers: glowing pip + uppercase
- [ ] No regressions on existing functionality
- [ ] Responsive breakpoint transitions (mobile ↔ desktop)
- [ ] Dark theme consistency (no stray light backgrounds)
