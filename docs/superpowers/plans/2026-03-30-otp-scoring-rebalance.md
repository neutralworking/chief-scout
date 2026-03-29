# OTP Scoring Rebalance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken OTP ideal-squad scoring so star players appear and GKs can't fill outfield slots.

**Architecture:** Add a new `scorePlayerForSlot()` function that uses pipeline 27's pre-computed `best_role_score` with a position guard via `SLOT_POSITION_MAP`. The existing `scorePlayerForRole()` stays untouched — it's used by 4 other callers (four-pillars, FormationDetail, fixtures preview, Gaffer dynamic) for role-name-based scoring, which is a different purpose.

**Tech Stack:** TypeScript, Vitest, Supabase (read-only for verification)

**Spec:** `docs/superpowers/specs/2026-03-29-otp-scoring-rebalance-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/lib/formation-intelligence.ts` | Modify | Add `scorePlayerForSlot()`, fix `BLUEPRINT_ROLE_MAP` bugs |
| `apps/web/src/lib/ideal-squad.ts` | Modify | Switch `scoreFormation()` to `scorePlayerForSlot()`, fix strength normalisation |
| `apps/web/tests/otp-scoring.test.ts` | Create | Tests for the new scoring function |
| Cron endpoint (manual) | Run | Recompute all 48 ideal squads |

**NOT modified:** `scorePlayerForRole()` (old function stays for its 4 existing callers)

---

### Task 1: Write tests for `scorePlayerForSlot()`

**Files:**
- Create: `apps/web/tests/otp-scoring.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from "vitest";
import { scorePlayerForSlot, SLOT_POSITION_MAP } from "@/lib/formation-intelligence";

describe("scorePlayerForSlot", () => {
  // ── Position guard ──────────────────────────────────────────────
  it("rejects GK in CF slot", () => {
    const player = { level: 90, position: "GK", best_role_score: 88 };
    expect(scorePlayerForSlot(player, "CF")).toBe(-1);
  });

  it("rejects CF in GK slot", () => {
    const player = { level: 90, position: "CF", best_role_score: 88 };
    expect(scorePlayerForSlot(player, "GK")).toBe(-1);
  });

  it("rejects CD in WF slot", () => {
    const player = { level: 85, position: "CD", best_role_score: 82 };
    expect(scorePlayerForSlot(player, "WF")).toBe(-1);
  });

  it("allows CM in DM slot (compatible)", () => {
    const player = { level: 85, position: "CM", best_role_score: 82 };
    expect(scorePlayerForSlot(player, "DM")).toBeGreaterThan(0);
  });

  it("allows WF in CF slot (compatible)", () => {
    const player = { level: 88, position: "WF", best_role_score: 85 };
    expect(scorePlayerForSlot(player, "CF")).toBeGreaterThan(0);
  });

  // ── Exact position match uses full score ────────────────────────
  it("returns full best_role_score for exact position match", () => {
    const player = { level: 90, position: "CF", best_role_score: 88 };
    expect(scorePlayerForSlot(player, "CF")).toBe(88);
  });

  it("returns full best_role_score for GK in GK slot", () => {
    const player = { level: 85, position: "GK", best_role_score: 80 };
    expect(scorePlayerForSlot(player, "GK")).toBe(80);
  });

  // ── Compatible position gets 0.90 discount ─────────────────────
  it("discounts compatible-but-not-exact position by 0.90", () => {
    const player = { level: 85, position: "CM", best_role_score: 82 };
    expect(scorePlayerForSlot(player, "DM")).toBeCloseTo(82 * 0.90, 1);
  });

  it("discounts WF in CF slot by 0.90", () => {
    const player = { level: 88, position: "WF", best_role_score: 85 };
    expect(scorePlayerForSlot(player, "CF")).toBeCloseTo(85 * 0.90, 1);
  });

  // ── NULL best_role_score falls back to level ────────────────────
  it("falls back to level when best_role_score is null", () => {
    const player = { level: 87, position: "CF", best_role_score: null };
    expect(scorePlayerForSlot(player, "CF")).toBe(87);
  });

  it("falls back to 0 when both are null", () => {
    const player = { level: null, position: "CF", best_role_score: null };
    expect(scorePlayerForSlot(player, "CF")).toBe(0);
  });

  // ── Star players beat low-level players ─────────────────────────
  it("Mbappe (RS 90, CF) beats Carlton Morris (RS 72, CF) in CF slot", () => {
    const mbappe = { level: 92, position: "CF", best_role_score: 90 };
    const morris = { level: 73, position: "CF", best_role_score: 72 };
    expect(scorePlayerForSlot(mbappe, "CF")).toBeGreaterThan(
      scorePlayerForSlot(morris, "CF")
    );
  });

  it("level-87 player with no data beats level-73 with data", () => {
    const star = { level: 87, position: "CM", best_role_score: null };
    const scrub = { level: 73, position: "CM", best_role_score: 72 };
    expect(scorePlayerForSlot(star, "CM")).toBeGreaterThan(
      scorePlayerForSlot(scrub, "CM")
    );
  });

  // ── NULL position is rejected ───────────────────────────────────
  it("rejects null position", () => {
    const player = { level: 85, position: null, best_role_score: 80 };
    expect(scorePlayerForSlot(player, "CF")).toBe(-1);
  });

  // ── Unknown slot position is rejected ───────────────────────────
  it("rejects unknown slot position", () => {
    const player = { level: 85, position: "CF", best_role_score: 80 };
    expect(scorePlayerForSlot(player, "ST")).toBe(-1);
  });
});

describe("SLOT_POSITION_MAP", () => {
  it("GK only allows GK", () => {
    expect(SLOT_POSITION_MAP["GK"]).toEqual(["GK"]);
  });

  it("CF allows CF and WF", () => {
    expect(SLOT_POSITION_MAP["CF"]).toEqual(["CF", "WF"]);
  });

  it("every position group has at least one entry", () => {
    for (const pos of ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"]) {
      expect(SLOT_POSITION_MAP[pos]?.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/solid-snake/Documents/chief-scout/apps/web && npx vitest run tests/otp-scoring.test.ts`

