# Scouting Notes v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate multi-perspective scouting notes (scout/historian/DoF) for the top 500 players by role score, with admin flag-for-rewrite.

**Architecture:** New pipeline script `90_scouting_notes.py` using `lib/llm_router.py` (quality preference) to batch-generate 3-5 sentence notes. Migration 048 adds `notes_flagged` boolean. Minimal UI change: flag icon button on player detail page.

**Tech Stack:** Python/psycopg2 (pipeline), Next.js/TypeScript (UI), Supabase/Postgres (DB)

**Spec:** `docs/superpowers/specs/2026-03-25-scouting-notes-design.md`

---

### Task 1: Migration 048 — `notes_flagged` column

**Files:**
- Create: `pipeline/sql/048_notes_flagged.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 048_notes_flagged.sql — Add flag-for-rewrite to scouting notes
ALTER TABLE player_status ADD COLUMN IF NOT EXISTS notes_flagged boolean DEFAULT false;
```

- [ ] **Step 2: Apply to staging**

Run: `psql "$POSTGRES_DSN" -f pipeline/sql/048_notes_flagged.sql`
Expected: `ALTER TABLE` success

- [ ] **Step 3: Verify column exists**

Run: `psql "$POSTGRES_DSN" -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='player_status' AND column_name='notes_flagged'"`
Expected: One row: `notes_flagged | boolean | false`

- [ ] **Step 4: Commit**

```bash
git add pipeline/sql/048_notes_flagged.sql
git commit -m "migration 048: add notes_flagged to player_status"
```

---

### Task 2: Pipeline script — `90_scouting_notes.py` (core structure)

**Files:**
- Create: `pipeline/90_scouting_notes.py`
- Reference: `pipeline/lib/llm_router.py`, `pipeline/config.py`

- [ ] **Step 1: Write the script skeleton with CLI args and data query**

Create `pipeline/90_scouting_notes.py` with:

