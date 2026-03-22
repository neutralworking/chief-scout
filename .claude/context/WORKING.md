# Working Context — Chief Scout
> Auto-updated at session start/end. Last updated: 2026-03-22

## Current Sprint
1. **Archetype System v2** — COMPLETE. 29 archetypes, 8,181 classified (93%).
2. **Valuation Engine Fix** — COMPLETE. v1.1-pillars, 16,813 revalued with chunking.
3. **Pipeline Chain** — COMPLETE. 110k grades → 12.7k ratings → fingerprints → archetypes.

## Resume Tasks (next session)
- Legends page polish: user said "can improve" — review trait pill sizing, column widths, mobile layout
- Expand trait seeds to peak 88-91 legends (~30 more)
- Consider trait inference for active players from editorial traits

## Active Decisions
- Pulse (1,037) and Outlet (1,041) still the largest archetypes — may need further splitting
- Foden position manually changed WM→AM — may revert on next pipeline run
- Women's players: decide long-term approach (separate pipeline? same tables?)

## Blockers
- ~8,000 players lack AF data — archetype system can't classify without stats
- FBRef CSV data only has basic columns — advanced stats need manual HTML paste

## What Shipped (session 19b, 2026-03-22)

### Legends page overhaul
- Removed Last Club + Score columns
- Added editable Primary/Secondary skillset dropdowns (admin)
- Added auto-derived Model label (from MODEL_LABELS map)
- Added Similar active player column (IntersectionObserver lazy loading)
- MODEL_LABELS (130 compound entries) ported to TypeScript

### Legend-aware similar player scoring
- Two scoring paths: scoreLegendToActive (skillset-first) vs scoreActiveToActive (balanced)
- Adjacent position search (CF→AM/WF, CD→DM, etc.)
- Quality floor: level >= peak - 9 (min 80)

### Playing style traits
- 16 editorial traits (12 new + 4 reused from SACROSANCT)
- Pipeline 04d seeded 152 traits across 65 legends (peak >= 92)
- Trait pills: colored by category (style=amber, tactical=purple, physical=blue, behavioral=green)
- Admin add/remove via dropdown + POST /api/admin/trait-update
- Source deduplication: editor wins over scout

## Key Metrics
| Table | Count | Last Updated |
|-------|-------|-------------|
| people | 21,683+ | 2026-03-19 |
| AF grades | 110,047 | 2026-03-21 |
| earned_archetype assigned | 8,181 | 2026-03-21 |
| player_valuations | 16,813 | 2026-03-22 |
| editorial traits seeded | 152 (65 legends) | 2026-03-22 |
| Tests passing | 292 | 2026-03-22 |

## Infrastructure Notes
- `assessments-cron.yml` — daily 3:30am UTC, computes all pillar scores
- `MODEL_LABELS` in `apps/web/src/lib/models.ts` — mirrors `pipeline/lib/models.py`
- `TRAIT_DEFINITIONS` in `trait-role-impact.ts` — canonical trait registry (30 traits total)
- `POST /api/admin/trait-update` — editorial trait add/remove with ALLOWED_TRAITS validation
