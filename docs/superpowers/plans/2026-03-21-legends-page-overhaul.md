# Legends Page Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the legends table to show editable Primary/Secondary skillsets, auto-derived model label, and a similar active player column — removing Last Club and Score.

**Architecture:** The legends page (`apps/web/src/app/legends/page.tsx`) gets new columns backed by the existing `player-update` API for saves and the existing `/api/players/[id]/similar` endpoint for comparisons. A new `MODEL_LABELS` map is ported from Python to TypeScript for client-side model derivation. Primary/Secondary are edited via `<select>` dropdowns (admin-only), and the model label updates reactively. Similar player is lazy-loaded per row on mount.

**Tech Stack:** Next.js (React), Supabase (via `player_intelligence_card` view), existing `EditableCell` pattern for saves, existing similar-players API.

---

### Task 1: Port MODEL_LABELS to TypeScript

**Files:**
- Modify: `apps/web/src/lib/models.ts`
- Reference: `pipeline/lib/models.py:54-221`

- [ ] **Step 1: Add MODEL_LABELS map to models.ts**

Add the full compound model label map after the existing `MODEL_LABEL` export. This maps `"Primary-Secondary"` → human-readable label (e.g., `"Controller-Passer"` → `"Regista"`).

```typescript
/** Compound model labels — maps "Primary-Secondary" to human-readable name.
 *  Mirrors MODEL_LABELS in pipeline/lib/models.py — keep in sync. */
export const MODEL_LABELS: Record<string, string> = {
  // Single models
  Controller: "Controller", Commander: "Commander", Creator: "Creator",
  Target: "Target", Sprinter: "Sprinter", Powerhouse: "Powerhouse",
  Cover: "Cover", Engine: "Engine", Destroyer: "Destroyer",
  Dribbler: "Dribbler", Passer: "Passer", Striker: "Striker", GK: "Goalkeeper",
  // Controller primary
  "Controller-Cover": "Sentinel", "Controller-Creator": "Playmaker",
  "Controller-Destroyer": "Holder", "Controller-Dribbler": "Ball Magnet",
  "Controller-Engine": "Conductor", "Controller-Passer": "Regista",
  "Controller-Powerhouse": "Anchor", "Controller-Sprinter": "Glider",
  "Controller-Striker": "Clinical", "Controller-Target": "Composed CB",
  // Commander primary
  "Commander-Cover": "Captain", "Commander-Creator": "Talisman",
  "Commander-Destroyer": "Heart", "Commander-Dribbler": "Captain Marvel",
  "Commander-Engine": "General", "Commander-Passer": "Director",
  "Commander-Powerhouse": "Boss", "Commander-Sprinter": "Driving Force",
  "Commander-Striker": "Figurehead", "Commander-Target": "Air King",
  // Creator primary
  "Creator-Cover": "Quarterback CB", "Creator-Destroyer": "Regista",
  "Creator-Dribbler": "Magician", "Creator-Engine": "Catalyst",
  "Creator-Passer": "Maestro", "Creator-Powerhouse": "Power Playmaker",
  "Creator-Sprinter": "Counter King", "Creator-Striker": "Fantasista",
  "Creator-Target": "Target Playmaker",
  // Cover primary
  "Cover-Commander": "Anchor", "Cover-Controller": "Roll-Royce",
  "Cover-Creator": "Quarterback CB", "Cover-Destroyer": "Cornerback",
  "Cover-Dribbler": "Advancing CB", "Cover-Engine": "Mobile CB",
  "Cover-Passer": "Provider", "Cover-Powerhouse": "Stalwart",
  "Cover-Sprinter": "Recovery Ace", "Cover-Striker": "Libero Scorer",
  "Cover-Target": "Towering CB",
  // Engine primary
  "Engine-Commander": "Driver", "Engine-Controller": "Box-To-Box",
  "Engine-Cover": "Dynamo", "Engine-Creator": "Heartbeat",
  "Engine-Destroyer": "Machine", "Engine-Dribbler": "Tornate",
  "Engine-Passer": "Metronome", "Engine-Powerhouse": "Bison",
  "Engine-Sprinter": "Shuttler", "Engine-Striker": "Livewire",
  "Engine-Target": "Athlete",
  // Destroyer primary
  "Destroyer-Commander": "Leader", "Destroyer-Controller": "Lynchpin",
  "Destroyer-Cover": "Shield", "Destroyer-Creator": "Disruptor",
  "Destroyer-Dribbler": "Surge", "Destroyer-Engine": "Train",
  "Destroyer-Passer": "Recycler", "Destroyer-Powerhouse": "Rock",
  "Destroyer-Sprinter": "Shadow", "Destroyer-Striker": "Predator",
  "Destroyer-Target": "Centre Back",
  // Dribbler primary
  "Dribbler-Commander": "Captain Marvel", "Dribbler-Controller": "Ball Magnet",
  "Dribbler-Cover": "Modern Defender", "Dribbler-Creator": "Wizard",
  "Dribbler-Destroyer": "Chaos Creator", "Dribbler-Engine": "Solo Counter",
  "Dribbler-Powerhouse": "Tank", "Dribbler-Sprinter": "Flash",
  "Dribbler-Striker": "Spark", "Dribbler-Target": "Acrobat",
  // Passer primary
  "Passer-Commander": "General", "Passer-Controller": "Conductor",
  "Passer-Cover": "Provider", "Passer-Creator": "Silk",
  "Passer-Destroyer": "Recycler", "Passer-Engine": "Shuttle",
  "Passer-Powerhouse": "Midfield Rock", "Passer-Sprinter": "Transition King",
  "Passer-Target": "Quarterback",
  // Striker primary
  "Striker-Commander": "Talisman", "Striker-Controller": "Ice Man",
  "Striker-Cover": "Poacher", "Striker-Creator": "Assassin",
  "Striker-Destroyer": "Pressing Forward", "Striker-Engine": "Workhorse",
  "Striker-Powerhouse": "Rifle", "Striker-Sprinter": "Rocket",
  "Striker-Target": "Hitman",
  // Target primary
  "Target-Commander": "Air King", "Target-Controller": "Composed CB",
  "Target-Creator": "Target Playmaker", "Target-Destroyer": "Titan",
  "Target-Dribbler": "Acrobat", "Target-Engine": "Boxcrasher",
  "Target-Passer": "Quarterback", "Target-Powerhouse": "Colossus",
  "Target-Sprinter": "Leaper", "Target-Striker": "Tower",
  // Sprinter primary
  "Sprinter-Commander": "Driving Force", "Sprinter-Controller": "Glider",
  "Sprinter-Cover": "Flanker", "Sprinter-Creator": "Breakaway",
  "Sprinter-Destroyer": "Shadow", "Sprinter-Dribbler": "Flash",
  "Sprinter-Engine": "Shuttler", "Sprinter-Powerhouse": "Juggernaut",
  "Sprinter-Striker": "Ghost", "Sprinter-Target": "Leaper",
  // Powerhouse primary
  "Powerhouse-Commander": "Boss", "Powerhouse-Controller": "Anchor",
  "Powerhouse-Cover": "Dominator", "Powerhouse-Creator": "Power Playmaker",
  "Powerhouse-Destroyer": "Enforcer", "Powerhouse-Dribbler": "Tank",
  "Powerhouse-Engine": "Horse", "Powerhouse-Passer": "Midfield Rock",
  "Powerhouse-Sprinter": "Athlete", "Powerhouse-Striker": "Spearhead",
  "Powerhouse-Target": "Colossus",
  // GK compounds
  "GK-Controller": "Modern Keeper", "GK-Commander": "Commander",
  "GK-Cover": "Traditional Keeper", "GK-Passer": "Sweeper Keeper",
  "GK-Sprinter": "Sweeper Keeper",
};

/** Derive model label from an archetype string (e.g. "Controller-Passer" → "Regista") */
export function getModelLabel(archetype: string | null): string | null {
  if (!archetype) return null;
  return MODEL_LABELS[archetype] ?? archetype;
}
```

