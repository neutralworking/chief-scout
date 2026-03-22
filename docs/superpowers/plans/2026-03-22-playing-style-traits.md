# Playing Style Traits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editorial playing style trait tags to legends — seeded via pipeline, editable in admin UI, displayed as colored pills on the legends page.

**Architecture:** 12 new editorial traits added to existing `TRAIT_DEFINITIONS` registry and `player_trait_scores` table. Pipeline 04d seeds ~50 top legends. Legends API batch-fetches traits with source deduplication. Page renders trait pills with admin add/remove controls.

**Tech Stack:** Next.js, Supabase (`player_trait_scores`), Python pipeline (psycopg2), existing `TRAIT_DEFINITIONS` registry.

**Spec:** `docs/superpowers/specs/2026-03-22-playing-style-traits-design.md`

---

### Task 1: Add editorial traits to TRAIT_DEFINITIONS

**Files:**
- Modify: `apps/web/src/lib/assessment/trait-role-impact.ts:21-48`
- Modify: `docs/systems/SACROSANCT.md` (trait taxonomy section)

- [ ] **Step 1: Add 12 new editorial traits to TRAIT_DEFINITIONS array**

After the existing `quiet_leader` entry (line 47), add:

```typescript
  // Editorial — playing style descriptors (not stat-derived)
  { name: "dribble_artist", category: "style", description: "Beating players is the identity, not just a stat" },
  { name: "playmaker_vision", category: "style", description: "Sees passes nobody else does" },
  { name: "through_ball_king", category: "style", description: "Threading the needle is the signature" },
  { name: "one_touch_play", category: "style", description: "First-time combinations, wall passes" },
  { name: "tempo_controller", category: "style", description: "Dictates match speed, slows and accelerates at will" },
  { name: "long_range_threat", category: "tactical", description: "Scores and shoots from distance" },
  { name: "fox_in_the_box", category: "tactical", description: "Poacher instinct, lives in the 6-yard area" },
  { name: "sweeper_reader", category: "tactical", description: "Reads danger before it happens, intercepts everything" },
  { name: "brick_wall", category: "tactical", description: "Unbeatable 1v1 defender" },
  { name: "hard_man", category: "tactical", description: "Physical intimidation, tackles define reputation" },
  { name: "captain_leader", category: "tactical", description: "On-pitch authority beyond the armband" },
  { name: "target_man", category: "physical", description: "Aerial focal point, hold-up play" },
  { name: "pace_merchant", category: "physical", description: "Raw speed defines the game" },
```

No role impact entries needed — these are editorial-only traits for legends.

- [ ] **Step 2: Verify type check**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -5`
Expected: Clean (no output)

- [ ] **Step 3: Update SACROSANCT trait taxonomy**

In `docs/systems/SACROSANCT.md`, find the trait taxonomy section and add the editorial traits under a new `### Editorial Traits (scout-assigned)` heading, listing all 12 new + the 4 reused (`set_piece_specialist`, `big_game_player`, `clutch`, plus existing ones that apply).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/assessment/trait-role-impact.ts docs/systems/SACROSANCT.md
git commit -m "feat: add 12 editorial playing style traits to TRAIT_DEFINITIONS"
```

---

### Task 2: Create trait-update API endpoint

**Files:**
- Create: `apps/web/src/app/api/admin/trait-update/route.ts`
- Reference: `apps/web/src/app/api/admin/player-update/route.ts` (pattern to follow)

- [ ] **Step 1: Create the endpoint**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

const ALLOWED_TRAITS = [
  "set_piece_specialist", "dribble_artist", "playmaker_vision", "through_ball_king",
  "one_touch_play", "tempo_controller", "long_range_threat", "fox_in_the_box",
  "sweeper_reader", "brick_wall", "hard_man", "captain_leader",
  "target_man", "pace_merchant", "big_game_player", "clutch",
];

const TRAIT_CATEGORY: Record<string, string> = {
  set_piece_specialist: "tactical", dribble_artist: "style", playmaker_vision: "style",
  through_ball_king: "style", one_touch_play: "style", tempo_controller: "style",
  long_range_threat: "tactical", fox_in_the_box: "tactical", sweeper_reader: "tactical",
  brick_wall: "tactical", hard_man: "tactical", captain_leader: "tactical",
  target_man: "physical", pace_merchant: "physical",
  big_game_player: "behavioral", clutch: "behavioral",
};

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const body = await request.json();
  const { person_id, trait, action, severity } = body as {
    person_id: number;
    trait: string;
    action: "add" | "remove";
    severity?: number;
  };

  if (!person_id || !trait || !action) {
    return NextResponse.json({ error: "Missing person_id, trait, or action" }, { status: 400 });
  }

  if (!ALLOWED_TRAITS.includes(trait)) {
    return NextResponse.json({ error: `Trait "${trait}" not allowed` }, { status: 400 });
  }

  if (action === "add") {
    const category = TRAIT_CATEGORY[trait] ?? "style";
    const sev = severity ?? 7;
    const { error } = await sb
      .from("player_trait_scores")
      .upsert(
        { player_id: person_id, trait, category, severity: sev, source: "editor" },
        { onConflict: "player_id,trait,source" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, person_id, trait, action: "added" });
  }

  if (action === "remove") {
    const { error } = await sb
      .from("player_trait_scores")
      .delete()
      .eq("player_id", person_id)
      .eq("trait", trait)
      .eq("source", "editor");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, person_id, trait, action: "removed" });
  }

  return NextResponse.json({ error: "action must be add or remove" }, { status: 400 });
}
```

