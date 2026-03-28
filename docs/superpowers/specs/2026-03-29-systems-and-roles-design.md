# Systems & Roles Redesign — Design Spec

> Roles should only exist if they exist in valid tactical systems.

## Problem Statement

The current role taxonomy is detached from tactical reality. Roles are assigned per-position in a flat 4-per-position grid (`tactical_roles` table), with no connection to the systems they belong to. This causes:

1. **Matheus Cunha problem** — archetype-derived labels (Assassin, Outlet) assigned to positions where no real system uses them
2. **Role sprawl** — roles invented to fill grid slots rather than emerging from real football
3. **No system context** — "Regista" exists in isolation, not as a specific job in Tiki-Taka or Positional Play
4. **Philosophy → formation → role gap** — philosophies jump to formations and roles independently with no unifying "system" layer

## Solution

### New Hierarchy

```
Philosophy (identity — "What do you believe?")
  └─ System (implementation — "How does this philosophy play?")
       └─ Formation (shape — "4-4-2", "3-5-2")
            └─ Slot (position in formation — "LCB", "RS", "RDM")
                 └─ Role(s) per slot (1-3 valid roles, with default)
```

### How It Fixes the Cunha Problem

Roles are validated bottom-up: if no system anywhere uses a role at a given position, that role doesn't exist for that position. Pipeline 27 queries valid roles from `slot_roles` rather than a flat position→role list. "Assassin" and "Outlet" don't appear in any system at CF, so they're never candidates.

---

## Database Schema

### Tables

```sql
-- Existing table, updated (Cholismo → Transizione, Fergie Time → Leadership)
-- NOTE: existing columns (origin_story, key_principles, archetype_requirements,
-- personality_preferences, preferred_tags, concern_tags, key_attributes,
-- six dimension SMALLINT columns) are KEPT for now. The dimensions JSONB below
-- is the target state; migration consolidates the six columns into JSONB.
tactical_philosophies
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  origin_era TEXT,
  defining_managers TEXT[],
  dimensions JSONB  -- {possession, pressing, directness, depth, width, fluidity} 0-10
  -- ... existing columns preserved until cleanup migration

-- NEW
tactical_systems
  id SERIAL PRIMARY KEY,
  philosophy_id INT REFERENCES tactical_philosophies(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  formation TEXT NOT NULL,        -- "4-4-2", "4-3-3", "3-5-2"
  defining_team TEXT,             -- "Barcelona 2008-12"
  key_principle TEXT,             -- one sentence
  variant_of INT REFERENCES tactical_systems(id)  -- self-ref, max 1 level deep

-- NEW
system_slots
  id SERIAL PRIMARY KEY,
  system_id INT REFERENCES tactical_systems(id) ON DELETE CASCADE,
  slot_label TEXT NOT NULL,       -- "LCB", "RS", "RDM", "LWB"
  position TEXT NOT NULL,         -- enum: GK/CD/WD/DM/CM/WM/AM/WF/CF
  sort_order INT NOT NULL,        -- pitch position for display
  UNIQUE(system_id, slot_label)

-- NEW
slot_roles
  id SERIAL PRIMARY KEY,
  slot_id INT REFERENCES system_slots(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  primary_model TEXT NOT NULL,    -- from the 13 models
  secondary_model TEXT NOT NULL,
  rationale TEXT,                 -- "Vardy-type: presses + scores"
  UNIQUE(slot_id, role_name)

-- Indexes
CREATE INDEX idx_system_slots_system_id ON system_slots(system_id);
CREATE INDEX idx_system_slots_position ON system_slots(position);
CREATE INDEX idx_slot_roles_slot_id ON slot_roles(slot_id);

-- RLS: enable public read on all new tables (matches existing pattern)
ALTER TABLE tactical_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON tactical_systems FOR SELECT USING (true);
CREATE POLICY "public_read" ON system_slots FOR SELECT USING (true);
CREATE POLICY "public_read" ON slot_roles FOR SELECT USING (true);
```

### Dropped Tables

| Table | Reason |
|---|---|
| `tactical_roles` | Replaced by `slot_roles` — roles now live in systems |
| `philosophy_formations` | Formation is now on `tactical_systems` |
| `philosophy_roles` | Roles are per-slot, not per-philosophy |

### Kept

| Table | Change |
|---|---|
| `tactical_philosophies` | Cholismo row → Transizione, Fergie Time → Leadership |
| `philosophy_clubs` | Unchanged — club → philosophy assignment |

---

## The 10 Philosophies

