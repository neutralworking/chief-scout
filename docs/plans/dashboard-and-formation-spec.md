# Dashboard + Formation Analysis — Specification

**Date:** 2026-03-11
**Status:** Proposal
**Authors:** DoF (strategy), Design Manager (architecture), Project Manager (breakdown), CEO (scope)
**Supersedes:** Relevant portions of `docs/dashboard-spec.md` (original Watford spec) adapted for Chief Scout platform

---

## Executive Summary (CEO)

The original `dashboard-spec.md` is a 300-line Watford scouting department wishlist. Most of it (scout assignments, live reporting, mobile app, audit trail) is enterprise collaboration tooling that has zero users and zero revenue. We strip it to the bone:

**What we build now:** A single-page dashboard that answers the three questions a Director of Football asks every morning:

1. "Who should I be looking at?" — Priority targets + watchlist
2. "Where are the gaps?" — Squad depth by position
3. "What formations fit my squad?" — Formation analysis tool

Everything else (reports, planner, audit, mobile app) is deferred to post-revenue.

---

## 1. Dashboard Home (`/`)

Currently redirects to `/players`. We replace this with a proper dashboard.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  CHIEF SCOUT                                              │
│  Intelligence Platform             [Search ⌘K]           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─── PURSUIT PIPELINE ────────────────────────────────┐ │
│  │                                                      │ │
│  │  Priority (3)  │  Interested (7)  │  Watch (12)     │ │
│  │  ┌──────────┐  │  ┌──────────┐    │  ┌──────────┐  │ │
│  │  │ Player A │  │  │ Player D │    │  │ Player K │  │ │
│  │  │ Player B │  │  │ Player E │    │  │ Player L │  │ │
│  │  │ Player C │  │  │ ...+5    │    │  │ ...+10   │  │ │
│  │  └──────────┘  │  └──────────┘    │  └──────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─── POSITION DEPTH ──────────┐  ┌─── QUICK STATS ───┐ │
│  │                              │  │                    │ │
│  │  GK  ██████████  4 players  │  │  Total: 142        │ │
│  │  CD  ████████░░  3 players  │  │  Tier 1: 8         │ │
│  │  WD  ████░░░░░░  2 players  │  │  With FBRef: 94    │ │
│  │  DM  ██████████  4 players  │  │  Priority: 3       │ │
│  │  CM  ████████░░  3 players  │  │  Last updated: now │ │
│  │  WM  ██░░░░░░░░  1 player   │  │                    │ │
│  │  AM  ████████░░  3 players  │  │  ─────────────     │ │
│  │  WF  ████░░░░░░  2 players  │  │  NEWS               │
│  │  CF  ██████░░░░  2 players  │  │  Latest 3 stories  │ │
│  │                              │  │  w/ player tags    │ │
│  └──────────────────────────────┘  └────────────────────┘ │
│                                                           │
│  ┌─── RECENT ACTIVITY ─────────────────────────────────┐ │
│  │  5 most recently updated player profiles             │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Widgets

#### W1: Pursuit Pipeline (Kanban-style)

Three columns: **Priority**, **Interested**, **Watch**. Each shows mini player cards (name, position, club, archetype). Click any card → player detail page. "View all" link at bottom → pre-filtered player list.

**Data query:** `player_intelligence_card` view grouped by `pursuit_status`, ordered by `level` desc.

#### W2: Position Depth

Horizontal bars showing how many tracked players (pursuit_status != 'Pass') exist per position. Color intensity indicates strength. Click any position → pre-filtered player list.

**Data query:** `SELECT position, count(*) FROM player_intelligence_card WHERE pursuit_status != 'Pass' GROUP BY position`

**Gap detection:** Positions with fewer than 2 tracked players get a warning indicator. This is the DoF's "where am I thin?" signal.

#### W3: Quick Stats

Key metrics at a glance:
- Total players in database
- Tier 1 profiles count
- Players with FBRef data linked
- Priority target count
- Last pipeline sync time

**Data query:** Aggregate counts from `people`, `player_profiles`, `player_id_links`, `player_status`.

#### W4: Recent News

3 most recent `news_stories` with player tag chips. Click → news feed. Only shown if stories exist.

#### W5: Recent Activity

5 most recently updated profiles (by `updated_at` on `player_profiles` or `player_status`). Shows what changed and when. Gives the DoF a "what's fresh" signal.

### Component: `<Dashboard>`

Server component. All widgets are independent data fetches run in parallel via `Promise.all`.

---

## 2. Formation Analysis (`/formations`)

### DoF Rationale

> "I have 142 players in the database. I know their positions, archetypes, and attribute scores. I have 43 formations documented with position requirements. The question I need answered: **which formations maximize the players I'm tracking, and which positions are exposed in each?**"

