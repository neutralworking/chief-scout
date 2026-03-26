# Tactical Role Redesign — Four-Pillar Alignment

**Date**: 2026-03-23
**Status**: Approved (design phase)
**Owner**: PO-Database

## Summary

Restructure the tactical role system from a variable-count, inconsistently-named set of 45 roles to a clean **36-role taxonomy**: exactly 4 roles per position, each mapping to superiority in one of the four pillars (Technical, Tactical, Mental, Physical).

## Design Principle

Each role's **primary archetype model** determines its pillar alignment:

| Pillar | Color | Model Category | The role rewards... |
|--------|-------|----------------|---------------------|
| **Technical** | Gold | Dribbler, Passer, Striker | Ball mastery, passing quality, finishing |
| **Tactical** | Purple | Cover, Engine, Destroyer | Positioning, pressing, defensive discipline |
| **Mental** | Green | Controller, Commander, Creator | Game-reading, leadership, creative vision |
| **Physical** | Blue | Target, Sprinter, Powerhouse | Pace, aerial presence, physical dominance |

**GK exception**: The specialist GK model is always primary. The **secondary** model determines pillar alignment for goalkeeper roles.

## The 36 Roles

### GK

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Libero GK** | GK | Passer | Distribution specialist — builds attacks from the back | Ederson, Ter Stegen |
| Tactical | **Sweeper Keeper** | GK | Cover | High line, sweeps behind defence, reads danger early | Neuer, Alisson |
| Mental | **Comandante** | GK | Commander | Organizer — commands the area, marshals the backline | Buffon, Casillas, Cech |
| Physical | **Shotstopper** | GK | Target | Reflexes, presence, dominates the six-yard box | Kahn, Courtois, Onana |

### CD

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Libero** | Passer | Cover | Ball-playing CB — progressive passing from deep | Beckenbauer, Stones, Laporte |
| Tactical | **Sweeper** | Cover | Controller | Last man — reads play two moves ahead, covers space | Sammer, Hummels, Marquinhos |
| Mental | **Zagueiro** | Commander | Destroyer | Commanding CB — leads, organizes, sets the defensive tone | Thiago Silva, Van Dijk, Ramos |
| Physical | **Vorstopper** | Powerhouse | Destroyer | Aggressive front-foot defender — wins duels, dominates | Chiellini, Konate, Rudiger |

### WD

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Lateral** | Passer | Dribbler | Attacking fullback — crosses, final ball, width | TAA, Cafu, Dani Alves |
| Tactical | **Fluidificante** | Engine | Cover | Covers full flank in both phases, tireless discipline | Zanetti, Robertson, Hakimi |
| Mental | **Invertido** | Controller | Passer | Inverted FB — reads when to tuck inside, becomes midfielder | Lahm, Cancelo, Rico Lewis |
| Physical | **Corredor** | Sprinter | Engine | Pace-based fullback — explosive in transition | Walker, Theo Hernandez, Alphonso Davies |

### DM

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Regista** | Passer | Controller | Deep playmaker — dictates tempo with passing quality | Pirlo, Jorginho, Xabi Alonso |
| Tactical | **Sentinelle** | Cover | Destroyer | Shield — positions, intercepts, guards the gate | Makelele, Casemiro, Fabinho |
| Mental | **Pivote** | Controller | Cover | Midfield brain — organizes shape, reads everything | Busquets, Rodri, Fernandinho |
| Physical | **Volante** | Powerhouse | Destroyer | Ball-winner — aggressive, physical, disrupts | Gattuso, Kante, Caicedo |

### CM

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Mezzala** | Passer | Creator | Half-space creator — technical quality between the lines | Barella, Kovacic, Modric |
| Tactical | **Tuttocampista** | Engine | Cover | All-pitch midfielder — covers every blade, arrives in box | Lampard, Gerrard, Bellingham |
| Mental | **Metodista** | Controller | Passer | Orchestrator — controls rhythm with intelligent passing | Xavi, Kroos, Pedri |
| Physical | **Relayeur** | Sprinter | Engine | Tireless shuttle — pace and power to link phases | Valverde, Toure, Vidal |