| # | Slug | Name | Core Belief |
|---|---|---|---|
| 1 | `garra_charrua` | Garra Charrúa | Spirit and sacrifice over talent |
| 2 | `catenaccio` | Catenaccio | Defensive organisation as art |
| 3 | `joga_bonito` | Joga Bonito | Individual expression within collective |
| 4 | `total_football` | Total Football | Positional interchange, universal players |
| 5 | `la_masia` | La Masia | Possession as control, positional play |
| 6 | `gegenpressing` | Gegenpressing | Win the ball back immediately |
| 7 | `bielsismo` | Bielsismo | Geometry, effort, moral obligation to attack |
| 8 | `transizione` | Transizione | Defend with structure, attack with speed |
| 9 | `pomo` | POMO | Direct, territorial, set-piece dominance |
| 10 | `leadership` | Leadership | The manager IS the system — adapt, prepare, win |

---

## The 28 Systems

### 1. Garra Charrúa

| System | Formation | Defining Team |
|---|---|---|
| La Celeste | 4-4-2 | Uruguay 1950 / 2010 |
| Muralla | 5-4-1 | Tabárez's Uruguay 2018 |

### 2. Catenaccio

| System | Formation | Defining Team |
|---|---|---|
| Grande Inter | 5-3-2 | Herrera's Inter 1963-66 |
| Trincea | 4-5-1 | Capello's Milan / Allegri's Juventus |
| Il Muro | 3-5-2 | Conte's Italy Euro 2016 |

### 3. Joga Bonito

| System | Formation | Defining Team |
|---|---|---|
| Samba | 4-2-4 | Brazil 1958-62 |
| O Jogo | 4-2-3-1 | Brazil 1970 |
| Ginga | 4-3-3 | Santos (Pelé) / Flamengo 2019 |

### 4. Total Football

| System | Formation | Defining Team |
|---|---|---|
| Ajax Model | 4-3-3 | Michels/Cruyff Ajax 1970-73 |
| Oranje | 3-4-3 | Netherlands 1974 WC |
| Van Gaal System | 4-3-3 | Ajax 1995 / Van Gaal's Barcelona |

### 5. La Masia

| System | Formation | Defining Team |
|---|---|---|
| Positional Play | 4-3-3 | Guardiola's Barcelona 2008-12 |
| Inverted Build | 3-2-4-1 | Guardiola's City 2022-24 |
| Relational Play | 4-2-3-1 | De Zerbi's Brighton |

### 6. Gegenpressing

| System | Formation | Defining Team |
|---|---|---|
| Heavy Metal | 4-2-3-1 | Klopp's Dortmund 2010-13 |
| Red Machine | 4-3-3 | Klopp's Liverpool 2018-20 |
| Red Bull Model | 4-4-2 | Rangnick's Leipzig / Salzburg |
| Kyiv Prototype | 4-4-2 | Lobanovskyi's Dynamo 1986-88 |

### 7. Bielsismo

| System | Formation | Defining Team |
|---|---|---|
| El Loco | 3-3-1-3 | Bielsa's Athletic Bilbao / Leeds |
| La Furia | 3-4-3 | Gasperini's Atalanta / Sampaoli's Chile |

### 8. Transizione

| System | Formation | Defining Team |
|---|---|---|
| The Special One | 4-2-3-1 | Mourinho's Inter 2010 |
| Les Bleus | 4-2-3-1 | Deschamps' France 2018 |
| Foxes | 4-4-2 | Ranieri's Leicester 2016 |

### 9. POMO

| System | Formation | Defining Team |
|---|---|---|
| Route One | 4-4-2 | Wimbledon 1988 / Allardyce's Bolton |
| Fortress | 4-5-1 | Pulis's Stoke / Dyche's Burnley |

### 10. Leadership

| System | Formation | Defining Team |
|---|---|---|
| Wing Play | 4-4-2 | Ferguson's United 1996-2001 |
| European Nights | 4-5-1 | Ferguson's United 2008 CL |
| Ancelotti Ball | 4-3-3 | Ancelotti's Real Madrid 2022-24 |

---

## The 38 Roles (Bottom-Up Validated)

Every role below emerged from at least one real system during the audit. No role exists that isn't used in a real tactical system.

### GK (4)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Comandante** | Organises, commands, vocal presence | GK | Commander | Schmeichel, Buffon, Lloris |
| **Sweeper Keeper** | Sweeps behind high line, comes off line | GK | Cover | Neuer, Alisson, Van der Sar |
| **Libero GK** | Distribution specialist, passing outlet | GK | Passer | Ederson, Valdés |
| **Shotstopper** | Reflexes, dominates the box | GK | Powerhouse | Courtois, Pope, Begović |

