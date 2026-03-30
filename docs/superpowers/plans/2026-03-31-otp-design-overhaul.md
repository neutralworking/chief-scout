# OTP Design Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform OTP from a functional prototype into a polished, mobile-first squad-picking game with professional branding, proper step navigation, and an emotionally satisfying reveal moment.

**Architecture:** Pure frontend — no API changes. All work is in 2 page files + globals.css. Nations page gets card visual upgrades. Squad builder gets restructured to mobile-first stacked layout with a 3-step progress bar, pitch-based XI selection, and animated reveal. Emoji plane replaced with branded SVG + display font typography throughout.

**Tech Stack:** Next.js (React 19), Tailwind CSS, CSS custom properties (design tokens from globals.css), `var(--font-display)` = Clash Display

---

## Design Tokens Reference

All new styles must use existing tokens only:

| Token | Value | Use |
|---|---|---|
| `--bg-base` | #000000 | Page background |
| `--bg-surface` | #0c0a14 | Card bg |
| `--bg-elevated` | #161222 | Highlighted row bg |
| `--bg-card` | rgba(255,255,255,0.06) | Translucent card |
| `--text-primary` | #ffffff | Headings, names |
| `--text-secondary` | rgba(255,255,255,0.65) | Body text |
| `--text-muted` | rgba(255,255,255,0.45) | Labels, captions |
| `--border-subtle` | rgba(255,255,255,0.08) | Default borders |
| `--border-bright` | #e91e8c | Accent border |
| `--gradient-brand` | linear-gradient(135deg, #e91e8c, #ff6b35, #fbbf24) | Brand gradient |
| `--font-display` | Clash Display | Headings, titles |
| `--radius-md` | 12px | Card border-radius |
| `--radius-pill` | 99px | Pill buttons |

Existing animations: `fadeIn` (0.3s), `slideUp` (0.4s), `popIn` (0.3s), `barSlideIn` (from 0%).

Strength color mapping (keep existing):
- ≥75 → `--color-accent-technical` (gold)
- ≥55 → `--color-accent-tactical` (purple)
- ≥35 → `--color-accent-mental` (green)
- <35 → `--color-accent-physical` (blue)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/app/globals.css` | Modify | Add OTP-specific keyframes (scoreCountUp, revealSlide) |
| `apps/web/src/app/on-the-plane/page.tsx` | Modify | Nations index — branded hero, enhanced cards |
| `apps/web/src/app/on-the-plane/[nationSlug]/page.tsx` | Modify | Squad builder — mobile layout, step bar, pitch XI, animated reveal |

No new files. No new dependencies.

---

## Task 1: Branded Hero + Professional Typography (Nations Page)

**Files:**
- Modify: `apps/web/src/app/on-the-plane/page.tsx:60-80`

Replace the emoji ✈️ hero with a clean SVG plane icon + Clash Display title + brand gradient.

- [ ] **Step 1: Replace hero section**

Remove the emoji and plain text. Replace with:

```tsx
{/* Hero */}
<div className="px-4 pt-10 pb-6 text-center max-w-3xl mx-auto">
  {/* Geometric plane icon */}
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 opacity-80">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" fill="url(#otp-grad)"/>
    <defs>
      <linearGradient id="otp-grad" x1="2" y1="3" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#e91e8c"/>
        <stop offset="0.5" stopColor="#ff6b35"/>
        <stop offset="1" stopColor="#fbbf24"/>
      </linearGradient>
    </defs>
  </svg>
  <h1
    className="text-3xl sm:text-4xl font-bold uppercase tracking-[3px] mb-3"
    style={{ fontFamily: "var(--font-display)", background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
  >
    On The Plane
  </h1>
  <p className="text-sm sm:text-base mb-1" style={{ color: "var(--text-secondary)" }}>
    Pick your 26-man World Cup squad. Choose your starting XI.
  </p>
  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
    Then see how your picks compare to the Chief Scout&apos;s ideal selection.
  </p>
</div>
```

Key decisions:
- SVG plane uses `--gradient-brand` colours as a linearGradient fill
- Title uses `--font-display` (Clash Display) with wide tracking — matches `SectionHeader` pattern
- `text-gradient-brand` class exists in globals but inline here because we need `uppercase` + tracking together

- [ ] **Step 2: Verify renders correctly**

Visual check: gradient plane icon above "ON THE PLANE" in display font with brand gradient text.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/on-the-plane/page.tsx
git commit -m "feat(otp): replace emoji plane with branded SVG + display font hero"
```

---

## Task 2: Enhanced Nation Cards (Nations Page)

**Files:**
- Modify: `apps/web/src/app/on-the-plane/page.tsx:132-224`

Add strength-based left border accent, larger flag, FIFA ranking as a seed-style badge, and hover glow.

- [ ] **Step 1: Update card rendering**

Replace the card content and wrapper. Key changes:

1. **Left border** colored by strength tier (same as `card-pillar-*` pattern):
```tsx
borderLeft: `3px solid ${strengthColor(nation.strength)}`
```

2. **Flag emoji larger** — bump from `text-2xl` to `text-3xl`

3. **FIFA ranking badge** gets a subtle background tint:
```tsx
<span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
  #{nation.fifa_ranking}
</span>
```

4. **Hover state** adds strength-color glow:
```tsx
// On the Link wrapper, add onMouseEnter/Leave or use CSS class
style={{
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderLeft: `3px solid ${strengthColor(nation.strength)}`,
}}
```

5. **Disabled cards** (thin pool) keep no left border accent — just dim.

6. **Player count + squads picked** merge into one line to save space.

- [ ] **Step 2: Verify renders correctly**

Cards should show: coloured left border by strength, larger flag, pill-style ranking badge, strength bar, meta line.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/on-the-plane/page.tsx
git commit -m "feat(otp): enhanced nation cards with strength borders and visual hierarchy"
```

---

## Task 3: Add OTP Keyframes to globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css` — add after existing `@keyframes barSlideIn`

- [ ] **Step 1: Add new keyframes**

```css
/* OTP reveal animations */
@keyframes scoreCountUp {
  from { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.15); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes tierReveal {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes statCardReveal {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.otp-score-reveal { animation: scoreCountUp 0.6s ease-out forwards; }
.otp-tier-reveal { animation: tierReveal 0.4s ease-out 0.5s forwards; opacity: 0; }
.otp-stat-reveal { animation: statCardReveal 0.4s ease-out forwards; opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .otp-score-reveal,
  .otp-tier-reveal,
  .otp-stat-reveal {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

Follows existing patterns: `ease-out`, 0.3–0.6s duration, `forwards` fill, reduced-motion fallback.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(otp): add reveal animation keyframes"
```

---

## Task 4: Step Progress Bar (Squad Builder)

**Files:**
- Modify: `apps/web/src/app/on-the-plane/[nationSlug]/page.tsx`

Add a 3-step progress indicator below the sticky header on all steps. Inline component (no separate file — used once).

- [ ] **Step 1: Add StepBar component above the main export**

```tsx
const STEPS: { key: Step; label: string }[] = [
  { key: "pick-squad", label: "Squad" },
  { key: "pick-xi", label: "Starting XI" },
  { key: "reveal", label: "Results" },
];

function StepBar({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-1 py-2 px-4"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && (
              <div className="w-8 h-px" style={{ background: done ? "var(--color-accent-personality)" : "var(--border-subtle)" }} />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: done ? "var(--color-accent-personality)" : active ? "var(--bg-elevated)" : "transparent",
                  border: `1.5px solid ${done || active ? "var(--color-accent-personality)" : "var(--border-subtle)"}`,
                  color: done ? "var(--bg-base)" : active ? "var(--color-accent-personality)" : "var(--text-muted)",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className="text-[10px] hidden sm:inline"
                style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Insert `<StepBar current={step} />` into each step's header**

Place it immediately after the sticky header `<div>` in each step, inside the same sticky container (so it scrolls with the header). For the reveal step (no sticky header), place it at the top.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/on-the-plane/[nationSlug]/page.tsx
git commit -m "feat(otp): add 3-step progress bar"
```

---

## Task 5: Mobile-First Squad Builder Layout

**Files:**
- Modify: `apps/web/src/app/on-the-plane/[nationSlug]/page.tsx` — the `pick-squad` step (lines ~388-632)

Currently: side-by-side `w-1/2` pitch + squad list = broken on mobile.
Target: stacked layout — collapsible pitch above, squad count summary, then player list.

- [ ] **Step 1: Replace the split layout with stacked mobile layout**

Remove the `<div className="flex gap-3">` with `w-1/2` children. Replace with:

**A) Collapsible pitch section:**
```tsx
const [pitchOpen, setPitchOpen] = useState(false);
```

```tsx
{/* Pitch toggle */}
<div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
  <button
    onClick={() => setPitchOpen(!pitchOpen)}
    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer"
    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
  >
    <div className="flex items-center gap-2">
      <span style={{ color: "var(--text-secondary)" }}>Formation Preview</span>
      <span className="font-mono" style={{ color: "var(--color-accent-personality)" }}>{formation}</span>
    </div>
    <div className="flex items-center gap-3">
      {/* Inline balance counts */}
      {Object.entries(squadBalance).map(([grp, cnt]) => (
        <span key={grp} className="text-[10px] font-mono" style={{ color: cnt > 0 ? "var(--text-secondary)" : "var(--text-muted)" }}>
          {grp} {cnt}
        </span>
      ))}
      <span style={{ color: "var(--text-muted)" }}>{pitchOpen ? "▲" : "▼"}</span>
    </div>
  </button>

  {pitchOpen && (
    <div className="mt-2 animate-slideUp">
      {/* Pitch — same as before but full width */}
      <div className="rounded-lg p-3 flex flex-col justify-between relative"
        style={{ background: "linear-gradient(180deg, #0d3b1e 0%, #0a2e17 100%)", border: "1px solid rgba(111,195,223,0.15)", minHeight: "280px" }}>
        {/* ...pitch rows same as existing... */}
      </div>
      {/* Bench under pitch */}
      {benchPlayers.length > 0 && (
        <div className="mt-2 rounded-lg p-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          {/* ...bench same as existing... */}
        </div>
      )}
    </div>
  )}
</div>
```

**B) Balance warnings** — move into the sticky header area (already there in balance bar).

**C) Formation selector** — move from the tiny inline `<select>` to the collapsible pitch section.