### WM

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Winger** | Dribbler | Passer | Beats defenders with skill and trickery, delivers from wide | Garrincha, Figo, Saka |
| Tactical | **Tornante** | Engine | Cover | Full-flank wide mid — works both phases, selfless | Moses, Kostic, Perisic |
| Mental | **False Winger** | Controller | Cover | Starts wide, drifts inside intelligently to create overloads | Bernardo Silva, Foden, Kulusevski |
| Physical | **Shuttler** | Sprinter | Engine | Raw pace and stamina to cover the flank end to end | Sterling, Sane, Chiesa |

### AM

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Trequartista** | Dribbler | Creator | Free-roaming 10 — dribbling genius in the final third | Baggio, Zidane, Messi |
| Tactical | **Seconda Punta** | Engine | Striker | Second striker — reads space, links play through movement | Del Piero, Griezmann, Firmino |
| Mental | **Enganche** | Controller | Creator | The hook — sees everything, threads impossible passes | Riquelme, Dybala, Ozil |
| Physical | **Boxcrasher** | Sprinter | Striker | Dynamic AM who arrives in the box with pace and power | Havertz, Bruno Fernandes, Ramsey |

### WF

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Inside Forward** | Dribbler | Sprinter | Cuts inside on strong foot to shoot or create | Robben, Salah, Yamal |
| Tactical | **Raumdeuter** | Engine | Striker | Space interpreter — presses and finds pockets to score | Son, Muller (wide), Mane |
| Mental | **Inventor** | Creator | Dribbler | Creates something from nothing — vision from wide | Grealish, Neymar |
| Physical | **Extremo** | Sprinter | Striker | Electric pace and power — stretches the defence | Henry, Mbappe, Vinicius Jr |

### CF

| Pillar | Role | Primary | Secondary | Tooltip | Exemplars |
|--------|------|---------|-----------|---------|-----------|
| Technical | **Poacher** | Striker | Dribbler | Pure finisher — movement, instinct, clinical in the box | Gerd Muller, Inzaghi, Haaland |
| Tactical | **Spearhead** | Engine | Destroyer | Leads the press from front, relentless work rate | Vardy, Suarez, Werner |
| Mental | **Falso Nove** | Creator | Controller | False 9 — drops deep, creates, pulls CBs out of shape | Messi (2009), Benzema, Firmino |
| Physical | **Prima Punta** | Target | Powerhouse | Target striker — aerial, holds up, physical reference point | Toni, Giroud, Lewandowski |

## Changes From Current System

### Renamed Roles

| Old Name | New Name | Position | Reason |
|----------|----------|----------|--------|
| Torwart | Shotstopper | GK | Torwart just means "goalkeeper" in German — not a distinct role concept |
| Ball-Playing GK | Libero GK | GK | Better communicates the playmaking CB-like quality |
| Pressing Forward | Spearhead | CF | More evocative, less compound |
| Inverted Winger | Inventor | WF | Captures the creative mental quality, not the physical inversion |
| Carrilero | Fluidificante | WD | SACROSANCT already made this change; pipeline was out of sync |
| Fantasista | *(removed)* | WM | More of an archetype than a positional role |

### New Roles

| Role | Position | Pillar | Why |
|------|----------|--------|-----|
| Comandante | GK | Mental | Fills the organizing GK archetype (Buffon, Casillas) |
| Corredor | WD | Physical | The pace-based fullback — distinct from Fluidificante's workrate |
| Pivote | DM | Mental | The organizing DM (Busquets, Rodri) — distinct from Regista's passing |
| False Winger | WM | Mental | The intelligent drifter who tucks inside to create overloads |
| Shuttler | WM | Physical | Raw pace and stamina from wide |
| Boxcrasher | AM | Physical | The dynamic AM who arrives in the box |
| Raumdeuter | WF | Tactical | Moved from WM — space interpretation is tactical awareness |
| Tornante | WM | Tactical | Was in SACROSANCT but not pipeline; the disciplined flank-coverer |
| Incursore | *(dropped)* | — | Replaced by Seconda Punta at AM Tactical |
| Cacciatore | *(dropped)* | — | Replaced by Raumdeuter at WF Tactical |
| Mediapunta | *(dropped)* | — | Never shipped; replaced by Seconda Punta |

