# Director of Football — Game Design Plan

> **Status**: Draft
> **Route**: `/director`
> **Tagline**: *Build a dynasty. Every signing tells a story.*

---

## 1. Concept

Football Manager from the boardroom. You don't pick the team or shout from the touchline — you build the squad, set the philosophy, hire the right manager, and shape the club's identity over seasons. The match engine is abstracted: results emerge from how well your squad, philosophy, and manager align.

**Core loop**: Scout → Evaluate → Negotiate → Sign → Review (repeat each window)

**What makes it different from FM**: You never touch tactics or team selection. You set a *direction* — the manager interprets it. Your job is to give them the tools and watch what happens.

---

## 2. What Already Exists (leverage, don't rebuild)

| Asset | Table/Code | Reuse |
|-------|-----------|-------|
| 200+ scouted players with full profiles | `people`, `player_profiles`, `player_personality` | Player pool for transfers |
| Four-pillar scores | `/api/players/[id]/assessment` | Player evaluation UI |
| 6-pillar DoF assessments | `dof_assessments` | Deep scouting reports |
| Valuation engine (p10-p90 bands) | `player_valuations` | Negotiation anchor prices |
| Squad roles (Key→Surplus) | `player_status.squad_role` | Squad planning |
| Club needs + depth analysis | `club_needs`, `/api/squad` | Gap identification |
| Formations + tactical roles | `formations`, `tactical_roles` | Philosophy system |
| Shortlists | `shortlists`, `shortlist_players` | Watchlist feature |
| Gaffer user system | `fc_users`, dimension scores | DoF identity profile |
| Football identity engine | `football-identity.ts` | DoF archetype computation |
| PlayerCard, FormationDetail | Components | UI reuse |
| Contract tags, fitness tags | `player_status` | Transfer context |

**Key insight**: The hard part (data) is done. The game is mostly UI + state machine + light simulation.

---

## 3. Game Architecture

### 3.1 Core State: The Club

Each user manages a club. Initial release: pick from real clubs in the database (they have squads, needs, budgets). Future: create fictional clubs.

```
dof_clubs (new table)
├── id (uuid)
├── fc_user_id → fc_users(id)
├── club_id → clubs(id)          -- real club template
├── club_name (text)
├── season (int, starts at 1)
├── transfer_budget_eur (bigint)
├── wage_budget_weekly_eur (int)
├── reputation (1-100)           -- affects which players say yes
├── board_patience (1-10)        -- how many bad windows before sacked
├── philosophy_id → dof_philosophies(id)
├── manager_id → dof_managers(id)
├── created_at, updated_at
```

### 3.2 Philosophy System

The DoF sets a club philosophy that constrains/rewards signings. Not a formation — a *direction*.

```
dof_philosophies (new table)
├── id (serial)
├── name (text)                  -- e.g., "Total Football", "British Core", "Moneyball"
├── description (text)
├── preferred_archetypes (text[])  -- bonus for signing these
├── preferred_age_range (int4range) -- e.g., [21,27)
├── personality_bias (text)      -- e.g., "Leader", "Competitor"
├── formation_style (text)       -- e.g., "possession", "counter", "pressing"
├── youth_weight (0-100)         -- how much academy matters
├── wage_discipline (0-100)      -- tolerance for big wages
```

**Seed philosophies** (~8-10):

| Philosophy | Archetypes | Age | Style |
|-----------|-----------|-----|-------|
| Total Football | Controller, Passer, Creator | 22-28 | Possession |
| Gegenpressing | Engine, Destroyer, Sprinter | 21-27 | Pressing |
| Catenaccio | Cover, Commander, Destroyer | 24-32 | Counter |
| British Core | Powerhouse, Engine, Target | 22-30 | Direct |
| La Masia Way | Creator, Passer, Dribbler | 17-24 | Possession |
| Moneyball | Any (value > skill) | 20-26 | Data-driven |
| Galácticos | Dribbler, Striker, Creator | 24-31 | Star-led |
| The Ajax Model | Controller, Creator, Engine | 17-23 | Youth dev |

### 3.3 Manager Hire