### CD (4)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Centrale** | Commanding CB — organises, leads, sets the line | Commander | Destroyer | Van Dijk, Terry, Puyol, Morgan |
| **Distributor** | Ball-playing CB — progressive passing from deep | Passer | Cover | Bonucci, Stones, Piqué, Ferdinand |
| **Stopper** | Aggressive, front-foot, wins duels | Powerhouse | Destroyer | Chiellini, Vidić, Stam, Konaté |
| **Sweeper** | Last man — reads play, covers space | Cover | Controller | Beckenbauer, Varane, Hummels, Picchi |

### WD (4)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Fullback** | Gets forward, supports attacks | Engine | Passer | Neville, Irwin, Carvajal, Evra |
| **Wing-back** | IS the width — covers entire flank | Engine | Dribbler | Dani Alves, Hakimi, Maicon, Robertson, Marcelo |
| **Corner Back** | Stays home, defends, marks | Cover | Destroyer | Azpilicueta, Pavard, Mendy, Cáceres |
| **Invertido** | Tucks inside, becomes midfielder | Controller | Passer | Lahm 2013, Cancelo, TAA, Krol |

### DM (4)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Regista** | Deep quarterback — dictates with long passing | Passer | Controller | Pirlo, Jorginho, Gérson |
| **Pivote** | Creative holding mid — controls, distributes | Controller | Cover | Busquets, Rodri, Rijkaard |
| **Anchor** | Sits, disrupts, protects the back line | Destroyer | Cover | Makélélé, Kanté, Fabinho, Gattuso |
| **Segundo Volante** | DM who drives forward, scores from deep | Powerhouse | Engine | Touré, Pogba, Caicedo, Keïta |

### CM (4)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Playmaker** | Runs the game with vision and range | Creator | Passer | Scholes, Modric, Didi, Van Hanegem |
| **Metodista** | Metronome — controls rhythm, never wastes a ball | Controller | Passer | Xavi, Kroos, Carrick, Thiago |
| **Mezzala** | Half-space creator, arrives in the box | Passer | Creator | Iniesta, Bellingham, Mazzola, Litmanen |
| **Tuttocampista** | Box-to-box, covers every blade | Engine | Cover | Keane, Vidal, Neeskens, Davids, Wijnaldum |

### WM (3)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Winger** | Beats man or delivers from wide | Dribbler | Passer | Garrincha, Giggs, Beckham, Raphinha |
| **Tornante** | Tracks back, full-flank both phases | Engine | Cover | Zagallo, Park, Gosens, Valverde |
| **False Winger** | Starts wide, drifts inside | Controller | Creator | Bernardo Silva, Forsberg |

### AM (3)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Trequartista** | Free-roaming creator in the final third | Dribbler | Creator | Götze, Muniain, De Bruyne, Pelé 1970 |
| **Enganche** | The hook — receives between lines, decisive pass | Creator | Controller | Sneijder, Tostão, Riquelme |
| **Boxcrasher** | Dynamic AM who arrives in the box with energy | Sprinter | Striker | Lampard, Klich, Havertz |
| **Seconda Punta** | Second striker from AM — drops, links, creates | Creator | Striker | Griezmann 2018 |

Note: Seconda Punta is valid at both AM and CF. The same role name appears in system slots at both positions. Griezmann plays it from AM, Yorke from CF.

### WF (5)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Inside Forward** | Cuts inside on strong foot to shoot/create | Dribbler | Striker | Salah, Robben, Mané, Ronaldo 2008 |
| **Raumdeuter** | Space interpreter — finds pockets, arrives | Engine | Striker | Müller, Pedro, Foden, Rodrygo |
| **Winger** | Wide, beats man, delivers | Dribbler | Passer | Vinícius, Overmars, Finidi |
| **Wide Playmaker** | Creates from wide — vision, passing, dictates | Creator | Passer | Neymar, Grealish, Rui Costa (wide) |
| **Wide Target Forward** | Physical presence from wide — holds up, wins aerials | Target | Powerhouse | Mandžukić (LW), Weghorst (wide), Arnautović |

### CF (7)

| Role | What it is | Primary Model | Secondary Model | Examples |
|---|---|---|---|---|
| **Poacher** | Box instinct, movement, clinical | Striker | Dribbler | Inzaghi, Haaland, Gerd Müller, Cole |
| **Complete Forward** | Scores, creates, links, does everything | Striker | Creator | Lewandowski, Kane, Benzema, Rooney |
| **Falso Nove** | Drops deep, creates space, false 9 | Creator | Controller | Messi 2011, Firmino, Cruyff |
| **Spearhead** | Leads the press from front, work rate | Engine | Destroyer | Suárez, Okazaki, Bamford |
| **Target Forward** | Aerial, holds up, physical reference point | Target | Powerhouse | Giroud, Crouch, Mandžukić, Llorente |
| **Seconda Punta** | Second striker — creative, plays off the main striker | Creator | Striker | Yorke, Forlán, Del Piero, Griezmann |
| **Shadow Striker** | Pace, runs in behind, ghosts past the line | Sprinter | Striker | Vardy, Werner, Aubameyang, Belanov |