- [ ] **Step 2: Verify type check**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -5`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/admin/trait-update/route.ts
git commit -m "feat: add trait-update API endpoint for editorial trait editing"
```

---

### Task 3: Extend legends API to return traits

**Files:**
- Modify: `apps/web/src/app/api/legends/route.ts`

- [ ] **Step 1: Add trait batch-fetch after main query**

After line 54 (`const { data, error } = await query;`) and the error check, add trait fetching before the response:

```typescript
  // Batch-fetch traits for returned legends
  const playerIds = (data ?? []).map((p: { person_id: number }) => p.person_id);
  const traitMap: Record<number, { trait: string; category: string; severity: number }[]> = {};

  if (playerIds.length > 0) {
    const { data: traitData } = await supabase
      .from("player_trait_scores")
      .select("player_id, trait, category, severity, source")
      .in("player_id", playerIds);

    for (const t of traitData ?? []) {
      const arr = (traitMap[t.player_id] ??= []);
      const existing = arr.find((e) => e.trait === t.trait);
      if (!existing) {
        arr.push({ trait: t.trait, category: t.category, severity: t.severity });
      } else if (t.source === "editor") {
        existing.severity = t.severity;
      }
    }
  }

  const players = (data ?? []).map((p: { person_id: number }) => ({
    ...p,
    traits: traitMap[p.person_id] ?? [],
  }));

  return NextResponse.json({
    players,
    hasMore: (data ?? []).length === limit,
  });
```

Remove the old `return NextResponse.json({ players: data ?? [], hasMore: ... })` that this replaces.

- [ ] **Step 2: Verify type check**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/legends/route.ts
git commit -m "feat(legends): return traits with source deduplication"
```

---

### Task 4: Display traits + admin editing on legends page

**Files:**
- Modify: `apps/web/src/app/legends/page.tsx`

- [ ] **Step 1: Add trait constants and types**

Near the top of the file (after imports), add:

```typescript
const EDITORIAL_TRAITS = [
  "set_piece_specialist", "dribble_artist", "playmaker_vision", "through_ball_king",
  "one_touch_play", "tempo_controller", "long_range_threat", "fox_in_the_box",
  "sweeper_reader", "brick_wall", "hard_man", "captain_leader",
  "target_man", "pace_merchant", "big_game_player", "clutch",
];

const TRAIT_LABELS: Record<string, string> = {
  set_piece_specialist: "Set Piece", dribble_artist: "Dribble Artist",
  playmaker_vision: "Vision", through_ball_king: "Through Ball",
  one_touch_play: "One Touch", tempo_controller: "Tempo",
  long_range_threat: "Long Range", fox_in_the_box: "Fox in the Box",
  sweeper_reader: "Reader", brick_wall: "Brick Wall",
  hard_man: "Hard Man", captain_leader: "Captain",
  target_man: "Target Man", pace_merchant: "Pace",
  big_game_player: "Big Game", clutch: "Clutch",
};

const TRAIT_COLORS: Record<string, string> = {
  style: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  tactical: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  physical: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  behavioral: "bg-green-500/20 text-green-400 border-green-500/30",
};