You don't manage — you hire someone who does. The manager has preferences that must align with your philosophy (or sparks fly).

```
dof_managers (new table, seeded ~20)
├── id (serial)
├── name (text)                   -- fictional: "Marco Valenti"
├── nationality (text)
├── preferred_formation_id → formations(id)
├── tactical_style (text)         -- possession/counter/pressing/direct
├── personality (text)            -- demanding/player-friendly/pragmatic/idealist
├── youth_development (1-10)
├── man_management (1-10)
├── tactical_flexibility (1-10)
├── reputation (1-100)
├── wage_demand_weekly (int)
```

**Philosophy-Manager fit** = alignment score (0-100). High fit → squad overperforms. Low fit → dressing room unrest, board pressure.

### 3.4 Squad Roster

```
dof_squad (new table)
├── id (serial)
├── dof_club_id → dof_clubs(id)
├── person_id → people(id)       -- REAL player from database
├── squad_role (text)            -- inherited from player_status or manually set
├── shirt_number (int)
├── wage_weekly_eur (int)
├── contract_years (int)
├── signing_fee_eur (bigint)
├── signed_season (int)
├── morale (1-10)                -- affected by results + role
├── status (active|injured|loaned_out|transfer_listed)
```

### 3.5 Transfer System

The core gameplay loop. Each transfer window:

1. **Board sets budget** (based on reputation + results + revenue)
2. **DoF reviews squad** — see gaps via club_needs logic
3. **DoF scouts targets** — browse real players, filter by need
4. **DoF makes offer** — fee + wage + contract length
5. **Negotiation** — simplified state machine:
   - Offer → Accepted / Rejected / Counter
   - Factors: player ambition, club reputation, wage offer, role offered, philosophy fit
6. **Sell players** — AI clubs bid on your listed players

```
dof_transfers (new table)
├── id (serial)
├── dof_club_id → dof_clubs(id)
├── person_id → people(id)
├── direction (in|out)
├── fee_eur (bigint)
├── wage_weekly_eur (int)
├── contract_years (int)
├── season (int)
├── window (summer|january)
├── status (proposed|negotiating|accepted|rejected|completed)
├── from_club (text)
├── to_club (text)
```

**Negotiation logic** (no match engine needed — pure decision math):

```
acceptance_probability = base_prob
  × reputation_factor(your_club, player_ambition)
  × wage_factor(offered_wage, player_market_value)
  × role_factor(offered_role, player_level)
  × philosophy_factor(your_philosophy, player_archetype)
  × age_factor(player_age, contract_length)
```

Each factor is 0.5-1.5 multiplier. Product > 0.6 = likely accept. Randomness ±15%.

### 3.6 Season Simulation (lightweight)

No match engine. Season outcomes are probability-weighted based on:

- **Squad strength** = avg(player.level) weighted by squad_role importance
- **Squad balance** = coverage across all positions (depth_rating)
- **Philosophy fit** = % of squad matching philosophy archetypes
- **Manager fit** = philosophy-manager alignment score
- **Morale** = avg squad morale
- **Luck** = ±10% random variance

Output per season:
- League finish (1st-20th)
- Cup run (round reached)
- Top scorer, top assister, best player (from squad)
- Player development: young players gain +1-3 levels, old players decline
- Board assessment: "Exceeded expectations" / "Met expectations" / "Disappointed"

```
dof_seasons (new table)
├── id (serial)
├── dof_club_id → dof_clubs(id)
├── season_number (int)
├── league_finish (int)
├── cup_round (text)
├── squad_strength (float)
├── philosophy_fit (float)
├── board_rating (text)
├── budget_change_pct (int)     -- next season's budget adjustment
├── events (jsonb)              -- notable moments
├── top_scorer_id, top_assister_id, best_player_id
```

### 3.7 DoF Identity (extends Gaffer system)

As you make decisions, your DoF profile builds — reusing the Gaffer dimension system but with DoF-specific archetypes.

**New dimensions** (separate from manager dimensions, stored on fc_users):