This is not a tactical board — it's a squad-to-formation fit analyzer.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  FORMATIONS                                    [Search]  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─── FORMATION BROWSER ───────────────────────────────┐ │
│  │                                                      │ │
│  │  Modern (12)        Classic (8)       Exotic (6)    │ │
│  │                                                      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │ │
│  │  │  4-2-3-1 │ │  4-3-3   │ │  3-5-2   │  ...       │ │
│  │  │  ▓▓▓▓▓▓▓ │ │  ▓▓▓▓▓░ │ │  ▓▓▓▓░░ │            │ │
│  │  │  Fit: 87%│ │  Fit: 74%│ │  Fit: 62%│            │ │
│  │  └──────────┘ └──────────┘ └──────────┘            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─── FORMATION DETAIL (click to expand) ──────────────┐ │
│  │                                                      │ │
│  │         CF                                           │ │
│  │      WF    WF          4-2-3-1                       │ │
│  │         AM             Fit Score: 87%                │ │
│  │      DM    DM          Covered: 8/10 slots           │ │
│  │   WD  CD    CD  WD     Gaps: WF (1 player only)     │ │
│  │         GK                                           │ │
│  │                                                      │ │
│  │  SLOT MAPPING                                        │ │
│  │  ────────────                                        │ │
│  │  GK:  De Gea (82), Onana (78)                       │ │
│  │  CD:  Saliba (88), Dias (85), Gvardiol (82)         │ │
│  │  WD:  Alexander-Arnold (85), Cucurella (72)         │ │
│  │  DM:  Rice (90), Rodri (93)                         │ │
│  │  AM:  Ødegaard (91)                                 │ │
│  │  WF:  Saka (88) ⚠ only 1 player                    │ │
│  │  CF:  Haaland (94), Isak (85)                       │ │
│  │                                                      │ │
│  │  ┌─ TACTICAL NOTES ──────────────────────────────┐  │ │
│  │  │  [Formation description from docs/formations/] │  │ │
│  │  │  Collapsed by default, expand to read.         │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Feature Breakdown

#### F1: Formation Browser

Card grid of all formations. Each card shows:
- Formation name (e.g. "4-2-3-1")
- Mini pitch diagram (dots in position)
- **Fit score** — % of formation slots covered by tracked players (pursuit != Pass)

Grouping options: All (default), Era (Modern/Classic/Historic), Player count (back line).

Sort by: Fit score (default), Name, Position count.

**Data source:** `formations` table (name, structure, notes) joined with position depth counts.

#### F2: Formation Detail

Expanded view when clicking a formation:

1. **Pitch visualization** — Formation positions rendered as dots on a pitch outline
2. **Fit score** — How well the tracked squad covers this formation
3. **Slot mapping** — For each position in the formation, list matching tracked players (ordered by level)
4. **Gap indicators** — Positions with 0-1 players flagged with warning
5. **Tactical notes** — Formation description from `docs/formations/` markdown files, collapsed by default

#### F3: Fit Score Algorithm

```
For each position slot in the formation:
  - Count tracked players (pursuit_status IN ('Priority','Interested','Watch'))
    matching that position
  - Slot score:
    - 0 players → 0
    - 1 player  → 0.5
    - 2+ players → 1.0

Fit = sum(slot_scores) / total_slots × 100
```

Simple, transparent, useful. The DoF sees instantly which formations are well-covered and which have holes.

#### F4: Position Mapping

The `formations.structure` column stores a string like "4-2-3-1". We need a mapping from structure strings to our position enum:

| Structure position | Maps to enum |
|---|---|
| GK (always 1) | GK |
| CB / centre-back | CD |
| FB / wing-back / full-back | WD |
| CDM / holding mid | DM |
| CM / central mid | CM |
| WM / wide mid | WM |
| CAM / attacking mid | AM |
| Winger / inside forward | WF |
| ST / CF / striker | CF |

This mapping needs a `formation_slots` table or a JSON column on `formations` to define exactly which positions each formation uses and how many of each.

### Data Model Addition

```sql
-- New table: formation position slots
CREATE TABLE IF NOT EXISTS formation_slots (
  id BIGSERIAL PRIMARY KEY,
  formation_id BIGINT REFERENCES formations(id) ON DELETE CASCADE,
  position TEXT NOT NULL,       -- our position enum: GK, CD, WD, DM, CM, WM, AM, WF, CF
  slot_count INTEGER NOT NULL DEFAULT 1,  -- how many of this position
  UNIQUE(formation_id, position)
);

ALTER TABLE formation_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read formation_slots" ON formation_slots FOR SELECT USING (true);

-- Add era/category column to formations
ALTER TABLE formations ADD COLUMN IF NOT EXISTS era TEXT;  -- 'modern', 'classic', 'historic'
ALTER TABLE formations ADD COLUMN IF NOT EXISTS position_count INTEGER;  -- total outfield positions
```

### Migration: Populate `formation_slots`

A pipeline script (`13_formation_slots.py`) parses each formation's structure string + notes to determine position slot mapping. For common formations this is deterministic:

| Formation | GK | CD | WD | DM | CM | WM | AM | WF | CF |
|---|---|---|---|---|---|---|---|---|---|
| 4-2-3-1 | 1 | 2 | 2 | 2 | - | - | 1 | 2 | 1 |
| 4-3-3 | 1 | 2 | 2 | 1 | 2 | - | - | 2 | 1 |
| 3-5-2 | 1 | 3 | - | - | 2 | 2 | 1 | - | 2 |
| 4-4-2 | 1 | 2 | 2 | - | 2 | 2 | - | - | 2 |
| 5-3-2 | 1 | 3 | 2 | 1 | 2 | - | - | - | 2 |

---

## 3. Navigation Updates

### Sidebar additions

```
[Chief Scout logo]
─────────────────
Search              ← Cmd+K
─────────────────
Dashboard           ← NEW (home page)
Players
  By Position
  By Archetype
  By Pursuit Status
─────────────────
Formations          ← NEW
─────────────────
News Feed
─────────────────
Admin               ← existing /admin
```

---

## 4. Implementation Plan (Project Manager)

### Phase A: Dashboard Home (3 commits)

| Step | What | Component/File | Depends on |
|---|---|---|---|
| A1 | Dashboard page + pursuit pipeline widget | `app/page.tsx`, `<PursuitPipeline>` | — |
| A2 | Position depth + quick stats widgets | `<PositionDepth>`, `<QuickStats>` | A1 |
| A3 | Recent news + activity widgets | `<RecentNews>`, `<RecentActivity>` | A1 |

### Phase B: Formation Analysis (4 commits)

| Step | What | Component/File | Depends on |
|---|---|---|---|
| B1 | Schema: `formation_slots` table + migration | `pipeline/sql/migration_011_formation_slots.sql` | — |
| B2 | Pipeline: populate formation slots from structure strings | `pipeline/13_formation_slots.py` | B1 |
| B3 | Formation browser page + fit score | `app/formations/page.tsx`, `<FormationCard>` | B2 |
| B4 | Formation detail + pitch visualization + slot mapping | `<FormationDetail>`, `<PitchDiagram>` | B3 |

### Phase C: Navigation + Polish (2 commits)

| Step | What | Depends on |
|---|---|---|
| C1 | Sidebar nav update (Dashboard + Formations links) | A1, B3 |
| C2 | Responsive layout, empty states, loading skeletons | All |

### Estimated order: A1 → A2 → A3 → B1 → B2 → B3 → B4 → C1 → C2

---

## 5. Architecture Notes (Design Manager)

### Server components throughout

Dashboard and formation pages are read-only views. All data fetching happens server-side via `supabaseServer`. No client state needed for initial render.

### Client components only for interaction

- Formation browser: filter/sort toggle (client)
- Formation detail: expand/collapse (client)
- Pitch diagram: hover states (client)

### Data flow

```
Supabase → Server Component → Widget (server-rendered HTML)
                            → Client Component (interactive parts only)
```

### Existing patterns to follow

- `player_intelligence_card` view pattern for dashboard aggregates
- `PlayerCard` component pattern for pursuit pipeline cards
- `CompoundMetrics` expand/collapse pattern for formation detail
- Design tokens already defined in `globals.css`

### New Supabase view for dashboard

```sql
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT
  COUNT(*) AS total_players,
  COUNT(*) FILTER (WHERE profile_tier = 1) AS tier_1_count,
  COUNT(*) FILTER (WHERE pursuit_status = 'Priority') AS priority_count,
  COUNT(*) FILTER (WHERE pursuit_status = 'Interested') AS interested_count,
  COUNT(*) FILTER (WHERE pursuit_status = 'Watch') AS watch_count
FROM player_intelligence_card;
```

---

## 6. What We're NOT Building (CEO Scope Control)

| Feature from original spec | Decision | Reason |
|---|---|---|
| Scout assignment planner | Kill | No multi-user, no scouts |
| Live match reporting | Kill | Mobile-first, needs auth, zero users |
| Audit trail / timeline | Kill | Single user, no audit need |
| Report templates (match/player) | Defer to post-revenue | Enterprise feature |
| Drag-and-drop shortlists | Defer | Over-engineered for 1 user |
| Playing styles compatibility | Defer | Needs game integration |
| Video player integration | Kill | Wyscout license required |
| Export to CSV/PDF | Defer | Low value for single user |
| Snapshot tool (weekly rankings) | Defer | Needs FBRef pipeline running weekly |
| Contact/agent management | Kill | GDPR, no real contacts |
| Club squad view (`/clubs/[id]`) | Defer | Needs club data populated first |

---

## 7. Success Criteria

The dashboard is **done** when a Director of Football can:

1. Open `/` and immediately see their priority targets, position gaps, and latest news
2. Open `/formations` and find which formations fit their tracked squad best
3. Click into a formation and see exactly which positions are covered and which need recruitment
4. Navigate between dashboard → player detail → back without friction

No login. No collaboration. No export. Just intelligence.