```python
"""
90_scouting_notes.py — Multi-perspective scouting note generation.

Uses llm_router (quality preference) to generate 3-5 sentence scouting notes
that weave scout, historian, and DoF perspectives.

Usage:
    python 90_scouting_notes.py --dry-run           # preview without writing
    python 90_scouting_notes.py --top 100            # top 100 by role score
    python 90_scouting_notes.py --player "Vitinha"   # single player
    python 90_scouting_notes.py --force              # overwrite existing notes
    python 90_scouting_notes.py --flagged-only       # re-generate flagged notes
"""
from __future__ import annotations

import argparse
import time
from collections import defaultdict
from datetime import date

import psycopg2
import psycopg2.extras

from config import POSTGRES_DSN
from lib.llm_router import LLMRouter

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Multi-perspective scouting notes")
parser.add_argument("--top", type=int, default=500, help="Top N players by role score")
parser.add_argument("--force", action="store_true", help="Overwrite existing notes")
parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
parser.add_argument("--player", default=None, help="Single player by name")
parser.add_argument("--flagged-only", action="store_true", help="Only re-generate flagged notes")
args = parser.parse_args()

BATCH_SIZE = 10
INTER_BATCH_DELAY = 2  # seconds

# ── Pillar tier mapping ────────────────────────────────────────────────────────
def pillar_tier(score: float | None) -> str | None:
    if score is None:
        return None
    if score >= 70:
        return "strong"
    if score >= 55:
        return "moderate"
    return "limited"

# ── Personality descriptors ────────────────────────────────────────────────────
def personality_descriptors(ei, sn, tf, jp) -> list[str]:
    if any(v is None for v in [ei, sn, tf, jp]):
        return []
    return [
        "extraverted" if ei >= 50 else "introverted",
        "practical" if sn >= 50 else "intuitive",
        "competitive" if tf >= 50 else "empathetic",
        "structured" if jp >= 50 else "spontaneous",
    ]

# ── Fetch top-N players ───────────────────────────────────────────────────────
def fetch_players(cur, args) -> list[dict]:
    """Fetch player dossiers ordered by best_role_score."""
    if args.flagged_only:
        where = "AND ps.notes_flagged = true"
        limit = ""
    elif args.player:
        where = "AND p.name ILIKE %s"
        limit = ""
    else:
        where = ""
        if not args.force:
            where = "AND (ps.scouting_notes IS NULL OR LENGTH(ps.scouting_notes) <= 20)"
        limit = f"LIMIT {args.top}"

    query = f"""
        SELECT p.id, p.name,
               EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
               pp.position, c.clubname AS club, n.name AS nation,
               pp.earned_archetype, pp.archetype, pp.blueprint,
               pp.best_role, pp.best_role_score,
               pp.technical_score, pp.tactical_score,
               pp.mental_score, pp.physical_score,
               ppers.ei, ppers.sn, ppers.tf, ppers.jp,
               pm.market_value_tier, pm.transfer_fee_eur,
               ps.scouting_notes, ps.notes_flagged,
               p.height_cm, p.preferred_foot, pp.side
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        LEFT JOIN player_personality ppers ON ppers.person_id = p.id
        LEFT JOIN player_market pm ON pm.person_id = p.id
        LEFT JOIN player_status ps ON ps.person_id = p.id
        LEFT JOIN clubs c ON c.id = p.club_id
        LEFT JOIN nations n ON n.id = p.nation_id
        WHERE pp.best_role_score IS NOT NULL
          AND p.active = true
          {where}
        ORDER BY pp.best_role_score DESC NULLS LAST
        {limit}
    """
    params = []
    if args.player:
        params.append(f"%{args.player}%")

    cur.execute(query, params)
    return cur.fetchall()

# ── Fetch grades for players ──────────────────────────────────────────────────
def fetch_grades(cur, player_ids: list[int]) -> dict[int, list[tuple]]:
    """Fetch best grades per player. Returns {pid: [(attr, score), ...]} sorted desc."""
    if not player_ids:
        return {}
    cur.execute("""
        SELECT ag.player_id, ag.attribute,
               COALESCE(ag.scout_grade, ag.stat_score) AS score
        FROM attribute_grades ag
        WHERE ag.player_id = ANY(%s)
          AND COALESCE(ag.scout_grade, ag.stat_score) IS NOT NULL
        ORDER BY ag.player_id, COALESCE(ag.scout_grade, ag.stat_score) DESC
    """, (player_ids,))

    grades: dict[int, list[tuple]] = defaultdict(list)
    seen: dict[int, set] = defaultdict(set)
    for row in cur.fetchall():
        pid = row["player_id"]
        attr = row["attribute"]
        if attr not in seen[pid]:
            seen[pid].add(attr)
            grades[pid].append((attr, round(row["score"])))
    return dict(grades)

# ── Fetch traits ──────────────────────────────────────────────────────────────
def fetch_traits(cur, player_ids: list[int]) -> dict[int, list[str]]:
    """Fetch playing style traits per player."""
    if not player_ids:
        return {}
    cur.execute("""
        SELECT player_id, trait
        FROM player_trait_scores
        WHERE player_id = ANY(%s)
        ORDER BY player_id, severity DESC
    """, (player_ids,))

    traits: dict[int, list[str]] = defaultdict(list)
    for row in cur.fetchall():
        traits[row["player_id"]].append(row["trait"])
    return dict(traits)

# ── Fetch career trajectory ───────────────────────────────────────────────────
def fetch_trajectories(cur, player_ids: list[int]) -> dict[int, str]:
    """Fetch career trajectory label per player."""
    if not player_ids:
        return {}
    cur.execute("""
        SELECT player_id, trajectory
        FROM career_metrics
        WHERE player_id = ANY(%s)
    """, (player_ids,))
    return {row["player_id"]: row["trajectory"] for row in cur.fetchall()}

# ── Build dossier text ────────────────────────────────────────────────────────
def build_dossier(player: dict, grades: list[tuple], traits: list[str],
                  trajectory: str | None) -> str | None:
    """Build the text dossier for one player. Returns None if insufficient data."""
    lines = []

    # Identity (always present)
    name = player["name"]
    age = player["age"] or "?"
    pos = player["position"] or "?"
    club = player["club"] or "Unknown"
    nation = player["nation"] or "?"
    lines.append(f"Player: {name} ({age}, {pos}, {club}, {nation})")

    populated = 0  # count of non-identity lines

    # Archetype / Blueprint / Best Role
    archetype = player["earned_archetype"] or player["archetype"]
    blueprint = player["blueprint"]
    best_role = player["best_role"]
    if any([archetype, blueprint, best_role]):
        parts = []
        if archetype:
            parts.append(f"Archetype: {archetype}")
        if blueprint:
            parts.append(f"Blueprint: {blueprint}")
        if best_role:
            parts.append(f"Best Role: {best_role}")
        lines.append(" | ".join(parts))
        populated += 1

    # Pillar balance
    tech = pillar_tier(player["technical_score"])
    tac = pillar_tier(player["tactical_score"])
    men = pillar_tier(player["mental_score"])
    phy = pillar_tier(player["physical_score"])
    if any([tech, tac, men, phy]):
        parts = []
        if tech: parts.append(f"technical={tech}")
        if tac: parts.append(f"tactical={tac}")
        if men: parts.append(f"mental={men}")
        if phy: parts.append(f"physical={phy}")
        lines.append(f"Pillar Balance: {', '.join(parts)}")
        populated += 1

    # Personality
    descs = personality_descriptors(player["ei"], player["sn"], player["tf"], player["jp"])
    if descs:
        lines.append(f"Personality: {', '.join(descs)}")
        populated += 1

    # Grades
    if grades:
        top5 = [g[0] for g in grades[:5]]
        bottom3 = [g[0] for g in grades[-3:]] if len(grades) >= 5 else []
        lines.append(f"Strengths: {', '.join(top5)}")
        if bottom3:
            lines.append(f"Weaknesses: {', '.join(bottom3)}")
        populated += 1

    # Traits
    if traits:
        lines.append(f"Traits: {', '.join(traits[:6])}")
        populated += 1

    # Career / physical
    phys_parts = []
    if trajectory:
        phys_parts.append(f"Career: {trajectory}")
    side = player["side"]
    height = player["height_cm"]
    foot = player["preferred_foot"]
    if side: phys_parts.append(f"Side: {side}")
    if height: phys_parts.append(f"{height}cm")
    if foot: phys_parts.append(f"{foot} foot")
    if phys_parts:
        lines.append(" | ".join(phys_parts))
        populated += 1

    # Skip if insufficient context
    if populated < 3:
        return None

    return "\n".join(lines)

# ── System prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a football intelligence analyst writing scouting dossiers. Each note weaves three perspectives:

1. Scout: data-grounded assessment — strengths, weaknesses, archetype fit, pillar balance
2. Historian: tactical lineage — what tradition this player's role belongs to, what systems suit them
3. Director of Football: squad-building value — market position, what kind of club benefits most, risk factors

Rules:
- Write 3-5 sentences per player. Flowing prose, no bullet points, no headers.
- Be opinionated — name weaknesses, don't hedge.
- Use football language (half-spaces, progressive carries, inverted runs, etc).
- Never use clichés like "world-class talent" or "exciting prospect".
- Reference the player's archetype and best role naturally.
- ONLY use information provided in the dossier. Do NOT invent current-season context, match references, historical comparisons, or any facts not present in the input.
- Do not include raw numeric scores in the output. Speak in relative terms.
- Do not reference MBTI types or personality acronyms."""

# ── LLM batch call ────────────────────────────────────────────────────────────
def generate_notes(router: LLMRouter, dossiers: list[tuple[dict, str]]) -> list[dict] | None:
    """Call LLM with a batch of dossiers. Returns [{"name": ..., "notes": ...}] or None."""
    dossier_text = "\n\n---\n\n".join(d[1] for d in dossiers)
    prompt = f"""Write scouting notes for these players. Return JSON: [{{"name": "...", "notes": "..."}}]

---

{dossier_text}"""

    result = router.call(prompt, json_mode=True, system=SYSTEM_PROMPT, preference="quality")
    if not result or not result.parsed:
        return None
    parsed = result.parsed
    if isinstance(parsed, dict) and "players" in parsed:
        parsed = parsed["players"]
    if not isinstance(parsed, list):
        return None
    return parsed

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    conn = psycopg2.connect(POSTGRES_DSN, cursor_factory=psycopg2.extras.RealDictCursor)
    cur = conn.cursor()

    print("── Scouting Notes v2 ──────────────────────────────────")
    print(f"  Mode: {'flagged-only' if args.flagged_only else 'single player' if args.player else f'top {args.top}'}")
    print(f"  Force: {args.force}  Dry run: {args.dry_run}")

    # 1. Fetch players
    players = fetch_players(cur, args)
    print(f"  {len(players)} players in scope")
    if not players:
        print("  Nothing to do.")
        conn.close()
        return

    # 2. Batch-fetch supporting data
    pids = [p["id"] for p in players]
    grades_map = fetch_grades(cur, pids)
    traits_map = fetch_traits(cur, pids)
    trajectory_map = fetch_trajectories(cur, pids)
    print(f"  Grades: {len(grades_map)} | Traits: {len(traits_map)} | Trajectories: {len(trajectory_map)}")

    # 3. Build dossiers
    dossiers: list[tuple[dict, str]] = []
    skipped = 0
    for p in players:
        pid = p["id"]
        text = build_dossier(
            p,
            grades_map.get(pid, []),
            traits_map.get(pid, []),
            trajectory_map.get(pid),
        )
        if text is None:
            skipped += 1
            continue
        dossiers.append((p, text))

    print(f"  Dossiers built: {len(dossiers)} (skipped {skipped} — insufficient data)")

    # 4. Generate notes in batches
    router = LLMRouter(verbose=True)
    total_updated = 0
    total_errors = 0

    for i in range(0, len(dossiers), BATCH_SIZE):
        batch = dossiers[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(dossiers) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\n  [{batch_num}/{total_batches}] Generating {len(batch)} notes...")

        results = generate_notes(router, batch)
        if not results:
            print(f"    WARN: No results — retrying in 10s")
            time.sleep(10)
            router.reset_disabled()
            results = generate_notes(router, batch)

        if not results:
            print(f"    ERROR: Batch {batch_num} failed, skipping")
            total_errors += len(batch)
            continue

        # Match results to players by name
        result_map = {r.get("name", "").lower().strip(): r for r in results}
        for player, _dossier_text in batch:
            key = player["name"].lower().strip()
            match = result_map.get(key)
            if not match:
                # Try partial match
                for rname, r in result_map.items():
                    if key in rname or rname in key:
                        match = r
                        break

            notes = match.get("notes", "") if match else ""
            if not notes or len(notes) < 20:
                print(f"    SKIP {player['name']}: empty/short note")
                total_errors += 1
                continue

            if args.dry_run:
                print(f"    {player['name']:30} {notes[:80]}...")
                total_updated += 1
                continue

            # Upsert
            cur.execute("""
                INSERT INTO player_status (person_id, scouting_notes, notes_flagged)
                VALUES (%s, %s, false)
                ON CONFLICT (person_id) DO UPDATE
                SET scouting_notes = EXCLUDED.scouting_notes,
                    notes_flagged = false,
                    updated_at = now()
            """, (player["id"], notes))
            total_updated += 1

        if not args.dry_run:
            conn.commit()

        if i + BATCH_SIZE < len(dossiers):
            time.sleep(INTER_BATCH_DELAY)

    # 5. Summary
    router.print_stats()
    print(f"\n  Done: {total_updated} updated, {total_errors} errors")
    conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run with --dry-run to verify query works**

Run: `cd pipeline && python 90_scouting_notes.py --dry-run --top 3`
Expected: 3 players listed with generated note previews (or LLM output)

- [ ] **Step 3: Commit**

```bash
git add pipeline/90_scouting_notes.py
git commit -m "feat: pipeline 90 — multi-perspective scouting notes"
```

---

### Task 3: Test the pipeline with a small batch

**Files:**
- Modify: `pipeline/90_scouting_notes.py` (if fixes needed)

- [ ] **Step 1: Run single player dry-run**

Run: `cd pipeline && python 90_scouting_notes.py --dry-run --player "Vitinha"`
Expected: One dossier built, note generated, preview printed. Verify note is 3-5 sentences, opinionated, no MBTI, no raw scores.

- [ ] **Step 2: Run top 5 dry-run**

Run: `cd pipeline && python 90_scouting_notes.py --dry-run --top 5`
Expected: 5 players, notes previewed. Check quality bar matches spec example.

- [ ] **Step 3: Run top 5 for real (writes to DB)**

Run: `cd pipeline && python 90_scouting_notes.py --top 5`
Expected: 5 players updated. Verify with:
```bash
psql "$POSTGRES_DSN" -c "SELECT pe.name, ps.scouting_notes FROM player_status ps JOIN people pe ON pe.id = ps.person_id WHERE ps.updated_at > now() - interval '5 minutes' ORDER BY ps.updated_at DESC LIMIT 5"
```

- [ ] **Step 4: Fix any issues found, commit**

```bash
git add pipeline/90_scouting_notes.py
git commit -m "fix: pipeline 90 quality tuning after test run"
```

---

### Task 4: UI — Flag button on player detail page

**Files:**
- Modify: `apps/web/src/app/players/[id]/page.tsx` (around line 408-410)
- Modify: `apps/web/src/components/ScoutingNotes.tsx`

- [ ] **Step 1: Add `notes_flagged` to the player query**

In `apps/web/src/app/players/[id]/page.tsx`, find the main player query SELECT and add `notes_flagged` to the fields fetched from `player_status` (or from the `players` view / `player_intelligence_card` if that's what's used). This may require checking which view/table the page queries.

- [ ] **Step 2: Update ScoutingNotes component to accept flag props**

Modify `apps/web/src/components/ScoutingNotes.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface ScoutingNotesProps {
  text: string;
  clamp?: number;
  className?: string;
  flagged?: boolean;
  onToggleFlag?: () => void;
  showFlagButton?: boolean;
}

