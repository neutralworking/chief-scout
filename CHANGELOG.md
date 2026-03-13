# Chief Scout — Changelog

All notable changes to this project are documented here.
Format: grouped by date, newest first. Each entry notes scope and affected areas.

---

## [2026-03-13] Staging / Production Separation

**Scope**: Medium | **Areas**: Infrastructure, Pipeline, App

### Added
- `apps/web/src/lib/env.ts` — Environment detection (`NEXT_PUBLIC_APP_ENV`: staging | production)
- `pipeline/40_promote_to_prod.py` — Promotion script: syncs only Tier 1 complete profiles to prod Supabase
- Route blocking in production: `/admin`, `/editor`, `/scout-pad`, `/squad` redirect to `/`

### Architecture Decision
- Two Vercel projects (staging vs prod), two Supabase projects (working data vs clean Tier 1)
- One-way promotion: staging → prod, never automatic

---

## [2026-03-13] CS Value System + Cleanup

**Scope**: Medium | **Areas**: Pipeline, UI, Player Detail

### Added
- `pipeline/31_cs_value.py` — CS Value computation pipeline
- CS Value displayed on player cards (with Transfermarkt fallback)
- CS Value on player detail page (relabelled from "Transfer Fee")

### Removed
- Overall rating removed from UI — incomplete and not useful
- Scouting tags nuked, replaced with profiling pipeline for top 5 league players

---

## [2026-03-12] Admin Panel Upgrades

**Scope**: Small | **Areas**: Admin, Tooling

### Added
- SQL console in admin panel + `/sql` remote skill
- Materialized view refresh button
- FEATURES.md index file
- Tiered featured player selection with DOF picks

### Fixed
- Players not loading: removed non-existent columns from API query
- Club detail page TS error: use local ClubPlayer interface

---

## [2026-03-12] Player Seeding + Level Calibration

**Scope**: Medium | **Areas**: Pipeline, Data

### Added
- `pipeline/14_seed_profiles.py` — 98 seed players across 4 batches (50 + 20 + 20 + 8 DM)
- `pipeline/31_infer_levels.py` — Infer player levels via compound score regression
- Physical profile metric added to player cards

### Changed
- Recalibrated player levels from DOF assessment (50 seed players)
- Player card redesigned with 4 quadrant metrics (TEC/PHY/MEN/TAC)
- Removed `peak` field from squad page, API, and profiles

---

## [2026-03-12] Personality Inference

**Scope**: Small | **Areas**: Pipeline, Player Detail

### Added
- Multi-source personality inference from career history + news sentiment data

### Fixed
- Personality section visibility on player detail page

---

## [2026-03-12] Scouting Tags + Squad Roles + Formations

**Scope**: Large | **Areas**: Pipeline, App, Clubs, Formations

### Added
- `pipeline/29_scouting_tags.py` — Auto-assign scouting tags from attributes, career, news
- `pipeline/30_squad_roles.py` — DOF-level squad role assessment
- DOF deep profiling script for seed player club lookup

### Changed
- Clubs + leagues pages rebuilt with search, filters, league grouping
- Formations: expanded slot_count, pitch layout, role + player mapping
- Archetype pipeline: fixed source weighting
- Player page overhauled
- Tag/role changes applied across app: profile page, squad, rankings

---

## [2026-03-12] Player Editor

**Scope**: Medium | **Areas**: App (new route)

### Added
- `/editor` — Player search for editing
- `/editor/[id]` — Full player editor: attributes, profile fields, tags system, scale normalization

### Changed
- Tags system redesigned with normalized scales

---

## [2026-03-12] News + Cron + Choices Fixes

**Scope**: Small | **Areas**: App, Pipeline, Vercel

### Added
- News cron route (`/api/cron/news`), daily at 6am UTC via Vercel
- Radar weight refinements across pipeline scripts

### Fixed
- Football Choices crash
- Vercel cron config: daily at 6am (Hobby plan limit)

---

## [2026-03-12] Pipeline: Grades + Ratings + Key Moments

**Scope**: Large | **Areas**: Pipeline

### Added
- `pipeline/26_key_moments.py` — Career milestones + news moments
- `pipeline/27_player_ratings.py` — Composite overall rating from attribute grades
- `pipeline/27_understat_grades.py` — Understat xG/xA → attribute grades
- `pipeline/28_statsbomb_grades.py` — StatsBomb event data → attribute grades

### Changed
- Radar scoring rewritten
- Club data fixes

---

## [2026-03-12] Player Detail + Dashboard Redesign

**Scope**: Large | **Areas**: App UI

### Changed
- Player detail: removed legacy fields, added radar, compact single-screen layout
- Dashboard: combined featured player + radar into single panel, added Browse section
- Player cards: themed personality icons, value sort, hide empty attributes
- Clubs/leagues display fixes, news tags, player speed, dashboard layout

### Fixed
- Players page crash: paginated card rendering (60 at a time)
- Pagination: PostgREST caps at 1000 rows per request
- Dashboard news headlines now clickable

---

## [2026-03-12] Archetype + QA + Radar

**Scope**: Medium | **Areas**: Pipeline, App, Testing

### Changed
- Archetype scoring rewritten to use SACROSANCT 13 playing models
- Position/role suitability radar added to dashboard featured player

### Added
- QA test suites for pipeline and frontend

---

## [2026-03-12] Glass UI Overhaul

**Scope**: Large | **Areas**: App UI

### Changed
- Glass UI applied across the app: frosted panels, refined typography
- Homepage reorganized: hero, quick stats, featured player
- Choices improvements
- Radar + career visualization added

---

## [2026-03-12] Transfermarkt + Club Pipeline

**Scope**: Medium | **Areas**: Pipeline, Data

### Added
- `pipeline/25_transfermarkt_ingest.py` — Transfermarkt market values pipeline
- Board-meeting skill (`/board-meeting`)

### Fixed
- `clubs.name` → `clubname` column mapping across pipeline scripts

---

## [2026-03-12] Tactical Roles + Schema Fixes

**Scope**: Medium | **Areas**: Pipeline, Formations, Schema

### Added
- Tactical roles system for formations (migration 018)
- `pipeline/25_formation_slots.py` — Populate formation slots with role-assigned positions

### Fixed
- Column name mismatches: `clubs.name` → `clubname`, `news_stories.title` → `headline`
- Dashboard QA issues + club pipeline bugs
