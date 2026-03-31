# Tactical Role Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 45-role tactical system with a clean 36-role taxonomy (4 per position) aligned to the four pillars.

**Architecture:** Update flows from pipeline source of truth → SQL migration → frontend definitions → tests. The pipeline `TACTICAL_ROLES` dict in `27_player_ratings.py` is the canonical source. All frontend files mirror it. A SQL migration reseeds the `tactical_roles` table and adds a `pillar` column. Finally, script 27 re-runs to recompute `best_role` for all players.

**Tech Stack:** Python (pipeline), PostgreSQL/Supabase (migration), TypeScript/Next.js (frontend), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-23-tactical-role-redesign.md`

---

### Task 1: Update pipeline TACTICAL_ROLES (source of truth)

**Files:**
- Modify: `pipeline/27_player_ratings.py:108-158`

- [ ] **Step 1: Replace the TACTICAL_ROLES dict**

Replace lines 108-158 with the new 36-role taxonomy. Each tuple is `(primary_model, secondary_model, role_name)`:

```python
TACTICAL_ROLES = {
    "GK": [
        ("GK", "Passer",     "Libero GK"),        # Ederson, Ter Stegen: distribution specialist
        ("GK", "Cover",      "Sweeper Keeper"),    # Neuer, Alisson: high line, reads danger
        ("GK", "Commander",  "Comandante"),        # Buffon, Casillas: organizer, commands area
        ("GK", "Target",     "Shotstopper"),       # Kahn, Courtois: reflexes, presence
    ],
    "CD": [
        ("Passer", "Cover",        "Libero"),       # Beckenbauer, Stones: ball-playing CB
        ("Cover", "Controller",    "Sweeper"),       # Sammer, Hummels: last man, reads play
        ("Commander", "Destroyer", "Zagueiro"),      # Thiago Silva, Van Dijk: commanding CB
        ("Powerhouse", "Destroyer","Vorstopper"),    # Chiellini, Konate: aggressive, wins duels
    ],
    "WD": [
        ("Passer", "Dribbler",   "Lateral"),        # TAA, Cafu: attacking fullback, final ball
        ("Engine", "Cover",      "Fluidificante"),   # Zanetti, Robertson: covers full flank
        ("Controller", "Passer", "Invertido"),       # Lahm, Cancelo: inverted FB, tucks inside
        ("Sprinter", "Engine",   "Corredor"),        # Walker, Theo Hernandez: pace-based fullback
    ],
    "DM": [
        ("Passer", "Controller",   "Regista"),       # Pirlo, Jorginho: deep playmaker
        ("Cover", "Destroyer",     "Sentinelle"),    # Makelele, Casemiro: shield, guards gate
        ("Controller", "Cover",    "Pivote"),        # Busquets, Rodri: midfield brain
        ("Powerhouse", "Destroyer","Volante"),       # Gattuso, Kante: ball-winner, aggressive
    ],
    "CM": [
        ("Passer", "Creator",      "Mezzala"),       # Barella, Kovacic: half-space creator
        ("Engine", "Cover",        "Tuttocampista"), # Lampard, Gerrard: all-pitch midfielder
        ("Controller", "Passer",   "Metodista"),     # Xavi, Kroos: orchestrator
        ("Sprinter", "Engine",     "Relayeur"),      # Valverde, Toure: tireless shuttle
    ],
    "WM": [
        ("Dribbler", "Passer",    "Winger"),         # Garrincha, Figo, Saka: beats man with skill
        ("Engine", "Cover",       "Tornante"),       # Moses, Kostic: full-flank, both phases
        ("Controller", "Cover",   "False Winger"),   # Bernardo Silva, Foden: drifts inside
        ("Sprinter", "Engine",    "Shuttler"),       # Sterling, Sane: pace + stamina from wide
    ],
    "AM": [
        ("Dribbler", "Creator",   "Trequartista"),   # Baggio, Zidane: free-roaming 10
        ("Engine", "Striker",     "Seconda Punta"),  # Del Piero, Griezmann: reads space, links play
        ("Controller", "Creator", "Enganche"),       # Riquelme, Dybala: the hook, sees everything
        ("Sprinter", "Striker",   "Boxcrasher"),     # Havertz, Bruno Fernandes: arrives in box
    ],
    "WF": [
        ("Dribbler", "Sprinter",  "Inverted Winger"), # Robben, Salah: cuts inside to shoot
        ("Engine", "Striker",     "Raumdeuter"),     # Son, Mane: space interpreter, presses + scores
        ("Creator", "Dribbler",   "Inventor"),       # Grealish, Neymar: creates from nothing
        ("Sprinter", "Striker",   "Extremo"),        # Henry, Mbappe: electric pace + power
    ],
    "CF": [
        ("Striker", "Dribbler",    "Poacher"),       # Gerd Muller, Inzaghi: pure finisher
        ("Engine", "Destroyer",    "Spearhead"),     # Vardy, Suarez: leads the press
        ("Creator", "Controller",  "Falso Nove"),    # Messi (2009), Benzema: false 9
        ("Target", "Powerhouse",   "Prima Punta"),   # Toni, Giroud: target striker
    ],
}
```

- [ ] **Step 2: Verify script parses without error**

Run: `cd pipeline && python -c "import importlib; m = importlib.import_module('27_player_ratings'); print(len(m.TACTICAL_ROLES), 'positions,', sum(len(v) for v in m.TACTICAL_ROLES.values()), 'roles')"`
Expected: `9 positions, 36 roles`

- [ ] **Step 3: Commit**

```bash
git add pipeline/27_player_ratings.py
git commit -m "feat(roles): replace TACTICAL_ROLES with 36-role four-pillar taxonomy"
```

---

### Task 2: Write the SQL migration

**Files:**
- Create: `pipeline/sql/043_role_redesign.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 043: Tactical role redesign — 36 roles (4 per position, pillar-aligned)
-- Replaces the old 27+6 role set with a clean taxonomy.

