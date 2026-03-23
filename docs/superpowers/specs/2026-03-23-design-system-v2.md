# Design System v2 — Vibrant Data

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Full visual identity redesign for Free + Premium users (Pro gets separate portal later)

## Summary

Replace the current Bloomberg-terminal aesthetic (dark gray, cyan borders, sharp edges, Inter/JetBrains Mono) with a "Spotify Wrapped meets football intelligence" visual identity. Two surface modes — **Vibrant** for impact pages, **Calm** for data-heavy pages — share one token system.

## Content Strategy

Same pages, gated depth. Free users see every page but hit paywalls on detailed data. Premium unlocks full intelligence. The paywall is a **design moment** — blurred vivid content behind a colorful unlock card.

| Page | Free | Premium |
|------|------|---------|
| Dashboard | Featured player (full), news, fixtures, trending | Market movers, deeper pool cycling |
| Player List | Browse all, basic cards (name/pos/club/age) | Four-pillar scores, archetype, radar thumbnail |
| Player Detail | Identity bar, scouting notes (truncated), news | Full four-pillar, radar, personality, career, valuations, similar |
| Clubs/Leagues | Full browse | Squad depth analysis, power ratings |
| Compare | Locked (CTA) | Full compare tool |
| Free Agents | Full list (editorial hook content) | Detailed scouting intel per player |

## Typography

Three-font system. No Inter, no JetBrains Mono.

| Token | Font | Use |
|-------|------|-----|
| `--font-display` | Clash Display | Player names on heroes, page titles, section headers. Always uppercase. |
| `--font-body` | Bricolage Grotesque | Everything else: subheadings, body, labels, card titles. Mixed case. |
| `--font-data` | Bricolage Grotesque + `font-feature-settings: 'tnum'` | All scores, stats, data values. Single variable — swap to Outfit later. |

**Source:** Clash Display from Fontshare (Indian Type Foundry). Bricolage Grotesque from Google Fonts. Both free.

### Type Scale

| Token | Font | Size | Weight | Extra |
|-------|------|------|--------|-------|
| hero-name | Clash | 32px | 900 | uppercase, -1px tracking |
| hero-score | data | 48px | 800 | brand gradient fill, -2px tracking |
| page-title | Clash | 20px | 900 | uppercase, 0.5px tracking |
| section-head | Bricolage | 15px | 700 | — |
| body | Bricolage | 13px | 500 | — |
| label | Bricolage | 11px | 600 | uppercase, 1.5px tracking |
| pillar-score | data | 22px | 800 | pillar color |
| data-inline | data | 13px | 700 | tnum |

### Responsive Type Scale

On screens below `640px` (Tailwind `sm`), hero sizes scale down:

| Token | Desktop | Mobile (<640px) |
|-------|---------|-----------------|
| hero-name | 32px | 24px |
| hero-score | 48px | 36px |
| page-title | 20px | 16px |
| pillar-score | 22px | 18px |

All other sizes are unchanged — 13px body and 11px labels work at all breakpoints.

**Hard rules:**
- Minimum text size: **11px** (no 8-9px text anywhere)
- Minimum padding: **12px** (no p-2.5)
- Minimum gap: **8px** (no gap-1)

## Color System

### Brand Gradient

```
--gradient-brand: linear-gradient(135deg, #e91e8c, #ff6b35, #fbbf24)
```

Used for: hero scores, CTA buttons, position badges, paywall unlock moments, overall score text via `-webkit-background-clip: text`.

### Surfaces

| Token | Value | Use |
|-------|-------|-----|
| `--bg-base` | `#000000` | Page background |
| `--bg-surface` | `#0c0a14` | Card/panel default (warm purple tint) |
| `--bg-elevated` | `#161222` | Modals, dropdowns, hover states |
| `--bg-card` | `rgba(255,255,255,0.06)` | Translucent card on vibrant backgrounds |
| `--bg-vibrant` | `linear-gradient(135deg, #1a0533, #2d1b69, rgba(233,30,140,0.08))` | Vibrant page background |