Key decisions:
- Pitch collapsed by default on mobile — the primary task is picking players, not seeing the pitch
- Full-width pitch when expanded (no more `w-1/2`)
- `animate-slideUp` from existing globals for expand animation
- Balance counts visible in the collapsed bar so user always sees GK/DEF/MID/FWD distribution
- Formation picker stays in the pitch toggle row

- [ ] **Step 2: Simplify the sticky header**

Remove the balance bar and formation selector from the header (moved to pitch toggle). Header becomes:

```tsx
<div className="sticky top-0 z-10" style={{ background: "var(--bg-surface)" }}>
  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
    <div className="max-w-5xl mx-auto flex items-center justify-between">
      <Link href="/on-the-plane" className="text-xs" style={{ color: "var(--text-muted)" }}>← Nations</Link>
      <div className="text-center">
        <h1 className="text-sm font-bold uppercase tracking-[1px]"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
          Pick Your Squad
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{selectedIds.size}/26</p>
      </div>
      <button onClick={() => selectedIds.size === 26 && setStep("pick-xi")}
        disabled={selectedIds.size !== 26}
        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: "var(--color-accent-personality)", color: "var(--bg-base)" }}>
        Next →
      </button>
    </div>
  </div>
  <StepBar current={step} />
</div>
```

Note: ✈️ emoji removed from header, replaced with display font treatment.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/on-the-plane/[nationSlug]/page.tsx
git commit -m "feat(otp): mobile-first stacked layout with collapsible pitch"
```

---

## Task 6: Pitch-Based XI Selection

**Files:**
- Modify: `apps/web/src/app/on-the-plane/[nationSlug]/page.tsx` — the `pick-xi` step (lines ~637-790)

Currently: flat list with XI badges. Target: the pitch IS the selection UI — tap slots to assign players.

- [ ] **Step 1: Restructure XI picker**

The step keeps the formation picker + the pitch at the top, but now:
- Pitch is full-width and taller (360px) — this is the primary UI
- Each slot shows the assigned player OR an empty slot button
- Tapping an empty slot opens a position-filtered player drawer below
- Tapping a filled slot deselects that player

The XI pitch reuses `pitchRows` but maps against `xiIds` instead of all selected:

```tsx
const xiPitchSlots = useMemo(() => {
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS["4-3-3"];
  const squadPlayers = nationData!.players.filter((p) => selectedIds.has(p.person_id));
  const used = new Set<number>();
  return slots.map((slotPos, idx) => {
    // Only show players that are in the XI
    const candidate = squadPlayers
      .filter((p) => !used.has(p.person_id) && xiIds.has(p.person_id) && p.position === slotPos)
      .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
    if (candidate) {
      used.add(candidate.person_id);
      return { slot: slotPos, idx, player: candidate };
    }
    return { slot: slotPos, idx, player: null };
  });
}, [nationData, selectedIds, xiIds, formation]);
```

**Pitch layout** — full width, taller:
```tsx
<div className="rounded-lg p-4 flex flex-col justify-between relative"
  style={{
    background: "linear-gradient(180deg, #0d3b1e 0%, #0a2e17 100%)",
    border: "1px solid rgba(111,195,223,0.15)",
    minHeight: "320px",
  }}>
  {/* ...same pitch rows but with larger slots (w-9 h-9 circles, text-[9px] names)... */}