- [ ] **Step 2: Verify no import conflicts**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to models.ts

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/models.ts
git commit -m "feat: port MODEL_LABELS compound map to TypeScript"
```

---

### Task 2: Update Legends API to return archetype as separate primary/secondary

The `archetype` field is stored as `"Primary-Secondary"` in `player_intelligence_card`. The API already returns it. No API change needed — the page will split it client-side. But we do need the API to NOT select `club` anymore (removing Last Club column) and we should verify the fields are sufficient.

**Files:**
- Modify: `apps/web/src/app/api/legends/route.ts:32`

- [ ] **Step 1: Remove `club` from select, keep all other fields**

In `route.ts` line 32, change the select string:

```typescript
// Before:
.select("person_id, name, dob, nation, club, position, level, peak, overall, archetype, personality_type, best_role, best_role_score, fingerprint")

// After:
.select("person_id, name, dob, nation, position, level, peak, overall, archetype, personality_type, best_role, best_role_score, fingerprint")
```

- [ ] **Step 2: Verify API still works**

Run: `curl -s 'http://localhost:3000/api/legends?limit=3' | python3 -m json.tool | head -20`
Expected: JSON with players array, no `club` field

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/legends/route.ts
git commit -m "feat(legends): remove club from API response"
```

---

### Task 3: Rewrite Legends page with new columns