const TRAIT_CATEGORY: Record<string, string> = {
  set_piece_specialist: "tactical", dribble_artist: "style", playmaker_vision: "style",
  through_ball_king: "style", one_touch_play: "style", tempo_controller: "style",
  long_range_threat: "tactical", fox_in_the_box: "tactical", sweeper_reader: "tactical",
  brick_wall: "tactical", hard_man: "tactical", captain_leader: "tactical",
  target_man: "physical", pace_merchant: "physical",
  big_game_player: "behavioral", clutch: "behavioral",
};
```

- [ ] **Step 2: Update Legend interface to include traits**

Add `traits` field:

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
  traits: { trait: string; category: string; severity: number }[];
}
```

- [ ] **Step 3: Add TraitPills display component inside LegendsContent**

```typescript
  function TraitPills({ player }: { player: Legend }) {
    const [traits, setTraits] = useState(player.traits ?? []);
    const [adding, setAdding] = useState(false);

    const assigned = new Set(traits.map((t) => t.trait));
    const available = EDITORIAL_TRAITS.filter((t) => !assigned.has(t));

    async function addTrait(trait: string) {
      setTraits((prev) => [...prev, { trait, category: TRAIT_CATEGORY[trait] ?? "style", severity: 7 }]);
      setAdding(false);
      await fetch("/api/admin/trait-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: player.person_id, trait, action: "add" }),
      });
    }

    async function removeTrait(trait: string) {
      setTraits((prev) => prev.filter((t) => t.trait !== trait));
      await fetch("/api/admin/trait-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: player.person_id, trait, action: "remove" }),
      });
    }

    return (
      <div className="flex flex-wrap items-center gap-0.5">
        {traits.map((t) => (
          <span key={t.trait} className={`inline-flex items-center gap-0.5 text-[8px] font-medium px-1.5 py-0.5 rounded-full border ${TRAIT_COLORS[t.category] ?? TRAIT_COLORS.style}`}>
            {TRAIT_LABELS[t.trait] ?? t.trait}
            {isAdmin && (
              <button onClick={() => removeTrait(t.trait)} className="ml-0.5 opacity-50 hover:opacity-100">&times;</button>
            )}
          </span>
        ))}
        {isAdmin && available.length > 0 && (
          adding ? (
            <select
              autoFocus
              onChange={(e) => { if (e.target.value) addTrait(e.target.value); }}
              onBlur={() => setAdding(false)}
              className="text-[8px] bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded px-1 py-0.5 border border-[var(--border-subtle)]"
            >
              <option value="">Pick...</option>
              {available.map((t) => <option key={t} value={t}>{TRAIT_LABELS[t] ?? t}</option>)}
            </select>
          ) : (
            <button onClick={() => setAdding(true)} className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-1">+</button>
          )
        )}
        {traits.length === 0 && !isAdmin && <span className="text-[var(--text-muted)] text-[9px]">&ndash;</span>}
      </div>
    );
  }
```

- [ ] **Step 4: Add Traits column to desktop table header**

In the `<thead>` row, add after the Model column header:

```html
<th className="text-left py-1.5 px-2 font-medium">Traits</th>
```

- [ ] **Step 5: Add Traits cell to desktop table body**

In the `<tbody>` row, add after the Model `<td>`:

```tsx
<td className="py-1.5 px-2">
  <TraitPills player={player} />
</td>
```

- [ ] **Step 6: Add traits to mobile card layout**

In the mobile card, add after the model/best_role line and before the SimilarActivePlayer:

```tsx
<div className="mt-0.5 pl-9">
  <TraitPills player={player} />
</div>
```

- [ ] **Step 7: Verify type check and tests**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run 2>&1 | tail -10`
Expected: Clean type check, 292 tests passing

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/legends/page.tsx
git commit -m "feat(legends): display trait pills with admin add/remove editing"
```

---

### Task 5: Create pipeline 04d to seed legend traits

**Files:**
- Create: `pipeline/04d_seed_legend_traits.py`
- Reference: `pipeline/04c_seed_legend_profiles.py` (pattern)

- [ ] **Step 1: Create the pipeline script**

