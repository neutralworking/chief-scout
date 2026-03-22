# Tactical Philosophies System

> **Status**: Partially merged (core files in main, seed script as `pipeline/83_seed_philosophies.py`)
> **Route**: `/tactics` (page already exists)

## What's In Main

| Component | File | Status |
|-----------|------|--------|
| Page | `apps/web/src/app/tactics/page.tsx` | Exists |
| Philosophy cards | `apps/web/src/components/PhilosophyCard.tsx` | Exists |
| Role browser | `apps/web/src/components/RoleBrowser.tsx` | Exists |
| Tactics page component | `apps/web/src/components/TacticsPage.tsx` | Exists |
| Philosophy data | `apps/web/src/lib/tactical-philosophies.ts` | Exists |
| Seed script | `pipeline/83_seed_philosophies.py` | Merged (renumbered from 31) |
| Migration | `pipeline/sql/031_tactical_philosophies.sql` | Exists |

## Remaining Work

1. **Run seed script** — populate `tactical_philosophies` table if empty
2. **Club philosophy assignment** — link clubs to philosophies via `clubs.philosophy_id`
3. **Philosophy detail page** — `/tactics/[slug]` showing clubs, key players, formation variants
4. **Player-philosophy fit** — score how well a player fits a tactical system (archetype affinity)
5. **Formation page integration** — show philosophy context on `/formations`

## 10 Philosophies

Tiki-Taka, Gegenpressing, Catenaccio, Total Football, Direct Play,
Counter-Attack, Positional Play, Wing Play, Route One, Fluid Attack