export function ScoutingNotes({
  text,
  clamp = 2,
  className = "",
  flagged = false,
  onToggleFlag,
  showFlagButton = false,
}: ScoutingNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  const borderColor = flagged
    ? "var(--color-accent-tactical)"
    : "var(--color-accent-personality)";

  return (
    <div className={`mt-1 ${className}`}>
      <div className="flex items-start gap-1">
        <p
          ref={ref}
          onClick={() => isClamped && setExpanded(!expanded)}
          className={`flex-1 text-[10px] sm:text-xs text-[var(--text-secondary)] leading-snug border-l-2 pl-2 ${
            !expanded ? `line-clamp-${clamp}` : ""
          } ${isClamped ? "cursor-pointer" : ""}`}
          style={{
            borderColor,
            ...(!expanded
              ? {
                  WebkitLineClamp: clamp,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }
              : undefined),
          }}
        >
          {text}
        </p>
        {showFlagButton && onToggleFlag && (
          <button
            onClick={onToggleFlag}
            title={flagged ? "Flagged for rewrite" : "Flag for rewrite"}
            className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill={flagged ? "var(--color-accent-tactical)" : "none"}
              stroke={flagged ? "var(--color-accent-tactical)" : "var(--text-muted)"}
              strokeWidth={1.5}
              className="w-3.5 h-3.5"
            >
              <path d="M3 3v15M3 3h11l-2 4 2 4H3" />
            </svg>
          </button>
        )}
      </div>
      {isClamped && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] mt-0.5 pl-2"
        >
          Show more
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire up flag toggle on player detail page**

In `apps/web/src/app/players/[id]/page.tsx`, around line 408-410 where ScoutingNotes is rendered, add the flag toggle:

```tsx
{player.scouting_notes && (
  <ScoutingNotes
    text={player.scouting_notes}
    clamp={2}
    flagged={player.notes_flagged}
    showFlagButton={isAdmin}
    onToggleFlag={async () => {
      const newVal = !player.notes_flagged;
      await fetch("/api/admin/player-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: player.id,
          table: "player_status",
          updates: { notes_flagged: newVal },
        }),
      });
      // Refresh page data (use router.refresh() or local state update)
      router.refresh();
    }}
  />
)}
```

Note: Check how `isAdmin` is determined on this page (likely `sessionStorage.getItem("network_admin") === "1"` — may need a client-side state). Also check if `router` from `next/navigation` is available.

- [ ] **Step 4: Verify the build passes**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ScoutingNotes.tsx apps/web/src/app/players/\[id\]/page.tsx
git commit -m "feat: flag-for-rewrite button on scouting notes (admin-only)"
```

---

### Task 5: Run the full pipeline for top 500

**Files:**
- No new files — this is a pipeline execution task

- [ ] **Step 1: Run --flagged-only first (if any exist)**

Run: `cd pipeline && python 90_scouting_notes.py --flagged-only --dry-run`
Expected: 0 players (no flags set yet). Confirms the flag query works.

- [ ] **Step 2: Run top 500**

Run: `cd pipeline && python 90_scouting_notes.py --top 500`
Expected: ~450-500 notes generated (some may be skipped for insufficient data). LLM router stats printed. Takes ~5-10 minutes depending on provider speeds.

- [ ] **Step 3: Spot-check quality**

Run:
```bash
psql "$POSTGRES_DSN" -c "
SELECT pe.name, pp.best_role_score, ps.scouting_notes
FROM player_status ps
JOIN people pe ON pe.id = ps.person_id
JOIN player_profiles pp ON pp.person_id = pe.id
WHERE ps.updated_at > now() - interval '30 minutes'
ORDER BY pp.best_role_score DESC
LIMIT 10
"
```
Expected: 10 notes visible. Check for: 3-5 sentences, no MBTI, no raw numbers, opinionated tone, football language.

- [ ] **Step 4: Test --force flag (re-generate one player)**

Run: `cd pipeline && python 90_scouting_notes.py --player "Vitinha" --force`
Expected: Overwrites existing note. Verify new note is different from first run.

---

### Task 6: Final commit and cleanup

- [ ] **Step 1: Final commit if any fixes were made**

```bash
git add -A pipeline/90_scouting_notes.py apps/web/
git commit -m "feat: scouting notes v2 — 500 multi-perspective notes generated"
```
