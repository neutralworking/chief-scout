# Systems & Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat tactical_roles table with a philosophy > system > slot > role hierarchy, moving from 36 hardcoded roles to 41 system-validated roles.

**Architecture:** Three new tables (tactical_systems, system_slots, slot_roles) sit between tactical_philosophies and players. Pipeline 83 seeds the hierarchy; pipeline 27 queries slot_roles for valid role candidates instead of a hardcoded Python dict. Frontend reads from the new tables.

**Tech Stack:** Supabase (PostgreSQL), Python pipeline scripts, Next.js/TypeScript frontend

**Spec:** `docs/superpowers/specs/2026-03-29-systems-and-roles-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `pipeline/sql/049_systems_and_roles.sql` | DDL for 3 new tables + indexes + RLS |
| Rewrite | `pipeline/83_seed_philosophies.py` | Seed full hierarchy: philosophies (rename 2) + 28 systems + slots + 41 roles |
| Modify | `pipeline/27_player_ratings.py:132-189` | Replace `TACTICAL_ROLES` dict with DB query from `slot_roles` |
| Modify | `pipeline/tests/test_player_ratings.py` | Update role names/compounds in test assertions |
| Rewrite | `apps/web/src/lib/formation-intelligence.ts` | 41 roles with new names, compounds, intelligence |
| Modify | `apps/web/src/lib/tactical-philosophies.ts` | Add System/SlotRole TS interfaces |
| Modify | `apps/web/src/app/tactics/page.tsx` | Query tactical_systems + slot_roles instead of tactical_roles |
| Modify | `apps/web/src/app/tactics/[slug]/page.tsx` | Show systems with formation + slot roles on philosophy detail |
| Modify | `apps/web/src/components/TacticsPage.tsx` | Accept new data shape (systems instead of flat roles) |
| Modify | `apps/web/src/components/PhilosophyDetail.tsx` | Render systems with pitch view and slot roles |
| Modify | `docs/systems/SACROSANCT.md` | Update System 4 (Tactical Roles) for 41-role taxonomy |

---

## Reference: The 41 Roles

| # | Role | Position | Primary | Secondary |
|---|------|----------|---------|-----------|
| 1 | Comandante | GK | GK | Commander |
| 2 | Sweeper Keeper | GK | GK | Cover |
| 3 | Distributor | GK | GK | Passer |
| 4 | Shotstopper | GK | GK | Powerhouse |
| 5 | Centrale | CD | Commander | Destroyer |
| 6 | Distributor | CD | Passer | Cover |
| 7 | Stopper | CD | Powerhouse | Destroyer |
| 8 | Sweeper | CD | Cover | Controller |
| 9 | Colossus | CD | Target | Powerhouse |
| 10 | Fullback | WD | Engine | Passer |
| 11 | Wing-back | WD | Engine | Dribbler |
| 12 | Corner Back | WD | Cover | Destroyer |
| 13 | Invertido | WD | Controller | Passer |
| 14 | Regista | DM | Passer | Controller |
| 15 | Pivote | DM | Controller | Cover |
| 16 | Anchor | DM | Cover | Destroyer |
| 17 | Ball Winner | DM | Engine | Destroyer |
| 18 | Segundo Volante | DM | Powerhouse | Engine |
| 19 | Playmaker | CM | Passer | Creator |
| 20 | Metodista | CM | Controller | Passer |
| 21 | Mezzala | CM | Engine | Creator |
| 22 | Tuttocampista | CM | Engine | Cover |
| 23 | Winger | WM | Dribbler | Passer |
| 24 | Tornante | WM | Engine | Cover |
| 25 | False Winger | WM | Controller | Creator |
| 26 | Wide Playmaker | WM | Creator | Passer |
| 27 | Trequartista | AM | Dribbler | Creator |
| 28 | Enganche | AM | Creator | Controller |
| 29 | Boxcrasher | AM | Sprinter | Striker |
| 30 | Inverted Winger | WF | Dribbler | Striker |
| 31 | Raumdeuter | WF | Engine | Striker |
| 32 | Winger | WF | Dribbler | Passer |
| 33 | Wide Playmaker | WF | Creator | Passer |
| 34 | Wide Target Forward | WF | Target | Powerhouse |
| 35 | Poacher | CF | Striker | Engine |
| 36 | Complete Forward | CF | Striker | Creator |
| 37 | Falso Nove | CF | Creator | Controller |
| 38 | Spearhead | CF | Engine | Striker |
| 39 | Target Forward | CF | Target | Powerhouse |
| 40 | Seconda Punta | CF | Creator | Striker |
| 41 | Shadow Striker | CF | Sprinter | Striker |

Note: "Distributor" appears at both GK and CD (different compounds). "Winger" appears at both WM and WF (same compound). "Wide Playmaker" appears at both WM and WF (same compound). Differentiated by position in the query.

---

## Reference: The 28 Systems (Slot-Role Assignments)

Each system defines a formation with named slots. Each slot has a position (from the 9-position enum) and a default role plus optional alternatives. **Every role from the 41-role set must appear in at least one slot across all systems.**

Format: `SlotLabel(Position): DefaultRole [, AltRole, ...]`

### 1. Garra Charrua

**La Celeste** (4-4-2) — Uruguay 1950/2010 — "Spirit and sacrifice define the team"
```
GK(GK): Comandante
LCB(CD): Centrale, RCB(CD): Stopper
LB(WD): Corner Back, RB(WD): Fullback
LM(WM): Tornante, RM(WM): Winger
LCM(DM): Anchor, RCM(CM): Tuttocampista
LF(CF): Target Forward, RF(CF): Spearhead
```

**Muralla** (5-4-1) — Tabarez Uruguay 2018 — "The wall — five-man defensive block"
```
GK(GK): Comandante
LCB(CD): Stopper, CCB(CD): Centrale, RCB(CD): Sweeper
LWB(WD): Corner Back, RWB(WD): Corner Back
LM(WM): Tornante, RM(WM): Winger
LCM(DM): Anchor, RCM(CM): Tuttocampista
CF(CF): Target Forward
```

### 2. Catenaccio

**Grande Inter** (5-3-2) — Herrera's Inter 1963-66 — "Lock the door, then counter with precision"
```
GK(GK): Shotstopper
LCB(CD): Stopper, CCB(CD): Sweeper, RCB(CD): Stopper
LWB(WD): Wing-back, RWB(WD): Wing-back
LCM(CM): Metodista, CDM(DM): Anchor, RCM(CM): Mezzala
LF(CF): Seconda Punta, RF(CF): Poacher
```

**Trincea** (4-5-1) — Capello's Milan / Allegri's Juve — "Trench warfare, disciplined low block"
```
GK(GK): Shotstopper
LCB(CD): Centrale, RCB(CD): Stopper
LB(WD): Corner Back, RB(WD): Corner Back
LM(WM): Tornante, RM(WM): Tornante
LCM(CM): Tuttocampista, CDM(DM): Anchor, RCM(CM): Metodista
CF(CF): Target Forward, Wide Target Forward [WF alt on LM if 4-3-3 variant]
```

**Il Muro** (3-5-2) — Conte's Italy Euro 2016 — "The wall of three, wing-backs provide width"
```
GK(GK): Comandante
LCB(CD): Stopper, CCB(CD): Centrale, RCB(CD): Stopper
LWB(WD): Wing-back, RWB(WD): Wing-back
LCM(CM): Tuttocampista, CDM(DM): Anchor, RCM(CM): Mezzala
LF(CF): Seconda Punta, RF(CF): Spearhead
```

### 3. Joga Bonito

**Samba** (4-2-4) — Brazil 1958-62 — "Four forwards, two holding — pure attacking expression"
```
GK(GK): Shotstopper
LCB(CD): Sweeper, RCB(CD): Centrale
LB(WD): Fullback, RB(WD): Fullback
LDM(DM): Pivote, RDM(DM): Segundo Volante
LW(WF): Winger, RW(WF): Winger
LF(CF): Complete Forward, RF(CF): Poacher
```

**O Jogo** (4-2-3-1) — Brazil 1970 — "The beautiful game at its peak"
```
GK(GK): Shotstopper
LCB(CD): Sweeper, RCB(CD): Centrale
LB(WD): Fullback, RB(WD): Fullback
LDM(DM): Pivote, RDM(DM): Segundo Volante
LW(WF): Wide Playmaker, AM(AM): Trequartista, RW(WF): Winger
CF(CF): Complete Forward
```

**Ginga** (4-3-3) — Santos (Pele) / Flamengo 2019 — "Rhythm, flair, improvisation"
```
GK(GK): Shotstopper
LCB(CD): Sweeper, RCB(CD): Centrale
LB(WD): Fullback, RB(WD): Wing-back
LCM(CM): Playmaker, CDM(DM): Pivote, RCM(CM): Mezzala
LW(WF): Winger, RW(WF): Inverted Winger
CF(CF): Complete Forward
```

### 4. Total Football

**Ajax Model** (4-3-3) — Michels/Cruyff Ajax 1970-73 — "Every player can play every position"
```
GK(GK): Sweeper Keeper
LCB(CD): Distributor, RCB(CD): Sweeper
LB(WD): Fullback, RB(WD): Fullback
LCM(CM): Playmaker, CDM(DM): Pivote, RCM(CM): Tuttocampista
LW(WF): Winger, RW(WF): Inverted Winger
CF(CF): Complete Forward
```

**Oranje** (3-4-3) — Netherlands 1974 WC — "Positional interchange as philosophy"
```
GK(GK): Sweeper Keeper
LCB(CD): Distributor, CCB(CD): Sweeper, RCB(CD): Distributor
LM(WM): Winger, LCM(CM): Tuttocampista, RCM(CM): Playmaker, RM(WM): Winger
LW(WF): Inverted Winger, CF(CF): Falso Nove, RW(WF): Inverted Winger
```

**Van Gaal System** (4-3-3) — Ajax 1995 / Van Gaal's Barcelona — "Structured positional play with width"
```
GK(GK): Distributor
LCB(CD): Distributor, RCB(CD): Sweeper
LB(WD): Wing-back, RB(WD): Wing-back
LCM(CM): Metodista, CDM(DM): Regista, RCM(CM): Mezzala
LW(WF): Winger, RW(WF): Inverted Winger
CF(CF): Complete Forward
```

### 5. La Masia

**Positional Play** (4-3-3) — Guardiola's Barcelona 2008-12 — "Positional superiority through spacing"
```
GK(GK): Distributor
LCB(CD): Distributor, RCB(CD): Sweeper
LB(WD): Invertido, RB(WD): Invertido
CDM(DM): Pivote
LCM(CM): Mezzala, RCM(CM): Metodista
LW(WF): Inverted Winger, RW(WF): Inverted Winger
CF(CF): Falso Nove
```

**Inverted Build** (3-2-4-1) — Guardiola's City 2022-24 — "Fullbacks invert, overloads everywhere"
```
GK(GK): Distributor
LCB(CD): Distributor, CCB(CD): Centrale, RCB(CD): Distributor
LDM(DM): Pivote, RDM(DM): Regista
LW(WF): Inverted Winger, LAM(AM): Enganche, RAM(AM): Trequartista, RW(WF): Wide Playmaker
CF(CF): Complete Forward
```

**Relational Play** (4-2-3-1) — De Zerbi's Brighton — "Position as suggestion, relation as rule"
```
GK(GK): Distributor
LCB(CD): Distributor, RCB(CD): Sweeper
LB(WD): Invertido, RB(WD): Invertido
LDM(DM): Pivote, RDM(DM): Regista
LW(WF): Wide Playmaker, AM(AM): Enganche, RW(WF): Inverted Winger
CF(CF): Falso Nove
```

### 6. Gegenpressing

**Heavy Metal** (4-2-3-1) — Klopp's Dortmund 2010-13 — "Win the ball, go for the throat"
```
GK(GK): Sweeper Keeper
LCB(CD): Stopper, RCB(CD): Centrale
LB(WD): Fullback, RB(WD): Fullback
LDM(DM): Ball Winner, RDM(DM): Anchor
LW(WF): Raumdeuter, AM(AM): Trequartista, RW(WF): Raumdeuter
CF(CF): Spearhead
```

**Red Machine** (4-3-3) — Klopp's Liverpool 2018-20 — "Organised chaos with relentless intensity"
```
GK(GK): Sweeper Keeper
LCB(CD): Centrale, RCB(CD): Stopper
LB(WD): Wing-back, RB(WD): Wing-back
CDM(DM): Anchor
LCM(CM): Mezzala, RCM(CM): Tuttocampista
LW(WF): Inverted Winger, RW(WF): Inverted Winger
CF(CF): Spearhead
```

**Red Bull Model** (4-4-2) — Rangnick's Leipzig/Salzburg — "Press in pairs, transition in seconds"
```
GK(GK): Sweeper Keeper
LCB(CD): Stopper, RCB(CD): Stopper
LB(WD): Fullback, RB(WD): Fullback
LM(WM): Tornante, RM(WM): Tornante
LDM(DM): Ball Winner, RCM(CM): Tuttocampista
LF(CF): Spearhead, RF(CF): Shadow Striker
```

**Kyiv Prototype** (4-4-2) — Lobanovskyi's Dynamo 1986-88 — "Scientific football, universal pressing"
```
GK(GK): Shotstopper
LCB(CD): Centrale, RCB(CD): Stopper
LB(WD): Fullback, RB(WD): Fullback
LM(WM): False Winger, RM(WM): Winger
LCM(CM): Tuttocampista, RCM(CM): Playmaker
LF(CF): Spearhead, RF(CF): Poacher
```

### 7. Bielsismo

**El Loco** (3-3-1-3) — Bielsa's Athletic/Leeds — "Geometric width, man-for-man, no compromise"
```
GK(GK): Sweeper Keeper
LCB(CD): Stopper, CCB(CD): Distributor, RCB(CD): Stopper
LM(WM): Winger, CDM(DM): Ball Winner, RM(WM): Winger
AM(AM): Trequartista
LW(WF): Inverted Winger, CF(CF): Spearhead, RW(WF): Inverted Winger
```

**La Furia** (3-4-3) — Gasperini's Atalanta / Sampaoli's Chile — "Aggressive 3-at-back, wing-back mayhem"
```
GK(GK): Sweeper Keeper
LCB(CD): Stopper, CCB(CD): Centrale, RCB(CD): Stopper
LWB(WD): Wing-back, LCM(CM): Mezzala, RCM(CM): Tuttocampista, RWB(WD): Wing-back
LW(WF): Raumdeuter, CF(CF): Complete Forward, RW(WF): Inverted Winger
```

### 8. Transizione

**The Special One** (4-2-3-1) — Mourinho's Inter 2010 — "Defend with structure, kill on the break"
```
GK(GK): Shotstopper
LCB(CD): Centrale, RCB(CD): Stopper
LB(WD): Corner Back, RB(WD): Corner Back
LDM(DM): Anchor, RDM(DM): Ball Winner
LW(WF): Raumdeuter, AM(AM): Enganche, RW(WF): Inverted Winger
CF(CF): Poacher
```

**Les Bleus** (4-2-3-1) — Deschamps' France 2018 — "Talent managed through discipline and transitions"
```
GK(GK): Comandante
LCB(CD): Centrale, RCB(CD): Colossus
LB(WD): Corner Back, RB(WD): Fullback
LDM(DM): Anchor, RDM(DM): Segundo Volante
LW(WF): Wide Target Forward, AM(AM): Boxcrasher, RW(WF): Raumdeuter
CF(CF): Target Forward
```

**Foxes** (4-4-2) — Ranieri's Leicester 2016 — "Counter-attack perfection with pace and heart"
```
GK(GK): Shotstopper
LCB(CD): Colossus, RCB(CD): Centrale
LB(WD): Fullback, RB(WD): Fullback
LM(WM): Winger, RM(WM): Winger
LDM(DM): Anchor, RCM(CM): Tuttocampista
LF(CF): Shadow Striker, RF(CF): Target Forward
```

### 9. POMO

**Route One** (4-4-2) — Wimbledon 1988 / Allardyce's Bolton — "Direct, territorial, set-piece kings"
```
GK(GK): Shotstopper
LCB(CD): Colossus, RCB(CD): Stopper
LB(WD): Fullback, RB(WD): Fullback
LM(WM): Winger, RM(WM): Wide Playmaker
LDM(DM): Ball Winner, RCM(CM): Tuttocampista
LF(CF): Poacher, RF(CF): Target Forward
```

**Fortress** (4-5-1) — Pulis's Stoke / Dyche's Burnley — "Defend deep, win ugly, never surrender"
```
GK(GK): Shotstopper
LCB(CD): Colossus, RCB(CD): Stopper
LB(WD): Corner Back, RB(WD): Corner Back
LM(WM): Tornante, RM(WM): Tornante
LDM(DM): Anchor, CDM(DM): Ball Winner, RCM(CM): Tuttocampista
CF(CF): Target Forward
```

### 10. Leadership

**Wing Play** (4-4-2) — Ferguson's United 1996-2001 — "Width, pace, and never-say-die spirit"
```
GK(GK): Comandante
LCB(CD): Centrale, RCB(CD): Stopper
LB(WD): Fullback, RB(WD): Fullback
LM(WM): Winger, RM(WM): Wide Playmaker
LCM(CM): Playmaker, RCM(CM): Mezzala
LF(CF): Poacher, RF(CF): Complete Forward
```

**European Nights** (4-5-1) — Ferguson's United 2008 CL — "Adapt, contain, then unleash"
```
GK(GK): Comandante
LCB(CD): Centrale, RCB(CD): Stopper
LB(WD): Corner Back, RB(WD): Fullback
LM(WM): Tornante, RM(WM): False Winger
LCM(CM): Tuttocampista, CDM(DM): Anchor, RCM(CM): Playmaker
CF(CF): Complete Forward
```

**Ancelotti Ball** (4-3-3) — Ancelotti's Real Madrid 2022-24 — "Balance, experience, big-game mentality"
```
GK(GK): Comandante
LCB(CD): Centrale, RCB(CD): Stopper
LB(WD): Fullback, RB(WD): Fullback
CDM(DM): Anchor
LCM(CM): Mezzala, RCM(CM): Playmaker
LW(WF): Inverted Winger, RW(WF): Winger
CF(CF): Complete Forward
```

### Role Coverage Verification

Every role appears in at least one system slot:

| Role | Position | Systems Using It |
|------|----------|-----------------|
| Comandante | GK | La Celeste, Muralla, Il Muro, Les Bleus, Wing Play, European Nights, Ancelotti Ball |
| Sweeper Keeper | GK | Ajax Model, Oranje, Heavy Metal, Red Machine, Red Bull, El Loco, La Furia |
| Distributor | GK | Positional Play, Inverted Build, Relational Play, Van Gaal |
| Shotstopper | GK | Grande Inter, Trincea, Samba, O Jogo, Ginga, Kyiv, Special One, Foxes, Route One, Fortress, Kyiv Prototype |
| Centrale | CD | La Celeste, Muralla, Trincea, Il Muro, Samba, O Jogo, Ginga, Heavy Metal, Red Machine, Kyiv, La Furia, Special One, Les Bleus, Foxes, Inverted Build, Wing Play, European Nights, Ancelotti Ball |
| Distributor | CD | Ajax Model, Oranje, Van Gaal, Positional Play, Inverted Build, Relational Play, El Loco |
| Stopper | CD | La Celeste, Muralla, Grande Inter, Trincea, Il Muro, Heavy Metal, Red Machine, Red Bull, Kyiv, El Loco, La Furia, Special One, Route One, Fortress, Wing Play, European Nights, Ancelotti Ball |
| Sweeper | CD | Muralla, Grande Inter, Samba, O Jogo, Ginga, Ajax Model, Oranje, Van Gaal, Positional Play, Relational Play |
| Colossus | CD | Les Bleus, Foxes, Route One, Fortress |
| Fullback | WD | La Celeste, Samba, O Jogo, Ginga, Ajax Model, Heavy Metal, Red Bull, Kyiv, Les Bleus, Foxes, Route One, Wing Play, European Nights, Ancelotti Ball |
| Wing-back | WD | Grande Inter, Il Muro, Ginga, Van Gaal, Red Machine, La Furia |
| Corner Back | WD | La Celeste, Muralla, Trincea, Special One, Les Bleus, Fortress, European Nights |
| Invertido | WD | Positional Play, Relational Play |
| Regista | DM | Van Gaal, Positional Play(?—not default), Inverted Build, Relational Play |
| Pivote | DM | Samba, O Jogo, Ginga, Ajax Model, Positional Play, Inverted Build, Relational Play |
| Anchor | DM | La Celeste, Muralla, Grande Inter, Trincea, Il Muro, Heavy Metal, Red Machine, Special One, Les Bleus, Foxes, Fortress, European Nights, Ancelotti Ball |
| Ball Winner | DM | Heavy Metal, Red Bull, El Loco, Special One, Route One, Fortress |
| Segundo Volante | DM | Samba, O Jogo, Les Bleus |
| Playmaker | CM | Ginga, Ajax Model, Oranje, Kyiv, Wing Play, European Nights, Ancelotti Ball |
| Metodista | CM | Grande Inter, Trincea, Van Gaal, Positional Play |
| Mezzala | CM | Grande Inter, Ginga, Van Gaal, Positional Play, Red Machine, La Furia, Wing Play, Ancelotti Ball |
| Tuttocampista | CM | La Celeste, Muralla, Il Muro, Trincea, Ajax Model, Oranje, Red Bull, Red Machine, Kyiv, La Furia, Foxes, Route One, Fortress, European Nights |
| Winger | WM | La Celeste, Muralla, Kyiv, Oranje, El Loco, Foxes, Route One |
| Tornante | WM | La Celeste, Trincea, Red Bull, Fortress, European Nights, Muralla |
| False Winger | WM | Kyiv, European Nights |
| Wide Playmaker | WM | Route One, Wing Play |
| Trequartista | AM | O Jogo, Heavy Metal, El Loco, Inverted Build |
| Enganche | AM | Special One, Relational Play, Inverted Build |
| Boxcrasher | AM | Les Bleus |
| Inverted Winger | WF | Ginga, Ajax Model, Oranje, Van Gaal, Positional Play, Red Machine, El Loco, La Furia, Special One, Relational Play, Inverted Build, Ancelotti Ball |
| Raumdeuter | WF | Heavy Metal, La Furia, Special One, Les Bleus |
| Winger | WF | Samba, O Jogo, Ancelotti Ball |
| Wide Playmaker | WF | O Jogo, Inverted Build, Relational Play |
| Wide Target Forward | WF | Les Bleus |
| Poacher | CF | Grande Inter, Samba, Kyiv, Special One, Route One, Wing Play |
| Complete Forward | CF | Ginga, Ajax Model, Van Gaal, Inverted Build, La Furia, Wing Play, European Nights, Ancelotti Ball |
| Falso Nove | CF | Oranje, Positional Play, Relational Play |
| Spearhead | CF | La Celeste, Il Muro, Heavy Metal, Red Machine, Red Bull, Kyiv, El Loco |
| Target Forward | CF | Muralla, Trincea, Les Bleus, Foxes, Route One, Fortress |
| Seconda Punta | CF | Grande Inter, Il Muro |
| Shadow Striker | CF | Red Bull, Foxes |

All 41 roles covered.

---

## Task 1: Database Migration

**Files:**
- Create: `pipeline/sql/049_systems_and_roles.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- 049_systems_and_roles.sql
-- New hierarchy: philosophy > system > slot > role
-- Replaces: tactical_roles, philosophy_formations, philosophy_roles

