# Legend Skillsets & Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed Primary-Secondary skillsets and playing style traits for top legends, surface them on the Legends page, and add a comparison metric linking legends to active players.

**Architecture:** A curated seed script assigns skillsets (Primary-Secondary compound), best_role, and a playing_style text to ~200 legends (peak 88+). The Legends page gains a "Skillset" column and style tooltip. A new API endpoint computes "plays like X" comparisons between active players and legends using model-score similarity. DB cleanup merges 3 known duplicates.

**Tech Stack:** Python seed script, Next.js page updates, Supabase queries

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `pipeline/04c_seed_legend_profiles.py` | Create | Curated legend data: skillset, best_role, playing_style |
| `apps/web/src/app/legends/page.tsx` | Modify | Add Skillset column, style tooltip, "plays like" badge |
| `apps/web/src/app/api/legends/route.ts` | Modify | Return skillset + playing_style fields |
| `apps/web/src/app/api/players/[id]/similar/route.ts` | Modify | Add legend comparisons to existing similar-players |
| `apps/web/src/components/PlayerCard.tsx` | Modify | Show "plays like [Legend]" badge where applicable |

---

### Task 1: Merge 3 duplicate legends

**Files:**
- Modify: DB only (SQL)

- [ ] **Step 1: Merge duplicates keeping the accented/higher-peak version**

```sql
-- Omar Sivori (15943, peak 90) → Omar Sívori (15944, peak 91) — keep 15944
-- Sandor Kocsis (17152, peak 90) → Sándor Kocsis (17153, peak 90) — keep 17153
-- Dejan Savicevic (10186, peak 90) → Dejan Savićević (10187, peak 90) — keep 10187

-- For each: update FKs, delete the dupe
```

Run via psql. Update any `player_profiles`, `attribute_grades`, `player_id_links` FKs that reference the old ID, then delete the old `people` row.

- [ ] **Step 2: Verify no orphaned references**

---

### Task 2: Seed legend skillsets — curated data script

**Files:**
- Create: `pipeline/04c_seed_legend_profiles.py`

This is the core task. The script contains a hand-curated dictionary of ~200 legends with:
- `archetype`: Primary-Secondary compound (e.g. "Creator-Controller")
- `best_role`: tactical role (e.g. "Trequartista")
- `playing_style`: 1-2 sentence description of how they played

- [ ] **Step 1: Write the seed script with curated data**

The script should:
1. Define a `LEGEND_SEEDS` dict: `{person_id: {archetype, best_role, best_role_score, playing_style}}`
2. Connect to DB
3. For each entry, UPDATE `player_profiles` SET archetype, best_role, best_role_score
4. Store `playing_style` in `player_profiles.scouting_notes` (via `player_status.scouting_notes` — legends don't have status rows, so insert if needed... actually store in `player_status.scouting_notes`)
5. Support `--dry-run` and `--player ID`

The curated data covers all 115 legends with peak >= 90 that currently lack skillsets, plus corrections for the ~95 that have bad EAFC-derived ones.

Model assignment rules (from DoF knowledge):
- Primary = dominant playing model (what they were KNOWN for)
- Secondary = secondary strength from a DIFFERENT compound category
- best_role = closest tactical role from the TACTICAL_ROLES list
- best_role_score = peak score (these are legends, their role score = their peak)

- [ ] **Step 2: Run dry-run and verify output**

```bash
python pipeline/04c_seed_legend_profiles.py --dry-run
```

- [ ] **Step 3: Run for real**

```bash
python pipeline/04c_seed_legend_profiles.py
```

- [ ] **Step 4: Commit**

---

### Task 3: Add playing_style column to player_status

**Files:**
- Create: SQL migration

- [ ] **Step 1: Add column**

```sql
ALTER TABLE player_status ADD COLUMN IF NOT EXISTS playing_style TEXT;
COMMENT ON COLUMN player_status.playing_style IS 'Short playing style description (1-2 sentences). Used for legends and scouted players.';
```

- [ ] **Step 2: Update player_intelligence_card view to include playing_style**

---

### Task 4: Update Legends API to return new fields

**Files:**
- Modify: `apps/web/src/app/api/legends/route.ts`

- [ ] **Step 1: Add archetype (skillset) and playing_style to the SELECT**

The API already returns `archetype` and `best_role`. Ensure `playing_style` is included from the joined `player_status` table (or `player_intelligence_card` view if updated).

- [ ] **Step 2: Verify API response includes new fields**

---

### Task 5: Update Legends page — Skillset column + style tooltip

**Files:**
- Modify: `apps/web/src/app/legends/page.tsx`

- [ ] **Step 1: Update Legend interface to include playing_style**

- [ ] **Step 2: Replace "Archetype" column with "Skillset" showing Primary-Secondary**

The column currently shows `archetype` (which IS the skillset compound). Rename the header from "Archetype" to "Skillset". Add a tooltip on hover showing `playing_style` text.

- [ ] **Step 3: Add playing_style as subtitle text on mobile cards**

- [ ] **Step 4: Verify desktop and mobile rendering**

---

### Task 6: Legend comparison — "plays like" matching

**Files:**
- Modify: `apps/web/src/app/api/players/[id]/similar/route.ts`
- Modify: `apps/web/src/components/SimilarPlayers.tsx`

- [ ] **Step 1: Add legend comparison to the similar-players API**

After computing similar active players, also compute similarity against legends (peak >= 88, active=false). Use:
- Same position = required
- Archetype match (Primary model match) = +40
- Secondary model match = +20
- Same best_role = +30
- Peak within 5 of player's level/role_score = +10

Return top 1-2 legend comparisons as a `legendComps` array alongside existing `similar` results.

- [ ] **Step 2: Display "Plays like [Legend]" in SimilarPlayers component**

Show as a distinct badge/section: "Comparison: Plays like [Legend Name] ([peak] peak)"

- [ ] **Step 3: Add "Plays like" badge to PlayerCard for top-tier players**

Only show for players with a legend comparison score >= 70. Small badge: "cf. [Legend]"

---

### Task 7: Commit and verify

- [ ] **Step 1: Type-check**

```bash
npx tsc --noEmit --project apps/web/tsconfig.json
```

- [ ] **Step 2: Commit all changes**