### Dropped Roles

| Role | Position | Reason |
|------|----------|--------|
| Complete Forward | CF | "Complete" contradicts pillar-specialization by definition |
| Seconda Punta | CF | Moved to AM only — no cross-position duplication |
| Direct Winger | WF | Migration 031 addition; replaced by Extremo |
| Ball-Carrying CB | CD | Migration 031 addition; covered by Libero |
| Destroyer-Creator | DM | Migration 031 compound name; doesn't fit naming convention |
| Anchor | DM | Covered by Sentinelle and Pivote |
| Ball-Winner | DM | Covered by Volante |
| Fantasista | WM | Archetype, not a role |

### Model Re-Pairings

Several existing roles swap primary/secondary to align primary with pillar category:

| Role | Old Pairing | New Pairing | Reason |
|------|-------------|-------------|--------|
| Libero GK (GK) | GK / Controller | GK / Passer | Technical alignment (Passer is Technical) |
| Libero (CD) | Cover / Passer | Passer / Cover | Technical alignment (Passer is Technical) |
| Zagueiro (CD) | Destroyer / Commander | Commander / Destroyer | Mental alignment (Commander is Mental) |
| Vorstopper (CD) | Destroyer / Powerhouse | Powerhouse / Destroyer | Physical alignment (Powerhouse is Physical) |
| Lateral (WD) | Engine / Dribbler | Passer / Dribbler | Technical alignment (Passer is Technical) |
| Regista (DM) | Controller / Passer | Passer / Controller | Technical alignment (Passer is Technical) |
| Relayeur (CM) | Engine / Destroyer | Sprinter / Engine | Physical alignment (Sprinter is Physical) |
| Winger (WM) | Sprinter / Passer | Dribbler / Passer | Technical alignment (Dribbler is Technical) |
| Trequartista (AM) | Creator / Dribbler | Dribbler / Creator | Technical alignment (Dribbler is Technical) |
| Raumdeuter (WF) | Dribbler / Striker | Engine / Striker | Tactical alignment at new position |
| Seconda Punta (AM) | Dribbler / Striker | Engine / Striker | Tactical alignment at new position |
| Poacher (CF) | Striker / Sprinter | Striker / Dribbler | Secondary change for closer finishing affinity |

## Tooltip System

Every role surfaces three display layers:

1. **Name** — the cultural/coined term (Regista, Pivote, Boxcrasher)
2. **Tooltip** — 10-15 word English description, shown on hover/tap
3. **Full description** — paragraph with lineage, exemplars, and playing style (detail views)

### Implementation

```typescript
export interface RoleDefinition {
  name: string;
  position: string;          // GK, CD, WD, DM, CM, WM, AM, WF, CF
  pillar: 'technical' | 'tactical' | 'mental' | 'physical';
  primaryModel: string;      // From the 13 archetype models
  secondaryModel: string;
  tooltip: string;           // Short English description (10-15 words)
  description: string;       // Full description with context
  examples: string;          // Comma-separated exemplar names
  origin?: string;           // Language/culture of origin (for i18n context)
}
```

Structured for future i18n: names are keys, tooltips and descriptions are localizable strings. The `origin` field helps translators understand the cultural context when localizing.

### Display Rules

| Context | Shows |
|---------|-------|
| Player card | Role name + pillar color dot |
| Player card hover | Tooltip |
| Player detail page | Full description + exemplars + pillar badge |
| Formation slot | Role name + tooltip |
| Tactics browser | All roles by position, grouped by pillar, full descriptions |
| Editor | Role name dropdown with tooltips |

