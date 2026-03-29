# OTP Scoring Rebalance — Design Spec

## Problem

The OTP ideal squad algorithm uses a TypeScript `scorePlayerForRole()` that scores players via archetype (+120), personality (+60), position (+30), and level (0-20). This means data completeness drives selection: a Level 73 League Two player with matching archetype/personality (score ~193) beats a Level 92 world-class player with no archetype data (score ~92).

Result: England's ideal XI includes Carlton Morris (Luton) and excludes Saka, Bellingham, Rice. GKs appear as CFs because there's no position guard.

## Solution

Replace the custom TypeScript scoring with the pre-computed `best_role_score` from pipeline 27, which already exists on every rated player via the `player_intelligence_card` view. Pipeline 27 computes role scores from 80+ attribute grades across multiple sources, handles sparse data via proxy inference and level anchoring, and normalises to 0-99. It is the authoritative scoring system.

## Scoring Formula

For each formation slot (with a required position and tactical role):

```
if player.position NOT in SLOT_POSITION_MAP[slot.position]:
    return -1  (never select — hard position guard)

base = player.best_role_score ?? (player.level ?? 0)

if player.position matches slot.position exactly:
    score = base  (natural position, full score)
elif player.position in SLOT_POSITION_MAP[slot.position]:
    score = base * 0.90  (compatible position, small discount)
```

Scale: 0-99. No archetype/personality matching needed — pipeline 27 already factors model fit into the score.

### Why no role-name matching tier

Pipeline 27's `best_role` names (e.g., "Tuttocampista", "Metodista", "Pivote") use a different vocabulary from formation blueprint slot roles (e.g., "Box-to-Box", "Deep Playmaker", "Anchor"). A `BLUEPRINT_ROLE_MAP` exists but is incomplete and has a duplicate-key bug (`"Prima Punta"` maps to both `"Prima Punta"` and `"Colossus"` — the second silently wins). Rather than maintaining a fragile mapping table, scoring uses **position fit only**. The `best_role_score` already encodes tactical suitability — a Regista-typed player already scores higher on passing/vision attributes than a Ball Winner. Adding a role-name bonus on top would double-count.

### Fallback for NULL `best_role_score`

When `best_role_score` is null (no grades), use `(level ?? 0)` directly. The level scale (87 = top-5 league, 90 = world class, 95 = GOAT) maps reasonably to the 0-99 `best_role_score` scale. No discount — a level-87 player with no grades should rank alongside a role-scored-87 player, not below.

### Position Guard

`SLOT_POSITION_MAP` already exists in `formation-intelligence.ts` but is never used. Wire it into scoring:

```
GK: [GK]              — only GKs in goal
CD: [CD]              — only CBs at centre-back
WD: [WD, CD]          — fullbacks or CBs cover wide
DM: [DM, CM]          — DMs or CMs in the pivot
CM: [CM, DM, AM]      — central midfielders
WM: [WM, AM, WF]      — wide mids, AMs, or wide forwards
AM: [AM, CM, WF, WM]  — attacking mids
WF: [WF, WM, AM, CF]  — wide forwards
CF: [CF, WF]          — strikers or wide forwards
```

This prevents GK-as-CF, CD-as-WF, etc.

## Changes Required

### 1. `formation-intelligence.ts` — rewrite `scorePlayerForRole()`

Current signature:
```ts
scorePlayerForRole(player: { level, archetype, personality_type, position }, roleName): number
```

New signature:
```ts
scorePlayerForRole(player: { level, position, best_role_score }, slotPosition: string): number
```

- Replace `roleName` with `slotPosition` (the formation slot's position, e.g., "CF")
- Remove archetype/personality logic entirely
- Use `SLOT_POSITION_MAP` for position guard (return -1 if invalid)
- Score from `best_role_score` with exact-position / compatible-position tiers
- Fallback to `level` when `best_role_score` is null

### 2. `ideal-squad.ts` — update `scoreFormation()` call site

Pass `slot.position` instead of `slot.role` to the new `scorePlayerForRole()`. The `PoolPlayer` interface already includes `best_role` and `best_role_score`.

### 3. `ideal-squad.ts` — update strength normalisation

Current: `(avgRoleScore / 230) * 100`. New max is ~99, so: `Math.min(100, Math.round(avgRoleScore))`. The role score IS the strength percentage.

### 4. Fix `BLUEPRINT_ROLE_MAP` duplicate key bug

```ts
"Prima Punta": "Prima Punta",
"Prima Punta": "Colossus",  // silently overwrites — fix to separate key
```

Fix the duplicate. This map is still used by `resolveRoleName()` for UI display.

### 5. Fix unmapped "Shuttler" role

The 4-4-2 blueprint assigns "Shuttler" to the Giggs WM slot but it's not in `ROLE_INTELLIGENCE` or `BLUEPRINT_ROLE_MAP`. Map it to "Winger" or add a new entry.

### 6. Recompute all 48 ideal squads

Run the cron with `?force=true` after deploying the fix.

## What Does NOT Change

- Pipeline 27 scoring logic (Python) — untouched
- The `ROLE_INTELLIGENCE` map — still used for UI tooltips and references
- `FORMATION_BLUEPRINTS` — still defines slot roles per formation
- Pool categorisation logic (established/rising_star/etc.)
- User scoring formula (`compareSquads`) — still 50/35/15 split
- The submit endpoint
- The squad builder UI
- `PoolPlayer` interface — already has `best_role` and `best_role_score`
- Cron `squad_json` — already writes `role` for starters via `s.role`

## Verification

After deploying + recomputing squads, spot-check:

1. **England XI**: Should include Saka, Bellingham, Rice, Foden, Palmer (all have role scores 85+)
2. **France XI**: Should include Mbappe, Saliba, Tchouameni, Griezmann
3. **Argentina XI**: Should include Messi, Martinez, Mac Allister
4. **GK guard**: No nation should have a GK in any outfield slot
5. **Thin nations**: Qatar/Panama should have level-based squads, not garbage
6. **GK count**: Every squad should have exactly 3 GKs (1 starter + 2 bench)

## Expected Outcomes

- Star players appear in their nation's ideal XI
- GKs only fill GK slots
- Nations with thin data get level-based approximations instead of garbage
- Strength scores become meaningful (top nations ~85-95, thin nations ~40-60)