---

## Roles That Were Dropped

| Old Role | Reason |
|---|---|
| Assassin | Archetype-derived, no system uses it |
| Outlet | Archetype-derived, no system uses it |
| Libero (CD) | Renamed → Distributor (Libero too specific to Beckenbauer's free man) |
| Zagueiro (CD) | Renamed → Centrale (Zagueiro just means "defender") |
| Prima Punta (CF) | Renamed → Target Forward (gender-neutral, clearer) |
| Fluidificante (WD) | Merged into Wing-back / Fullback |
| Corredor (WD) | Merged into Fullback / Wing-back |
| Lateral (WD) | Merged into Fullback |
| Relayeur (CM) | Dropped — redundant with Tuttocampista |
| Shuttler (WM) | Dropped — redundant with Tornante |
| Volante (DM) | Merged into Anchor |
| Inventor (WF) | Dropped — no system uses it, replaced by Wide Playmaker |
| Extremo (WF) | Merged into Winger (pace vs skill is archetype, not role) |

---

## Pipeline Impact

### Pipeline 27 (player_ratings.py)

**Current:** Flat `TACTICAL_ROLES` dict maps position → list of (primary, secondary, role_name).

**New:** Query valid roles from `slot_roles`:

```python
# Load all valid roles per position from systems
valid_roles = {}
cur.execute("""
    SELECT DISTINCT ss.position, sr.role_name, sr.primary_model, sr.secondary_model
    FROM slot_roles sr
    JOIN system_slots ss ON sr.slot_id = ss.id
""")
for pos, role, primary, secondary in cur.fetchall():
    valid_roles.setdefault(pos, []).append((primary, secondary, role))
```

Scoring formula unchanged: `primary × 0.6 + secondary × 0.4`, normalized to 0-99, with top-end stretch.

### Pipeline 37 (compute_archetypes.py)

**Unchanged.** Archetypes are earned labels based on stats/personality, separate from roles. The archetype system (Marksman, Virtuoso, etc.) is independent.

### Pipeline 83 (seed_philosophies.py)

**Rewritten** to seed the new hierarchy: philosophies → systems → slots → roles.

### Frontend

- `formation-intelligence.ts` — rewritten to read from `tactical_systems` + `slot_roles`
- `tactical-philosophies.ts` — simplified, philosophy dimensions stay
- Player detail page — "Best Role" now shows system context: "Complete Forward (Positional Play)"
- `/tactics/[slug]` — system detail page with formation pitch view and slot roles

---

## Migration Plan

1. Create new tables: `tactical_systems`, `system_slots`, `slot_roles` (with indexes, RLS, constraints)
2. Seed all 28 systems with 38 roles via updated pipeline 83
3. UPDATE `tactical_philosophies` rows in-place (Cholismo → Transizione, Fergie Time → Leadership) — preserve IDs to avoid orphaning `philosophy_clubs` FKs
4. Snapshot current `best_role` distribution for before/after comparison
5. Rerun pipeline 27 with new role candidates from `slot_roles`
6. Validate: zero players with orphaned `best_role` values, median role score delta within +/- 3
7. Drop `tactical_roles`, `philosophy_formations`, `philosophy_roles`
8. Update SACROSANCT System 4 (Tactical Roles) section to reflect new 38-role taxonomy
9. Rewrite `formation-intelligence.ts` and `tactical-philosophies.ts` to read from new schema
10. Frontend smoke test: `/formations`, `/tactics`, `/compare`, player detail, squad builder

---

## Success Criteria

- [ ] Every role in `slot_roles` exists in at least one real tactical system
- [ ] No orphan roles (roles not used by any system)
- [ ] Matheus Cunha gets Complete Forward or Seconda Punta, not Outlet/Assassin
- [ ] Mbappe role score improves (Shadow Striker with Sprinter+Striker models)
- [ ] Pipeline 27 produces valid `best_role` for all players using system-validated roles
- [ ] Zero players with `best_role` values not in the new 38-role set after pipeline rerun
- [ ] Median role score change within +/- 3 points (no bulk regression)
- [ ] No player loses more than 15 role score points without explanation
- [ ] All 22 existing club-philosophy assignments survive the rename
- [ ] All 28 systems display correctly on `/tactics/[slug]` with formation pitch view
- [ ] Frontend smoke: `/formations`, `/compare`, player detail, squad builder all load
- [ ] SACROSANCT updated to reflect new taxonomy
