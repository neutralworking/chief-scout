# Playing Style Traits — Design Spec

## Goal
Add editorial playing style descriptors to legends — traits like "Dead Ball Specialist" and "Dribble Artist" that can't be quantified by grades. Display on legends page with admin editing.

## Data Model

### Existing table: `player_trait_scores`
```sql
player_id BIGINT NOT NULL REFERENCES people(id),
trait TEXT NOT NULL,
category TEXT NOT NULL CHECK (category IN ('style', 'physical', 'tactical', 'behavioral')),
severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 10),
source TEXT NOT NULL DEFAULT 'inferred',
UNIQUE(player_id, trait, source)
```

No schema changes needed. New traits use `source = 'scout'` (pipeline) or `source = 'editor'` (UI).

### Source deduplication
The UNIQUE constraint is `(player_id, trait, source)`, so a player can have both `scout` and `editor` rows for the same trait. The API must deduplicate by trait name, preferring `editor` over `scout` (editorial overrides always win). Use `DISTINCT ON (player_id, trait) ... ORDER BY source = 'editor' DESC` or deduplicate in app code.

### New trait vocabulary (14 editorial traits)

Aligned with existing `TRAIT_DEFINITIONS` — reuses `set_piece_specialist` and `big_game_player` instead of creating synonyms. New editorial traits marked with ★.

**Style category:**
- `set_piece_specialist` — free kicks, corners, set piece delivery (exists in SACROSANCT)
- ★ `dribble_artist` — beating players is the identity
- ★ `playmaker_vision` — sees passes nobody else does
- ★ `through_ball_king` — threading the needle is the signature
- ★ `one_touch_play` — first-time combinations, wall passes
- ★ `tempo_controller` — dictates match speed

**Tactical category:**
- ★ `long_range_threat` — scores/shoots from distance
- ★ `fox_in_the_box` — poacher instinct, lives in the 6-yard area
- ★ `sweeper_reader` — reads danger before it happens
- ★ `brick_wall` — unbeatable 1v1 defender
- ★ `hard_man` — physical intimidation, tackles define reputation
- ★ `captain_leader` — on-pitch authority beyond the armband

**Physical category:**
- ★ `target_man` — aerial focal point, hold-up play
- ★ `pace_merchant` — raw speed defines the game

**Behavioral category (reuse existing):**
- `big_game_player` — finals, derbies, last-minute moments (exists in SACROSANCT)
- `clutch` — penalty/shootout hero (exists in SACROSANCT)

Default severity: 7 (strong characteristic; 10 = defining on the documented scale). Adjustable per player.

### SACROSANCT + TRAIT_DEFINITIONS update
Add the 12 new editorial traits to `TRAIT_DEFINITIONS` in `trait-role-impact.ts` (the canonical registry). New traits get empty role impact maps since they only apply to legends currently. This keeps a single source of truth for all trait names.

## Pipeline: `04d_seed_legend_traits.py`

Hardcoded dict mapping ~50 top legends (peak >= 92) to 2-3 traits each.

Example:
```python
LEGEND_TRAITS = {
    10296: ["dribble_artist", "playmaker_vision"],           # Maradona
    16251: ["fox_in_the_box", "big_game_player"],            # Pelé
    # Beckham: set_piece_specialist, through_ball_king
    # Gerrard: long_range_threat, captain_leader, big_game_player
    # Maldini: brick_wall, captain_leader
    # Henry: pace_merchant, big_game_player
    # Pirlo: tempo_controller, playmaker_vision, set_piece_specialist
    # ...
}
```

- Source: `'scout'`
- Severity: 7 (default)
- Upsert: `ON CONFLICT (player_id, trait, source) DO UPDATE SET severity = EXCLUDED.severity`
- Re-runnable, idempotent

## Legends API changes

Extend `GET /api/legends` to return traits:

```typescript
// Guard: only fetch if we have player IDs
const playerIds = (data ?? []).map((p) => p.person_id);
const traits: Record<number, { trait: string; category: string; severity: number }[]> = {};

if (playerIds.length > 0) {
  const traitRes = await supabase
    .from("player_trait_scores")
    .select("player_id, trait, category, severity, source")
    .in("player_id", playerIds);

  // Deduplicate: prefer editor over scout/inferred for same trait
  for (const t of traitRes.data ?? []) {
    const arr = traits[t.player_id] ??= [];
    const existing = arr.find((e) => e.trait === t.trait);
    if (!existing) {
      arr.push({ trait: t.trait, category: t.category, severity: t.severity });
    } else if (t.source === "editor") {
      // Editor overrides pipeline
      existing.severity = t.severity;
    }
  }
}

// Attach to each player in response
const players = (data ?? []).map((p) => ({
  ...p,
  traits: traits[p.person_id] ?? [],
}));
```

Response shape:
```json
{
  "players": [
    {
      "person_id": 10296,
      "name": "Diego Maradona",
      "traits": [
        { "trait": "dribble_artist", "category": "style", "severity": 7 },
        { "trait": "playmaker_vision", "category": "style", "severity": 7 }
      ]
    }
  ]
}
```

## Legends page UI

### Display (all users)
Trait tags rendered as small pills in a dedicated "Traits" column (or below player name on mobile). Colored by category:
- Style → amber/gold
- Tactical → purple
- Physical → blue
- Behavioral → green

Label format: human-readable from trait name (`dribble_artist` → "Dribble Artist").

### Admin editing
- Small "+" button at end of trait list
- Dropdown of all editorial traits (filtered to exclude already-assigned)
- "x" button on each tag to remove
- Saves via `POST /api/admin/trait-update`

### Trait save endpoint
`POST /api/admin/trait-update` (new):
```typescript
// Validate trait name against ALLOWED_TRAITS constant
const ALLOWED_TRAITS = [
  "set_piece_specialist", "dribble_artist", "playmaker_vision", "through_ball_king",
  "one_touch_play", "tempo_controller", "long_range_threat", "fox_in_the_box",
  "sweeper_reader", "brick_wall", "hard_man", "captain_leader",
  "target_man", "pace_merchant", "big_game_player", "clutch",
];

// Add trait
{ person_id: number, trait: string, category: string, severity: number, action: "add" }
// Remove trait
{ person_id: number, trait: string, action: "remove" }
```

- Validates `trait` against `ALLOWED_TRAITS` (rejects unknown traits)
- Writes to `player_trait_scores` with `source = 'editor'`
- Auth: uses service role key (same pattern as `player-update`)

## Scope
- Legends page only
- No changes to pipeline 36c (active player inference)
- No changes to active player pages
- Existing 18 stat-inferred traits untouched (2 reused: `set_piece_specialist`, `big_game_player`)

## Files affected
- Create: `pipeline/04d_seed_legend_traits.py`
- Create: `apps/web/src/app/api/admin/trait-update/route.ts`
- Modify: `apps/web/src/app/api/legends/route.ts` (add trait batch-fetch with dedup)
- Modify: `apps/web/src/app/legends/page.tsx` (display + edit UI)
- Modify: `docs/systems/SACROSANCT.md` (add editorial traits)
- Modify: `apps/web/src/lib/assessment/trait-role-impact.ts` (add 12 new traits to TRAIT_DEFINITIONS with empty role impacts)
