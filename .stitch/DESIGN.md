---
# Chief Scout — Design System v2: Vibrant Data
# Stitch-compatible design brief for UI prototyping

## Atmosphere
Vibrant data storytelling meets football intelligence. Think Spotify Wrapped meets football scouting dashboard — colorful, energetic, human-centered. Two modes: **Vibrant** (default, warm gradient background with translucent cards) and **Calm** (deep black background with pillar-colored left borders for focus).

## Platform
- Web, Desktop-first (responsive to mobile)
- PWA support (add-to-home-screen, offline caching)

## 🎨 Color Palette

### Brand Gradient (Vibrant Mode)
- **Primary Gradient**: #e91e8c → #ff6b35 → #fbbf24 (Pink → Orange → Gold)
- Used for hero sections, featured content, brand moments

### Backgrounds (Vibrant Mode)
- **Base**: Warm Purple-Tinted (#0c0a14) — main page background
- **Surface**: Deep Purple (#161222) — card/panel backgrounds
- **Elevated**: Slightly Lighter (#1a1720) — modals, dropdowns, elevated panels
- **Gradient Overlay**: Linear gradient with brand colors for visual interest

### Backgrounds (Calm Mode)
- **Base**: Pure Black (#000000) — main page background
- **Surface**: Deep Black (#0a0a0a) — card/panel backgrounds with pillar-colored left borders
- **Border Left**: 4px accent color (technical, tactical, mental, or physical)

### Text
- **Primary**: White (#ffffff) — headings, key data
- **Secondary**: Light Gray (#d4d4d4) — body text, descriptions
- **Muted**: Mid Gray (#808080) — captions, metadata, timestamps

### Borders
- **Subtle**: Soft White Tint (rgba(255,255,255,0.08)) — panel borders, dividers
- **Glow**: Subtle Glow (rgba(255,255,255,0.12)) — hover/focus states

### Four-Pillar Accents (core to the product)
- **Technical**: Gold (#fbbf24) — technical ability scores
- **Tactical**: Purple (#a855f7) — tactical intelligence scores
- **Mental**: Teal (#34d399) — mental attribute scores
- **Physical**: Blue (#60a5fa) — physical attribute scores
- **Personality**: Amber (#f59e0b) — personality/MBTI scores

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

### Surface Modes Detail

**Vibrant Mode** (Default)
- Base Gradient: Subtle warm gradient overlay (#0c0a14 + brand colors)
- Cards: Semi-transparent (rgba(22,18,34,0.6)) + backdrop-blur(8px)
- Elevated: Semi-transparent (rgba(26,23,32,0.75)) + backdrop-blur(12px)
- Borders: Subtle white tint (rgba(255,255,255,0.08))
- Visual: Colorful, energetic, brand-forward

**Calm Mode** (Alternative)
- Base: Pure Black (#000000)
- Cards: Deep Black (#0a0a0a) with 4px pillar-colored left border
- Elevated: Slightly raised black (#0f0f0f) with accent border
- Borders: Minimal, accent-focused
- Visual: Focused, monastic, pillar-driven hierarchy

## 🔡 Typography
- **Body**: Bricolage Grotesque — all UI text, body copy, labels
- **Data (Monospace)**: Bricolage Grotesque + tnum (tabular numbers) — data tables, numbers, stats, scores
- **Display/Hero**: Clash Display — page titles, hero text, featured sections (always UPPERCASE)
- **Base size**: 16px (minimum 11px for captions)
- **Headings**: Bricolage Grotesque Semi-Bold/Bold, tracking tight
- **Data values**: Bricolage Grotesque with font-feature-settings: tnum for monospace alignment

## 📐 Components

### Border Radius System
- **Sharp**: 0px (legacy, phased out)
- **Default**: 12px — standard cards, buttons, inputs
- **Small**: 6px — pill buttons, compact elements
- **Large**: 16px — modals, major sections
- **Pill**: 99px — full-round buttons, badges

### Spacing & Sizing
- **Minimum padding**: 12px
- **Minimum text size**: 11px (captions)
- **Default gap**: 16px between sections
- **Compact gap**: 8px for related elements

### Cards (.card, .card-vibrant, .card-elevated, .card-pillar-*)
- **Default (.card)**: Rounded 12px, semi-transparent background, subtle border
- **.card-vibrant**: Vibrant mode card with gradient underlay, translucent surface
- **.card-elevated**: Raised shadow effect, used for overlays and modals
- **.card-pillar-technical**: 4px left border (#fbbf24), optimal for technical data
- **.card-pillar-tactical**: 4px left border (#a855f7), optimal for tactical intelligence
- **.card-pillar-mental**: 4px left border (#34d399), optimal for mental attributes
- **.card-pillar-physical**: 4px left border (#60a5fa), optimal for physical attributes
- **Glass variant**: backdrop-blur(8px) + semi-transparent (Vibrant mode only)

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
- "Vibrant Data design system v2"
- "Warm purple-tinted surfaces (#0c0a14, #161222) or pure black calm mode"
- "Brand gradient: #e91e8c → #ff6b35 → #fbbf24 (pink → orange → gold)"
- "Four-pillar color system: gold #fbbf24 (technical), purple #a855f7 (tactical), teal #34d399 (mental), blue #60a5fa (physical)"
- "Typography: Bricolage Grotesque for body/data, Clash Display (UPPERCASE) for display/hero"
- "Border radius: 12px default, 6px small, 16px large, 99px pill"
- "Translucent cards with subtle white borders (rgba(255,255,255,0.08))"
- "Minimum padding 12px, minimum text 11px"
- "Two modes: Vibrant (gradient + translucent cards) or Calm (black + pillar borders)"