```python
"""
04d_seed_legend_traits.py — Seed editorial playing style traits for top legends.

Assigns 2-3 defining traits per legend (peak >= 92) to player_trait_scores.
These are editorial descriptors that can't be derived from stats.

Usage:
    python pipeline/04d_seed_legend_traits.py              # run
    python pipeline/04d_seed_legend_traits.py --dry-run    # preview
    python pipeline/04d_seed_legend_traits.py --player ID  # single player
"""

import argparse
import psycopg2

from config import POSTGRES_DSN

TRAIT_CATEGORY = {
    "set_piece_specialist": "tactical", "dribble_artist": "style",
    "playmaker_vision": "style", "through_ball_king": "style",
    "one_touch_play": "style", "tempo_controller": "style",
    "long_range_threat": "tactical", "fox_in_the_box": "tactical",
    "sweeper_reader": "tactical", "brick_wall": "tactical",
    "hard_man": "tactical", "captain_leader": "tactical",
    "target_man": "physical", "pace_merchant": "physical",
    "big_game_player": "behavioral", "clutch": "behavioral",
}

# person_id → list of trait names (2-3 per legend)
LEGEND_TRAITS = {
    # ═══ GOAT TIER (95-96) ═══
    10296: ["dribble_artist", "playmaker_vision"],                    # Maradona
    16251: ["fox_in_the_box", "big_game_player", "pace_merchant"],   # Pelé
    16832: ["pace_merchant", "dribble_artist"],                       # Ronaldo Nazário
    11267: ["dribble_artist", "pace_merchant"],                       # Garrincha
    8224:  ["captain_leader", "big_game_player"],                     # Di Stéfano
    11165: ["sweeper_reader", "captain_leader", "tempo_controller"],  # Beckenbauer
    12783: ["dribble_artist", "playmaker_vision", "tempo_controller"],# Cruyff
    16077: ["brick_wall", "captain_leader"],                          # Maldini
    18787: ["tempo_controller", "playmaker_vision", "big_game_player"],# Zidane
    10992: ["long_range_threat", "fox_in_the_box"],                   # Puskás
    13869: ["brick_wall", "captain_leader"],                          # Yashin

    # ═══ PEAK 94 ═══
    9086:  ["long_range_threat", "captain_leader"],                   # Bobby Charlton
    11401: ["brick_wall", "big_game_player", "captain_leader"],       # Buffon
    15114: ["set_piece_specialist", "playmaker_vision"],              # Platini
    17905: ["pace_merchant", "fox_in_the_box", "big_game_player"],   # Henry
    16831: ["dribble_artist", "one_touch_play"],                      # Ronaldinho
    15082: ["through_ball_king", "one_touch_play", "playmaker_vision"],# Laudrup
    16676: ["long_range_threat", "set_piece_specialist"],             # Rivellino
    13961: ["brick_wall", "pace_merchant"],                           # Thuram
    11140: ["sweeper_reader", "captain_leader"],                      # Baresi
    9279:  ["pace_merchant", "captain_leader"],                       # Cafú
    10507: ["brick_wall", "sweeper_reader"],                          # Van der Sar
    18779: ["set_piece_specialist", "playmaker_vision", "long_range_threat"],# Zico
    11306: ["dribble_artist", "big_game_player"],                     # George Best
    10830: ["pace_merchant", "fox_in_the_box", "long_range_threat"],  # Eusébio

    # ═══ PEAK 93 ═══
    11157: ["hard_man", "captain_leader"],                            # Rijkaard
    10474: ["dribble_artist", "playmaker_vision"],                    # Hazard
    14024: ["captain_leader", "long_range_threat", "hard_man"],       # Matthäus
    9090:  ["sweeper_reader", "captain_leader"],                      # Bobby Moore
    14145: ["dribble_artist", "set_piece_specialist"],                # Figo
    11944: ["brick_wall", "clutch"],                                  # Casillas
    9896:  ["pace_merchant", "dribble_artist"],                       # Dani Alves
    14482: ["fox_in_the_box", "one_touch_play"],                      # Van Basten
    8449:  ["tempo_controller", "set_piece_specialist", "through_ball_king"],# Pirlo
    17666: ["long_range_threat", "captain_leader", "big_game_player"],# Gerrard
    18570: ["tempo_controller", "one_touch_play", "through_ball_king"],# Xavi
    16179: ["long_range_threat", "tempo_controller", "through_ball_king"],# Scholes
    8482:  ["dribble_artist", "one_touch_play", "tempo_controller"],  # Iniesta
    11263: ["pace_merchant", "long_range_threat"],                    # Bale
    16921: ["dribble_artist", "target_man"],                          # Gullit
    14435: ["hard_man", "brick_wall"],                                # Desailly
    8691:  ["dribble_artist", "long_range_threat"],                   # Robben
    16279: ["brick_wall", "captain_leader"],                          # Schmeichel
    13292: ["pace_merchant", "dribble_artist", "big_game_player"],    # Kaká

    # ═══ PEAK 92 ═══
    11218: ["long_range_threat", "big_game_player"],                  # Batistuta
    12459: ["captain_leader", "hard_man"],                            # Zanetti
    18796: ["target_man", "long_range_threat", "dribble_artist"],     # Ibrahimović
    18637: ["long_range_threat", "pace_merchant"],                    # Yaya Touré
    16133: ["hard_man", "captain_leader"],                            # Vieira
    16721: ["dribble_artist", "playmaker_vision"],                    # Baggio
    16871: ["hard_man", "captain_leader", "big_game_player"],         # Roy Keane
    10230: ["one_touch_play", "playmaker_vision"],                    # Bergkamp
    18566: ["tempo_controller", "through_ball_king"],                 # Xabi Alonso
    17338: ["fox_in_the_box", "clutch"],                              # Agüero
    10876: ["brick_wall", "captain_leader"],                          # Cannavaro
    11368: ["fox_in_the_box", "big_game_player"],                     # Gerd Müller
    11123: ["playmaker_vision", "set_piece_specialist", "long_range_threat"],# Totti
    16722: ["long_range_threat", "pace_merchant", "set_piece_specialist"],# Roberto Carlos
    16745: ["fox_in_the_box", "one_touch_play"],                      # Van Persie
    16320: ["sweeper_reader", "captain_leader"],                      # Lahm
    10064: ["set_piece_specialist", "through_ball_king"],             # Beckham
    16810: ["pace_merchant", "fox_in_the_box"],                       # Romário
    16675: ["long_range_threat", "dribble_artist", "big_game_player"],# Rivaldo
    15611: ["hard_man", "brick_wall", "captain_leader"],              # Vidić
    16947: ["pace_merchant", "dribble_artist"],                       # Giggs
}


def main():
    parser = argparse.ArgumentParser(description="Seed editorial traits for legends.")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--player", type=int, help="Seed single player by person_id")
    args = parser.parse_args()

    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor()
    total = 0

    seeds = LEGEND_TRAITS
    if args.player:
        seeds = {args.player: LEGEND_TRAITS.get(args.player, [])}
        if not seeds[args.player]:
            print(f"No traits defined for player {args.player}")
            return

    for person_id, traits in seeds.items():
        for trait in traits:
            category = TRAIT_CATEGORY.get(trait, "style")
            if args.dry_run:
                print(f"  [DRY] {person_id}: {trait} ({category}, severity=7)")
            else:
                cur.execute("""
                    INSERT INTO player_trait_scores (player_id, trait, category, severity, source)
                    VALUES (%s, %s, %s, 7, 'scout')
                    ON CONFLICT (player_id, trait, source)
                    DO UPDATE SET severity = EXCLUDED.severity, category = EXCLUDED.category
                """, (person_id, trait, category))
            total += 1

    if not args.dry_run:
        conn.commit()
        print(f"Seeded {total} traits for {len(seeds)} legends.")
    else:
        print(f"[DRY RUN] Would seed {total} traits for {len(seeds)} legends.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Dry-run test**

Run: `cd pipeline && python3 04d_seed_legend_traits.py --dry-run 2>&1 | head -20`
Expected: Lines like `[DRY] 10296: dribble_artist (style, severity=7)`

- [ ] **Step 3: Run for real**

Run: `cd pipeline && python3 04d_seed_legend_traits.py`
Expected: `Seeded ~140 traits for ~60 legends.`

- [ ] **Step 4: Verify data in DB**

Run: `python3 -c "import os,dotenv;dotenv.load_dotenv('.env.local');from supabase import create_client;sb=create_client(os.environ['SUPABASE_URL'],os.environ['SUPABASE_SERVICE_KEY']);r=sb.from_('player_trait_scores').select('*').eq('source','scout').limit(10).execute();print(r.data)"`
Expected: Rows with source='scout', traits like dribble_artist, severity=7

- [ ] **Step 5: Commit**

```bash
git add pipeline/04d_seed_legend_traits.py
git commit -m "feat: pipeline 04d — seed editorial playing style traits for 60 legends"
```

---

### Task 6: Final verification

- [ ] **Step 1: Type check**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -5`
Expected: Clean

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npx vitest run 2>&1 | tail -5`
Expected: 292 tests passing

- [ ] **Step 3: Browser test**

At `http://localhost:3000/legends`:
1. Maradona should show "Dribble Artist" and "Vision" pills in amber
2. Maldini should show "Brick Wall" and "Captain" pills in purple
3. Admin mode: "+" button appears, can add/remove traits
4. Mobile: trait pills show below model label
5. Traits persist on page refresh