Replace the existing table with the new column layout. The archetype field (`"Primary-Secondary"`) is split client-side. Model label is derived via `getModelLabel()`. Primary/Secondary are edited via inline `<select>` dropdowns (admin-only) inside an `ArchetypeEditor` component that composes the compound string before saving. Score column removed. Last Club removed. Similar active player is loaded lazily (Task 4).

**Files:**
- Modify: `apps/web/src/app/legends/page.tsx`

- [ ] **Step 1: Update Legend interface and imports**

At the top of the file, update:

```typescript
// Update React import to include useRef (needed by SimilarActivePlayer in Task 4)
import { useEffect, useState, useCallback, useRef } from "react";

// Add imports
import { getModelLabel, MODEL_ATTRIBUTES } from "@/lib/models";

// Replace Legend interface (lines 51-65)
interface Legend {
  person_id: number;
  name: string;
  dob: string | null;
  nation: string | null;
  position: string | null;
  level: number | null;
  overall: number | null;
  peak: number | null;
  archetype: string | null;   // "Primary-Secondary" compound
  personality_type: string | null;
  best_role: string | null;
  best_role_score: number | null;
}
```

- [ ] **Step 2: Add model list constant and helper functions**

After the `POSITIONS` array (line 49), add:

```typescript
const PLAYING_MODELS = Object.keys(MODEL_ATTRIBUTES); // 13 models

function splitArchetype(archetype: string | null): { primary: string | null; secondary: string | null } {
  if (!archetype) return { primary: null, secondary: null };
  const parts = archetype.split("-");
  return { primary: parts[0] || null, secondary: parts[1] || null };
}
```

- [ ] **Step 3: Add updateLocalArchetype helper inside LegendsContent**

After the existing `updateLocal` function (line 90-94), add:

```typescript
function updateLocalArchetype(personId: number, part: "primary" | "secondary", value: string | null) {
  setPlayers((prev) =>
    prev.map((p) => {
      if (p.person_id !== personId) return p;
      const { primary, secondary } = splitArchetype(p.archetype);
      const newPrimary = part === "primary" ? value : primary;
      const newSecondary = part === "secondary" ? value : secondary;
      const newArchetype = newPrimary
        ? newSecondary ? `${newPrimary}-${newSecondary}` : newPrimary
        : null;
      return { ...p, archetype: newArchetype };
    })
  );
}
```

Note: The `EditableSelect` saves the full `archetype` field to `player_profiles`. We need to construct the compound string before saving. This means we can't use `EditableSelect` directly for primary/secondary — we need a wrapper that computes the compound and saves it. See Step 4.

- [ ] **Step 4: Create ArchetypeEditor inline component**

Inside `LegendsContent`, before the return, add:

```typescript
function ArchetypeEditor({ player }: { player: Legend }) {
  const { primary, secondary } = splitArchetype(player.archetype);

  function savePart(part: "primary" | "secondary", value: string | null) {
    const newPrimary = part === "primary" ? value : primary;
    const newSecondary = part === "secondary" ? value : secondary;
    const compound = newPrimary
      ? newSecondary ? `${newPrimary}-${newSecondary}` : newPrimary
      : null;
    updateLocalArchetype(player.person_id, part, value);
    // Save the compound archetype string
    fetch("/api/admin/player-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_id: player.person_id,
        table: "player_profiles",
        updates: { archetype: compound },
      }),
    });
  }

  // Filter: secondary options exclude the selected primary
  const secondaryOptions = PLAYING_MODELS.filter((m) => m !== primary);

  return (
    <div className="flex items-center gap-1">
      <EditableSelect
        value={primary}
        options={PLAYING_MODELS}
        personId={player.person_id}
        field="archetype"
        table="player_profiles"
        onSaved={(val) => savePart("primary", val)}
        placeholder="Pri"
      />
      <span className="text-[var(--text-muted)] text-[9px]">–</span>
      <EditableSelect
        value={secondary}
        options={secondaryOptions}
        personId={player.person_id}
        field="archetype"
        table="player_profiles"
        onSaved={(val) => savePart("secondary", val)}
        placeholder="Sec"
      />
    </div>
  );
}
```

Wait — there's a conflict. The `ArchetypeEditor` handles its own save logic because it needs to compose the compound before saving, which means the `EditableSelect`'s built-in save would fire with the wrong value. We need `EditableSelect` to support a "controlled save" mode where it calls `onSaved` but doesn't save to the API itself.

**Revised approach:** Don't use `EditableSelect` for this. Instead, use plain `<select>` elements inside `ArchetypeEditor` with manual save logic. This keeps `EditableSelect` simple for direct field saves.

```typescript
function ArchetypeEditor({ player }: { player: Legend }) {
  const { primary, secondary } = splitArchetype(player.archetype);
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);

  async function savePart(part: "primary" | "secondary", value: string | null) {
    const newPrimary = part === "primary" ? value : primary;
    const newSecondary = part === "secondary" ? value : secondary;
    const compound = newPrimary
      ? newSecondary ? `${newPrimary}-${newSecondary}` : newPrimary
      : null;
    updateLocalArchetype(player.person_id, part, value);
    try {
      const res = await fetch("/api/admin/player-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: player.person_id,
          table: "player_profiles",
          updates: { archetype: compound },
        }),
      });
      setFlash(res.ok ? "saved" : "error");
    } catch {
      setFlash("error");
    }
    setTimeout(() => setFlash(null), 600);
  }

  const secondaryOptions = PLAYING_MODELS.filter((m) => m !== (primary ?? ""));
  const borderColor = flash === "saved" ? "border-[var(--color-accent-tactical)]"
    : flash === "error" ? "border-red-400" : "border-transparent";
  const selectClass = `bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[10px] rounded px-1 py-0.5 border ${borderColor} focus:outline-none focus:border-[var(--color-accent-tactical)]/50 cursor-pointer`;

  return (
    <div className="flex items-center gap-0.5">
      <select value={primary ?? ""} onChange={(e) => savePart("primary", e.target.value || null)} className={selectClass}>
        <option value="">Pri</option>
        {PLAYING_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <span className="text-[var(--text-muted)] text-[8px]">–</span>
      <select value={secondary ?? ""} onChange={(e) => savePart("secondary", e.target.value || null)} className={selectClass}>
        <option value="">Sec</option>
        {secondaryOptions.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite desktop table header row**

Replace lines 207-217 (the `<thead>` row) with:

```html
<tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
  <th className="text-center py-1.5 px-2 font-medium w-10">Pos</th>
  <th className="text-left py-1.5 px-3 font-medium">Player</th>
  <th className="text-left py-1.5 px-3 font-medium hidden lg:table-cell"></th>
  <th className="text-left py-1.5 px-2 font-medium">Primary</th>
  <th className="text-left py-1.5 px-2 font-medium">Secondary</th>
  <th className="text-left py-1.5 px-2 font-medium hidden lg:table-cell">Model</th>
  <th className="text-left py-1.5 px-3 font-medium hidden xl:table-cell">Best Role</th>
  <th className="text-left py-1.5 px-3 font-medium hidden xl:table-cell">Personality</th>
  <th className="text-right py-1.5 px-3 font-medium w-14">Peak</th>
  <th className="text-left py-1.5 px-3 font-medium">Similar</th>
