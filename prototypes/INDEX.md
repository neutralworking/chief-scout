# Prototypes — Chief Scout

Tracks each UI prototype built during development. Updated by `/prototype-tracker`.

---

## B1 — App Shell + Player List with Filters

| Field | Value |
|-------|-------|
| **Date** | 2026-03-10 |
| **Branch** | `claude/ceo-assessment-0Q7EL` |
| **Commit** | `1150c0e` |
| **Status** | Needs maintenance |
| **Note** | Schema has changed since build. Production env may not render. Sidebar links to `/news` which doesn't exist. |
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
| B: Personality + Archetype | **Done** | Football personality matrix (A/I, N/X, L/S, C/P), PlayerIdentityPanel composite |
| C: Key Moments | Stub | Needs news_stories data |
| D: Market Position | Built | MVT, true MVT, premium, scarcity |
| E: Attribute Detail | Foundation | AttributeBar renders; drill-down interaction not started |
| F: Supplementary | Partial | Scouting notes only |

---

## B3 — Wire `player_intelligence_card` End-to-End

| Field | Value |
|-------|-------|
| **Date** | 2026-03-11 |
| **Branch** | `claude/daily-planning-session-Nzxg6` |
| **Commit** | `870435b` |
| **Status** | Needs maintenance |
| **Note** | Depends on `player_intelligence_card` view + service key. Not confirmed working in production. |

Server components with direct Supabase queries. All detail page zones populated from the `player_intelligence_card` view. Attribute grades fetched separately. Key moments from `news_stories`.

---

## C1 — PersonalityBadge + ArchetypeShape Hero Components

| Field | Value |
|-------|-------|
| **Date** | 2026-03-11 |
| **Branch** | `claude/daily-planning-session-Nzxg6` |
| **Commit** | `187f9aa` → `feb8f46` (personality matrix fix) |
| **Status** | Needs maintenance |
| **Note** | Migration `010_fix_personality_codes.sql` still pending. DB views output MBTI letters not football codes. |

### Components built

| Component | File | Purpose |
|-----------|------|---------|
| `PersonalityBadge` | `src/components/PersonalityBadge.tsx` | Football personality code (16 types), dimension bars (A/I, N/X, L/S, C/P), competitiveness/coachability dots. 3 sizes: hero/compact/mini. |
| `ArchetypeShape` | `src/components/ArchetypeShape.tsx` | Archetype name, confidence dots, model fit bars, blueprint display. 2 sizes: full/compact. |
| `PlayerIdentityPanel` | `src/components/PlayerIdentityPanel.tsx` | WHO + HOW composite. Horizontal/vertical layout. Used in detail page Zone B. |

### Personality matrix (not MBTI)

Uses custom football-native dimensions with 0-100 scales:
- **A/I** — Game Reading (Analytical vs Instinctive)
- **N/X** — Motivation (Intrinsic vs Extrinsic)
- **L/S** — Social Orientation (Leader vs Soloist)
- **C/P** — Pressure Response (Competitor vs Composer)

8 primary archetypes: The General (ANLC), The Maestro (INSP), The Machine (ANSC), The Captain (INLC), The Conductor (ANLP), The Genius (IXSP), The Showman (AXLC), The Maverick (IXSC).

### Pending

- SQL migration `010_fix_personality_codes.sql` needs applying to Supabase (DB views still output MBTI letters)

### What's next

- B2: Add Inter + JetBrains Mono fonts, refine spacing
- E1: Attribute detail drill-down with progressive disclosure
