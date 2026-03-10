# Prototypes — Chief Scout

Tracks each UI prototype built during development. Updated by `/prototype-tracker`.

---

## B1 — App Shell + Player List with Filters

| Field | Value |
|-------|-------|
| **Date** | 2026-03-10 |
| **Branch** | `claude/ceo-assessment-0Q7EL` |
| **Commit** | `1150c0e` |
| **Status** | Shipped |
| **Spec** | `docs/plans/player-intelligence-card-spec.md` |
| **DoF Input** | Filters built alongside list from day one (not deferred) |

### What was built

**Routes:**
- `/players` — Player list with card grid
- `/players/[id]` — Player Intelligence Card detail page
- `/` — Redirects to `/players`

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| `Sidebar` | `src/components/Sidebar.tsx` | Navigation + position/pursuit shortcuts |
| `PlayerCard` | `src/components/PlayerCard.tsx` | List card: position, name, club, level/peak, archetype, pursuit, tier |
| `PlayerFilters` | `src/components/PlayerFilters.tsx` | Search + position/pursuit/sort dropdowns |

**Infrastructure:**
| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Lazy Supabase client (service role, server-side) |
| `src/lib/types.ts` | TypeScript types, position/pursuit constants, helpers |
| `src/app/globals.css` | Design tokens from Intelligence Card spec |

### Design tokens implemented

All color tokens from the spec: `--bg-base`, `--bg-surface`, `--bg-elevated`, `--border-subtle`, compound category accents (mental/physical/tactical/technical), pursuit status colors, sentiment colors, tier colors.

### Filter capabilities

| Filter | Type | Notes |
|--------|------|-------|
| Search | Text input | Name search (ilike) |
| Position | Dropdown | GK/CD/WD/DM/CM/WM/AM/WF/CF |
| Pursuit Status | Dropdown | Priority/Interested/Scout Further/Watch/Monitor/Pass |
| Sort | Dropdown | Pursuit Status (default), Level, Name, Position |

Default sort follows DoF priority: pursuit status > position > level desc.

### Detail page zones (from spec)

| Zone | Status | Notes |
|------|--------|-------|
| A: Identity Bar | Built | Name, club, nation, age, height, foot, position, pursuit, tier |
| B: Personality + Archetype | Built | MBTI badge + dimension bars, archetype + blueprint |
| C: Key Moments | Stub | Needs news_stories data |
| D: Market Position | Built | MVT, true MVT, premium, scarcity |
| E: Attribute Detail | Not started | Needs attribute_grades aggregation |
| F: Supplementary | Partial | Scouting notes only |

### What's next

- B2: Refine design tokens, add Inter/JetBrains Mono fonts
- B3: Wire up `player_intelligence_card` view data end-to-end
- C1: Build `<PersonalityBadge>` and `<ArchetypeShape>` hero components
- E1: Attribute detail drill-down with progressive disclosure