-- Add pillar column
ALTER TABLE tactical_roles ADD COLUMN IF NOT EXISTS pillar TEXT;

-- Clear old roles
DELETE FROM tactical_roles;

-- Reset sequence
SELECT setval('tactical_roles_id_seq', 1, false);

-- Seed 36 roles (4 per position × 9 positions)
INSERT INTO tactical_roles (name, position, description, primary_archetype, secondary_archetype, pillar) VALUES
  -- GK
  ('Libero GK',       'GK', 'Distribution specialist — builds attacks from the back',              'GK',         'Passer',     'technical'),
  ('Sweeper Keeper',  'GK', 'High line, sweeps behind defence, reads danger early',                'GK',         'Cover',      'tactical'),
  ('Comandante',      'GK', 'Organizer — commands the area, marshals the backline',                'GK',         'Commander',  'mental'),
  ('Shotstopper',     'GK', 'Reflexes, presence, dominates the six-yard box',                      'GK',         'Target',     'physical'),
  -- CD
  ('Libero',          'CD', 'Ball-playing CB — progressive passing from deep',                     'Passer',     'Cover',      'technical'),
  ('Sweeper',         'CD', 'Last man — reads play two moves ahead, covers space',                 'Cover',      'Controller', 'tactical'),
  ('Zagueiro',        'CD', 'Commanding CB — leads, organizes, sets the defensive tone',           'Commander',  'Destroyer',  'mental'),
  ('Vorstopper',      'CD', 'Aggressive front-foot defender — wins duels, dominates',              'Powerhouse', 'Destroyer',  'physical'),
  -- WD
  ('Lateral',         'WD', 'Attacking fullback — crosses, final ball, width',                     'Passer',     'Dribbler',   'technical'),
  ('Fluidificante',   'WD', 'Covers full flank in both phases, tireless discipline',               'Engine',     'Cover',      'tactical'),
  ('Invertido',       'WD', 'Inverted FB — reads when to tuck inside, becomes midfielder',         'Controller', 'Passer',     'mental'),
  ('Corredor',        'WD', 'Pace-based fullback — explosive in transition',                       'Sprinter',   'Engine',     'physical'),
  -- DM
  ('Regista',         'DM', 'Deep playmaker — dictates tempo with passing quality',                'Passer',     'Controller', 'technical'),
  ('Sentinelle',      'DM', 'Shield — positions, intercepts, guards the gate',                     'Cover',      'Destroyer',  'tactical'),
  ('Pivote',          'DM', 'Midfield brain — organizes shape, reads everything',                  'Controller', 'Cover',      'mental'),
  ('Volante',         'DM', 'Ball-winner — aggressive, physical, disrupts',                        'Powerhouse', 'Destroyer',  'physical'),
  -- CM
  ('Mezzala',         'CM', 'Half-space creator — technical quality between the lines',            'Passer',     'Creator',    'technical'),
  ('Tuttocampista',   'CM', 'All-pitch midfielder — covers every blade, arrives in box',           'Engine',     'Cover',      'tactical'),
  ('Metodista',       'CM', 'Orchestrator — controls rhythm with intelligent passing',             'Controller', 'Passer',     'mental'),
  ('Relayeur',        'CM', 'Tireless shuttle — pace and power to link phases',                    'Sprinter',   'Engine',     'physical'),
  -- WM
  ('Winger',          'WM', 'Beats defenders with skill and trickery, delivers from wide',         'Dribbler',   'Passer',     'technical'),
  ('Tornante',        'WM', 'Full-flank wide mid — works both phases, selfless',                   'Engine',     'Cover',      'tactical'),
  ('False Winger',    'WM', 'Starts wide, drifts inside intelligently to create overloads',        'Controller', 'Cover',      'mental'),
  ('Shuttler',        'WM', 'Raw pace and stamina to cover the flank end to end',                  'Sprinter',   'Engine',     'physical'),
  -- AM
  ('Trequartista',    'AM', 'Free-roaming 10 — dribbling genius in the final third',              'Dribbler',   'Creator',    'technical'),
  ('Seconda Punta',   'AM', 'Second striker — reads space, links play through movement',           'Engine',     'Striker',    'tactical'),
  ('Enganche',        'AM', 'The hook — sees everything, threads impossible passes',               'Controller', 'Creator',    'mental'),
  ('Boxcrasher',      'AM', 'Dynamic AM who arrives in the box with pace and power',               'Sprinter',   'Striker',    'physical'),
  -- WF
  ('Inverted Winger',  'WF', 'Cuts inside on strong foot to shoot or create',                      'Dribbler',   'Sprinter',   'technical'),
  ('Raumdeuter',      'WF', 'Space interpreter — presses and finds pockets to score',              'Engine',     'Striker',    'tactical'),
  ('Inventor',        'WF', 'Creates something from nothing — vision from wide',                   'Creator',    'Dribbler',   'mental'),
  ('Extremo',         'WF', 'Electric pace and power — stretches the defence',                     'Sprinter',   'Striker',    'physical'),
  -- CF
  ('Poacher',         'CF', 'Pure finisher — movement, instinct, clinical in the box',            'Striker',    'Dribbler',   'technical'),
  ('Spearhead',       'CF', 'Leads the press from front, relentless work rate',                    'Engine',     'Destroyer',  'tactical'),
  ('Falso Nove',      'CF', 'False 9 — drops deep, creates, pulls CBs out of shape',             'Creator',    'Controller', 'mental'),
  ('Prima Punta',     'CF', 'Target striker — aerial, holds up, physical reference point',        'Target',     'Powerhouse', 'physical')
