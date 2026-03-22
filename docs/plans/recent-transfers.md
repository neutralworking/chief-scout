# Recent Transfers Feature

> **Status**: Planned (branch preserved: `claude/transfers-supabase-feature-mmBSP`)
> **Route**: `/transfers`

## What Exists (on branch)

Full implementation from 2026-03-15, needs renumbering + conflict resolution:

| Component | File | Notes |
|-----------|------|-------|
| Migration | `pipeline/sql/030_transfers.sql` | transfers table, transfer_comparables view, RLS |
| Seed script | `pipeline/42_seed_transfers.py` | ~44 transfers across 3 windows — **renumber to 84+** |
| Ingest script | `pipeline/43_ingest_transfers.py` | CSV/JSON import with validation — **renumber to 85+** |
| Comparables lib | `pipeline/lib/comparables.py` | find_comparables() for valuation context |
| API route | `apps/web/src/app/api/transfers/route.ts` | Filters: window, fee_type, position, league, fee range |
| Page | `apps/web/src/app/transfers/page.tsx` | Window tabs, type pills, position pills, sort |
| Table component | `apps/web/src/components/TransfersTable.tsx` | Expandable rows, fee badges, "Use as Comparable" |

## Before Merging

1. Renumber pipeline scripts (42/43 → 84/85) to avoid conflict with dof_calibration/cs_value
2. Migration 030 may conflict — check if number is taken (it is, reassign)
3. Sidebar.tsx has been restructured (grouped nav) — add Transfers to Browse group
4. Review TransfersTable against current design system (glass panels, pillar colors)
5. Update seed data to include 2026 summer window transfers

## Integration Points

- Valuation engine: `find_comparables()` provides fee context for CS Value calculations
- Player detail page: "Recent Transfer" badge/section
- Free agents: cross-reference with contract expiry data
- News: auto-tag transfer stories