</tr>
```

- [ ] **Step 6: Rewrite desktop table body row**

Replace the `<tr>` body (lines 224-261) with new columns. Key changes:
- Remove Last Club (`club`) column
- Remove Score (`best_role_score`) column
- Add Primary/Secondary (editable for admin, read-only otherwise)
- Add Model label (read-only, auto-derived)
- Add Similar player placeholder (Task 4 wires this up)

```tsx
{players.map((player, idx) => {
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const pName = getPersonalityName(player.personality_type);
  const { primary, secondary } = splitArchetype(player.archetype);
  const modelLabel = getModelLabel(player.archetype);

  return (
    <tr key={player.person_id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/30 transition-colors">
      <td className="py-1.5 px-2 text-center">
        <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${posColor} text-white`}>
          {player.position ?? "–"}
        </span>
      </td>
      <td className="py-1.5 px-3">
        <Link href={`/players/${player.person_id}`}
          className="text-[var(--text-primary)] hover:text-white transition-colors font-medium text-xs">
          {player.name}
        </Link>
      </td>
      <td className="py-1.5 px-3 text-xs hidden lg:table-cell" title={player.nation || ""}>{player.nation ? nationFlag(player.nation) : "–"}</td>
      <td className="py-1.5 px-2 text-[10px]">
        {isAdmin ? (
          <ArchetypeEditor player={player} />
        ) : (
          <span className="text-[var(--text-secondary)]">{primary ?? "–"}</span>
        )}
      </td>
      <td className="py-1.5 px-2 text-[10px] text-[var(--text-secondary)]">
        {isAdmin ? null : (secondary ?? "–")}
      </td>
      <td className="py-1.5 px-2 text-[10px] hidden lg:table-cell">
        {modelLabel ? (
          <span style={{ color: getArchetypeColor(modelLabel) }} className="font-medium">{modelLabel}</span>
        ) : <span className="text-[var(--text-muted)]">–</span>}
      </td>
      <td className="py-1.5 px-3 text-xs text-[var(--text-secondary)] hidden xl:table-cell">{player.best_role || "–"}</td>
      <td className="py-1.5 px-3 text-xs text-purple-400 hidden xl:table-cell">
        {pName || "–"}
      </td>
      <td className="py-1.5 px-3 text-right">
        {isAdmin ? (
          <EditableCell value={player.peak} personId={player.person_id} field="peak" table="player_profiles" rowIndex={idx} onSaved={(v) => updateLocal(player.person_id, "peak", v)} />
        ) : (
          <span className={`font-mono font-bold text-sm ${peakColor(player.peak)}`}>{player.peak ?? "–"}</span>
        )}
      </td>
      <td className="py-1.5 px-3 text-xs">
        <SimilarActivePlayer personId={player.person_id} />
      </td>
    </tr>
  );
})}
```

Note: When admin, the `ArchetypeEditor` spans across both Primary and Secondary columns using its own layout. For non-admin, Primary and Secondary are separate read-only cells.

**Revised column layout for admin:** The `ArchetypeEditor` renders inside the Primary `<td>` and the Secondary `<td>` is empty (the editor already shows both dropdowns). For non-admin, both cells show text.

- [ ] **Step 7: Update mobile card layout**

Replace the mobile card section (lines 270-314) with a simplified layout:
- Remove Last Club line
- Remove Score badge
- Show Primary-Secondary as text
- Show Model label
- Keep Peak editable
- Add similar player line

```tsx
<div className="sm:hidden flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]/30">
  {players.map((player, idx) => {
    const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
    const modelLabel = getModelLabel(player.archetype);
    return (
      <div key={player.person_id} className="px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[10px] font-bold px-2 py-1 rounded ${posColor} text-white shrink-0`}>
              {player.position ?? "–"}
            </span>
            <Link href={`/players/${player.person_id}`} className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {player.name}
                {player.nation && <span className="text-[11px] ml-1">{nationFlag(player.nation)}</span>}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">
                {modelLabel ? <span style={{ color: getArchetypeColor(modelLabel) }}>{modelLabel}</span> : player.archetype || "–"}
                {" · "}{player.best_role || "–"}
              </p>
            </Link>
          </div>
          <div className="text-center px-1.5 py-0.5 rounded bg-[var(--bg-elevated)]">
            <span className="text-[7px] text-[var(--text-muted)] block leading-none mb-0.5">Peak</span>
            {isAdmin ? (
              <EditableCell value={player.peak} personId={player.person_id} field="peak" table="player_profiles" rowIndex={idx} onSaved={(v) => updateLocal(player.person_id, "peak", v)} />
            ) : (
              <span className={`font-mono text-xs font-bold ${peakColor(player.peak)}`}>{player.peak ?? "–"}</span>
            )}
          </div>
        </div>
        <div className="mt-1 pl-9">
          <SimilarActivePlayer personId={player.person_id} />
        </div>
      </div>
    );
  })}