ON CONFLICT (name, position) DO UPDATE SET
  description = EXCLUDED.description,
  primary_archetype = EXCLUDED.primary_archetype,
  secondary_archetype = EXCLUDED.secondary_archetype,
  pillar = EXCLUDED.pillar;

-- Clean up old roles that no longer exist
DELETE FROM tactical_roles WHERE name NOT IN (
  'Libero GK', 'Sweeper Keeper', 'Comandante', 'Shotstopper',
  'Libero', 'Sweeper', 'Zagueiro', 'Vorstopper',
  'Lateral', 'Fluidificante', 'Invertido', 'Corredor',
  'Regista', 'Sentinelle', 'Pivote', 'Volante',
  'Mezzala', 'Tuttocampista', 'Metodista', 'Relayeur',
  'Winger', 'Tornante', 'False Winger', 'Shuttler',
  'Trequartista', 'Seconda Punta', 'Enganche', 'Boxcrasher',
  'Inverted Winger', 'Raumdeuter', 'Inventor', 'Extremo',
  'Poacher', 'Spearhead', 'Falso Nove', 'Prima Punta'
);
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/sql/043_role_redesign.sql
git commit -m "feat(roles): add migration 043 — reseed tactical_roles with 36-role taxonomy"
```

---

### Task 3: Update role-definitions.ts (UI definitions)

**Files:**
- Modify: `apps/web/src/lib/role-definitions.ts:1-89`

- [ ] **Step 1: Write the failing test update**

Update `apps/web/tests/role-definitions.test.ts` with the new 36-role mirror:

```typescript
const PIPELINE_TACTICAL_ROLES: Record<string, [string, string, string][]> = {
  GK: [
    ["GK", "Passer", "Libero GK"],
    ["GK", "Cover", "Sweeper Keeper"],
    ["GK", "Commander", "Comandante"],
    ["GK", "Target", "Shotstopper"],
  ],
  CD: [
    ["Passer", "Cover", "Libero"],
    ["Cover", "Controller", "Sweeper"],
    ["Commander", "Destroyer", "Zagueiro"],
    ["Powerhouse", "Destroyer", "Vorstopper"],
  ],
  WD: [
    ["Passer", "Dribbler", "Lateral"],
    ["Engine", "Cover", "Fluidificante"],
    ["Controller", "Passer", "Invertido"],
    ["Sprinter", "Engine", "Corredor"],
  ],
  DM: [
    ["Passer", "Controller", "Regista"],
    ["Cover", "Destroyer", "Sentinelle"],
    ["Controller", "Cover", "Pivote"],
    ["Powerhouse", "Destroyer", "Volante"],
  ],
  CM: [
    ["Passer", "Creator", "Mezzala"],
    ["Engine", "Cover", "Tuttocampista"],
    ["Controller", "Passer", "Metodista"],
    ["Sprinter", "Engine", "Relayeur"],
  ],
  WM: [
    ["Dribbler", "Passer", "Winger"],
    ["Engine", "Cover", "Tornante"],
    ["Controller", "Cover", "False Winger"],
    ["Sprinter", "Engine", "Shuttler"],
  ],
  AM: [
    ["Dribbler", "Creator", "Trequartista"],
    ["Engine", "Striker", "Seconda Punta"],
    ["Controller", "Creator", "Enganche"],
    ["Sprinter", "Striker", "Boxcrasher"],
  ],
  WF: [
    ["Dribbler", "Sprinter", "Inverted Winger"],
    ["Engine", "Striker", "Raumdeuter"],
    ["Creator", "Dribbler", "Inventor"],
    ["Sprinter", "Striker", "Extremo"],
  ],
  CF: [
    ["Striker", "Dribbler", "Poacher"],
    ["Engine", "Destroyer", "Spearhead"],
    ["Creator", "Controller", "Falso Nove"],
    ["Target", "Powerhouse", "Prima Punta"],
  ],
};
```

Also update the test that checks Seconda Punta disambiguation (lines 115-124) — SP is now AM-only, so remove the CF disambiguation test and replace with a simple AM lookup:

```typescript
  it("finds Seconda Punta in AM", () => {
    const am = getRoleDefinition("Seconda Punta", "AM");
    expect(am).not.toBeNull();
    expect(am!.position).toBe("AM");
  });
```

Add a test for exactly 4 roles per position:

```typescript
  it("every position has exactly 4 roles", () => {
    for (const pos of allPositions) {
      expect(PIPELINE_TACTICAL_ROLES[pos].length).toBe(4);
    }
  });
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd apps/web && npx vitest run tests/role-definitions.test.ts`
Expected: FAIL (old role-definitions.ts doesn't match new test mirror)

- [ ] **Step 3: Rewrite role-definitions.ts**

Replace the full `ROLE_DEFINITIONS` array with the 36 new roles. Add `pillar` and `origin` fields to the interface:

```typescript
export type Pillar = 'technical' | 'tactical' | 'mental' | 'physical';