</div>
```

Below the pitch, show **unassigned squad players** grouped by position, tappable to add to XI:

```tsx
<div className="mt-3 space-y-1">
  <div className="text-[10px] font-bold uppercase tracking-wider px-1"
    style={{ color: "var(--text-muted)" }}>
    Bench — tap to start ({11 - xiIds.size} spots left)
  </div>
  {squadPlayers.filter(p => !xiIds.has(p.person_id)).sort(/*pos order*/).map(p => (
    <button key={p.person_id} onClick={() => toggleXI(p.person_id)}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", opacity: xiIds.size >= 11 ? 0.4 : 1 }}>
      {/* position badge + name + level */}
    </button>
  ))}
</div>
```

- [ ] **Step 2: Update header for XI step**

Same pattern: display font, no emoji, StepBar:

```tsx
<h1 className="text-sm font-bold uppercase tracking-[1px]"
  style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
  Pick Your XI
</h1>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/on-the-plane/[nationSlug]/page.tsx
git commit -m "feat(otp): pitch-based XI selection with formation slots"
```

---

## Task 7: Animated Reveal

**Files:**
- Modify: `apps/web/src/app/on-the-plane/[nationSlug]/page.tsx` — the `reveal` step (lines ~793-1063)

- [ ] **Step 1: Add score count-up hook**

Above the main component, add a counter hook:

```tsx
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}
```

- [ ] **Step 2: Redesign the reveal section**

Replace the plain score display with:

```tsx
const displayScore = useCountUp(comparison?.score ?? 0);
```

```tsx
{/* Score reveal */}
<div className="otp-score-reveal">
  <div className="text-6xl sm:text-7xl font-bold font-mono mb-2"
    style={{
      fontFamily: "var(--font-display)",
      color: scoreColor, /* same existing color logic */
    }}>
    {displayScore}
  </div>