```
dof_dimensions (new columns on fc_users OR new table)
├── spend_vs_develop (0-100)     -- 0=academy only, 100=chequebook
├── star_vs_squad (0-100)        -- 0=depth, 100=galácticos
├── data_vs_instinct (0-100)     -- 0=eye test, 100=analytics
├── loyalty_vs_ruthless (0-100)  -- 0=sentimental, 100=cold
├── risk_vs_safe (0-100)         -- 0=proven only, 100=gambles
```

**DoF Archetypes** (~10):

| Archetype | Primary | Direction | Tagline |
|-----------|---------|-----------|---------|
| The Zorc | spend_vs_develop | low | "The best transfers are the ones you don't make" |
| The Abramovich | spend_vs_develop | high | "Money talks. Trophies answer." |
| The Campos | data_vs_instinct | high | "I see what the data sees, before anyone else" |
| The Clough | data_vs_instinct | low | "I don't need a spreadsheet to know a player" |
| The Wenger | loyalty_vs_ruthless | low | "I believed in him when no one else did" |
| The Paratici | loyalty_vs_ruthless | high | "Sentiment is the enemy of progress" |
| The Mislintat | risk_vs_safe | high | "The diamond in the rough is worth the search" |
| The Woodward | star_vs_squad | high | "Sign the name, sell the shirt" |
| The Begiristain | star_vs_squad | low | "Twenty good players beat three great ones" |
| The Rangnick | risk_vs_safe | low | "Process over pedigree" |

Identity builds from *every action*: signing a 33-year-old shifts loyalty→ruthless, signing from the academy shifts spend→develop, etc.

---

## 4. UI / Page Structure

### `/director` — Hub

```
┌──────────────────────────────────────────────┐
│  DIRECTOR OF FOOTBALL          Season 3      │
│  ─────────────────────────────────────────── │
│  [Club Badge]  FC Example                    │
│  Budget: €45M  │  Wage Space: €120K/wk       │
│  Board Patience: ████████░░ (8/10)           │
│                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │  SQUAD  │ │ SCOUT   │ │ WINDOW  │        │
│  │ 28 plrs │ │ 12 tgts │ │ Summer  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  Philosophy: Gegenpressing  │  Manager: Valenti│
│  Fit: 87%                                    │
│                                              │
│  ┌─ SQUAD NEEDS ────────────────────────┐    │
│  │ ⚠ CM — thin (1 player)              │    │
│  │ ⚠ WF — empty                         │    │
│  │ ✓ CD — strong                         │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [Advance to Transfer Window →]              │
│  [Advance to End of Season →]                │
└──────────────────────────────────────────────┘
```

### `/director/squad` — Squad Management

Reuses existing squad page pattern. Pitch visualization showing formation + players. Tap player → morale, stats, contract. Can transfer-list or adjust role.

### `/director/scout` — Scouting

Browse the REAL Chief Scout player database filtered by:
- Position need
- Budget range (valuation p50 ≤ remaining budget)
- Philosophy fit (archetype match)
- Age range
- Level range

Each player shows: Four-pillar mini card + valuation range + philosophy fit %.

**Add to shortlist** → track targets across windows.

### `/director/transfers` — Transfer Window

Active negotiations. Each deal shows:
- Player card
- Your offer vs. their valuation
- Acceptance probability bar
- Negotiate / Walk Away / Improve Offer

### `/director/season` — Season Review

End-of-season report card. League table, cup run, board assessment, budget for next season, player development changes.

### `/director/profile` — DoF Identity

Your accumulated identity across all decisions. Archetype name + tagline + dimension radar chart. History of key signings.

---

## 5. Build Phases

### Phase 1: Foundation (migration + seed data)
- [ ] Migration: `dof_clubs`, `dof_philosophies`, `dof_managers`, `dof_squad`, `dof_transfers`, `dof_seasons`
- [ ] Seed 8-10 philosophies
- [ ] Seed 15-20 fictional managers with varied profiles
- [ ] DoF identity dimensions (extend `fc_users` or new table)
- [ ] API: `POST /api/director/new-game` — create club from template

### Phase 2: Club Setup Flow
- [ ] `/director` — new game wizard: pick club → pick philosophy → hire manager
- [ ] `/director` — hub dashboard (budget, needs, season)
- [ ] `/director/squad` — inherited squad from real club data