export interface RoleDefinition {
  name: string;
  position: string;
  pillar: Pillar;
  primaryModel: string;
  secondaryModel: string;
  tooltip: string;
  description: string;
  examples: string;
  origin?: string;
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  // GK
  { name: "Libero GK", position: "GK", pillar: "technical", primaryModel: "GK", secondaryModel: "Passer", tooltip: "Distribution specialist — builds attacks from the back", description: "Distribution specialist who starts attacks from the back with pinpoint passing under pressure.", examples: "Ederson, Ter Stegen", origin: "Italian/English" },
  { name: "Sweeper Keeper", position: "GK", pillar: "tactical", primaryModel: "GK", secondaryModel: "Cover", tooltip: "High line, sweeps behind defence, reads danger early", description: "Plays a high line, sweeps behind the defence, and reads danger before it develops.", examples: "Neuer, Alisson", origin: "English" },
  { name: "Comandante", position: "GK", pillar: "mental", primaryModel: "GK", secondaryModel: "Commander", tooltip: "Organizer — commands the area, marshals the backline", description: "The organizer — commands the penalty area, marshals the backline, and leads by presence and voice.", examples: "Buffon, Casillas, Cech", origin: "Portuguese/Italian" },
  { name: "Shotstopper", position: "GK", pillar: "physical", primaryModel: "GK", secondaryModel: "Target", tooltip: "Reflexes, presence, dominates the six-yard box", description: "Traditional shot-stopper who dominates the six-yard box with reflexes, agility, and physical presence.", examples: "Kahn, Courtois, Onana", origin: "English" },

  // CD
  { name: "Libero", position: "CD", pillar: "technical", primaryModel: "Passer", secondaryModel: "Cover", tooltip: "Ball-playing CB — progressive passing from deep", description: "Ball-playing centre-back who steps into midfield to build attacks and reads danger before it develops.", examples: "Beckenbauer, Stones, Laporte", origin: "Italian" },
  { name: "Sweeper", position: "CD", pillar: "tactical", primaryModel: "Cover", secondaryModel: "Controller", tooltip: "Last man — reads play two moves ahead, covers space", description: "Last man who reads the game and cleans up behind the defensive line with anticipation and positioning.", examples: "Sammer, Hummels, Marquinhos", origin: "English" },
  { name: "Zagueiro", position: "CD", pillar: "mental", primaryModel: "Commander", secondaryModel: "Destroyer", tooltip: "Commanding CB — leads, organizes, sets the defensive tone", description: "Commanding centre-back who leads by example, wins aerial battles, and organises the backline.", examples: "Thiago Silva, Van Dijk, Ramos", origin: "Brazilian" },
  { name: "Vorstopper", position: "CD", pillar: "physical", primaryModel: "Powerhouse", secondaryModel: "Destroyer", tooltip: "Aggressive front-foot defender — wins duels, dominates", description: "Aggressive front stopper who wins duels, presses high, and physically dominates attackers.", examples: "Chiellini, Konate, Rudiger", origin: "German" },