Expected: Fails with "scorePlayerForSlot is not a function" (doesn't exist yet).

- [ ] **Step 3: Commit test file**

```bash
git add apps/web/tests/otp-scoring.test.ts
git commit -m "test(otp): add scorePlayerForSlot tests — all red"
```

---

### Task 2: Add `scorePlayerForSlot()` function

**Files:**
- Modify: `apps/web/src/lib/formation-intelligence.ts` — add new function after line 482

The existing `scorePlayerForRole()` stays untouched. It's used by `four-pillars.ts`, `FormationDetail.tsx`, `choices/dynamic/route.ts`, and `fixtures/[id]/preview/route.ts` for role-name-based scoring.

- [ ] **Step 1: Add the new function after `scorePlayerForRole`**

Add after line 482 (after the closing `}` of `scorePlayerForRole`):

```ts
/**
 * Score a player for a formation slot using pipeline 27's pre-computed best_role_score.
 * Used by OTP ideal squad computation. Unlike scorePlayerForRole() which matches by
 * role name, this scores by position compatibility — the role score already encodes
 * tactical fit via pipeline 27.
 *
 * Scoring:
 * - Position guard: player.position must be in SLOT_POSITION_MAP[slotPosition], else -1
 * - Exact position match: full best_role_score
 * - Compatible position: best_role_score * 0.90
 * - Fallback (no best_role_score): player level
 */
export function scorePlayerForSlot(
  player: {
    level: number | null;
    position: string | null;
    best_role_score: number | null;
  },
  slotPosition: string
): number {
  // Position guard — reject incompatible positions
  const validPositions = SLOT_POSITION_MAP[slotPosition];
  if (!validPositions || !player.position || !validPositions.includes(player.position)) {
    return -1;
  }

  // Base score from pipeline 27's pre-computed role score, or level as fallback
  const base = player.best_role_score ?? player.level ?? 0;

  // Exact position match gets full score; compatible position gets 0.90
  if (player.position === slotPosition) {
    return base;
  }
  return base * 0.90;
}
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/solid-snake/Documents/chief-scout/apps/web && npx vitest run tests/otp-scoring.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/formation-intelligence.ts
git commit -m "feat(otp): add scorePlayerForSlot — position-guarded best_role_score scoring"
```

---

### Task 3: Wire `scorePlayerForSlot` into `scoreFormation()` and fix strength

**Files:**
- Modify: `apps/web/src/lib/ideal-squad.ts`

- [ ] **Step 1: Update import**

In `ideal-squad.ts` line 9, change the import:

```ts
import {
  FORMATION_BLUEPRINTS,
  scorePlayerForRole,
  type FormationBlueprint,
} from "@/lib/formation-intelligence";
```

To:

```ts
import {
  FORMATION_BLUEPRINTS,
  scorePlayerForSlot,
  type FormationBlueprint,
} from "@/lib/formation-intelligence";
```

- [ ] **Step 2: Update `scoreFormation()` call site**

Replace lines 183-191:

```ts
      const s = scorePlayerForRole(
        {
          level: p.level,
          archetype: p.archetype,
          personality_type: p.personality_type,
          position: p.position,
        },
        slot.role
      );
```

With:

```ts
      const s = scorePlayerForSlot(
        {
          level: p.level,
          position: p.position,
          best_role_score: p.best_role_score,
        },
        slot.position
      );
```

- [ ] **Step 3: Update strength normalisation**

Replace lines 321-325:

```ts
  // Compute strength: average role score of starting XI normalized to 0-100
  // Max theoretical role score ~230 (level 20 + 120 archetype + 60 personality + 30 position)
  const avgRoleScore =
    bestXI.reduce((sum, s) => sum + s.role_score, 0) / bestXI.length;
  const strength = Math.min(100, Math.round((avgRoleScore / 230) * 100));
```

With:

```ts
  // Strength = average role score of starting XI (already 0-99 scale from pipeline 27)
  const avgRoleScore =
    bestXI.reduce((sum, s) => sum + s.role_score, 0) / bestXI.length;
  const strength = Math.min(100, Math.round(avgRoleScore));
```

- [ ] **Step 4: Run tests + type check**

Run: `cd /Users/solid-snake/Documents/chief-scout/apps/web && npx vitest run tests/otp-scoring.test.ts && npx tsc --noEmit`

Expected: Tests pass, no type errors. The old `scorePlayerForRole` is still exported and its 4 callers are unaffected.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ideal-squad.ts
git commit -m "feat(otp): wire scorePlayerForSlot into scoreFormation, fix strength normalisation"
```

---

### Task 4: Fix `BLUEPRINT_ROLE_MAP` bugs

**Files:**
- Modify: `apps/web/src/lib/formation-intelligence.ts:363-401`

- [ ] **Step 1: Fix duplicate `Prima Punta` key**

In `BLUEPRINT_ROLE_MAP`, there are two `"Prima Punta"` keys (the second silently overwrites the first):

```ts
  "Prima Punta": "Prima Punta",
  ...
  "Prima Punta": "Colossus",  // BUG: overwrites above
```

Replace the second one:

```ts
  "Colossus": "Colossus",
```

- [ ] **Step 2: Add missing "Shuttler" mapping**

The 4-4-2 blueprint uses "Shuttler" for the Giggs WM slot but it's unmapped. Add to `BLUEPRINT_ROLE_MAP`:

```ts
  "Shuttler": "Winger",
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/formation-intelligence.ts
git commit -m "fix: BLUEPRINT_ROLE_MAP duplicate Prima Punta key, add Shuttler mapping"
```

---

### Task 5: Full verification

- [ ] **Step 1: Full test suite**

Run: `cd /Users/solid-snake/Documents/chief-scout/apps/web && npx vitest run`

Expected: All tests pass (both new OTP tests and existing types tests).

- [ ] **Step 2: TypeScript build check**

Run: `cd /Users/solid-snake/Documents/chief-scout/apps/web && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Dev build check**

Run: `cd /Users/solid-snake/Documents/chief-scout/apps/web && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

---

### Task 6: Recompute ideal squads and spot-check

- [ ] **Step 1: Run the cron endpoint to recompute all 48 nations**

Start dev server and hit the cron with force:

```bash
cd /Users/solid-snake/Documents/chief-scout/apps/web && npm run dev &
sleep 5
curl "http://localhost:3000/api/cron/otp-squads?force=true" -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)"
```

Expected: JSON response with `"computed": 48`, zero errors.

- [ ] **Step 2: Spot-check England's ideal XI**

```bash
curl -s "http://localhost:3000/api/on-the-plane/nations/68/ideal" | python3 -m json.tool | head -80
```

Verify:
- Saka, Bellingham, Rice, Foden, Palmer should appear in the XI
- No GKs in outfield slots
- Strength should be 85-95 range

- [ ] **Step 3: Spot-check France**

Verify: Mbappe, Saliba, Tchouameni should appear. No Maignan at CF.

- [ ] **Step 4: Spot-check Argentina**

Verify: Messi, Martinez, Mac Allister should appear. No Rulli at WF.

- [ ] **Step 5: Spot-check a thin nation (Qatar)**

Verify: Squad of 26 filled, strength in 30-60 range (not negative), level-based fallback working.

- [ ] **Step 6: Check GK distribution via SQL**

```sql
SELECT wn.slug,
  COUNT(*) FILTER (WHERE elem->>'position' = 'GK') as gk_count
FROM otp_ideal_squads ois
JOIN wc_nations wn ON wn.nation_id = ois.nation_id,
  jsonb_array_elements(ois.squad_json) as elem
GROUP BY wn.slug
HAVING COUNT(*) FILTER (WHERE elem->>'position' = 'GK') != 3
ORDER BY gk_count;
```

Expected: Zero rows (every nation has exactly 3 GKs).
