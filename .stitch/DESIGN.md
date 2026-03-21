---
# Chief Scout — Design System
# Stitch-compatible design brief for UI prototyping

## Atmosphere
Dark, professional scouting intelligence dashboard. Think Bloomberg Terminal meets Football Manager — data-dense, high-contrast, no-nonsense. Two modes: **High Contrast** (default, pure black) and **Glass** (frosted blur panels over deep navy).

## Platform
- Web, Desktop-first (responsive to mobile)
- PWA support (add-to-home-screen, offline caching)

## 🎨 Color Palette

### Backgrounds
- **Base**: Pure Black (#000000) — main page background
- **Surface**: Dark Gray (#1e1e1e) — card/panel backgrounds
- **Elevated**: Slightly Lighter (#252526) — modals, dropdowns, elevated panels

### Text
- **Primary**: White (#ffffff) — headings, key data
- **Secondary**: Light Gray (#d4d4d4) — body text, descriptions
- **Muted**: Mid Gray (#808080) — captions, metadata, timestamps

### Borders
- **Subtle**: Cyan Tint (#6fc3df) — panel borders, dividers
- **Glow**: Cyan Glow (rgba(111,195,223,0.25)) — hover/focus states

### Four-Pillar Accents (core to the product)
- **Technical**: Amber/Gold (#d4a035) — technical ability scores
- **Tactical**: Purple (#9b59b6) — tactical intelligence scores
- **Mental**: Green (#3dba6f) — mental attribute scores
- **Physical**: Blue (#4a90d9) — physical attribute scores
- **Personality**: Yellow (#e8c547) — personality/MBTI scores

### Pursuit Status
- **Priority**: Red (#e74c3c) — must-sign targets
- **Interested**: Gold (#d4a035) — active interest
- **Watch**: Blue (#4a90d9) — monitoring
- **Scout Further**: Green (#3dba6f) — needs more data
- **Pass**: Muted (#555570) — rejected
- **Monitor**: Light Muted (#8888aa) — passive tracking

### Tiers
- **Tier 1**: Gold (#e8c547) — scout-assessed, complete profiles
- **Tier 2**: Muted (#8888aa) — data-derived
- **Tier 3**: Dark Muted (#555570) — skeleton profiles

### Glass Theme (opt-in)
- Base: Deep Navy (#06060c)
- Surface: Semi-transparent (rgba(18,18,35,0.7)) + backdrop-blur(16px)
- Elevated: Semi-transparent (rgba(30,30,55,0.6)) + backdrop-blur(12px)
- Borders: Faint purple (rgba(60,60,100,0.25))

## 🔡 Typography
- **Sans**: Inter — all UI text
- **Monospace**: JetBrains Mono — data tables, code, IDs
- **Base size**: 16px
- **Headings**: Inter Semi-Bold/Bold, tracking tight
- **Data values**: JetBrains Mono for numbers, scores, stats

## 📐 Components

### Cards (.glass)
- Background: var(--bg-surface), 1px border var(--border-subtle)
- No border-radius (sharp, angular feel) or very subtle (4px max)
- Content-dense: multiple data rows per card

### Player Cards (signature component)
- 3-row layout: Position + Name + Overall → Flag + Club + Age + Archetype → 4 Pillar Scores + Role + Value
- Border color = dominant pillar color
- Overall score color-coded by strongest pillar

### Buttons
- Minimal, ghost-style default (border only)
- Accent colors for primary actions
- Small, compact sizing

### Navigation
- Sidebar on desktop (collapsible)
- Bottom tab bar on mobile (5 items max)
- No hamburger menu — direct access

### Data Tables
- Monospace font for numbers
- Alternating row backgrounds (surface/elevated)
- Sortable columns with subtle indicators
- Pillar-colored cells for scores

### Animations
- fadeIn: 0.3s ease-out (content appearing)
- slideUp: 0.4s ease-out (cards entering)
- glowPulse: border glow for interactive elements
- Respect prefers-reduced-motion

## 🏟️ Domain-Specific Patterns

### Position Badges
- Short codes: GK, WD, CD, DM, CM, WM, AM, WF, CF
- Each position has a distinct background color
- Always uppercase, monospace

### Radar Charts
- 13-point archetype radar (Controller to GK)
- Four-pillar bar charts
- Fingerprint percentile plots

### Score Display
- Overall: large number (36px+), pillar-colored
- Pillar scores: 4 inline colored badges
- Grade scales: 0-100 with color ramps

---
💡 **Stitch Usage**: When calling `generate_screen_from_text`, always include:
- "Dark theme, pure black background (#000)"
- "Four-pillar color system: gold for technical, purple for tactical, green for mental, blue for physical"
- "Data-dense, Bloomberg Terminal aesthetic"
- "Inter font family, JetBrains Mono for data"
- "Glass panel borders with cyan tint"