</div>
```

- [ ] **Step 8: Remove `club` from Legend interface**

The `club` field is no longer needed in the interface since we removed the column and updated the API:

```typescript
interface Legend {
  person_id: number;
  name: string;
  dob: string | null;
  nation: string | null;
  position: string | null;
  level: number | null;
  overall: number | null;
  peak: number | null;
  archetype: string | null;
  personality_type: string | null;
  best_role: string | null;
  best_role_score: number | null;
}
```

(Note: `best_role_score` stays in interface since it comes from API even if we don't display it as a column.)

- [ ] **Step 9: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -10`
Expected: Build succeeds (SimilarActivePlayer will be a placeholder until Task 4)

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/legends/page.tsx
git commit -m "feat(legends): editable Primary/Secondary, model label, remove club/score columns"
```

---

### Task 4: Add SimilarActivePlayer component with lazy loading

Each legends row lazily fetches the top similar active player using the existing `/api/players/[id]/similar` endpoint. Shows as a compact inline name + similarity score.

**Files:**
- Add component inside: `apps/web/src/app/legends/page.tsx` (collocated, not a shared component — only used here)

- [ ] **Step 1: Add SimilarActivePlayer component**

Inside `LegendsContent` (before the `ArchetypeEditor` component), add:

```typescript
function SimilarActivePlayer({ personId }: { personId: number }) {
  const [similar, setSimilar] = useState<{ name: string; person_id: number; similarity: number; club: string | null } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loaded) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    fetch(`/api/players/${personId}/similar`)
      .then((r) => r.json())
      .then((data) => {
        const top = data.players?.[0];
        if (top) setSimilar({ name: top.name, person_id: top.person_id, similarity: top.similarity, club: top.club });
      })
      .catch(() => {});
  }, [loaded, personId]);

  return (
    <div ref={ref} className="min-w-[100px]">
      {!loaded || !similar ? (
        <span className="text-[var(--text-muted)] text-[10px]">–</span>
      ) : (
        <Link href={`/players/${similar.person_id}`} className="group flex items-center gap-1">
          <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-white transition-colors truncate max-w-[120px]">
            {similar.name}
          </span>
          <span className="text-[8px] text-[var(--text-muted)] font-mono">{Math.round(similar.similarity / 1.3)}%</span>
        </Link>
      )}
    </div>
  );
}
```

This uses `IntersectionObserver` to lazy-load — only fetches the similar player when the row scrolls into view. Prevents 50+ API calls on page load.

- [ ] **Step 2: Verify the full page works**

Run: `cd apps/web && npm run dev` (manual check in browser at `/legends`)
Expected:
- Legends table shows Pos, Player, Nation, Primary, Secondary, Model, Best Role, Personality, Peak, Similar
- Admin mode: Primary/Secondary are dropdowns, Peak is editable
- Model auto-updates when Primary/Secondary change
- Similar column lazy-loads active player names as you scroll
- Mobile cards show model label + similar player

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/legends/page.tsx
git commit -m "feat(legends): add SimilarActivePlayer with lazy IntersectionObserver loading"
```

---

### Task 6: Final verification and combined commit

- [ ] **Step 1: Run type check**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors

- [ ] **Step 2: Run existing tests**

Run: `cd apps/web && npx vitest run 2>&1 | tail -20`
Expected: All existing tests pass

- [ ] **Step 3: Manual browser test**

Verify at `http://localhost:3000/legends`:
1. Non-admin: Primary, Secondary, Model columns show read-only text
2. Admin (set `sessionStorage.setItem("network_admin", "1")`): Primary/Secondary become dropdowns
3. Changing Primary updates Model label instantly
4. Changing Secondary updates Model label instantly
5. Similar column shows active player names (lazy loaded on scroll)
6. Mobile cards show model label + similar player
7. Last Club column is gone
8. Score column is gone
9. Peak still editable for admin