### Text

| Token | Value | Contrast on #000 | WCAG |
|-------|-------|-------------------|------|
| `--text-primary` | `#ffffff` | 21:1 | AAA |
| `--text-secondary` | `rgba(255,255,255,0.65)` | ~13.7:1 | AAA |
| `--text-muted` | `rgba(255,255,255,0.45)` | ~9.5:1 | AA (at 11px min) |

Note: `--text-muted` raised from 0.35 to 0.45 to meet WCAG AA at 11px minimum size (4.5:1 required). All text passes AA.

### Four Pillars (semantic — unchanged meaning)

| Pillar | Old | New |
|--------|-----|-----|
| Technical | `#d4a035` | `#fbbf24` |
| Tactical | `#9b59b6` | `#a855f7` |
| Mental | `#3dba6f` | `#34d399` |
| Physical | `#4a90d9` | `#60a5fa` |

These are brighter Tailwind equivalents — same hue, more pop on the new dark purple surfaces. The `--color-accent-*` prefix is **retained** for backward compatibility. All 33+ files referencing `--color-accent-technical` etc. keep working — only the values change.

### Personality Accent

| Token | Old | New |
|-------|-----|-----|
| `--color-accent-personality` | `#e8c547` | `#fbbf24` (aligns with Technical gold — personality sits in the warm spectrum) |

### Sentiment (updated)

| Token | Old | New | Note |
|-------|-----|-----|------|
| `--color-sentiment-positive` | `#3dba6f` | `#34d399` | Brighter Tailwind emerald |
| `--color-sentiment-negative` | `#e74c3c` | `#ef4444` | Brighter Tailwind red |
| `--color-sentiment-neutral` | `#8888aa` | `rgba(255,255,255,0.4)` | Neutral defers to muted text |

### Pursuit Status & Tier Colors

Retained with brighter equivalents:

| Token | New Value |
|-------|-----------|
| `--color-pursuit-priority` | `#ef4444` |
| `--color-pursuit-interested` | `#fbbf24` |
| `--color-pursuit-watch` | `#60a5fa` |
| `--color-pursuit-scout` | `#34d399` |
| `--color-pursuit-pass` | `rgba(255,255,255,0.25)` |
| `--color-pursuit-monitor` | `rgba(255,255,255,0.4)` |
| `--color-tier-1` | `#fbbf24` |
| `--color-tier-2` | `rgba(255,255,255,0.4)` |
| `--color-tier-3` | `rgba(255,255,255,0.25)` |

## Shape & Spacing

### Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 6px | Badges, small chips |
| `--radius-md` | 12px | Cards (default) |
| `--radius-lg` | 16px | Panels, hero areas |
| `--radius-pill` | 99px | Tags, pills, nav items |

**No `border-radius: 0` anywhere.** The sharp-edge era is over.

### Padding Scale

| Token | Value | Use |
|-------|-------|-----|
| `--space-xs` | 8px | Tight inline elements only |
| `--space-sm` | 12px | Compact cards, badges |
| `--space-md` | 16px | Standard cards |
| `--space-lg` | 20px | Panels, sections |
| `--space-xl` | 24px | Hero areas, page margins |

## Surface Modes

### Vibrant

Gradient backgrounds, translucent cards with glow borders, brand gradient on hero elements, gradient-filled position badges.

**Pages:** Dashboard, Landing, Player List, Free Agents, News, Games (Gaffer, On The Plane, KC), Pricing.

**Note:** Player List and Free Agents may become Hybrid later as data density grows. Components are designed to support both modes.

### Calm

Black base, no background gradients. Cards use pillar-colored left borders. Data-ink principle: vivid colors on black for maximum legibility.

**Pages (standalone):** Compare, Formations. Also used as the body section of Hybrid pages (Player Detail, Club Detail).

### Hybrid

Vibrant hero section at top, gradient fade transition, Calm data body below.