  // WD
  { name: "Lateral", position: "WD", pillar: "technical", primaryModel: "Passer", secondaryModel: "Dribbler", tooltip: "Attacking fullback — crosses, final ball, width", description: "Attacking full-back who bombs forward, delivers crosses, and provides width in the final third.", examples: "TAA, Cafu, Dani Alves", origin: "Portuguese" },
  { name: "Fluidificante", position: "WD", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Cover", tooltip: "Covers full flank in both phases, tireless discipline", description: "The one who makes it fluid — fullback who covers the full flank in both phases with tireless discipline.", examples: "Zanetti, Robertson, Hakimi", origin: "Italian" },
  { name: "Invertido", position: "WD", pillar: "mental", primaryModel: "Controller", secondaryModel: "Passer", tooltip: "Inverted FB — reads when to tuck inside, becomes midfielder", description: "Inverted full-back who tucks inside into midfield to create overloads and control possession.", examples: "Lahm, Cancelo, Rico Lewis", origin: "Spanish" },
  { name: "Corredor", position: "WD", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Engine", tooltip: "Pace-based fullback — explosive in transition", description: "Pace-based full-back who explodes into transition and covers ground with raw speed.", examples: "Walker, Theo Hernandez, Alphonso Davies", origin: "Spanish/Portuguese" },

  // DM
  { name: "Regista", position: "DM", pillar: "technical", primaryModel: "Passer", secondaryModel: "Controller", tooltip: "Deep playmaker — dictates tempo with passing quality", description: "Deep-lying playmaker who dictates tempo from a withdrawn position with vision and precise passing.", examples: "Pirlo, Jorginho, Xabi Alonso", origin: "Italian" },
  { name: "Sentinelle", position: "DM", pillar: "tactical", primaryModel: "Cover", secondaryModel: "Destroyer", tooltip: "Shield — positions, intercepts, guards the gate", description: "Defensive sentinel who sits in front of the back line, breaks up play, and shields the defence.", examples: "Makelele, Casemiro, Fabinho", origin: "French" },
  { name: "Pivote", position: "DM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Cover", tooltip: "Midfield brain — organizes shape, reads everything", description: "The midfield brain — organizes shape, reads everything, and controls tempo through intelligence.", examples: "Busquets, Rodri, Fernandinho", origin: "Spanish" },
  { name: "Volante", position: "DM", pillar: "physical", primaryModel: "Powerhouse", secondaryModel: "Destroyer", tooltip: "Ball-winner — aggressive, physical, disrupts", description: "High-energy defensive midfielder who wins the ball back aggressively and drives forward with it.", examples: "Gattuso, Kante, Caicedo", origin: "Brazilian" },

  // CM
  { name: "Mezzala", position: "CM", pillar: "technical", primaryModel: "Passer", secondaryModel: "Creator", tooltip: "Half-space creator — technical quality between the lines", description: "Half-space specialist who drifts wide to create, arriving late in dangerous positions between the lines.", examples: "Barella, Kovacic, Modric", origin: "Italian" },
  { name: "Tuttocampista", position: "CM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Cover", tooltip: "All-pitch midfielder — covers every blade, arrives in box", description: "Complete midfielder who covers every blade of grass — tackles, passes, scores, and leads.", examples: "Lampard, Gerrard, Bellingham", origin: "Italian" },
  { name: "Metodista", position: "CM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Passer", tooltip: "Orchestrator — controls rhythm with intelligent passing", description: "Methodical midfield conductor who controls the rhythm of play with short, intelligent passing.", examples: "Xavi, Kroos, Pedri", origin: "Italian" },
  { name: "Relayeur", position: "CM", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Engine", tooltip: "Tireless shuttle — pace and power to link phases", description: "Tireless shuttle who links defence to attack, winning the ball and carrying it forward at pace.", examples: "Valverde, Toure, Vidal", origin: "French" },

  // WM
  { name: "Winger", position: "WM", pillar: "technical", primaryModel: "Dribbler", secondaryModel: "Passer", tooltip: "Beats defenders with skill and trickery, delivers from wide", description: "Classic touchline winger who beats defenders with pace and trickery, delivering crosses into the box.", examples: "Garrincha, Figo, Saka", origin: "English" },
  { name: "Tornante", position: "WM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Cover", tooltip: "Full-flank wide mid — works both phases, selfless", description: "The returner — wide midfielder who covers the full flank in both phases with selfless discipline.", examples: "Moses, Kostic, Perisic", origin: "Italian" },
  { name: "False Winger", position: "WM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Cover", tooltip: "Starts wide, drifts inside intelligently to create overloads", description: "Starts wide but drifts inside intelligently, reading the game to create overloads and find space.", examples: "Bernardo Silva, Foden, Kulusevski", origin: "English" },
  { name: "Shuttler", position: "WM", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Engine", tooltip: "Raw pace and stamina to cover the flank end to end", description: "Raw pace and stamina to cover the flank end to end, providing width and direct running.", examples: "Sterling, Sane, Chiesa", origin: "English" },

  // AM
  { name: "Trequartista", position: "AM", pillar: "technical", primaryModel: "Dribbler", secondaryModel: "Creator", tooltip: "Free-roaming 10 — dribbling genius in the final third", description: "Free-roaming number 10 who creates magic in the final third with dribbling, vision, and imagination.", examples: "Baggio, Zidane, Messi", origin: "Italian" },
  { name: "Seconda Punta", position: "AM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Striker", tooltip: "Second striker — reads space, links play through movement", description: "Second striker who reads space between the lines, linking midfield and attack through intelligent movement.", examples: "Del Piero, Griezmann, Firmino", origin: "Italian" },
  { name: "Enganche", position: "AM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Creator", tooltip: "The hook — sees everything, threads impossible passes", description: "The hook — a classic playmaker who stands still, sees everything, and threads passes others can't imagine.", examples: "Riquelme, Dybala, Ozil", origin: "Argentine" },
  { name: "Boxcrasher", position: "AM", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Striker", tooltip: "Dynamic AM who arrives in the box with pace and power", description: "Dynamic attacking midfielder who arrives in the box with pace and power, converting half-chances.", examples: "Havertz, Bruno Fernandes, Ramsey", origin: "English" },

  // WF
  { name: "Inverted Winger", position: "WF", pillar: "technical", primaryModel: "Dribbler", secondaryModel: "Sprinter", tooltip: "Cuts inside on strong foot to shoot or create", description: "Wide attacker who cuts inside onto their stronger foot to shoot or create, combining pace with directness.", examples: "Robben, Salah, Yamal", origin: "English" },
  { name: "Raumdeuter", position: "WF", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Striker", tooltip: "Space interpreter — presses and finds pockets to score", description: "Space interpreter who presses relentlessly and finds pockets of space to score from wide positions.", examples: "Son, Mane", origin: "German" },
  { name: "Inventor", position: "WF", pillar: "mental", primaryModel: "Creator", secondaryModel: "Dribbler", tooltip: "Creates something from nothing — vision from wide", description: "The creator who makes something from nothing, combining vision and dribbling from wide areas.", examples: "Grealish, Neymar", origin: "English" },
  { name: "Extremo", position: "WF", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Striker", tooltip: "Electric pace and power — stretches the defence", description: "Devastating wide forward who uses electric pace and power to stretch defences and score from wide areas.", examples: "Henry, Mbappe, Vinicius Jr", origin: "Portuguese" },

  // CF
  { name: "Poacher", position: "CF", pillar: "technical", primaryModel: "Striker", secondaryModel: "Dribbler", tooltip: "Pure finisher — movement, instinct, clinical in the box", description: "Pure goalscorer who lives in the box — sharp movement, clinical finishing, instinct for where the ball will land.", examples: "Gerd Muller, Inzaghi, Haaland", origin: "English" },
  { name: "Spearhead", position: "CF", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Destroyer", tooltip: "Leads the press from front, relentless work rate", description: "Leads the press from the front with relentless work rate, setting the tempo for the whole team.", examples: "Vardy, Suarez, Werner", origin: "English" },
  { name: "Falso Nove", position: "CF", pillar: "mental", primaryModel: "Creator", secondaryModel: "Controller", tooltip: "False 9 — drops deep, creates, pulls CBs out of shape", description: "False nine who drops deep to create, pulling centre-backs out of position and opening space for runners.", examples: "Messi (2009), Benzema, Firmino", origin: "Spanish" },
  { name: "Prima Punta", position: "CF", pillar: "physical", primaryModel: "Target", secondaryModel: "Powerhouse", tooltip: "Target striker — aerial, holds up, physical reference point", description: "Target striker who holds up the ball, wins aerial duels, and brings teammates into play around the box.", examples: "Toni, Giroud, Lewandowski", origin: "Italian" },
];
```

Update `getRoleDefinition` to return the new interface (function signature stays the same, just the return type is richer).

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd apps/web && npx vitest run tests/role-definitions.test.ts`
Expected: PASS (all 36 roles have definitions, radar config will fail — that's Task 4)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/role-definitions.ts apps/web/tests/role-definitions.test.ts
git commit -m "feat(roles): update role-definitions.ts and tests for 36-role taxonomy"
```

---

### Task 4: Update role-radar.ts

**Files:**
- Modify: `apps/web/src/lib/role-radar.ts:20-68`

- [ ] **Step 1: Replace ROLE_RADAR_AXES with new 36 roles**

Each role gets 4-5 models ordered by relevance (primary first, secondary second, then supporting models):

```typescript
export const ROLE_RADAR_AXES: Record<string, RoleRadarConfig> = {
  // ── GK ──
  "Libero GK":       { models: ["GK", "Passer", "Controller", "Cover"],                labels: [] },
  "Sweeper Keeper":  { models: ["GK", "Cover", "Controller", "Passer"],                labels: [] },
  "Comandante":      { models: ["GK", "Commander", "Cover", "Controller"],              labels: [] },
  "Shotstopper":     { models: ["GK", "Target", "Cover", "Commander"],                  labels: [] },

  // ── CD ──
  "Libero":          { models: ["Passer", "Cover", "Controller", "Dribbler"],           labels: [] },
  "Sweeper":         { models: ["Cover", "Controller", "Commander", "Passer"],          labels: [] },
  "Zagueiro":        { models: ["Commander", "Destroyer", "Cover", "Powerhouse"],       labels: [] },
  "Vorstopper":      { models: ["Powerhouse", "Destroyer", "Cover", "Commander"],       labels: [] },

  // ── WD ──
  "Lateral":         { models: ["Passer", "Dribbler", "Engine", "Sprinter"],            labels: [] },
  "Fluidificante":   { models: ["Engine", "Cover", "Sprinter", "Destroyer"],            labels: [] },
  "Invertido":       { models: ["Controller", "Passer", "Cover", "Dribbler"],           labels: [] },
  "Corredor":        { models: ["Sprinter", "Engine", "Cover", "Dribbler"],             labels: [] },

  // ── DM ──
  "Regista":         { models: ["Passer", "Controller", "Creator", "Cover"],            labels: [] },
  "Sentinelle":      { models: ["Cover", "Destroyer", "Controller", "Commander"],       labels: [] },
  "Pivote":          { models: ["Controller", "Cover", "Passer", "Commander"],          labels: [] },
  "Volante":         { models: ["Powerhouse", "Destroyer", "Engine", "Cover"],          labels: [] },

  // ── CM ──
  "Mezzala":         { models: ["Passer", "Creator", "Dribbler", "Engine"],             labels: [] },
  "Tuttocampista":   { models: ["Engine", "Cover", "Destroyer", "Powerhouse", "Sprinter"], labels: [] },
  "Metodista":       { models: ["Controller", "Passer", "Creator", "Cover"],            labels: [] },
  "Relayeur":        { models: ["Sprinter", "Engine", "Passer", "Cover"],               labels: [] },

  // ── WM ──
  "Winger":          { models: ["Dribbler", "Passer", "Sprinter", "Engine"],            labels: [] },
  "Tornante":        { models: ["Engine", "Cover", "Sprinter", "Destroyer"],            labels: [] },
  "False Winger":    { models: ["Controller", "Cover", "Passer", "Dribbler"],           labels: [] },
  "Shuttler":        { models: ["Sprinter", "Engine", "Dribbler", "Cover"],             labels: [] },

  // ── AM ──
  "Trequartista":    { models: ["Dribbler", "Creator", "Controller", "Striker"],        labels: [] },
  "Seconda Punta":   { models: ["Engine", "Striker", "Sprinter", "Creator"],            labels: [] },
  "Enganche":        { models: ["Controller", "Creator", "Passer", "Dribbler"],         labels: [] },
  "Boxcrasher":      { models: ["Sprinter", "Striker", "Engine", "Dribbler"],           labels: [] },

  // ── WF ──
  "Inverted Winger":  { models: ["Dribbler", "Sprinter", "Striker", "Creator"],          labels: [] },
  "Raumdeuter":      { models: ["Engine", "Striker", "Cover", "Dribbler"],              labels: [] },
  "Inventor":        { models: ["Creator", "Dribbler", "Passer", "Sprinter"],           labels: [] },
  "Extremo":         { models: ["Sprinter", "Striker", "Dribbler", "Creator"],          labels: [] },

  // ── CF ──
  "Poacher":         { models: ["Striker", "Dribbler", "Sprinter", "Target"],           labels: [] },
  "Spearhead":       { models: ["Engine", "Destroyer", "Striker", "Sprinter"],          labels: [] },
  "Falso Nove":      { models: ["Creator", "Controller", "Dribbler", "Striker"],        labels: [] },
  "Prima Punta":     { models: ["Target", "Powerhouse", "Striker", "Commander"],        labels: [] },
};
```

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npx vitest run tests/role-definitions.test.ts`
Expected: PASS (all 36 roles now have radar axes)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/role-radar.ts
git commit -m "feat(roles): update ROLE_RADAR_AXES for 36-role taxonomy"
```

---

### Task 5: Update RoleScoreEditor component

**Files:**
- Modify: `apps/web/src/components/RoleScoreEditor.tsx:8-28`

- [ ] **Step 1: Replace the hardcoded TACTICAL_ROLES array**

```typescript
const TACTICAL_ROLES = [
  "",
  // GK
  "Libero GK", "Sweeper Keeper", "Comandante", "Shotstopper",
  // CD
  "Libero", "Vorstopper", "Sweeper", "Zagueiro",
  // WD
  "Lateral", "Fluidificante", "Invertido", "Corredor",
  // DM
  "Regista", "Sentinelle", "Pivote", "Volante",
  // CM
  "Mezzala", "Tuttocampista", "Metodista", "Relayeur",
  // WM
  "Winger", "Tornante", "False Winger", "Shuttler",
  // AM
  "Trequartista", "Seconda Punta", "Enganche", "Boxcrasher",
  // WF
  "Inverted Winger", "Raumdeuter", "Inventor", "Extremo",
  // CF
  "Poacher", "Spearhead", "Falso Nove", "Prima Punta",
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/RoleScoreEditor.tsx
git commit -m "feat(roles): update RoleScoreEditor for 36-role taxonomy"
```

---

### Task 6: Update valuation/ratings.ts and compare API route

**Files:**
- Modify: `apps/web/src/lib/valuation/ratings.ts:34-44`
- Modify: `apps/web/src/app/api/players/compare/route.ts:7-17`

These two files have their own hardcoded TACTICAL_ROLES that are already out of sync with the pipeline. Replace both with the new taxonomy.

- [ ] **Step 1: Replace TACTICAL_ROLES in ratings.ts (lines 34-44)**

```typescript
const TACTICAL_ROLES: Record<string, [string, string, string][]> = {
  GK: [["GK", "Passer", "Libero GK"], ["GK", "Cover", "Sweeper Keeper"], ["GK", "Commander", "Comandante"], ["GK", "Target", "Shotstopper"]],
  CD: [["Passer", "Cover", "Libero"], ["Cover", "Controller", "Sweeper"], ["Commander", "Destroyer", "Zagueiro"], ["Powerhouse", "Destroyer", "Vorstopper"]],
  WD: [["Passer", "Dribbler", "Lateral"], ["Engine", "Cover", "Fluidificante"], ["Controller", "Passer", "Invertido"], ["Sprinter", "Engine", "Corredor"]],
  DM: [["Passer", "Controller", "Regista"], ["Cover", "Destroyer", "Sentinelle"], ["Controller", "Cover", "Pivote"], ["Powerhouse", "Destroyer", "Volante"]],
  CM: [["Passer", "Creator", "Mezzala"], ["Engine", "Cover", "Tuttocampista"], ["Controller", "Passer", "Metodista"], ["Sprinter", "Engine", "Relayeur"]],
  WM: [["Dribbler", "Passer", "Winger"], ["Engine", "Cover", "Tornante"], ["Controller", "Cover", "False Winger"], ["Sprinter", "Engine", "Shuttler"]],
  AM: [["Dribbler", "Creator", "Trequartista"], ["Engine", "Striker", "Seconda Punta"], ["Controller", "Creator", "Enganche"], ["Sprinter", "Striker", "Boxcrasher"]],
  WF: [["Dribbler", "Sprinter", "Inverted Winger"], ["Engine", "Striker", "Raumdeuter"], ["Creator", "Dribbler", "Inventor"], ["Sprinter", "Striker", "Extremo"]],
  CF: [["Striker", "Dribbler", "Poacher"], ["Engine", "Destroyer", "Spearhead"], ["Creator", "Controller", "Falso Nove"], ["Target", "Powerhouse", "Prima Punta"]],
};
```

- [ ] **Step 2: Replace TACTICAL_ROLES in compare/route.ts (lines 7-17)**

Same data as above (identical tuple format).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/valuation/ratings.ts apps/web/src/app/api/players/compare/route.ts
git commit -m "feat(roles): sync ratings.ts and compare API with 36-role taxonomy"
```

---

### Task 7: Update formation-intelligence.ts

**Files:**
- Modify: `apps/web/src/lib/formation-intelligence.ts:34-448`

- [ ] **Step 1: Audit current ROLE_INTELLIGENCE entries**

Read lines 34-448 and map every key. Many use OLD names (Shot Stopper, Ball-Playing CB, Overlapping FB, etc.). Each key must be renamed to match the new 36 role names.

Mapping for renaming keys:
- `"Shot Stopper"` → `"Shotstopper"`
- `"Sweeper Keeper"` → keep
- `"Ball-Playing CB"` / `"Libero"` → `"Libero"` (check if both exist, merge)
- `"Stopper"` / `"Vorstopper"` → `"Vorstopper"`
- `"Overlapping FB"` → `"Lateral"`
- `"Inverted FB"` → `"Invertido"`
- `"Wing-Back"` → split to `"Fluidificante"` + `"Corredor"`
- `"Anchor"` → `"Sentinelle"`
- `"Ball Winner"` → `"Volante"`
- `"Deep Playmaker"` → `"Metodista"`
- `"Box-to-Box"` → `"Tuttocampista"`
- `"Wide Playmaker"` → `"Winger"` or `"False Winger"` (check description)
- `"Traditional Winger"` → `"Winger"` or `"Shuttler"`
- `"Advanced Playmaker"` → `"Enganche"`
- `"Shadow Striker"` → `"Boxcrasher"` or `"Seconda Punta"`
- `"Inverted Winger"` → `"Inventor"`
- `"Wide Forward"` → `"Extremo"`
- `"Inverted Winger"` → keep (if at WF)
- `"Target Man"` → `"Prima Punta"`
- `"Complete Forward"` → remove (role dropped)
- `"False 9"` → `"Falso Nove"`
- `"Deep-Lying Forward"` → remove (role dropped)

Add new entries for roles that don't exist yet:
- `"Libero GK"`, `"Comandante"`, `"Corredor"`, `"Pivote"`, `"Tornante"`, `"False Winger"`, `"Shuttler"`, `"Seconda Punta"` (AM tactical), `"Boxcrasher"`, `"Raumdeuter"` (WF tactical), `"Inventor"`, `"Spearhead"`

Each entry needs: archetypes, personalities, minLevel, positions, keyAttributes, reference.

- [ ] **Step 2: Rename and add all ROLE_INTELLIGENCE entries**

This is the largest single change. Work through systematically by position. For each new role, the `archetypes` array should lead with `[primaryModel, secondaryModel, ...]` and the `reference` should use the exemplars from the spec.

- [ ] **Step 3: Run the dev server and spot-check**

Run: `cd apps/web && npm run dev`
Navigate to `/tactics` page and verify roles render correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/formation-intelligence.ts
git commit -m "feat(roles): update ROLE_INTELLIGENCE for 36-role taxonomy"
```

---

### Task 8: Update SACROSANCT.md

**Files:**
- Modify: `docs/systems/SACROSANCT.md:193-254`

- [ ] **Step 1: Replace the System 4 tactical roles section**

Replace the role table (lines 203-237) with the new 36-role table from the spec. Add the pillar alignment principle and the GK exception note. Update the naming conventions section.

Key changes:
- Table now has a `Pillar` column
- 36 rows instead of 33
- Role fit scoring formula unchanged
- Add note: "For GK, the secondary model determines pillar alignment since the GK specialist model is always primary."

- [ ] **Step 2: Commit**

```bash
git add docs/systems/SACROSANCT.md
git commit -m "docs: update SACROSANCT System 4 for 36-role four-pillar taxonomy"
```

---

### Task 9: Run migration and recompute best_role

**Files:**
- Run: `pipeline/sql/043_role_redesign.sql`
- Run: `pipeline/27_player_ratings.py`

- [ ] **Step 1: Run the SQL migration**

Run: `cd pipeline && python -c "
from config import get_supabase
sb = get_supabase()
with open('sql/043_role_redesign.sql') as f:
    sql = f.read()
sb.postgrest.rpc('exec_sql', {'query': sql}).execute()
"`

Or via psql if available:
`psql "$POSTGRES_DSN" -f pipeline/sql/043_role_redesign.sql`

- [ ] **Step 2: Verify migration — count roles**

Run: `cd pipeline && python -c "
from config import get_supabase
sb = get_supabase()
roles = sb.table('tactical_roles').select('name, position, pillar').execute()
print(f'{len(roles.data)} roles')
for r in sorted(roles.data, key=lambda x: x['position']):
    print(f\"  {r['position']:3s} {r['pillar']:10s} {r['name']}\")
"`

Expected: 36 roles, 4 per position, each with a pillar value.

- [ ] **Step 3: Run script 27 to recompute best_role**

Run: `cd pipeline && python 27_player_ratings.py --dry-run`
Check output for reasonable role distributions.

Then: `cd pipeline && python 27_player_ratings.py`

- [ ] **Step 4: Verify role distribution**

Run: `cd pipeline && python -c "
from config import get_supabase
sb = get_supabase()
from collections import Counter
profiles = sb.table('player_profiles').select('best_role').not_.is_('best_role', 'null').execute()
counts = Counter(r['best_role'] for r in profiles.data)
for role, count in counts.most_common():
    print(f'  {count:5d} {role}')
print(f'Total: {len(profiles.data)} players with roles')
"`

Expected: All 36 role names appear. No old role names. No single role should have >40% of players at a position.

- [ ] **Step 5: Commit any pipeline adjustments**

```bash
git add -A
git commit -m "feat(roles): run migration 043, recompute best_role for all players"
```

---

### Task 10: Run full test suite and verify

**Files:**
- Run: `apps/web/tests/`

- [ ] **Step 1: Run all tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass. Watch specifically for:
- `role-definitions.test.ts` — all 36 roles synced
- Any test referencing old role names (Complete Forward, Carrilero, Torwart, etc.)

- [ ] **Step 2: Fix any failing tests**

Search for old role names in test files:
- `grep -r "Torwart\|Carrilero\|Ball-Playing GK\|Complete Forward\|Inverted Winger\|Fantasista" apps/web/tests/`

Update any matches to use new role names.

- [ ] **Step 3: Spot-check UI pages**

Run dev server: `cd apps/web && npm run dev`
Check:
- `/players/[id]` — best_role displays with tooltip
- `/tactics` — all 36 roles appear grouped by position
- `/formations` — role assignments work
- Player comparison — role scoring uses new names

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(roles): update remaining test references for 36-role taxonomy"
```