## Role Fit Scoring

The scoring algorithm remains the same — only the role definitions and model pairings change:

```
role_fit = (primary_model_score × 0.6) + (secondary_model_score × 0.4)
```

Normalized to 0-99. The primary model carries 60% weight, ensuring pillar-aligned players score highest for their pillar's role.

For GK roles, the formula uses the GK model score as a baseline gate (must be > 0), then scores on secondary/tertiary models.

## Impact Assessment

### Files to Update

| File | Change |
|------|--------|
| `pipeline/27_player_ratings.py` | Replace `TACTICAL_ROLES` dict with new 36-role taxonomy |
| `pipeline/sql/018_tactical_roles.sql` | Reseed `tactical_roles` table (or new migration) |
| `apps/web/src/lib/role-definitions.ts` | Replace `ROLE_DEFINITIONS` array |
| `apps/web/src/lib/formation-intelligence.ts` | Update `ROLE_INTELLIGENCE` dict |
| `apps/web/src/lib/role-radar.ts` | Update `ROLE_RADAR_AXES` |
| `apps/web/src/components/RoleScoreEditor.tsx` | Update `TACTICAL_ROLES` array |
| `apps/web/src/app/api/players/compare/route.ts` | Update role list |
| `apps/web/tests/role-definitions.test.ts` | Update `PIPELINE_TACTICAL_ROLES` mirror |
| `docs/systems/SACROSANCT.md` | Replace System 4 (Tactical Roles) section |

### Database Migration

New migration required:

1. Add `pillar` column to `tactical_roles` (enum: technical, tactical, mental, physical)
2. DELETE all existing rows from `tactical_roles`, INSERT 36 new roles with position, description, primary/secondary archetype, pillar
3. Update `player_profiles.best_role` — map old role names to new:
   - Torwart → Shotstopper
   - Ball-Playing GK → Libero GK
   - Carrilero → Fluidificante (for WD) or Corredor (needs position context)
   - Inverted Winger → Inventor
   - Fantasista → False Winger (for WM players)
   - Complete Forward → Poacher (best approximation)
   - Pressing Forward → Spearhead (CF) or Raumdeuter (WF)
4. Recompute `best_role` and `best_role_score` for all players via pipeline script 27

### Data Migration Edge Cases

- **Seconda Punta in CF** → Needs position-aware remapping. CF Seconda Punta players should be reassigned by the scoring algorithm (likely Poacher or Falso Nove).
- **Complete Forward** → No direct equivalent. Recompute from model scores.
- **Players with old migration-031 roles** (Ball-Carrying CB, Direct Winger, etc.) → Recompute from model scores.

### Pipeline Re-Run

After migration, a full re-run of script 27 (`player_ratings.py`) recomputes `best_role` and `best_role_score` for all ~21,000 players using the new role definitions. This is the cleanest approach — no manual mapping needed beyond the SQL migration for the `tactical_roles` table itself.

## Verification

After implementation:

1. **Role distribution** — Query `player_profiles.best_role` grouped by role. No role should have 0 players. Distribution should roughly match position populations.
2. **Pillar balance** — Within each position, the 4 roles should have meaningful population spread. If 90% of CDs are Vorstopper, the model pairings need tuning.
3. **Exemplar validation** — Spot-check that named exemplars (where they exist in the DB) score highest for their expected role.
4. **UI sync test** — `role-definitions.test.ts` must pass, verifying pipeline roles match UI definitions.
5. **Tooltip coverage** — Every role has a non-empty tooltip and description.

## Open Items

- **Shuttler (WM Physical)** — Placeholder name. May want a cultural term in future. Functional for now.
- **Boxcrasher (AM Physical)** — Coined term, not established football vocabulary. Vivid and clear. Keep or revisit.
- **Localisation** — Role names are keys. Tooltip/description strings structured for future i18n. No immediate action needed.