</div>

{/* Tier reveal — delayed */}
<div className="otp-tier-reveal">
  <p className="text-lg font-semibold uppercase tracking-[2px] mb-6"
    style={{ fontFamily: "var(--font-display)", color: scoreColor }}>
    {comparison.tier}
  </p>
</div>
```

The 3 stat cards (squad matches, XI matches, formation) get staggered reveal:

```tsx
<div className="flex justify-center gap-3 sm:gap-4 mb-6">
  {[
    { value: `${comparison.squad_matches}/26`, label: "Squad" },
    { value: `${comparison.xi_matches}/11`, label: "XI" },
    { value: comparison.formation_match ? "✓" : "✗", label: "Formation" },
  ].map((stat, i) => (
    <div key={stat.label}
      className="otp-stat-reveal px-4 py-3 rounded-xl text-center"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        animationDelay: `${0.8 + i * 0.15}s`,
      }}>
      <div className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
        {stat.value}
      </div>
      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {stat.label}
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Replace header with branded treatment**

Remove emoji from reveal header:

```tsx
<div className="px-4 pt-10 pb-6 text-center max-w-3xl mx-auto">
  <StepBar current="reveal" />
  <div className="mt-6">
    <h1 className="text-2xl font-bold uppercase tracking-[2px] mb-4"
      style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
      The Results Are In
    </h1>
  </div>
  {/* ...score, tier, stats... */}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/on-the-plane/[nationSlug]/page.tsx
git commit -m "feat(otp): animated score reveal with count-up and staggered stats"
```

---

## Summary of Changes

| Change | Impact | Files |
|---|---|---|
| Branded hero (SVG + display font) | Professional top-of-page | page.tsx |
| Nation card enhancements | Visual hierarchy, strength borders | page.tsx |
| OTP keyframes | Reveal animations | globals.css |
| Step progress bar | Navigation clarity | [nationSlug]/page.tsx |
| Mobile-first stacked layout | Usable on phone | [nationSlug]/page.tsx |
| Pitch-based XI selection | Interactive formation | [nationSlug]/page.tsx |
| Animated reveal | Emotional payoff | [nationSlug]/page.tsx |

All changes use existing design tokens. No new fonts, colours, or dependencies introduced.