-- ── New tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tactical_systems (
  id SERIAL PRIMARY KEY,
  philosophy_id INT REFERENCES tactical_philosophies(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  formation TEXT NOT NULL,
  defining_team TEXT,
  key_principle TEXT,
  variant_of INT REFERENCES tactical_systems(id)
);

CREATE TABLE IF NOT EXISTS system_slots (
  id SERIAL PRIMARY KEY,
  system_id INT REFERENCES tactical_systems(id) ON DELETE CASCADE,
  slot_label TEXT NOT NULL,
  position TEXT NOT NULL,
  sort_order INT NOT NULL,
  UNIQUE(system_id, slot_label)
);

CREATE TABLE IF NOT EXISTS slot_roles (
  id SERIAL PRIMARY KEY,
  slot_id INT REFERENCES system_slots(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  primary_model TEXT NOT NULL,
  secondary_model TEXT NOT NULL,
  rationale TEXT,
  UNIQUE(slot_id, role_name)
);

-- ── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX idx_tactical_systems_philosophy ON tactical_systems(philosophy_id);
CREATE INDEX idx_system_slots_system_id ON system_slots(system_id);
CREATE INDEX idx_system_slots_position ON system_slots(position);
CREATE INDEX idx_slot_roles_slot_id ON slot_roles(slot_id);

-- ── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE tactical_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON tactical_systems FOR SELECT USING (true);
CREATE POLICY "public_read" ON system_slots FOR SELECT USING (true);
CREATE POLICY "public_read" ON slot_roles FOR SELECT USING (true);
```

- [ ] **Step 2: Apply migration to staging**

```bash
cd /Users/solid-snake/Documents/chief-scout
# Apply via Supabase dashboard SQL editor or:
python -c "
from dotenv import load_dotenv; import os, psycopg2
load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
conn.autocommit = True
with open('pipeline/sql/049_systems_and_roles.sql') as f:
    conn.cursor().execute(f.read())
print('Migration 049 applied')
conn.close()
"
```

Expected: Tables created, no errors.

- [ ] **Step 3: Verify tables exist**

```bash
python -c "
from dotenv import load_dotenv; import os, psycopg2
load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
cur = conn.cursor()
for t in ['tactical_systems', 'system_slots', 'slot_roles']:
    cur.execute(f\"SELECT count(*) FROM {t}\")
    print(f'{t}: {cur.fetchone()[0]} rows')
conn.close()
"
```

Expected: All 3 tables exist with 0 rows.

- [ ] **Step 4: Commit**

```bash
git add pipeline/sql/049_systems_and_roles.sql
git commit -m "migration(049): tactical_systems, system_slots, slot_roles tables"
```

---

## Task 2: Rewrite Pipeline 83 (Seed Hierarchy)

**Files:**
- Rewrite: `pipeline/83_seed_philosophies.py`

This is the largest task. The script seeds: philosophy renames + 28 systems + ~300 slots + ~300 slot-role assignments.

- [ ] **Step 1: Define the 41-role reference data**

At the top of the rewritten `83_seed_philosophies.py`, define the complete role set. This is the source of truth that pipeline 27 will also query from the DB.

```python
# Role definitions: (role_name, position, primary_model, secondary_model)
ROLES = [
    ("Comandante",         "GK", "GK",         "Commander"),
    ("Sweeper Keeper",     "GK", "GK",         "Cover"),
    ("Distributor",        "GK", "GK",         "Passer"),
    ("Shotstopper",        "GK", "GK",         "Powerhouse"),
    ("Centrale",           "CD", "Commander",   "Destroyer"),
    ("Distributor",        "CD", "Passer",      "Cover"),
    ("Stopper",            "CD", "Powerhouse",  "Destroyer"),
    ("Sweeper",            "CD", "Cover",       "Controller"),
    ("Colossus",           "CD", "Target",      "Powerhouse"),
    ("Fullback",           "WD", "Engine",      "Passer"),
    ("Wing-back",          "WD", "Engine",      "Dribbler"),
    ("Corner Back",        "WD", "Cover",       "Destroyer"),
    ("Invertido",          "WD", "Controller",  "Passer"),
    ("Regista",            "DM", "Passer",      "Controller"),
    ("Pivote",             "DM", "Controller",  "Cover"),
    ("Anchor",             "DM", "Cover",       "Destroyer"),
    ("Ball Winner",        "DM", "Engine",      "Destroyer"),
    ("Segundo Volante",    "DM", "Powerhouse",  "Engine"),
    ("Playmaker",          "CM", "Passer",      "Creator"),
    ("Metodista",          "CM", "Controller",  "Passer"),
    ("Mezzala",            "CM", "Engine",      "Creator"),
    ("Tuttocampista",      "CM", "Engine",      "Cover"),
    ("Winger",             "WM", "Dribbler",    "Passer"),
    ("Tornante",           "WM", "Engine",      "Cover"),
    ("False Winger",       "WM", "Controller",  "Creator"),
    ("Wide Playmaker",     "WM", "Creator",     "Passer"),
    ("Trequartista",       "AM", "Dribbler",    "Creator"),
    ("Enganche",           "AM", "Creator",     "Controller"),
    ("Boxcrasher",         "AM", "Sprinter",    "Striker"),
    ("Inverted Winger",     "WF", "Dribbler",    "Striker"),
    ("Raumdeuter",         "WF", "Engine",      "Striker"),
    ("Winger",             "WF", "Dribbler",    "Passer"),
    ("Wide Playmaker",     "WF", "Creator",     "Passer"),
    ("Wide Target Forward","WF", "Target",      "Powerhouse"),
    ("Poacher",            "CF", "Striker",     "Engine"),
    ("Complete Forward",   "CF", "Striker",     "Creator"),
    ("Falso Nove",         "CF", "Creator",     "Controller"),
    ("Spearhead",          "CF", "Engine",      "Striker"),
    ("Target Forward",     "CF", "Target",      "Powerhouse"),
    ("Seconda Punta",      "CF", "Creator",     "Striker"),
    ("Shadow Striker",     "CF", "Sprinter",    "Striker"),
]

# Build lookup: (role_name, position) → (primary, secondary)
ROLE_LOOKUP = {(r[0], r[1]): (r[2], r[3]) for r in ROLES}
```

- [ ] **Step 2: Define the 28 systems with slot-role assignments**

Each system is a dict. Slots are lists of `(label, position, sort_order, default_role, [alt_roles])`. The sort_order goes GK=1, defenders=2-4, midfield=5-8, attack=9-11 (roughly pitch position).

```python
SYSTEMS = [
    # ── Garra Charrua ──
    {
        "slug": "la_celeste", "name": "La Celeste",
        "philosophy_slug": "garra_charrua", "formation": "4-4-2",
        "defining_team": "Uruguay 1950 / 2010",
        "key_principle": "Spirit and sacrifice define the team",
        "slots": [
            ("GK",  "GK", 1, "Comandante",    []),
            ("LCB", "CD", 2, "Centrale",       []),
            ("RCB", "CD", 3, "Stopper",        []),
            ("LB",  "WD", 4, "Corner Back",    []),
            ("RB",  "WD", 5, "Fullback",       []),
            ("LM",  "WM", 6, "Tornante",       []),
            ("RM",  "WM", 7, "Winger",         []),
            ("LCM", "DM", 8, "Anchor",         []),
            ("RCM", "CM", 9, "Tuttocampista",  []),
            ("LF",  "CF", 10, "Target Forward", []),
            ("RF",  "CF", 11, "Spearhead",     []),
        ],
    },
    {
        "slug": "muralla", "name": "Muralla",
        "philosophy_slug": "garra_charrua", "formation": "5-4-1",
        "defining_team": "Tabarez's Uruguay 2018",
        "key_principle": "The wall — five-man defensive block",
        "slots": [
            ("GK",  "GK", 1, "Comandante",    []),
            ("LCB", "CD", 2, "Stopper",        []),
            ("CCB", "CD", 3, "Centrale",       []),
            ("RCB", "CD", 4, "Sweeper",        []),
            ("LWB", "WD", 5, "Corner Back",    []),
            ("RWB", "WD", 6, "Corner Back",    []),
            ("LM",  "WM", 7, "Tornante",       []),
            ("RM",  "WM", 8, "Winger",         []),
            ("LCM", "DM", 9, "Anchor",         []),
            ("RCM", "CM", 10, "Tuttocampista", []),
            ("CF",  "CF", 11, "Target Forward", []),
        ],
    },
    # ── Catenaccio ──
    {
        "slug": "grande_inter", "name": "Grande Inter",
        "philosophy_slug": "catenaccio", "formation": "5-3-2",
        "defining_team": "Herrera's Inter 1963-66",
        "key_principle": "Lock the door, then counter with precision",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",   []),
            ("LCB", "CD", 2, "Stopper",        []),
            ("CCB", "CD", 3, "Sweeper",        []),
            ("RCB", "CD", 4, "Stopper",        []),
            ("LWB", "WD", 5, "Wing-back",      []),
            ("RWB", "WD", 6, "Wing-back",      []),
            ("LCM", "CM", 7, "Metodista",      []),
            ("CDM", "DM", 8, "Anchor",         []),
            ("RCM", "CM", 9, "Mezzala",        []),
            ("LF",  "CF", 10, "Seconda Punta", []),
            ("RF",  "CF", 11, "Poacher",       []),
        ],
    },
    {
        "slug": "trincea", "name": "Trincea",
        "philosophy_slug": "catenaccio", "formation": "4-5-1",
        "defining_team": "Capello's Milan / Allegri's Juventus",
        "key_principle": "Trench warfare, disciplined low block",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",    []),
            ("LCB", "CD", 2, "Centrale",        []),
            ("RCB", "CD", 3, "Stopper",         []),
            ("LB",  "WD", 4, "Corner Back",     []),
            ("RB",  "WD", 5, "Corner Back",     []),
            ("LM",  "WM", 6, "Tornante",        []),
            ("RM",  "WM", 7, "Tornante",        []),
            ("LCM", "CM", 8, "Tuttocampista",   []),
            ("CDM", "DM", 9, "Anchor",          []),
            ("RCM", "CM", 10, "Metodista",      []),
            ("CF",  "CF", 11, "Target Forward",  []),
        ],
    },
    {
        "slug": "il_muro", "name": "Il Muro",
        "philosophy_slug": "catenaccio", "formation": "3-5-2",
        "defining_team": "Conte's Italy Euro 2016",
        "key_principle": "The wall of three, wing-backs provide width",
        "slots": [
            ("GK",  "GK", 1, "Comandante",     []),
            ("LCB", "CD", 2, "Stopper",         []),
            ("CCB", "CD", 3, "Centrale",        []),
            ("RCB", "CD", 4, "Stopper",         []),
            ("LWB", "WD", 5, "Wing-back",       []),
            ("RWB", "WD", 6, "Wing-back",       []),
            ("LCM", "CM", 7, "Tuttocampista",   []),
            ("CDM", "DM", 8, "Anchor",          []),
            ("RCM", "CM", 9, "Mezzala",         []),
            ("LF",  "CF", 10, "Seconda Punta",  []),
            ("RF",  "CF", 11, "Spearhead",      []),
        ],
    },
    # ── Joga Bonito ──
    {
        "slug": "samba", "name": "Samba",
        "philosophy_slug": "joga_bonito", "formation": "4-2-4",
        "defining_team": "Brazil 1958-62",
        "key_principle": "Four forwards, two holding — pure attacking expression",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",      []),
            ("LCB", "CD", 2, "Sweeper",           []),
            ("RCB", "CD", 3, "Centrale",          []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LDM", "DM", 6, "Pivote",            []),
            ("RDM", "DM", 7, "Segundo Volante",   []),
            ("LW",  "WF", 8, "Winger",            []),
            ("RW",  "WF", 9, "Winger",            []),
            ("LF",  "CF", 10, "Complete Forward",  []),
            ("RF",  "CF", 11, "Poacher",           []),
        ],
    },
    {
        "slug": "o_jogo", "name": "O Jogo",
        "philosophy_slug": "joga_bonito", "formation": "4-2-3-1",
        "defining_team": "Brazil 1970",
        "key_principle": "The beautiful game at its peak",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",      []),
            ("LCB", "CD", 2, "Sweeper",           []),
            ("RCB", "CD", 3, "Centrale",          []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LDM", "DM", 6, "Pivote",            []),
            ("RDM", "DM", 7, "Segundo Volante",   []),
            ("LW",  "WF", 8, "Wide Playmaker",    []),
            ("AM",  "AM", 9, "Trequartista",      []),
            ("RW",  "WF", 10, "Winger",           []),
            ("CF",  "CF", 11, "Complete Forward",  []),
        ],
    },
    {
        "slug": "ginga", "name": "Ginga",
        "philosophy_slug": "joga_bonito", "formation": "4-3-3",
        "defining_team": "Santos (Pele) / Flamengo 2019",
        "key_principle": "Rhythm, flair, improvisation",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",     []),
            ("LCB", "CD", 2, "Sweeper",          []),
            ("RCB", "CD", 3, "Centrale",         []),
            ("LB",  "WD", 4, "Fullback",         []),
            ("RB",  "WD", 5, "Wing-back",        []),
            ("LCM", "CM", 6, "Playmaker",        []),
            ("CDM", "DM", 7, "Pivote",           []),
            ("RCM", "CM", 8, "Mezzala",          []),
            ("LW",  "WF", 9, "Winger",           []),
            ("RW",  "WF", 10, "Inverted Winger",  []),
            ("CF",  "CF", 11, "Complete Forward", []),
        ],
    },
    # ── Total Football ──
    {
        "slug": "ajax_model", "name": "Ajax Model",
        "philosophy_slug": "total_football", "formation": "4-3-3",
        "defining_team": "Michels/Cruyff Ajax 1970-73",
        "key_principle": "Every player can play every position",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("RCB", "CD", 3, "Sweeper",           []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LCM", "CM", 6, "Playmaker",         []),
            ("CDM", "DM", 7, "Pivote",            []),
            ("RCM", "CM", 8, "Tuttocampista",     []),
            ("LW",  "WF", 9, "Winger",            []),
            ("RW",  "WF", 10, "Inverted Winger",   []),
            ("CF",  "CF", 11, "Complete Forward",  []),
        ],
    },
    {
        "slug": "oranje", "name": "Oranje",
        "philosophy_slug": "total_football", "formation": "3-4-3",
        "defining_team": "Netherlands 1974 WC",
        "key_principle": "Positional interchange as philosophy",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("CCB", "CD", 3, "Sweeper",           []),
            ("RCB", "CD", 4, "Distributor",       []),
            ("LM",  "WM", 5, "Winger",            []),
            ("LCM", "CM", 6, "Tuttocampista",     []),
            ("RCM", "CM", 7, "Playmaker",         []),
            ("RM",  "WM", 8, "Winger",            []),
            ("LW",  "WF", 9, "Inverted Winger",    []),
            ("CF",  "CF", 10, "Falso Nove",       []),
            ("RW",  "WF", 11, "Inverted Winger",   []),
        ],
    },
    {
        "slug": "van_gaal_system", "name": "Van Gaal System",
        "philosophy_slug": "total_football", "formation": "4-3-3",
        "defining_team": "Ajax 1995 / Van Gaal's Barcelona",
        "key_principle": "Structured positional play with width",
        "slots": [
            ("GK",  "GK", 1, "Distributor",      []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("RCB", "CD", 3, "Sweeper",           []),
            ("LB",  "WD", 4, "Wing-back",         []),
            ("RB",  "WD", 5, "Wing-back",         []),
            ("LCM", "CM", 6, "Metodista",         []),
            ("CDM", "DM", 7, "Regista",           []),
            ("RCM", "CM", 8, "Mezzala",           []),
            ("LW",  "WF", 9, "Winger",            []),
            ("RW",  "WF", 10, "Inverted Winger",   []),
            ("CF",  "CF", 11, "Complete Forward",  []),
        ],
    },
    # ── La Masia ──
    {
        "slug": "positional_play", "name": "Positional Play",
        "philosophy_slug": "la_masia", "formation": "4-3-3",
        "defining_team": "Guardiola's Barcelona 2008-12",
        "key_principle": "Positional superiority through systematic spacing",
        "slots": [
            ("GK",  "GK", 1, "Distributor",      []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("RCB", "CD", 3, "Sweeper",           []),
            ("LB",  "WD", 4, "Invertido",         []),
            ("RB",  "WD", 5, "Invertido",         []),
            ("CDM", "DM", 6, "Pivote",            []),
            ("LCM", "CM", 7, "Mezzala",           []),
            ("RCM", "CM", 8, "Metodista",         []),
            ("LW",  "WF", 9, "Inverted Winger",    []),
            ("RW",  "WF", 10, "Inverted Winger",   []),
            ("CF",  "CF", 11, "Falso Nove",       []),
        ],
    },
    {
        "slug": "inverted_build", "name": "Inverted Build",
        "philosophy_slug": "la_masia", "formation": "3-2-4-1",
        "defining_team": "Guardiola's City 2022-24",
        "key_principle": "Fullbacks invert, overloads everywhere",
        "slots": [
            ("GK",  "GK", 1, "Distributor",       []),
            ("LCB", "CD", 2, "Distributor",        []),
            ("CCB", "CD", 3, "Centrale",           []),
            ("RCB", "CD", 4, "Distributor",        []),
            ("LDM", "DM", 5, "Pivote",             []),
            ("RDM", "DM", 6, "Regista",            []),
            ("LW",  "WF", 7, "Inverted Winger",     []),
            ("LAM", "AM", 8, "Enganche",           []),
            ("RAM", "AM", 9, "Trequartista",       []),
            ("RW",  "WF", 10, "Wide Playmaker",    []),
            ("CF",  "CF", 11, "Complete Forward",   []),
        ],
    },
    {
        "slug": "relational_play", "name": "Relational Play",
        "philosophy_slug": "la_masia", "formation": "4-2-3-1",
        "defining_team": "De Zerbi's Brighton",
        "key_principle": "Position as suggestion, relation as rule",
        "slots": [
            ("GK",  "GK", 1, "Distributor",      []),
            ("LCB", "CD", 2, "Distributor",       []),
            ("RCB", "CD", 3, "Sweeper",           []),
            ("LB",  "WD", 4, "Invertido",         []),
            ("RB",  "WD", 5, "Invertido",         []),
            ("LDM", "DM", 6, "Pivote",            []),
            ("RDM", "DM", 7, "Regista",           []),
            ("LW",  "WF", 8, "Wide Playmaker",    []),
            ("AM",  "AM", 9, "Enganche",          []),
            ("RW",  "WF", 10, "Inverted Winger",   []),
            ("CF",  "CF", 11, "Falso Nove",       []),
        ],
    },
    # ── Gegenpressing ──
    {
        "slug": "heavy_metal", "name": "Heavy Metal",
        "philosophy_slug": "gegenpressing", "formation": "4-2-3-1",
        "defining_team": "Klopp's Dortmund 2010-13",
        "key_principle": "Win the ball, go for the throat",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Stopper",           []),
            ("RCB", "CD", 3, "Centrale",          []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LDM", "DM", 6, "Ball Winner",       []),
            ("RDM", "DM", 7, "Anchor",            []),
            ("LW",  "WF", 8, "Raumdeuter",        []),
            ("AM",  "AM", 9, "Trequartista",      []),
            ("RW",  "WF", 10, "Raumdeuter",       []),
            ("CF",  "CF", 11, "Spearhead",        []),
        ],
    },
    {
        "slug": "red_machine", "name": "Red Machine",
        "philosophy_slug": "gegenpressing", "formation": "4-3-3",
        "defining_team": "Klopp's Liverpool 2018-20",
        "key_principle": "Organised chaos with relentless intensity",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Centrale",          []),
            ("RCB", "CD", 3, "Stopper",           []),
            ("LB",  "WD", 4, "Wing-back",         []),
            ("RB",  "WD", 5, "Wing-back",         []),
            ("CDM", "DM", 6, "Anchor",            []),
            ("LCM", "CM", 7, "Mezzala",           []),
            ("RCM", "CM", 8, "Tuttocampista",     []),
            ("LW",  "WF", 9, "Inverted Winger",    []),
            ("RW",  "WF", 10, "Inverted Winger",   []),
            ("CF",  "CF", 11, "Spearhead",        []),
        ],
    },
    {
        "slug": "red_bull_model", "name": "Red Bull Model",
        "philosophy_slug": "gegenpressing", "formation": "4-4-2",
        "defining_team": "Rangnick's Leipzig / Salzburg",
        "key_principle": "Press in pairs, transition in seconds",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Stopper",           []),
            ("RCB", "CD", 3, "Stopper",           []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LM",  "WM", 6, "Tornante",          []),
            ("RM",  "WM", 7, "Tornante",          []),
            ("LDM", "DM", 8, "Ball Winner",       []),
            ("RCM", "CM", 9, "Tuttocampista",     []),
            ("LF",  "CF", 10, "Spearhead",        []),
            ("RF",  "CF", 11, "Shadow Striker",    []),
        ],
    },
    {
        "slug": "kyiv_prototype", "name": "Kyiv Prototype",
        "philosophy_slug": "gegenpressing", "formation": "4-4-2",
        "defining_team": "Lobanovskyi's Dynamo 1986-88",
        "key_principle": "Scientific football, universal pressing",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",      []),
            ("LCB", "CD", 2, "Centrale",          []),
            ("RCB", "CD", 3, "Stopper",           []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LM",  "WM", 6, "False Winger",      []),
            ("RM",  "WM", 7, "Winger",            []),
            ("LCM", "CM", 8, "Tuttocampista",     []),
            ("RCM", "CM", 9, "Playmaker",         []),
            ("LF",  "CF", 10, "Spearhead",        []),
            ("RF",  "CF", 11, "Poacher",           []),
        ],
    },
    # ── Bielsismo ──
    {
        "slug": "el_loco", "name": "El Loco",
        "philosophy_slug": "bielsismo", "formation": "3-3-1-3",
        "defining_team": "Bielsa's Athletic Bilbao / Leeds",
        "key_principle": "Geometric width, man-for-man, no compromise",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Stopper",           []),
            ("CCB", "CD", 3, "Distributor",       []),
            ("RCB", "CD", 4, "Stopper",           []),
            ("LM",  "WM", 5, "Winger",            []),
            ("CDM", "DM", 6, "Ball Winner",       []),
            ("RM",  "WM", 7, "Winger",            []),
            ("AM",  "AM", 8, "Trequartista",      []),
            ("LW",  "WF", 9, "Inverted Winger",    []),
            ("CF",  "CF", 10, "Spearhead",        []),
            ("RW",  "WF", 11, "Inverted Winger",   []),
        ],
    },
    {
        "slug": "la_furia", "name": "La Furia",
        "philosophy_slug": "bielsismo", "formation": "3-4-3",
        "defining_team": "Gasperini's Atalanta / Sampaoli's Chile",
        "key_principle": "Aggressive 3-at-back, wing-back mayhem",
        "slots": [
            ("GK",  "GK", 1, "Sweeper Keeper",   []),
            ("LCB", "CD", 2, "Stopper",           []),
            ("CCB", "CD", 3, "Centrale",          []),
            ("RCB", "CD", 4, "Stopper",           []),
            ("LWB", "WD", 5, "Wing-back",         []),
            ("LCM", "CM", 6, "Mezzala",           []),
            ("RCM", "CM", 7, "Tuttocampista",     []),
            ("RWB", "WD", 8, "Wing-back",         []),
            ("LW",  "WF", 9, "Raumdeuter",        []),
            ("CF",  "CF", 10, "Complete Forward",  []),
            ("RW",  "WF", 11, "Inverted Winger",   []),
        ],
    },
    # ── Transizione ──
    {
        "slug": "the_special_one", "name": "The Special One",
        "philosophy_slug": "transizione", "formation": "4-2-3-1",
        "defining_team": "Mourinho's Inter 2010",
        "key_principle": "Defend with structure, kill on the break",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",     []),
            ("LCB", "CD", 2, "Centrale",         []),
            ("RCB", "CD", 3, "Stopper",          []),
            ("LB",  "WD", 4, "Corner Back",      []),
            ("RB",  "WD", 5, "Corner Back",      []),
            ("LDM", "DM", 6, "Anchor",           []),
            ("RDM", "DM", 7, "Ball Winner",      []),
            ("LW",  "WF", 8, "Raumdeuter",       []),
            ("AM",  "AM", 9, "Enganche",         []),
            ("RW",  "WF", 10, "Inverted Winger",  []),
            ("CF",  "CF", 11, "Poacher",         []),
        ],
    },
    {
        "slug": "les_bleus", "name": "Les Bleus",
        "philosophy_slug": "transizione", "formation": "4-2-3-1",
        "defining_team": "Deschamps' France 2018",
        "key_principle": "Talent managed through discipline and transitions",
        "slots": [
            ("GK",  "GK", 1, "Comandante",           []),
            ("LCB", "CD", 2, "Centrale",              []),
            ("RCB", "CD", 3, "Colossus",              []),
            ("LB",  "WD", 4, "Corner Back",           []),
            ("RB",  "WD", 5, "Fullback",              []),
            ("LDM", "DM", 6, "Anchor",                []),
            ("RDM", "DM", 7, "Segundo Volante",       []),
            ("LW",  "WF", 8, "Wide Target Forward",   []),
            ("AM",  "AM", 9, "Boxcrasher",            []),
            ("RW",  "WF", 10, "Raumdeuter",           []),
            ("CF",  "CF", 11, "Target Forward",        []),
        ],
    },
    {
        "slug": "foxes", "name": "Foxes",
        "philosophy_slug": "transizione", "formation": "4-4-2",
        "defining_team": "Ranieri's Leicester 2016",
        "key_principle": "Counter-attack perfection with pace and heart",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",      []),
            ("LCB", "CD", 2, "Colossus",          []),
            ("RCB", "CD", 3, "Centrale",          []),
            ("LB",  "WD", 4, "Fullback",          []),
            ("RB",  "WD", 5, "Fullback",          []),
            ("LM",  "WM", 6, "Winger",            []),
            ("RM",  "WM", 7, "Winger",            []),
            ("LDM", "DM", 8, "Anchor",            []),
            ("RCM", "CM", 9, "Tuttocampista",     []),
            ("LF",  "CF", 10, "Shadow Striker",    []),
            ("RF",  "CF", 11, "Target Forward",    []),
        ],
    },
    # ── POMO ──
    {
        "slug": "route_one", "name": "Route One",
        "philosophy_slug": "pomo", "formation": "4-4-2",
        "defining_team": "Wimbledon 1988 / Allardyce's Bolton",
        "key_principle": "Direct, territorial, set-piece kings",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",       []),
            ("LCB", "CD", 2, "Colossus",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Fullback",           []),
            ("RB",  "WD", 5, "Fullback",           []),
            ("LM",  "WM", 6, "Winger",             []),
            ("RM",  "WM", 7, "Wide Playmaker",     []),
            ("LDM", "DM", 8, "Ball Winner",        []),
            ("RCM", "CM", 9, "Tuttocampista",      []),
            ("LF",  "CF", 10, "Poacher",           []),
            ("RF",  "CF", 11, "Target Forward",    []),
        ],
    },
    {
        "slug": "fortress", "name": "Fortress",
        "philosophy_slug": "pomo", "formation": "4-5-1",
        "defining_team": "Pulis's Stoke / Dyche's Burnley",
        "key_principle": "Defend deep, win ugly, never surrender",
        "slots": [
            ("GK",  "GK", 1, "Shotstopper",       []),
            ("LCB", "CD", 2, "Colossus",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Corner Back",        []),
            ("RB",  "WD", 5, "Corner Back",        []),
            ("LM",  "WM", 6, "Tornante",           []),
            ("RM",  "WM", 7, "Tornante",           []),
            ("LDM", "DM", 8, "Anchor",             []),
            ("CDM", "DM", 9, "Ball Winner",        []),
            ("RCM", "CM", 10, "Tuttocampista",     []),
            ("CF",  "CF", 11, "Target Forward",    []),
        ],
    },
    # ── Leadership ──
    {
        "slug": "wing_play", "name": "Wing Play",
        "philosophy_slug": "leadership", "formation": "4-4-2",
        "defining_team": "Ferguson's United 1996-2001",
        "key_principle": "Width, pace, and never-say-die spirit",
        "slots": [
            ("GK",  "GK", 1, "Comandante",        []),
            ("LCB", "CD", 2, "Centrale",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Fullback",           []),
            ("RB",  "WD", 5, "Fullback",           []),
            ("LM",  "WM", 6, "Winger",             []),
            ("RM",  "WM", 7, "Wide Playmaker",     []),
            ("LCM", "CM", 8, "Playmaker",          []),
            ("RCM", "CM", 9, "Mezzala",            []),
            ("LF",  "CF", 10, "Poacher",           []),
            ("RF",  "CF", 11, "Complete Forward",   []),
        ],
    },
    {
        "slug": "european_nights", "name": "European Nights",
        "philosophy_slug": "leadership", "formation": "4-5-1",
        "defining_team": "Ferguson's United 2008 CL",
        "key_principle": "Adapt, contain, then unleash",
        "slots": [
            ("GK",  "GK", 1, "Comandante",        []),
            ("LCB", "CD", 2, "Centrale",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Corner Back",        []),
            ("RB",  "WD", 5, "Fullback",           []),
            ("LM",  "WM", 6, "Tornante",           []),
            ("RM",  "WM", 7, "False Winger",       []),
            ("LCM", "CM", 8, "Tuttocampista",      []),
            ("CDM", "DM", 9, "Anchor",             []),
            ("RCM", "CM", 10, "Playmaker",         []),
            ("CF",  "CF", 11, "Complete Forward",   []),
        ],
    },
    {
        "slug": "ancelotti_ball", "name": "Ancelotti Ball",
        "philosophy_slug": "leadership", "formation": "4-3-3",
        "defining_team": "Ancelotti's Real Madrid 2022-24",
        "key_principle": "Balance, experience, big-game mentality",
        "slots": [
            ("GK",  "GK", 1, "Comandante",        []),
            ("LCB", "CD", 2, "Centrale",           []),
            ("RCB", "CD", 3, "Stopper",            []),
            ("LB",  "WD", 4, "Fullback",           []),
            ("RB",  "WD", 5, "Fullback",           []),
            ("CDM", "DM", 6, "Anchor",             []),
            ("LCM", "CM", 7, "Mezzala",            []),
            ("RCM", "CM", 8, "Playmaker",          []),
            ("LW",  "WF", 9, "Inverted Winger",     []),
            ("RW",  "WF", 10, "Winger",            []),
            ("CF",  "CF", 11, "Complete Forward",   []),
        ],
    },
]
```

- [ ] **Step 3: Write the seeding logic**

The script must:
1. Rename Cholismo → Transizione, Fergie Time → Leadership (UPDATE by old slug, preserve IDs)
2. Upsert all 10 philosophies (existing logic, keep all columns)
3. Insert 28 systems (DELETE + INSERT — no prior data to preserve)
4. Insert ~300 slots per system
5. Insert ~300 slot-role assignments, looking up (role_name, position) from `ROLE_LOOKUP`

```python
def seed_systems(dry_run=False):
    """Seed tactical_systems, system_slots, and slot_roles."""
    # Get philosophy ID map
    result = sb.table("tactical_philosophies").select("id, slug").execute()
    phil_map = {r["slug"]: r["id"] for r in result.data}

    if not dry_run:
        # Clear existing data (cascade will handle slots + roles)
        sb.table("tactical_systems").delete().neq("id", 0).execute()

    total_systems = 0
    total_slots = 0
    total_roles = 0

    for sys_def in SYSTEMS:
        phil_id = phil_map.get(sys_def["philosophy_slug"])
        if not phil_id:
            print(f"  WARNING: philosophy '{sys_def['philosophy_slug']}' not found")
            continue

        system_row = {
            "philosophy_id": phil_id,
            "slug": sys_def["slug"],
            "name": sys_def["name"],
            "formation": sys_def["formation"],
            "defining_team": sys_def.get("defining_team"),
            "key_principle": sys_def.get("key_principle"),
        }

        if dry_run:
            print(f"  [DRY] System: {sys_def['name']} ({sys_def['formation']})")
            total_systems += 1
            for label, pos, sort, default_role, alts in sys_def["slots"]:
                total_slots += 1
                total_roles += 1 + len(alts)
            continue

        # Insert system
        res = sb.table("tactical_systems").insert(system_row).execute()
        system_id = res.data[0]["id"]
        total_systems += 1

        for label, pos, sort, default_role, alts in sys_def["slots"]:
            # Insert slot
            slot_row = {
                "system_id": system_id,
                "slot_label": label,
                "position": pos,
                "sort_order": sort,
            }
            slot_res = sb.table("system_slots").insert(slot_row).execute()
            slot_id = slot_res.data[0]["id"]
            total_slots += 1

            # Insert default role
            key = (default_role, pos)
            if key not in ROLE_LOOKUP:
                print(f"  WARNING: role '{default_role}' at {pos} not in ROLE_LOOKUP")
                continue
            primary, secondary = ROLE_LOOKUP[key]
            role_row = {
                "slot_id": slot_id,
                "role_name": default_role,
                "is_default": True,
                "primary_model": primary,
                "secondary_model": secondary,
            }
            sb.table("slot_roles").insert(role_row).execute()
            total_roles += 1

            # Insert alt roles
            for alt_role in alts:
                alt_key = (alt_role, pos)
                if alt_key not in ROLE_LOOKUP:
                    print(f"  WARNING: alt role '{alt_role}' at {pos} not in ROLE_LOOKUP")
                    continue
                ap, as_ = ROLE_LOOKUP[alt_key]
                alt_row = {
                    "slot_id": slot_id,
                    "role_name": alt_role,
                    "is_default": False,
                    "primary_model": ap,
                    "secondary_model": as_,
                }
                sb.table("slot_roles").insert(alt_row).execute()
                total_roles += 1

    print(f"  {total_systems} systems, {total_slots} slots, {total_roles} roles seeded")
```

- [ ] **Step 4: Add philosophy rename logic**

Before the main philosophy upsert, rename the two changed philosophies:

```python
def rename_philosophies(dry_run=False):
    """Rename Cholismo→Transizione, Fergie Time→Leadership in-place."""
    renames = [
        ("cholismo", "transizione", "Transizione"),
        ("fergie_time", "leadership", "Leadership"),
    ]
    for old_slug, new_slug, new_name in renames:
        if dry_run:
            print(f"  [DRY] Rename {old_slug} → {new_slug}")
            continue
        sb.table("tactical_philosophies").update({
            "slug": new_slug, "name": new_name
        }).eq("slug", old_slug).execute()
        print(f"  Renamed {old_slug} → {new_slug}")
```

- [ ] **Step 5: Update the main block**

```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed tactical philosophies + systems")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    rename_philosophies(dry_run=args.dry_run)
    seed_philosophies(dry_run=args.dry_run)  # existing, updated with new names/data
    seed_systems(dry_run=args.dry_run)

    print("All done!")
```

- [ ] **Step 6: Run pipeline 83 --dry-run**

```bash
cd /Users/solid-snake/Documents/chief-scout
python pipeline/83_seed_philosophies.py --dry-run
```

Expected: 28 systems, ~300 slots, ~300 roles (dry-run output, no DB writes).

- [ ] **Step 7: Run pipeline 83 for real**

```bash
python pipeline/83_seed_philosophies.py
```

Expected: All data seeded. Verify:

```bash
python -c "
from dotenv import load_dotenv; import os, psycopg2
load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
cur = conn.cursor()
for t in ['tactical_systems', 'system_slots', 'slot_roles']:
    cur.execute(f'SELECT count(*) FROM {t}')
    print(f'{t}: {cur.fetchone()[0]} rows')
# Verify all 41 roles have coverage
cur.execute('SELECT DISTINCT position, role_name FROM slot_roles sr JOIN system_slots ss ON sr.slot_id = ss.id ORDER BY position, role_name')
for pos, role in cur.fetchall():
    print(f'  {pos}: {role}')
conn.close()
"
```

Expected: 28 systems, ~300 slots, ~300 roles. All 41 role names appear with correct positions.

- [ ] **Step 8: Commit**

```bash
git add pipeline/83_seed_philosophies.py
git commit -m "feat(pipeline): rewrite pipeline 83 — seed 28 systems + 41 roles hierarchy"
```

---

## Task 3: Update Pipeline 27 (41-Role Scoring)

**Files:**
- Modify: `pipeline/27_player_ratings.py:132-189` (replace TACTICAL_ROLES dict)
- Modify: `pipeline/27_player_ratings.py:404-458` (update compute_best_role)
- Modify: `pipeline/tests/test_player_ratings.py` (update test role data)

> **Design decision:** The spec suggests querying `slot_roles` at runtime, but we keep the roles as a hardcoded Python dict. Rationale: (1) tests run without a DB connection, (2) the role set changes infrequently and should be deliberate, (3) avoids adding a DB round-trip to an already complex pipeline. The DB is the source of truth for system-slot-role _assignments_ (which system uses which role where); the Python dict is the source of truth for _scoring_ (which models define each role). Both are seeded from the same spec.

- [ ] **Step 1: Write failing test for DB-driven roles**

Add a test that validates the new role lookup returns correct data shape:

```python
# In test_player_ratings.py, add to TestBestRoleSelection class:

def test_new_role_names(self):
    """New 41-role set: key roles exist with correct compounds."""
    # These are the roles that changed from the old 36-role set
    new_roles = {
        "CF": {
            "Poacher": ("Striker", "Engine"),      # was Striker+Dribbler
            "Spearhead": ("Engine", "Striker"),     # was Engine+Destroyer
            "Shadow Striker": ("Sprinter", "Striker"),  # new name for Assassin
        },
        "CM": {
            "Playmaker": ("Passer", "Creator"),    # was Creator+Passer
            "Mezzala": ("Engine", "Creator"),       # was Passer+Creator
        },
        "DM": {
            "Anchor": ("Cover", "Destroyer"),      # was Destroyer+Cover
            "Ball Winner": ("Engine", "Destroyer"), # new role
        },
        "GK": {
            "Distributor": ("GK", "Passer"),       # was Libero GK
            "Comandante": ("GK", "Commander"),     # was GK+Organiser
            "Shotstopper": ("GK", "Powerhouse"),   # was GK+Shotstopper
        },
        "CD": {
            "Colossus": ("Target", "Powerhouse"),  # new role
        },
    }
    for pos, roles_dict in new_roles.items():
        pos_roles = ratings.TACTICAL_ROLES.get(pos, [])
        role_map = {name: (p, s) for p, s, name in pos_roles}
        for role_name, (exp_primary, exp_secondary) in roles_dict.items():
            assert role_name in role_map, f"{role_name} missing from {pos}"
            actual_p, actual_s = role_map[role_name]
            assert actual_p == exp_primary, f"{role_name} primary: got {actual_p}, expected {exp_primary}"
            assert actual_s == exp_secondary, f"{role_name} secondary: got {actual_s}, expected {exp_secondary}"

def test_role_count_per_position(self):
    """Each position has the expected number of roles."""
    expected = {"GK": 4, "CD": 5, "WD": 4, "DM": 5, "CM": 4, "WM": 4, "AM": 3, "WF": 5, "CF": 7}
    for pos, count in expected.items():
        actual = len(ratings.TACTICAL_ROLES.get(pos, []))
        assert actual == count, f"{pos}: expected {count} roles, got {actual}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/solid-snake/Documents/chief-scout
python -m pytest pipeline/tests/test_player_ratings.py::TestBestRoleSelection::test_new_role_names -v
```

Expected: FAIL (old role names don't match).

- [ ] **Step 3: Replace TACTICAL_ROLES dict in pipeline 27**

Replace lines 132-189 of `pipeline/27_player_ratings.py`:

```python
# Tactical roles — 41 roles validated against real tactical systems.
# Each role exists in at least one system in the tactical_systems hierarchy.
# See docs/superpowers/specs/2026-03-29-systems-and-roles-design.md
TACTICAL_ROLES = {
    "GK": [
        ("GK", "Commander",   "Comandante"),
        ("GK", "Cover",       "Sweeper Keeper"),
        ("GK", "Passer",      "Distributor"),
        ("GK", "Powerhouse",  "Shotstopper"),
    ],
    "CD": [
        ("Commander", "Destroyer",  "Centrale"),
        ("Passer",    "Cover",      "Distributor"),
        ("Powerhouse","Destroyer",  "Stopper"),
        ("Cover",     "Controller", "Sweeper"),
        ("Target",    "Powerhouse", "Colossus"),
    ],
    "WD": [
        ("Engine",     "Passer",    "Fullback"),
        ("Engine",     "Dribbler",  "Wing-back"),
        ("Cover",      "Destroyer", "Corner Back"),
        ("Controller", "Passer",    "Invertido"),
    ],
    "DM": [
        ("Passer",     "Controller", "Regista"),
        ("Controller", "Cover",      "Pivote"),
        ("Cover",      "Destroyer",  "Anchor"),
        ("Engine",     "Destroyer",  "Ball Winner"),
        ("Powerhouse", "Engine",     "Segundo Volante"),
    ],
    "CM": [
        ("Passer",     "Creator",  "Playmaker"),
        ("Controller", "Passer",   "Metodista"),
        ("Engine",     "Creator",  "Mezzala"),
        ("Engine",     "Cover",    "Tuttocampista"),
    ],
    "WM": [
        ("Dribbler",   "Passer",  "Winger"),
        ("Engine",     "Cover",   "Tornante"),
        ("Controller", "Creator", "False Winger"),
        ("Creator",    "Passer",  "Wide Playmaker"),
    ],
    "AM": [
        ("Dribbler", "Creator",    "Trequartista"),
        ("Creator",  "Controller", "Enganche"),
        ("Sprinter", "Striker",    "Boxcrasher"),
    ],
    "WF": [
        ("Dribbler", "Striker",    "Inverted Winger"),
        ("Engine",   "Striker",    "Raumdeuter"),
        ("Dribbler", "Passer",     "Winger"),
        ("Creator",  "Passer",     "Wide Playmaker"),
        ("Target",   "Powerhouse", "Wide Target Forward"),
    ],
    "CF": [
        ("Striker",  "Engine",     "Poacher"),
        ("Striker",  "Creator",    "Complete Forward"),
        ("Creator",  "Controller", "Falso Nove"),
        ("Engine",   "Striker",    "Spearhead"),
        ("Target",   "Powerhouse", "Target Forward"),
        ("Creator",  "Striker",    "Seconda Punta"),
        ("Sprinter", "Striker",    "Shadow Striker"),
    ],
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest pipeline/tests/test_player_ratings.py -v
```

Expected: All tests pass (including the new ones). Some existing tests may need minor updates if they reference old role names like "Assassin", "Libero", "Prima Punta", "Volante", etc.

- [ ] **Step 5: Update any existing tests that reference old role names**

Search and replace in test file:
- `"Assassin"` → `"Shadow Striker"`
- `"Prima Punta"` → `"Target Forward"`
- `"Libero"` (CD context) → `"Distributor"` or `"Centrale"` depending on compound
- `"Volante"` → `"Ball Winner"` or `"Segundo Volante"` depending on context
- `"Zagueiro"` → `"Centrale"`
- Any test checking `best_role` output against old names

- [ ] **Step 6: Run full test suite**

```bash
python -m pytest pipeline/tests/test_player_ratings.py -v
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add pipeline/27_player_ratings.py pipeline/tests/test_player_ratings.py
git commit -m "feat(pipeline): 41 system-validated roles replace 36 hardcoded roles"
```

---

## Task 4: Run Pipeline 27 + Validate

**Files:** No code changes — execution and validation only.

- [ ] **Step 1: Snapshot current best_role distribution**

```bash
python -c "
from dotenv import load_dotenv; import os, psycopg2
load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
cur = conn.cursor()
cur.execute('''
    SELECT best_role, count(*), round(avg(best_role_score)) as avg_score
    FROM player_profiles
    WHERE best_role IS NOT NULL
    GROUP BY best_role
    ORDER BY count(*) DESC
''')
print('BEFORE:')
for role, count, avg in cur.fetchall():
    print(f'  {role:25s} {count:5d}  avg={avg}')
conn.close()
" > /tmp/role_snapshot_before.txt
cat /tmp/role_snapshot_before.txt
```

- [ ] **Step 2: Run pipeline 27 --dry-run**

```bash
python pipeline/27_player_ratings.py --dry-run 2>&1 | tail -20
```

Expected: Dry run output showing role assignments. No DB writes.

- [ ] **Step 3: Run pipeline 27 for real**

```bash
python pipeline/27_player_ratings.py
```

Expected: ~14,000 players rated. Watch for errors.

- [ ] **Step 4: Snapshot new distribution and compare**

```bash
python -c "
from dotenv import load_dotenv; import os, psycopg2
load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
cur = conn.cursor()
cur.execute('''
    SELECT best_role, count(*), round(avg(best_role_score)) as avg_score
    FROM player_profiles
    WHERE best_role IS NOT NULL
    GROUP BY best_role
    ORDER BY count(*) DESC
''')
print('AFTER:')
for role, count, avg in cur.fetchall():
    print(f'  {role:25s} {count:5d}  avg={avg}')

# Check for orphaned roles (not in new 41-role set)
cur.execute('''
    SELECT best_role, count(*)
    FROM player_profiles
    WHERE best_role IS NOT NULL
      AND best_role NOT IN (
        'Comandante','Sweeper Keeper','Distributor','Shotstopper',
        'Centrale','Stopper','Sweeper','Colossus',
        'Fullback','Wing-back','Corner Back','Invertido',
        'Regista','Pivote','Anchor','Ball Winner','Segundo Volante',
        'Playmaker','Metodista','Mezzala','Tuttocampista',
        'Winger','Tornante','False Winger','Wide Playmaker',
        'Trequartista','Enganche','Boxcrasher',
        'Inverted Winger','Raumdeuter','Wide Target Forward',
        'Poacher','Complete Forward','Falso Nove','Spearhead',
        'Target Forward','Seconda Punta','Shadow Striker'
      )
    GROUP BY best_role
''')
orphans = cur.fetchall()
print(f'\nOrphaned roles: {len(orphans)}')
for role, count in orphans:
    print(f'  {role}: {count}')
conn.close()
"
```

Expected: Zero orphaned roles. Median role score delta within +/- 3.

- [ ] **Step 5: Validate key players**

```bash
python -c "
from dotenv import load_dotenv; import os, psycopg2
load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
cur = conn.cursor()
# Check spec success criteria players
targets = [
    'Matheus Cunha',  # should be Complete Forward or Seconda Punta
    'Kylian Mbappé',  # should have high score with Shadow Striker (Sprinter+Striker)
    'Virgil van Dijk', # Centrale (Commander+Destroyer)
    'Kevin De Bruyne', # Trequartista or Playmaker
    'N\\'Golo Kanté',  # Anchor or Ball Winner
]
for name in targets:
    cur.execute('''
        SELECT p.name, pp.best_role, pp.best_role_score
        FROM people p JOIN player_profiles pp ON p.id = pp.person_id
        WHERE p.name ILIKE %s
    ''', (f'%{name}%',))
    rows = cur.fetchall()
    for n, role, score in rows:
        print(f'{n:30s} → {role:25s} ({score})')
conn.close()
"
```

- [ ] **Step 6: Refresh materialized view**

```bash
python -c "
from dotenv import load_dotenv; import os, psycopg2
load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
conn.autocommit = True
cur = conn.cursor()
cur.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY player_intelligence_card')
cur.execute('SELECT count(*) FROM player_intelligence_card')
print(f'Materialized view refreshed: {cur.fetchone()[0]} rows')
conn.close()
"
```

---

## Task 5: Frontend Updates

**Files:**
- Rewrite: `apps/web/src/lib/formation-intelligence.ts`
- Modify: `apps/web/src/lib/tactical-philosophies.ts` (add System interfaces)
- Modify: `apps/web/src/app/tactics/page.tsx` (query new tables)
- Modify: `apps/web/src/app/tactics/[slug]/page.tsx` (show systems)
- Modify: `apps/web/src/components/TacticsPage.tsx` (accept systems data)
- Modify: `apps/web/src/components/PhilosophyDetail.tsx` (render systems)

- [ ] **Step 1: Add TypeScript interfaces for new schema**

In `apps/web/src/lib/tactical-philosophies.ts`, add:

```typescript
export interface TacticalSystem {
  id: number;
  philosophy_id: number;
  slug: string;
  name: string;
  formation: string;
  defining_team: string | null;
  key_principle: string | null;
  variant_of: number | null;
}

export interface SystemSlot {
  id: number;
  system_id: number;
  slot_label: string;
  position: string;
  sort_order: number;
}

export interface SlotRole {
  id: number;
  slot_id: number;
  role_name: string;
  is_default: boolean;
  primary_model: string;
  secondary_model: string;
  rationale: string | null;
}
```

- [ ] **Step 2: Update formation-intelligence.ts for 41 roles**

Replace the 36-role `ROLE_INTELLIGENCE` object with 41 roles. Key changes:
- Rename `"Libero GK"` → `"Distributor"` (GK context)
- Rename `"Libero"` (CD) → `"Distributor"` (CD context — same name, different intelligence)
- Rename `"Zagueiro"` → `"Centrale"`
- Add `"Colossus"` (CD)
- Rename `"Lateral"` → `"Fullback"`, `"Fluidificante"` → `"Wing-back"`, `"Corredor"` → `"Corner Back"`
  (wait — the old role names map: Lateral→Fullback, Fluidificante→Wing-back, Corredor→Corner Back)
  Actually check old→new carefully against the "Roles That Were Dropped" in spec
- Rename `"Volante"` → remove (merged into Anchor; add `"Ball Winner"` and `"Segundo Volante"`)
- Rename `"Relayeur"` → remove (redundant with Tuttocampista)
- Rename `"Shuttler"` → remove (redundant with Tornante); add `"Wide Playmaker"` (WM)
- Rename `"Seconda Punta"` — keep but only at CF now (remove from AM)
- Rename `"Inventor"` → remove; `"Extremo"` → remove; add `"Wide Target Forward"` (WF) and `"Wide Playmaker"` (WF)
- Rename `"Assassin"` → `"Shadow Striker"`, `"Prima Punta"` → `"Target Forward"`
- Update all model compound references to match new primary/secondary

Each role entry: `archetypes`, `personalities`, `minLevel`, `positions`, `keyAttributes`, `reference`.

This is a significant rewrite — ~800 lines of role intelligence data. The structure stays the same, only the role names and compound models change.

- [ ] **Step 3: Update tactics page to query new tables**

In `apps/web/src/app/tactics/page.tsx`, replace the `tactical_roles` query with:

```typescript
// Replace tactical_roles fetch with:
const [systemsResult, slotsResult, slotRolesResult] = await Promise.all([
  supabaseServer.from("tactical_systems").select("*").order("name"),
  supabaseServer.from("system_slots").select("*"),
  supabaseServer.from("slot_roles").select("*"),
]);

const systems = (systemsResult.data ?? []) as TacticalSystem[];
const systemSlots = (slotsResult.data ?? []) as SystemSlot[];
const slotRoles = (slotRolesResult.data ?? []) as SlotRole[];
```

Remove the old `philosophy_formations` and `philosophy_roles` queries (data now lives in systems).

Pass `systems`, `systemSlots`, `slotRoles` to `<TacticsPage>` instead of `roles`, `philosophyFormations`, `philosophyRoles`.

- [ ] **Step 4: Update TacticsPage component**

Update props interface and rendering. Systems are grouped by philosophy. Each system shows:
- Name + formation badge
- Defining team
- Key principle
- Slot grid (pitch layout or list with role names)

- [ ] **Step 5: Update philosophy detail page**

In `apps/web/src/app/tactics/[slug]/page.tsx`, replace `philosophy_formations` + `philosophy_roles` queries with:

```typescript
// Fetch systems for this philosophy
const systemsResult = await supabaseServer
  .from("tactical_systems")
  .select("*")
  .eq("philosophy_id", phil.id)
  .order("name");
```

Then for each system, fetch its slots and roles.

- [ ] **Step 6: Verify frontend builds**

```bash
cd /Users/solid-snake/Documents/chief-scout
cd apps/web && npx next build 2>&1 | tail -20
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 7: Smoke test key pages**

Start dev server and verify:
- `/tactics` — shows philosophies with systems grouped under each
- `/tactics/la_masia` — shows 3 systems (Positional Play, Inverted Build, Relational Play)
- `/players/[any-id]` — best_role displays correctly
- `/compare` — role comparison works
- `/formations` — redirects to `/tactics` (existing behavior)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/formation-intelligence.ts apps/web/src/lib/tactical-philosophies.ts \
  apps/web/src/app/tactics/page.tsx apps/web/src/app/tactics/\\[slug\\]/page.tsx \
  apps/web/src/components/TacticsPage.tsx apps/web/src/components/PhilosophyDetail.tsx
git commit -m "feat(frontend): 41 roles + systems hierarchy on tactics pages"
```

---

## Deferred Items

These are mentioned in the spec but explicitly deferred from this plan:

1. **`dimensions JSONB` migration** — consolidating 6 SMALLINT columns on `tactical_philosophies` into JSONB. Spec says "existing columns preserved until cleanup migration."
2. **Player detail system context** — showing "Complete Forward (Positional Play)" instead of just "Complete Forward". Requires a join from `best_role` → `slot_roles` → `system_slots` → `tactical_systems`. Low priority — adds display richness but doesn't affect scoring.
3. **`variant_of` column** — populated on `tactical_systems` but all NULL in initial seed. Reserved for future system variants.
4. **Alternative roles per slot** — the data structure supports alt_roles but initial seed only populates defaults. Pipeline 27 scores against all 41 roles per position regardless, so this only affects tactics page display.

---

## Task 6: Cleanup + Documentation

**Files:**
- Modify: `docs/systems/SACROSANCT.md` — Update System 4
- Cleanup migration (optional): drop old tables

- [ ] **Step 1: Update SACROSANCT System 4**

Replace the current 36-role taxonomy in System 4 with the 41-role taxonomy. Reference the spec for the full role table.

- [ ] **Step 2: Drop old junction tables (cleanup migration 050)**

Only after everything is validated and working:

```sql
-- 050_drop_old_role_tables.sql
-- Old tables replaced by tactical_systems + system_slots + slot_roles

-- Remove FK from formation_slots if it references tactical_roles
ALTER TABLE formation_slots DROP CONSTRAINT IF EXISTS formation_slots_role_id_fkey;
ALTER TABLE formation_slots DROP COLUMN IF EXISTS role_id;

-- Drop old tables
DROP TABLE IF EXISTS philosophy_roles;
DROP TABLE IF EXISTS philosophy_formations;
DROP TABLE IF EXISTS tactical_roles;
```

- [ ] **Step 3: Verify no remaining references to dropped tables**

```bash
# Search codebase for any remaining references
grep -r "tactical_roles\|philosophy_formations\|philosophy_roles" \
  --include="*.ts" --include="*.tsx" --include="*.py" \
  apps/ pipeline/ | grep -v node_modules | grep -v __pycache__
```

Expected: Zero matches (or only in migration SQL history files and docs).

- [ ] **Step 4: Final commit**

```bash
git add docs/systems/SACROSANCT.md pipeline/sql/050_drop_old_role_tables.sql
git commit -m "chore: drop tactical_roles/philosophy_formations/philosophy_roles, update SACROSANCT"
```

---

## Success Criteria (from spec)

- [ ] Every role in `slot_roles` exists in at least one real tactical system (41 total)
- [ ] No orphan roles (roles not used by any system)
- [ ] Matheus Cunha gets Complete Forward or Seconda Punta, not Outlet/Assassin
- [ ] Mbappe role score improves (Shadow Striker with Sprinter+Striker models)
- [ ] Pipeline 27 produces valid `best_role` for all players using system-validated roles
- [ ] Zero players with `best_role` values not in the new 41-role set after pipeline rerun
- [ ] Median role score change within +/- 3 points (no bulk regression)
- [ ] No player loses more than 15 role score points without explanation
- [ ] All 22 existing club-philosophy assignments survive the rename
- [ ] All 28 systems display correctly on `/tactics/[slug]` with formation pitch view
- [ ] Frontend smoke: `/formations`, `/compare`, player detail, squad builder all load
- [ ] SACROSANCT updated to reflect new taxonomy