**Pages:** Player Detail, Club Detail, Clubs/Leagues browse, Shortlists.

The transition between Vibrant hero and Calm body uses a gradient overlay pseudo-element:

```css
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
```

## Components Affected

### Removed
- `.glass` / `.glass-elevated` classes → replaced by new card system
- `.panel-accent-*` top border classes → replaced by left border system (calm) or gradient glow (vibrant)
- `.section-pip` → replaced by Clash Display uppercase headers
- Glass theme toggle (`[data-theme="glass"]`) → removed entirely
- `ThemeToggle.tsx` → removed

### Replaced
- `SectionHeader` → Clash Display uppercase + optional pillar pip
- `GradeBadge` → Pillar-colored score with new data font
- `PlayerCard` → Trading card aesthetic with gradient position badge, rounded corners
- `FeaturedPlayer` → Vibrant hero with brand gradient score, Clash Display name
- `PaywallGate` / `PlayerTeaser` → Colorful unlock card that makes premium content look desirable
- `LandingPage` → Full vibrant treatment
- `Sidebar` → Updated surfaces and typography
- `MobileBottomNav` → Updated surfaces

### New
- `--font-data` CSS variable (Bricolage+tnum now, Outfit swap later)
- Vibrant/Calm surface mode utilities
- Brand gradient text utility class
- Hybrid page transition (gradient fade)

## CSS Architecture

All tokens live in `globals.css` under the `@theme` block (Tailwind v4). Surface mode is applied via data attribute or CSS class on the page wrapper, not a global theme toggle.

```css
/* Vibrant surface */
.surface-vibrant {
  background: var(--bg-vibrant);
}
.surface-vibrant .card {
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md);
}

/* Calm surface */
.surface-calm .card {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
}
.surface-calm .card[data-pillar] {
  border-left: 3px solid var(--pillar-color);
}
```

## Font Loading (Next.js)

Use `next/font` for optimal loading (no layout shift, automatic subsetting):

```tsx
// app/layout.tsx
import { Bricolage_Grotesque } from 'next/font/google'
import localFont from 'next/font/local'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
})

const clash = localFont({
  src: '../fonts/ClashDisplay-Variable.woff2', // self-hosted from Fontshare
  variable: '--font-display',
  display: 'swap',
})
```

Clash Display must be self-hosted (`public/fonts/`) — Fontshare doesn't have a `next/font` integration. Bricolage uses `next/font/google` for automatic optimization. `--font-data` is set in CSS to alias `--font-body` with `tnum`.

## Migration Strategy

This is a full visual overhaul, not an incremental change. The approach:

1. **Tokens first** — Update `globals.css` with new variables, fonts, remove old classes. Update `--font-sans` and `--font-mono` in the Tailwind `@theme` block — this propagates to all 77+ files using Tailwind font utilities without touching them individually.
2. **Shared components** — Update card/panel/header components to new system
3. **Page by page** — Apply Vibrant/Calm/Hybrid per the surface mapping
4. **Remove old** — Delete glass theme, cyan border system, `ThemeToggle.tsx`. Inter/JetBrains Mono references are removed by the Tailwind `@theme` update in step 1.

### Vibrant card borders

Cards on vibrant backgrounds **must** have `border: 1px solid rgba(255,255,255,0.08)` — without it, `--bg-card` (white/6%) is invisible against the gradient. This is a hard rule, not optional styling.

## Decisions Log

| Decision | Chosen | Alternatives Considered |
|----------|--------|------------------------|
| Design direction | Vibrant Data (A) for impact, Calm (C) for data | Dark Luxe (B), Pitch Black (C) only |
| Display font | Clash Display | Space Grotesk, Sora |
| Body font | Bricolage Grotesque | Inter, DM Sans |
| Data font | Bricolage + tnum (swap to Outfit later) | JetBrains Mono, Plus Jakarta Sans, Chakra Petch |
| Content strategy | Same pages, gated depth | Separate page sets, different routes |
| Pro users | Separate portal (future) | Theme toggle, same app |
