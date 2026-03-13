# Chief Scout Player Viewer — v1 Design

**Date:** 2026-03-09
**Status:** Approved

## Overview

Web-based scouting dashboard for browsing, searching, and analyzing player data across 3 sources (EAFC inferred, StatsBomb events, Understat xG). Dark theme, scouting-report aesthetic, sidebar navigation, mobile-responsive.

## Stack

- **Framework**: Next.js 15 App Router + Turbopack (in `apps/web/`)
- **Styling**: Tailwind CSS, dark theme
- **Charts**: Recharts (radar, bar, gauges)
- **Data**: Supabase JS client, server components for data fetching
- **State**: URL search params for filters (shareable URLs), minimal client state
- **Auth**: None for v1 (single user)

## Navigation (Sidebar)

```
[Chief Scout logo]
─────────────────
Search              ← prominent, also Cmd+K
─────────────────
Players
  By Position       ← GK, CD, WD, DM, CM, WM, AM, WF, CF
  By Archetype      ← 13 models (Controller, Creator, Engine...)
  By Pursuit Status ← Priority, Interested, Watch, Pass
  By Level Range    ← Elite, Strong, Developing
─────────────────
Clubs
  Squad View        ← depth chart + gap analysis
  By League         ← top 5 leagues
─────────────────
News Feed           ← recent stories, filterable
```

Collapses to icon-only on mobile with bottom sheet navigation.

## Pages

### 1. Player List (`/players`)

Filterable card grid (default) or table view toggle.

**Card shows:** Name, position, club badge, nation flag, level/peak, archetype badge, pursuit status indicator.

**Filters:** Position, league, club, archetype, level range, pursuit status.

**Sort by:** Level, overall, any compound metric (Mental/Physical/Tactical/Technical).

### 2. Player Detail (`/players/[id]`)

**Header card:** Name, position, club, nation, age, height, preferred foot, level/peak bars, archetype badge + confidence, pursuit status.

**Compound metrics row:** 4 circular gauges for Mental / Physical / Tactical / Technical category scores (weighted average of 12 attributes each).

**Drill-down model:**
- Click category gauge → radar chart of 3 models within that category
- Click model → bar chart of 4 attributes with multi-source comparison (EAFC / Understat / StatsBomb bars side by side)

**Additional panels:**
- News: Recent stories mentioning this player, with sentiment and story-type badges
- Similar players: Button to find players with comparable attribute profiles (pre-fills search)
- Status tags: Fitness, mental, disciplinary, tactical, contract tags from player_status

### 3. Club Squad View (`/clubs/[id]`)

**Depth chart:** Visual formation grid (from club's formation) showing starter + backup at each position slot.

**Squad overview:** Average level, age distribution, archetype mix, market value summary.

**Gap analysis (semi-automated):**
- For each position, compare player attribute scores to squad median
- Highlight positions where scores fall below threshold (red indicators)
- "Find replacement" button pre-fills search with position + minimum attribute thresholds from the gap
- v2: AI-generated written recommendations via LLM

**Squad list:** Full roster sortable by position, level, age, market value tier.

### 4. News Feed (`/news`)

Chronological feed of ingested stories with player tag chips.

**Filters:** Story type (transfer, injury, performance, contract, disciplinary, tactical), sentiment (positive/negative/neutral), player, club.

## Compound Metrics Hierarchy

```
Overall Score (1-100, from player_profiles.level)
├── Mental (avg of 12 attrs)
│   ├── Controller (Anticipation, Decisions, Composure, Tempo)
│   ├── Commander (Communication, Competitiveness, Drive, Leadership)
│   └── Creator (Creativity, Flair, Guile, Vision)
├── Physical (avg of 12 attrs)
│   ├── Target (Aerial Duels, Heading, Jumping, Volleys)
│   ├── Sprinter (Acceleration, Balance, Movement, Pace)
│   └── Powerhouse (Aggression, Duels, Shielding, Throwing)
├── Tactical (avg of 12 attrs)
│   ├── Cover (Awareness, Discipline, Interceptions, Positioning)
│   ├── Engine (Intensity, Pressing, Stamina, Versatility)
│   └── Destroyer (Blocking, Clearances, Marking, Tackling)
└── Technical (avg of 12 attrs)
    ├── Dribbler (Carries, First Touch, Skills, Takeons)
    ├── Passer (Accuracy, Crossing, Range, Through Balls)
    └── Striker (Finishing, Long Shots, Penalties, Shot Power)
```

Multi-source scoring: When multiple sources exist for an attribute, display all bars. The "primary" score for compound calculations uses the highest-confidence source available (scout_grade > stat_score from statsbomb > stat_score from understat > stat_score from eafc_inferred).

## Visual Style

- **Theme:** Dark background (#0a0a0f), card surfaces (#1a1a2e), accent colors per category (Mental=blue, Physical=amber, Tactical=green, Technical=purple)
- **Cards:** Rounded corners, subtle borders, hover glow effect
- **Typography:** Clean sans-serif, monospace for numbers/scores
- **Badges:** Archetype badges with model icon + confidence dot, pursuit status color-coded (Priority=red, Interested=amber, Watch=blue, Pass=gray)
- **Charts:** Filled radar charts with transparency, gradient bar fills matching category colors

## Data Sources (all server-side)

| Query | Tables | Notes |
|-------|--------|-------|
| Player list | people + player_profiles + clubs | Join for search/filter |
| Player detail | people + all 7 feature tables + attribute_grades | Full profile |
| Attribute scores | attribute_grades WHERE player_id = X | Group by source |
| Club squad | people WHERE club_id = X + player_profiles | Position grouping |
| News for player | news_stories + news_player_tags | Filter by player_id |
| Gap analysis | attribute_grades aggregated by position within club | Compare to squad median |

## Mobile Considerations

- Sidebar collapses to hamburger menu / bottom nav icons
- Card grid goes to single column
- Drill-down charts stack vertically
- Depth chart simplifies to position list view
- Search remains prominent (top of screen)

## Future (v2)

- AI-powered squad recommendations (LLM analysis of gaps + available targets)
- Player comparison mode (side-by-side radar overlays)
- FBRef season-over-season trend charts (when data available)
- Export scouting reports as PDF
- Availability scoring integration (transfer likelihood calculations)
