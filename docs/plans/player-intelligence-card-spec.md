# Player Intelligence Card — Prototype Specification

**Date:** 2026-03-09
**Status:** Draft
**Author:** Design Manager
**Supersedes:** `docs/plans/2026-03-09-player-viewer-design.md` (player detail section only)
**Design Principle:** "Sophistication Simplified" — progressive disclosure at every layer.

---

## Table of Contents

1. [Player Intelligence Card — Layout Spec](#1-player-intelligence-card--layout-spec)
2. [Player List Card — Condensed Version](#2-player-list-card--condensed-version)
3. [News Modal Spec](#3-news-modal-spec)
4. [Progressive Disclosure Layers](#4-progressive-disclosure-layers)
5. [Tier Badge System](#5-tier-badge-system)
6. [Component Inventory](#6-component-inventory)

---

## Design Context

The CEO directive (2026-03-09) reframes the player detail page as a **Player Intelligence Card** — a single-page scouting dossier that leads with personality and archetype, not stats. The old v1 design placed compound metric gauges first; this spec inverts that hierarchy entirely.

The new information hierarchy:

1. **Personality badge** — the hero element
2. **Archetype scoring** — the player's visual signature / "shape"
3. **Key Moments** — the evidence layer (3-5 per player, click for news modal)
4. **Market position** — valuation (true MVT vs market premium)
5. **Attribute detail** — the depth (drill-down only)

---

## Visual Foundations

### Color System

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#0a0a0f` | Page background |
| `--bg-surface` | `#1a1a2e` | Card surfaces |
| `--bg-elevated` | `#252540` | Hover states, modals |
| `--border-subtle` | `#2a2a45` | Card borders |
| `--text-primary` | `#f0f0f5` | Headings, names |
| `--text-secondary` | `#8888aa` | Labels, metadata |
| `--accent-personality` | `#e8c547` | Gold — personality badge, hero element |
| `--accent-mental` | `#4a90d9` | Blue — Mental compound category |
| `--accent-physical` | `#d4a035` | Amber — Physical compound category |
| `--accent-tactical` | `#3dba6f` | Green — Tactical compound category |
| `--accent-technical` | `#9b59b6` | Purple — Technical compound category |
| `--sentiment-positive` | `#3dba6f` | Positive moment/story sentiment |
| `--sentiment-negative` | `#e74c3c` | Negative moment/story sentiment |
| `--sentiment-neutral` | `#8888aa` | Neutral sentiment |

### Typography

| Element | Font | Size | Weight | Tracking |
|---------|------|------|--------|----------|
| Player name | Inter | 28px / 1.75rem | 700 | -0.02em |
| Personality code | JetBrains Mono | 36px / 2.25rem | 800 | 0.08em |
| Personality label | Inter | 16px / 1rem | 500 | 0.02em |
| Section headings | Inter | 14px / 0.875rem | 600 | 0.06em (uppercase) |
| Body text | Inter | 14px / 0.875rem | 400 | normal |
| Score numbers | JetBrains Mono | 20px / 1.25rem | 600 | 0 |
| Metadata | Inter | 12px / 0.75rem | 400 | 0.02em |

### Spacing Scale

Base unit: 4px. Commonly used: 4, 8, 12, 16, 24, 32, 48, 64.

---

## 1. Player Intelligence Card — Layout Spec

The Intelligence Card is the full detail view at `/players/[id]`. It is a single scrollable page divided into five hierarchical zones.

### ASCII Layout — Desktop (min-width: 1024px)

```
+------------------------------------------------------------------+
|  ZONE A: IDENTITY BAR                                             |
|  +------+ +--------------------+ +------+ +--------+ +---------+ |
|  | Photo | | Name               | | Pos  | | Club   | | Nation  | |
|  | 80x80 | | Age / DOB          | | Lvl  | | Badge  | | Flag    | |
|  +------+ | Height / Foot      | | Peak | +--------+ +---------+ |
|            +--------------------+ +------+   [Pursuit Badge]      |
|                                               [Tier Badge]        |
+------------------------------------------------------------------+
|                                                                    |
|  ZONE B: PERSONALITY + ARCHETYPE (hero section)                   |
|  +-----------------------------+  +-----------------------------+ |
|  | PERSONALITY (WHO)           |  | ARCHETYPE (HOW)             | |
|  |                             |  |                             | |
|  |    ┌──────────────┐         |  |  Archetype: "Engine"        | |
|  |    │  E N T J     │  gold   |  |  Confidence: ●●●○ high     | |
|  |    │              │  badge   |  |                             | |
|  |    │ The Commander│         |  |  Model Fit Bars:            | |
|  |    └──────────────┘         |  |  ████████░░ Controller  72  | |
|  |                             |  |  ██████████ Engine      91  | |
|  |  E ████████░░░░░ I   72    |  |  ██████░░░░ Creator     58  | |
|  |  S ██████░░░░░░░ N   48    |  |  ████████░░ Cover       70  | |
|  |  T ██████████░░░ F   81    |  |  ██████████ Destroyer   88  | |
|  |  J █████████░░░░ P   74    |  |  ████████░░ Dribbler    69  | |
|  |                             |  |  ...                        | |
|  |  Competitiveness: ●●●●● 92 |  |                             | |
|  |  Coachability:    ●●●○○ 65 |  |  [Blueprint excerpt]        | |
|  |                             |  |                             | |
|  |  "Natural leader who        |  |  "High-intensity midfielder | |
|  |   thrives under pressure    |  |   who controls tempo and    | |
|  |   and drives standards."    |  |   presses relentlessly."    | |
|  +-----------------------------+  +-----------------------------+ |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  ZONE C: KEY MOMENTS (evidence layer)                             |
|                                                                    |
|  KEY MOMENTS                                          [See All →] |
|  ┌─────┐                                                          |
|  │ ● + │ Derby della Mole solo goal         2025-10-26   [click]  |
|  │ ● - │ Contract dispute with board        2025-09-14   [click]  |
|  │ ● + │ Champions League hat-trick         2025-08-03   [click]  |
|  │ ● + │ Called up for senior NT debut       2025-07-01   [click]  |
|  └─────┘                                                          |
|   ● = sentiment dot (green/red/gray)                              |
|   Clicking any moment opens NewsModal (see Section 3)             |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  ZONE D: MARKET POSITION                                          |
|  +---------------------------+  +------------------------------+  |
|  | VALUATION                 |  | MARKET CONTEXT               |  |
|  |                           |  |                              |  |
|  | Market Value Tier: ██ B   |  | Scarcity: ████████░░ 78     |  |
|  | True MVT:          ██ B+  |  | HG Status: Yes / No         |  |
|  | Market Premium:    +12%   |  | Transfer Fee: EUR 35M        |  |
|  |                           |  | Contract Status: [tag]       |  |
|  | Verdict: UNDERVALUED      |  | Loan Status: [tag]           |  |
|  +---------------------------+  +------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  ZONE E: ATTRIBUTE DETAIL (collapsed by default — drill-down)     |
|                                                                    |
|  ▶ Mental    72   ▶ Physical   68   ▶ Tactical   80   ▶ Tech  65 |
|    (blue)           (amber)           (green)           (purple)   |
|                                                                    |
|  [Clicking any gauge expands Layer 2 → 3 → 4 below. See Sec 4]   |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  ZONE F: SUPPLEMENTARY (tabs or collapsible)                      |
|                                                                    |
|  [Status Tags] [Scouting Notes] [Similar Players] [News Feed]    |
|                                                                    |
+------------------------------------------------------------------+
```

### Zone-by-Zone Specification

#### Zone A: Identity Bar

| Property | Value |
|----------|-------|
| **Position** | Fixed top of card, always visible |
| **Height** | 96px desktop, 80px mobile |
| **Background** | `--bg-surface` with bottom border `--border-subtle` |
| **Data source** | `player_intelligence_card` view (people + clubs + nations) |
| **Component** | `<PlayerIdentityBar>` |

Contents:
- **Photo placeholder**: 80x80 rounded square, `--bg-elevated` with initials fallback
- **Name**: `--text-primary`, 28px bold
- **Metadata row**: Age (computed from dob), height_cm, preferred_foot in `--text-secondary`
- **Position badge**: Colored pill using position enum (GK/WD/CD/DM/CM/WM/AM/WF/CF)
- **Level/Peak**: Two small vertical bars, numerically labeled
- **Club badge + Nation flag**: 24px inline icons
- **Pursuit status badge**: Top-right corner. Color-coded pill (Priority=red, Interested=amber, Watch=blue, Pass=gray)
- **Tier badge**: Below pursuit badge. See Section 5.

#### Zone B: Personality + Archetype (Hero Section)

This is the hero. It occupies the most visual real estate after the identity bar.

| Property | Value |
|----------|-------|
| **Position** | Immediately below identity bar, above fold |
| **Layout** | Two-column on desktop (50/50), stacked on mobile |
| **Background** | `--bg-base` with a subtle gradient wash from `--accent-personality` at 5% opacity |
| **Min height** | 320px desktop |
| **Component** | `<PlayerIdentityPanel>` wrapping `<PersonalityBadge>` + `<ArchetypeShape>` |

##### Left Column: Personality (WHO)

| Element | Spec |
|---------|------|
| **4-letter code** | `--accent-personality` (gold), 36px monospace, letter-spaced, centered in a bordered box with subtle gold glow (`box-shadow: 0 0 20px rgba(232,197,71,0.15)`) |
| **Type label** | Below code. "The Commander" in 16px medium weight, `--text-primary` |
| **Dimension bars** | Four horizontal bars, each showing the spectrum. Left label (E/S/T/J) and right label (I/N/F/P). Fill color: `--accent-personality` at 60% opacity. Score number at the dominant end. Bar width: 200px desktop, full-width mobile. |
| **Competitiveness** | Dot indicator (5 dots, filled = score/20). Label + score. |
| **Coachability** | Same dot indicator pattern. |
| **Summary text** | 2-3 sentence plain-English paragraph in `--text-secondary`, 14px. Describes what this personality means for playing style and adaptability. Stored as part of scouting notes or generated from type. |
| **Data source** | `player_personality` table: ei, sn, tf, jp, competitiveness, coachability. Type computed in `player_intelligence_card` view. |
| **Component** | `<PersonalityBadge>` (reusable, accepts `size` prop: `hero` or `compact`) |

Personality type names (all 16):

| Code | Name | One-liner |
|------|------|-----------|
| ESTJ | The Director | Organized, commanding, drives structure and accountability |
| ENTJ | The Commander | Strategic leader who thrives under pressure |
| ESFJ | The Captain | Supportive leader, team-first, vocal organizer |
| ENFJ | The Mentor | Inspires teammates, emotionally intelligent, leads by example |
| ESTP | The Maverick | Bold risk-taker, thrives in chaos, instinctive |
| ENTP | The Innovator | Creative disruptor, unpredictable, challenges conventions |
| ESFP | The Showman | Expressive, flair-driven, feeds off the crowd |
| ENFP | The Spark | Energetic, imaginative, lifts the dressing room |
| ISTJ | The Professional | Reliable, disciplined, consistent performer |
| INTJ | The Architect | Calculated, self-driven, sees the game three moves ahead |
| ISFJ | The Guardian | Selfless, dependable, quietly holds the team together |
| INFJ | The Visionary | Intuitive, purposeful, reads the game deeply |
| ISTP | The Operator | Cool under pressure, mechanically efficient, adaptable |
| INTP | The Analyst | Cerebral, reads patterns, sometimes overthinks |
| ISFP | The Artist | Elegant, expressive, plays with aesthetic instinct |
| INFP | The Idealist | Driven by personal values, emotionally invested |

##### Right Column: Archetype (HOW)

| Element | Spec |
|---------|------|
| **Primary archetype** | Name (e.g., "Engine") in 20px semibold, `--text-primary`. Below: confidence indicator as 4 dots (high=3 filled, medium=2, low=1). |
| **Model fit bars** | All 13 models listed vertically. Each bar: label left, score right, fill color mapped to its compound category (`--accent-mental`, `--accent-physical`, `--accent-tactical`, `--accent-technical`). Sorted by score descending to create a visual "shape" — the player's signature profile. Bar height: 24px with 4px gap. |
| **Blueprint excerpt** | First 2 sentences of `player_profiles.blueprint` in `--text-secondary`, 14px. "Read more" link expands to full text. |
| **Data source** | `player_profiles`: archetype, model_id, blueprint, profile_tier. Model scores from `attribute_grades` aggregated per model. |
| **Component** | `<ArchetypeShape>` |

**Model-to-compound mapping** (for bar coloring):

| Compound | Models | Color |
|----------|--------|-------|
| Mental | Controller, Commander, Creator | `--accent-mental` (blue) |
| Physical | Target, Sprinter, Powerhouse | `--accent-physical` (amber) |
| Tactical | Cover, Engine, Destroyer | `--accent-tactical` (green) |
| Technical | Dribbler, Passer, Striker | `--accent-technical` (purple) |

#### Zone C: Key Moments

| Property | Value |
|----------|-------|
| **Position** | Below hero section |
| **Layout** | Full-width list, max 5 items shown (expandable) |
| **Background** | `--bg-surface` card |
| **Component** | `<KeyMomentsList>` |

Each moment row:
- **Sentiment dot**: 8px circle, color-coded (`--sentiment-positive/negative/neutral`)
- **Title**: 14px semibold, `--text-primary`. Truncate at 60 chars with ellipsis.
- **Moment type**: Pill badge in `--text-secondary` background (goal / assist / performance / controversy / milestone)
- **Date**: Right-aligned, `--text-secondary`, 12px, formatted as "26 Oct 2025"
- **Click target**: Entire row is clickable. Hover: `--bg-elevated`. Cursor: pointer. Opens `<NewsModal>`.
- **Data source**: `key_moments` table joined to `news_stories`
- **Empty state**: "No key moments recorded yet" in `--text-secondary` with muted icon

If more than 5 moments exist, show a "See All" link that expands the list inline (no pagination).

#### Zone D: Market Position

| Property | Value |
|----------|-------|
| **Position** | Below key moments |
| **Layout** | Two-column on desktop, stacked on mobile |
| **Background** | `--bg-surface` card |
| **Component** | `<MarketPosition>` |

Left column — Valuation:
- **Market Value Tier**: Letter grade (A+, A, B+, B, C+, C, D) in a 32px badge
- **True MVT**: Same format. If different from market tier, highlight the delta.
- **Market Premium**: Percentage with directional arrow. Green if positive (overvalued = sell opportunity), red if negative (undervalued = buy opportunity).
- **Verdict line**: "UNDERVALUED" / "FAIR VALUE" / "OVERVALUED" in uppercase 12px semibold. Colored accordingly.

Right column — Market Context:
- **Scarcity Score**: Horizontal bar 0-100 with numeric label
- **HG Status**: Boolean badge (Home Grown: Yes/No)
- **Transfer Fee**: Formatted EUR value or "N/A"
- **Contract/Loan tags**: Pill badges from `player_status`

**Data source**: `player_market` + `player_status`

#### Zone E: Attribute Detail (Collapsed)

| Property | Value |
|----------|-------|
| **Position** | Below market position |
| **Layout** | Four inline gauges (collapsed state) |
| **Default state** | Collapsed — shows only 4 category averages |
| **Component** | `<CompoundMetrics>` |

Collapsed state: Four circular gauge indicators in a row, each showing:
- Category name (Mental / Physical / Tactical / Technical)
- Category color as gauge fill
- Score number centered
- Click/tap to expand (see Progressive Disclosure, Section 4)

**Data source**: `attribute_grades` aggregated by model and compound

#### Zone F: Supplementary Panels

Tabs or collapsible accordion below the attribute section:

| Tab | Content | Data source |
|-----|---------|-------------|
| Status Tags | Fitness, mental, disciplinary, tactical, contract tags as pills | `player_status` |
| Scouting Notes | Free-text editorial notes | `player_status.scouting_notes` |
| Similar Players | Grid of 3-5 similar player cards (compact) | Computed by attribute similarity |
| Recent News | Chronological list of tagged stories | `news_stories` + `news_player_tags` |

---

## 2. Player List Card — Condensed Version

The card displayed in the grid view at `/players`. Must communicate personality and archetype at a glance without requiring click-through.

### ASCII Layout — Card (280px x 160px)

```
+------------------------------------------+
|  [Tier]                    [Pursuit Pill] |
|                                           |
|  Name, First                    [Nation]  |
|  Position  ·  Club Name         [Club]    |
|                                           |
|  +--------+   Archetype: Engine           |
|  | ENTJ   |   Confidence: ●●●○            |
|  |Commander|   Level ██████░░ 72           |
|  +--------+   Peak  ████████░ 85          |
|    (gold)                                 |
|                                           |
+------------------------------------------+
```

### Specification

| Property | Value |
|----------|-------|
| **Dimensions** | 280px wide (fixed in grid), auto height ~160px |
| **Grid layout** | CSS Grid, `repeat(auto-fill, minmax(280px, 1fr))`, gap 16px |
| **Background** | `--bg-surface` |
| **Border** | 1px `--border-subtle`, `border-radius: 12px` |
| **Hover** | Border brightens to `--accent-personality` at 30% opacity, subtle `translateY(-2px)` |
| **Click** | Navigates to `/players/[id]` |
| **Component** | `<PlayerListCard>` |

Card elements:
- **Tier badge**: Top-left corner. See Section 5.
- **Pursuit status**: Top-right. Small pill (Priority/Interested/Watch/Pass).
- **Player name**: 16px semibold, `--text-primary`. Surname, First format.
- **Position + Club**: 12px `--text-secondary`. Separated by middot.
- **Nation flag + Club badge**: 20px inline icons, right-aligned on the name row.
- **Personality mini-badge**: 4-letter code in gold monospace, 14px, inside a small bordered box. Below: type name in 11px.
- **Archetype name**: 13px `--text-primary`. With confidence dots.
- **Level/Peak bars**: Two thin horizontal bars (4px height), labeled with scores. Level uses `--text-primary`, Peak uses `--text-secondary` (aspirational).

### Mobile Card

On viewports below 640px, cards go full-width (single column). Same content, but the personality badge and archetype shift to a horizontal row below the name.

### Table View Alternative

Toggle between card grid and table view. Table columns:

| Column | Width | Content |
|--------|-------|---------|
| Name | 200px | Sortable, linked |
| Pos | 48px | Position code |
| Club | 150px | Club name |
| Personality | 72px | 4-letter code in gold monospace |
| Archetype | 120px | Primary archetype name |
| Level | 48px | Numeric |
| Peak | 48px | Numeric |
| Tier | 32px | Badge icon |
| Pursuit | 80px | Status pill |

---

## 3. News Modal Spec

Triggered by clicking a key moment row in Zone C or any news story link. Overlay modal with backdrop blur.

### ASCII Layout — Modal (max 560px wide)

```
+--------------------------------------------------+
|  ┌──────────────────────────────────────────────┐ |
|  │                                        [X]   │ |
|  │  ● POSITIVE                                  │ |
|  │                                              │ |
|  │  Headline Text Goes Here Across              │ |
|  │  Multiple Lines if Needed                    │ |
|  │                                              │ |
|  │  Source: The Athletic  ·  26 Oct 2025        │ |
|  │  Type: Performance                           │ |
|  │                                              │ |
|  │  ──────────────────────────────────────────  │ |
|  │                                              │ |
|  │  Summary text from the news story goes       │ |
|  │  here. This is the AI-generated summary      │ |
|  │  from the Gemini Flash pipeline. It may      │ |
|  │  span several lines and provides context     │ |
|  │  for why this moment matters to the          │ |
|  │  player's profile assessment.                │ |
|  │                                              │ |
|  │  ──────────────────────────────────────────  │ |
|  │                                              │ |
|  │  Key Moment Context:                         │ |
|  │  "Derby della Mole solo goal — dribbled      │ |
|  │   past three defenders from the halfway      │ |
|  │   line." (editorial from key_moments.desc)   │ |
|  │                                              │ |
|  │             [Read Full Article →]            │ |
|  │                                              │ |
|  └──────────────────────────────────────────────┘ |
+--------------------------------------------------+
   (backdrop: rgba(0,0,0,0.6) + backdrop-filter: blur(8px))
```

### Specification

| Property | Value |
|----------|-------|
| **Trigger** | Click on key moment row or news story link |
| **Overlay** | `rgba(0,0,0,0.6)`, `backdrop-filter: blur(8px)` |
| **Modal surface** | `--bg-elevated`, `border-radius: 16px`, `max-width: 560px`, centered |
| **Close** | X button top-right, Escape key, click outside |
| **Animation** | Fade in 150ms + scale from 0.95 to 1.0 |
| **Component** | `<NewsModal>` |

Modal content:
- **Sentiment badge**: Top-left. Pill with text "POSITIVE" / "NEGATIVE" / "NEUTRAL". Background color matches sentiment. 10px uppercase.
- **Headline**: 20px semibold, `--text-primary`. From `news_stories.title`.
- **Source + Date**: 12px `--text-secondary`. Source from `news_stories.source_domain` or extracted from URL. Date from `news_stories.published_at`, formatted as "26 Oct 2025".
- **Story type**: Pill badge (transfer / injury / performance / contract / disciplinary / tactical). From `news_stories.story_type`.
- **Divider**: 1px `--border-subtle`.
- **Summary**: 14px `--text-secondary`. From `news_stories.summary`. Max 200 words displayed.
- **Key Moment Context** (conditional): If opened from a key moment, show the `key_moments.description` in a slightly indented block with left border accent (`--accent-personality`). Italic style.
- **Read Full Article**: Button/link at bottom. Opens `news_stories.url` or `key_moments.source_url` in new tab. Only shown if URL exists.

### Data Sources

| Field | Table | Column |
|-------|-------|--------|
| Headline | `news_stories` | `title` |
| Summary | `news_stories` | `summary` |
| Published date | `news_stories` | `published_at` |
| Source URL | `news_stories` | `url` |
| Sentiment | `news_stories` | `sentiment` |
| Story type | `news_stories` | `story_type` |
| Moment title | `key_moments` | `title` |
| Moment description | `key_moments` | `description` |
| Moment date | `key_moments` | `moment_date` |
| Fallback URL | `key_moments` | `source_url` |

---

## 4. Progressive Disclosure Layers

The core UX pattern. Each layer adds detail without cluttering the layer above. Users drill down by clicking; they never see complexity they did not ask for.

### Layer 0: Card in List

**Where:** `/players` grid or table view
**What the user sees:** Player name, position, personality code, archetype name, level, tier badge.
**Interaction:** Click card to navigate to `/players/[id]` (Layer 1).

```
┌──────────────────────────────────┐
│ [Tier 1]              [Priority] │
│ Yildiz, Kenan             🇹🇷   │
│ AM  ·  Juventus                  │
│ +------+  Archetype: Creator     │
│ | ENFP |  Level ██████░░ 72      │
│ | Spark|  Peak  ████████ 86      │
│ +------+                         │
└──────────────────────────────────┘
```

**Data query:** `player_intelligence_card` view (lightweight: name, position, personality_type, archetype, level, peak, profile_tier, pursuit_status, club, nation).

### Layer 1: Intelligence Card Header

**Where:** `/players/[id]` — Zones A + B + C
**What the user sees:** Full identity, personality with dimension bars, archetype with all 13 model scores, key moments timeline.
**Interaction:** Scroll to see market position (Zone D). Click compound gauge to enter Layer 2.

**New information revealed at this layer:**
- Personality dimension scores (ei/sn/tf/jp as spectrum bars)
- Competitiveness and coachability scores
- Personality type description paragraph
- All 13 archetype model fit scores (the "shape")
- Archetype confidence level
- Blueprint text
- Key moments with dates and sentiment
- Market valuation and context

**Data query:** Full `player_intelligence_card` view + `key_moments` for person_id + `attribute_grades` aggregated by model.

### Layer 2: Compound Metrics

**Where:** `/players/[id]` — Zone E expanded (first level)
**What the user sees:** Four category gauges expand into radar charts showing the 3 models within each compound.
**Interaction:** Click any category gauge to expand. Click a specific model to enter Layer 3.

```
▼ Mental    72
  ┌────────────────────────────────────────┐
  │         Controller                      │
  │           ╱ 68 ╲                       │
  │          ╱       ╲                     │
  │  Creator ─────── Commander             │
  │     58              81                 │
  │                                        │
  │  [Controller] [Commander] [Creator]    │
  │   click any model to drill down →      │
  └────────────────────────────────────────┘
```

**Data query:** `attribute_grades` grouped by model for this player. Compound score = weighted average of 3 model scores.

### Layer 3: Model Breakdown

**Where:** `/players/[id]` — within expanded compound section
**What the user sees:** Bar chart of 4 attributes within the selected model, each with its primary score.
**Interaction:** Click any attribute bar to enter Layer 4. Back button returns to Layer 2.

```
▼ Mental > Commander    81
  ┌────────────────────────────────────────┐
  │  Communication   ████████████░░░  78   │
  │  Competitiveness ██████████████░  92   │
  │  Drive           ████████████░░░  76   │
  │  Leadership      ██████████████░  88   │
  │                                        │
  │  Click any attribute for source detail  │
  └────────────────────────────────────────┘
```

**Data query:** `attribute_grades` WHERE player_id = X AND attribute IN (model's 4 attributes).

### Layer 4: Attribute Detail

**Where:** `/players/[id]` — deepest drill-down
**What the user sees:** Full detail for a single attribute across all data sources, with confidence level, environment notes, and provenance.

```
▼ Mental > Commander > Leadership    88
  ┌────────────────────────────────────────┐
  │  Source Comparison:                     │
  │                                        │
  │  Scout Grade     ██████████████░  88   │
  │   └─ Confidence: HIGH                  │
  │   └─ Assessed: 2025-11-14             │
  │                                        │
  │  StatsBomb       ████████████░░░  79   │
  │   └─ Derived from: captain actions,    │
  │      set-piece organization events     │
  │                                        │
  │  EAFC Inferred   ██████████████░  85   │
  │                                        │
  │  ──────────────────────────────────    │
  │  Environment: Serie A (high tactical   │
  │  demand inflates leadership scores     │
  │  +3-5 vs. comparable leagues)          │
  │                                        │
  │  Suppression: None applied             │
  └────────────────────────────────────────┘
```

**New information revealed at this layer:**
- Multi-source comparison (scout_grade vs stat_score per source)
- Confidence level per source (high/medium/low)
- Assessment date
- Derivation notes (how stat_score was computed)
- Environment suppression notes (league context adjustments)
- Field source verification status

**Data query:** `attribute_grades` WHERE player_id = X AND attribute = Y + `player_field_sources` WHERE player_id = X AND field = Y.

### Layer Navigation

| From | To | Trigger | Animation |
|------|----|---------|-----------|
| Layer 0 | Layer 1 | Click card | Page navigation |
| Layer 1 | Layer 2 | Click compound gauge | Expand accordion (200ms ease-out) |
| Layer 2 | Layer 3 | Click model in radar | Slide-in from right (150ms) |
| Layer 3 | Layer 4 | Click attribute bar | Expand below bar (200ms) |
| Any layer | Previous | Click breadcrumb or back arrow | Reverse of entry animation |

### Breadcrumb Trail

Shown above the expanded content at Layer 2+:

```
Attributes > Mental > Commander > Leadership
```

Each segment is clickable to jump back to that layer.

---

## 5. Tier Badge System

Three tiers of profile depth. Visually distinguished at every touchpoint: list cards, intelligence card headers, and search results.

### Tier Definitions

| Tier | Name | Badge | Criteria |
|------|------|-------|----------|
| **Tier 1** | Scout Assessed | Gold shield icon with checkmark | `profile_tier = 1`. Has: personality profile, archetype with confidence, key moments, scout grades, market revaluation, blueprint. Currently 21 profiles. |
| **Tier 2** | Data-Derived | Silver hexagon icon | `profile_tier = 2`. Has: archetype computed from pipeline data (StatsBomb/Understat/EAFC), attribute grades from stat sources. No personality, no key moments, no scout grades. |
| **Tier 3** | Skeleton | Gray circle outline | `profile_tier = 3`. Has: basic identity (name, club, position, nation). Minimal or no attribute data. Placeholder. |

### Visual Treatment

#### Tier 1 — Gold Shield

```
 ╔═══╗
 ║ ✓ ║   "Scout Assessed"
 ╚═╤═╝
```

- **Icon**: Shield with checkmark, 16px (list card), 24px (intelligence card)
- **Color**: `--accent-personality` (gold, `#e8c547`)
- **Label**: "Scout Assessed" in 10px uppercase, gold
- **Tooltip**: "Full scouting intelligence: personality, archetype, key moments, market revaluation"
- **Effect on card**: Subtle gold left-border (3px) on list cards

#### Tier 2 — Silver Hexagon

```
 ⬡  "Data-Derived"
```

- **Icon**: Hexagon outline, 16px / 24px
- **Color**: `#8888aa` (silver-gray)
- **Label**: "Data-Derived" in 10px uppercase, silver
- **Tooltip**: "Profile built from statistical data. Personality and key moments not yet assessed."
- **Effect on card**: No special border treatment

#### Tier 3 — Gray Circle

```
 ○  "Skeleton"
```

- **Icon**: Empty circle outline, 16px / 24px
- **Color**: `#555566` (muted gray)
- **Label**: "Skeleton" in 10px uppercase, muted
- **Tooltip**: "Basic identity only. Assessment pending."
- **Effect on card**: Card has reduced opacity (0.7) compared to Tier 1/2

### Tier Impact on Intelligence Card

| Zone | Tier 1 | Tier 2 | Tier 3 |
|------|--------|--------|--------|
| Zone A (Identity) | Full | Full | Partial (may lack height/foot) |
| Zone B (Personality) | Full personality display | "Personality not yet assessed" placeholder with tier explanation | Hidden |
| Zone B (Archetype) | Full with confidence | Shown but labeled "Data-Derived" with no confidence indicator | Hidden |
| Zone C (Key Moments) | Full timeline | "Key moments not yet recorded" with CTA | Hidden |
| Zone D (Market) | Full market position | Partial (market_value_tier only, no true MVT revaluation) | Hidden |
| Zone E (Attributes) | Full with scout grades | Stat-derived scores only, labeled by source | Minimal or empty |

### Filter Integration

The tier is a first-class filter on the player list page:
- Checkbox group: `[ ] Scout Assessed  [ ] Data-Derived  [ ] Skeleton`
- Default: Tier 1 and Tier 2 shown, Tier 3 hidden (user can enable)
- URL param: `?tier=1,2`

---

## 6. Component Inventory

All new components required, with props and data dependencies. Components live in `apps/web/components/`.

### Core Display Components

#### `<PersonalityBadge>`

Hero element of the product. Displays the 4-letter personality code with type name.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `personalityType` | `string \| null` | Yes | 4-letter code (e.g., "ENTJ") |
| `ei` | `number \| null` | No | E/I dimension score (0-100) |
| `sn` | `number \| null` | No | S/N dimension score (0-100) |
| `tf` | `number \| null` | No | T/F dimension score (0-100) |
| `jp` | `number \| null` | No | J/P dimension score (0-100) |
| `competitiveness` | `number \| null` | No | 0-100 score |
| `coachability` | `number \| null` | No | 0-100 score |
| `size` | `'hero' \| 'compact' \| 'mini'` | No | `hero` for detail page, `compact` for list card, `mini` for table row |
| `showDimensions` | `boolean` | No | Show dimension bars (default: true for hero, false for compact/mini) |
| `showDescription` | `boolean` | No | Show text description (default: true for hero only) |

**Data source:** `player_personality` table, `personality_type` computed in view.

---

#### `<ArchetypeShape>`

Visual signature of a player's archetype model scores.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `archetype` | `string \| null` | Yes | Primary archetype name |
| `confidence` | `'high' \| 'medium' \| 'low' \| null` | No | Archetype confidence |
| `modelScores` | `Record<string, number>` | Yes | Map of model name to score (13 entries) |
| `blueprint` | `string \| null` | No | Blueprint text |
| `size` | `'full' \| 'compact'` | No | `full` for detail page, `compact` for list card |
| `showBlueprint` | `boolean` | No | Show blueprint excerpt (default: true for full) |

**Data source:** `player_profiles` + `attribute_grades` aggregated by model.

---

#### `<PlayerIdentityPanel>`

Composite: pairs PersonalityBadge (WHO) and ArchetypeShape (HOW) side by side.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `personality` | `PersonalityData` | Yes | Object with all personality fields |
| `archetype` | `ArchetypeData` | Yes | Object with archetype + model scores |
| `layout` | `'horizontal' \| 'vertical'` | No | Side-by-side or stacked |

**Data source:** `personality_style` view.

---

#### `<PlayerIdentityBar>`

Top bar showing player identity, position, club, nation, level/peak.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `player` | `PlayerIntelligenceCard` | Yes | Full intelligence card data object |
| `tier` | `1 \| 2 \| 3` | Yes | Profile tier |

**Data source:** `player_intelligence_card` view.

---

#### `<KeyMomentsList>`

Vertical list of key moments with sentiment dots and click targets.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `moments` | `KeyMoment[]` | Yes | Array of key moment objects |
| `maxVisible` | `number` | No | Max items before "See All" (default: 5) |
| `onMomentClick` | `(moment: KeyMoment) => void` | Yes | Handler to open NewsModal |

**Data source:** `key_moments` JOIN `news_stories`.

**KeyMoment type:**
```typescript
type KeyMoment = {
  id: number;
  title: string;
  description: string | null;
  moment_date: string | null;
  moment_type: 'goal' | 'assist' | 'performance' | 'controversy' | 'milestone';
  sentiment: 'positive' | 'negative' | 'neutral';
  source_url: string | null;
  news_story: {
    id: string;
    title: string;
    summary: string | null;
    url: string | null;
    published_at: string | null;
    sentiment: string | null;
    story_type: string | null;
  } | null;
};
```

---

#### `<NewsModal>`

Click-triggered overlay modal for news stories.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Controls visibility |
| `onClose` | `() => void` | Yes | Close handler |
| `story` | `NewsStory \| null` | Yes | News story data |
| `momentContext` | `{ title: string; description: string } \| null` | No | Key moment editorial context, shown if opened from a key moment |

**Data source:** `news_stories` table.

---

#### `<MarketPosition>`

Market valuation and context panel.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `marketValueTier` | `string \| null` | No | Letter grade |
| `trueMvt` | `string \| null` | No | True market value tier |
| `marketPremium` | `number \| null` | No | Premium percentage |
| `scarcityScore` | `number \| null` | No | 0-100 |
| `transferFeeEur` | `number \| null` | No | Fee in EUR |
| `hg` | `boolean \| null` | No | Home grown status |
| `contractTags` | `string[]` | No | Contract status tags |
| `loanStatus` | `string \| null` | No | Loan status |

**Data source:** `player_market` + `player_status`.

---

#### `<CompoundMetrics>`

Four category gauges with progressive disclosure drill-down.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `attributeGrades` | `AttributeGrade[]` | Yes | All attribute grades for this player |
| `profileTier` | `1 \| 2 \| 3` | Yes | Determines which sources are shown |

**Data source:** `attribute_grades` WHERE player_id = X.

Internally manages expansion state for Layer 2/3/4 drill-down.

---

#### `<DrillDownChart>`

Renders the radar (Layer 2) or bar chart (Layer 3) within CompoundMetrics.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `level` | `'compound' \| 'model' \| 'attribute'` | Yes | Which drill-down level |
| `data` | `ChartDataPoint[]` | Yes | Scores to render |
| `categoryColor` | `string` | Yes | CSS color variable for the compound |
| `onDrillDown` | `(item: string) => void` | No | Handler for clicking deeper |
| `onBack` | `() => void` | No | Handler for going up a level |

---

#### `<AttributeDetail>`

Deepest drill-down: single attribute with multi-source comparison and confidence.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `playerId` | `number` | Yes | Person ID |
| `attribute` | `string` | Yes | Attribute name |
| `grades` | `AttributeGrade[]` | Yes | All grades for this attribute (multi-source) |
| `fieldSources` | `FieldSource[]` | No | Provenance data |

**Data source:** `attribute_grades` + `player_field_sources`.

---

#### `<TierBadge>`

Displays the profile tier indicator.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tier` | `1 \| 2 \| 3` | Yes | Profile tier |
| `size` | `'sm' \| 'md' \| 'lg'` | No | Size variant |
| `showLabel` | `boolean` | No | Show text label (default: true for md/lg) |

---

#### `<PursuitBadge>`

Displays pursuit status as a colored pill.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `'Priority' \| 'Interested' \| 'Watch' \| 'Pass' \| null` | Yes | Pursuit status |
| `size` | `'sm' \| 'md'` | No | Size variant |

---

#### `<SentimentDot>`

Small colored circle indicating sentiment.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `sentiment` | `'positive' \| 'negative' \| 'neutral'` | Yes | Sentiment value |
| `size` | `number` | No | Diameter in px (default: 8) |

---

### Page Components

#### `<PlayerListCard>`

Full card component for the grid view. Composes PersonalityBadge (compact), TierBadge, PursuitBadge.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `player` | `PlayerListItem` | Yes | Condensed player data for list display |

---

#### `<PlayerIntelligenceCard>` (page-level)

The `/players/[id]/page.tsx` component. Composes all Zone A-F components.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `playerId` | `number` | Yes | Person ID from URL params |

Fetches data server-side via Supabase client. Queries:
1. `player_intelligence_card` view WHERE person_id = X
2. `key_moments` WHERE person_id = X, joined with `news_stories`
3. `attribute_grades` WHERE player_id = X
4. `player_field_sources` WHERE player_id = X (loaded lazily at Layer 4)

---

#### `<PlayerFilters>`

Filter bar for the player list page.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onFilterChange` | `(filters: FilterState) => void` | Yes | Callback when filters change |
| `initialFilters` | `FilterState` | No | From URL search params |

Filter fields:
- Position (multi-select): GK, WD, CD, DM, CM, WM, AM, WF, CF
- Personality type (multi-select): 16 types
- Archetype (multi-select): 13 models
- Level range (slider): 0-100
- Pursuit status (multi-select): Priority, Interested, Watch, Pass
- Tier (checkbox): 1, 2, 3
- Club / League (search-select)

URL params: `?pos=CM,AM&personality=ENTJ,INTJ&tier=1,2&level=60-100`

---

### Shared Primitives

| Component | Purpose |
|-----------|---------|
| `<GaugeCircle>` | Circular progress gauge used in compound metrics |
| `<HorizontalBar>` | Horizontal fill bar used in dimension scores, model scores, attribute scores |
| `<PillBadge>` | Rounded pill for status tags, story types, position codes |
| `<DotIndicator>` | Row of dots (filled/empty) for competitiveness, coachability, confidence |
| `<Breadcrumb>` | Navigation trail for drill-down layers |
| `<ModalOverlay>` | Backdrop blur overlay wrapper used by NewsModal |

---

## Appendix: Data Type Definitions

```typescript
// Core data shape from player_intelligence_card view
type PlayerIntelligenceCardData = {
  person_id: number;
  name: string;
  dob: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  active: boolean;
  wikidata_id: string | null;
  nation: string | null;
  club: string | null;
  position: string | null;
  level: number | null;
  peak: number | null;
  overall: number | null;
  archetype: string | null;
  model_id: string | null;
  blueprint: string | null;
  profile_tier: 1 | 2 | 3;
  ei: number | null;
  sn: number | null;
  tf: number | null;
  jp: number | null;
  competitiveness: number | null;
  coachability: number | null;
  personality_type: string | null;
  market_value_tier: string | null;
  true_mvt: string | null;
  market_premium: number | null;
  scarcity_score: number | null;
  transfer_fee_eur: number | null;
  hg: boolean | null;
  pursuit_status: string | null;
  scouting_notes: string | null;
  squad_role: string | null;
  loan_status: string | null;
};

// Attribute grade from attribute_grades table
type AttributeGrade = {
  player_id: number;
  attribute: string;
  scout_grade: number | null;
  stat_score: number | null;
  source?: string; // 'eafc_inferred' | 'statsbomb' | 'understat' | 'scout'
};

// Field source provenance
type FieldSource = {
  player_id: number;
  field: string;
  value: string | null;
  confirmed: boolean;
};

// Condensed type for list view
type PlayerListItem = Pick<
  PlayerIntelligenceCardData,
  'person_id' | 'name' | 'position' | 'club' | 'nation' |
  'level' | 'peak' | 'personality_type' | 'archetype' |
  'profile_tier' | 'pursuit_status'
>;

// Filter state
type FilterState = {
  positions: string[];
  personalityTypes: string[];
  archetypes: string[];
  levelRange: [number, number];
  pursuitStatuses: string[];
  tiers: number[];
  club: string | null;
  league: string | null;
};
```

---

## Implementation Priority

Per the PM log dependency graph, implementation order for these components:

1. **B1** — Next.js app shell (blocker for everything)
2. **B2** — Design tokens (colors, typography, spacing from this spec)
3. **C1** — `<PersonalityBadge>` (hero element, highest product priority)
4. **C2** — `<ArchetypeShape>` (paired with personality)
5. **C3** — `<PlayerIdentityPanel>` (WHO + HOW composite)
6. **D1** — `<KeyMomentsList>` (evidence layer)
7. **D2** — `<NewsModal>` (click-triggered overlay)
8. **E1** — `<PlayerListCard>` (list view surface)
9. **E2** — `<PlayerIntelligenceCard>` page + `<CompoundMetrics>` + `<DrillDownChart>`
10. **E3** — `<AttributeDetail>` (deepest drill-down)
11. Shared primitives (`<TierBadge>`, `<PursuitBadge>`, `<GaugeCircle>`, etc.) built as needed by the above.

---

*Prepared by: Design Manager, Chief Scout*
*Date: 2026-03-09*