### Phase 3: Scouting & Transfers
- [ ] `/director/scout` — player browser with philosophy-fit scoring
- [ ] `/director/transfers` — offer → negotiate → complete flow
- [ ] Negotiation probability engine (pure math, no AI needed)
- [ ] Sell flow — AI-generated bids for listed players
- [ ] Budget tracking + wage cap enforcement

### Phase 4: Season Simulation
- [ ] Season outcome calculator (squad strength × fit × morale × luck)
- [ ] Player development (age curves from existing level/peak data)
- [ ] Board assessment + budget adjustment
- [ ] `/director/season` — review screen

### Phase 5: Identity & Polish
- [ ] DoF identity computation (reuse football-identity.ts pattern)
- [ ] `/director/profile` — archetype + history
- [ ] Events/narrative (injuries, wonderkid emerges, board unrest)
- [ ] Multi-season continuity (save/load game state)

---

## 6. API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/director/new-game` | Create new DoF career |
| GET | `/api/director/game/[id]` | Load game state |
| GET | `/api/director/game/[id]/squad` | Current squad |
| GET | `/api/director/game/[id]/needs` | Squad gaps |
| GET | `/api/director/scout` | Browse players (filtered) |
| POST | `/api/director/transfer/offer` | Make transfer offer |
| POST | `/api/director/transfer/[id]/negotiate` | Counter/accept/reject |
| POST | `/api/director/transfer/[id]/complete` | Finalize deal |
| POST | `/api/director/season/advance` | Simulate to next window/season end |
| GET | `/api/director/game/[id]/history` | Season history |
| GET | `/api/director/profile` | DoF identity |

---

## 7. What We DON'T Build

- **Match engine** — results are probability-weighted, not simulated
- **Tactical setup** — that's the manager's job (by design)
- **Youth academy sim** — future expansion, not v1
- **Multiplayer** — single-player first
- **AI club transfers** — other clubs don't actively trade in v1 (they just respond to your offers)
- **Financial modelling** — simplified budget, no revenue streams in v1

---

## 8. Technical Notes

- **No new external data needed** — everything comes from existing Chief Scout tables
- **Game state is per-user** — stored in `dof_*` tables, keyed by `fc_user_id`
- **Players are references** — `dof_squad.person_id` points to real `people.id`; player stats are read from existing tables at game-time, not copied
- **Season progression mutates game state** — budget, squad morale, player levels adjust
- **Reuse Gaffer auth** — same `fc_users` localStorage UUID flow
- **Reuse existing components** — PlayerCard, formation visualization, four-pillar display
- **Route structure**: all under `/director` to keep clean separation from `/squad` (admin tool)

---

## 9. Why This Works

1. **Data is the moat** — 200+ deeply profiled players with personality, archetype, valuation, traits. No other browser game has this depth backing transfer decisions.
2. **No match engine needed** — the DoF role is inherently about *building*, not *playing*. Results are emergent from squad quality, not tactical simulation.
3. **Reuse is massive** — player browser, valuation, squad analysis, formations, identity system all exist. The new code is: game state tables, negotiation math, season sim formula, and UI.
4. **Natural cross-sell** — users discover Chief Scout's player database through the game. Every transfer target links to a real profile page.
5. **Identity hook** — "You're a Campos-type DoF with Wenger's patience" is inherently shareable.

---

## 10. Estimated Scope

| Phase | New tables | New API routes | New pages | Effort |
|-------|-----------|---------------|-----------|--------|
| 1. Foundation | 6 | 1 | 0 | Small |
| 2. Club Setup | 0 | 2 | 2 | Medium |
| 3. Transfers | 0 | 4 | 2 | Medium-Large |
| 4. Season Sim | 1 | 1 | 1 | Medium |
| 5. Identity | 0-1 | 1 | 1 | Small |
| **Total** | **7** | **~9** | **~6** | — |

All phases build on existing infrastructure. The heaviest lift is Phase 3 (transfer negotiation UI + probability engine), but the logic is straightforward math over existing data.
